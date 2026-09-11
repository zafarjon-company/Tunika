// ============================================================
//  OSNAP — AutoCAD uslubidagi obyekt yopishish (magnit) va kuzatish
// ------------------------------------------------------------
//  Sof geometriya (DOM'siz). Ikkala chizma dvigateli — Xona konturi
//  (Tahrir rejimi, chizmaEngine.js) va Detal chizish (detalEngine.js) —
//  shu moduldan foydalanadi, shuning uchun magnitlar ikkalasida bir xil.
//
//  Koordinatalar: world (mm), x o'ngga, y PASTGA (ekran kabi).
//  Burchak AutoCAD'dek: 0° = o'ng, 90° = TEPA, soat miliga qarshi musbat.
//  Ekran masofasi = mm × scale (px/mm) — pan kerak emas.
//
//  Rejimlar (AutoCAD OSNAP):
//    END uch nuqta · MID o'rta · CEN markaz · NOD tugun (xona nuqtalari, (0,0))
//    QUA kvadrant · INT kesishma · EXT davomi (kuzatish orqali)
//    PER perpendikulyar · TAN tangens · NEA eng yaqin
//  Kuzatish: ORTHO (F8), POLAR (F10, qadam sozlanadi), OTRACK (F11) —
//  yopishgan nuqta ustida turib "olingan" nuqtalardan gorizontal/vertikal/
//  polar chiziqlar, ularning kesishmasi.
//  Sozlamalar localStorage'da (SNAP_KEY) — ikkala dvigatel uchun umumiy.
// ============================================================

export const SNAP_KEY = 'cad-snap-v1';

// Tartib — holat panelidagi ro'yxat tartibi. pri — ustunlik (0 eng kuchli).
export const SNAP_MODES = [
  { key: 'END', nomi: 'Uch nuqta', marker: 'square', pri: 0 },
  { key: 'MID', nomi: "O'rta nuqta", marker: 'triangle', pri: 1 },
  { key: 'CEN', nomi: 'Markaz', marker: 'circle', pri: 1 },
  { key: 'NOD', nomi: 'Tugun (nuqta)', marker: 'node', pri: 0 },
  { key: 'QUA', nomi: 'Kvadrant', marker: 'diamond', pri: 1 },
  { key: 'INT', nomi: 'Kesishma', marker: 'x', pri: 0 },
  { key: 'EXT', nomi: 'Davomi', marker: 'ext', pri: 3 },
  { key: 'PER', nomi: 'Perpendikulyar', marker: 'perp', pri: 2 },
  { key: 'TAN', nomi: 'Tangens', marker: 'tan', pri: 2 },
  { key: 'NEA', nomi: 'Eng yaqin', marker: 'hourglass', pri: 4 },
];
const MODE_BY_KEY = Object.fromEntries(SNAP_MODES.map((m) => [m.key, m]));
/* Ustunlik jarimasi — APERTURA ULUSHIDA (mutlaq px emas!). AutoCAD qoidasi:
   apertura ichidagi "nuqta" magnitlari (END/INT/NOD, so'ng MID/CEN/QUA) har doim
   PER/TAN/EXT/NEA dan ustun — chunki oxirgilari kursor OBYEKT ustida bo'lsa
   (masofa ≈ 0) chiqadi va aks holda uch nuqtaga yopishib bo'lmay qolardi.
   pri 2..4 uchun ko'paytma > 1 — ya'ni apertura chekkasidagi nuqta ham ularni yutadi. */
const PRI_MUL = [0, 0.12, 1.05, 1.25, 1.6];
export const POLAR_INCS = [5, 10, 15, 18, 22.5, 30, 45, 90];
export const GRID_STEPS = [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];   // mm; 0 = avto

export const DEFAULT_SNAP = {
  osnap: true,
  modes: { END: true, MID: true, CEN: true, NOD: true, QUA: true, INT: true, EXT: true, PER: true, TAN: false, NEA: false },
  ortho: false,
  polar: true,
  polarInc: 15,
  otrack: true,
  grid: true,
  gridSnap: false,
  gridStep: 0,        // mm; 0 = masshtabga qarab avtomatik
  dyn: true,          // dinamik kiritish qutisi (uzunlik/burchak)
  aperture: 12,       // px — magnit tortish radiusi
  acquireMs: 250,     // OTRACK: nuqta ustida shuncha turilsa "olinadi"
};

