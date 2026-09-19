// ============================================================
//  TAHRIR GEOMETRIYASI — AutoCAD: BREAK (Uzish), STRETCH (Cho'zish), LENGTHEN
//  (Uzunlik), POLYGON (Ko'pburchak), DIVIDE / MEASURE (Bo'lish / O'lchab qo'yish),
//  AREA (Yuza)
// ------------------------------------------------------------
//  Sof geometriya, DOM yo'q (testlar: npm run test:edit).
//  Konvensiya: world mm, x o'ngga, y PASTGA; burchak 0° o'ng, 90° tepa, CCW musbat.
//  Elementlar: pline {pts, closed} · arc {cx,cy,r,a0,a1} (a0→a1 CCW) · circle {cx,cy,r}
//              · point {x,y} · dim {x1,y1,x2,y2,off}.
//  Polyline yo'l uzunligi (s) bo'yicha parametrlanadi: plinePath / pathProject /
//  pathPoint / pathSub. Barcha funksiyalar yangi xossalarni qaytaradi, asl element
//  o'zgarmaydi.
// ============================================================
import { norm360, dirVec, vecAng } from './osnap.js';
import { arcSweep, arcFrom3 } from './arcGeom.js';

const EPS = 1e-9;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
const P = (p) => ({ x: p.x, y: p.y });
const pl = (pts, closed) => {
  const out = [];
  for (const q of pts) if (!out.length || dist(out[out.length - 1], q) > 1e-9) out.push(P(q));
  if (closed && out.length > 2 && dist(out[0], out[out.length - 1]) < 1e-9) out.pop();
  return out.length >= 2 ? { type: 'pline', pts: out, closed: !!closed && out.length > 2 } : null;
};
const arcE = (cx, cy, r, a0, a1) => ({ type: 'arc', cx, cy, r, a0: norm360(a0), a1: norm360(a1) });

