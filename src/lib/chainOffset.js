// ============================================================
//  ZANJIR (JOIN) OFSETI — uchlari tutashgan elementlarni bitta kontur kabi ofset qilish
// ------------------------------------------------------------
//  Sof geometriya, DOM yo'q (testlar: npm run test:chain).
//  Gul chizishda gul konturi ko'pincha alohida chiziqlar va yoylardan chiziladi
//  (uchma-uch). AutoCAD'da avval JOIN qilib, keyin OFFSET qilinadi — bu yerda
//  ofset asbobi zanjirni o'zi topadi: bosilgan element bilan uchlari tutashgan
//  (TOL ichida) barcha elementlar bitta kontur (yopiq bo'lsa — halqa) sifatida
//  ofset qilinadi: chiziqlar normal bo'ylab suriladi, yoylar radiusi ± D,
//  qo'shni bo'laklar kesishmasida tutashadi (chiziq×chiziq, chiziq×aylana,
//  aylana×aylana); tangens (silliq) tutashmada surilgan uchlar o'zi tutashadi.
//  Yutilgan bo'laklar (teskari chiziq, radiusi tugagan / ag'darilgan yoy)
//  tashlab yuborilib qo'shnilari qayta kesishtiriladi; kontur yorilsa — null.
//
//  Konvensiya: world mm, x o'ngga, y PASTGA; burchak 0° o'ng, 90° tepa, CCW musbat.
//  Bo'lak (piece): { kind:'seg', a, b, eid } | { kind:'arc', cx, cy, r, sa, ea, ccw, eid }
//  — yoy sa dan ea ga ccw (true — soat miliga qarshi) yo'nalishda yuriladi.
//  Ofset tomoni: D > 0 — yurish yo'nalishining O'NG tomoni (segment normali
//  n = (−dy, dx); CCW yurilgan yoy uchun tashqari, CW uchun ichkari).
//  Zanjir: { pieces, closed, ids:Set(eid) }.
// ============================================================
import { lineInt, distToSeg } from './offsetGeom.js';
import { norm360, vecAng, circleCircleInts } from './osnap.js';
import { arcPt, distToArc } from './arcGeom.js';

export const JOIN_TOL = 0.05;   // mm — uchlar tutashgan deb hisoblanadigan masofa
const EPS = 1e-9;
const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);

/* ---------------- BO'LAKLAR ---------------- */
export function pieceStart(p) { return p.kind === 'seg' ? p.a : arcPt(p, p.sa); }
export function pieceEnd(p) { return p.kind === 'seg' ? p.b : arcPt(p, p.ea); }
// Yoy bo'lagining burchak kengligi yurish yo'nalishida (0, 360]
export function pieceSweep(p) { const s = p.ccw ? norm360(p.ea - p.sa) : norm360(p.sa - p.ea); return s < 1e-9 ? 360 : s; }
// Yurish yo'nalishi (gradus) bo'lak boshida (atEnd=false) / oxirida
export function tangentAt(p, atEnd) {
  if (p.kind === 'seg') return vecAng(p.b.x - p.a.x, p.b.y - p.a.y);
  return norm360((atEnd ? p.ea : p.sa) + (p.ccw ? 90 : -90));
}
export function reversePiece(p) {
  if (p.kind === 'seg') return Object.assign({}, p, { a: p.b, b: p.a });
  return Object.assign({}, p, { sa: p.ea, ea: p.sa, ccw: !p.ccw });
}
// Yoy bo'lagi → element ko'rinishi (a0→a1 CCW)
function pieceArcEnt(p) { return { type: 'arc', cx: p.cx, cy: p.cy, r: p.r, a0: p.ccw ? p.sa : p.ea, a1: p.ccw ? p.ea : p.sa }; }

