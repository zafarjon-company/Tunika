// ============================================================
//  TELEGRAM BOT API yordamchilari (server tomoni)
//  Token: avval Vercel env BOT_TOKEN; u yo'q bo'lsa — Firestore
//  'telegram-bot-token' (ilovadagi Sozlamalar → Telegram bot tokeni).
//  Shu tufayli ilovaga ulangan BITTA bot ham ishchilar boti bo'lib
//  ishlay oladi. Token brauzerga chiqmaydi (bu yerda faqat serverda).
//  Node 18+ global fetch / FormData / Blob ishlatiladi.
// ============================================================

let TOKEN = process.env.BOT_TOKEN || '';
let tokenManbasi = TOKEN ? 'env' : '';
let tokenVaqt = 0; // Firestore'dan o'qilgan payt (kesh)
const TOKEN_KESH_MS = 5 * 60 * 1000;

// Tokenni tayyorlaydi: env bo'lsa — o'sha; aks holda Firestore'dan (5 daqiqa kesh).
// db — getDb() natijasi; readShop chaqiruvchidan beriladi (aylana importdan qochish).
export async function tokenYukla(db, readShop) {
  if (process.env.BOT_TOKEN) {
    TOKEN = process.env.BOT_TOKEN; tokenManbasi = 'env';
    return TOKEN;
  }
  if (TOKEN && Date.now() - tokenVaqt < TOKEN_KESH_MS) return TOKEN;
  try {
    const v = await readShop(db, 'telegram-bot-token');
    const t = typeof v === 'string' ? v.trim() : '';
    TOKEN = t; tokenManbasi = t ? 'baza' : ''; tokenVaqt = Date.now();
  } catch (e) {
    console.error('bot token o\'qilmadi:', e);
  }
  return TOKEN;
}

export function tokenBormi() { return !!TOKEN; }
export function tokenManba() { return tokenManbasi; }

// Webhook maxfiy so'zi — FAQAT env TG_WEBHOOK_SECRET. Tokendan hosil qilinmaydi:
// Firestore'dagi 'telegram-bot-token'ni ilovaning har bir mijozi o'qiy oladi,
// undan hosil qilingan so'z ham maxfiy bo'lmay qolardi. Env yo'q bo'lsa webhook
// fail-closed (401) va «Botni ulash» xato qaytaradi.
export function webhookSecret() {
  return process.env.TG_WEBHOOK_SECRET || '';
}
export function secretBormi() { return !!process.env.TG_WEBHOOK_SECRET; }

const api = (method) => `https://api.telegram.org/bot${TOKEN}/${method}`;
const kut = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, body) {
  if (!TOKEN) return { ok: false, description: 'token yo\'q' };
  // 429 (Too Many Requests): retry_after qisqa bo'lsa (Vercel 10 s chegarasiga sig'sin)
  // kutib BIR marta qayta urinamiz; uzun bo'lsa — chaqiruvchi "vaqtinchalik xato" deb biladi.
  for (let urinish = 0; urinish < 2; urinish += 1) {
    let j;
    try {
      const r = await fetch(api(method), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      j = await r.json().catch(() => ({ ok: false, error_code: r.status }));
    } catch (e) {
      return { ok: false, description: String(e) };
    }
    const sek = Number(j && j.parameters && j.parameters.retry_after) || 0;
    if (j && !j.ok && j.error_code === 429 && urinish === 0 && sek > 0 && sek <= 3) {
      await kut(sek * 1000 + 200);
      continue;
    }
    return j;
  }
  return { ok: false, error_code: 429 };
}

// Yuborish natijasi: 'ok' | 'doimiy' (403 — ishchi botni bloklagan; 400 — chat yo'q,
// matn juda uzun, HTML xato: qayta urinish baribir foydasiz) | 'vaqtinchalik'
// (429, 5xx, tarmoq, 401/404 token muammosi — keyin qayta urinish kerak)
export function natijaTuri(r) {
  if (r && r.ok) return 'ok';
  const kod = r && r.error_code;
  if (kod === 403 || kod === 400) return 'doimiy';
  return 'vaqtinchalik';
}

// Botning @username'i (getMe, modul darajasida kesh) — guruhda "/buyruq@bot" bizga
// atalganini bilish uchun
let _username = null;
export async function botUsername() {
  if (_username) return _username;
  const r = await call('getMe', {});
  if (r && r.ok && r.result && r.result.username) _username = String(r.result.username);
  return _username || '';
}

export function sendMessage(chatId, text, extra = {}) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

export async function sendPhoto(chatId, photoBuffer, caption, extra = {}) {
  if (!TOKEN) return { ok: false, description: 'token yo\'q' };
  try {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    if (caption) fd.append('caption', caption);
    fd.append('parse_mode', 'HTML');
    if (extra.reply_markup) fd.append('reply_markup', JSON.stringify(extra.reply_markup));
    fd.append('photo', new Blob([photoBuffer], { type: 'image/jpeg' }), 'photo.jpg');
    const r = await fetch(api('sendPhoto'), { method: 'POST', body: fd });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

export function editMessageCaption(chatId, messageId, caption, extra = {}) {
  return call('editMessageCaption', {
    chat_id: chatId, message_id: messageId, caption, parse_mode: 'HTML', ...extra,
  });
}

export function editMessageText(chatId, messageId, text, extra = {}) {
  return call('editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra,
  });
}

export function answerCallbackQuery(id, text = '') {
  return call('answerCallbackQuery', { callback_query_id: id, text });
}

// ---- Bot holati va webhook (api/ishchi-bot.js ishlatadi) ----
export function getMe() { return call('getMe', {}); }
export function getWebhookInfo() { return call('getWebhookInfo', {}); }
// tashla — Telegram navbatidagi (24 soatgacha) eski update'larni tashlash: birinchi
// ulashda kecha bosilgan eski tugmalar qayta bajarilib yo'qlamani buzmasin.
export function setWebhook(url, { tashla = false } = {}) {
  return call('setWebhook', {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ['message', 'callback_query'],
    ...(tashla ? { drop_pending_updates: true } : {}),
  });
}
export function setMyCommands(commands, scope) {
  return call('setMyCommands', { commands, ...(scope ? { scope } : {}) });
}
// Foydalanuvchi guruh a'zosimi (menejerlar guruhi — /yoqlama ruxsati uchun)
export function getChatMember(chatId, userId) {
  return call('getChatMember', { chat_id: chatId, user_id: userId });
}

// Foto bo'lsa rasm bilan, bo'lmasa matn bilan yuboradi (xatoga chidamli).
export async function sendPhotoOrText(chatId, photoBase64, caption, replyMarkup) {
  if (photoBase64) {
    try {
      const buf = Buffer.from(photoBase64, 'base64');
      const r = await sendPhoto(chatId, buf, caption, { reply_markup: replyMarkup });
      if (r && r.ok) return r;
    } catch (e) { /* matnga tushamiz */ }
  }
  return sendMessage(chatId, caption, replyMarkup ? { reply_markup: replyMarkup } : {});
}
