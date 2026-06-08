import { Jimp } from 'jimp';

// Qora chiziqning markaziy yo'lini (skelet) topib, butun bo'ylab BITTA tomonga
// parallel suradi (CAD OFFSET) va qora qalinlikda rangli yo'lak chizadi.
const IN = process.argv[2];
const OUT = process.argv[3];
const DBG = process.argv[4] || '';
const SIDE = Number(process.argv[5] || 1);   // +1 yoki -1 (qaysi tomon)

const img = await Jimp.read(IN);
const W = img.bitmap.width, H = img.bitmap.height, d = img.bitmap.data;
const P = new Uint8Array(W * H);
let strokeCount = 0;
for (let i = 0; i < W * H; i++) { if (d[i * 4 + 3] > 128) { P[i] = 1; strokeCount++; } }
const ix = (x, y) => y * W + x;

// ---- Zhang-Suen skeletonizatsiya ----
function neighbors(x, y) {
  return [P[ix(x, y - 1)], P[ix(x + 1, y - 1)], P[ix(x + 1, y)], P[ix(x + 1, y + 1)],
          P[ix(x, y + 1)], P[ix(x - 1, y + 1)], P[ix(x - 1, y)], P[ix(x - 1, y - 1)]];
}
let changed = true;
while (changed) {
  changed = false;
  for (let step = 0; step < 2; step++) {
    const clear = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!P[ix(x, y)]) continue;
      const [p2, p3, p4, p5, p6, p7, p8, p9] = neighbors(x, y);
      const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      if (B < 2 || B > 6) continue;
      const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
      let A = 0; for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) A++;
      if (A !== 1) continue;
      if (step === 0) { if (p2 * p4 * p6 !== 0) continue; if (p4 * p6 * p8 !== 0) continue; }
      else { if (p2 * p4 * p8 !== 0) continue; if (p2 * p6 * p8 !== 0) continue; }
      clear.push(ix(x, y));
    }
    if (clear.length) { changed = true; for (const i of clear) P[i] = 0; }
  }
}

// ---- Skelet grafi; diametr (eng uzun yo'l) — markaziy chiziq ----
const sk = [];
for (let i = 0; i < W * H; i++) if (P[i]) sk.push(i);
const adj = new Map();
for (const i of sk) {
  const x = i % W, y = (i / W) | 0; const nb = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    if (P[ix(xx, yy)]) nb.push(ix(xx, yy));
  }
  adj.set(i, nb);
}
function bfs(start) {
  const prev = new Map(); prev.set(start, -1); const q = [start]; let last = start;
  for (let h = 0; h < q.length; h++) { const u = q[h]; last = u; for (const v of adj.get(u)) if (!prev.has(v)) { prev.set(v, u); q.push(v); } }
  return { last, prev };
}
// Eng katta bog'langan komponent (ilmoq/uzilishlardan himoya)
const seen = new Set(); let bestComp = [];
for (const s of sk) {
  if (seen.has(s)) continue;
  const comp = []; const q = [s]; seen.add(s);
  for (let h = 0; h < q.length; h++) { const u = q[h]; comp.push(u); for (const v of adj.get(u)) if (!seen.has(v)) { seen.add(v); q.push(v); } }
  if (comp.length > bestComp.length) bestComp = comp;
}
const a = bfs(bestComp[0]).last;
const { last: b, prev } = bfs(a);
const path = []; for (let c = b; c !== -1; c = prev.get(c)) path.push([c % W, (c / W) | 0]);

// ---- Qalinlik ----
const T = Math.max(3, Math.round(strokeCount / path.length));
const D = T;            // tegib turishi uchun markazlar orasi = qalinlik
const r = T / 2;

// ---- Offset nuqtalari (bitta tomon) ----
const win = 5;
const off = [];
for (let i = 0; i < path.length; i++) {
  const i0 = Math.max(0, i - win), i1 = Math.min(path.length - 1, i + win);
  let tx = path[i1][0] - path[i0][0], ty = path[i1][1] - path[i0][1];
  const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
  const nx = -ty * SIDE, ny = tx * SIDE;   // normal (bitta tomon)
  off.push([path[i][0] + nx * D, path[i][1] + ny * D]);
}

// ---- Offset yo'lakни qalin chizish (disk stamp) ----
const M = new Uint8Array(W * H);
function disk(cx, cy) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r) M[ix(x, y)] = 1;
  }
}
for (let i = 0; i < off.length - 1; i++) {
  const [x1, y1] = off[i], [x2, y2] = off[i + 1];
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let s = 0; s <= steps; s++) { const t = s / steps; disk(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t); }
}

// ---- Chiqish: oq yo'lak, shaffof ----
const out = img.clone(); const od = out.bitmap.data;
for (let i = 0; i < W * H; i++) { od[i * 4] = 255; od[i * 4 + 1] = 255; od[i * 4 + 2] = 255; od[i * 4 + 3] = M[i] ? 255 : 0; }
await out.write(OUT);
console.log(`OK → ${OUT}  T=${T} band:${M.reduce((s, v) => s + v, 0)}`);

if (DBG) {
  const dbg = img.clone(); const gd = dbg.bitmap.data;
  for (let i = 0; i < W * H; i++) if (M[i]) { gd[i * 4] = 230; gd[i * 4 + 1] = 0; gd[i * 4 + 2] = 0; gd[i * 4 + 3] = 255; }
  await dbg.write(DBG); console.log(`DBG → ${DBG}`);
}