export function modeName(kind) {
  if (kind === 'ortho') return 'Orto';
  if (kind === 'polar') return 'Polar';
  if (kind === 'otrack') return 'Kuzatish';
  if (kind === 'otrack-int') return 'Kuzatish kesishmasi';
  if (kind === 'proj') return 'Proyeksiya';
  if (kind === 'proj-int') return 'Proyeksiya kesishmasi';
  if (kind === 'grid') return "To'r";
  const m = MODE_BY_KEY[kind];
  return m ? m.nomi : '';
}

export function loadSnap(storage) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const s = JSON.parse(JSON.stringify(DEFAULT_SNAP));
  if (!st) return s;
  try {
    const o = JSON.parse(st.getItem(SNAP_KEY) || 'null');
    if (!o || typeof o !== 'object') return s;
    for (const k of ['osnap', 'ortho', 'polar', 'otrack', 'grid', 'gridSnap', 'dyn']) if (typeof o[k] === 'boolean') s[k] = o[k];
    if (POLAR_INCS.includes(o.polarInc)) s.polarInc = o.polarInc;
    if (GRID_STEPS.includes(o.gridStep)) s.gridStep = o.gridStep;
    if (typeof o.aperture === 'number' && o.aperture >= 4 && o.aperture <= 40) s.aperture = o.aperture;
    if (o.modes && typeof o.modes === 'object') for (const m of SNAP_MODES) if (typeof o.modes[m.key] === 'boolean') s.modes[m.key] = o.modes[m.key];
    if (s.ortho) s.polar = false;   // AutoCAD: ORTHO va POLAR bir vaqtda yonmaydi
  } catch (e) { /* buzuq — standart */ }
  return s;
}
export function saveSnap(s, storage) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!st) return;
  try { st.setItem(SNAP_KEY, JSON.stringify(s)); } catch (e) { /* noop */ }
}

/* ---------------- BURCHAK / VEKTOR ---------------- */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export function norm360(a) { a = a % 360; if (a < 0) a += 360; return (Math.abs(a) < 1e-9 || Math.abs(a - 360) < 1e-9) ? 0 : a; }
export function dirVec(deg) { const r = deg * D2R; return { dx: Math.cos(r), dy: -Math.sin(r) }; }
export function vecAng(dx, dy) { return norm360(Math.atan2(-dy, dx) * R2D); }
export function fmtAng(deg) { const r = Math.round(deg * 10) / 10; return (Number.isInteger(r) ? r : r.toFixed(1)) + '°'; }

/* ---------------- GEOMETRIYA ---------------- */
// Nuqtadan segmentgacha eng yaqin nuqta: {x,y,t,d} (t — 0..1 qisqartirilgan)
export function segClosest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx, y = a.y + t * dy;
  return { x, y, t, d: Math.hypot(p.x - x, p.y - y) };
}
// Cheksiz chiziqlar kesishmasi: {x,y,t,u} yoki null (parallel)
export function lineLineInt(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y, t, u };
}
// Segmentlar kesishmasi (uchlarini ham qo'shib): nuqta yoki null
export function segSegInt(a, b, c, d) {
  const r = lineLineInt(a, b, c, d);
  if (!r) return null;
  const e = 1e-9;
  if (r.t < -e || r.t > 1 + e || r.u < -e || r.u > 1 + e) return null;
  return { x: r.x, y: r.y };
}
// Segment × aylana kesishmalari (segment ichidagilar)
export function segCircleInts(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y, fx = a.x - c.x, fy = a.y - c.y;
  const A = dx * dx + dy * dy; if (A < 1e-18) return [];
  const B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  let disc = B * B - 4 * A * C;
  // Chegara NISBIY bo'lishi shart: yuzlab mm koordinatalarda B²−4AC ~1e10 bo'ladi va
  // tangens holatda yaxlitlash xatosi ~1e-5 — mutlaq 1e-9 bilan kesishma yo'qolardi.
  const tol = 1e-9 * Math.max(1, A) * Math.max(1, Math.abs(C));
  if (disc < -tol) return [];
  // TANGENS: diskriminant nolga teng (tolerans ichida) — ildiz BITTA. Uni shu yerda
  // hal qilamiz, aks holda yaxlitlash tufayli mikron oraliqda ikkita nuqta chiqadi.
  if (disc <= tol) {
    const t = -B / (2 * A);
    return (t >= -1e-9 && t <= 1 + 1e-9) ? [{ x: a.x + t * dx, y: a.y + t * dy }] : [];
  }
  disc = Math.sqrt(Math.max(0, disc));
  const out = [];
  for (const t of [(-B - disc) / (2 * A), (-B + disc) / (2 * A)]) {
    if (t >= -1e-9 && t <= 1 + 1e-9) out.push({ x: a.x + t * dx, y: a.y + t * dy });
  }
  // Tangens: ikki ildiz ~mikron oralig'ida chiqadi — bitta nuqtaga birlashtiramiz
  if (out.length === 2 && Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y) < 1e-6) out.pop();
  return out;
}
// Aylana × aylana kesishmalari
export function circleCircleInts(c1, r1, c2, r2) {
  const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > r1 + r2 + 1e-9 || d < Math.abs(r1 - r2) - 1e-9) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a, h = Math.sqrt(Math.max(0, h2));
  const mx = c1.x + a * dx / d, my = c1.y + a * dy / d;
  if (h < 1e-9) return [{ x: mx, y: my }];
  return [{ x: mx + h * dy / d, y: my - h * dx / d }, { x: mx - h * dy / d, y: my + h * dx / d }];
}
// Tashqi nuqtadan aylanaga tangens nuqtalari
export function tangentPoints(p, c, r) {
  const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
  if (d <= r + 1e-9) return [];
  const a = Math.acos(r / d), base = Math.atan2(dy, dx);
  return [base + a, base - a].map((t) => ({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }));
}

