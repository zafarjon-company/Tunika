// ============================================================
//  O'ZGARTIRISH GEOMETRIYASI — AutoCAD: FILLET (Tutashtirish), CHAMFER (Faska),
//  EXPLODE (Portlatish), JOIN (Birlashtirish)
// ------------------------------------------------------------
//  Sof geometriya, DOM yo'q (testlar: npm run test:modify).
//  Konvensiya: world mm, x o'ngga, y PASTGA; burchak 0° o'ng, 90° tepa, CCW musbat.
//  Elementlar: { type:'pline', pts, closed } | { type:'arc', cx, cy, r, a0, a1 } (a0→a1 CCW)
//              | { type:'circle', cx, cy, r }.
//
//  «Egri» (curve) — tanlangan element bo'lagi: polyline segmenti (to'g'ri chiziq, cheksiz
//  davomi bilan) yoki aylana/yoy (aylanasi). Bosilgan nuqta (P) qaysi qism SAQLANISHINI
//  bildiradi (AutoCAD'dagidek):
//  - filletCurves(c1, P1, c2, P2, R): ikkala egriga urinma, radiusi R yoy. Markaz —
//    siljitilgan egrilar (chiziq ±R, aylana r±R) kesishmasida; to'g'ri nomzod — urinma
//    nuqtalari saqlanadigan qismlarda bo'lgan va yoy yo'nalishi ikkala uchda uzluksiz
//    (tangens) bo'lgani. R = 0 — burchakka tutashtirish (kesish/uzaytirish). Parallel
//    chiziqlar — yarim aylana (AutoCAD). Natija: { t1, t2, trim1, trim2, arc }.
//  - chamferLines(c1, P1, c2, P2, d1, d2): burchakdan d1 / d2 masofada kesuvchi chiziq.
//  - replaceSegEnd(pline, seg, 'a'|'b', T): segment uchini T ga ko'chirish; uch ichki
//    tugun bo'lsa polyline shu joyda ajraladi (yopiq — ochiladi).
//  - cornerOp(pline, v, Tprev, Tnext, kind): bir polyline'ning qo'shni segmentlari burchagi.
//  - filletPlineAll / chamferPlineAll: polyline'ning barcha burchaklari (AutoCAD «Polyline»).
//  - explodeEnt: polyline → alohida chiziqlar. joinEnts: uchlari tutashgan polyline'lar →
//    bitta polyline; bir aylanadagi tutash yoylar → bitta yoy (to'liq bo'lsa — aylana).
// ============================================================
import { norm360, dirVec, vecAng, lineLineInt, circleCircleInts } from './osnap.js';
import { arcSweep } from './arcGeom.js';
import { buildChains } from './chainOffset.js';

const EPS = 1e-9;
const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (u, v) => u.x * v.x + u.y * v.y;
const unit = (v) => { const L = Math.hypot(v.x, v.y) || 1; return { x: v.x / L, y: v.y / L }; };
const P = (p) => ({ x: p.x, y: p.y });

