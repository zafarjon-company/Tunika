// ============================================================
//  EGRI CHIZIQLAR VA IZOHLAR — TESTLAR (Ellips, Splayn, Matn, O'lchamlar)
//  Ishga tushirish:  node src/lib/curveGeom.test.mjs   (npm run test:curve)
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° tepa, CCW musbat.
// ============================================================
import assert from 'node:assert/strict';
import { ellipsePoint, ellipsePts, ellipseSegs, ellipseFromCenter, ellipseFromAxis, distToAxis, ellipseGrips, ellipseMap, ellipsePerim, splinePts, textBox, distToTextBox, textMap, linearRot, rotatedDim, rotatedOff, angularDim, lineInt, radialDim } from './curveGeom.js';

let jami = 0, xato = 0;
function test(nom, fn) {
  jami += 1;
  try { fn(); console.log(`  ✅ ${nom}`); }
  catch (e) { xato += 1; console.log(`  ❌ ${nom}\n` + String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n')); }
}
const near = (o, k, eps = 1e-7, nom = '') => assert.ok(Math.abs(o - k) <= eps, `${nom} kutilgan ${k}, olingan ${o}`);
const ptNear = (o, k, eps = 1e-7, nom = '') => { near(o.x, k.x, eps, nom + '.x'); near(o.y, k.y, eps, nom + '.y'); };
const P = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

console.log('\n— Ellips —');
test('ellipsePoint: rot 0 — t=0 → (cx+rx, cy), t=90 → TEPA (cx, cy−ry)', () => {
  const e = { cx: 10, cy: 20, rx: 50, ry: 30, rot: 0 };
  ptNear(ellipsePoint(e, 0), P(60, 20)); ptNear(ellipsePoint(e, 90), P(10, -10)); ptNear(ellipsePoint(e, 180), P(-40, 20));
});
test('ellipsePoint: rot 90 — 1-o\'q tepaga', () => {
  const e = { cx: 0, cy: 0, rx: 50, ry: 30, rot: 90 };
  ptNear(ellipsePoint(e, 0), P(0, -50)); ptNear(ellipsePoint(e, 90), P(-30, 0));
});
test('ellipsePts: hamma nuqta ellips tenglamasida; soni cho\'ziqlikka qarab 72..256', () => {
  const e = { cx: 5, cy: -5, rx: 80, ry: 20, rot: 30 };
  const pts = ellipsePts(e);
  assert.equal(pts.length, ellipseSegs(e)); assert.ok(pts.length >= 72 && pts.length <= 256);
  const r = 30 * Math.PI / 180;
  const u = { x: Math.cos(r), y: -Math.sin(r) }, v = { x: -Math.sin(r), y: -Math.cos(r) };   // dirVec(30), dirVec(120)
  for (const p of pts) {
    const dx = p.x - 5, dy = p.y + 5;
    const a = dx * u.x + dy * u.y, b = dx * v.x + dy * v.y;
    near((a * a) / 6400 + (b * b) / 400, 1, 1e-6);
  }
  assert.equal(ellipseSegs({ rx: 10, ry: 10 }), 72);
  assert.ok(ellipseSegs({ rx: 400, ry: 10 }) === 256);
});
test('ellipseFromCenter / FromAxis: markaz, radiuslar, burchak; nol o\'q → null', () => {
  const a = ellipseFromCenter(P(0, 0), P(0, -40), 15);
  near(a.rx, 40); near(a.ry, 15); near(a.rot, 90);
  const b = ellipseFromAxis(P(-50, 0), P(50, 0), 20);
  near(b.cx, 0); near(b.cy, 0); near(b.rx, 50); near(b.rot, 0);
  assert.equal(ellipseFromCenter(P(1, 1), P(1, 1), 5), null);
  assert.equal(ellipseFromAxis(P(0, 0), P(10, 0), 0), null);
});
test('distToAxis: 2-o\'q yarim uzunligi — o\'q chizig\'igacha tik masofa', () => {
  near(distToAxis(P(0, 0), P(100, 0), P(37, -25)), 25);
  near(distToAxis(P(0, 0), P(0, -100), P(12, -60)), 12);
});
test('ellipseMap: burish 90° va masshtab 2 — griplar mos', () => {
  const e = { cx: 10, cy: 0, rx: 40, ry: 10, rot: 0 };
  const rot = (p) => ({ x: p.y, y: -p.x });   // (0,0) atrofida 90° CCW (y pastga)
  const r = ellipseMap(e, rot);
  near(r.cx, 0); near(r.cy, -10); near(r.rx, 40); near(r.ry, 10); near(r.rot, 90);
  const s = ellipseMap(e, (p) => ({ x: p.x * 2, y: p.y * 2 }));
  near(s.rx, 80); near(s.ry, 20); near(s.cx, 20);
  const g = ellipseGrips(e); ptNear(g.a, P(50, 0)); ptNear(g.b, P(10, -10));
});
test('ellipsePerim: aylana → 2πr; polyline perimetriga yaqin', () => {
  near(ellipsePerim({ rx: 10, ry: 10 }), 2 * Math.PI * 10, 1e-9);
  const e = { cx: 0, cy: 0, rx: 60, ry: 25, rot: 0 }, pts = ellipsePts(e, 2000);
  let L = 0; for (let i = 0; i < pts.length; i++) L += dist(pts[i], pts[(i + 1) % pts.length]);
  near(ellipsePerim(e), L, 0.01);
});

console.log('\n— Splayn —');
test('splinePts: har bir fit nuqtadan o\'tadi (ochiq), oxirgi nuqta — oxirgi fit', () => {
  const fit = [P(0, 0), P(50, -40), P(100, 0), P(150, -30)];
  const s = splinePts(fit, false, 16);
  assert.equal(s.length, 3 * 16 + 1);
  for (let i = 0; i < 3; i++) ptNear(s[i * 16], fit[i], 1e-9);
  ptNear(s[s.length - 1], fit[3], 1e-9);
});
test('splinePts: yopiq — n·perSpan nuqta, fit nuqtalardan o\'tadi', () => {
  const fit = [P(0, 0), P(100, 0), P(100, 100), P(0, 100)];
  const s = splinePts(fit, true, 10);
  assert.equal(s.length, 40);
  for (let i = 0; i < 4; i++) ptNear(s[i * 10], fit[i], 1e-9);
});
test('splinePts: 2 nuqta → to\'g\'ri chiziq; takror nuqtalar tashlanadi; NaN yo\'q', () => {
  const s = splinePts([P(0, 0), P(0, 0), P(10, 0)], false);
  assert.equal(s.length, 2);
  const t = splinePts([P(0, 0), P(10, 0), P(10, 0), P(20, 10)], false, 8);
  assert.ok(t.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)));
});
test('splinePts: kollinear nuqtalar — egri chiziq ustida qoladi (tebranmaydi)', () => {
  const s = splinePts([P(0, 0), P(10, 0), P(30, 0), P(35, 0)], false, 12);
  for (const q of s) near(q.y, 0, 1e-9);
});