/* ---------------- GEOM QURISH ----------------
   Ikkala dvigatel elementlarini bitta shaklga keltiradi:
     { segs: [{a,b,eid}], circles: [{c,r,eid}], nodes: [{x,y,eid}] }
   Element turlari: line{x1,y1,x2,y2} · polyline/pline{pts,closed} · circle{cx,cy,r}
   dim{x1,y1,x2,y2} (uchlari tugun). opts: { skip(e), nodes:[], segs:[] } */
export function buildGeom(entities, opts = {}) {
  const segs = [], circles = [], nodes = [];
  // Buzuq (yo'q/NaN koordinatali) yozuvlar TASHLAB YUBORILADI — aks holda bitta
  // nuqsonli element butun chizmada magnitni NaN qilib qo'yardi.
  const ok = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const addSeg = (a, b, eid) => { if (ok(a) && ok(b)) segs.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, eid }); };
  const addNode = (p, eid) => { if (ok(p)) nodes.push({ x: p.x, y: p.y, eid }); };
  for (const e of entities || []) {
    if (!e || (opts.skip && opts.skip(e))) continue;
    const id = e.id;
    if (e.type === 'line') addSeg({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }, id);
    else if (e.type === 'polyline' || e.type === 'pline') {
      const p = Array.isArray(e.pts) ? e.pts : [];
      for (let i = 0; i + 1 < p.length; i++) addSeg(p[i], p[i + 1], id);
      if (e.closed && p.length > 2) addSeg(p[p.length - 1], p[0], id);
      if (p.length === 1) addNode(p[0], id);
    } else if (e.type === 'circle') {
      if (ok({ x: e.cx, y: e.cy }) && Number.isFinite(e.r) && e.r > 0) circles.push({ c: { x: e.cx, y: e.cy }, r: e.r, eid: id });
    } else if (e.type === 'dim') { addNode({ x: e.x1, y: e.y1 }, id); addNode({ x: e.x2, y: e.y2 }, id); }
  }
  for (const n of opts.nodes || []) if (ok(n)) nodes.push(n);
  for (const s of opts.segs || []) if (s && ok(s.a) && ok(s.b)) segs.push(s);
  return { segs, circles, nodes };
}
// Nuqtada tugaydigan segmentlarning yo'nalishlari (gradus, nuqtadan TASHQARIGA) — EXT kuzatish uchun
export function endpointDirs(geom, pt, eps = 1e-6) {
  const out = [];
  for (const s of geom.segs) {
    const atA = Math.hypot(s.a.x - pt.x, s.a.y - pt.y) < eps, atB = Math.hypot(s.b.x - pt.x, s.b.y - pt.y) < eps;
    if (atA) out.push(vecAng(s.a.x - s.b.x, s.a.y - s.b.y));   // a uchidan tashqariga: b -> a yo'nalishi
    if (atB) out.push(vecAng(s.b.x - s.a.x, s.b.y - s.a.y));
  }
  return out;
}

