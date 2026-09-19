// ============================================================
//  EGRI CHIZIQLAR VA IZOHLAR GEOMETRIYASI (sof funksiyalar — DOM yo'q)
//  Ellips (EL), Splayn (SPL), Matn (T) qutisi, O'lcham turlari (DLI/DAN/DRA/DDI).
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° TEPA, CCW musbat.
//  Ellips va splayn — silliq polyline (AutoCAD PELLIPSE=1 kabi): barcha asboblar
//  (Offset, Kesish, Tutashtirish, …) ular bilan odatdagi chiziq kabi ishlaydi.
// ============================================================

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
function norm360(a) { a = a % 360; if (a < 0) a += 360; return (Math.abs(a) < 1e-9 || Math.abs(a - 360) < 1e-9) ? 0 : a; }
function dirVec(deg) { const r = deg * D2R; return { dx: Math.cos(r), dy: -Math.sin(r) }; }
function vecAng(dx, dy) { return norm360(Math.atan2(-dy, dx) * R2D); }
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/* ---------------- ELLIPS ---------------- */
// ell = { cx, cy, rx, ry, rot } — rx — 1-o'q (rot yo'nalishida), ry — 2-o'q (unga tik)
export function ellipsePoint(ell, tDeg) {
  const t = tDeg * D2R, u = dirVec(ell.rot), v = dirVec(ell.rot + 90);
  const a = ell.rx * Math.cos(t), b = ell.ry * Math.sin(t);
  return { x: ell.cx + u.dx * a + v.dx * b, y: ell.cy + u.dy * a + v.dy * b };
}
// Nuqtalar soni: cho'ziq ellipsda ko'proq (uchlarida burilish ~10° dan oshmasin)
export function ellipseSegs(ell) {
  const k = Math.max(ell.rx, ell.ry) / Math.max(1e-9, Math.min(ell.rx, ell.ry));
  return Math.max(72, Math.min(256, Math.round(72 * Math.sqrt(k))));
}
// Yopiq silliq polyline nuqtalari (parametr bo'yicha teng — egri joylarda zich)
export function ellipsePts(ell, n) {
  n = n || ellipseSegs(ell);
  const out = [];
  for (let i = 0; i < n; i++) out.push(ellipsePoint(ell, (360 * i) / n));
  return out;
}
// Markaz + 1-o'q uchi + 2-o'q yarim uzunligi
export function ellipseFromCenter(c, axisEnd, r2) {
  const rx = dist(c, axisEnd);
  if (!(rx > 1e-9) || !(r2 > 1e-9)) return null;
  return { cx: c.x, cy: c.y, rx, ry: r2, rot: vecAng(axisEnd.x - c.x, axisEnd.y - c.y) };
}
// 1-o'qning ikki uchi + 2-o'q yarim uzunligi (AutoCAD «O'q, uch»)
export function ellipseFromAxis(p1, p2, r2) {
  const c = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return ellipseFromCenter(c, p2, r2);
}
// Nuqtadan 1-o'q chizig'igacha masofa (2-o'q yarim uzunligi sichqoncha bilan)
export function distToAxis(c, axisEnd, p) {
  const L = dist(c, axisEnd); if (L < 1e-12) return dist(c, p);
  return Math.abs((axisEnd.x - c.x) * (p.y - c.y) - (axisEnd.y - c.y) * (p.x - c.x)) / L;
}
// Ellips griplari: markaz, 1-o'q uchi, 2-o'q uchi
export function ellipseGrips(ell) {
  const u = dirVec(ell.rot), v = dirVec(ell.rot + 90);
  return { c: { x: ell.cx, y: ell.cy }, a: { x: ell.cx + u.dx * ell.rx, y: ell.cy + u.dy * ell.rx }, b: { x: ell.cx + v.dx * ell.ry, y: ell.cy + v.dy * ell.ry } };
}
// Affin akslantirish (ko'chirish/burish/masshtab/aks) dan keyin ellips parametrlari
export function ellipseMap(ell, fn) {
  const g = ellipseGrips(ell);
  const c = fn(g.c), a = fn(g.a), b = fn(g.b);
  return { cx: c.x, cy: c.y, rx: dist(c, a), ry: dist(c, b), rot: vecAng(a.x - c.x, a.y - c.y) };
}
// Ellips perimetri (Ramanujan II)
export function ellipsePerim(ell) {
  const a = ell.rx, b = ell.ry, h = ((a - b) * (a - b)) / ((a + b) * (a + b));
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/* ---------------- SPLAYN (fit nuqtalar orqali — markazlashgan Catmull-Rom) ---------------- */
// Egri har bir fit nuqtadan o'tadi (AutoCAD SPLINE «Fit»). closed — yopiq.
export function splinePts(fit, closed, perSpan) {
  const P = (fit || []).filter((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y));
  const pts = [];
  for (const q of P) if (!pts.length || dist(pts[pts.length - 1], q) > 1e-9) pts.push({ x: q.x, y: q.y });
  if (closed && pts.length > 2 && dist(pts[0], pts[pts.length - 1]) < 1e-9) pts.pop();
  const n = pts.length;
  if (n < 2) return pts.slice();
  if (n === 2 && !closed) return pts.slice();
  const seg = perSpan || 16;
  const get = (i) => {
    if (closed) return pts[((i % n) + n) % n];
    if (i < 0) return { x: 2 * pts[0].x - pts[1].x, y: 2 * pts[0].y - pts[1].y };
    if (i > n - 1) return { x: 2 * pts[n - 1].x - pts[n - 2].x, y: 2 * pts[n - 1].y - pts[n - 2].y };
    return pts[i];
  };
  const out = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const tj = (a, b) => Math.max(Math.sqrt(dist(a, b)), 1e-6);   // alpha = 0.5 (markazlashgan)
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < seg; k++) {
      const t = t1 + ((t2 - t1) * k) / seg;
      const L = (a, b, ta, tb) => ({ x: ((tb - t) * a.x + (t - ta) * b.x) / (tb - ta), y: ((tb - t) * a.y + (t - ta) * b.y) / (tb - ta) });
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  if (!closed) out.push({ x: pts[n - 1].x, y: pts[n - 1].y });
  return out;
}

/* ---------------- MATN ---------------- */
// Balandlik h — AutoCAD kabi BOSH HARF balandligi; shrift o'lchami (em) = h / TEXT_CAP (Arial)
export const TEXT_CAP = 0.716;
// Matn qutisi: pastki chap — qo'yish nuqtasi (AutoCAD TEXT, chap tayanch chiziq). w — kengligi (mm).
export function textBox(t, w) {
  const u = dirVec(t.rot || 0), v = dirVec((t.rot || 0) + 90), h = t.h;
  const d = -0.3 * h;   // pastki osilgan harflar (y, g) uchun
  const P = (a, b) => ({ x: t.x + u.dx * a + v.dx * b, y: t.y + u.dy * a + v.dy * b });
  return [P(0, d), P(w, d), P(w, h), P(0, h)];
}
// Nuqtadan matn qutisigacha masofa (ichida — 0)
export function distToTextBox(t, w, p) {
  const u = dirVec(t.rot || 0), v = dirVec((t.rot || 0) + 90), h = t.h;
  const dx = p.x - t.x, dy = p.y - t.y;
  const a = dx * u.dx + dy * u.dy, b = dx * v.dx + dy * v.dy;
  const ca = Math.max(0, Math.min(w, a)), cb = Math.max(-0.3 * h, Math.min(h, b));
  return Math.hypot(a - ca, b - cb);
}
// Akslantirishdan keyin matn: qo'yish nuqtasi, burchak, balandlik. Aks ettirishda matn
// o'qiladigan bo'lib qoladi (AutoCAD MIRRTEXT=0): quti markazi aks etadi, yozuv teskari bo'lmaydi.
export function textMap(t, w, fn) {
  const rot = t.rot || 0, u = dirVec(rot), v = dirVec(rot + 90);
  const p = { x: t.x, y: t.y };
  const p2 = fn(p), pu = fn({ x: p.x + u.dx, y: p.y + u.dy }), pv = fn({ x: p.x + v.dx, y: p.y + v.dy });
  const ux = pu.x - p2.x, uy = pu.y - p2.y, vx = pv.x - p2.x, vy = pv.y - p2.y;
  const s = Math.hypot(ux, uy) || 1;
  let nr = vecAng(ux, uy);
  const h = t.h * s;
  // world y pastga: oddiy (aks bo'lmagan) akslantirishda (u × v) < 0 bo'ladi
  const mirrored = (ux * vy - uy * vx) > 0;
  if (!mirrored) return { x: p2.x, y: p2.y, rot: nr, h };
  const c = fn({ x: p.x + u.dx * w / 2 + v.dx * t.h * 0.35, y: p.y + u.dy * w / 2 + v.dy * t.h * 0.35 });
  if (nr > 90 + 1e-9 && nr <= 270 + 1e-9) nr = norm360(nr + 180);
  const U = dirVec(nr), Vv = dirVec(nr + 90), W = w * s;
  return { x: c.x - U.dx * W / 2 - Vv.dx * h * 0.35, y: c.y - U.dy * W / 2 - Vv.dy * h * 0.35, rot: nr, h };
}

/* ---------------- O'LCHAMLAR ---------------- */
// Chiziqli (DLI): kursor bo'yicha gorizontal (0°) yoki vertikal (90°) — AutoCAD qoidasi
export function linearRot(p1, p2, cur) {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const hx = Math.abs(p2.x - p1.x) / 2, hy = Math.abs(p2.y - p1.y) / 2;
  const ox = Math.abs(cur.x - mx) - hx, oy = Math.abs(cur.y - my) - hy;
  if (ox <= 0 && oy > 0) return 0;
  if (oy <= 0 && ox > 0) return 90;
  return oy >= ox ? 0 : 90;
}
// Burilgan (rot) o'lcham: o'lcham chizig'i uchlari, qiymati. off — rot normali bo'yicha p1 dan
export function rotatedDim(e) {
  const u = dirVec(e.rot || 0), n = { x: u.dy, y: -u.dx };   // chap normal (o'ngga — TEPA)
  const p1 = { x: e.x1, y: e.y1 }, p2 = { x: e.x2, y: e.y2 };
  const a = { x: p1.x + n.x * e.off, y: p1.y + n.y * e.off };
  const k = (p2.x - p1.x) * n.x + (p2.y - p1.y) * n.y;
  const b = { x: p2.x + n.x * (e.off - k), y: p2.y + n.y * (e.off - k) };
  return { a, b, n, u, value: Math.abs((p2.x - p1.x) * u.dx + (p2.y - p1.y) * u.dy) };
}
export function rotatedOff(p1, rot, cur) {
  const u = dirVec(rot), n = { x: u.dy, y: -u.dx };
  return (cur.x - p1.x) * n.x + (cur.y - p1.y) * n.y;
}
// Burchak o'lchami (DAN): uch V, nurlardagi nuqtalar p1/p2, joy L. Ikki chiziq 4 sektor
// hosil qiladi — L tushgan sektor o'lchanadi. { a0, a1 (CCW), sweep, r, bounds:[{ang, from}] }
export function angularDim(e) {
  const V = { x: e.cx, y: e.cy };
  const al1 = vecAng(e.x1 - V.x, e.y1 - V.y), al2 = vecAng(e.x2 - V.x, e.y2 - V.y);
  const lam = vecAng(e.lx - V.x, e.ly - V.y), r = dist(V, { x: e.lx, y: e.ly });
  if (e.arc) {   // yoy o'lchami: yoy boshidan oxirigacha CCW — 180° dan katta ham bo'ladi
    const lo = { ang: al1, from: dist(V, { x: e.x1, y: e.y1 }) }, hi = { ang: al2, from: dist(V, { x: e.x2, y: e.y2 }) };
    return { a0: al1, a1: al2, sweep: norm360(al2 - al1) || 360, r, lo, hi, V };
  }
  const dirs = [
    { ang: al1, from: dist(V, { x: e.x1, y: e.y1 }) }, { ang: norm360(al1 + 180), from: 0 },
    { ang: al2, from: dist(V, { x: e.x2, y: e.y2 }) }, { ang: norm360(al2 + 180), from: 0 },
  ];
  let lo = null, hi = null;
  for (const d of dirs) {
    const below = norm360(lam - d.ang);
    let above = norm360(d.ang - lam);
    if (above < 1e-9) above = 360;   // joy nur ustida (magnit END/MID/NEA) — o'sha nur pastki chegara, yuqorisi keyingi nur
    if (!lo || below < lo.k) lo = { k: below, d };
    if (!hi || above < hi.k) hi = { k: above, d };
  }
  const sweep = norm360(hi.d.ang - lo.d.ang) || 0;
  return { a0: lo.d.ang, a1: hi.d.ang, sweep, r, lo: lo.d, hi: hi.d, V };
}
// Ikki chiziq (a1-b1, a2-b2) kesishmasi — cheksiz chiziqlar; parallel bo'lsa null
export function lineInt(a1, b1, a2, b2) {
  const d1x = b1.x - a1.x, d1y = b1.y - a1.y, d2x = b2.x - a2.x, d2y = b2.y - a2.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12 * (Math.hypot(d1x, d1y) * Math.hypot(d2x, d2y) || 1)) return null;
  const t = ((a2.x - a1.x) * d2y - (a2.y - a1.y) * d2x) / den;
  return { x: a1.x + d1x * t, y: a1.y + d1y * t };
}
// Radius / diametr o'lchami: markaz (x1,y1), yo'nalish nuqtasi (x2,y2), r
export function radialDim(e) {
  const c = { x: e.x1, y: e.y1 }, L = { x: e.x2, y: e.y2 };
  let dx = L.x - c.x, dy = L.y - c.y; const l = Math.hypot(dx, dy);
  if (l < 1e-9) { dx = 1; dy = 0; } else { dx /= l; dy /= l; }
  const P = { x: c.x + dx * e.r, y: c.y + dy * e.r }, Q = { x: c.x - dx * e.r, y: c.y - dy * e.r };
  return { c, L, P, Q, u: { x: dx, y: dy }, out: l > e.r };
}
