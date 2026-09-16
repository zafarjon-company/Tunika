// ============================================================
//  KESISH (TRIM) va UZAYTIRISH (EXTEND) — AutoCAD «tez rejim» mantiqi
// ------------------------------------------------------------
//  Sof geometriya, DOM yo'q (testlar: npm run test:trim).
//  Chegara (kesuvchi / uzaytirish chegarasi) alohida tanlanmaydi — chizmadagi
//  BARCHA boshqa elementlar (chiziq segmentlari, yoylar, aylanalar; polyline'ning
//  boshqa segmentlari ham) chegara hisoblanadi (AutoCAD 2021+ Quick mode).
//  Konvensiya: world mm, x o'ngga, y PASTGA; burchak 0° o'ng, 90° tepa, CCW musbat.
//
//  trimAt(ents, target, w, segIdx) — bosilgan nuqta (w) turgan bo'lak eng yaqin
//    kesishmalar orasida olib tashlanadi (kesishma bo'lmagan tomonda — uchigacha):
//    ochiq polyline → 0..2 ta polyline; yopiq polyline → bitta ochiq polyline
//    (kesilgan joydan boshlanib halqa bo'ylab); yoy → 0..2 yoy; aylana (≥ 2
//    kesishma) → yoy. Natija { remove:[id], add:[element xossalari], removed:
//    olib tashlangan bo'lak (jonli ko'rinish uchun) } yoki { reason } / null.
//  extendAt(ents, target, w) — bosilgan nuqtaga yaqin uch eng yaqin chegaragacha
//    cho'ziladi: chiziq/ochiq polyline — oxirgi segment yo'nalishida nur; yoy —
//    aylanasi bo'ylab. Natija { id, patch } yoki { reason } / null.
// ============================================================
import { lineLineInt, segCircleInts, circleCircleInts, norm360, vecAng } from './osnap.js';
import { angInArc, arcSweep, arcStart, arcEnd } from './arcGeom.js';
import { distToSeg } from './offsetGeom.js';

const EPS = 1e-7;
const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);

// Chegara bo'laklari: { segs:[{a,b}], circs:[{c,r,a0?,a1?}] } — skipId elementi tashqari
function cutters(ents, skipId) {
  const segs = [], circs = [];
  for (const e of ents || []) {
    if (!e || e.id === skipId) continue;
    if (e.type === 'pline') {
      const p = Array.isArray(e.pts) ? e.pts : [];
      for (let i = 0; i + 1 < p.length; i++) segs.push({ a: p[i], b: p[i + 1] });
      if (e.closed && p.length > 2) segs.push({ a: p[p.length - 1], b: p[0] });
    } else if (e.type === 'arc') circs.push({ c: { x: e.cx, y: e.cy }, r: e.r, a0: e.a0, a1: e.a1 });
    else if (e.type === 'circle') circs.push({ c: { x: e.cx, y: e.cy }, r: e.r });
  }
  return { segs, circs };
}
const inArcC = (c, p) => c.a0 == null || angInArc({ cx: c.c.x, cy: c.c.y, r: c.r, a0: c.a0, a1: c.a1 }, vecAng(p.x - c.c.x, p.y - c.c.y));
function plineSegsOf(e) {
  const s = [], p = e.pts;
  for (let i = 0; i + 1 < p.length; i++) s.push({ a: p[i], b: p[i + 1], i });
  if (e.closed && p.length > 2) s.push({ a: p[p.length - 1], b: p[0], i: p.length - 1 });
  return s;
}
// Segment (a→b) ustidagi chegara kesishmalari — t ∈ (0,1), tartiblangan
function segParams(a, b, cut) {
  const out = [];
  const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2; if (L2 < 1e-18) return out;
  const tOf = (p) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2;
  for (const s of cut.segs) {
    const r = lineLineInt(a, b, s.a, s.b);
    if (r && r.u >= -EPS && r.u <= 1 + EPS && r.t > EPS && r.t < 1 - EPS) out.push(r.t);
  }
  for (const c of cut.circs) for (const p of segCircleInts(a, b, c.c, c.r)) {
    if (!inArcC(c, p)) continue;
    const t = tOf(p); if (t > EPS && t < 1 - EPS) out.push(t);
  }
  return out.sort((x, y) => x - y);
}
// Aylana (c, r) ustidagi chegara kesishmalari: range berilsa — a0 dan CCW siljish (0..sweep ichida), aks holda mutlaq burchak
function circleAngles(c, r, cut, range) {
  const out = [];
  const push = (p) => {
    const th = vecAng(p.x - c.x, p.y - c.y);
    if (range) { const d = norm360(th - range.a0); if (d > 1e-6 && d < range.sweep - 1e-6) out.push(d); }
    else out.push(th);
  };
  for (const s of cut.segs) for (const p of segCircleInts(s.a, s.b, c, r)) push(p);
  for (const k of cut.circs) for (const p of circleCircleInts(c, r, k.c, k.r)) if (inArcC(k, p)) push(p);
  return out.sort((x, y) => x - y);
}
const dedup = (pts) => pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-9);

