// ============================================================
//  POST /api/telegram — Telegram webhook (Nazorat bot)
// ------------------------------------------------------------
//  Header: X-Telegram-Bot-Api-Secret-Token (TG_WEBHOOK_SECRET)
//  - message.contact  → telefon orqali ishchiga bog'lash (faqat o'zinikini)
//  - /start           → salom + telefon ulash tugmasi
//  - /yoqlama         → bugungi davomat (qisqa hisobot)
//  - callback_query   → tuzatish tugmalari (Keldi/Yarim/Kelmadi/Bu u emas)
//  Doim 200 qaytaradi.
// ============================================================
import { getDb, readShop, mergeShop, FieldValue } from './_firebase.js';
import { sendMessage, answerCallbackQuery, editMessageCaption, editMessageText } from './_tg.js';
import { findIshchiByPhone, normPhone } from './_match.js';
import { parseCb, HOLAT_LABEL } from './_cb.js';
import { bugunTashkent, vaqtTashkent } from './_attendance.js';

const MANAGER_ROLES = ['founder', 'admin', 'boshliq', 'boshqaruvchi', 'buxgalter'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });
  if (process.env.TG_WEBHOOK_SECRET
      && req.headers['x-telegram-bot-api-secret-token'] !== process.env.TG_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }
  const update = req.body || {};
  try {
    if (update.message) await onMessage(update.message);
    else if (update.callback_query) await onCallback(update.callback_query);
  } catch (e) {
    console.error('telegram webhook error:', e);
  }
  return res.status(200).json({ ok: true });
}

// ---------------- Xabarlar ----------------
async function onMessage(msg) {
  const db = await getDb();
  const chatId = msg.chat.id;

  // --- Telefon ulash (faqat O'ZINIKINI) ---
  if (msg.contact) {
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
    const tid = String(msg.from.id);
    await mergeShop(db, 'telegram-links', {
      [tid]: {
        ishchiId: m.id, role: 'ishchi', phone: normPhone(msg.contact.phone_number),
        name: m.name, linkedAt: new Date().toISOString(),
      },
    });
    await sendMessage(chatId,
      `✅ <b>${m.name}</b>, akkauntingiz ulandi!\n`
      + `Endi ishga kelganingizda sizga shaxsiy xabar keladi. 🌅`,
      { reply_markup: { remove_keyboard: true } });
    return;
  }

  const text = (msg.text || '').trim();

  // Guruh/chat ID ni topish uchun (Sozlamalarga kiritish uchun)
  if (text === '/id' || text.startsWith('/id')) {
    await sendMessage(chatId,
      `🆔 Bu chat ID:\n<code>${chatId}</code>\n\n`
      + `<i>Menejerlar guruhi bo'lsa — shu ID ni Tunika → Sozlamalar → Nazorat boti'ga kiriting.</i>`);
    return;
  }

  if (text === '/start' || text.startsWith('/start')) {
    const tid = String(msg.from.id);
    const links = (await readShop(db, 'telegram-links')) || {};
    if (links[tid]) {
      await sendMessage(chatId,
        `Salom, <b>${links[tid].name}</b>! 👋\nSiz allaqachon ulangansiz.\n\n`
        + `📋 /yoqlama — bugungi davomat`);
    } else {
      await sendMessage(chatId,
        `Salom! 👋 <b>Nazorat boti</b>ga xush kelibsiz.\n\n`
        + `Davom etish uchun telefon raqamingizni ulashing 👇`,
        {
          reply_markup: {
            keyboard: [[{ text: '📱 Telefonni ulashish', request_contact: true }]],
            resize_keyboard: true, one_time_keyboard: true,
          },
        });
    }
    return;
  }

  if (text === '/yoqlama') {
    await yoqlamaHisobot(db, chatId);
    return;
  }
}

// ---------------- Tuzatish tugmalari ----------------
async function onCallback(cq) {
  const db = await getDb();
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
    ? `\n${emoji} <b>${nom}</b> (${arr.length}):\n` + arr.map((n) => ` • ${n}`).join('\n')
    : '';
  const text = `📋 <b>Bugungi yo'qlama</b> — ${date}\n`
    + `🕐 ${vaqtTashkent()}\n`
    + blok('✅', 'Keldi', keldi)
    + blok('½', 'Yarim kun', yarim)
    + blok('❌', 'Kelmadi', kelmadi)
    + blok('▫️', 'Belgilanmagan', belgilanmagan);
  await sendMessage(chatId, text);
}