// Element → birlik (unit): { pieces, eid, closed }. Aylana/o'lcham — zanjirga kirmaydi (null).
export function unitOf(e) {
  if (!e) return null;
  if (e.type === 'pline') {
    const pts = Array.isArray(e.pts) ? e.pts.filter((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y)) : [];
    if (pts.length < 2) return null;
    const pieces = [];
    for (let i = 0; i + 1 < pts.length; i++) pieces.push({ kind: 'seg', a: pts[i], b: pts[i + 1], eid: e.id });
    const closed = !!e.closed && pts.length > 2;
    if (closed) pieces.push({ kind: 'seg', a: pts[pts.length - 1], b: pts[0], eid: e.id });
    return { pieces, eid: e.id, closed };
  }
  if (e.type === 'arc') {
    if (![e.cx, e.cy, e.r, e.a0, e.a1].every(Number.isFinite) || !(e.r > EPS)) return null;
    return { pieces: [{ kind: 'arc', cx: e.cx, cy: e.cy, r: e.r, sa: norm360(e.a0), ea: norm360(e.a1), ccw: true, eid: e.id }], eid: e.id, closed: false };
  }
  return null;
}

/* ---------------- ZANJIRLARNI QURISH ----------------
   Yopiq polyline — o'zi halqa. Qolgan birliklar uchlari bo'yicha ulanadi (kerak bo'lsa
   teskari yo'nalishda). Bir uchga 3+ birlik tutashsa — birinchi topilgani olinadi. */
export function buildChains(ents, tol = JOIN_TOL) {
  const chains = [], units = [];
  for (const e of ents || []) {
    const u = unitOf(e); if (!u) continue;
    if (u.closed) chains.push({ pieces: u.pieces, closed: true, ids: new Set([u.eid]) });
    else units.push(u);
  }
  const used = new Set();
  const uStart = (u) => pieceStart(u.pieces[0]), uEnd = (u) => pieceEnd(u.pieces[u.pieces.length - 1]);
  const rev = (u) => ({ pieces: u.pieces.slice().reverse().map(reversePiece), eid: u.eid, closed: false });
  for (let s = 0; s < units.length; s++) {
    if (used.has(s)) continue;
    used.add(s);
    let pieces = units[s].pieces.slice();
    const ids = new Set([units[s].eid]);
    const isClosed = () => pieces.length >= 2 && dist(pieceEnd(pieces[pieces.length - 1]), pieceStart(pieces[0])) <= tol;
    // oxiridan davom
    let grew = true;
    while (grew && !isClosed()) {
      grew = false;
      const end = pieceEnd(pieces[pieces.length - 1]);
      for (let k = 0; k < units.length; k++) {
        if (used.has(k)) continue;
        const u = units[k];
        let add = null;
        if (dist(uStart(u), end) <= tol) add = u; else if (dist(uEnd(u), end) <= tol) add = rev(u);
        if (add) { pieces = pieces.concat(add.pieces); ids.add(u.eid); used.add(k); grew = true; break; }
      }
    }
    // boshidan davom (teskariga)
    grew = true;
    while (grew && !isClosed()) {
      grew = false;
      const start = pieceStart(pieces[0]);
      for (let k = 0; k < units.length; k++) {
        if (used.has(k)) continue;
        const u = units[k];
        let add = null;
        if (dist(uEnd(u), start) <= tol) add = u; else if (dist(uStart(u), start) <= tol) add = rev(u);
        if (add) { pieces = add.pieces.concat(pieces); ids.add(u.eid); used.add(k); grew = true; break; }
      }
    }
    chains.push({ pieces, closed: isClosed(), ids });
  }
  return chains;
}
export function chainOf(ents, eid, tol = JOIN_TOL) {
  return buildChains(ents, tol).find((c) => c.ids.has(eid)) || null;
}