/* ---------------- KESISH ---------------- */
export function trimAt(ents, target, w, segIdx) {
  if (!target || !w) return null;
  const cut = cutters(ents, target.id);
  if (target.type === 'pline') {
    const segs = plineSegsOf(target); if (!segs.length) return null;
    let s = segs.find((x) => x.i === segIdx);
    if (!s) { let bd = Infinity; for (const o of segs) { const d = distToSeg(w.x, w.y, o.a.x, o.a.y, o.b.x, o.b.y); if (d < bd) { bd = d; s = o; } } }
    for (const o of segs) if (o.i !== s.i) cut.segs.push({ a: o.a, b: o.b });   // polyline'ning boshqa segmentlari ham chegara
    const ts = segParams(s.a, s.b, cut);
    if (!ts.length) return { reason: "Kesuvchi chegara yo'q — bu segment boshqa element bilan kesishmaydi" };
    const L2 = (s.b.x - s.a.x) ** 2 + (s.b.y - s.a.y) ** 2;
    const tc = Math.max(0, Math.min(1, ((w.x - s.a.x) * (s.b.x - s.a.x) + (w.y - s.a.y) * (s.b.y - s.a.y)) / L2));
    let lo = 0, hi = 1;
    for (const t of ts) { if (t <= tc) lo = t; else { hi = t; break; } }
    if (hi - lo < EPS) return null;
    const lerp = (t) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
    const n = target.pts.length, closed = !!target.closed && n > 2, i = s.i, add = [];
    if (!closed) {
      const A = target.pts.slice(0, i + 1).map((p) => ({ x: p.x, y: p.y })); if (lo > EPS) A.push(lerp(lo));
      const B = (hi < 1 - EPS ? [lerp(hi)] : []).concat(target.pts.slice(i + 1).map((p) => ({ x: p.x, y: p.y })));
      if (dedup(A).length >= 2) add.push({ type: 'pline', pts: dedup(A), closed: false });
      if (dedup(B).length >= 2) add.push({ type: 'pline', pts: dedup(B), closed: false });
    } else {
      // yopiq: bitta ochiq polyline — kesilgan joyning hi tomonidan boshlanib halqa bo'ylab lo tomonigacha
      const pts = [];
      if (hi < 1 - EPS) pts.push(lerp(hi));
      for (let k = 1; k <= n; k++) { const p = target.pts[(i + k) % n]; pts.push({ x: p.x, y: p.y }); }
      if (lo > EPS) pts.push(lerp(lo));
      if (dedup(pts).length >= 2) add.push({ type: 'pline', pts: dedup(pts), closed: false });
    }
    return { remove: [target.id], add, removed: { type: 'pline', pts: [lerp(lo), lerp(hi)], closed: false } };
  }
  const c = { x: target.cx, y: target.cy };
  if (target.type === 'arc') {
    const sw = arcSweep(target);
    const ds = circleAngles(c, target.r, cut, { a0: target.a0, sweep: sw });
    if (!ds.length) return { reason: "Kesuvchi chegara yo'q — yoy boshqa element bilan kesishmaydi" };
    const dc = Math.min(sw, norm360(vecAng(w.x - c.x, w.y - c.y) - target.a0));
    let lo = 0, hi = sw;
    for (const d of ds) { if (d <= dc) lo = d; else { hi = d; break; } }
    const add = [];
    if (lo > 1e-6) add.push({ type: 'arc', cx: c.x, cy: c.y, r: target.r, a0: target.a0, a1: norm360(target.a0 + lo) });
    if (hi < sw - 1e-6) add.push({ type: 'arc', cx: c.x, cy: c.y, r: target.r, a0: norm360(target.a0 + hi), a1: target.a1 });
    return { remove: [target.id], add, removed: { type: 'arc', cx: c.x, cy: c.y, r: target.r, a0: norm360(target.a0 + lo), a1: norm360(target.a0 + hi) } };
  }
  if (target.type === 'circle') {
    const ths = circleAngles(c, target.r, cut, null);
    const uniq = ths.filter((t, i) => i === 0 || t - ths[i - 1] > 1e-6);
    if (uniq.length < 2) return { reason: 'Aylanani kesish uchun kamida 2 ta kesishma kerak' };
    const thc = vecAng(w.x - c.x, w.y - c.y);
    let lo = null, hi = null;
    for (const t of uniq) { if (t <= thc) lo = t; else if (hi == null) hi = t; }
    if (lo == null) lo = uniq[uniq.length - 1];
    if (hi == null) hi = uniq[0];
    return { remove: [target.id], add: [{ type: 'arc', cx: c.x, cy: c.y, r: target.r, a0: hi, a1: lo }], removed: { type: 'arc', cx: c.x, cy: c.y, r: target.r, a0: lo, a1: hi } };
  }
  return { reason: 'Faqat chiziq, yoy va aylana kesiladi' };
}

