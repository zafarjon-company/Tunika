// ============================================================
//  TELEGRAM BOT API yordamchilari (server tomoni)
//  Token Vercel env-da: BOT_TOKEN (brauzerga chiqmaydi).
//  Node 18+ global fetch / FormData / Blob ishlatiladi.
// ============================================================
const api = (method) => `https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`;

async function call(method, body) {
  try {
    const r = await fetch(api(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json().catch(() => ({ ok: false }));
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

export function sendMessage(chatId, text, extra = {}) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

export async function sendPhoto(chatId, photoBuffer, caption, extra = {}) {
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
