// ============================================================
//  BLOKLAR (AutoCAD BLOCK / INSERT) — SOF GEOMETRIYA
//  ------------------------------------------------------------
//  Blok ta'rifi:  { nomi, ents:[...], izoh }  — elementlar tayanch nuqtaga
//    nisbatan (0,0 — tayanch), ULARDA id BO'LMAYDI (chizma id fazasiga kirmaydi).
//  Blok nusxasi:  { type:'ins', bn:'<nomi>', x, y, sc, rot }
//
//  MUHIM: bu modul HECH QACHON kirish elementini o'zgartirmaydi — har doim
//  yangi obyekt qaytaradi. Blok ta'rifi elementlarini joyida o'zgartirish
//  (detalEngine dagi mapEnt kabi) BUTUN blokni barcha nusxalari bilan buzadi.
//
//  Konvensiya: world mm, x o'ngga, y PASTGA; burchak gradus, 0° = o'ng,
//  90° = TEPA, soat miliga qarshi musbat (detalEngine bilan bir xil).
// ============================================================

import { arcMap } from './arcGeom.js';
import { ellipseMap, textMap } from './curveGeom.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
function norm360(a) { a = a % 360; if (a < 0) a += 360; return (Math.abs(a) < 1e-9 || Math.abs(a - 360) < 1e-9) ? 0 : a; }
function dirVec(deg) { const r = deg * D2R; return { dx: Math.cos(r), dy: -Math.sin(r) }; }
function vecAng(dx, dy) { return norm360(Math.atan2(-dy, dx) * R2D); }

export const BLOCK_MAX_DEPTH = 8;   // blok ichida blok — cheksiz halqadan himoya

// Nom tekshiruvi (qatlam nomi bilan bir xil qoida)
const BAD_RE = /[<>/\\":;?*|,=`]/;
export function normBlockName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 255); }
export function blockNameError(nomi, list, selfName) {
  const n = normBlockName(nomi);
  if (!n) return 'Blok nomi bo‘sh bo‘lmasin';
  if (BAD_RE.test(n)) return 'Nomda < > / \\ " : ; ? * | , = ` belgilari bo‘lmaydi';
  const self = selfName == null ? null : String(selfName).toLowerCase();
  for (const b of list || []) if (b.nomi.toLowerCase() === n.toLowerCase() && b.nomi.toLowerCase() !== self) return 'Bunday nomli blok bor';
  return '';
}
export function findBlock(list, nomi) {
  if (!Array.isArray(list)) return null;
  const n = String(nomi == null ? '' : nomi).toLowerCase();
  return list.find((b) => b && String(b.nomi).toLowerCase() === n) || null;
}

// Nusxa uchun nuqta almashtirish: aks (mir) -> masshtab -> burish -> ko'chirish.
// mir — X o'qi bo'yicha aks ettirish (AutoCAD blokni manfiy X masshtab bilan akslantiradi)
export function xform(ins) {
  const s = Number.isFinite(ins.sc) && Math.abs(ins.sc) > 1e-9 ? Math.abs(ins.sc) : 1;
  const m = ins.mir ? -1 : 1;
  const r = (ins.rot || 0) * D2R, ca = Math.cos(r), sa = Math.sin(r);
  const ox = Number.isFinite(ins.x) ? ins.x : 0, oy = Number.isFinite(ins.y) ? ins.y : 0;
  return (p) => {
    const px = p.x * m, py = p.y;
    return { x: ox + (px * ca + py * sa) * s, y: oy + (-px * sa + py * ca) * s };
  };
}

