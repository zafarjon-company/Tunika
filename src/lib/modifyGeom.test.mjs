// ============================================================
//  O'ZGARTIRISH GEOMETRIYASI — TESTLAR (Fillet, Chamfer, Explode, Join)
//  Ishga tushirish:  node src/lib/modifyGeom.test.mjs   (npm run test:modify)
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° tepa, CCW musbat.
// ============================================================
import assert from 'node:assert/strict';
import { curveOf, filletCurves, chamferLines, replaceSegEnd, adjacentSegs, cornerOp, filletPlineAll, chamferPlineAll, explodeEnt, joinEnts } from './modifyGeom.js';

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
const arcPt = (a, ang) => ({ x: a.cx + a.r * Math.cos(ang * Math.PI / 180), y: a.cy - a.r * Math.sin(ang * Math.PI / 180) });
const sweep = (a) => { const s = ((a.a1 - a.a0) % 360 + 360) % 360; return s < 1e-9 ? 360 : s; };

// Gorizontal (0,0)–(100,0) va vertikal (0,0)–(0,−100) (tepaga) — burchak (0,0)
const H = pl([P(0, 0), P(100, 0)]), V = pl([P(0, 0), P(0, -100)]);

console.log('\n— Fillet: chiziq × chiziq —');
test('L burchak, R=10: urinma nuqtalar (10,0) va (0,−10), yoy markazi (10,−10), 90°, burchak tomonga bo\'rtgan', () => {
  const r = filletCurves(curveOf(H, 0), P(80, 0), curveOf(V, 0), P(0, -80), 10);
  ptNear(r.t1, P(10, 0)); ptNear(r.t2, P(0, -10));
  near(r.arc.cx, 10); near(r.arc.cy, -10); near(r.arc.r, 10); near(sweep(r.arc), 90);
  near(r.arc.a0, 180); near(r.arc.a1, 270);
  const m = arcPt(r.arc, 225); assert.ok(m.x < 10 && m.y > -10, 'yoy burchak (0,0) tomonga');
  assert.equal(r.trim1.end, 'a'); assert.equal(r.trim2.end, 'a');   // (0,0) uchlari ko'chadi
});
test('kesishgan chiziqlar (+ shakl): bosilgan choraklar saqlanadi', () => {
  const h = pl([P(-100, 0), P(100, 0)]), v = pl([P(0, -100), P(0, 100)]);
  const r = filletCurves(curveOf(h, 0), P(-60, 0), curveOf(v, 0), P(0, 60), 10);   // chap va past
  ptNear(r.t1, P(-10, 0)); ptNear(r.t2, P(0, 10)); near(r.arc.cx, -10); near(r.arc.cy, 10);
  assert.equal(r.trim1.end, 'b'); assert.equal(r.trim2.end, 'a');   // h: chap qism saqlanadi → b (100,0) ko'chadi; v: past → a (0,−100) ko'chadi
});
test('uzaytirish kerak: chiziqlar tegmaydi (bo\'shliq), R=5 — urinma nuqtalar davomida', () => {
  const h = pl([P(20, 0), P(100, 0)]), v = pl([P(0, -20), P(0, -100)]);
  const r = filletCurves(curveOf(h, 0), P(80, 0), curveOf(v, 0), P(0, -80), 5);
  ptNear(r.t1, P(5, 0)); ptNear(r.t2, P(0, -5));
  assert.equal(r.trim1.end, 'a'); assert.equal(r.trim2.end, 'a');
});
test('R=0 — burchakka tutashtirish (X ga uzaytirish), yoy yo\'q', () => {
  const h = pl([P(20, 0), P(100, 0)]), v = pl([P(0, -20), P(0, -100)]);
  const r = filletCurves(curveOf(h, 0), P(80, 0), curveOf(v, 0), P(0, -80), 0);
  ptNear(r.t1, P(0, 0)); ptNear(r.t2, P(0, 0)); assert.equal(r.arc, null);
});
test('o\'tkir burchak 60°: urinma uzunligi R/tan(30°)', () => {
  const a = pl([P(0, 0), P(100, 0)]), b = pl([P(0, 0), P(50, -50 * Math.sqrt(3))]);
  const r = filletCurves(curveOf(a, 0), P(90, 0), curveOf(b, 0), P(40, -40 * Math.sqrt(3)), 10);
  const tl = 10 / Math.tan(Math.PI / 6);
  ptNear(r.t1, P(tl, 0), 1e-9); near(Math.hypot(r.t2.x, r.t2.y), tl, 1e-9);
  near(sweep(r.arc), 120, 1e-9);
});
test('parallel chiziqlar → yarim aylana 1-chiziqning bosilganga yaqin uchida', () => {
  const a = pl([P(0, 0), P(100, 0)]), b = pl([P(20, 40), P(150, 40)]);
  const r = filletCurves(curveOf(a, 0), P(90, 0), curveOf(b, 0), P(60, 40), 5);   // radius e'tiborsiz — oraliq/2
  ptNear(r.t1, P(100, 0)); ptNear(r.t2, P(100, 40));
  near(r.arc.r, 20); near(r.arc.cx, 100); near(r.arc.cy, 20); near(sweep(r.arc), 180);
  assert.ok(arcPt(r.arc, (r.arc.a0 + 90) % 360).x > 100, 'yarim aylana o\'ngga (chiziqlardan tashqariga) bo\'rtgan');
  assert.equal(r.trim2.end, 'b');   // b chizig'ining o'ng uchi (150) → 100 ga
});
test('bir to\'g\'ri chiziqdagi chiziqlar → reason', () => {
  assert.ok(filletCurves(curveOf(pl([P(0, 0), P(10, 0)]), 0), P(5, 0), curveOf(pl([P(20, 0), P(30, 0)]), 0), P(25, 0), 5).reason);
});

