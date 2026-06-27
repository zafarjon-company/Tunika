// ============================================================
//  TELEGRAM BOT — Kazirok DXF fayllarni ALBOM bo'lib yuborish
//  ------------------------------------------------------------
//  Sozlamalar (Firestore): 'telegram-bot-token' + 'telegram-dxf-chats'
//  (eski 'telegram-chat-id' ham qo'llab-quvvatlanadi — zaxira manzil).
//  Brauzerdan to'g'ridan-to'g'ri Telegram Bot API'ga FormData bilan POST
//  (api.telegram.org CORS'ga ruxsat beradi). Token maxfiy — faqat ichki dastur.
//
//  Bitta zakas uchun: narxsiz chek RASMI (hujjat sifatida — qisqartirilmaydi)
//  + barcha DXF fayllar BITTA media-albom bo'lib, har bir sozlangan manzilga
//  (guruh / kanal / shaxsiy) yuboriladi. Albom 1024 belgigacha izoh oladi.
// ============================================================

const MAX_ITEMS = 10;   // Telegram media-albomga ko'pi bilan 10 ta element

// Sozlangan manzillarni yagona ro'yxatga keltiradi: [{ chatId, nom }]
// Yangi ko'p manzilli model (tg.chats) + eski yagona tg.chatId (zaxira) birga.
export function tgChatList(tg) {
  if (!tg) return [];
  const out = [];
  const seen = new Set();
  const push = (chatId, nom) => {
    const id = String(chatId == null ? '' : chatId).trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ chatId: id, nom: (nom || '').trim() });
  };
  (Array.isArray(tg.chats) ? tg.chats : []).forEach((c) => c && push(c.chatId, c.nom));
  if (tg.chatId) push(tg.chatId, 'Asosiy');
  return out;
}

// Token va kamida bitta manzil bormi?
export function telegramSozlangan(tg) {
  return !!(tg && tg.token && tgChatList(tg).length);
}

function dxfBlob(text) { return new Blob([text], { type: 'application/dxf' }); }

