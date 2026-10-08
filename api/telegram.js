// ============================================================
//  POST /api/telegram — Telegram webhook (Nazorat boti + ishchi boti)
// ------------------------------------------------------------
//  Header: X-Telegram-Bot-Api-Secret-Token (TG_WEBHOOK_SECRET yoki
//  tokendan hosil qilingan maxfiy so'z — api/_tg.js webhookSecret)
//  - message.contact  → telefon orqali ishchiga bog'lash (faqat o'zinikini)
//  - /start           → salom + telefon ulash tugmasi / ishchi menyusi
//  - 💰 Hisobim · 📅 Davomat · 💸 Avanslar · 🧾 Maosh (va /hisob, /davomat,
//    /avans, /maosh) → ishchiga FAQAT O'ZINING ma'lumoti, FAQAT shaxsiy chatda
//  - /yoqlama         → bugungi davomat (faqat menejerlar guruhi va uning a'zolari)
//  - callback_query   → tuzatish tugmalari (Keldi/Yarim/Kelmadi/Bu u emas)
//                       va ishchi menyusidagi ◀ ▶ oy tugmalari (ib|...)
//  Doim 200 qaytaradi.
// ============================================================
import crypto from 'crypto';
import { getDb, readShop, mergeShop, FieldValue } from './_firebase.js';
import {
  sendMessage, answerCallbackQuery, editMessageCaption, editMessageText, tokenYukla, webhookSecret,
  getChatMember,
} from './_tg.js';
import { findIshchiByPhone, normPhone } from './_match.js';
import { parseCb, HOLAT_LABEL } from './_cb.js';
import { bugunTashkent, vaqtTashkent } from './_attendance.js';
import { ishchiTekshir, ishchiMalumoti, bolimMatni, yoqlamaXabarlari } from './_ishchiBot.js';
import { MENYU, menyuBolimi, menyuMatni, esc } from './_ishchiMatn.js';

const MANAGER_ROLES = ['founder', 'admin', 'boshliq', 'boshqaruvchi', 'buxgalter'];

const TELEFON_TUGMA = {
  keyboard: [[{ text: '📱 Telefonni ulashish', request_contact: true }]],
  resize_keyboard: true, one_time_keyboard: true,
};

// Timing-safe solishtirish (arrival.js dagi bilan bir xil uslub)
function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  // Token env'da bo'lmasa — bazadan (Sozlamalar → Telegram bot tokeni); maxfiy so'z
  // shundan hosil qilinadi. Baza ochilmasa ham pastdagi tekshiruv fail-closed (401).
  let db = null;
  try {
    db = await getDb();
    await tokenYukla(db, readShop);
  } catch (e) {
    console.error('telegram webhook: baza/token xatosi:', e);
  }
  // XAVFSIZLIK: secret MAJBURIY — bo'lmasa 401 (fail-closed).
  // Aks holda istalgan kishi webhook'ka soxta update yuborishi mumkin edi.
  if (!db || !safeEqual(req.headers['x-telegram-bot-api-secret-token'], webhookSecret())) {
    return res.status(401).json({ ok: false });
  }
  const update = req.body || {};
  try {
    if (update.message) await onMessage(db, update.message);
    else if (update.callback_query) await onCallback(db, update.callback_query);
  } catch (e) {
    console.error('telegram webhook error:', e);
  }
  return res.status(200).json({ ok: true });
}

// Menejermi: menejerlar guruhining o'zi, menejer roli bog'langan akkaunt
// yoki menejerlar guruhining a'zosi (shaxsiy chatda /yoqlama yozsa).
async function menejermi(settings, links, chatId, fromId) {
  const guruh = settings.managersChatId ? String(settings.managersChatId) : '';
  if (guruh && String(chatId) === guruh) return true;
  const l = links[String(fromId)];
  if (l && MANAGER_ROLES.includes(l.role)) return true;
  if (!guruh || !fromId) return false;
  const r = await getChatMember(guruh, fromId);
  return !!(r && r.ok && r.result && ['creator', 'administrator', 'member'].includes(r.result.status));
}