/* ---------------- EGRILAR ---------------- */
export function curveOf(ent, seg) {
  if (!ent) return null;
  if (ent.type === 'pline') {
    const p = Array.isArray(ent.pts) ? ent.pts : [], n = p.length;
    if (n < 2) return null;
    const closed = !!ent.closed && n > 2;
    const i = Number.isInteger(seg) && seg >= 0 ? seg : 0;
    if (i + 1 < n) return { kind: 'line', a: p[i], b: p[i + 1], seg: i };
    if (closed && i === n - 1) return { kind: 'line', a: p[n - 1], b: p[0], seg: i };
    return null;
  }
  if (ent.type === 'arc') return { kind: 'circ', c: { x: ent.cx, y: ent.cy }, r: ent.r, arc: { a0: ent.a0, a1: ent.a1 } };
  if (ent.type === 'circle') return { kind: 'circ', c: { x: ent.cx, y: ent.cy }, r: ent.r, arc: null };
  return null;
}
// Nuqtaning egridagi eng yaqin (perpendikulyar) nuqtasi — cheksiz chiziq / to'liq aylana
function foot(cv, p) {
  if (cv.kind === 'line') {
    const d = sub(cv.b, cv.a), L2 = dot(d, d); if (L2 < EPS) return null;
    const t = dot(sub(p, cv.a), d) / L2;
    return { x: cv.a.x + d.x * t, y: cv.a.y + d.y * t };
  }
  const v = sub(p, cv.c), L = Math.hypot(v.x, v.y); if (L < EPS) return null;
  return { x: cv.c.x + v.x / L * cv.r, y: cv.c.y + v.y / L * cv.r };
}
function offsets(cv, R) {
  if (cv.kind === 'line') {
    const u = unit(sub(cv.b, cv.a)), n = { x: -u.y, y: u.x };
    return [1, -1].map((s) => ({ kind: 'line', a: { x: cv.a.x + n.x * R * s, y: cv.a.y + n.y * R * s }, b: { x: cv.b.x + n.x * R * s, y: cv.b.y + n.y * R * s } }));
  }
  const out = [{ kind: 'circ', c: cv.c, r: cv.r + R }];
  if (cv.r - R > EPS) out.push({ kind: 'circ', c: cv.c, r: cv.r - R });
  return out;
}
function lineCircle(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y, fx = a.x - c.x, fy = a.y - c.y;
  const A = dx * dx + dy * dy; if (A < 1e-18) return [];
  const B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  let disc = B * B - 4 * A * C;
  const tol = 1e-9 * Math.max(1, A) * Math.max(1, Math.abs(C));
  if (disc < -tol) return [];
  if (disc <= tol) { const t = -B / (2 * A); return [{ x: a.x + t * dx, y: a.y + t * dy }]; }
  disc = Math.sqrt(disc);
  return [(-B - disc) / (2 * A), (-B + disc) / (2 * A)].map((t) => ({ x: a.x + t * dx, y: a.y + t * dy }));
}
function inters(o1, o2) {
  if (o1.kind === 'line' && o2.kind === 'line') { const p = lineLineInt(o1.a, o1.b, o2.a, o2.b); return p ? [{ x: p.x, y: p.y }] : []; }
  if (o1.kind === 'line') return lineCircle(o1.a, o1.b, o2.c, o2.r);
  if (o2.kind === 'line') return lineCircle(o2.a, o2.b, o1.c, o1.r);
  return circleCircleInts(o1.c, o1.r, o2.c, o2.r);
}
// Yoyda burchakning a0 dan siljishi (yoy tashqarisida bo'lsa — yaqin uchiga)
function arcPos(arc, th) {
  const sw = arcSweep({ a0: arc.a0, a1: arc.a1 });
  let d = norm360(th - arc.a0);
  if (d > sw + 1e-9) d = (d - sw) < (360 - d) ? sw : 0;
  return { d, sw };
}
function arcPosRaw(arc, th) { return { d: norm360(th - arc.a0), sw: arcSweep({ a0: arc.a0, a1: arc.a1 }) }; }