/* ---------------- OSNAP NOMZODLAR ----------------
   opts: { scale (px/mm), aperture (px), modes, from (PER/TAN uchun tayanch), skipEid }
   Qaytaradi: [{x,y,kind,eid,dPx,score}] — score bo'yicha tartiblangan, takrorsiz. */
export function osnapCandidates(geom, cur, opts) {
  const ap = opts.aperture || 12, sc = opts.scale || 1, m = opts.modes || DEFAULT_SNAP.modes;
  const skip = (eid) => opts.skipEid != null && eid === opts.skipEid;
  const out = [];
  // dPx — nomzodning "tortish" masofasi (px). Buzuq (NaN/undefined) koordinatalar
  // rad etiladi: `!(dPx <= ap)` — NaN bilan taqqoslash false bo'lib o'tib ketmasin.
  const add = (x, y, kind, eid, dPx) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dPx)) return;
    if (!(dPx <= ap + 1e-9)) return;
    out.push({ x, y, kind, eid, dPx, score: dPx + PRI_MUL[MODE_BY_KEY[kind].pri] * ap });
  };
  const push = (x, y, kind, eid) => add(x, y, kind, eid, Math.hypot(x - cur.x, y - cur.y) * sc);
  // Kursorga eng yaqin nomzodni tanlash (aylana PER/TAN — ikki nuqtadan biri)
  const nearest = (pts) => {
    let best = null, bd = Infinity;
    for (const p of pts) { const d = Math.hypot(p.x - cur.x, p.y - cur.y); if (d < bd) { bd = d; best = p; } }
    return best;
  };

  if (m.NOD) for (const n of geom.nodes) if (!skip(n.eid)) push(n.x, n.y, 'NOD', n.eid);

  const nearSegs = [];      // kursor apertura ichida turgan segmentlar (INT/PER/NEA)
  for (const s of geom.segs) {
    if (skip(s.eid)) continue;
    if (m.END) { push(s.a.x, s.a.y, 'END', s.eid); push(s.b.x, s.b.y, 'END', s.eid); }
    if (m.MID) push((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2, 'MID', s.eid);
    const cl = segClosest(cur, s.a, s.b);
    if (cl.d * sc <= ap) nearSegs.push({ s, cl });
  }
  const nearCirc = [];
  for (const c of geom.circles) {
    if (skip(c.eid)) continue;
    if (m.CEN) push(c.c.x, c.c.y, 'CEN', c.eid);
    if (m.QUA) { push(c.c.x + c.r, c.c.y, 'QUA', c.eid); push(c.c.x - c.r, c.c.y, 'QUA', c.eid); push(c.c.x, c.c.y + c.r, 'QUA', c.eid); push(c.c.x, c.c.y - c.r, 'QUA', c.eid); }
    const dc = Math.abs(Math.hypot(cur.x - c.c.x, cur.y - c.c.y) - c.r);
    if (dc * sc <= ap) nearCirc.push({ c, dPx: dc * sc });
  }
  // INT — kursorga yaqin element bilan qolganlarning kesishmasi
  if (m.INT) {
    for (const { s } of nearSegs) {
      for (const t of geom.segs) { if (t === s || skip(t.eid)) continue; const p = segSegInt(s.a, s.b, t.a, t.b); if (p) push(p.x, p.y, 'INT', s.eid); }
      for (const c of geom.circles) { if (skip(c.eid)) continue; for (const p of segCircleInts(s.a, s.b, c.c, c.r)) push(p.x, p.y, 'INT', s.eid); }
    }
    for (const { c } of nearCirc) {
      for (const c2 of geom.circles) { if (c2 === c || skip(c2.eid)) continue; for (const p of circleCircleInts(c.c, c.r, c2.c, c2.r)) push(p.x, p.y, 'INT', c.eid); }
      for (const t of geom.segs) { if (skip(t.eid)) continue; for (const p of segCircleInts(t.a, t.b, c.c, c.r)) push(p.x, p.y, 'INT', c.eid); }
    }
  }
  // PER / TAN — tayanch nuqta (from) bo'lsa; kursor OBYEKT ustida bo'lsa yetarli
  // (AutoCAD'dek: belgi perpendikulyar tushgan joyda chiqadi, kursor undan uzoq bo'lsa ham)
  if (opts.from) {
    const f = opts.from;
    if (m.PER) {
      for (const { s, cl } of nearSegs) {
        // AutoCAD: perpendikulyar chiziqning XAYOLIY DAVOMIGA ham tushadi (t chegarasi yo'q).
        // Oyoq `from` bilan bir joyda bo'lsa (from shu chiziq ustida) — nol uzunlikdagi
        // segment chiqmasligi uchun nomzod berilmaydi.
        const dxs = s.b.x - s.a.x, dys = s.b.y - s.a.y, L2 = dxs * dxs + dys * dys;
        if (L2 < 1e-12) continue;
        const t = ((f.x - s.a.x) * dxs + (f.y - s.a.y) * dys) / L2;
        const fx = s.a.x + t * dxs, fy = s.a.y + t * dys;
        if (Math.hypot(fx - f.x, fy - f.y) > 1e-6) add(fx, fy, 'PER', s.eid, cl.d * sc);
      }
      for (const { c, dPx } of nearCirc) {
        // Ikki oyoqdan KURSORGA YAQINI (AutoCAD kursor turgan tomonni beradi)
        const dx = f.x - c.c.x, dy = f.y - c.c.y, L = Math.hypot(dx, dy);
        if (L < 1e-9) continue;
        const p = nearest([{ x: c.c.x + dx / L * c.r, y: c.c.y + dy / L * c.r }, { x: c.c.x - dx / L * c.r, y: c.c.y - dy / L * c.r }]);
        if (p && Math.hypot(p.x - f.x, p.y - f.y) > 1e-6) add(p.x, p.y, 'PER', c.eid, dPx);
      }
    }
    // TAN — ikki tangens nuqtasidan kursorga yaqini
    if (m.TAN) for (const { c, dPx } of nearCirc) {
      const p = nearest(tangentPoints(f, c.c, c.r));
      if (p) add(p.x, p.y, 'TAN', c.eid, dPx);
    }
  }
  // NEA — obyekt ustidagi eng yaqin nuqta
  if (m.NEA) {
    for (const { s, cl } of nearSegs) push(cl.x, cl.y, 'NEA', s.eid);
    for (const { c } of nearCirc) { const dx = cur.x - c.c.x, dy = cur.y - c.c.y, L = Math.hypot(dx, dy) || 1; push(c.c.x + dx / L * c.r, c.c.y + dy / L * c.r, 'NEA', c.eid); }
  }
  out.sort((a, b) => a.score - b.score);
  const res = [];
  for (const c of out) if (!res.some((r) => Math.abs(r.x - c.x) < 1e-6 && Math.abs(r.y - c.y) < 1e-6)) res.push(c);
  return res;
}
export function osnapBest(geom, cur, opts) { const c = osnapCandidates(geom, cur, opts); return c.length ? c[0] : null; }

