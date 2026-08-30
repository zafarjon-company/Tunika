// ============================================================
//  OMBOR (SKLAD) — yordamchi funksiyalar
// ------------------------------------------------------------
//  Ma'lumot Firestore'da OBYEKT-XARITA ko'rinishida turadi
//  (massiv emas!) — shunda storage.saveField merge bilan ikki
//  telefon bir vaqtda yozsa ham yozuvlar bir-birini o'chirmaydi:
//
//    'ombor'          = { [id]: Material }
//    'ombor-harakat'  = { [id]: Harakat }
//
//  Material = { id, nomi, birlik, qoldiq, minQoldiq, tanNarx,
//               bogla: null | { kind, id }, rang, izoh, ochirilgan? }
//  Harakat  = { id, ts, turi, omborId, miqdor, narx, izoh,
//               orderId?, orderNumber?, userLogin }
//
//  O'chirish — { ochirilgan: true } bayrog'i bilan (merge'da
//  haqiqiy o'chirish murakkab). Ro'yxatlarda ular ko'rinmaydi.
// ============================================================

export const OMBOR_BIRLIKLAR = ['metr', 'dona', 'kg', 'list'];

// Suzuvchi nuqta "chiqindisi"ni tozalash (0.1+0.2 = 0.30000000000000004)
const yumalat = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Obyekt-xaritadan massiv: o'chirilganlarsiz, nomi bo'yicha saralangan
export function omborRoyxat(ombor) {
  return Object.values(ombor || {})
    .filter((m) => m && m.id && !m.ochirilgan)
    .sort((a, b) => (a.nomi || '').localeCompare(b.nomi || ''));
}

// Harakatlar massivi: yangi → eski
export function harakatRoyxat(harakat) {
  return Object.values(harakat || {})
    .filter((h) => h && h.id)
    .sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
}

// Qoldig'i minimumdan past (yoki teng) materiallar — faqat minQoldiq belgilanganlar
export function kamQoldiqlar(ombor) {
  return omborRoyxat(ombor).filter((m) => {
    const min = Number(m.minQoldiq) || 0;
    return min > 0 && (Number(m.qoldiq) || 0) <= min;
  });
}

// Materialga bog'langan katalog elementining nomi ('' — bog'lanmagan/topilmadi)
export function omborBogliq(mat, ctx = {}) {
  const b = mat && mat.bogla;
  if (!b || !b.kind || !b.id) return '';
  const { tunikaBaza = [], metrlilar = [], aksessuarlar = [], kaziroklar = [] } = ctx;
  const royxat = b.kind === 'tunika' ? tunikaBaza
    : b.kind === 'metrli' ? metrlilar
    : b.kind === 'aksessuar' ? aksessuarlar
    : b.kind === 'kazirok' ? kaziroklar
    : [];
  const el = royxat.find((x) => x && x.id === b.id);
  return el ? (el.nomi || '') : '';
}

// Bog'langan materiallarni kind+katalog id bo'yicha tez topish uchun indeks:
//   Map("<kind>|<catalogId>") -> [Material, ...]
function boglaIndeks(ombor) {
  const idx = new Map();
  for (const m of omborRoyxat(ombor)) {
    const b = m.bogla;
    if (!b || !b.kind || !b.id) continue;
    const key = `${b.kind}|${b.id}`;
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(m);
  }
  return idx;
}

// Yig'ilgan chiqimlarni ({omborId: miqdor}) natija massiviga aylantirish
function chiqimNatija(yigin, ombor) {
  const out = [];
  for (const omborId in yigin) {
    const miqdor = yumalat(yigin[omborId]);
    if (!(miqdor > 0)) continue;
    const mat = (ombor || {})[omborId];
    out.push({ omborId, miqdor, nomi: (mat && mat.nomi) || '' });
  }
  return out;
}

// srcItems qatoridan katalog id sini olish (bog'lanish turiga qarab)
function srcKatalogId(src, kind) {
  if (!src) return '';
  if (kind === 'tunika') {
    // Tunika/profnastil ham, metrli tovarning ASOS listi ham tunikaId bilan bog'langan,
    // lekin bu yerda faqat list sifatida sotilganlarini hisoblaymiz.
    return (src.kind === 'tunika' || src.kind === 'profnastil') ? (src.tunikaId || '') : '';
  }
  if (kind === 'metrli') return src.kind === 'metrli' ? (src.metrliId || '') : '';
  if (kind === 'aksessuar') return src.kind === 'aksessuar' ? (src.aksId || '') : '';
  if (kind === 'kazirok') return src.kind === 'kazirok' ? (src.kazId || '') : '';
  return '';
}

// Zakas saqlanganda ombordan yechiladigan miqdorlar.
//  MUHIM: order.items da katalog id yo'q — shuning uchun katalogni order.srcItems
//  (xom qatorlar) dan topamiz, miqdorni esa AYNI ID li order.items qatoridan olamiz:
//   - tunika/profnastil/metrli → jamiMeyor (metr)
//   - aksessuar/kazirok        → soni (dona)
export function zakasChiqimlari(order, ombor) {
  const src = (order && order.srcItems) || [];
  if (!src.length) return [];
  const idx = boglaIndeks(ombor);
  if (!idx.size) return [];

  // Miqdorni id bo'yicha olish uchun items xaritasi
  const itemById = new Map();
  for (const it of (order.items || [])) if (it && it.id) itemById.set(it.id, it);

  const yigin = {};
  for (const s of src) {
    if (!s) continue;
    const it = itemById.get(s.id);
    if (!it) continue;
    const metrli = s.kind === 'metrli';
    const list = s.kind === 'tunika' || s.kind === 'profnastil';
    const miqdor = (list || metrli)
      ? (Number(it.jamiMeyor) || 0)
      : (Number(it.soni) || 0);
    if (!(miqdor > 0)) continue;

    for (const kind of ['tunika', 'metrli', 'aksessuar', 'kazirok']) {
      const katId = srcKatalogId(s, kind);
      if (!katId) continue;
      const matlar = idx.get(`${kind}|${katId}`);
      if (!matlar) continue;
      for (const m of matlar) yigin[m.id] = (yigin[m.id] || 0) + miqdor;
    }
  }
  return chiqimNatija(yigin, ombor);
}

// Chizmadan kelgan kazirok qatorlari: har bir qator o'z LISTidan yeyiladi
// (kazRows[].listId → bogla.kind==='tunika' materiallari, miqdor = r.metr).
export function kazirokChiqimlari(order, ombor) {
  const rows = (order && order.kazRows) || [];
  if (!rows.length) return [];
  const idx = boglaIndeks(ombor);
  if (!idx.size) return [];

  const yigin = {};
  for (const r of rows) {
    if (!r || !r.listId) continue;
    const metr = Number(r.metr) || 0;
    if (!(metr > 0)) continue;
    const matlar = idx.get(`tunika|${r.listId}`);
    if (!matlar) continue;
    for (const m of matlar) yigin[m.id] = (yigin[m.id] || 0) + metr;
  }
  return chiqimNatija(yigin, ombor);
}

// Birlik qisqartmasi (ro'yxatlarda raqam yonida chiqadi)
export function birlikBelgisi(b) {
  if (b === 'metr') return 'm';
  if (b === 'dona') return 'dona';
  if (b === 'kg') return 'kg';
  if (b === 'list') return 'list';
  return b || '';
}