// T nuqtadan egrining SAQLANADIGAN qismiga yo'nalish (birlik vektor): P shu qismda
function keptDir(cv, T, Pk) {
  if (cv.kind === 'line') { const u = unit(sub(cv.b, cv.a)); return dot(sub(Pk, T), u) >= 0 ? u : { x: -u.x, y: -u.y }; }
  const thT = vecAng(T.x - cv.c.x, T.y - cv.c.y), thP = vecAng(Pk.x - cv.c.x, Pk.y - cv.c.y);
  const t = dirVec(thT + 90), ccw = { x: t.dx, y: t.dy };
  let goCCW;
  if (cv.arc) {
    const { d: dT, sw } = arcPosRaw(cv.arc, thT), { d: dP } = arcPos(cv.arc, thP);
    if (dT <= sw + 1e-9) goCCW = !(dP < dT);
    else goCCW = !((dT - sw) < (360 - dT));
  } else goCCW = norm360(thP - thT) <= 180;
  return goCCW ? ccw : { x: -ccw.x, y: -ccw.y };
}
// Chiziq: kdir yo'nalishidagi qism saqlanadi → almashtiriladigan uch ('a' | 'b').
// Yoy: yangi burchaklar. Aylana: o'zgarmaydi.
function trimOf(cv, T, kdir, Pk) {
  if (cv.kind === 'line') return { end: dot(kdir, sub(cv.b, cv.a)) >= 0 ? 'a' : 'b' };
  if (!cv.arc) return { keep: true };
  const thT = vecAng(T.x - cv.c.x, T.y - cv.c.y), thP = vecAng(Pk.x - cv.c.x, Pk.y - cv.c.y);
  const { d: dT, sw } = arcPosRaw(cv.arc, thT), { d: dP } = arcPos(cv.arc, thP);
  let a0 = cv.arc.a0, a1 = cv.arc.a1;
  if (dT <= sw + 1e-9) { if (dP < dT) a1 = thT; else a0 = thT; }
  else if ((dT - sw) < (360 - dT)) a1 = thT; else a0 = thT;
  return { arc: { a0: norm360(a0), a1: norm360(a1) } };
}
// Urinma yoy (markaz C, T1 → T2) yo'nalishi: T1 da saqlangan qismdan kelib, T2 da saqlangan qismga ketadi
function tangentArc(C, R, T1, T2, d1, d2) {
  const th1 = vecAng(T1.x - C.x, T1.y - C.y), th2 = vecAng(T2.x - C.x, T2.y - C.y);
  const c1 = dirVec(th1 + 90), c2 = dirVec(th2 + 90);
  const s1 = -(c1.dx * d1.x + c1.dy * d1.y), s2 = c2.dx * d2.x + c2.dy * d2.y;   // > 0 — CCW harakat
  const ok = s1 * s2 > 1e-12;
  const ccw = s1 + s2 > 0;
  return { ok, arc: { cx: C.x, cy: C.y, r: R, a0: norm360(ccw ? th1 : th2), a1: norm360(ccw ? th2 : th1) } };
}

