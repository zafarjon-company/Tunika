// ============================================================
//  QATLAMLAR (AutoCAD Layer) — SOF MANTIQ
//  ------------------------------------------------------------
//  Ranglar (ACI), chiziq turlari (linetype), chiziq qalinliklari (lineweight),
//  qatlam jadvali ustidagi amallar va element uslubini hisoblash. DOM yo'q —
//  node --test bilan tekshiriladi (cadLayer.test.mjs).
//
//  Qatlam yozuvi:
//    { nomi, on, frozen, locked, color, lt, lw, plot, izoh }
//      color — ACI raqami (7 = fon bo'yicha oq/qora)
//      lt    — chiziq turi kaliti (LT dagi)
//      lw    — qalinlik: yuzdan bir mm (25 = 0.25 mm), -3 = «Default»
//  Element (entity) ustidagi xossalar — qatlamdan ustun:
//    e.col — ACI yoki null/undefined («Qatlam bo'yicha»)
//    e.lt  — chiziq turi yoki null
//    e.lw  — qalinlik yoki null
// ============================================================

// ---------- RANGLAR (ACI — AutoCAD Color Index) ----------
// 7 — fon bo'yicha (to'q doskada oq, oq fonda qora): hex o'rniga null.
export const ACI = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff',
  7: null, 8: '#808080', 9: '#c0c0c0',
  20: '#ff3f00', 30: '#ff7f00', 40: '#ffbf00', 60: '#bfff00', 90: '#00ff00',
  110: '#00ff7f', 130: '#00ffff', 140: '#00bfff', 150: '#007fff', 170: '#0000ff',
  190: '#7f00ff', 210: '#ff00ff', 230: '#ff007f',
  250: '#333333', 252: '#696969', 253: '#828282', 254: '#bebebe',
};
export const ACI_NOM = {
  1: 'Qizil', 2: 'Sariq', 3: 'Yashil', 4: 'Moviy', 5: "Ko'k", 6: 'Siyohrang',
  7: 'Oq / qora (fon bo‘yicha)', 8: "To'q kulrang", 9: 'Och kulrang',
  20: "To'q sariq", 30: 'Apelsin', 40: 'Zarhal', 60: 'Limon', 90: "Och yashil",
  110: 'Zumrad', 130: 'Firuza', 140: 'Havorang', 150: 'Deniz', 170: "To'q ko'k",
  190: 'Binafsha', 210: 'Pushti-siyoh', 230: 'Malina',
  250: "Deyarli qora", 252: 'Kulrang', 253: 'Och kul', 254: 'Kumush',
};
// Tanlash ro'yxati uchun tartib (AutoCAD ranglar panelidagidek — avval 1..9)
export const ACI_LIST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 30, 40, 60, 90, 110, 130, 140, 150, 170, 190, 210, 230, 250, 252, 253, 254];

// ---------- CHIZIQ TURLARI (acadiso.lin, mm) ----------
// pat — [chiziq, bo'shliq, chiziq, bo'shliq…] mm. Nuqta uchun 0.1 mm olinadi
// (SVG nol uzunlikdagi shtrixni chizmaydi).
export const LT = {
  CONTINUOUS: { nomi: 'Uzluksiz', pat: [] },
  HIDDEN: { nomi: 'Yashirin punktir', pat: [6, 3] },
  HIDDEN2: { nomi: 'Yashirin ×0.5', pat: [3, 1.5] },
  HIDDENX2: { nomi: 'Yashirin ×2', pat: [12, 6] },
  CENTER: { nomi: "O'q chizig'i", pat: [30, 6, 6, 6] },
  CENTER2: { nomi: "O'q chizig'i ×0.5", pat: [15, 3, 3, 3] },
  CENTERX2: { nomi: "O'q chizig'i ×2", pat: [60, 12, 12, 12] },
  DASHED: { nomi: 'Shtrixli', pat: [12, 6] },
  DASHDOT: { nomi: 'Shtrix-nuqta', pat: [12, 6, 0.1, 6] },
  PHANTOM: { nomi: 'Fantom (kesim o‘qi)', pat: [30, 6, 6, 6, 6, 6] },
  DOT: { nomi: 'Nuqtali', pat: [0.1, 6] },
  BORDER: { nomi: 'Chegara', pat: [12, 6, 12, 6, 0.1, 6] },
  DIVIDE: { nomi: "Bo'luvchi", pat: [12, 6, 0.1, 6, 0.1, 6] },
  ACAD_ISO02W100: { nomi: 'ISO punktir', pat: [12, 3] },
  ACAD_ISO04W100: { nomi: 'ISO uzun shtrix-nuqta', pat: [24, 3, 0.5, 3] },
};
export const LT_LIST = Object.keys(LT);

