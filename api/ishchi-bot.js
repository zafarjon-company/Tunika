// ============================================================
//  /api/ishchi-bot — ISHCHILAR BOTI: holat, ulash va xabarlar
// ------------------------------------------------------------
//  GET                         → bot holati (token, @username, webhook)
//  POST { amal:'ulash' }       → webhookni shu saytga ulaydi + buyruqlar menyusi
//  POST { tur:'yoqlama', sana, ishchiIdlar:[...] }
//  POST { tur:'avans'|'maosh', oy, ishchiId, yangi:[yozuvId...] }
//  POST { tur:'hisob', ishchiId } → ishchiga hozirgi hisobini yuborish
//
//  XAVFSIZLIK: so'rovda summa/matn YO'Q — server hamma narsani bazadan
//  qayta o'qiydi va faqat haqiqatan o'zgargan yozuv uchun, BIR MARTA
//  xabar yuboradi (api/_ishchiBot.js jurnali). Shuning uchun begona odam
//  bu endpointni chaqirsa ham soxta xabar yubora olmaydi. "ulash" esa
//  webhookni faqat O'ZIMIZNING manzilimizga qayta ulaydi (manzil so'rovdan
//  olinmaydi).
// ============================================================
import { getDb, readShop, mergeShop, adminBormi } from './_firebase.js';
import {
  tokenYukla, tokenBormi, tokenManba, secretManba, getMe, getWebhookInfo, setWebhook, setMyCommands,
} from './_tg.js';
import { yoqlamaXabarlari, tolovXabarlari, hisobYubor } from './_ishchiBot.js';

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

async function holat(db) {
  if (!tokenBormi()) return { ok: true, token: false, admin: adminBormi() };
  const [me, wh] = await Promise.all([getMe(), getWebhookInfo()]);
  const bot = me && me.ok && me.result ? { username: me.result.username || '', nom: me.result.first_name || '' } : null;
  if (bot && bot.username) {
    // Ilova ishchiga ulash havolasini ko'rsata olishi uchun (t.me/<username>)
    const s = (await readShop(db, 'telegram-settings')) || {};
    if (s.botUsername !== bot.username) await mergeShop(db, 'telegram-settings', { botUsername: bot.username });
  }
  const w = (wh && wh.ok && wh.result) || {};
  const url = w.url || '';
  return {
    ok: true,
    token: true,
    tokenManba: tokenManba(),
    tokenXato: bot ? null : ((me && me.description) || 'token noto\'g\'ri'),
    bot,
    webhook: {
      url,
      ulangan: /\/api\/telegram$/.test(url),
      kutilgan: webhookManzil(),
      kutayotgan: Number(w.pending_update_count) || 0,
      xato: w.last_error_message || null,
      xatoVaqt: w.last_error_date ? new Date(w.last_error_date * 1000).toISOString() : null,
    },
    secret: secretManba(),
    admin: adminBormi(),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const db = await getDb();
    await tokenYukla(db, readShop);

    if (req.method === 'GET') return res.status(200).json(await holat(db));
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'metod' });

    const b = (req.body && typeof req.body === 'object') ? req.body : {};

    if (b.amal === 'ulash') {
      if (!tokenBormi()) return res.status(200).json({ ok: false, error: 'token' });
      const r = await setWebhook(webhookManzil());
      if (!r || !r.ok) return res.status(200).json({ ok: false, error: (r && r.description) || 'setWebhook' });
      await setMyCommands(BUYRUQLAR, { type: 'all_private_chats' });
      return res.status(200).json(await holat(db));
    }

    // Token bo'lmasa xabar yuborib bo'lmaydi — jim qaytamiz (ilova ishlayveradi)
    if (!tokenBormi()) return res.status(200).json({ ok: false, error: 'token' });

    if (b.tur === 'yoqlama') return res.status(200).json(await yoqlamaXabarlari(db, b.sana, b.ishchiIdlar));
    if (b.tur === 'avans' || b.tur === 'maosh') {
      return res.status(200).json(await tolovXabarlari(db, b.tur, b.oy, b.ishchiId, b.yangi));
    }
    if (b.tur === 'hisob') return res.status(200).json(await hisobYubor(db, b.ishchiId));
    return res.status(400).json({ ok: false, error: 'tur' });
  } catch (e) {
    console.error('ishchi-bot error:', e); // tafsilot faqat serverda
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
