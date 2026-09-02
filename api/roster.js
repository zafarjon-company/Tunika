// ============================================================
//  GET /api/roster — KAMERA uchun ishchilar ro'yxati (sinx)
// ------------------------------------------------------------
//  Header: X-Arrival-Secret. Kamera buni davriy o'qib, o'z bazasini
//  Tunika bilan moslaydi (qo'shish/o'chirish/nom). Faqat kerakli
//  maydonlar: id, name, phones.
// ============================================================
import crypto from 'crypto';
import { getDb, readShop } from './_firebase.js';
import { bugunTashkent } from './_attendance.js';

// Ishchi berilgan sanada faolmi? (src/lib/helpers.js dagi ishchiFaolmi bilan
// bir xil qoida — api/ Node muhitida bo'lgani uchun lokal nusxa;
// maydonlari yo'q eski ishchilar doim faol)
const faol = (i, sana) => !(i.ishdanKetgan && i.ishdanKetgan < sana)
  && !(i.ishgaKirgan && i.ishgaKirgan > sana);

function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch { return false; }
}

export default async function handler(req, res) {
  if (!safeEqual(req.headers['x-arrival-secret'], process.env.ARRIVAL_SECRET)) {
    return res.status(401).json({ ok: false });
  }
  try {
    const db = await getDb();
    const ishchilar = (await readShop(db, 'ishchilar')) || [];
    const bugun = bugunTashkent();
    // Ishdan ketganlar (yoki hali ishga kirmaganlar) kameraga yuborilmaydi
    const roster = ishchilar
      .filter((i) => i && i.id && i.name && faol(i, bugun))
      .map((i) => ({ id: i.id, name: i.name, phones: i.phones || [] }));
    return res.status(200).json({ ok: true, roster });
  } catch (e) {
    console.error('roster error:', e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
