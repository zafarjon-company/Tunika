// ============================================================
//  KAZIROK GEOMETRIYASI (sof modul) — Patalok / Paloska
// ------------------------------------------------------------
//  Patalok va Paloska detallarining BAZAVIY DXF konturi, parametrik
//  cho'zish (eni / peshona / razmeri) va SVG chizmasi. Hech qanday DOM
//  yoki state'ga bog'liq emas — narxlar (Kazirok turlari) ham, savdo
//  Chizma engine ham shu mantiqdan foydalanadi.
//
//  MUHIM: konturlar (PAT_SEG / PAL_SEG) AYNAN chizmaEngine.js dagi bilan
//  bir xil — "Kazirok 2 bolak.dxf" dan o'lchangan. Birini o'zgartirsangiz,
//  ikkalasini ham yangilang (aks holda narxlar va savdo chizmalari farq qiladi).
// ============================================================

const PAT_W = 62.2;        // patalok kontur eni (sm) — list 62.5, qatlamadan keyin 62.2
const PAL_W = 7.75;        // paloska kontur eni (sm)
const PAT_DEF = { peshona: 10, razmeri: 50 };
const PAL_DEF = { peshona: 10.1, razmeri: 51.5 };

// Patalok konturi — "Kazirok 2 bolak.dxf" dan AYNAN (sm, y = yuqoridan past). 32 segment.
const PAT_SEG = [
  [3.10, 0, 3.10, 1.50], [3.10, 0, 59.10, 0], [59.10, 0, 59.10, 1.50],
  [0, 1.50, 0, 9.90], [0, 1.50, 1.50, 1.50], [1.50, 1.50, 1.50, 2.50], [1.50, 1.50, 3.10, 1.50],
  [59.10, 1.50, 60.70, 1.50], [60.70, 1.50, 60.70, 2.50], [60.70, 1.50, 62.20, 1.50], [62.20, 1.50, 62.20, 9.90],
  [0, 9.90, 1.50, 9.90], [1.50, 9.90, 1.50, 11.50], [60.70, 9.90, 60.70, 11.50], [60.70, 9.90, 62.20, 9.90],
  [1.50, 11.50, 3.10, 11.50], [3.10, 11.50, 1.50, 13.10], [59.10, 11.50, 60.70, 11.50], [59.10, 11.50, 60.70, 13.10],
  [0, 13.10, 0, 61.50], [0, 13.10, 1.50, 13.10], [60.70, 13.10, 62.20, 13.10], [62.20, 13.10, 62.20, 61.50],
  [1.50, 60.50, 1.50, 61.50], [3.10, 60.50, 3.10, 61.50], [59.10, 60.50, 59.10, 61.50], [60.70, 60.50, 60.70, 61.50],
  [0, 61.50, 1.50, 61.50], [1.50, 61.50, 3.10, 61.50], [3.10, 61.50, 59.10, 61.50], [59.10, 61.50, 60.70, 61.50], [60.70, 61.50, 62.20, 61.50],
];

// Paloska konturi — "Kazirok 2 bolak.dxf" dan AYNAN (sm, y = yuqoridan past). 20 segment.
const PAL_SEG = [
  [0, 0, 0.90, 0], [0.90, 0, 6.85, 0], [6.85, 0, 7.75, 0],
  [0, 0, 0, 1.40], [0.90, 0, 0.90, 0.50], [0, 1.40, 0.90, 1.40],
  [7.75, 0, 7.75, 1.40], [6.85, 0, 6.85, 0.50], [6.85, 1.40, 7.75, 1.40],
  [0, 1.40, 0, 10.10], [7.75, 1.40, 7.75, 10.10],
  [0, 10.10, 0.90, 10.10], [6.85, 10.10, 7.75, 10.10],
  [0.87, 10.10, 0, 10.60], [6.88, 10.10, 7.75, 10.60],
  [0, 10.60, 0, 62.10], [7.75, 10.60, 7.75, 62.10],
  [0.90, 61.60, 0.90, 62.10], [6.85, 61.60, 6.85, 62.10],
  [0, 62.10, 7.75, 62.10],
];

/* Har detalning BITTA bazaviy shakli (DXF dan). 3 razmer tahrirlanadi: ENI,
   PESHONA (yuqori), RAZMERI (tana). Shakl simmetrik — eni o'zgarsa kontur
   keng/torayadi, peshona/razmeri esa y'ni cho'zadi.
     seg/baseW — bazaviy kontur va uning haqiqiy eni (sm)
     kerf — lazer marjasi (sm): haqiqiy eni = kiritilgan eni − kerf
     yb — peshona o'yig'i chegaralari [yuqori, past]; baseH — bazaviy balandlik
     gap — chapdagi razmer o'qida peshona↔razmeri bo'shlig'i
     minW — minimal haqiqiy eni; pTop — peshona tepadan necha sm pastdan boshlanadi
     foldable — "Orqasi qayrilgan" (faqat Patalok)
     presets — { bolak, eni } "Asosiy" tugmalari (1.25 m listga sig'adigan dona). */
