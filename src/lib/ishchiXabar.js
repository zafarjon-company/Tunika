// ============================================================
//  ISHCHI BOTI — ilovadan signal (/api/ishchi-bot)
// ------------------------------------------------------------
//  Yo'qlama / avans / maosh Firestore'ga YOZILIB BO'LGACH (server
//  tasdiqlagach) serverga "shu joyga qara" deb aytamiz. Summa yoki matn
//  yuborilmaydi — server bazadan o'zi o'qiydi va ishchiga xabar beradi.
//  Yo'qlama 6 soniya kutib bir so'rovda ketadi: Kalendarda ketma-ket
//  bosish (Keldi → Kelmadi → bo'sh) yoki "Hammasi keldi" — bitta xabar.
//  Xatolar jim yutiladi: bot ishlamasa ham ilova ishlayveradi.
// ============================================================
const URL = '/api/ishchi-bot';
const KUTISH_MS = 6000;

function yubor(body, keepalive = false) {
  try {
    return fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive,
    }).then((r) => r.json()).catch(() => null);
  } catch (e) {
    return Promise.resolve(null);
  }
}

// ---- Yo'qlama navbati: { sana: Set(ishchiId) } ----
const navbat = new Map();
let taymer = null;

function tashla(keepalive) {
  if (taymer) { clearTimeout(taymer); taymer = null; }
  for (const [sana, ids] of navbat) yubor({ tur: 'yoqlama', sana, ishchiIdlar: [...ids] }, keepalive);
  navbat.clear();
}

export function yoqlamaOzgardi(sana, ishchiIdlar) {
  if (!sana || !ishchiIdlar || !ishchiIdlar.length) return;
  if (!navbat.has(sana)) navbat.set(sana, new Set());
  ishchiIdlar.forEach((id) => navbat.get(sana).add(id));
  if (taymer) clearTimeout(taymer);
  taymer = setTimeout(() => tashla(false), KUTISH_MS);
}

// Sahifa yopilsa / fonga o'tsa — kutib turganlar darhol (keepalive) ketadi
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { if (navbat.size) tashla(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && navbat.size) tashla(true);
  });
}

// Avans / maosh: yangi — shu saqlashda qo'shilgan yozuv idlari
export function tolovOzgardi(tur, oy, ishchiId, yangi = []) {
  yubor({ tur, oy, ishchiId, yangi });
}

// ---- Sozlamalar paneli uchun ----
export async function botHolati() {
  try {
    const r = await fetch(URL, { headers: { Accept: 'application/json' } });
    return await r.json();
  } catch (e) {
    return null;
  }
}
export function botniUlash() { return yubor({ amal: 'ulash' }); }
export function hisobYubor(ishchiId) { return yubor({ tur: 'hisob', ishchiId }); }