/* ---------------- ORTO / POLAR ----------------
   from -> cur yo'nalishini yaqin burchakka tekislaydi. Polar: kursor nurdan
   apertura (px) ichida bo'lsa. Qaytaradi {x,y,ang,kind:'ortho'|'polar'} yoki null. */
export function polarSnap(from, cur, s, scale) {
  const dx = cur.x - from.x, dy = cur.y - from.y, L = Math.hypot(dx, dy);
  if (L < 1e-9) return null;
  const a = vecAng(dx, dy);
  if (s.ortho) {
    const ang = norm360(Math.round(a / 90) * 90), v = dirVec(ang);
    const proj = Math.max(0, dx * v.dx + dy * v.dy);
    return { x: from.x + v.dx * proj, y: from.y + v.dy * proj, ang, kind: 'ortho' };
  }
  if (s.polar) {
    const inc = s.polarInc || 15;
    const ang = norm360(Math.round(a / inc) * inc), v = dirVec(ang);
    const perp = Math.abs(dx * v.dy - dy * v.dx) * (scale || 1);
    const proj = dx * v.dx + dy * v.dy;
    if (perp <= (s.aperture || 12) && proj > 0) return { x: from.x + v.dx * proj, y: from.y + v.dy * proj, ang, kind: 'polar' };
  }
  return null;
}
// Kuzatish burchaklari to'plami (0..180 — chiziq ikki tomonga davom etadi)
export function trackAngles(s) {
  if (s.polar && !s.ortho) { const inc = s.polarInc || 15, out = []; for (let a = 0; a < 180 - 1e-9; a += inc) out.push(norm360(a)); return out; }
  return [0, 90];
}

