// ============================================================
//  POST /api/login — login/parolni SERVERDA tekshirish
// ------------------------------------------------------------
//  Body: { login, parol }
//  Muvaffaqiyat: { ok:true, token, user:{id,login,role} }
//    token — Firebase CUSTOM TOKEN (claims: rol, login);
//    klient signInWithCustomToken bilan kiradi.
//  Admin rejim yo'q bo'lsa (service account env o'rnatilmagan):
//    { ok:false, error:'sozlanmagan' } — klient ESKI usulga tushadi
//    (o'tish davri; biznes to'xtamaydi).
//  LAZY MIGRATION: eski ochiq-matn paroli mos kelsa, o'sha zahoti
//    scrypt hashga ko'chiriladi va ochiq parol o'chiriladi.
//  BRUTE-FORCE himoya: shop/'login-urinishlar' — bitta loginga
//    6 ta muvaffaqiyatsiz urinishdan keyin 10 daqiqa kutish.
//  Parol/hash/token (login tokenidan tashqari) hech qachon
//  javobga chiqmaydi.
// ============================================================
import { getDb, readShop, mergeShop, adminBormi, mintCustomToken } from './_firebase.js';
import { parolHash, parolTekshir, satrTeng } from './_parol.js';

const URINISH_LIMIT = 6;                 // nechta xato urinishdan keyin bloklanadi
const URINISH_OYNA_MS = 10 * 60 * 1000;  // blok muddati: 10 daqiqa
const LOGIN_MAX = 64;                    // uzun login — hujjatni shishirish hujumi oldini oladi
const PAROL_MAX = 200;                   // uzun parol — scrypt'ni band qilish (DoS) oldini oladi

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'faqat POST' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    const body = req.body || {};
    const login = body.login;
    const parol = body.parol;
    if (typeof login !== 'string' || !login.trim()
        || typeof parol !== 'string' || !parol
        || login.length > LOGIN_MAX || parol.length > PAROL_MAX) {
      return res.status(400).json({ ok: false, error: 'malumot' });
    }

    // O'tish davri: service account qo'yilmagan — klient eski yo'lga tushsin
    if (!adminBormi()) {
      return res.status(200).json({ ok: false, error: 'sozlanmagan' });
    }

    const db = await getDb();
    const loginKichik = login.trim().toLowerCase();

    // --- Brute-force himoya: avval blokni tekshiramiz (parolni tekshirmasdan) ---
    // hasOwnProperty — '__proto__' kabi login prototipdan qiymat olib kelmasin
    const urinishlar = (await readShop(db, 'login-urinishlar')) || {};
    const katak = (Object.prototype.hasOwnProperty.call(urinishlar, loginKichik)
      && urinishlar[loginKichik]) || { soni: 0, oxirgi: 0 };
    if (katak.soni >= URINISH_LIMIT && Date.now() - katak.oxirgi < URINISH_OYNA_MS) {
      return res.status(429).json({ ok: false, error: 'kuting' });
    }

    const users = (await readShop(db, 'users')) || [];
    const user = (Array.isArray(users) ? users : []).find(
      (u) => u && String(u.login || '').trim().toLowerCase() === loginKichik
    );

    // --- Parolni tekshirish ---
    let mos = false;
    let migratsiya = false; // eski ochiq parol hashga ko'chirilsinmi
    if (user) {
      if (user.parolHash) {
        mos = parolTekshir(parol, user.parolHash);
      } else if (typeof user.parol === 'string' && user.parol) {
        // Eski ochiq-matn parol (migratsiyadan oldingi hisob) — timing-safe
        mos = satrTeng(user.parol, parol);
        if (mos) migratsiya = true;
      }
    }

    if (!mos) {
      // Muvaffaqiyatsiz urinish +1. Login topilmadimi yoki parol xatomi —
      // AYTMAYMIZ (hisoblarni sanab chiqishga yo'l qo'ymaslik uchun).
      await mergeShop(db, 'login-urinishlar', {
        [loginKichik]: { soni: (katak.soni || 0) + 1, oxirgi: Date.now() },
      });
      return res.status(401).json({ ok: false, error: 'login' });
    }

    // --- LAZY MIGRATION: ochiq parolni scrypt hashga almashtiramiz ---
    if (migratsiya) {
      const yangiUsers = users.map((u) => {
        if (!u || u.id !== user.id) return u;
        const { parol: _eski, ...qolgan } = u;
        return { ...qolgan, parolHash: parolHash(parol) };
      });
      await mergeShop(db, 'users', yangiUsers); // butun massiv qayta saqlanadi (admin orqali)
    }

    // Muvaffaqiyat: urinishlar katagi 0 lanadi
    if (katak.soni) {
      await mergeShop(db, 'login-urinishlar', {
        [loginKichik]: { soni: 0, oxirgi: Date.now() },
      });
    }

    const token = await mintCustomToken(user.id, { rol: user.role, login: user.login });
    return res.status(200).json({
      ok: true,
      token,
      user: { id: user.id, login: user.login, role: user.role },
    });
  } catch (e) {
    console.error('login error:', e); // tafsilot faqat serverda qoladi
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
