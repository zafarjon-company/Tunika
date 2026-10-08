// ============================================================
//  /api/ishchi-bot — ISHCHILAR BOTI: holat, ulash va xabarlar
// ------------------------------------------------------------
//  GET                         → bot holati (token, @username, webhook)
//  GET  ?kunlik=1              → kunlik tekshiruv (Vercel cron, vercel.json):
//                                o'tkazib yuborilgan xabarlarni to'ldiradi
//  POST { amal:'ulash' }       → webhookni shu saytga ulaydi + buyruqlar menyusi
//  POST { tur:'yoqlama', kunlar:{ 'YYYY-MM-DD':[ishchiId...] } }
//       (eski shakl ham: { tur:'yoqlama', sana, ishchiIdlar })
//  POST { tur:'avans'|'maosh', oy, ishchiId, yangi:[yozuvId...] }
//  POST { tur:'hisob', ishchiId } → ishchiga hozirgi hisobini yuborish
//
//  Javob: { ok:true } — bajarildi; { ok:false, qayta:true } — Telegram vaqtincha
//  qabul qilmadi, ilova keyinroq qayta yuborsin (navbatda saqlaydi).
//
//  XAVFSIZLIK: so'rovda summa/matn YO'Q — server hamma narsani bazadan
//  qayta o'qiydi va faqat haqiqatan o'zgargan yozuv uchun, BIR MARTA
//  xabar yuboradi (api/_ishchiBot.js jurnali, tranzaksiya bilan). Shuning
//  uchun begona odam bu endpointni chaqirsa ham soxta xabar yubora olmaydi.
//  "ulash" webhookni faqat O'ZIMIZNING manzilimizga ulaydi (manzil so'rovdan
//  olinmaydi).
// ============================================================
import crypto from 'crypto';
import { getDb, readShop, mergeShop, adminBormi } from './_firebase.js';
import {
  tokenYukla, tokenBormi, tokenManba, secretBormi, getMe, getWebhookInfo, setWebhook, setMyCommands,
} from './_tg.js';
import { yoqlamaXabarlari, tolovXabarlari, hisobYubor, kunlikTekshiruv } from './_ishchiBot.js';

// Ishchi shaxsiy chatida "Menu" tugmasi ostidagi buyruqlar
const BUYRUQLAR = [
  { command: 'hisob', description: '💰 Hozirgi haqqim' },
  { command: 'davomat', description: '📅 Kelgan / kelmagan kunlarim' },
  { command: 'avans', description: '💸 Olgan avanslarim' },
  { command: 'maosh', description: '🧾 Oylik hisob-kitob' },
  { command: 'start', description: 'Boshlash / telefonni ulash' },
];

