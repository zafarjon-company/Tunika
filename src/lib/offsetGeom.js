// ============================================================
//  OFSET GEOMETRIYASI — parallel nusxa (Detal chizish / Gul chizish)
// ------------------------------------------------------------
//  Sof geometriya, DOM yo'q (testlar: npm run test:offset).
//  Konvensiya: world mm, x o'ngga, y PASTGA. Elementlar detalEngine'dagidek:
//    { type:'pline', pts:[{x,y}], closed }  |  { type:'circle', cx, cy, r }
//  - offsetSide(e, w): kursor (w) elementning qaysi tomonida (+1 / −1) va eng
//    yaqin segment/aylanagacha masofa (nd) — AutoCAD OFFSET'dagi "tomonni bosish".
//  - offsetPlinePts(pts, closed, D): polyline'ni ISHORALI D ga parallel surish —
//    har segment o'z normali bo'ylab suriladi, qo'shni segmentlar kesishmasida
//    tutashadi (miter); parallel (kollinear) qo'shnilar — surilgan uch.
//    Normal: segment yo'nalishini soat mili bo'yicha 90° burgan tomon
//    (n = (−dy, dx)); D > 0 shu tomonga, D < 0 teskari.
//    AutoCAD kabi: natijada YO'NALISHI TESKARI (yoki nolga tushgan) segmentlar —
//    masofa ularni "yutib" yuborgan (masalan ichkariga ofsetda qisqa faska) —
//    tashlab yuboriladi va qo'shnilari qayta kesishtiriladi; hamma segment
//    yutilsa yoki qolganlari tutashmasa (kontur yorilsa) — null («sig'madi»).
//  - offsetEnt(e, D, k): elementning k-nchi ofseti (k·D masofada); aylana
//    radiusi ≤ 0 bo'lsa yoki polyline sig'masa — null.
//  - offsetSeries(e, step, n): 1·step, 2·step, … n·step — sig'maganida to'xtaydi.
//  - multiOffset(e, w, distMm, n): tomon kursordan, qadam distMm (null bo'lsa
//    kursorgacha masofa), n ta nusxa. Gul chizishdagi «Nechta ofset tashlansin».
// ============================================================

const SERIES_MAX = 1000;   // offsetSeries uchun mutlaq chegara (cheksiz sikl bo'lmasin)

