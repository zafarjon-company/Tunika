import { Jimp } from 'jimp';

// AutoCAD eksport (oq fon + qora chiziq + pastki footer matn) → shaffof PNG.
// ① qora chiziqni aniqlaydi (oq→shaffof), ② footer matn / begona belgilarni
// olib tashlaydi (faqat ENG KATTA bog'langan komponent qoladi), ③ chiziqni
// dilation bilan qalinlashtiradi (R), ④ alpha bbox bo'yicha kesadi.
const IN = process.argv[2];
const OUT = process.argv[3];
const R = Number(process.argv[4] || 7);   // dilation radiusi
const PAD = Number(process.argv[5] || 12); // kesishdan keyingi atrof bo'shliq

const img = await Jimp.read(IN);
const W = img.bitmap.width, H = img.bitmap.height, d = img.bitmap.data;
const ix = (x, y) => y * W + x;

// ① qora (chiziq) pikselni belgilash — qorong'u bo'lsa stroke
const S = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
  if ((r + g + b) / 3 < 150) S[i] = 1;
}

// ② eng katta bog'langan komponent (8-qo'shni) — footer matn alohida qoladi → o'chadi
const comp = new Int32Array(W * H).fill(-1);
let best = -1, bestSize = 0, cid = 0;
for (let s = 0; s < W * H; s++) {
  if (!S[s] || comp[s] !== -1) continue;
  const q = [s]; comp[s] = cid; let size = 0;
  for (let h = 0; h < q.length; h++) {
    const u = q[h]; size++;
    const x = u % W, y = (u / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const v = ix(xx, yy);
      if (S[v] && comp[v] === -1) { comp[v] = cid; q.push(v); }
    }
  }
  if (size > bestSize) { bestSize = size; best = cid; }
  cid++;
}
const K = new Uint8Array(W * H); // tozalangan chiziq
for (let i = 0; i < W * H; i++) if (comp[i] === best) K[i] = 1;

// ③ dilation (disk R) — chiziqni qalinlashtirish
const offs = [];
for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
  if (dx * dx + dy * dy <= R * R) offs.push([dx, dy]);
}
const D2 = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!K[ix(x, y)]) continue;
  for (const [dx, dy] of offs) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    D2[ix(xx, yy)] = 1;
  }
}

// qora + shaffof rasm yasash
for (let i = 0; i < W * H; i++) {
  d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0;
  d[i * 4 + 3] = D2[i] ? 255 : 0;
}

// ④ alpha bbox
let minx = W, miny = H, maxx = 0, maxy = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D2[ix(x, y)]) {
  if (x < minx) minx = x; if (x > maxx) maxx = x;
  if (y < miny) miny = y; if (y > maxy) maxy = y;
}
minx = Math.max(0, minx - PAD); miny = Math.max(0, miny - PAD);
maxx = Math.min(W - 1, maxx + PAD); maxy = Math.min(H - 1, maxy + PAD);
const cw = maxx - minx + 1, ch = maxy - miny + 1;
img.crop({ x: minx, y: miny, w: cw, h: ch });
await img.write(OUT);
console.log(`OK → ${OUT}  ${cw}x${ch}  R=${R} band:${bestSize}`);