console.log('\n— Matn —');
test('textBox: rot 0 — pastki chap qo\'yish nuqtasi, tepaga h', () => {
  const b = textBox({ x: 10, y: 0, h: 5, rot: 0 }, 20);
  ptNear(b[0], P(10, 1.5)); ptNear(b[1], P(30, 1.5)); ptNear(b[2], P(30, -5)); ptNear(b[3], P(10, -5));
});
test('distToTextBox: ichida 0, tashqarida — qutigacha', () => {
  const t = { x: 0, y: 0, h: 10, rot: 0 };
  near(distToTextBox(t, 50, P(25, -5)), 0);
  near(distToTextBox(t, 50, P(60, -5)), 10);
  near(distToTextBox({ x: 0, y: 0, h: 10, rot: 90 }, 50, P(-5, -25)), 0);
});
test('textMap: ko\'chirish/burish — nuqta va burchak; masshtab — balandlik', () => {
  const t = { x: 10, y: 0, h: 5, rot: 0 };
  const m = textMap(t, 20, (p) => ({ x: p.x + 5, y: p.y - 3 }));
  near(m.x, 15); near(m.y, -3); near(m.rot, 0); near(m.h, 5);
  const r = textMap(t, 20, (p) => ({ x: p.y, y: -p.x }));   // 90° CCW
  near(r.x, 0); near(r.y, -10); near(r.rot, 90);
  const s = textMap(t, 20, (p) => ({ x: p.x * 3, y: p.y * 3 }));
  near(s.h, 15); near(s.x, 30);
});
test('textMap: aks ettirish (MIRRTEXT=0) — yozuv teskari bo\'lmaydi, quti aks etgan joyda', () => {
  const t = { x: 10, y: 0, h: 5, rot: 0 };
  const m = textMap(t, 20, (p) => ({ x: -p.x, y: p.y }));   // vertikal o'q x=0
  near(m.rot, 0); near(m.x, -30, 1e-9); near(m.y, 0, 1e-9); near(m.h, 5);
  const h = textMap(t, 20, (p) => ({ x: p.x, y: -p.y }));   // gorizontal o'q
  near(h.rot, 0); near(h.x, 10, 1e-9);
});