// Nuqtadan kesmagacha masofa
export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Cheksiz to'g'ri chiziqlar kesishishi (p1->p2, p3->p4); parallel bo'lsa null
export function lineInt(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

// Polyline segmentlari: [{a, b, i}] — yopiq bo'lsa (3+ nuqta) oxirgi->birinchi ham
export function plineSegs(pts, closed) {
  const s = [], p = Array.isArray(pts) ? pts : [];
  for (let i = 0; i + 1 < p.length; i++) s.push({ a: p[i], b: p[i + 1], i });
  if (closed && p.length > 2) s.push({ a: p[p.length - 1], b: p[0], i: p.length - 1 });
  return s;
}

// Yopiq konturning ishorali yuzasi (shoelace); ekranda (y pastga) soat mili bo'yicha musbat
export function signedArea(pts) {
  let a = 0;
  const n = Array.isArray(pts) ? pts.length : 0;
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}

// Kursor turgan tomon (+1 — segment normali tomonida / aylanadan tashqarida, −1 — teskari)
// va eng yaqin segment/aylana chizig'igacha masofa (nd, mm). Element noma'lum/bo'sh — null.
export function offsetSide(e, w) {
  if (!e || !w || !Number.isFinite(w.x) || !Number.isFinite(w.y)) return null;
  if (e.type === 'circle' || e.type === 'arc') {   // yoy — aylana kabi (markazdan masofa bo'yicha tomon)
    const dr = Math.hypot(w.x - e.cx, w.y - e.cy) - e.r;
    return { side: dr < 0 ? -1 : 1, nd: Math.abs(dr) };
  }
  if (e.type !== 'pline') return null;
  const segs = plineSegs(e.pts, e.closed);
  if (!segs.length) return null;
  let near = segs[0], nd = Infinity;
  for (const s of segs) { const dd = distToSeg(w.x, w.y, s.a.x, s.a.y, s.b.x, s.b.y); if (dd < nd) { nd = dd; near = s; } }
  const ndx = near.b.x - near.a.x, ndy = near.b.y - near.a.y;
  const side = Math.sign((w.x - near.a.x) * (-ndy) + (w.y - near.a.y) * ndx) || 1;
  return { side, nd };
}

// Polyline'ni ishorali D ga parallel surish. Yutilgan (teskari / nol) segmentlar
// tashlab yuborilib qolganlari qayta tutashtiriladi; sig'masa — null.
export function offsetPlinePts(pts, closed, D) {
  const segs = plineSegs(pts, closed);
  if (!segs.length || !Number.isFinite(D)) return null;
  const cyc = !!closed && pts.length > 2;
  const nPts = pts.length;
  // Har segment: surilgan chiziq (a, b) + asl birlik yo'nalishi (ux, uy) + asl indeksi
  let lines = segs.map((s) => {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy);
    const ux = L ? dx / L : 0, uy = L ? dy / L : 0, nx = -uy, ny = ux;
    return { i: s.i, ux, uy, a: { x: s.a.x + nx * D, y: s.a.y + ny * D }, b: { x: s.b.x + nx * D, y: s.b.y + ny * D } };
  });
  // Qo'shni surilgan chiziqlar burchagi: kesishma; parallel bo'lsa — asl qo'shnilar (kollinear)
  // uchun surilgan uch, oraliq segment yutilganlar uchun null (kontur yorilgan — sig'madi)
  const corner = (prev, cur) => lineInt(prev.a, prev.b, cur.a, cur.b) || (((prev.i + 1) % nPts === cur.i) ? cur.a : null);
  for (let iter = 0; iter <= segs.length; iter++) {
    const m = lines.length;
    if (cyc ? m < 3 : m < 1) return null;
    const out = [];
    if (cyc) {
      for (let k = 0; k < m; k++) { const c = corner(lines[(k - 1 + m) % m], lines[k]); if (!c) return null; out.push(c); }
    } else {
      out.push(lines[0].a);
      for (let k = 1; k < m; k++) { const c = corner(lines[k - 1], lines[k]); if (!c) return null; out.push(c); }
      out.push(lines[m - 1].b);
    }
    // Natijadagi k-segment asl yo'nalishga proyeksiyasi ≤ 0 bo'lsa — yutilgan (teskari yoki nol)
    const bad = new Set();
    for (let k = 0; k < m; k++) {
      const p = out[k], q = cyc ? out[(k + 1) % m] : out[k + 1];
      if ((q.x - p.x) * lines[k].ux + (q.y - p.y) * lines[k].uy <= 1e-6) bad.add(k);
    }
    if (!bad.size) return out;
    lines = lines.filter((_, k) => !bad.has(k));
  }
  return null;
}

// Elementning k-nchi ofseti (k·D masofada, D ishorali). Yangi element xossalari
// (id'siz) qaytadi; aylana radiusi 0 ga tushsa, polyline sig'masa yoki element mos kelmasa — null.
export function offsetEnt(e, D, k = 1) {
  if (!e || !Number.isFinite(D) || !(k > 0)) return null;
  if (e.type === 'circle') {
    const r = e.r + D * k;
    return r > 1e-9 ? { type: 'circle', cx: e.cx, cy: e.cy, r } : null;
  }
  if (e.type === 'arc') {   // yoy: o'sha markaz va burchaklar, radius ± k·D
    const r = e.r + D * k;
    return r > 1e-9 ? { type: 'arc', cx: e.cx, cy: e.cy, r, a0: e.a0, a1: e.a1 } : null;
  }
  if (e.type === 'pline') {
    const pts = offsetPlinePts(e.pts, e.closed, D * k);
    return pts ? { type: 'pline', pts, closed: !!e.closed } : null;
  }
  return null;
}

// 1·step, 2·step, … n·step ofsetlar qatori (step ishorali). Birinchi sig'maganida to'xtaydi.
export function offsetSeries(e, step, n = 1) {
  const out = [];
  const N = Math.min(SERIES_MAX, Math.floor(Number(n) || 0));
  for (let k = 1; k <= N; k++) { const o = offsetEnt(e, step, k); if (!o) break; out.push(o); }
  return out;
}

// Kursor (w) tomonida distMm qadam bilan n ta ofset; distMm berilmasa (null / ≤0) —
// kursorgacha masofa qadam bo'ladi (AutoCAD "Through" uslubi).
export function multiOffset(e, w, distMm, n = 1) {
  const s = offsetSide(e, w);
  if (!s) return [];
  const step = (distMm != null && distMm > 0 ? distMm : s.nd) * s.side;
  if (!(Math.abs(step) > 1e-9)) return [];
  return offsetSeries(e, step, n);
}
