// ============================================================
//  TELEGRAM BOT — DXF fayllarni botga yuborish (sendDocument)
//  ------------------------------------------------------------
//  Sozlamalar (Firestore): 'telegram-bot-token' + 'telegram-chat-id'.
//  Brauzerdan to'g'ridan-to'g'ri Telegram Bot API'ga FormData bilan POST
//  (api.telegram.org CORS'ga ruxsat beradi). Token maxfiy — faqat ichki dastur.
// ============================================================

export function telegramSozlangan(tg) {
  return !!(tg && tg.token && tg.chatId);
}

// files = [{ name, text, caption? }]  — har biri alohida hujjat sifatida yuboriladi.
// onProgress(done, total) — ixtiyoriy. Xato bo'lsa throw qiladi.
export async function sendDxfFilesToTelegram(tg, files, onProgress) {
  if (!telegramSozlangan(tg)) {
    throw new Error('Telegram bot sozlanmagan (Sozlamalar > Telegram: token va chat ID)');
  }
  const base = 'https://api.telegram.org/bot' + tg.token;
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fd = new FormData();
    fd.append('chat_id', String(tg.chatId));
    if (f.caption) fd.append('caption', f.caption);
    fd.append('document', new Blob([f.text], { type: 'application/dxf' }), f.name);
    let r, j;
    try {
      r = await fetch(base + '/sendDocument', { method: 'POST', body: fd });
      j = await r.json().catch(() => ({}));
    } catch (e) {
      throw new Error('Tarmoq xatosi: ' + (e && e.message ? e.message : e));
    }
    if (!r.ok || !j.ok) {
      throw new Error('Telegram: ' + (j.description || ('xato ' + r.status)) + ' (' + f.name + ')');
    }
    results.push(j);
    if (onProgress) onProgress(i + 1, files.length);
  }
  return results;
}

// Ixtiyoriy: oddiy matnli xabar (sarlavha/izoh uchun)
export async function sendTelegramMessage(tg, text) {
  if (!telegramSozlangan(tg)) throw new Error('Telegram bot sozlanmagan');
  const r = await fetch('https://api.telegram.org/bot' + tg.token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(tg.chatId), text }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error('Telegram: ' + (j.description || ('xato ' + r.status)));
  return j;
}