// Blok nusxasiga tashqi almashtirishni qo'llash (obyekt JOYIDA o'zgaradi — nusxa emas).
// Matematika (M — X bo'yicha aks, M·R(θ) = R(−θ)·M):
//   F burmasa   : F∘(R(rot)·S·M) = R(rF + rot)·S(k·sc)·M        (rF = vecAng(ux))
//   F akslantirsa: F = R(rF)·M bo'ladi va rF = vecAng(−ux) ; natija R(rF − rot)·S·M(!mir)
export function insMap(c, fn) {
  const a = fn({ x: c.x, y: c.y }), bx = fn({ x: c.x + 1, y: c.y }), by = fn({ x: c.x, y: c.y + 1 });
  const ux = { x: bx.x - a.x, y: bx.y - a.y }, uy = { x: by.x - a.x, y: by.y - a.y };
  const s = Math.hypot(ux.x, ux.y) || 1;
  const kross = ux.x * uy.y - ux.y * uy.x;
  c.x = a.x; c.y = a.y;
  if (kross < 0) { c.rot = norm360(vecAng(-ux.x, -ux.y) - (c.rot || 0)); c.mir = !c.mir; }
  else c.rot = norm360(vecAng(ux.x, ux.y) + (c.rot || 0));
  c.sc = Math.abs(Number.isFinite(c.sc) ? c.sc : 1) * s;
  return c;
}

// Elementni almashtirib YANGI element qaytarish (detalEngine.mapEnt ning sof varianti).
//   fn — nuqta almashtirish; rFactor — radius/o'lcham ko'paytmasi (null bo'lsa o'zgarmaydi)
//   widthOf(e) — matn eni (mm); berilmasa taxminiy hisoblanadi
export function mapEntCopy(e, fn, rFactor, widthOf) {
  const c = JSON.parse(JSON.stringify(e));
  const W = widthOf || ((t) => String(t.text || '').length * 0.6 * (t.h || 1));
  if (c.type === 'point') { const p = fn({ x: c.x, y: c.y }); c.x = p.x; c.y = p.y; return c; }
  if (c.type === 'text') { Object.assign(c, textMap(c, W(c), fn)); return c; }
  if (c.type === 'xline' || c.type === 'ray') {
    const u = dirVec(c.ang), a = fn({ x: c.x, y: c.y }), b = fn({ x: c.x + u.dx, y: c.y + u.dy });
    c.x = a.x; c.y = a.y; c.ang = vecAng(b.x - a.x, b.y - a.y); return c;
  }
  if (c.type === 'ins') return insMap(c, fn);   // blok ichidagi blok
  if (c.type === 'hatch') {
    const off = c.pat === 'line' ? 0 : 45;
    const p0 = (c.loops && c.loops[0] && c.loops[0][0]) || { x: 0, y: 0 };
    const u = dirVec((c.ang || 0) + off), a = fn(p0), b = fn({ x: p0.x + u.dx, y: p0.y + u.dy });
    const s = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    c.ang = norm360(vecAng(b.x - a.x, b.y - a.y) - off);
    c.sc = Math.abs((c.sc || 1) * s);
    if (Number.isFinite(c.area)) c.area *= s * s;
    c.loops = (c.loops || []).map((l) => l.map(fn));
    return c;
  }
  if (c.type === 'pline') {
    c.pts = (c.pts || []).map(fn);
    if (c.fit) c.fit = c.fit.map(fn);
    if (c.ell) c.ell = ellipseMap(c.ell, fn);
    return c;
  }
  if (c.type === 'arc') { const a = arcMap(c, fn); if (a) Object.assign(c, a); return c; }
  if (c.type === 'circle') { const p = fn({ x: c.cx, y: c.cy }); c.cx = p.x; c.cy = p.y; if (rFactor != null) c.r = Math.abs(c.r * rFactor); return c; }
  if (c.type === 'dim') {
    if (c.kind === 'lin') { const u = dirVec(c.rot || 0), p0 = fn({ x: c.x1, y: c.y1 }), pu = fn({ x: c.x1 + u.dx, y: c.y1 + u.dy }); c.rot = vecAng(pu.x - p0.x, pu.y - p0.y); }
    if (c.kind === 'ang') { const cc = fn({ x: c.cx, y: c.cy }), l = fn({ x: c.lx, y: c.ly }); c.cx = cc.x; c.cy = cc.y; c.lx = l.x; c.ly = l.y; }
    const a = fn({ x: c.x1, y: c.y1 }), b = fn({ x: c.x2, y: c.y2 });
    c.x1 = a.x; c.y1 = a.y; c.x2 = b.x; c.y2 = b.y;
    if (rFactor != null) { if (c.off != null) c.off *= Math.abs(rFactor); if (c.r != null) c.r = Math.abs(c.r * rFactor); }
    return c;
  }
  return c;
}