export const KAZ_DETS = {
  pat: {
    title: 'Patalok', seg: PAT_SEG, baseW: PAT_W, kerf: 0.3,
    yb: [9.0, 13.15], baseH: 61.50, gap: 1.5, minW: 8, pTop: 1.5, foldable: true,
    def: { ...PAT_DEF, eni: 62.5 },
    presets: [{ bolak: 2, eni: 62.5 }, { bolak: 3, eni: 41.6 }, { bolak: 4, eni: 31.6 }],
  },
  pal: {
    title: 'Paloska', seg: PAL_SEG, baseW: PAL_W, kerf: 0,
    yb: [9.0, 10.7], baseH: 62.10, gap: 0.5, minW: 2, pTop: 0, foldable: false,
    def: { ...PAL_DEF, eni: 7.75 },
    presets: [{ bolak: 16, eni: 7.75 }, { bolak: 15, eni: 8.3 }, { bolak: 14, eni: 8.85 }],
  },
};

// peshona (dP) tana ustini, razmeri (dR) tanani cho'zadi.
function makeYfn(b0, b1) {
  return (y, dP, dR) => (y <= b0 ? y : (y <= b1 ? y + dP : y + dP + dR));
}
// Eni o'zgarsa konturni simmetrik kengaytirish/torytirish.
function widenSegs(seg, baseW, Wc) {
  const mid = baseW / 2;
  const mx = (x) => (x <= mid ? x : Wc - (baseW - x));
  return seg.map(([x1, y1, x2, y2]) => [mx(x1), y1, mx(x2), y2]);
}
// "Orqasi qayrilgan" pasti — o'rta qism 1.5 sm pastga qayriladi.
function foldBottom(W, F) {
  const i1 = 1.5, i2 = 3.1, flap = 1.5;
  return [
    [i1, F - 1, i1, F], [W - i1, F - 1, W - i1, F],
    [0, F, i1, F], [i1, F, i2, F], [W - i2, F, W - i1, F], [W - i1, F, W, F],
    [i2, F, i2, F + flap], [W - i2, F, W - i2, F + flap],
    [i2, F + flap, W - i2, F + flap],
  ];
}
// Detal konturi (sm): eni bo'yicha x, peshona/razmeri bo'yicha y siljiydi.
// folded=true (faqat Patalok) — pasti qayrilgan flapga almashadi, balandlik +1.5.
export function kazGeom(kind, P, R, eni, folded) {
  const d = KAZ_DETS[kind];
  const Wc = Math.max(d.minW, eni - d.kerf);
  const yfn = makeYfn(d.yb[0], d.yb[1]);
  const dP = P - d.def.peshona, dR = R - d.def.razmeri;
  const morph = ([x1, y1, x2, y2]) => [x1, yfn(y1, dP, dR), x2, yfn(y2, dP, dR)];
  const base = widenSegs(d.seg, d.baseW, Wc);
  const F = yfn(d.baseH, dP, dR);
  if (folded && d.foldable) {
    const keep = base.filter(([, y1, , y2]) => !(y1 >= d.baseH - 1.05 && y2 >= d.baseH - 1.05));
    return { segs: keep.map(morph).concat(foldBottom(Wc, F)), H: F + 1.5, W: Wc };
  }
  return { segs: base.map(morph), H: F, W: Wc };
}