/* ---------------- FILLET ---------------- */
// Chiziq: X dan k yo'nalishida saqlanadigan qismning uzunligi (segmentning uzoq uchigacha)
function keptLen(cv, X, k) { return Math.max(dot(sub(cv.a, X), k), dot(sub(cv.b, X), k)); }
export function filletCurves(c1, P1, c2, P2, R) {
  if (!c1 || !c2 || !P1 || !P2) return { reason: 'Ikki obyekt tanlang (chiziq, yoy yoki aylana)' };
  R = Number.isFinite(R) && R > 0 ? R : 0;
  if (c1.kind === 'line' && c2.kind === 'line') {
    const u1 = unit(sub(c1.b, c1.a)), u2 = unit(sub(c2.b, c2.a));
    const cr = u1.x * u2.y - u1.y * u2.x;
    if (Math.abs(cr) < 1e-9) {
      const n = { x: -u1.y, y: u1.x }, gap = dot(sub(c2.a, c1.a), n);
      if (Math.abs(gap) < 1e-6) return { reason: "Chiziqlar bir to'g'ri chiziqda yotadi" };
      return filletParallel(c1, P1, c2, P2);
    }
    // Burchak X; saqlanadigan nurlar — X dan bosilgan nuqtalar tomoniga (AutoCAD)
    const X = lineLineInt(c1.a, c1.b, c2.a, c2.b);
    const k1 = dot(sub(P1, X), u1) >= 0 ? u1 : { x: -u1.x, y: -u1.y };
    const k2 = dot(sub(P2, X), u2) >= 0 ? u2 : { x: -u2.x, y: -u2.y };
    if (R < 1e-9) { const T = { x: X.x, y: X.y }; return { t1: T, t2: T, trim1: trimOf(c1, T, k1, P1), trim2: trimOf(c2, T, k2, P2), arc: null }; }
    const cosT = Math.max(-1, Math.min(1, dot(k1, k2))), th = Math.acos(cosT);   // nurlar orasidagi burchak
    if (th < 1e-6) return { reason: "Chiziqlar ustma-ust" };
    const tl = R / Math.tan(th / 2);
    if (tl > keptLen(c1, X, k1) + 1e-6 || tl > keptLen(c2, X, k2) + 1e-6) return { reason: 'Radius juda katta — segment uzunligidan oshib ketadi' };
    const T1 = { x: X.x + k1.x * tl, y: X.y + k1.y * tl }, T2 = { x: X.x + k2.x * tl, y: X.y + k2.y * tl };
    const bis = unit({ x: k1.x + k2.x, y: k1.y + k2.y }), h = R / Math.sin(th / 2);
    const C = { x: X.x + bis.x * h, y: X.y + bis.y * h };
    const ta = tangentArc(C, R, T1, T2, k1, k2);
    return { t1: T1, t2: T2, trim1: trimOf(c1, T1, k1, P1), trim2: trimOf(c2, T2, k2, P2), arc: ta.arc };
  }
  // Umumiy holat (yoy / aylana ishtirokida)
  if (R < 1e-9) {
    let best = null;
    for (const T of inters(c1, c2)) { const s = dist(T, P1) + dist(T, P2); if (!best || s < best.s) best = { T, s }; }
    if (!best) return { reason: "Obyektlar kesishmaydi — radius 0 bilan tutashtirib bo'lmaydi" };
    const T = best.T;
    return { t1: T, t2: T, trim1: trimOf(c1, T, keptDir(c1, T, P1), P1), trim2: trimOf(c2, T, keptDir(c2, T, P2), P2), arc: null };
  }
  let best = null;
  for (const o1 of offsets(c1, R)) for (const o2 of offsets(c2, R)) for (const C of inters(o1, o2)) {
    const T1 = foot(c1, C), T2 = foot(c2, C); if (!T1 || !T2) continue;
    if (Math.abs(dist(C, T1) - R) > 1e-6 || Math.abs(dist(C, T2) - R) > 1e-6 || dist(T1, T2) < 1e-9) continue;
    const d1 = keptDir(c1, T1, P1), d2 = keptDir(c2, T2, P2);
    const ta = tangentArc(C, R, T1, T2, d1, d2);
    const score = dist(T1, P1) + dist(T2, P2) + (ta.ok ? 0 : 1e12);
    if (!best || score < best.score) best = { score, T1, T2, d1, d2, ta };
  }
  if (!best || !best.ta.ok) return { reason: "Tutashtirib bo'lmadi — radius juda katta yoki obyektlar mos emas" };
  return { t1: best.T1, t2: best.T2, trim1: trimOf(c1, best.T1, best.d1, P1), trim2: trimOf(c2, best.T2, best.d2, P2), arc: best.ta.arc };
}
// Parallel chiziqlar: yarim aylana 1-chiziqning bosilgan joyga yaqin uchida (AutoCAD)
function filletParallel(c1, P1, c2) {
  const atA = dist(c1.a, P1) <= dist(c1.b, P1);
  const T1 = P(atA ? c1.a : c1.b), other = atA ? c1.b : c1.a;
  const w = unit(sub(other, T1));
  const T2 = foot(c2, T1);
  const C = { x: (T1.x + T2.x) / 2, y: (T1.y + T2.y) / 2 }, R = dist(T1, T2) / 2;
  const ta = tangentArc(C, R, T1, T2, w, w);
  return { t1: T1, t2: T2, trim1: { end: atA ? 'a' : 'b' }, trim2: trimOf(c2, T2, w, T2), arc: ta.arc };
}

/* ---------------- CHAMFER ---------------- */
export function chamferLines(c1, P1, c2, P2, d1, d2) {
  if (!c1 || !c2 || c1.kind !== 'line' || c2.kind !== 'line') return { reason: 'Faska faqat chiziqlar (segmentlar) orasida' };
  const u1 = unit(sub(c1.b, c1.a)), u2 = unit(sub(c2.b, c2.a));
  if (Math.abs(u1.x * u2.y - u1.y * u2.x) < 1e-9) return { reason: 'Parallel chiziqlarga faska qilib bo\'lmaydi' };
  const X = lineLineInt(c1.a, c1.b, c2.a, c2.b);
  const k1 = dot(sub(P1, X), u1) >= 0 ? u1 : { x: -u1.x, y: -u1.y };
  const k2 = dot(sub(P2, X), u2) >= 0 ? u2 : { x: -u2.x, y: -u2.y };
  d1 = Math.max(0, Number(d1) || 0); d2 = Math.max(0, Number(d2) || 0);
  if (d1 > keptLen(c1, X, k1) + 1e-6 || d2 > keptLen(c2, X, k2) + 1e-6) return { reason: 'Masofa juda katta — segment uzunligidan oshib ketadi' };
  const T1 = { x: X.x + k1.x * d1, y: X.y + k1.y * d1 }, T2 = { x: X.x + k2.x * d2, y: X.y + k2.y * d2 };
  return { t1: T1, t2: T2, trim1: trimOf(c1, T1, k1, P1), trim2: trimOf(c2, T2, k2, P2), seg: dist(T1, T2) > 1e-9 ? { a: T1, b: T2 } : null };
}