/* ---------------- OBYEKT KUZATISH (OTRACK) ----------------
   acquired: [{x,y,dirs?:[deg]}] — olingan nuqtalar (dirs — EXT davomi yo'nalishlari).
   polarRes — polarSnap natijasi (from bilan) — kuzatish chizig'i × polar nur kesishmasi uchun.
   Qaytaradi {x,y,kind:'otrack'|'otrack-int',lines:[{A,ang}]} yoki null. */
export function trackSnap(acquired, cur, s, scale, polarRes, from, guides) {
  const tol = s.aperture || 12, sc = scale || 1;
  const angs = trackAngles(s);
  const extOn = !!(s.modes && s.modes.EXT);
  const otrackOn = s.otrack !== false;   // aniq o'chirilgan bo'lsagina kuzatish burchaklari olinmaydi
  const lines = [];
  // BOG'LANISH (proyeksiya) chiziqlari — chizma geometriya: boshqa proyeksiyadagi uchdan o'tuvchi
  // cheksiz gorizontal/vertikal chiziqlar. OTRACK holatiga bog'liq emas, "olish" ham shart emas.
  for (const gd of guides || []) {
    if (!gd || !Number.isFinite(gd.x) || !Number.isFinite(gd.y) || !Number.isFinite(gd.ang)) continue;
    const v = dirVec(gd.ang), dx = cur.x - gd.x, dy = cur.y - gd.y;
    const perp = Math.abs(dx * v.dy - dy * v.dx) * sc;
    if (perp > tol) continue;
    const proj = dx * v.dx + dy * v.dy;
    lines.push({ A: { x: gd.x, y: gd.y }, ang: norm360(gd.ang), v, x: gd.x + v.dx * proj, y: gd.y + v.dy * proj, perp, guide: true, fwd: false });
  }
  for (const A of acquired || []) {
    const set = [];
    // OTRACK o'chiq bo'lsa faqat EXT (chiziq davomi) ishlaydi — AutoCAD'da EXT
    // mustaqil obyekt yopishish rejimi, kuzatishga bog'liq emas.
    if (otrackOn) for (const a of angs) set.push({ ang: a, ext: false, fwd: false });
    if (extOn && Array.isArray(A.dirs)) for (const d of A.dirs) set.push({ ang: norm360(d), ext: true, fwd: true });
    for (const it of set) {
      const v = dirVec(it.ang), dx = cur.x - A.x, dy = cur.y - A.y;
      const perp = Math.abs(dx * v.dy - dy * v.dx) * sc;
      if (perp > tol) continue;
      const proj = dx * v.dx + dy * v.dy;
      if (it.fwd && proj <= 0) continue;            // davomi faqat oldinga
      lines.push({ A, ang: it.ang, v, x: A.x + v.dx * proj, y: A.y + v.dy * proj, perp, ext: it.ext, fwd: it.fwd });
    }
  }
  if (!lines.length) return null;
  const cands = lines.slice();
  // Polar/orto NUR — faqat oldinga (from dan boshlab), orqasi kesishmaga kirmaydi
  if (polarRes && from) cands.push({ A: from, ang: polarRes.ang, v: dirVec(polarRes.ang), x: polarRes.x, y: polarRes.y, perp: 0, polar: true, fwd: true });
  const onRay = (L, p) => !L.fwd || ((p.x - L.A.x) * L.v.dx + (p.y - L.A.y) * L.v.dy) > 1e-9;
  let best = null;
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
    const L1 = cands[i], L2 = cands[j];
    if (L1.A === L2.A) continue;
    // Ikki chiziq bir xil yo'nalishda bo'lsa (parallel/ustma-ust) kesishma ma'nosiz
    if (Math.abs(L1.v.dx * L2.v.dy - L1.v.dy * L2.v.dx) < 1e-9) continue;
    const p = lineLineInt(L1.A, { x: L1.A.x + L1.v.dx, y: L1.A.y + L1.v.dy }, L2.A, { x: L2.A.x + L2.v.dx, y: L2.A.y + L2.v.dy });
    if (!p || !onRay(L1, p) || !onRay(L2, p)) continue;
    const d = Math.hypot(p.x - cur.x, p.y - cur.y) * sc;
    if (d <= tol * 1.5 && (!best || d < best.d)) best = { x: p.x, y: p.y, d, kind: (L1.guide && L2.guide) ? 'proj-int' : 'otrack-int', lines: [L1, L2] };
  }
  if (best) return best;
  lines.sort((a, b) => a.perp - b.perp);
  const L = lines[0];
  return { x: L.x, y: L.y, d: L.perp, kind: L.guide ? 'proj' : (L.ext ? 'EXT' : 'otrack'), lines: [L] };
}

