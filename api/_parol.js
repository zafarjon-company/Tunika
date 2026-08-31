// ============================================================
//  PAROL HASH yordamchilari — faqat Node 'crypto' (tashqi dep YO'Q)
// ------------------------------------------------------------
//  Format: 'scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>'
//  Salt 16 bayt tasodifiy, hash 32 bayt. Parametrlar satr ichida
//  saqlanadi — kelajakda kuchaytirsak eski hashlar ham tekshiriladi.
// ============================================================
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

const N = 16384; // CPU/xotira narxi
const R = 8;     // blok o'lchami
const P = 1;     // parallellik
const HASH_BAYT = 32;
const SALT_BAYT = 16;

// Parolni hashlash — 'scrypt$16384$8$1$<saltB64>$<hashB64>'
export function parolHash(parol) {
  const salt = randomBytes(SALT_BAYT);
  const hash = scryptSync(String(parol), salt, HASH_BAYT, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Ikki satrni TIMING-SAFE solishtirish (uzunlik farqi ham sizib chiqmasin
// deb avval sha256 orqali tenglashtiramiz). Eski ochiq-matn parolni
// solishtirishda (lazy migration) oddiy === o'rniga shu ishlatiladi.
export function satrTeng(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

// Parolni saqlangan hash bilan solishtirish (timingSafeEqual).
// Bo'sh parol yoki buzuq format -> false (hech qachon throw qilmaydi).
export function parolTekshir(parol, saqlangan) {
  try {
    if (typeof parol !== 'string' || !parol) return false;
    if (typeof saqlangan !== 'string' || !saqlangan) return false;
    const q = saqlangan.split('$');
    if (q.length !== 6 || q[0] !== 'scrypt') return false;
    const n = Number(q[1]), r = Number(q[2]), p = Number(q[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)
        || n <= 1 || r <= 0 || p <= 0) return false;
    const salt = Buffer.from(q[4], 'base64');
    const kutilgan = Buffer.from(q[5], 'base64');
    if (!salt.length || !kutilgan.length) return false;
    const hash = scryptSync(parol, salt, kutilgan.length, { N: n, r, p });
    return timingSafeEqual(hash, kutilgan);
  } catch {
    return false; // noto'g'ri parametrlar/format — mos emas deb qaraymiz
  }
}