console.log('\n— Fillet: yoy / aylana ishtirokida —');
test('chiziq × aylana (tashqi): aylanaga va chiziqqa urinma, markaz masofalari R va r+R', () => {
  const L = pl([P(-100, 0), P(100, 0)]), C = { type: 'circle', cx: 0, cy: -30, r: 20 };   // aylana pastki nuqtasi y=−10
  const r = filletCurves(curveOf(L, 0), P(60, 0), curveOf(C), P(20, -30), 10);
  assert.ok(r.arc, r.reason);
  near(Math.abs(r.arc.cy - 0), 10, 1e-7);                                     // chiziqdan R
  near(Math.hypot(r.arc.cx - 0, r.arc.cy + 30), 30, 1e-7);                   // aylana markazidan r+R
  near(r.arc.cx, Math.sqrt(900 - 400), 1e-7); near(r.arc.cy, -10, 1e-7);
  assert.ok(r.arc.cx > 0, 'o\'ng tomonda (bosilgan joylar)');
  assert.ok(r.trim2.keep, 'aylana kesilmaydi');
});
test('chiziq × yoy: yoy bosilgan tomondan kesiladi/uzayadi', () => {
  const L = pl([P(0, 0), P(100, 0)]);
  const A = { type: 'arc', cx: 0, cy: -25, r: 20, a0: 300, a1: 60 };   // o'ngga bo'rtgan yoy (x ≈ 10..20)
  const r = filletCurves(curveOf(L, 0), P(80, 0), curveOf(A), P(20, -25), 8);
  assert.ok(r.arc, r.reason);
  near(Math.abs(r.arc.cy), 8, 1e-7); near(Math.hypot(r.arc.cx, r.arc.cy + 25), 28, 1e-7); near(r.arc.cx, Math.sqrt(784 - 289), 1e-7);
  assert.ok(r.trim2.arc, 'yoy yangi burchaklari');
  const na = Object.assign({}, A, r.trim2.arc);
  const tp = r.t2; near(Math.hypot(tp.x, tp.y + 25), 20, 1e-7);
  near(na.a0, (Math.atan2(-17, Math.sqrt(784 - 289)) * 180 / Math.PI + 360) % 360, 1e-6);   // pastki uch urinma nuqtaga qisqaradi (≈322.6°)
  near(na.a1, 60);
  // yangi yoy uchlaridan biri urinma nuqtasida
  const ends = [arcPt(na, na.a0), arcPt(na, na.a1)];
  assert.ok(ends.some((e) => Math.hypot(e.x - tp.x, e.y - tp.y) < 1e-6));
});
test('yoy × yoy (ikkala aylana tashqi), R=10: markaz har biridan r+R, tepada', () => {
  const A = { type: 'arc', cx: 0, cy: 0, r: 20, a0: 270, a1: 90 }, B = { type: 'arc', cx: 50, cy: 0, r: 20, a0: 90, a1: 270 };
  const r = filletCurves(curveOf(A), P(0, -20), curveOf(B), P(50, -20), 10);
  assert.ok(r.arc, r.reason);
  near(Math.hypot(r.arc.cx, r.arc.cy), 30, 1e-7); near(Math.hypot(r.arc.cx - 50, r.arc.cy), 30, 1e-7); near(r.arc.cx, 25, 1e-7);
  assert.ok(r.arc.cy < 0, 'tepa tomonda (bosilgan joylar)');
});
test('sig\'maydi → reason (aylana chiziqdan uzoq, R kichik)', () => {
  const L = pl([P(-50, 0), P(50, 0)]), C = { type: 'circle', cx: 0, cy: -100, r: 10 };
  assert.ok(filletCurves(curveOf(L, 0), P(10, 0), curveOf(C), P(0, -90), 5).reason);
});