/* ---------------- YAKUNIY: resolveSnap ----------------
   ctx = { geom, cur, scale, settings, from, skipEid, acquired, gridStep }
   Ustunlik: OSNAP (haqiqiy geometriya) > kuzatish kesishmasi > polar/orto nur >
             kuzatish chizig'i > to'r > xom kursor.
   Qaytaradi: { x, y, kind, snap:{x,y,kind,eid}|null, tracks:[{from,to,ang,polar}], tip } */
export function resolveSnap(ctx) {
  const { geom, cur, scale, from } = ctx;
  const s = ctx.settings || DEFAULT_SNAP;
  const res = { x: cur.x, y: cur.y, kind: 'raw', snap: null, tracks: [], tip: '' };
  if (s.osnap && geom) {
    const best = osnapBest(geom, cur, { scale, aperture: s.aperture, modes: s.modes, from, skipEid: ctx.skipEid });
    if (best) { res.x = best.x; res.y = best.y; res.kind = best.kind; res.snap = best; res.tip = modeName(best.kind); return res; }
  }
  const polarRes = from ? polarSnap(from, cur, s, scale) : null;
  const guides = Array.isArray(ctx.guides) ? ctx.guides : [];
  const acq = Array.isArray(ctx.acquired) ? ctx.acquired : [];
  const trackOn = ((s.otrack || (s.modes && s.modes.EXT)) && acq.length) || guides.length;
  const tr = trackOn ? trackSnap(acq, cur, s, scale, polarRes, from, guides) : null;
  // KESISHMA (kuzatish yoki proyeksiya) hammadan ustun; oddiy chiziq esa polar nurdan keyin
  // (AutoCAD: polar nur ustida bo'lsa polar, kesishma bo'lsa kesishma).
  if (tr && (tr.kind === 'otrack-int' || tr.kind === 'proj-int' || !polarRes)) {
    res.x = tr.x; res.y = tr.y; res.kind = tr.kind;
    res.tracks = tr.lines.map((L) => ({ from: { x: L.A.x, y: L.A.y }, to: { x: tr.x, y: tr.y }, ang: L.ang, polar: !!(L.polar || L.fwd), guide: !!L.guide }));
    res.tip = tr.kind === 'otrack-int' ? 'Kuzatish kesishmasi'
      : tr.kind === 'proj-int' ? 'Proyeksiya kesishmasi'
        : tr.kind === 'proj' ? 'Proyeksiya ' + fmtAng(tr.lines[0].ang)
          : (tr.kind === 'EXT' ? 'Davomi ' + fmtAng(tr.lines[0].ang) : 'Kuzatish ' + fmtAng(tr.lines[0].ang));
    return res;
  }
  if (polarRes) {
    res.x = polarRes.x; res.y = polarRes.y; res.kind = polarRes.kind;
    res.tracks = [{ from: { x: from.x, y: from.y }, to: { x: polarRes.x, y: polarRes.y }, ang: polarRes.ang, polar: true }];
    res.tip = (polarRes.kind === 'ortho' ? 'Orto ' : 'Polar ') + fmtAng(polarRes.ang);
    return res;
  }
  if (s.gridSnap && ctx.gridStep > 0) {
    const g = ctx.gridStep;
    res.x = Math.round(cur.x / g) * g; res.y = Math.round(cur.y / g) * g; res.kind = 'grid';
  }
  return res;
}

/* ---------------- OTRACK: nuqta "olish" (acquire) ----------------
   track = { hover: {x,y,since}|null, acq: [] }. Har mousemove'da chaqiriladi.
   Yopishgan nuqta ustida acquireMs turilsa — acq ro'yxatiga (eng ko'pi 3) qo'shiladi.
   Qaytaradi true — yangi nuqta olindi. */
