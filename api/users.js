// ============================================================
//  POST /api/users — foydalanuvchilarni boshqarish (FAQAT founder)
// ------------------------------------------------------------
//  Header: Authorization: Bearer <idToken>  (custom-token bilan
//  kirgan klientning Firebase ID tokeni; claims.rol tekshiriladi)
//  Body: { amal, ... }
//    'yarat' { login, parol, rol: 'admin'|'ishchi' } — yangi hisob
//    'parol' { id, yangiParol }                      — parolni almashtirish
//    'ochir' { id }                                  — hisobni o'chirish
//  Har amal 'jurnal'ga yoziladi (oxirgi 500 ta).
//  Javobda parol/parolHash HECH QACHON qaytmaydi — faqat
//  {id, login, role} ro'yxati.
// ============================================================
import { randomUUID } from 'crypto';
import { getDb, readShop, mergeShop, adminBormi, verifyIdToken } from './_firebase.js';
import { parolHash } from './_parol.js';

const RUXSAT_ROLLAR = ['admin', 'ishchi']; // founder faqat bitta — yaratilmaydi
const PAROL_MIN = 6;
const PAROL_MAX = 200; // uzun parol — scrypt'ni band qilish (DoS) oldini oladi
const LOGIN_MAX = 64;

// Ro'yxatni klientga xavfsiz shaklda qaytarish (hash/parolsiz)
function tozaRoyxat(users) {
  return (Array.isArray(users) ? users : [])
    .filter(Boolean)
    .map((u) => ({ id: u.id, login: u.login, role: u.role }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'faqat POST' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    // O'tish davri: admin rejim yo'q — bu endpoint hali ishlamaydi
    if (!adminBormi()) {
      return res.status(200).json({ ok: false, error: 'sozlanmagan' });
    }

    // --- Autentifikatsiya: faqat founder ---
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'token' });
    }
    let claims;
    try {
      claims = await verifyIdToken(authHeader.slice('Bearer '.length).trim());
    } catch {
      return res.status(401).json({ ok: false, error: 'token' });
    }
    if (claims.rol !== 'founder') {
      return res.status(403).json({ ok: false, error: 'ruxsat' });
    }

    const db = await getDb();
    const users = ((await readShop(db, 'users')) || []).filter(Boolean);
    const body = req.body || {};
    const amal = body.amal;

    let yangiUsers;
    let detail; // jurnalga yoziladigan qisqa izoh

    if (amal === 'yarat') {
      const login = typeof body.login === 'string' ? body.login.trim() : '';
      const parol = typeof body.parol === 'string' ? body.parol : '';
      const rol = body.rol;
      if (!login || login.length > LOGIN_MAX || !RUXSAT_ROLLAR.includes(rol)) {
        return res.status(400).json({ ok: false, error: 'malumot' });
      }
      if (parol.length < PAROL_MIN || parol.length > PAROL_MAX) {
        return res.status(400).json({ ok: false, error: 'parol-qisqa' });
      }
      const loginKichik = login.toLowerCase();
      const band = users.some((u) => String(u.login || '').trim().toLowerCase() === loginKichik);
      if (band) return res.status(409).json({ ok: false, error: 'band' });
      yangiUsers = [...users, { id: randomUUID(), login, parolHash: parolHash(parol), role: rol }];
      detail = login;

    } else if (amal === 'parol') {
      const id = body.id;
      const yangiParol = typeof body.yangiParol === 'string' ? body.yangiParol : '';
      if (!id) return res.status(400).json({ ok: false, error: 'malumot' });
      if (yangiParol.length < PAROL_MIN || yangiParol.length > PAROL_MAX) {
        return res.status(400).json({ ok: false, error: 'parol-qisqa' });
      }
      const user = users.find((u) => u.id === id);
      if (!user) return res.status(404).json({ ok: false, error: 'topilmadi' });
      // Yangi hash yoziladi, eski ochiq parol (bo'lsa) olib tashlanadi.
      // Founder o'z parolini ham aynan shu amal bilan almashtiradi.
      yangiUsers = users.map((u) => {
        if (u.id !== id) return u;
        const { parol: _eski, ...qolgan } = u;
        return { ...qolgan, parolHash: parolHash(yangiParol) };
      });
      detail = user.login || id;

    } else if (amal === 'ochir') {
      const id = body.id;
      if (!id) return res.status(400).json({ ok: false, error: 'malumot' });
      if (id === claims.uid) {
        // Founder o'zini o'chira olmaydi — hisobsiz qolib ketmasin
        return res.status(400).json({ ok: false, error: 'ozini' });
      }
      const user = users.find((u) => u.id === id);
      if (!user) return res.status(404).json({ ok: false, error: 'topilmadi' });
      yangiUsers = users.filter((u) => u.id !== id);
      detail = user.login || id;

    } else {
      return res.status(400).json({ ok: false, error: 'amal' });
    }

    await mergeShop(db, 'users', yangiUsers);

    // --- Jurnal: kim nima qildi (oxirgi 500 ta saqlanadi) ---
    try {
      const jurnal = (await readShop(db, 'jurnal')) || [];
      const entry = {
        id: randomUUID(),
        ts: new Date().toISOString(),
        userLogin: claims.login || '—',
        role: 'founder',
        amal: 'foydalanuvchi_' + amal,
        detail,
      };
      await mergeShop(db, 'jurnal', [entry, ...(Array.isArray(jurnal) ? jurnal : [])].slice(0, 500));
    } catch (e) {
      console.error('users jurnal error:', e); // jurnal yozilmasa ham amal bekor bo'lmasin
    }

    return res.status(200).json({ ok: true, users: tozaRoyxat(yangiUsers) });
  } catch (e) {
    console.error('users error:', e); // tafsilot faqat serverda qoladi
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
