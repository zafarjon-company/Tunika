// ============================================================
//  POST /api/arrival — KAMERADAN kelish hodisasi qabul qilgich
// ------------------------------------------------------------
//  Header: X-Arrival-Secret  (ARRIVAL_SECRET bilan solishtiriladi)
//  Body:   { kind:"checkin"|"unknown", person_id, name, cam, score,
//            timestamp, photo_base64 }
//  Vazifa: ishchini aniqlash → yo'qlamaga "keldi" (avto) → ishchiga
//          DM "xush kelibsiz" → menejerlar guruhiga foto + tuzatish
//          tugmalari. Begona yuz → guruhga ogohlantirish.
//  Doim 200 qaytaradi (kamera "fire-and-forget").
// ============================================================
import crypto from 'crypto';
import { getDb, readShop, mergeShop, FieldValue } from './_firebase.js';
import { sendMessage, sendPhotoOrText } from './_tg.js';
import { findIshchiByName } from './_match.js';
import { markArrival, bugunTashkent, vaqtTashkent } from './_attendance.js';
import { correctionKeyboard } from './_cb.js';

function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!safeEqual(req.headers['x-arrival-secret'], process.env.ARRIVAL_SECRET)) {
    return res.status(401).json({ ok: false, error: 'secret' });
  }

  const body = req.body || {};
  const { person_id, name, cam, score, photo_base64, kind = 'checkin' } = body;

  try {
    const db = await getDb();
    const settings = (await readShop(db, 'telegram-settings')) || {};
    const managersChatId = settings.managersChatId || null;

    // --- BEGONA YUZ ---
    if (kind === 'unknown') {
      if (managersChatId && settings.unknownAlerts !== false) {
        const cap = `⚠️ <b>Notanish odam</b>\n📷 ${cam || '—'} · 🕐 ${vaqtTashkent()}\n<i>Ro'yxatda yo'q yuz aniqlandi</i>`;
        await sendPhotoOrText(managersChatId, photo_base64, cap);
      }
      return res.status(200).json({ ok: true, kind: 'unknown' });
    }

    // --- ISHCHINI ANIQLASH (person_id → camera-links → ism mosligi) ---
    const cameraLinks = (await readShop(db, 'camera-links')) || {};
    const ishchilar = (await readShop(db, 'ishchilar')) || [];
    const pidKey = String(person_id);

    let ishchiId = cameraLinks[pidKey] ? cameraLinks[pidKey].ishchiId : null;
    let ishchi = ishchiId ? ishchilar.find((i) => i.id === ishchiId) : null;

    if (!ishchi) {
      const m = findIshchiByName(ishchilar, name);
      if (m) {
        ishchi = m;
        ishchiId = m.id;
        await mergeShop(db, 'camera-links', {
          [pidKey]: { ishchiId, label: name || '', linkedAt: new Date().toISOString(), linkedBy: 'auto' },
        });
        await mergeShop(db, 'camera-unlinked', { [pidKey]: FieldValue.delete() });
      }
    }

    const date = bugunTashkent();

    // --- MOS KELMADI: "bu kim?" ogohlantirishi + bog'lash ro'yxatiga yozish ---
    if (!ishchiId) {
      await mergeShop(db, 'camera-unlinked', {
        [pidKey]: { name: name || '', cam: cam || '', lastSeen: new Date().toISOString() },
      });
      if (managersChatId) {
        const cap = `❓ <b>Tanildi, lekin ishchi topilmadi</b>\n`
          + `👤 Kameradagi nom: <b>${name || '—'}</b>\n`
          + `📷 ${cam || '—'} · 🕐 ${vaqtTashkent()}\n\n`
          + `<i>Sozlamalar → Kamera bog'lash bo'limidan ushbu odamni ishchiga bog'lang.</i>`;
        await sendPhotoOrText(managersChatId, photo_base64, cap);
      }
      return res.status(200).json({ ok: true, matched: false });
    }

    // --- YO'QLAMA + DEDUP ---
    const { firstTime } = await markArrival(db, { date, ishchiId, personId: person_id, score });
    if (!firstTime) return res.status(200).json({ ok: true, duplicate: true });

    // --- ISHCHIGA "XUSH KELIBSIZ" DM ---
    const tgLinks = (await readShop(db, 'telegram-links')) || {};
    const workerTg = Object.keys(tgLinks).find((tid) => tgLinks[tid].ishchiId === ishchiId);
    if (workerTg) {
      const tmpl = settings.welcomeText || 'Ishga xush kelibsiz, charchamang! 💪';
      const text = `🌅 <b>${ishchi.name}</b>\n${tmpl.replace('{ism}', ishchi.name || '')}`;
      await sendMessage(workerTg, text);
    }

    // --- MENEJERLAR GURUHIGA: foto + tuzatish tugmalari ---
    if (managersChatId) {
      const cap = `✅ <b>${ishchi.name}</b> ishga keldi\n`
        + `🕐 ${vaqtTashkent()} · 📷 ${cam || '—'}\n`
        + `<i>Yo'qlamaga avtomatik yozildi. Noto'g'ri bo'lsa tuzating 👇</i>`;
      const sent = await sendPhotoOrText(managersChatId, photo_base64, cap, correctionKeyboard(date, ishchiId));
      if (sent && sent.ok && sent.result) {
        await mergeShop(db, 'arrival-log', {
          [date]: { [ishchiId]: { managerMsg: { chatId: managersChatId, messageId: sent.result.message_id } } },
        });
      }
    }

    return res.status(200).json({ ok: true, matched: true, ishchiId });
  } catch (e) {
    console.error('arrival error:', e);
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