console.log('\n— Chamfer —');
test('L burchak, d1=10 d2=20: (10,0)–(0,−20) kesma', () => {
  const r = chamferLines(curveOf(H, 0), P(80, 0), curveOf(V, 0), P(0, -80), 10, 20);
  ptNear(r.t1, P(10, 0)); ptNear(r.t2, P(0, -20)); ptNear(r.seg.a, P(10, 0)); ptNear(r.seg.b, P(0, -20));
  assert.equal(r.trim1.end, 'a'); assert.equal(r.trim2.end, 'a');
});
test('chamfer: bosilgan nuqta burchakka faska masofasidan yaqin bo\'lsa ham to\'g\'ri uch ko\'chadi', () => {
  const r = chamferLines(curveOf(H, 0), P(3, 0), curveOf(V, 0), P(0, -3), 10, 10);
  ptNear(r.t1, P(10, 0)); assert.equal(r.trim1.end, 'a');
});
test('chamfer: yoy yoki parallel → reason', () => {
  assert.ok(chamferLines(curveOf({ type: 'circle', cx: 0, cy: 0, r: 5 }), P(5, 0), curveOf(H, 0), P(50, 0), 1, 1).reason);
  assert.ok(chamferLines(curveOf(H, 0), P(50, 0), curveOf(pl([P(0, 10), P(100, 10)]), 0), P(50, 10), 1, 1).reason);
});