// ---------------- Xabarlar ----------------
async function onMessage(db, msg) {
  const chatId = msg.chat.id;
  const shaxsiy = msg.chat.type === 'private';
  const tid = String(msg.from && msg.from.id);

  // --- Telefon ulash (faqat O'ZINIKINI) ---
  if (msg.contact) {
    if (!shaxsiy) return;
    if (msg.contact.user_id !== msg.from.id) {
      await sendMessage(chatId, "❗ Iltimos, faqat O'ZINGIZNING raqamingizni ulashing (pastdagi tugma orqali).");
      return;
    }
    const ishchilar = (await readShop(db, 'ishchilar')) || [];
    const m = findIshchiByPhone(ishchilar, msg.contact.phone_number);
    if (!m) {
      await sendMessage(chatId, "❌ Raqamingiz ishchilar ro'yxatida topilmadi.\nBoshqaruvchiga murojaat qiling.",
        { reply_markup: { remove_keyboard: true } });
      return;
    }
    await mergeShop(db, 'telegram-links', {
      [tid]: {
        ishchiId: m.id, role: 'ishchi', phone: normPhone(msg.contact.phone_number),
        name: m.name, linkedAt: new Date().toISOString(),
      },
    });
    await sendMessage(chatId, `✅ <b>${esc(m.name)}</b>, akkauntingiz ulandi!\n\n${menyuMatni(m.name)}`,
      { reply_markup: MENYU });
    return;
  }

  const text = (msg.text || '').trim();

  // Guruh/chat ID ni topish uchun (Sozlamalarga kiritish uchun)
  if (text === '/id' || text.startsWith('/id@') || text.startsWith('/id ')) {
    await sendMessage(chatId,
      `🆔 Bu chat ID:\n<code>${chatId}</code>\n\n`
      + `<i>Menejerlar guruhi bo'lsa — shu ID ni Tunika → Sozlamalar → Nazorat boti'ga kiriting.</i>`);
    return;
  }

  if (text === '/yoqlama' || text.startsWith('/yoqlama@')) {
    const settings = (await readShop(db, 'telegram-settings')) || {};
    const links = (await readShop(db, 'telegram-links')) || {};
    if (await menejermi(settings, links, chatId, msg.from && msg.from.id)) {
      await yoqlamaHisobot(db, chatId);
    } else {
      await sendMessage(chatId, "🔒 Umumiy yo'qlama faqat boshqaruvchilar uchun.\nO'z davomatingiz: 📅 Davomat");
    }
    return;
  }

  const bolim = text.startsWith('/start') ? 'start' : menyuBolimi(text);

  // Guruhlarda shaxsiy ma'lumot KO'RSATILMAYDI (maosh/avans boshqalarga ko'rinmasin)
  if (!shaxsiy) {
    if (bolim) {
      await sendMessage(chatId, "🔒 Shaxsiy hisob faqat bot bilan <b>shaxsiy chatda</b> ko'rsatiladi.");
    }
    return;
  }

  const links = (await readShop(db, 'telegram-links')) || {};
  const link = links[tid];
  const d = link ? await ishchiMalumoti(db) : null;
  const ishchi = link ? ishchiTekshir(link, d.ishchilar) : null;

  if (!ishchi) {
    // Ulanmagan (yoki raqami kartochkadan olib tashlangan) — telefon so'raymiz.
    // XAVFSIZLIK: raqam FAQAT "📱 Telefonni ulashish" tugmasi orqali qabul qilinadi
    // (Telegram raqam aynan shu akkauntники ekanini tasdiqlaydi). Qo'lda yozilgan
    // raqam QABUL QILINMAYDI — boshqa odamning raqamini yozib ulanib bo'lmasin.
    const phoneLike = text.replace(/\D/g, '').length >= 7;
    let matn;
    if (bolim === 'start') {
      matn = "Salom! 👋 <b>Nazorat boti</b>ga xush kelibsiz.\n\n"
        + "Bu yerda o'z davomatingiz, avans va maoshingizni ko'rasiz.\n"
        + "Davom etish uchun telefon raqamingizni ulashing 👇";
    } else if (link) {
      matn = "🔒 Raqamingiz ishchi kartochkasida topilmadi — ulanish yangilanishi kerak.\n"
        + "Pastdagi <b>«📱 Telefonni ulashish»</b> tugmasini bosing 👇";
    } else if (phoneLike) {
      matn = "🔒 Xavfsizlik uchun raqamni QO'LDA yozib bo'lmaydi.\n"
        + "Pastdagi <b>«📱 Telefonni ulashish»</b> tugmasini bosing — Telegram raqamingizni o'zi tasdiqlaydi 👇";
    } else {
      matn = "Davom etish uchun pastdagi <b>«📱 Telefonni ulashish»</b> tugmasini bosing 👇";
    }
    await sendMessage(chatId, matn, { reply_markup: TELEFON_TUGMA });
    return;
  }

  if (bolim === 'start' || bolim === 'menyu' || !bolim) {
    await sendMessage(chatId, bolim ? menyuMatni(ishchi.name) : 'Pastdagi tugmalardan birini tanlang 👇',
      { reply_markup: MENYU });
    return;
  }
  const { text: javob, reply_markup } = bolimMatni(bolim, ishchi, d);
  await sendMessage(chatId, javob, { reply_markup });
}