/* ---------------- TOMON ---------------- */
function pieceDist(p, w) {
  if (p.kind === 'seg') return distToSeg(w.x, w.y, p.a.x, p.a.y, p.b.x, p.b.y);
  return distToArc(pieceArcEnt(p), w);
}
// Kursor zanjirning qaysi tomonida: +1 — yurish yo'nalishining o'ng tomoni; nd — eng yaqin bo'lakkacha masofa
export function chainSide(chain, w) {
  if (!chain || !chain.pieces.length || !w || !Number.isFinite(w.x) || !Number.isFinite(w.y)) return null;
  let near = chain.pieces[0], nd = Infinity;
  for (const p of chain.pieces) { const d = pieceDist(p, w); if (d < nd) { nd = d; near = p; } }
  let side;
  if (near.kind === 'seg') {
    const dx = near.b.x - near.a.x, dy = near.b.y - near.a.y;
    side = Math.sign((w.x - near.a.x) * (-dy) + (w.y - near.a.y) * dx) || 1;
  } else {
    const outward = Math.hypot(w.x - near.cx, w.y - near.cy) - near.r > 0;
    side = (outward === !!near.ccw) ? 1 : -1;
  }
  return { side, nd };
}

/* ---------------- OFSET ---------------- */
// Cheksiz chiziq × aylana kesishmalari
function lineCircleInts(a, b, c, r) {
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
const nearestTo = (pts, J) => { let best = null, bd = Infinity; for (const p of pts) { const d = dist(p, J); if (d < bd) { bd = d; best = p; } } return best; };

// Zanjirni ishorali D ga ofset qilish → bo'laklar (surilgan va tutashtirilgan) yoki null (sig'madi)
export function offsetChain(chain, D) {
  if (!chain || !chain.pieces.length || !Number.isFinite(D) || Math.abs(D) < EPS) return null;
  const n = chain.pieces.length, closed = !!chain.closed;
  // 1) har bo'lakni surish
  let ps = [];
  chain.pieces.forEach((p, idx) => {
    if (p.kind === 'seg') {
      const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y, L = Math.hypot(dx, dy);
      if (L < EPS) return;   // nol uzunlik — tashlanadi
      const nx = -dy / L, ny = dx / L;
      ps.push({ kind: 'seg', idx, orig: p, ux: dx / L, uy: dy / L, a: { x: p.a.x + nx * D, y: p.a.y + ny * D }, b: { x: p.b.x + nx * D, y: p.b.y + ny * D } });
    } else {
      const r = p.r + D * (p.ccw ? 1 : -1);
      if (r <= EPS) return;   // radius tugadi — yutildi
      ps.push({ kind: 'arc', idx, orig: p, cx: p.cx, cy: p.cy, r, sa: p.sa, ea: p.ea, ccw: p.ccw, sweep0: pieceSweep(p) });
    }
  });
  const adjacent = (prev, cur) => (prev.idx + 1) % n === cur.idx;
  const smooth = (prev, cur) => Math.abs(norm360(tangentAt(prev.orig, true) - tangentAt(cur.orig, false) + 180) - 180) < 0.01;
  // Ikki surilgan qo'shni bo'lak tutashadigan nuqta; null — kontur yorildi
  function junction(prev, cur) {
    const J0 = pieceEnd(prev.orig);
    if (prev.kind === 'seg' && cur.kind === 'seg') {
      const p = lineInt(prev.a, prev.b, cur.a, cur.b);
      if (p) return p;
      return adjacent(prev, cur) ? cur.a : null;   // parallel: asl qo'shnilar (kollinear) — surilgan uch
    }
    let cands;
    if (prev.kind === 'seg') cands = lineCircleInts(prev.a, prev.b, { x: cur.cx, y: cur.cy }, cur.r);
    else if (cur.kind === 'seg') cands = lineCircleInts(cur.a, cur.b, { x: prev.cx, y: prev.cy }, prev.r);
    else cands = circleCircleInts({ x: prev.cx, y: prev.cy }, prev.r, { x: cur.cx, y: cur.cy }, cur.r);
    const p = nearestTo(cands, J0);
    if (p) return p;
    // kesishma yo'q: silliq (tangens) tutashma — surilgan uchlar o'zi tutashadi; aks holda yorilgan
    return smooth(prev, cur) ? (prev.kind === 'seg' ? prev.b : arcPt(prev, prev.ea)) : null;
  }
  for (let iter = 0; iter <= n; iter++) {
    const m = ps.length;
    if (closed ? m < 2 : m < 1) return null;
    const J = new Array(m + 1);
    for (let k = 0; k < m; k++) {
      if (!closed && k === 0) continue;
      const jp = junction(ps[(k - 1 + m) % m], ps[k]);
      if (!jp) return null;
      J[k] = jp;
    }
    const out = [], bad = new Set();
    for (let k = 0; k < m; k++) {
      const p = ps[k];
      const s = (closed || k > 0) ? J[k] : (p.kind === 'seg' ? p.a : arcPt(p, p.sa));
      const e = (closed || k < m - 1) ? J[(k + 1) % m] : (p.kind === 'seg' ? p.b : arcPt(p, p.ea));
      if (p.kind === 'seg') {
        if ((e.x - s.x) * p.ux + (e.y - s.y) * p.uy <= 1e-6) bad.add(k);   // teskari / nol — yutilgan
        out.push({ kind: 'seg', a: s, b: e, eid: p.orig.eid });
      } else {
        const sa = vecAng(s.x - p.cx, s.y - p.cy), ea = vecAng(e.x - p.cx, e.y - p.cy);
        const q = { kind: 'arc', cx: p.cx, cy: p.cy, r: p.r, sa, ea, ccw: p.ccw, eid: p.orig.eid };
        if (dist(s, e) < 1e-6 || pieceSweep(q) > p.sweep0 + 180) bad.add(k);   // ag'darilgan (teskari tomonga o'ralgan) — yutilgan
        out.push(q);
      }
    }
    if (!bad.size) return out;
    ps = ps.filter((_, k) => !bad.has(k));
  }
  return null;
}

// Bo'laklar → element xossalari: ketma-ket segmentlar bitta polyline, yoylar alohida.
// Yopiq va hammasi segment — bitta yopiq polyline.
export function piecesToEnts(pieces, closed) {
  if (!pieces || !pieces.length) return [];
  let ps = pieces;
  const allSeg = ps.every((p) => p.kind === 'seg');
  if (closed && allSeg) return [{ type: 'pline', pts: ps.map((p) => ({ x: p.a.x, y: p.a.y })), closed: true }];
  // yopiq aralash: segment qatori halqa bo'ylab bo'linib qolmasin — yoydan keyingi joydan boshlaymiz
  if (closed && ps[0].kind === 'seg' && ps[ps.length - 1].kind === 'seg') {
    const i = ps.findIndex((p) => p.kind === 'arc');
    if (i >= 0) ps = ps.slice(i + 1).concat(ps.slice(0, i + 1));
  }
  const out = [];
  let run = null;
  const flush = () => { if (run && run.length >= 2) out.push({ type: 'pline', pts: run, closed: false }); run = null; };
  for (const p of ps) {
    if (p.kind === 'seg') {
      if (!run) run = [{ x: p.a.x, y: p.a.y }];
      run.push({ x: p.b.x, y: p.b.y });
    } else { flush(); out.push(pieceArcEnt(p)); }
  }
  flush();
  return out;
}

// 1·step, 2·step, … n·step — har qadam uchun element xossalari massivi; sig'maganida to'xtaydi
export function offsetChainSeries(chain, step, n = 1) {
  const out = [];
  const N = Math.min(1000, Math.floor(Number(n) || 0));
  for (let k = 1; k <= N; k++) {
    const ps = offsetChain(chain, step * k);
    if (!ps) break;
    out.push(piecesToEnts(ps, chain.closed));
  }
  return out;
}