console.log('\n— Polyline operatsiyalari —');
test('replaceSegEnd: ochiq polyline oxirgi uchi — shunchaki ko\'chadi', () => {
  const r = replaceSegEnd(pl([P(0, 0), P(10, 0), P(10, 10)]), 1, 'b', P(10, 5));
  assert.equal(r.length, 1); ptsNear(r[0].pts, [P(0, 0), P(10, 0), P(10, 5)]);
});
test('replaceSegEnd: ichki tugun — polyline ajraladi', () => {
  const r = replaceSegEnd(pl([P(0, 0), P(10, 0), P(10, 10)]), 0, 'b', P(7, 0));
  assert.equal(r.length, 2); ptsNear(r[0].pts, [P(0, 0), P(7, 0)]); ptsNear(r[1].pts, [P(10, 0), P(10, 10)]);
  const r2 = replaceSegEnd(pl([P(0, 0), P(10, 0), P(10, 10)]), 1, 'a', P(10, 3));
  ptsNear(r2[0].pts, [P(0, 0), P(10, 0)]); ptsNear(r2[1].pts, [P(10, 3), P(10, 10)]);
});
test('replaceSegEnd: yopiq kvadrat — tugunda ochiladi', () => {
  const sq = pl([P(0, 0), P(10, 0), P(10, 10), P(0, 10)], true);
  const r = replaceSegEnd(sq, 0, 'b', P(7, 0));
  assert.equal(r.length, 1); assert.equal(r[0].closed, false);
  ptsNear(r[0].pts, [P(10, 0), P(10, 10), P(0, 10), P(0, 0), P(7, 0)]);
  const r2 = replaceSegEnd(sq, 0, 'a', P(3, 0));
  ptsNear(r2[0].pts, [P(3, 0), P(10, 0), P(10, 10), P(0, 10), P(0, 0)]);
});
test('adjacentSegs: ochiq va yopiq (oxirgi↔birinchi)', () => {
  const o = pl([P(0, 0), P(10, 0), P(10, 10), P(0, 10)]);
  assert.deepEqual(adjacentSegs(o, 0, 1), { v: 1, prev: 0, next: 1 });
  assert.deepEqual(adjacentSegs(o, 2, 1), { v: 2, prev: 1, next: 2 });
  assert.equal(adjacentSegs(o, 0, 2), null);
  const c = pl([P(0, 0), P(10, 0), P(10, 10), P(0, 10)], true);
  assert.deepEqual(adjacentSegs(c, 3, 0), { v: 0, prev: 3, next: 0 });
});
test('cornerOp fillet: ochiq — ikki polyline; yopiq — bitta ochiq; chamfer — bitta polyline', () => {
  const o = pl([P(0, 0), P(10, 0), P(10, 10)]);
  const f = cornerOp(o, 1, P(8, 0), P(10, 2), 'fillet');
  assert.equal(f.length, 2); ptsNear(f[0].pts, [P(0, 0), P(8, 0)]); ptsNear(f[1].pts, [P(10, 2), P(10, 10)]);
  const c = cornerOp(o, 1, P(8, 0), P(10, 2), 'chamfer');
  assert.equal(c.length, 1); ptsNear(c[0].pts, [P(0, 0), P(8, 0), P(10, 2), P(10, 10)]);
  const sq = pl([P(0, 0), P(10, 0), P(10, 10), P(0, 10)], true);
  const fc = cornerOp(sq, 1, P(8, 0), P(10, 2), 'fillet');
  assert.equal(fc.length, 1); assert.equal(fc[0].closed, false);
  ptsNear(fc[0].pts, [P(10, 2), P(10, 10), P(0, 10), P(0, 0), P(8, 0)]);
  const cc = cornerOp(sq, 1, P(8, 0), P(10, 2), 'chamfer');
  assert.equal(cc[0].closed, true); ptsNear(cc[0].pts, [P(0, 0), P(8, 0), P(10, 2), P(10, 10), P(0, 10)]);
});
test('filletPlineAll: yopiq kvadrat 100, R=10 → 4 chiziq + 4 yoy (90°), chiziqlar 80 mm', () => {
  const sq = pl([P(0, 0), P(100, 0), P(100, 100), P(0, 100)], true);
  const r = filletPlineAll(sq, 10);
  assert.equal(r.count, 4);
  const arcs = r.ents.filter((e) => e.type === 'arc'), lines = r.ents.filter((e) => e.type === 'pline');
  assert.equal(arcs.length, 4); assert.equal(lines.length, 4);
  for (const a of arcs) { near(a.r, 10); near(sweep(a), 90, 1e-9); }
  for (const l of lines) { assert.equal(l.pts.length, 2); near(Math.hypot(l.pts[1].x - l.pts[0].x, l.pts[1].y - l.pts[0].y), 80, 1e-9); }
  // yoylar ichkariga bo'rtmagan — markazlar (10,10) kabi ichki nuqtalarda
  for (const a of arcs) assert.ok(a.cx > 0 && a.cx < 100 && a.cy > 0 && a.cy < 100);
});
test('filletPlineAll: ochiq L — faqat ichki tugun; qisqa segment → o\'tkazib yuboriladi', () => {
  const L = pl([P(0, 0), P(100, 0), P(100, 100)]);
  const r = filletPlineAll(L, 10);
  assert.equal(r.count, 1); assert.equal(r.ents.length, 3);
  ptsNear(r.ents[0].pts, [P(0, 0), P(90, 0)]); ptsNear(r.ents[2].pts, [P(100, 10), P(100, 100)]);
  const s = filletPlineAll(pl([P(0, 0), P(5, 0), P(5, 100)]), 10);
  assert.ok(s.reason); assert.equal(s.skipped, 1);
});
test('chamferPlineAll: kvadrat d=10 → sakkizburchak (8 nuqta), yopiq', () => {
  const r = chamferPlineAll(pl([P(0, 0), P(100, 0), P(100, 100), P(0, 100)], true), 10, 10);
  assert.equal(r.count, 4); assert.equal(r.ents[0].closed, true); assert.equal(r.ents[0].pts.length, 8);
  ptNear(r.ents[0].pts[0], P(0, 10)); ptNear(r.ents[0].pts[1], P(10, 0));
});

