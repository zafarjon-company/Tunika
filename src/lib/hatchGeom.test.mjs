// ============================================================
//  SHTRIX / KONTUR SOHASI — TESTLAR
//  Ishga tushirish:  node src/lib/hatchGeom.test.mjs   (npm run test:hatch)
// ============================================================
import assert from 'node:assert/strict';
import { chainPolygon, circlePolygon, polyAreaAbs, pointInPoly, pointInLoops, closedLoops, findRegion, regionArea } from './hatchGeom.js';

let jami = 0, xato = 0;
function test(nom, fn) {
  jami += 1;
  try { fn(); console.log(`  ✅ ${nom}`); }
  catch (e) { xato += 1; console.log(`  ❌ ${nom}\n` + String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n')); }
}
const near = (o, k, eps = 1e-7, nom = '') => assert.ok(Math.abs(o - k) <= eps, `${nom} kutilgan ${k}, olingan ${o}`);
const P = (x, y) => ({ x, y });
const sq = (id, x, y, s) => ({ id, type: 'pline', closed: true, pts: [P(x, y), P(x + s, y), P(x + s, y + s), P(x, y + s)] });

console.log('\n— Ko\'pburchak —');
test('pointInPoly: ichida / tashqarida / chegaraga yaqin', () => {
  const k = [P(0, 0), P(10, 0), P(10, 10), P(0, 10)];
  assert.equal(pointInPoly(P(5, 5), k), true);
  assert.equal(pointInPoly(P(15, 5), k), false);
  assert.equal(pointInPoly(P(-0.001, 5), k), false);
});
test('chainPolygon: yarim aylana + diametr — yuzasi πr²/2 ga yaqin', () => {
  const pieces = [{ kind: 'seg', a: P(-10, 0), b: P(10, 0) }, { kind: 'arc', cx: 0, cy: 0, r: 10, sa: 0, ea: 180, ccw: true }];
  near(polyAreaAbs(chainPolygon(pieces, 1)), Math.PI * 50, 0.2);
});
test('circlePolygon: 96 nuqta, radiusda', () => {
  const c = circlePolygon({ cx: 3, cy: 4, r: 5 });
  assert.equal(c.length, 96);
  for (const q of c) near(Math.hypot(q.x - 3, q.y - 4), 5, 1e-9);
});

console.log('\n— Halqalar va soha —');
test('closedLoops: yopiq polyline, tutash chiziqlar zanjiri va aylana; ochiq chiziq — yo\'q', () => {
  const ents = [
    sq(1, 0, 0, 100),
    { id: 2, type: 'pline', pts: [P(200, 0), P(300, 0)] }, { id: 3, type: 'pline', pts: [P(300, 0), P(300, 100)] }, { id: 4, type: 'pline', pts: [P(300, 100), P(200, 0)] },
    { id: 5, type: 'circle', cx: 50, cy: 50, r: 20 },
    { id: 6, type: 'pline', pts: [P(0, 200), P(50, 250)] },
    { id: 7, type: 'dim', x1: 0, y1: 0, x2: 1, y2: 1, off: 5 }, { id: 8, type: 'text', x: 0, y: 0, h: 5, text: 'a' },
  ];
  const L = closedLoops(ents);
  assert.equal(L.length, 3);
  const tri = L.find((l) => l.ids.length === 3); near(tri.area, 5000, 1e-6); assert.equal(tri.ent, null);
  assert.equal(L.find((l) => l.ids[0] === 1).ent.id, 1);
  assert.equal(L.find((l) => l.ids[0] === 5).ent.type, 'circle');
});
test('findRegion: eng kichik o\'rovchi halqa — tashqi; ichidagi aylana — orol', () => {
  const L = closedLoops([sq(1, 0, 0, 100), { id: 5, type: 'circle', cx: 50, cy: 50, r: 20 }, sq(9, -50, -50, 300)]);
  const r = findRegion(L, P(10, 10));
  assert.deepEqual(r.outer.ids, [1]); assert.equal(r.islands.length, 1); assert.deepEqual(r.islands[0].ids, [5]);
  const inC = findRegion(L, P(50, 50));
  assert.deepEqual(inC.outer.ids, [5]); assert.equal(inC.islands.length, 0);
  const big = findRegion(L, P(200, 200));
  assert.deepEqual(big.outer.ids, [9]); assert.equal(big.islands.length, 2);
  assert.equal(findRegion(L, P(1000, 0)), null);
});
test('pointInLoops / regionArea: juft-toq qoida (tashqi − orol + orol ichidagi orol)', () => {
  const A = [P(0, 0), P(100, 0), P(100, 100), P(0, 100)], B = [P(20, 20), P(80, 20), P(80, 80), P(20, 80)], C = [P(40, 40), P(60, 40), P(60, 60), P(40, 60)];
  assert.equal(pointInLoops(P(10, 10), [A, B, C]), true);
  assert.equal(pointInLoops(P(30, 30), [A, B, C]), false);
  assert.equal(pointInLoops(P(50, 50), [A, B, C]), true);
  near(regionArea([A, B]), 10000 - 3600);
  near(regionArea([A, B, C]), 10000 - 3600 + 400);
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