// Chapdagi vertikal razmer (o'q + strelkalar + sm yozuvi).
function vdimMarkup(x, y1, y2, label, col) {
  const a = 1.9, hw = 0.85, mid = (y1 + y2) / 2, fs = 3.8;
  const half = (label.length * fs * 0.6) / 2 + 0.7;
  const broken = (y2 - y1) > (2 * half + 1.6);
  const lineSegs = broken
    ? `<line x1="${x}" y1="${y1}" x2="${x}" y2="${mid - half}" stroke="${col}" stroke-width="0.34"/>
       <line x1="${x}" y1="${mid + half}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width="0.34"/>`
    : `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width="0.34"/>`;
  const tx = broken ? x : x - 2.6;
  return `
    <line x1="0" y1="${y1}" x2="${x}" y2="${y1}" stroke="${col}" stroke-width="0.2"/>
    <line x1="0" y1="${y2}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width="0.2"/>
    ${lineSegs}
    <polygon points="${x},${y1} ${x - hw},${y1 + a} ${x + hw},${y1 + a}" fill="${col}"/>
    <polygon points="${x},${y2} ${x - hw},${y2 - a} ${x + hw},${y2 - a}" fill="${col}"/>
    <text x="${tx}" y="${mid}" fill="${col}" font-size="${fs}" font-weight="700" text-anchor="middle"
      dominant-baseline="central" transform="rotate(-90 ${tx} ${mid})">${label}</text>`;
}
// Gorizontal razmer (chizma TEPASIDA): eni uchun.
function hdimMarkup(y, x1, x2, label, col) {
  const a = 1.9, hw = 0.85, mid = (x1 + x2) / 2, fs = 3.8;
  return `
    <line x1="${x1}" y1="0" x2="${x1}" y2="${y}" stroke="${col}" stroke-width="0.2"/>
    <line x1="${x2}" y1="0" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="0.2"/>
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${col}" stroke-width="0.34"/>
    <polygon points="${x1},${y} ${x1 + a},${y - hw} ${x1 + a},${y + hw}" fill="${col}"/>
    <polygon points="${x2},${y} ${x2 - a},${y - hw} ${x2 - a},${y + hw}" fill="${col}"/>
    <text x="${mid}" y="${y - 1.3}" fill="${col}" font-size="${fs}" font-weight="700" text-anchor="middle">${label}</text>`;
}
// Umumiy chizma: detal chiziqlari + tepada eni + chapda peshona/razmeri.
function detSvgMarkup(g, d, P, R, eni) {
  const dimX = -7, padL = 16, padR = 4, padT = 10, padB = 5;
  const W = g.W;
  const vbW = W + padL + padR, vbH = g.H + padT + padB;
  const GREEN = '#16a34a';
  const det = g.segs.map((s) =>
    `<line x1="${s[0]}" y1="${s[1].toFixed(2)}" x2="${s[2]}" y2="${s[3].toFixed(2)}" stroke="currentColor" stroke-width="0.85" stroke-linecap="round"/>`).join('');
  const svgStyle = (vbH / vbW) > 1.5
    ? 'display:block;margin:0 auto;height:min(440px,68vh);width:auto;max-width:100%'
    : 'display:block;width:100%;height:auto';
  return `<svg viewBox="${-padL} ${-padT} ${vbW} ${vbH}" style="${svgStyle}">
    ${det}
    ${hdimMarkup(-4, 0, W, '' + (+eni.toFixed(2)), GREEN)}
    ${vdimMarkup(dimX, d.pTop, d.pTop + P, '' + (+P.toFixed(1)), GREEN)}
    ${vdimMarkup(dimX, P + d.gap, P + d.gap + R, '' + (+R.toFixed(1)), GREEN)}
  </svg>`;
}
// Detal chizmasi (SVG) — berilgan eni/peshona/razmeri (+ Patalok uchun fold) bilan.
export function kazSvg(kind, eni, P, R, fold) {
  const d = KAZ_DETS[kind];
  const Pd = Math.max(2, P), Rd = Math.max(2, R);
  const folded = d.foldable && !!fold;
  return detSvgMarkup(kazGeom(kind, Pd, Rd, eni, folded), d, Pd, Rd, eni);
}

// Eni'ga mos "Asosiy" preset (bo'lak soni) — mos kelmasa null.
export function kazActivePreset(kind, eni) {
  return KAZ_DETS[kind].presets.find((p) => Math.abs(p.eni - eni) < 0.05) || null;
}
// Bir bo'lak eni (sm) → 1.25 m (1250 mm) listga sig'adigan bo'lak soni.
export function kazBolak(kind, eniCm) {
  const p = kazActivePreset(kind, eniCm);
  if (p) return p.bolak;
  return Math.max(1, Math.round(1250 / (Math.max(1, eniCm) * 10)));
}

/* ---- Bitta detal (patalok/paloska) uchun to'liq hisob ----
   item: { eni, peshona, razmeri, fold }. Qaytaradi:
     bolak — 1.25 m listga sig'adigan dona
     pieceLenCm / pieceM — bir bo'lak uzunligi (rulon bo'ylab)
     listMetri — BITTA tayyor dona uchun sarflanadigan list metri
                 = (bir bo'lak uzunligi, m) ÷ bolak  */
export function kazItemCalc(kind, item = {}) {
  const d = KAZ_DETS[kind];
  const eni = Math.max(d.minW, +item.eni || d.def.eni);
  const peshona = Math.max(2, +item.peshona || d.def.peshona);
  const razmeri = Math.max(2, +item.razmeri || d.def.razmeri);
  const fold = kind === 'pat' && !!item.fold;
  const geom = kazGeom(kind, peshona, razmeri, eni, fold);
  const bolak = kazBolak(kind, eni);
  const pieceLenCm = geom.H;
  const pieceM = pieceLenCm / 100;
  const listMetri = pieceM / bolak;
  return { eni, peshona, razmeri, fold, bolak, pieceLenCm, pieceM, listMetri, W: geom.W, H: geom.H };
}