/* ---------------- POLYLINE OPERATSIYALARI ---------------- */
function mkPl(pts, closed) {
  const out = [];
  for (const q of pts) if (!out.length || dist(out[out.length - 1], q) > 1e-9) out.push(P(q));
  if (closed && out.length > 2 && dist(out[0], out[out.length - 1]) < 1e-9) out.pop();
  if (out.length < 2) return null;
  return { type: 'pline', pts: out, closed: !!closed && out.length > 2 };
}
// seg segmentining 'a' (boshi) yoki 'b' (oxiri) uchini T ga ko'chirish → yangi polyline(lar)
export function replaceSegEnd(ent, seg, which, T) {
  const p = ent.pts.map(P), n = p.length, closed = !!ent.closed && n > 2, Tn = P(T);
  const res = [];
  const push = (pts, c) => { const m = mkPl(pts, c); if (m) res.push(m); };
  if (!closed) {
    if (which === 'b') {
      const v = seg + 1;
      if (v === n - 1) { p[v] = Tn; push(p, false); } else { push(p.slice(0, seg + 1).concat([Tn]), false); push(p.slice(seg + 1), false); }
    } else if (seg === 0) { p[0] = Tn; push(p, false); } else { push(p.slice(0, seg + 1), false); push([Tn].concat(p.slice(seg + 1)), false); }
    return res;
  }
  if (which === 'b') { const j = (seg + 1) % n, ring = []; for (let k = 0; k < n; k++) ring.push(p[(j + k) % n]); push(ring.concat([Tn]), false); }
  else { const ring = [Tn]; for (let k = 1; k <= n; k++) ring.push(p[(seg + k) % n]); push(ring, false); }
  return res;
}
// Bir polyline'ning ikki segmenti qo'shnimi → { v (umumiy tugun), prev, next } yoki null
export function adjacentSegs(ent, i, j) {
  const n = ent.pts.length, closed = !!ent.closed && n > 2;
  const nx = (k) => (closed ? (k + 1) % n : k + 1);
  if (i === j) return null;
  if (nx(i) === j && (closed || j < n - 1)) return { v: j, prev: i, next: j };
  if (nx(j) === i && (closed || i < n - 1)) return { v: i, prev: j, next: i };
  return null;
}
// v burchak: oldingi segment oxiri → Tprev, keyingisi boshi → Tnext.
// 'fillet' — polyline ajraladi (orasiga yoy qo'yiladi), 'chamfer' — bitta polyline qoladi.
export function cornerOp(ent, v, Tprev, Tnext, kind) {
  const p = ent.pts.map(P), n = p.length, closed = !!ent.closed && n > 2, res = [];
  const push = (pts, c) => { const m = mkPl(pts, c); if (m) res.push(m); };
  if (kind === 'chamfer') {
    const q = p.slice(0, v).concat([P(Tprev), P(Tnext)], p.slice(v + 1));
    push(q, closed); return res;
  }
  if (!closed) { push(p.slice(0, v).concat([P(Tprev)]), false); push([P(Tnext)].concat(p.slice(v + 1)), false); return res; }
  const ring = [P(Tnext)]; for (let k = 1; k < n; k++) ring.push(p[(v + k) % n]); ring.push(P(Tprev));
  push(ring, false);
  return res;
}
// Polyline tugunlaridagi burchak ma'lumoti (sof burchaklar; 180° va 0° — o'tkazib yuboriladi)
function corners(ent) {
  const p = ent.pts, n = p.length, closed = !!ent.closed && n > 2, out = [];
  for (let v = 0; v < n; v++) {
    if (!closed && (v === 0 || v === n - 1)) { out.push(null); continue; }
    const V = p[v], A = p[(v - 1 + n) % n], B = p[(v + 1) % n];
    const lp = dist(A, V), ln = dist(V, B);
    if (lp < 1e-9 || ln < 1e-9) { out.push(null); continue; }
    const up = unit(sub(A, V)), un = unit(sub(B, V));
    const th = Math.acos(Math.max(-1, Math.min(1, dot(up, un))));
    if (th > Math.PI - 1e-4 || th < 1e-4) { out.push(null); continue; }
    out.push({ v, V, up, un, th, lp, ln });
  }
  return out;
}
// Har segmentda ikki uchidagi «sarf» (tl) yig'indisi uzunlikdan oshmasin — oshsa kattasini tashlaymiz
function fitCorners(ent, cs, need) {
  const n = ent.pts.length, closed = !!ent.closed && n > 2;
  const use = cs.map((c) => !!c && need(c).prev <= c.lp + 1e-9 && need(c).next <= c.ln + 1e-9);
  for (let guard = 0; guard < n + 2; guard++) {
    let changed = false;
    const segs = closed ? n : n - 1;
    for (let s = 0; s < segs; s++) {
      const a = s, b = (s + 1) % n;
      if (!use[a] || !use[b]) continue;
      const L = dist(ent.pts[a], ent.pts[b]);
      const na = need(cs[a]).next, nb = need(cs[b]).prev;
      if (na + nb > L + 1e-9) { if (na >= nb) use[a] = false; else use[b] = false; changed = true; }
    }
    if (!changed) break;
  }
  return use;
}
export function filletPlineAll(ent, R) {
  if (!ent || ent.type !== 'pline' || !(R > 0)) return { reason: 'Polyline va radius (> 0) kerak' };
  const cs = corners(ent);
  const need = (c) => { const t = R / Math.tan(c.th / 2); return { prev: t, next: t }; };
  const use = fitCorners(ent, cs, need);
  const n = ent.pts.length, closed = !!ent.closed && n > 2;
  const F = cs.map((c, v) => {
    if (!c || !use[v]) return null;
    const tl = R / Math.tan(c.th / 2), h = R / Math.sin(c.th / 2);
    const Tp = { x: c.V.x + c.up.x * tl, y: c.V.y + c.up.y * tl }, Tn = { x: c.V.x + c.un.x * tl, y: c.V.y + c.un.y * tl };
    const bis = unit({ x: c.up.x + c.un.x, y: c.up.y + c.un.y }), C = { x: c.V.x + bis.x * h, y: c.V.y + bis.y * h };
    const ta = tangentArc(C, R, Tp, Tn, c.up, c.un);   // d — T dan SAQLANADIGAN qismga (oldingi segment: +up)
    return { Tp, Tn, arc: Object.assign({ type: 'arc' }, ta.arc) };
  });
  const count = F.filter(Boolean).length, skipped = cs.filter((c, v) => c && !use[v]).length;
  if (!count) return { reason: skipped ? "Segmentlar radiusga nisbatan juda qisqa" : "Tutashtiriladigan burchak yo'q", count: 0, skipped };
  const out = [], p = ent.pts;
  const pushPl = (pts) => { const m = mkPl(pts, false); if (m) out.push(m); };
  if (!closed) {
    let cur = [P(p[0])];
    for (let v = 1; v < n - 1; v++) {
      if (F[v]) { cur.push(F[v].Tp); pushPl(cur); out.push(F[v].arc); cur = [F[v].Tn]; } else cur.push(P(p[v]));
    }
    cur.push(P(p[n - 1])); pushPl(cur);
  } else {
    const f = F.findIndex(Boolean);
    let cur = [F[f].Tn];
    for (let k = 1; k <= n; k++) {
      const v = (f + k) % n;
      if (v === f) { cur.push(F[f].Tp); pushPl(cur); out.push(F[f].arc); break; }
      if (F[v]) { cur.push(F[v].Tp); pushPl(cur); out.push(F[v].arc); cur = [F[v].Tn]; } else cur.push(P(p[v]));
    }
  }
  return { ents: out, count, skipped };
}
export function chamferPlineAll(ent, d1, d2) {
  d1 = Math.max(0, Number(d1) || 0); d2 = Math.max(0, Number(d2) || 0);
  if (!ent || ent.type !== 'pline' || (!(d1 > 0) && !(d2 > 0))) return { reason: 'Polyline va masofa (> 0) kerak' };
  const cs = corners(ent);
  const use = fitCorners(ent, cs, () => ({ prev: d1, next: d2 }));
  const n = ent.pts.length, closed = !!ent.closed && n > 2, q = [];
  let count = 0;
  for (let v = 0; v < n; v++) {
    const c = cs[v];
    if (c && use[v]) { q.push({ x: c.V.x + c.up.x * d1, y: c.V.y + c.up.y * d1 }, { x: c.V.x + c.un.x * d2, y: c.V.y + c.un.y * d2 }); count++; }
    else q.push(P(ent.pts[v]));
  }
  const skipped = cs.filter((c, v) => c && !use[v]).length;
  if (!count) return { reason: skipped ? 'Segmentlar masofaga nisbatan juda qisqa' : "Faska qilinadigan burchak yo'q", count: 0, skipped };
  const m = mkPl(q, closed);
  return { ents: m ? [m] : [], count, skipped };
}

