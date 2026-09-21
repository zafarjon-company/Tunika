// ============================================================
//  OVERKILL — USTMA-UST TUSHGAN (DUBLIKAT) ELEMENTLARNI TOPISH
//  ------------------------------------------------------------
//  AutoCAD OVERKILL kabi: bir xil joyda, bir xil shakldagi ikkinchi element
//  olib tashlanadi. Import qilingan DXF va ikki marta chizilgan konturlarda
//  kerak bo'ladi — lazer bir chiziqni ikki marta kesmasin.
//
//  Natija shakli joinEnts / trimAt bilan BIR XIL: { remove:[id], add:[props] }
//  — detalEngine dagi applyOp uni o'zgarishsiz qabul qiladi.
//
//  Taqqoslash: tur bir xil, qatlam bir xil (ignoreLay bo'lmasa), geometriya
//  tol (mm) chegarasida ustma-ust. Siniq chiziq ikki YO'NALISHDA ham, yopiq
//  bo'lsa har QAYSI tugundan boshlanib ham solishtiriladi.
// ============================================================

export const OVERKILL_TOL = 0.05;   // mm — chainOffset.js dagi JOIN_TOL bilan bir xil

const num = (v) => (Number.isFinite(v) ? v : 0);
function near(a, b, tol) { return Math.abs(num(a) - num(b)) <= tol; }
function ptNear(a, b, tol) { return Math.hypot(num(a.x) - num(b.x), num(a.y) - num(b.y)) <= tol; }

// Element taqqoslanadimi (hatch, o'lcham, blok nusxasi, cheksiz chiziqlar — yo'q)
export function overkillable(e) {
  return !!e && (e.type === 'pline' || e.type === 'circle' || e.type === 'arc' || e.type === 'point' || e.type === 'text');
}

// Taqqoslash uchun tayanch nuqta (chelak kaliti). Siniq chiziq uchun gabarit
// burchagi olinadi — u boshlanish nuqtasi va yo'nalishiga bog'liq emas (yopiq
// kontur dublikati boshqa tugundan boshlansa ham bir chelakka tushadi).
function anchorPt(e) {
  if (e.type === 'pline') {
    const ps = e.pts || [];
    if (!ps.length) return { x: 0, y: 0 };
    let mx = Infinity, my = Infinity;
    for (const p of ps) { if (num(p.x) < mx) mx = num(p.x); if (num(p.y) < my) my = num(p.y); }
    return { x: mx, y: my };
  }
  if (e.type === 'circle' || e.type === 'arc') return { x: e.cx, y: e.cy };
  return { x: e.x, y: e.y };
}

function samePline(a, b, tol) {
  const A = a.pts || [], B = b.pts || [];
  if (A.length !== B.length || !A.length) return false;
  if (!!a.closed !== !!b.closed) return false;
  const n = A.length;
  const tryFrom = (start, dir) => {
    for (let i = 0; i < n; i++) {
      const j = dir > 0 ? (start + i) % n : ((start - i) % n + n) % n;
      if (!ptNear(A[i], B[j], tol)) return false;
    }
    return true;
  };
  const starts = a.closed ? Array.from({ length: n }, (_, i) => i) : [0, n - 1];
  for (const st of starts) {
    if (a.closed) { if (tryFrom(st, 1) || tryFrom(st, -1)) return true; }
    else if (st === 0) { if (tryFrom(0, 1)) return true; }
    else if (tryFrom(n - 1, -1)) return true;
  }
  return false;
}

// Yoy: bir xil aylanada va bir xil burchak oralig'ida (a0/a1 CCW)
function sameArc(a, b, tol) {
  if (!near(a.cx, b.cx, tol) || !near(a.cy, b.cy, tol) || !near(a.r, b.r, tol)) return false;
  const angTol = a.r > 1e-6 ? Math.max(0.05, (tol / a.r) * 180 / Math.PI) : 1;
  const d = (x, y) => { let v = Math.abs(num(x) - num(y)) % 360; if (v > 180) v = 360 - v; return v; };
  return d(a.a0, b.a0) <= angTol && d(a.a1, b.a1) <= angTol;
}

export function sameGeom(a, b, tol, ignoreLay) {
  if (!a || !b || a.type !== b.type) return false;
  if (!ignoreLay && String(a.lay == null ? '' : a.lay) !== String(b.lay == null ? '' : b.lay)) return false;
  if (a.type === 'pline') return samePline(a, b, tol);
  if (a.type === 'circle') return near(a.cx, b.cx, tol) && near(a.cy, b.cy, tol) && near(a.r, b.r, tol);
  if (a.type === 'arc') return sameArc(a, b, tol);
  if (a.type === 'point') return ptNear(a, b, tol);
  if (a.type === 'text') return ptNear(a, b, tol) && String(a.text) === String(b.text) && near(a.h, b.h, tol) && near(a.rot || 0, b.rot || 0, 0.5);
  return false;
}

// Dublikatlarni topish. Chelaklash (bucket) + qo'shni chelaklar — chegaraviy
// yaxlitlashda ham juftlik o'tkazib yuborilmaydi.
//   opts: { tol, ignoreLay }
export function overkill(ents, opts) {
  const o = opts || {};
  const tol = Number.isFinite(o.tol) && o.tol > 0 ? o.tol : OVERKILL_TOL;
  const cell = Math.max(tol * 4, 1e-6);
  const buckets = new Map();
  const remove = [];
  const kept = [];
  for (const e of ents || []) {
    if (!overkillable(e)) continue;
    const p = anchorPt(e);
    const cx = Math.floor(num(p.x) / cell), cy = Math.floor(num(p.y) / cell);
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx++) {
      for (let dy = -1; dy <= 1 && !dup; dy++) {
        const list = buckets.get((cx + dx) + ':' + (cy + dy));
        if (!list) continue;
        for (const other of list) if (sameGeom(e, other, tol, o.ignoreLay)) { dup = true; break; }
      }
    }
    if (dup) { remove.push(e.id); continue; }
    const k = cx + ':' + cy;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(e);
    kept.push(e);
  }
  return { remove, add: [], patch: [], kept: kept.length };
}
