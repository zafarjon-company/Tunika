// ============================================================
//  SHTRIX (HATCH) VA KONTUR (BOUNDARY) — soha topish (sof funksiyalar, DOM yo'q)
//  Testlar: npm run test:hatch
//  Yopiq halqalar: yopiq polyline, uchlari tutashgan chiziq/yoylar zanjiri
//  (chainOffset.buildChains — xuddi Offset/avto-ofsetdagidek) va aylanalar.
//  Bosilgan nuqtani o'z ichiga olgan ENG KICHIK halqa — tashqi chegara; uning
//  ichidagi (nuqtani o'z ichiga olmagan) halqalar — orollar (AutoCAD «Normal»:
//  juft-toq qoida bilan navbatma-navbat bo'yaladi).
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° tepa, CCW musbat.
// ============================================================
import { buildChains } from './chainOffset.js';

const D2R = Math.PI / 180;
function norm360(a) { a = a % 360; if (a < 0) a += 360; return (Math.abs(a) < 1e-9 || Math.abs(a - 360) < 1e-9) ? 0 : a; }

// Yopiq zanjir bo'laklari (seg / arc) → ko'pburchak (yoylar stepDeg qadam bilan)
export function chainPolygon(pieces, stepDeg = 3) {
  const pts = [];
  for (const p of pieces || []) {
    if (p.kind === 'seg') { pts.push({ x: p.a.x, y: p.a.y }); continue; }
    let sw = p.ccw ? norm360(p.ea - p.sa) : norm360(p.sa - p.ea);
    if (sw < 1e-9) sw = 360;
    const n = Math.max(2, Math.ceil(sw / stepDeg));
    for (let k = 0; k < n; k++) {
      const a = (p.sa + (p.ccw ? 1 : -1) * (sw * k) / n) * D2R;
      pts.push({ x: p.cx + p.r * Math.cos(a), y: p.cy - p.r * Math.sin(a) });
    }
  }
  return pts;
}
export function circlePolygon(c, n = 96) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; out.push({ x: c.cx + c.r * Math.cos(a), y: c.cy - c.r * Math.sin(a) }); }
  return out;
}
export function polyAreaAbs(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}
// Nuqta ko'pburchak ichidami (nur kesish)
export function pointInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
// Juft-toq qoida: bir nechta halqa (tashqi + orollar) ichida
export function pointInLoops(p, loops) {
  let inside = false;
  for (const l of loops || []) if (pointInPoly(p, l)) inside = !inside;
  return inside;
}
// Yopiq zanjirning ANIQ yuzasi: vatarlar ko'pburchagi + har yoy segmenti (r²/2·(θ − sin θ)).
// y pastga: ekranda soat miliga qarshi yurish — shoelace manfiy; CCW yoy (ccw) shu tomonga qo'shiladi.
export function chainAreaExact(pieces) {
  const st = (p) => (p.kind === 'seg' ? p.a : { x: p.cx + p.r * Math.cos(p.sa * D2R), y: p.cy - p.r * Math.sin(p.sa * D2R) });
  const pts = (pieces || []).map(st);
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  let A = s / 2;
  for (const p of pieces || []) {
    if (p.kind === 'seg') continue;
    let sw = p.ccw ? norm360(p.ea - p.sa) : norm360(p.sa - p.ea);
    if (sw < 1e-9) sw = 360;
    const th = sw * D2R, seg = (p.r * p.r / 2) * (th - Math.sin(th));
    A += p.ccw ? -seg : seg;
  }
  return Math.abs(A);
}
function bboxOf(pts) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) { if (p.x < a) a = p.x; if (p.y < b) b = p.y; if (p.x > c) c = p.x; if (p.y > d) d = p.y; }
  return [a, b, c, d];
}
// Chizmadagi barcha yopiq halqalar: { pts, area (aniq), ids:[eid], pieces?, ent? }
// Ustma-ust takror halqalar (masalan Kontur nusxasi) bittaga qisqaradi — aks holda juft-toq qoida orolni bo'yab qo'yadi
// ent — halqa bitta elementdan iborat bo'lsa (yopiq polyline / aylana) — nusxa olish uchun
export function closedLoops(ents) {
  const out = [];
  const byId = new Map();
  for (const e of ents || []) if (e && e.id != null) byId.set(e.id, e);
  for (const ch of buildChains(ents || [])) {
    if (!ch.closed) continue;
    const pts = chainPolygon(ch.pieces, 2);
    if (pts.length < 3) continue;
    const ids = [...ch.ids];
    const one = ids.length === 1 ? byId.get(ids[0]) : null;
    out.push({ pts, area: chainAreaExact(ch.pieces), ids, pieces: ch.pieces, ent: one && one.type === 'pline' && one.closed ? one : null });
  }
  for (const e of ents || []) {
    if (!e || e.type !== 'circle' || !(e.r > 0) || ![e.cx, e.cy, e.r].every(Number.isFinite)) continue;
    const pts = circlePolygon(e, 180);
    out.push({ pts, area: Math.PI * e.r * e.r, ids: [e.id], pieces: null, ent: e });
  }
  const uniq = [];
  for (const l of out) {
    l.bb = bboxOf(l.pts);
    const dup = uniq.some((u) => Math.abs(u.area - l.area) <= 1e-6 * Math.max(1, l.area) + 1e-6 && u.bb.every((v, i) => Math.abs(v - l.bb[i]) < 1e-3));
    if (!dup) uniq.push(l);
  }
  return uniq;
}
// Bosilgan nuqta atrofidagi soha: { outer, islands } yoki null
export function findRegion(loops, P) {
  const containing = loops.filter((l) => pointInPoly(P, l.pts));
  if (!containing.length) return null;
  let outer = containing[0];
  for (const l of containing) if (l.area < outer.area) outer = l;
  const islands = loops.filter((l) => l !== outer && l.area < outer.area && !pointInPoly(P, l.pts) && l.pts.every((q) => pointInPoly(q, outer.pts)));
  return { outer, islands };
}
// Topilgan soha yuzasi (aniq): tashqi − orollar (orol ichidagi orol — qo'shiladi)
export function regionAreaOf(outer, islands) {
  let a = outer.area;
  for (const l of islands) {
    let depth = 0;
    for (const m of islands) if (m !== l && m.area > l.area && pointInPoly(l.pts[0], m.pts)) depth++;
    a += (depth % 2 === 0 ? -1 : 1) * l.area;
  }
  return a;
}
// Juft-toq qoida bo'yicha bo'yalgan yuza (tashqi − orollar + orol ichidagi orollar …)
export function regionArea(loops) {
  let a = 0;
  for (const l of loops) {
    const probe = l[0];
    let depth = 0;
    for (const m of loops) if (m !== l && pointInPoly(probe, m) && polyAreaAbs(m) > polyAreaAbs(l)) depth++;
    a += (depth % 2 === 0 ? 1 : -1) * polyAreaAbs(l);
  }
  return a;
}