/* ---------------- PORTLATISH / BIRLASHTIRISH ---------------- */
export function explodeEnt(e) {
  if (!e || e.type !== 'pline') return null;
  const p = e.pts, n = p.length, closed = !!e.closed && n > 2;
  if (n < 3 && !closed) return null;   // bitta segment — allaqachon oddiy chiziq
  const out = [];
  for (let i = 0; i + 1 < n; i++) if (dist(p[i], p[i + 1]) > 1e-9) out.push({ type: 'pline', pts: [P(p[i]), P(p[i + 1])], closed: false });
  if (closed && dist(p[n - 1], p[0]) > 1e-9) out.push({ type: 'pline', pts: [P(p[n - 1]), P(p[0])], closed: false });
  return out;
}
export function joinEnts(ents, tol = 0.05) {
  const remove = [], add = [];
  // 1) polyline'lar — uchma-uch tutashganlar bitta polyline
  const pls = (ents || []).filter((e) => e && e.type === 'pline' && Array.isArray(e.pts) && e.pts.length >= 2);
  for (const ch of buildChains(pls, tol)) {
    if (ch.ids.size < 2) continue;
    const pts = [P(ch.pieces[0].a)].concat(ch.pieces.map((q) => P(q.b)));
    const m = mkPl(ch.closed ? pts.slice(0, -1) : pts, ch.closed);
    if (!m) continue;
    for (const id of ch.ids) remove.push(id);
    add.push(m);
  }
  // 2) bir aylanadagi (markaz va radius bir xil) tutash yoylar — bitta yoy / aylana
  const arcs = (ents || []).filter((e) => e && e.type === 'arc');
  const used = new Set();
  for (let i = 0; i < arcs.length; i++) {
    if (used.has(i)) continue;
    const g = [i];
    for (let j = i + 1; j < arcs.length; j++) if (!used.has(j) && Math.hypot(arcs[j].cx - arcs[i].cx, arcs[j].cy - arcs[i].cy) < tol && Math.abs(arcs[j].r - arcs[i].r) < tol) g.push(j);
    if (g.length < 2) continue;
    const r = arcs[i].r, angTol = (tol / Math.max(r, 1e-6)) * 180 / Math.PI + 1e-6;
    let cur = { a0: arcs[g[0]].a0, a1: arcs[g[0]].a1 }, members = [g[0]], rest = g.slice(1), grew = true;
    while (grew) {
      grew = false;
      for (let k = 0; k < rest.length; k++) {
        const a = arcs[rest[k]];
        if (Math.abs(norm180(a.a0 - cur.a1)) < angTol) { cur.a1 = a.a1; }
        else if (Math.abs(norm180(cur.a0 - a.a1)) < angTol) { cur.a0 = a.a0; }
        else continue;
        members.push(rest[k]); rest.splice(k, 1); grew = true; break;
      }
    }
    if (members.length < 2) continue;
    for (const m of members) { used.add(m); remove.push(arcs[m].id); }
    const total = members.reduce((s, m) => s + arcSweep(arcs[m]), 0);
    if (total >= 360 - 1e-6 || Math.abs(norm180(cur.a1 - cur.a0)) < angTol && total > 180) add.push({ type: 'circle', cx: arcs[i].cx, cy: arcs[i].cy, r });
    else add.push({ type: 'arc', cx: arcs[i].cx, cy: arcs[i].cy, r, a0: norm360(cur.a0), a1: norm360(cur.a1) });
  }
  return { remove, add };
}
function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