// Blok nusxasini elementlarga yoyish (ta'rifga TEGILMAYDI).
//   blocks — barcha ta'riflar (ichma-ich bloklar uchun); depth — himoya
export function explodeIns(ins, blocks, widthOf, depth) {
  const d = depth || 0;
  if (d > BLOCK_MAX_DEPTH) return [];
  const def = findBlock(blocks, ins && ins.bn);
  if (!def || !Array.isArray(def.ents) || !def.ents.length) return [];
  const fn = xform(ins);
  const sc = Number.isFinite(ins.sc) && Math.abs(ins.sc) > 1e-9 ? Math.abs(ins.sc) : 1;
  const out = [];
  for (const e of def.ents) {
    if (!e || !e.type) continue;
    if (e.type === 'ins') {
      const inner = mapEntCopy(e, fn, sc, widthOf);
      for (const g of explodeIns(inner, blocks, widthOf, d + 1)) out.push(g);
      continue;
    }
    out.push(mapEntCopy(e, fn, sc, widthOf));
  }
  return out;
}

// AutoCAD qoidasi: blok ichida «0» qatlamidagi element nusxa qatlamiga tushadi,
// boshqa qatlamdagisi o'z qatlamida qoladi.
export function applyInsLayer(parts, ins, clay) {
  for (const p of parts) {
    if (!p.lay || p.lay === '0') p.lay = (ins && ins.lay) || clay || '0';
    if (ins && ins.col != null && p.col == null) p.col = ins.col;
  }
  return parts;
}

// Tanlangan elementlardan blok ta'rifi: tayanch nuqta (bx,by) yangi (0,0)
export function makeBlockDef(nomi, ents, bx, by, widthOf) {
  const fn = (p) => ({ x: p.x - bx, y: p.y - by });
  const out = [];
  for (const e of ents || []) {
    if (!e || !e.type) continue;
    const c = mapEntCopy(e, fn, null, widthOf);
    delete c.id;   // blok ichidagi elementlar chizma id fazasiga kirmaydi
    out.push(c);
  }
  return { nomi: normBlockName(nomi), ents: out, izoh: '' };
}

// Blok ta'rifi shu blokka (bevosita yoki ichma-ich) murojaat qiladimi — halqa taqiqlanadi
export function blockUses(blocks, defName, target, depth) {
  const d = depth || 0;
  if (d > BLOCK_MAX_DEPTH) return false;
  const def = findBlock(blocks, defName);
  if (!def) return false;
  for (const e of def.ents || []) {
    if (e && e.type === 'ins') {
      if (String(e.bn).toLowerCase() === String(target).toLowerCase()) return true;
      if (blockUses(blocks, e.bn, target, d + 1)) return true;
    }
  }
  return false;
}

// Chizmada ishlatilgan blok nomlari (PURGE uchun)
export function usedBlockNames(ents, blocks) {
  const s = new Set();
  const walk = (list, depth) => {
    if (depth > BLOCK_MAX_DEPTH) return;
    for (const e of list || []) {
      if (!e || e.type !== 'ins') continue;
      const n = String(e.bn);
      if (s.has(n.toLowerCase())) continue;
      s.add(n.toLowerCase());
      const def = findBlock(blocks, n);
      if (def) walk(def.ents, depth + 1);
    }
  };
  walk(ents, 0);
  return Array.from(s);
}