// Bitta albom (yoki bitta hujjat) ni bitta chatga yuboradi.
// items = [{ field, blob, filename, caption? }]
// Qaytaradi { r, j } (HTTP javob + JSON) — xatoni chaqiruvchi hal qiladi (migratsiya/flood).
async function postAlbum(base, chatId, items) {
  // Bitta element — albom emas, oddiy hujjat (media-albom 2..10 element talab qiladi)
  if (items.length === 1) {
    const it = items[0];
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    if (it.caption) fd.append('caption', it.caption);
    fd.append('document', it.blob, it.filename);
    const r = await fetch(base + '/sendDocument', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    return { r, j };
  }
  const media = items.map((it) => {
    const m = { type: 'document', media: 'attach://' + it.field };
    if (it.caption) m.caption = it.caption;
    return m;
  });
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('media', JSON.stringify(media));
  items.forEach((it) => fd.append(it.field, it.blob, it.filename));
  const r = await fetch(base + '/sendMediaGroup', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  return { r, j };
}

// Narxsiz chek rasmi (ixtiyoriy) + DXF fayllarni ALBOM bo'lib har manzilga yuboradi.
//   opts = { imageBlob?, imageName?, files:[{name,text}], caption?, onChatMigrated?, onProgress? }
//   onChatMigrated(oldId, newId) — guruh superguruhga aylansa, yangi ID ni saqlash uchun.
//   Qaytaradi { sent:[nom...], errors:[matn...], migrations:[{oldId,newId}] }.
//   Hech qaysi manzilga yuborilmasa — throw qiladi.
export async function sendDxfAlbumToTelegram(tg, opts = {}) {
  if (!telegramSozlangan(tg)) {
    throw new Error('Telegram bot sozlanmagan (Sozlamalar > Telegram: token va manzil)');
  }
  const { imageBlob, imageName = 'chek.png', files = [], caption = '', onChatMigrated, onProgress } = opts;
  const base = 'https://api.telegram.org/bot' + tg.token;

  // Tartibli element ro'yxati: AVVAL chek rasmi (hujjat), keyin DXF fayllar.
  const all = [];
  if (imageBlob) all.push({ blob: imageBlob, filename: imageName });
  files.forEach((f) => all.push({ blob: dxfBlob(f.text), filename: f.name }));
  if (!all.length) throw new Error('Yuboriladigan fayl yo\'q');

  // 10 talik albomlarga bo'lamiz; izoh faqat eng birinchi elementda.
  const chunks = [];
  for (let i = 0; i < all.length; i += MAX_ITEMS) chunks.push(all.slice(i, i + MAX_ITEMS));

  const chats = tgChatList(tg);
  const sent = [];
  const errors = [];
  const migrations = [];
  let progress = 0;
  const totalUnits = chats.length * chunks.length;

  for (const chat of chats) {
    let chatId = chat.chatId;
    let chatOk = true;
    for (let ci = 0; ci < chunks.length; ci++) {
      const items = chunks[ci].map((it, idx) => ({
        field: 'm' + ci + '_' + idx, blob: it.blob, filename: it.filename,
      }));
      // Izoh — HAR albomning birinchi elementiga (ko'p albom bo'lsa qism raqami bilan)
      if (caption) items[0].caption = chunks.length > 1 ? `${caption}\n(qism ${ci + 1}/${chunks.length})` : caption;

      // Migratsiya va flood uchun ALOHIDA hisoblagich — biri ikkinchisining
      // qayta urinishini "yeb qo'ymasin" (superguruh ID doim bir marta sinaladi).
      let migrateTried = false;
      let floodTries = 0;
      while (true) {
        let res;
        try {
          res = await postAlbum(base, chatId, items);
        } catch (e) {
          errors.push((chat.nom || chatId) + ': tarmoq xatosi');
          chatOk = false; break;
        }
        const { r, j } = res;
        if (r.ok && j.ok) break;
        const p = (j && j.parameters) || {};
        // Guruh superguruhga aylangan — yangi ID bilan qayta yuboramiz va saqlaymiz
        if (p.migrate_to_chat_id && !migrateTried) {
          migrations.push({ oldId: chatId, newId: String(p.migrate_to_chat_id) });
          chatId = String(p.migrate_to_chat_id);
          migrateTried = true; continue;
        }
        // Flood limit — bir oz kutib qayta urinamiz
        if (p.retry_after && floodTries < 3) {
          await new Promise((rz) => setTimeout(rz, (Number(p.retry_after) + 1) * 1000));
          floodTries++; continue;
        }
        errors.push((chat.nom || chatId) + ': ' + (j.description || ('xato ' + r.status)));
        chatOk = false; break;
      }
      progress++;
      if (onProgress) onProgress(progress, totalUnits);
      if (!chatOk) break;
    }
    if (chatOk) sent.push(chat.nom || chatId);
  }

  // Migratsiyalarni bir marta qo'llaymiz (takrorsiz)
  if (migrations.length && typeof onChatMigrated === 'function') {
    const done = new Set();
    migrations.forEach((m) => {
      if (done.has(m.oldId)) return;
      done.add(m.oldId);
      try { onChatMigrated(m.oldId, m.newId); } catch (e) { /* noop */ }
    });
  }

  if (!sent.length) {
    throw new Error('Hech qaysi manzilga yuborilmadi — ' + (errors.join(' | ') || 'noma\'lum xato'));
  }
  return { sent, errors, migrations };
}

// Ixtiyoriy: oddiy matnli xabar (barcha sozlangan manzillarga)
export async function sendTelegramMessage(tg, text) {
  const chats = tgChatList(tg);
  if (!tg || !tg.token || !chats.length) throw new Error('Telegram bot sozlanmagan');
  const base = 'https://api.telegram.org/bot' + tg.token;
  const sent = [];
  for (const chat of chats) {
    try {
      const r = await fetch(base + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: String(chat.chatId), text }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) sent.push(chat.chatId);
    } catch (e) { /* keyingisiga o'tamiz */ }
  }
  if (!sent.length) throw new Error('Telegram: hech qaysi manzilga yuborilmadi');
  return { sent };
}
