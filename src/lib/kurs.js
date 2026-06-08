// ============================================================
//  DOLLAR KURSI — joriy kursni internetdan olish
//  Bazaviy kurs internetdan olinadi, undan OLISH va SOTISH
//  kursi hosil bo'ladi (ustamalar localStorage'da):
//    'usd-ust-olish'  → olish ustamasi (odatda manfiy, masalan -20)
//    'usd-ust-sotish' → sotish ustamasi (odatda musbat, masalan +20)
//  Oxirgi baza 'usd-baza'ga yoziladi (ko'rsatish uchun).
// ============================================================

// Markaziy bank (rasmiy)
async function olRasmiy() {
  const r = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/');
  if (!r.ok) throw new Error('CBU javob bermadi');
  const d = await r.json();
  const rate = parseFloat(d?.[0]?.Rate);
  if (!(rate > 0)) throw new Error('CBU: kurs topilmadi');
  return Math.round(rate);
}

// Xalqaro bozor (interbank) — zaxira manba
async function olBozor() {
  const r = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!r.ok) throw new Error('Bozor manbasi javob bermadi');
  const d = await r.json();
  const rate = d?.rates?.UZS;
  if (!(rate > 0)) throw new Error('Bozor: kurs topilmadi');
  return Math.round(rate);
}

// Bazaviy kurs: avval CBU, ishlamasa bozor
export async function fetchBaseRate() {
  try { return await olRasmiy(); }
  catch (e) { return await olBozor(); }
}

// Sotish kursiga 1 DOLLAR uchun qo'shiladigan o'zgaruvchan ustama: 70–100 so'm
// (ya'ni 100$ uchun ~7000–10000 so'm). Har xil "tabiiy" raqam.
// Kun davomida barqaror bo'lishi uchun kunlik localStorage'ga saqlanadi,
// shunda har yangilashda kurs sakrab ketmaydi.
function sotishQoshimcha() {
  try {
    const bugun = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const saqlangan = JSON.parse(localStorage.getItem('usd-sotish-rand') || 'null');
    if (saqlangan && saqlangan.kun === bugun
        && saqlangan.qiymat >= 70 && saqlangan.qiymat <= 100) {
      return saqlangan.qiymat;
    }
    // 70–100 oralig'ida tasodifiy son (1 dollar uchun)
    const qiymat = 70 + Math.floor(Math.random() * 31);
    localStorage.setItem('usd-sotish-rand', JSON.stringify({ kun: bugun, qiymat }));
    return qiymat;
  } catch (e) {
    return 85; // zaxira qiymat (1 dollar uchun)
  }
}

// Baza + ustamalar → { base, olish, sotish }
export async function fetchKurslar() {
  const base = await fetchBaseRate();
  let uO = 0;
  let uS = 0;
  try {
    uO = parseInt(localStorage.getItem('usd-ust-olish') || '0', 10) || 0;
    uS = parseInt(localStorage.getItem('usd-ust-sotish') || '0', 10) || 0;
    localStorage.setItem('usd-baza', String(base));
  } catch (e) { /* noop */ }
  return { base, olish: base + uO, sotish: base + uS + sotishQoshimcha() };
}