// ---------- QALINLIKLAR (lineweight, yuzdan bir mm) ----------
export const LW_DEFAULT = 25;        // LWDEFAULT — 0.25 mm
export const LW_BYLAYER = -3;        // «Default» (qatlamda) / «Qatlam bo'yicha» (elementda)
export const LW_LIST = [-3, 0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
export function lwLabel(lw) {
  if (lw == null || lw === LW_BYLAYER) return 'Default (0.25 mm)';
  return (lw / 100).toFixed(2) + ' mm';
}
// Qalinlik (yuzdan bir mm) -> ekran piksel. Zoomga bog'liq emas (AutoCAD ham shunday).
export function lwPx(lw, mult) {
  const m = Number.isFinite(mult) && mult > 0 ? mult : 1;
  const v = (lw == null || lw === LW_BYLAYER) ? LW_DEFAULT : lw;
  return Math.max(0.6, (v / 100) * 3.8) * m;
}

// ---------- NOM ----------
const BAD_RE = /[<>/\\":;?*|,=`]/;
export function normLayerName(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 255);
}
// '' — nom to'g'ri; aks holda o'zbekcha xato matni
export function layerNameError(nomi, list, selfName) {
  const n = normLayerName(nomi);
  if (!n) return 'Qatlam nomi bo‘sh bo‘lmasin';
  if (BAD_RE.test(n)) return 'Nomda < > / \\ " : ; ? * | , = ` belgilari bo‘lmaydi';
  const self = selfName == null ? null : String(selfName).toLowerCase();
  for (const l of list || []) {
    if (l.nomi.toLowerCase() === n.toLowerCase() && l.nomi.toLowerCase() !== self) return 'Bunday nomli qatlam bor';
  }
  return '';
}

// ---------- JADVAL ----------
export function makeLayer(nomi, props) {
  const p = props || {};
  return {
    nomi: normLayerName(nomi) || '0',
    on: p.on !== false,
    frozen: !!p.frozen,
    locked: !!p.locked,
    color: Number.isFinite(p.color) ? p.color : 7,
    lt: LT[p.lt] ? p.lt : 'CONTINUOUS',
    lw: Number.isFinite(p.lw) ? p.lw : LW_BYLAYER,
    plot: p.plot !== false,
    izoh: String(p.izoh || '').slice(0, 200),
  };
}
// Boshlang'ich qatlamlar. main — asosiy (joriy) qatlam nomi: eski chizmalardagi
// qatlamsiz elementlar shunga o'tadi, DXF ham shu nom bilan chiqadi.
export function defaultLayers(main) {
  const m = normLayerName(main) || 'DETAL';
  return [
    makeLayer('0', { color: 7, izoh: 'Bo‘sh qatlam — bloklar uchun' }),
    makeLayer(m, { color: 7, lw: 50, izoh: 'Asosiy kontur (kesim)' }),
    makeLayer('OFSET', { color: 6, lw: 25, izoh: 'Ichki ofset konturi' }),
    makeLayer('OLCHAM', { color: 2, lw: 18, izoh: "O'lcham chiziqlari" }),
    makeLayer('MATN', { color: 3, lw: 18, izoh: 'Yozuvlar' }),
    makeLayer('SHTRIX', { color: 8, lw: 13, izoh: 'Shtrix (bo‘yash)' }),
    makeLayer('MARKAZ', { color: 1, lt: 'CENTER', lw: 13, izoh: "O'q va markaz chiziqlari" }),
    makeLayer('YORDAMCHI', { color: 9, lt: 'DASHED', lw: 9, plot: false, izoh: 'Yordamchi — chop etilmaydi' }),
  ];
}
export function findLayer(list, nomi) {
  if (!Array.isArray(list) || !list.length) return null;
  const n = String(nomi == null ? '' : nomi).toLowerCase();
  return list.find((l) => l.nomi.toLowerCase() === n) || null;
}
// Qatlamlar tartibi: AutoCAD kabi nom bo'yicha (0 doim birinchi), raqamlar tabiiy tartibda
export function sortLayers(list) {
  return list.slice().sort((a, b) => {
    if (a.nomi === '0') return -1;
    if (b.nomi === '0') return 1;
    return a.nomi.localeCompare(b.nomi, 'uz', { numeric: true, sensitivity: 'base' });
  });
}
// '' — o'chirsa bo'ladi; aks holda sabab
export function canDeleteLayer(list, nomi, usedNames, clay) {
  const n = normLayerName(nomi);
  if (n === '0') return 'Qatlam «0» o‘chirilmaydi';
  if (!findLayer(list, n)) return 'Bunday qatlam yo‘q';
  if (String(clay || '').toLowerCase() === n.toLowerCase()) return 'Joriy qatlam o‘chirilmaydi';
  if ((usedNames || []).some((u) => String(u).toLowerCase() === n.toLowerCase())) return 'Qatlamda elementlar bor (avval ularni o‘chiring yoki ko‘chiring)';
  return '';
}

// ---------- ELEMENT USLUBI ----------
// Chiziq turi -> SVG stroke-dasharray (piksel). pxPerMm — joriy masshtab (state.scale).
export function ltDash(ltName, ltscale, pxPerMm) {
  const d = LT[ltName];
  if (!d || !d.pat.length) return '';
  const k = (Number.isFinite(ltscale) && ltscale > 0 ? ltscale : 1) * (Number.isFinite(pxPerMm) && pxPerMm > 0 ? pxPerMm : 1);
  return d.pat.map((v) => Math.max(0.35, v * k).toFixed(2)).join(' ');
}
// ACI -> hex. 7 (va noma'lum raqam) — fon bo'yicha: ink beriladi.
export function aciHex(aci, ink) {
  const hex = ACI[aci];
  return hex || ink || '#000000';
}
// Yorug' rangni oq fonda (eksport) o'qiladigan qilish
export function darkenForWhite(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum <= 0.62) return hex;
  const k = 0.62 / lum;
  const c = (v) => Math.round(v * k).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
// Element uchun to'liq uslub. opts: { ink, ltscale, pxPerMm, lwOn, mult, exportMode, mainLayer }
export function resolveStyle(ent, layers, opts) {
  const o = opts || {};
  const lay = findLayer(layers, ent && ent.lay != null ? ent.lay : o.mainLayer) || findLayer(layers, o.mainLayer) || (layers && layers[0]) || makeLayer('0');
  const aci = Number.isFinite(ent && ent.col) ? ent.col : lay.color;
  let hex = aciHex(aci, o.ink);
  if (o.exportMode) hex = aci === 7 ? (o.ink || '#000000') : darkenForWhite(hex);
  const ltName = (ent && ent.lt && LT[ent.lt]) ? ent.lt : lay.lt;
  const lw = Number.isFinite(ent && ent.lw) ? ent.lw : lay.lw;
  return {
    layer: lay,
    hidden: !lay.on || lay.frozen,
    locked: !!lay.locked,
    plot: lay.plot !== false,
    color: hex,
    aci,
    dash: ltDash(ltName, o.ltscale, o.pxPerMm),
    lt: ltName,
    lw,
    width: o.lwOn ? lwPx(lw, o.mult) : null,
  };
}

// Chizmadagi qatlam nomlari (element bo'lmagan qatlamlarni topish uchun)
export function usedLayerNames(ents, mainLayer) {
  const s = new Set();
  for (const e of ents || []) s.add(String(e && e.lay != null ? e.lay : mainLayer));
  return Array.from(s);
}
// Eski (qatlamsiz) chizmani ko'chirish: har elementga lay qo'yiladi
export function migrateEnts(ents, mainLayer) {
  let n = 0;
  for (const e of ents || []) if (e && e.lay == null) { e.lay = mainLayer; n++; }
  return n;
}
// Jadvalni yuklashda tozalash (localStorage'dan kelgan bo'lishi mumkin)
export function sanitizeLayers(raw, main) {
  if (!Array.isArray(raw) || !raw.length) return defaultLayers(main);
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const n = normLayerName(r.nomi);
    if (!n || BAD_RE.test(n)) continue;
    if (out.some((l) => l.nomi.toLowerCase() === n.toLowerCase())) continue;
    out.push(makeLayer(n, r));
  }
  if (!out.some((l) => l.nomi === '0')) out.unshift(makeLayer('0', { color: 7 }));
  const m = normLayerName(main) || 'DETAL';
  if (!findLayer(out, m)) out.push(makeLayer(m, { color: 7, lw: 50 }));
  return out;
}