// ---------------- Tugmalar ----------------
async function onCallback(db, cq) {
  if (String(cq.data || '').startsWith('ib|')) { await ishchiTugma(db, cq); return; }

  const data = parseCb(cq.data);
  if (!data) { await answerCallbackQuery(cq.id); return; }

  // Ruxsat: menejerlar guruhidan yoki menejer roli bo'lgan foydalanuvchidan
  const settings = (await readShop(db, 'telegram-settings')) || {};
  const links = (await readShop(db, 'telegram-links')) || {};
  const fromLink = links[String(cq.from.id)];
  const inGroup = settings.managersChatId
    && String(cq.message?.chat?.id) === String(settings.managersChatId);
  const isManager = fromLink && MANAGER_ROLES.includes(fromLink.role);
  if (!inGroup && !isManager) {
    await answerCallbackQuery(cq.id, "Faqat menejerlar tuzata oladi.");
    return;
  }

  const { date, ishchiId, code } = data;
  const ishchilar = (await readShop(db, 'ishchilar')) || [];
  const ishchi = ishchilar.find((i) => i.id === ishchiId);
  const nom = ishchi ? ishchi.name : ishchiId;
  const kim = (fromLink && fromLink.name) || (cq.from.first_name || 'menejer');

  let caption;
  if (code === 'notme') {
    // yo'qlamani bekor qilamiz + noto'g'ri kamera-bog'lanishni tozalaymiz
    await mergeShop(db, 'yoqlama', { [date]: { [ishchiId]: FieldValue.delete() } });
    const log = (await readShop(db, 'arrival-log')) || {};
    const pid = log[date] && log[date][ishchiId] && log[date][ishchiId].person_id;
    if (pid != null) await mergeShop(db, 'camera-links', { [String(pid)]: FieldValue.delete() });
    await mergeShop(db, 'arrival-log', { [date]: { [ishchiId]: { lastStatus: 'bekor' } } });
    caption = `🚫 <b>Bekor qilindi</b> — bu <s>${nom}</s> emas ekan.\n`
      + `<i>Kamera bog'lanishi tozalandi (${kim}, ${vaqtTashkent()})</i>`;
  } else if (HOLAT_LABEL[code]) {
    await mergeShop(db, 'yoqlama', { [date]: { [ishchiId]: code } });
    await mergeShop(db, 'arrival-log', { [date]: { [ishchiId]: { lastStatus: code } } });
    caption = `✏️ <b>${nom}</b> → ${HOLAT_LABEL[code]}\n`
      + `<i>Tuzatildi (${kim}, ${vaqtTashkent()})</i>`;
  } else {
    await answerCallbackQuery(cq.id);
    return;
  }

  // Xabarni tahrirlaymiz (foto bo'lsa caption, matn bo'lsa text)
  const chat = cq.message?.chat?.id;
  const mid = cq.message?.message_id;
  if (chat && mid) {
    const isPhoto = !!(cq.message.photo && cq.message.photo.length);
    if (isPhoto) await editMessageCaption(chat, mid, caption);
    else await editMessageText(chat, mid, caption);
  }
  await answerCallbackQuery(cq.id, 'Saqlandi ✅');
  // Ishchining o'ziga ham xabar (tuzatish / bekor)
  try { await yoqlamaXabarlari(db, date, [ishchiId]); } catch (e) { console.error('ishchi xabari:', e); }
}

// Ishchi menyusidagi ◀ ▶ oy tugmalari: "ib|<d|a|m>|<YYYY-MM>"
async function ishchiTugma(db, cq) {
  const [, k, oy] = String(cq.data).split('|');
  const bolim = { d: 'davomat', a: 'avans', m: 'maosh' }[k];
  const chat = cq.message && cq.message.chat;
  if (!bolim || !chat || chat.type !== 'private') { await answerCallbackQuery(cq.id); return; }
  const links = (await readShop(db, 'telegram-links')) || {};
  const d = await ishchiMalumoti(db);
  const ishchi = ishchiTekshir(links[String(cq.from.id)], d.ishchilar);
  if (!ishchi) { await answerCallbackQuery(cq.id, 'Avval telefon raqamingizni ulang (/start)'); return; }
  const { text, reply_markup } = bolimMatni(bolim, ishchi, d, oy);
  await editMessageText(chat.id, cq.message.message_id, text, reply_markup ? { reply_markup } : {});
  await answerCallbackQuery(cq.id);
}

// ---------------- /yoqlama hisobot ----------------
async function yoqlamaHisobot(db, chatId) {
  const date = bugunTashkent();
  const ishchilar = (await readShop(db, 'ishchilar')) || [];
  const yoq = (await readShop(db, 'yoqlama')) || {};
  const kun = yoq[date] || {};
  if (!ishchilar.length) { await sendMessage(chatId, 'Ishchilar ro\'yxati bo\'sh.'); return; }

  const keldi = [], yarim = [], kelmadi = [], belgilanmagan = [];
  for (const i of ishchilar) {
    const st = kun[i.id];
    if (st === 'keldi') keldi.push(i.name);
    else if (st === 'yarim') yarim.push(i.name);
    else if (st === 'kelmadi') kelmadi.push(i.name);
    else belgilanmagan.push(i.name);
  }
  const blok = (emoji, nom, arr) => arr.length
    ? `\n${emoji} <b>${nom}</b> (${arr.length}):\n` + arr.map((n) => ` • ${esc(n)}`).join('\n')
    : '';
  const text = `📋 <b>Bugungi yo'qlama</b> — ${date}\n`
    + `🕐 ${vaqtTashkent()}\n`
    + blok('✅', 'Keldi', keldi)
    + blok('½', 'Yarim kun', yarim)
    + blok('❌', 'Kelmadi', kelmadi)
    + blok('▫️', 'Belgilanmagan', belgilanmagan);
  await sendMessage(chatId, text);
}