console.log('\n— Portlatish / Birlashtirish —');
test('explodeEnt: yopiq kvadrat → 4 chiziq; 2 nuqtali → null; aylana → null', () => {
  assert.equal(explodeEnt(pl([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], true)).length, 4);
  assert.equal(explodeEnt(pl([P(0, 0), P(1, 0)])), null);
  assert.equal(explodeEnt({ type: 'circle', cx: 0, cy: 0, r: 1 }), null);
});
test('joinEnts: 4 alohida chiziq → bitta yopiq polyline', () => {
  const ents = [
    { id: 1, type: 'pline', pts: [P(0, 0), P(10, 0)] }, { id: 2, type: 'pline', pts: [P(10, 10), P(10, 0)] },
    { id: 3, type: 'pline', pts: [P(10, 10), P(0, 10)] }, { id: 4, type: 'pline', pts: [P(0, 0), P(0, 10)] },
  ];
  const r = joinEnts(ents);
  assert.deepEqual(r.remove.slice().sort(), [1, 2, 3, 4]);
  assert.equal(r.add.length, 1); assert.equal(r.add[0].closed, true); assert.equal(r.add[0].pts.length, 4);
});
test('joinEnts: tegmaydigan chiziqlar birlashmaydi; bir aylanadagi tutash yoylar → yoy / aylana', () => {
  const r = joinEnts([{ id: 1, type: 'pline', pts: [P(0, 0), P(10, 0)] }, { id: 2, type: 'pline', pts: [P(20, 0), P(30, 0)] }]);
  assert.equal(r.add.length, 0);
  const a = joinEnts([{ id: 5, type: 'arc', cx: 0, cy: 0, r: 10, a0: 0, a1: 90 }, { id: 6, type: 'arc', cx: 0, cy: 0, r: 10, a0: 90, a1: 200 }]);
  assert.equal(a.add.length, 1); assert.equal(a.add[0].type, 'arc'); near(a.add[0].a0, 0); near(a.add[0].a1, 200);
  const c = joinEnts([{ id: 7, type: 'arc', cx: 0, cy: 0, r: 10, a0: 0, a1: 180 }, { id: 8, type: 'arc', cx: 0, cy: 0, r: 10, a0: 180, a1: 0 }]);
  assert.equal(c.add[0].type, 'circle');
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
