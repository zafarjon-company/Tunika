// ============================================================
//  TAHRIR GEOMETRIYASI — TESTLAR (Break, Stretch, Lengthen, Polygon, Divide/Measure, Area)
//  Ishga tushirish:  node src/lib/editGeom.test.mjs   (npm run test:edit)
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° tepa, CCW musbat.
// ============================================================
import assert from 'node:assert/strict';
import { plinePath, pathProject, pathPoint, pathSub, breakEnt, stretchEnt, entLength, lengthenEnt, polygonPts, polygonEdge, divideEnt, measureEnt, polyArea, polyPerim, chainArea, areaOfEnt } from './editGeom.js';
import { buildChains } from './chainOffset.js';

let jami = 0, xato = 0;
function test(nom, fn) {
  jami += 1;
  try { fn(); console.log(`  ✅ ${nom}`); }
  catch (e) { xato += 1; console.log(`  ❌ ${nom}\n` + String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n')); }
}
const near = (o, k, eps = 1e-7, nom = '') => assert.ok(Math.abs(o - k) <= eps, `${nom} kutilgan ${k}, olingan ${o}`);
const ptNear = (o, k, eps = 1e-7, nom = '') => { near(o.x, k.x, eps, nom + '.x'); near(o.y, k.y, eps, nom + '.y'); };
const ptsNear = (o, k, eps = 1e-7) => { assert.equal(o.length, k.length, `nuqtalar soni ${o.length} ≠ ${k.length}`); k.forEach((p, i) => ptNear(o[i], p, eps, `[${i}]`)); };
const P = (x, y) => ({ x, y });
const pl = (pts, closed = false) => ({ type: 'pline', pts, closed });
const sweep = (a) => { const s = ((a.a1 - a.a0) % 360 + 360) % 360; return s < 1e-9 ? 360 : s; };
const SQ = pl([P(0, 0), P(100, 0), P(100, 100), P(0, 100)], true);

console.log('\n— Polyline yo\'li —');
test('plinePath: L-shakl 100+100; yopiq kvadrat 400', () => {
  near(plinePath(pl([P(0, 0), P(100, 0), P(100, 100)])).L, 200); near(plinePath(SQ).L, 400);
});
test('pathProject / pathPoint: (100,40) → s 140; s 250 kvadratda (50,100)', () => {
  const p = plinePath(pl([P(0, 0), P(100, 0), P(100, 100)]));
  near(pathProject(p, P(110, 40)).s, 140); ptNear(pathPoint(p, 140), P(100, 40));
  ptNear(pathPoint(plinePath(SQ), 250), P(50, 100)); ptNear(pathPoint(plinePath(SQ), 450), P(50, 0));   // aylanadi
});
test('pathSub: tugunlarni oladi; yopiqda aylanib o\'tadi', () => {
  const p = plinePath(pl([P(0, 0), P(100, 0), P(100, 100)]));
  ptsNear(pathSub(p, 50, 150), [P(50, 0), P(100, 0), P(100, 50)]);
  ptsNear(pathSub(plinePath(SQ), 350, 450), [P(0, 50), P(0, 0), P(50, 0)]);
});

console.log('\n— Uzish (BREAK) —');
test('ochiq chiziq, ikki nuqta: o\'rtasi olib tashlanadi → 2 bo\'lak', () => {
  const r = breakEnt(pl([P(0, 0), P(100, 0)]), P(30, 2), P(70, -1));
  assert.equal(r.add.length, 2); ptsNear(r.add[0].pts, [P(0, 0), P(30, 0)]); ptsNear(r.add[1].pts, [P(70, 0), P(100, 0)]);
});
test('ochiq L, ikkinchi nuqta uchdan tashqarida → bitta bo\'lak qoladi', () => {
  const r = breakEnt(pl([P(0, 0), P(100, 0), P(100, 100)]), P(50, 0), P(100, 130));
  assert.equal(r.add.length, 1); ptsNear(r.add[0].pts, [P(0, 0), P(50, 0)]);
});
test('nuqtada uzish: ochiq → 2 bo\'lak (tutash); uchida → reason', () => {
  const r = breakEnt(pl([P(0, 0), P(100, 0), P(100, 100)]), P(100, 40));
  assert.equal(r.add.length, 2); ptsNear(r.add[0].pts, [P(0, 0), P(100, 0), P(100, 40)]); ptsNear(r.add[1].pts, [P(100, 40), P(100, 100)]);
  assert.ok(breakEnt(pl([P(0, 0), P(100, 0)]), P(0, 0)).reason);
});
test('yopiq kvadrat: ikki nuqta — P1 dan P2 gacha (tugun tartibida) olib tashlanadi', () => {
  const r = breakEnt(SQ, P(50, 0), P(100, 50));   // s1 50, s2 150 → qoladi 150 → 450 (50)
  assert.equal(r.add.length, 1); assert.equal(r.add[0].closed, false);
  ptsNear(r.add[0].pts, [P(100, 50), P(100, 100), P(0, 100), P(0, 0), P(50, 0)]);
});
test('yopiq kvadrat: nuqtada — shu joyda ochiladi (boshi = oxiri)', () => {
  const r = breakEnt(SQ, P(50, 0));
  ptsNear(r.add[0].pts, [P(50, 0), P(100, 0), P(100, 100), P(0, 100), P(0, 0), P(50, 0)]);
});
test('yoy 0..180 (r 10): 45° va 135° orasi olib tashlanadi → 0..45, 135..180; nuqtada → 2 yoy', () => {
  const a = { type: 'arc', cx: 0, cy: 0, r: 10, a0: 0, a1: 180 };
  const r = breakEnt(a, P(7.07, -7.07), P(-7.07, -7.07));
  assert.equal(r.add.length, 2); near(r.add[0].a1, 45, 0.01); near(r.add[1].a0, 135, 0.01);
  const r2 = breakEnt(a, P(0, -10)); assert.equal(r2.add.length, 2); near(r2.add[0].a1, 90); near(r2.add[1].a0, 90);
});
test('aylana: 0° dan 90° gacha (CCW) olib tashlanadi → 90..360 yoy; bitta nuqta → reason', () => {
  const c = { type: 'circle', cx: 0, cy: 0, r: 10 };
  const r = breakEnt(c, P(10, 0), P(0, -10));
  assert.equal(r.add[0].type, 'arc'); near(r.add[0].a0, 90); near(r.add[0].a1, 0); near(sweep(r.add[0]), 270);
  assert.ok(breakEnt(c, P(10, 0)).reason);
});

console.log('\n— Cho\'zish (STRETCH) —');
const RECT = { x1: 80, y1: -10, x2: 120, y2: 60 };
test('polyline: faqat ramka ichidagi tugunlar suriladi', () => {
  const r = stretchEnt(pl([P(0, 0), P(100, 0), P(100, 50), P(0, 50)]), RECT, 30, 0);
  ptsNear(r.pts, [P(0, 0), P(130, 0), P(130, 50), P(0, 50)]);
  assert.equal(stretchEnt(pl([P(0, 0), P(10, 0)]), RECT, 30, 0), null);
});
test('aylana — markaz ichida bo\'lsa suriladi; nuqta; o\'lcham uchi', () => {
  near(stretchEnt({ type: 'circle', cx: 100, cy: 0, r: 5 }, RECT, 10, 5).cx, 110);
  assert.equal(stretchEnt({ type: 'circle', cx: 0, cy: 0, r: 500 }, RECT, 10, 5), null);
  near(stretchEnt({ type: 'point', x: 90, y: 0 }, RECT, 10, 0).x, 100);
  const d = stretchEnt({ type: 'dim', x1: 0, y1: 0, x2: 100, y2: 0, off: 10 }, RECT, 20, 0); near(d.x1, 0); near(d.x2, 120);
});
test('yoy: ikkala uchi ichida — butunlay suriladi; bitta uchi — sagitta saqlanadi', () => {
  const a = { type: 'arc', cx: 100, cy: 20, r: 10, a0: 0, a1: 180 };   // uchlar (110,20), (90,20) — ichida
  const m = stretchEnt(a, RECT, 5, 0); near(m.cx, 105); near(m.cy, 20);
  const b = { type: 'arc', cx: 50, cy: 0, r: 50, a0: 0, a1: 180 };   // uchlar (100,0) ichida, (0,0) tashqarida; sagitta 50
  const s = stretchEnt(b, RECT, 20, 0);
  const S = { x: s.cx + s.r * Math.cos(s.a0 * Math.PI / 180), y: s.cy - s.r * Math.sin(s.a0 * Math.PI / 180) };
  const E = { x: s.cx + s.r * Math.cos(s.a1 * Math.PI / 180), y: s.cy - s.r * Math.sin(s.a1 * Math.PI / 180) };
  const ends = [S, E].sort((u, v) => u.x - v.x); ptNear(ends[0], P(0, 0), 1e-6); ptNear(ends[1], P(120, 0), 1e-6);
  const mid = s.a0 + sweep(s) / 2, M = { x: s.cx + s.r * Math.cos(mid * Math.PI / 180), y: s.cy - s.r * Math.sin(mid * Math.PI / 180) };
  near(M.x, 60, 1e-6); near(M.y, -50, 1e-6);   // vatar o'rtasidan 50 tepada
});

console.log('\n— Uzunlik (LENGTHEN) —');
test('chiziq: delta +20 (oxiriga yaqin) → (120,0); −30 boshiga yaqin → (30,0) dan', () => {
  const r = lengthenEnt(pl([P(0, 0), P(100, 0)]), P(95, 0), 'delta', 20); ptsNear(r.patch.pts, [P(0, 0), P(120, 0)]);
  const r2 = lengthenEnt(pl([P(0, 0), P(100, 0)]), P(5, 0), 'delta', -30); ptsNear(r2.patch.pts, [P(30, 0), P(100, 0)]);
});
test('polyline: total 250 (hozir 200) → oxirgi segment +50; percent 50% → −100 (oxirgi segment 100 → 0 — reason)', () => {
  const L = pl([P(0, 0), P(100, 0), P(100, 100)]);
  ptsNear(lengthenEnt(L, P(100, 90), 'total', 250).patch.pts, [P(0, 0), P(100, 0), P(100, 150)]);
  assert.ok(lengthenEnt(L, P(100, 90), 'percent', 50).reason);
  ptsNear(lengthenEnt(L, P(100, 90), 'percent', 75).patch.pts, [P(0, 0), P(100, 0), P(100, 50)]);
});
test('yoy: delta π·10/2 (90°) oxiriga → a1 +90; boshiga → a0 −90; 360 ga yetsa reason', () => {
  const a = { type: 'arc', cx: 0, cy: 0, r: 10, a0: 0, a1: 90 };
  near(lengthenEnt(a, P(0, -10), 'delta', Math.PI * 5).patch.a1, 180);
  near(lengthenEnt(a, P(10, 0), 'delta', Math.PI * 5).patch.a0, 270);
  assert.ok(lengthenEnt(a, P(0, -10), 'total', 2 * Math.PI * 10).reason);
});
test('yopiq kontur / aylana → reason; entLength', () => {
  assert.ok(lengthenEnt(SQ, P(0, 0), 'delta', 5).reason);
  assert.ok(lengthenEnt({ type: 'circle', cx: 0, cy: 0, r: 5 }, P(5, 0), 'delta', 5).reason);
  near(entLength({ type: 'circle', cx: 0, cy: 0, r: 5 }), 10 * Math.PI);
});

console.log('\n— Ko\'pburchak (POLYGON) —');
test('ichki 6 burchak R 10, 0° dan: uchlari aylanada, tomon 10', () => {
  const p = polygonPts(P(0, 0), 6, 10, 'in', 0);
  assert.equal(p.length, 6); ptNear(p[0], P(10, 0)); near(Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y), 10);
  for (const q of p) near(Math.hypot(q.x, q.y), 10);
});
test('tashqi 4 burchak R 10 (0°): tomon o\'rtasi (10,0), uchlari (10,±10)', () => {
  const p = polygonPts(P(0, 0), 4, 10, 'out', 0);
  ptNear(p[0], P(10, -10)); ptNear(p[3], P(10, 10)); near(Math.hypot(p[0].x, p[0].y), 10 * Math.SQRT2);
});
test('tomon bo\'yicha: (0,0)→(10,0), 4 → kvadrat tepada (y manfiy), soat miliga qarshi', () => {
  const p = polygonEdge(P(0, 0), P(10, 0), 4);
  ptsNear(p, [P(0, 0), P(10, 0), P(10, -10), P(0, -10)], 1e-9);
  assert.equal(polygonEdge(P(0, 0), P(0, 0), 5), null);
});

console.log('\n— Bo\'lish / O\'lchab qo\'yish —');
test('divide: chiziq 100 / 4 → 3 nuqta 25, 50, 75; aylana / 4 → 4 nuqta (0°, 90°…)', () => {
  const r = divideEnt(pl([P(0, 0), P(100, 0)]), 4); ptsNear(r.pts, [P(25, 0), P(50, 0), P(75, 0)]);
  const c = divideEnt({ type: 'circle', cx: 0, cy: 0, r: 10 }, 4); ptsNear(c.pts, [P(10, 0), P(0, -10), P(-10, 0), P(0, 10)], 1e-9);
  assert.ok(divideEnt(pl([P(0, 0), P(100, 0)]), 1).reason);
});
test('measure: 100 mm chiziq, 30 qadam, boshidan → 30, 60, 90; oxiriga yaqin bosilsa → 70, 40, 10', () => {
  ptsNear(measureEnt(pl([P(0, 0), P(100, 0)]), 30, P(2, 0)).pts, [P(30, 0), P(60, 0), P(90, 0)]);
  ptsNear(measureEnt(pl([P(0, 0), P(100, 0)]), 30, P(98, 0)).pts, [P(70, 0), P(40, 0), P(10, 0)]);
  assert.ok(measureEnt(pl([P(0, 0), P(100, 0)]), 0).reason);
});

console.log('\n— Yuza (AREA) —');
test('kvadrat 100 → 10000, perimetr 400; aylana r 10 → 100π', () => {
  near(areaOfEnt(SQ).area, 10000); near(areaOfEnt(SQ).perim, 400);
  near(areaOfEnt({ type: 'circle', cx: 0, cy: 0, r: 10 }).area, 100 * Math.PI);
  assert.equal(areaOfEnt(pl([P(0, 0), P(1, 0)])), null);
  near(polyArea([P(0, 0), P(10, 0), P(0, 10)]), 50); near(polyPerim([P(0, 0), P(3, 0), P(3, 4)]), 12);
});
test('zanjir (stadion: 2 chiziq + 2 yarim aylana) yuzasi ≈ 100·50 + π·25², perimetr 200 + 50π', () => {
  const ents = [pl([P(0, 0), P(100, 0)]), { type: 'arc', cx: 100, cy: 25, r: 25, a0: 270, a1: 90 }, pl([P(100, 50), P(0, 50)]), { type: 'arc', cx: 0, cy: 25, r: 25, a0: 90, a1: 270 }];
  ents.forEach((e, i) => { e.id = i + 1; });
  const ch = buildChains(ents)[0];
  const r = chainArea(ch.pieces);
  near(r.area, 5000 + Math.PI * 625, 0.2); near(r.perim, 200 + 50 * Math.PI, 1e-9);
});


test('lengthenEnt: oxirgi segment nol uzunlikda (takror tugun) → NaN emas, oldingi yo\'nalishda uzayadi', () => {
  const r = lengthenEnt(pl([P(0, 0), P(100, 0), P(100, 0)]), P(99, 0), 'delta', 10);
  assert.ok(!r.reason); ptsNear(r.patch.pts, [P(0, 0), P(110, 0)]);
  assert.ok(r.patch.pts.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)));
  const z = lengthenEnt(pl([P(5, 5), P(5, 5)]), P(5, 5), 'delta', 10);
  assert.ok(z.reason);
});
console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