console.log('\n— O\'lchamlar —');
test('linearRot: nuqtalar orasida tepada/pastda → gorizontal (0), yonida → vertikal (90)', () => {
  const a = P(0, 0), b = P(100, -60);
  assert.equal(linearRot(a, b, P(50, -120)), 0);
  assert.equal(linearRot(a, b, P(50, 40)), 0);
  assert.equal(linearRot(a, b, P(160, -30)), 90);
  assert.equal(linearRot(a, b, P(-40, -30)), 90);
});
test('rotatedDim: gorizontal — qiymat |Δx|, o\'lcham chizig\'i off balandlikda', () => {
  const e = { x1: 0, y1: 0, x2: 100, y2: -60, rot: 0, off: 0 };
  e.off = rotatedOff(P(0, 0), 0, P(50, -100));
  near(e.off, 100);
  const r = rotatedDim(e);
  near(r.value, 100); ptNear(r.a, P(0, -100)); ptNear(r.b, P(100, -100));
  const v = rotatedDim({ x1: 0, y1: 0, x2: 100, y2: -60, rot: 90, off: rotatedOff(P(0, 0), 90, P(150, -30)) });
  near(v.value, 60); ptNear(v.a, P(150, 0)); ptNear(v.b, P(150, -60));
});
test('angularDim: 90° burchak, joy ichkarida → 90; qarama-qarshi sektorda ham 90, qo\'shnisida 90', () => {
  const e = { cx: 0, cy: 0, x1: 100, y1: 0, x2: 0, y2: -100, lx: 30, ly: -30 };
  const a = angularDim(e);
  near(a.sweep, 90); near(a.a0, 0); near(a.a1, 90); near(a.r, Math.hypot(30, 30));
  near(a.lo.from, 100); near(a.hi.from, 100);
  const b = angularDim(Object.assign({}, e, { lx: -30, ly: 30 }));
  near(b.sweep, 90); near(b.a0, 180); near(b.lo.from, 0);
});
test('angularDim: 30° va 150° sektorlar', () => {
  const c = Math.cos(30 * Math.PI / 180) * 100, s = Math.sin(30 * Math.PI / 180) * 100;
  const e = { cx: 0, cy: 0, x1: 100, y1: 0, x2: c, y2: -s, lx: 50, ly: -10 };
  near(angularDim(e).sweep, 30, 1e-9);
  near(angularDim(Object.assign({}, e, { lx: 0, ly: -50 })).sweep, 150, 1e-9);
});
test('angularDim: joy nur ustida (magnit) — 0° emas, qo\'shni sektor', () => {
  const e = { cx: 0, cy: 0, x1: 100, y1: 0, x2: 0, y2: -100, lx: 50, ly: 0 };
  near(angularDim(e).sweep, 90); near(angularDim(e).a0, 0);
  near(angularDim(Object.assign({}, e, { lx: 0, ly: -40 })).sweep, 90);
});
test('angularDim (yoy, arc:true): 270° va 200° yoy — to\'liq burchak (180° dan katta)', () => {
  const a = angularDim({ arc: true, cx: 0, cy: 0, x1: 100, y1: 0, x2: 0, y2: 100, lx: -70, ly: -70 });
  near(a.sweep, 270); near(a.a0, 0); near(a.a1, 270);
  const c = Math.cos(200 * Math.PI / 180) * 50, s = Math.sin(200 * Math.PI / 180) * 50;
  near(angularDim({ arc: true, cx: 0, cy: 0, x1: 50, y1: 0, x2: c, y2: -s, lx: 0, ly: -60 }).sweep, 200, 1e-9);
});
test('lineInt: kesishma; parallel → null', () => {
  ptNear(lineInt(P(0, 0), P(10, 0), P(5, -5), P(5, 5)), P(5, 0));
  assert.equal(lineInt(P(0, 0), P(10, 0), P(0, 5), P(10, 5)), null);
});
test('radialDim: yo\'nalish nuqtasi aylana tashqarisida/ichida; P aylanada, Q qarama-qarshi', () => {
  const r = radialDim({ x1: 0, y1: 0, x2: 30, y2: -40, r: 25 });
  ptNear(r.P, P(15, -20)); ptNear(r.Q, P(-15, 20)); assert.equal(r.out, true);
  assert.equal(radialDim({ x1: 0, y1: 0, x2: 3, y2: 4, r: 25 }).out, false);
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