export const MAX_ACQUIRED = 7;   // AutoCAD ham 7 tagacha nuqta "oladi"
export function updateAcquire(track, res, now, geom, s) {
  const settings = s || DEFAULT_SNAP;
  const on = settings.otrack || (settings.modes && settings.modes.EXT);
  if (!on || !res.snap) { track.hover = null; return false; }
  const p = res.snap;
  if (track.hover && Math.abs(track.hover.x - p.x) < 1e-6 && Math.abs(track.hover.y - p.y) < 1e-6) {
    if (now - track.hover.since >= (settings.acquireMs || 250) && !track.hover.done) {
      track.hover.done = true;
      const i = track.acq.findIndex((a) => Math.abs(a.x - p.x) < 1e-6 && Math.abs(a.y - p.y) < 1e-6);
      // AutoCAD: olingan nuqta ustida qayta turilsa — OLIB TASHLANADI
      if (i >= 0) { track.acq.splice(i, 1); return true; }
      track.acq.unshift({ x: p.x, y: p.y, dirs: geom ? endpointDirs(geom, p) : [] });
      if (track.acq.length > MAX_ACQUIRED) track.acq.length = MAX_ACQUIRED;
      return true;
    }
    return false;
  }
  track.hover = { x: p.x, y: p.y, since: now, done: false };
  return false;
}

/* ---------------- TO'R QADAMI (avto) ---------------- */
export function autoGridStep(scale, minPx = 22) {
  const cand = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  return cand.find((c) => c * scale >= minPx) || 5000;
}
export function gridStepFor(s, scale) { return (s && s.gridStep > 0) ? s.gridStep : autoGridStep(scale); }

/* ---------------- SVG BELGILAR (AutoCAD marker shakllari) ----------------
   Qaytaradi [{tag, attrs}] — dvigatel svgEl bilan yaratadi. r — belgi radiusi (px). */
export function snapMarkerShapes(kind, sx, sy, col, r = 6) {
  const m = MODE_BY_KEY[kind];
  const shape = m ? m.marker : null;
  const base = { stroke: col, 'stroke-width': 1.6, fill: 'none', 'pointer-events': 'none' };
  const L = (x1, y1, x2, y2) => ({ tag: 'line', attrs: Object.assign({ x1: sx + x1, y1: sy + y1, x2: sx + x2, y2: sy + y2 }, base) });
  if (shape === 'square') return [{ tag: 'rect', attrs: Object.assign({ x: sx - r, y: sy - r, width: 2 * r, height: 2 * r }, base) }];
  if (shape === 'triangle') return [{ tag: 'polygon', attrs: Object.assign({ points: `${sx},${sy - r * 1.15} ${sx - r * 1.1},${sy + r * 0.75} ${sx + r * 1.1},${sy + r * 0.75}` }, base) }];
  if (shape === 'circle') return [{ tag: 'circle', attrs: Object.assign({ cx: sx, cy: sy, r }, base) }];
  if (shape === 'node') return [{ tag: 'circle', attrs: Object.assign({ cx: sx, cy: sy, r }, base) }, L(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7), L(-r * 0.7, r * 0.7, r * 0.7, -r * 0.7)];
  if (shape === 'diamond') return [{ tag: 'polygon', attrs: Object.assign({ points: `${sx},${sy - r * 1.2} ${sx + r * 1.2},${sy} ${sx},${sy + r * 1.2} ${sx - r * 1.2},${sy}` }, base) }];
  if (shape === 'x') return [L(-r, -r, r, r), L(-r, r, r, -r)];
  if (shape === 'perp') return [L(-r, -r, -r, r), L(-r, r, r, r), L(-r, 0, 0, 0), L(0, 0, 0, r)];
  if (shape === 'tan') return [{ tag: 'circle', attrs: Object.assign({ cx: sx, cy: sy + r * 0.3, r: r * 0.85 }, base) }, L(-r * 1.2, -r * 0.55, r * 1.2, -r * 0.55)];
  if (shape === 'hourglass') return [{ tag: 'polygon', attrs: Object.assign({ points: `${sx - r},${sy - r} ${sx + r},${sy - r} ${sx - r},${sy + r} ${sx + r},${sy + r}` }, base) }];
  if (shape === 'ext') return [{ tag: 'rect', attrs: Object.assign({ x: sx - r, y: sy - r, width: 2 * r, height: 2 * r, 'stroke-dasharray': '2 2' }, base) }];
  // kuzatish/polar/to'r — kichik "+" belgisi
  return [L(-r, 0, r, 0), L(0, -r, 0, r)];
}