/* ---------------- UZAYTIRISH ---------------- */
export function extendAt(ents, target, w) {
  if (!target || !w) return null;
  const cut = cutters(ents, target.id);
  if (target.type === 'pline') {
    const p = target.pts, n = p.length;
    if (n < 2) return null;
    if (target.closed && n > 2) return { reason: "Yopiq kontur uzaytirilmaydi" };
    const atEnd = dist(w, p[n - 1]) <= dist(w, p[0]);
    const P = atEnd ? p[n - 1] : p[0], Q = atEnd ? p[n - 2] : p[1];
    const dx = P.x - Q.x, dy = P.y - Q.y, L = Math.hypot(dx, dy); if (L < EPS) return null;
    const d = { x: dx / L, y: dy / L };
    const FAR = 1e6, far = { x: P.x + d.x * FAR, y: P.y + d.y * FAR };
    let best = null;
    for (const s of cut.segs) {
      const r = lineLineInt(P, far, s.a, s.b);
      if (r && r.u >= -EPS && r.u <= 1 + EPS) { const t = r.t * FAR; if (t > 1e-6 && (best == null || t < best)) best = t; }
    }
    for (const c of cut.circs) for (const q of segCircleInts(P, far, c.c, c.r)) {
      if (!inArcC(c, q)) continue;
      const t = (q.x - P.x) * d.x + (q.y - P.y) * d.y;
      if (t > 1e-6 && (best == null || t < best)) best = t;
    }
    if (best == null) return { reason: "Uzaytirish chegarasi yo'q — yo'nalishida boshqa element yo'q" };
    const pts = p.map((q) => ({ x: q.x, y: q.y }));
    pts[atEnd ? n - 1 : 0] = { x: P.x + d.x * best, y: P.y + d.y * best };
    return { id: target.id, patch: { pts }, end: atEnd ? 'end' : 'start' };
  }
  if (target.type === 'arc') {
    const c = { x: target.cx, y: target.cy }, sw = arcSweep(target);
    const atEnd = dist(w, arcEnd(target)) <= dist(w, arcStart(target));
    const ths = circleAngles(c, target.r, cut, null);
    let best = null;
    for (const th of ths) {
      const dd = atEnd ? norm360(th - target.a1) : norm360(target.a0 - th);
      if (dd > 1e-6 && dd < 360 - sw - 1e-6 && (best == null || dd < best)) best = dd;
    }
    if (best == null) return { reason: "Uzaytirish chegarasi yo'q — yoy davomida boshqa element yo'q" };
    return { id: target.id, patch: atEnd ? { a1: norm360(target.a1 + best) } : { a0: norm360(target.a0 - best) }, end: atEnd ? 'end' : 'start' };
  }
  return { reason: 'Faqat chiziq va yoy uzaytiriladi' };
}