/* ---------------- POLYLINE YO'LI ---------------- */
export function plinePath(e) {
  const p = e.pts, n = p.length, closed = !!e.closed && n > 2, segs = [];
  let L = 0;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) { const a = p[i], b = p[(i + 1) % n], l = dist(a, b); segs.push({ a, b, s0: L, l, i }); L += l; }
  return { segs, L, closed, n };
}
// Nuqtaning yo'ldagi eng yaqin joyi: { s, d, x, y }
export function pathProject(path, Q) {
  let best = null;
  for (const g of path.segs) {
    const dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, L2 = dx * dx + dy * dy;
    let t = L2 > 0 ? ((Q.x - g.a.x) * dx + (Q.y - g.a.y) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const x = g.a.x + dx * t, y = g.a.y + dy * t, d = Math.hypot(Q.x - x, Q.y - y);
    if (!best || d < best.d - 1e-12) best = { s: g.s0 + g.l * t, d, x, y };
  }
  return best;
}
export function pathPoint(path, s) {
  if (!path.segs.length) return null;
  if (path.closed) { s = ((s % path.L) + path.L) % path.L; } else s = Math.max(0, Math.min(path.L, s));
  for (const g of path.segs) {
    if (s <= g.s0 + g.l + 1e-12 || g === path.segs[path.segs.length - 1]) {
      const t = g.l > 0 ? Math.max(0, Math.min(1, (s - g.s0) / g.l)) : 0;
      return { x: g.a.x + (g.b.x - g.a.x) * t, y: g.a.y + (g.b.y - g.a.y) * t };
    }
  }
  return null;
}
// sa → sb qismi (sa < sb); yopiq yo'lda sb > L bo'lsa aylanib o'tadi
export function pathSub(path, sa, sb) {
  const out = [pathPoint(path, sa)];
  const L = path.L;
  const vs = [];   // tugunlar pozitsiyalari (bir yoki ikki aylanish)
  for (const g of path.segs) vs.push({ s: g.s0 + g.l, p: g.b });
  const loops = path.closed && sb > L + 1e-12 ? [0, L] : [0];
  for (const off of loops) for (const v of vs) { const s = v.s + off; if (s > sa + 1e-9 && s < sb - 1e-9) out.push(P(v.p)); }
  out.push(pathPoint(path, sb));
  return out;
}

/* ---------------- UZISH (BREAK) ---------------- */
// P1 → P2 orasini olib tashlash. P2 berilmasa yoki P1 bilan bir — nuqtada uzish.
// Natija: { add: [xossalar] } (asl element o'chiriladi) yoki { reason }.
export function breakEnt(e, P1, P2) {
  if (!e || !P1) return { reason: 'Obyekt va nuqta kerak' };
  const same = !P2 || dist(P1, P2) < 1e-9;
  if (e.type === 'pline') {
    const path = plinePath(e), L = path.L;
    if (L < EPS) return { reason: "Nol uzunlikdagi chiziq" };
    const s1 = pathProject(path, P1).s, s2 = same ? s1 : pathProject(path, P2).s;
    const out = [];
    const push = (pts) => { const m = pl(pts, false); if (m) out.push(m); };
    if (!path.closed) {
      if (same) {
        if (s1 <= 1e-6 || s1 >= L - 1e-6) return { reason: "Chiziq uchida uzib bo'lmaydi" };
        push(pathSub(path, 0, s1)); push(pathSub(path, s1, L));
        return { add: out };
      }
      const a = Math.min(s1, s2), b = Math.max(s1, s2);
      if (a > 1e-9) push(pathSub(path, 0, a));
      if (b < L - 1e-9) push(pathSub(path, b, L));
      return { add: out };
    }
    // yopiq: nuqtada — shu joyda ochiladi; ikki nuqta — P1 dan P2 gacha (tugunlar tartibida) olib tashlanadi
    if (same) { push(pathSub(path, s1, s1 + L)); return { add: out }; }
    const from = s2, to = s1 >= s2 ? s1 : s1 + L;
    if (to - from < 1e-9) return { reason: 'Nuqtalar bir xil' };
    push(pathSub(path, from, to));
    return { add: out };
  }
  if (e.type === 'arc') {
    const sw = arcSweep(e);
    const pos = (Q) => { let d = norm360(vecAng(Q.x - e.cx, Q.y - e.cy) - e.a0); if (d > sw) d = (d - sw) < (360 - d) ? sw : 0; return d; };
    const d1 = pos(P1), d2 = same ? d1 : pos(P2);
    const out = [];
    if (same) {
      if (d1 <= 1e-6 || d1 >= sw - 1e-6) return { reason: "Yoy uchida uzib bo'lmaydi" };
      out.push(arcE(e.cx, e.cy, e.r, e.a0, e.a0 + d1), arcE(e.cx, e.cy, e.r, e.a0 + d1, e.a1));
      return { add: out };
    }
    const a = Math.min(d1, d2), b = Math.max(d1, d2);
    if (a > 1e-6) out.push(arcE(e.cx, e.cy, e.r, e.a0, e.a0 + a));
    if (b < sw - 1e-6) out.push(arcE(e.cx, e.cy, e.r, e.a0 + b, e.a1));
    return { add: out };
  }
  if (e.type === 'circle') {
    if (same) return { reason: "Aylanani bitta nuqtada uzib bo'lmaydi (AutoCAD) — ikki nuqta bering" };
    const t1 = vecAng(P1.x - e.cx, P1.y - e.cy), t2 = vecAng(P2.x - e.cx, P2.y - e.cy);
    if (Math.abs(norm360(t2 - t1)) < 1e-6) return { reason: 'Nuqtalar bir xil' };
    // AutoCAD: P1 dan P2 gacha soat miliga qarshi qism olib tashlanadi → qoladi P2 → P1
    return { add: [arcE(e.cx, e.cy, e.r, t2, t1)] };
  }
  return { reason: "Faqat chiziq, yoy va aylana uziladi" };
}

/* ---------------- CHO'ZISH (STRETCH) ---------------- */
// rect = {x1,y1,x2,y2} (world, x1<x2, y1<y2) — ichidagi tugunlar (dx,dy) ga suriladi.
// Natija: yangi xossalar (patch) yoki null (o'zgarmaydi).
export function stretchEnt(e, rect, dx, dy) {
  const inside = (q) => q.x >= rect.x1 - 1e-9 && q.x <= rect.x2 + 1e-9 && q.y >= rect.y1 - 1e-9 && q.y <= rect.y2 + 1e-9;
  const mv = (q) => ({ x: q.x + dx, y: q.y + dy });
  if (e.type === 'pline') {
    let any = false;
    const pts = e.pts.map((q) => { if (inside(q)) { any = true; return mv(q); } return P(q); });
    return any ? { pts } : null;
  }
  if (e.type === 'circle') return inside({ x: e.cx, y: e.cy }) ? { cx: e.cx + dx, cy: e.cy + dy } : null;
  if (e.type === 'point' || e.type === 'text') return inside(e) ? { x: e.x + dx, y: e.y + dy } : null;
  if (e.type === 'dim') {
    const a = { x: e.x1, y: e.y1 }, b = { x: e.x2, y: e.y2 }, ia = inside(a), ib = inside(b);
    if (e.kind === 'ang') {   // burchak o'lchami: uch va yoy joyi ham
      const c = { x: e.cx, y: e.cy }, l = { x: e.lx, y: e.ly }, ic = inside(c), il = inside(l);
      if (!ia && !ib && !ic && !il) return null;
      const m = (q, f) => (f ? mv(q) : q), na = m(a, ia), nb = m(b, ib), nc = m(c, ic), nl = m(l, il);
      return { x1: na.x, y1: na.y, x2: nb.x, y2: nb.y, cx: nc.x, cy: nc.y, lx: nl.x, ly: nl.y };
    }
    if (!ia && !ib) return null;
    const na = ia ? mv(a) : a, nb = ib ? mv(b) : b;
    return { x1: na.x, y1: na.y, x2: nb.x, y2: nb.y };
  }
  if (e.type === 'arc') {
    const S = { x: e.cx + e.r * Math.cos(e.a0 * D2R), y: e.cy - e.r * Math.sin(e.a0 * D2R) };
    const En = { x: e.cx + e.r * Math.cos(e.a1 * D2R), y: e.cy - e.r * Math.sin(e.a1 * D2R) };
    const iS = inside(S), iE = inside(En);
    if (!iS && !iE) return null;
    if (iS && iE) return { cx: e.cx + dx, cy: e.cy + dy };
    // Bitta uchi — vatar balandligi (sagitta) saqlanadi (AutoCAD)
    const sw = arcSweep(e), mA = e.a0 + sw / 2;
    const M = { x: e.cx + e.r * Math.cos(mA * D2R), y: e.cy - e.r * Math.sin(mA * D2R) };
    const C0 = { x: (S.x + En.x) / 2, y: (S.y + En.y) / 2 };
    const ch = { x: En.x - S.x, y: En.y - S.y }, chL = Math.hypot(ch.x, ch.y) || 1;
    const nrm = { x: -ch.y / chL, y: ch.x / chL }, h = (M.x - C0.x) * nrm.x + (M.y - C0.y) * nrm.y;
    const S2 = iS ? mv(S) : S, E2 = iE ? mv(En) : En;
    const ch2 = { x: E2.x - S2.x, y: E2.y - S2.y }, L2 = Math.hypot(ch2.x, ch2.y);
    if (L2 < 1e-9) return null;
    const n2 = { x: -ch2.y / L2, y: ch2.x / L2 };
    const M2 = { x: (S2.x + E2.x) / 2 + n2.x * h, y: (S2.y + E2.y) / 2 + n2.y * h };
    const a = arcFrom3(S2, M2, E2);
    if (!a) return null;
    // yo'nalish saqlansin: boshi S2 da (a0) bo'lishi kerak
    return a.ccw ? { cx: a.cx, cy: a.cy, r: a.r, a0: a.a0, a1: a.a1 } : { cx: a.cx, cy: a.cy, r: a.r, a0: a.a0, a1: a.a1 };
  }
  return null;
}

/* ---------------- UZUNLIK (LENGTHEN) ---------------- */
export function entLength(e) {
  if (e.type === 'pline') return plinePath(e).L;
  if (e.type === 'arc') return e.r * arcSweep(e) * D2R;
  if (e.type === 'circle') return 2 * Math.PI * e.r;
  return 0;
}
// mode: 'delta' (mm, manfiy — qisqartirish) | 'percent' (%) | 'total' (mm). P — o'zgaradigan uchga yaqin nuqta.
export function lengthenEnt(e, Q, mode, val) {
  if (!e || !Number.isFinite(val)) return { reason: 'Qiymat kerak' };
  const L = entLength(e);
  let delta;
  if (mode === 'percent') { if (!(val > 0)) return { reason: "Foiz 0 dan katta bo'lsin" }; delta = L * (val / 100 - 1); }
  else if (mode === 'total') { if (!(val > 0)) return { reason: "Umumiy uzunlik 0 dan katta bo'lsin" }; delta = val - L; }
  else delta = val;
  if (e.type === 'pline') {
    if (e.closed && e.pts.length > 2) return { reason: "Yopiq kontur uzunligi o'zgartirilmaydi" };
    const p = [];   // ketma-ket takrorlangan tugunlar tashlanadi (nol uzunlikdagi segment yo'nalish bermaydi)
    for (const q of e.pts) if (!p.length || dist(p[p.length - 1], q) > 1e-9) p.push(P(q));
    const n = p.length;
    if (n < 2) return { reason: "Chiziq uzunligi nol" };
    const atEnd = dist(Q, p[n - 1]) <= dist(Q, p[0]);
    const A = atEnd ? p[n - 2] : p[1], B = atEnd ? p[n - 1] : p[0];
    const l = dist(A, B), nl = l + delta;
    if (!(nl > 1e-6)) return { reason: "Juda qisqa — oxirgi segmentdan uzunroq qisqartirib bo'lmaydi" };
    const u = { x: (B.x - A.x) / l, y: (B.y - A.y) / l };
    const NB = { x: A.x + u.x * nl, y: A.y + u.y * nl };
    p[atEnd ? n - 1 : 0] = NB;
    return { patch: { pts: p }, end: atEnd ? 'end' : 'start', delta };
  }
  if (e.type === 'arc') {
    const sw = arcSweep(e), dA = delta / e.r * R2D, nsw = sw + dA;
    if (!(nsw > 1e-6) || nsw >= 360 - 1e-6) return { reason: "Yoy burchagi 0° dan katta va 360° dan kichik bo'lishi kerak" };
    const Sx = { x: e.cx + e.r * Math.cos(e.a0 * D2R), y: e.cy - e.r * Math.sin(e.a0 * D2R) };
    const Ex = { x: e.cx + e.r * Math.cos(e.a1 * D2R), y: e.cy - e.r * Math.sin(e.a1 * D2R) };
    const atEnd = dist(Q, Ex) <= dist(Q, Sx);
    return atEnd ? { patch: { a1: norm360(e.a1 + dA) }, end: 'end', delta } : { patch: { a0: norm360(e.a0 - dA) }, end: 'start', delta };
  }
  return { reason: "Faqat ochiq chiziq va yoy uzunligi o'zgartiriladi" };
}

/* ---------------- KO'PBURCHAK (POLYGON) ---------------- */
// mode 'in' — aylanaga ichki chizilgan (uch nuqtalar aylanada, ang — 1-uch yo'nalishi);
// 'out' — tashqi (tomon o'rtalari aylanada, ang — 1-tomon o'rtasi yo'nalishi)
export function polygonPts(c, n, R, mode, ang) {
  n = Math.max(3, Math.min(1024, Math.round(n)));
  const Rv = mode === 'out' ? R / Math.cos(Math.PI / n) : R;
  const start = mode === 'out' ? ang + 180 / n : ang;
  const out = [];
  for (let k = 0; k < n; k++) { const v = dirVec(start + k * 360 / n); out.push({ x: c.x + v.dx * Rv, y: c.y + v.dy * Rv }); }
  return out;
}
// Tomon bo'yicha: p1 → p2 birinchi tomon, ko'pburchak chap tomonda (ekranda soat miliga qarshi)
export function polygonEdge(p1, p2, n) {
  n = Math.max(3, Math.min(1024, Math.round(n)));
  const s = dist(p1, p2); if (s < 1e-9) return null;
  const R = s / (2 * Math.sin(Math.PI / n)), ap = s / (2 * Math.tan(Math.PI / n));
  const nv = dirVec(vecAng(p2.x - p1.x, p2.y - p1.y) + 90);
  const c = { x: (p1.x + p2.x) / 2 + nv.dx * ap, y: (p1.y + p2.y) / 2 + nv.dy * ap };
  const a1 = vecAng(p1.x - c.x, p1.y - c.y), out = [];
  for (let k = 0; k < n; k++) { const v = dirVec(a1 + k * 360 / n); out.push({ x: c.x + v.dx * R, y: c.y + v.dy * R }); }
  return out;
}

/* ---------------- BO'LISH / O'LCHAB QO'YISH (DIVIDE / MEASURE) ---------------- */
function pointAtLen(e, s) {
  if (e.type === 'pline') return pathPoint(plinePath(e), s);
  if (e.type === 'arc') { const a = e.a0 + s / e.r * R2D; return { x: e.cx + e.r * Math.cos(a * D2R), y: e.cy - e.r * Math.sin(a * D2R) }; }
  if (e.type === 'circle') { const a = s / e.r * R2D; return { x: e.cx + e.r * Math.cos(a * D2R), y: e.cy - e.r * Math.sin(a * D2R) }; }
  return null;
}
const isClosedEnt = (e) => e.type === 'circle' || (e.type === 'pline' && e.closed && e.pts.length > 2);
// n teng bo'lak: ochiq — n−1 nuqta; yopiq (aylana, yopiq polyline) — n nuqta (boshidan)
export function divideEnt(e, n) {
  n = Math.round(n);
  if (!(n >= 2 && n <= 32767)) return { reason: "Bo'laklar soni 2 dan 32767 gacha" };
  const L = entLength(e); if (!(L > 0)) return { reason: "Faqat chiziq, yoy va aylana bo'linadi" };
  const pts = [], closed = isClosedEnt(e);
  for (let k = closed ? 0 : 1; k < n; k++) pts.push(pointAtLen(e, L * k / n));
  return { pts };
}
// Har len masofada: ochiq obyektda Q ga yaqin uchidan boshlab
export function measureEnt(e, len, Q) {
  if (!(len > 0)) return { reason: "Masofa 0 dan katta bo'lsin" };
  const L = entLength(e); if (!(L > 0)) return { reason: "Faqat chiziq, yoy va aylana o'lchanadi" };
  let fromEnd = false;
  if (!isClosedEnt(e) && Q) {
    const s0 = pointAtLen(e, 0), s1 = pointAtLen(e, L);
    fromEnd = dist(Q, s1) < dist(Q, s0);
  }
  const pts = [];
  for (let s = len; s < L - 1e-9 && pts.length < 32767; s += len) pts.push(pointAtLen(e, fromEnd ? L - s : s));
  return { pts };
}

/* ---------------- YUZA (AREA) ---------------- */
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}
export function polyPerim(pts, closed = true) {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) s += dist(pts[i], pts[i + 1]);
  if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0]);
  return s;
}
// Yopiq zanjir (chainOffset bo'laklari: seg / arc) — yuzasi (yoylar 0.5° qadam bilan) va perimetri (aniq)
export function chainArea(pieces) {
  const pts = []; let per = 0;
  for (const p of pieces) {
    if (p.kind === 'seg') { pts.push(P(p.a)); per += dist(p.a, p.b); continue; }
    const sw = p.ccw ? norm360(p.ea - p.sa) : norm360(p.sa - p.ea), n = Math.max(2, Math.ceil(sw / 0.5));
    per += p.r * sw * D2R;
    for (let k = 0; k < n; k++) { const a = p.sa + (p.ccw ? 1 : -1) * sw * k / n; pts.push({ x: p.cx + p.r * Math.cos(a * D2R), y: p.cy - p.r * Math.sin(a * D2R) }); }
  }
  return { area: polyArea(pts), perim: per };
}
export function areaOfEnt(e) {
  if (e.type === 'circle') return { area: Math.PI * e.r * e.r, perim: 2 * Math.PI * e.r };
  if (e.type === 'pline' && e.closed && e.pts.length > 2) return { area: polyArea(e.pts), perim: polyPerim(e.pts, true) };
  return null;
}