// Webhook manzili — loyihaning doimiy *.vercel.app domeni (preview deploylar Telegramga
// yopiq). VERCEL_PROJECT_PRODUCTION_URL ATAYIN ishlatilmaydi: u 'tunika.uz' bo'lib
// qolgan, lekin domen DNS'i hali Vercel'ga ulanmagan — webhook u yerga ulansa bot
// jim qolardi. Domen ishga tushgach kerak bo'lsa env TG_WEBHOOK_URL bilan almashtiriladi.
function webhookManzil() {
  return process.env.TG_WEBHOOK_URL || 'https://tunika-sex.vercel.app/api/telegram';
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

async function holat(db) {
  if (!tokenBormi()) return { ok: true, token: false, secret: secretBormi(), admin: adminBormi() };
  const [me, wh] = await Promise.all([getMe(), getWebhookInfo()]);
  const bot = me && me.ok && me.result ? { username: me.result.username || '', nom: me.result.first_name || '' } : null;
  const whOk = !!(wh && wh.ok && wh.result);
  const w = whOk ? wh.result : {};
  const url = w.url || '';
  const ulangan = url === webhookManzil() || /^https:\/\/[^/]+\/api\/telegram$/.test(url);
  if (bot && bot.username) {
    // Ilova ishchiga havolani faqat bot haqiqatan ulanganda ko'rsatsin (t.me/<username>).
    // getWebhookInfo vaqtincha xato bersa — eski webhookUlangan qiymatiga tegmaymiz.
    const s = (await readShop(db, 'telegram-settings')) || {};
    const patch = {};
    if (s.botUsername !== bot.username) patch.botUsername = bot.username;
    if (whOk && s.webhookUlangan !== ulangan) patch.webhookUlangan = ulangan;
    if (Object.keys(patch).length) await mergeShop(db, 'telegram-settings', patch);
  }
  return {
    ok: true,
    token: true,
    tokenManba: tokenManba(),
    tokenXato: bot ? null : ((me && me.description) || 'token noto\'g\'ri'),
    bot,
    webhook: {
      url,
      ulangan,
      kutilgan: webhookManzil(),
      kutayotgan: Number(w.pending_update_count) || 0,
      xato: w.last_error_message || null,
      xatoVaqt: w.last_error_date ? new Date(w.last_error_date * 1000).toISOString() : null,
    },
    secret: secretBormi(),
    admin: adminBormi(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // Kunlik tekshiruv (Vercel cron). CRON_SECRET o'rnatilgan bo'lsa — faqat Vercel'dan.
    // Amal idempotent: faqat hali aytilmagan xabarlarni yuboradi.
    if (req.method === 'GET' && req.query && req.query.kunlik) {
      if (process.env.CRON_SECRET
        && !safeEqual(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) {
        return res.status(401).json({ ok: false });
      }
      const db = await getDb();
      await tokenYukla(db, readShop);
      if (!tokenBormi()) return res.status(200).json({ ok: false, error: 'token' });
      return res.status(200).json(await kunlikTekshiruv(db));
    }

    const db = await getDb();
    await tokenYukla(db, readShop);

    if (req.method === 'GET') return res.status(200).json(await holat(db));
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'metod' });

    const b = (req.body && typeof req.body === 'object') ? req.body : {};

    if (b.amal === 'ulash') {
      if (!tokenBormi()) return res.status(200).json({ ok: false, error: 'token' });
      // Maxfiy so'zsiz ulash — webhook himoyasiz qolardi (api/telegram.js 401 beradi)
      if (!secretBormi()) return res.status(200).json({ ok: false, error: 'secret' });
      // Birinchi ulash (yoki boshqa manzildan ko'chish): Telegram navbatidagi 24 soatlik
      // eski update'lar tashlanadi — kecha bosilgan eski tugmalar qayta bajarilmasin
      // Holat noma'lum bo'lsa (getWebhookInfo xatosi) navbat saqlanadi — update yo'qotishdan
      // ko'ra saqlab qolish xavfsizroq
      const wh = await getWebhookInfo();
      const whOk = !!(wh && wh.ok && wh.result);
      const joriy = (whOk && wh.result.url) || '';
      const r = await setWebhook(webhookManzil(), { tashla: whOk && joriy !== webhookManzil() });
      if (!r || !r.ok) return res.status(200).json({ ok: false, error: (r && r.description) || 'setWebhook' });
      await setMyCommands(BUYRUQLAR, { type: 'all_private_chats' });
      return res.status(200).json(await holat(db));
    }

    // Token bo'lmasa xabar yuborib bo'lmaydi — jim qaytamiz (ilova ishlayveradi)
    if (!tokenBormi()) return res.status(200).json({ ok: false, error: 'token' });

    if (b.tur === 'yoqlama') {
      let kunlar = b.kunlar && typeof b.kunlar === 'object' && !Array.isArray(b.kunlar) ? b.kunlar : null;
      if (!kunlar && typeof b.sana === 'string') kunlar = { [b.sana]: Array.isArray(b.ishchiIdlar) ? b.ishchiIdlar : [] };
      return res.status(200).json(await yoqlamaXabarlari(db, kunlar || {}));
    }
    if (b.tur === 'avans' || b.tur === 'maosh') {
      return res.status(200).json(await tolovXabarlari(db, [{ tur: b.tur, oy: b.oy, ishchiId: b.ishchiId, yangi: b.yangi }]));
    }
    if (b.tur === 'hisob') return res.status(200).json(await hisobYubor(db, b.ishchiId));
    return res.status(400).json({ ok: false, error: 'tur' });
  } catch (e) {
    console.error('ishchi-bot error:', e); // tafsilot faqat serverda
    return res.status(500).json({ ok: false, qayta: true, error: 'server' });
  }
}
