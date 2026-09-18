// ============================================================
//  KESISH / UZAYTIRISH — TESTLAR
//  Ishga tushirish:  node src/lib/trimExtend.test.mjs   (npm run test:trim)
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° tepa, CCW musbat.
// ============================================================
import assert from 'node:assert/strict';
import { trimAt, extendAt } from './trimExtend.js';

let jami = 0, xato = 0;
function test(nom, fn) {
  jami += 1;
  try { fn(); console.log(`  ✅ ${nom}`); }
  catch (e) { xato += 1; console.log(`  ❌ ${nom}\n` + String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n')); }
}
const near = (o, k, eps = 1e-7, nom = '') => assert.ok(Math.abs(o - k) <= eps, `${nom} kutilgan ${k}, olingan ${o}`);
const ptsNear = (o, k, eps = 1e-7) => { assert.equal(o.length, k.length, `nuqtalar soni ${o.length} ≠ ${k.length}`); k.forEach((p, i) => { near(o[i].x, p.x, eps, `[${i}].x`); near(o[i].y, p.y, eps, `[${i}].y`); }); };
const P = (x, y) => ({ x, y });
const pl = (id, pts, closed = false) => ({ id, type: 'pline', pts, closed });
const arc = (id, cx, cy, r, a0, a1) => ({ id, type: 'arc', cx, cy, r, a0, a1 });
const circle = (id, cx, cy, r) => ({ id, type: 'circle', cx, cy, r });
const H = pl('h', [P(0, 0), P(100, 0)]);
const V50 = pl('v', [P(50, -50), P(50, 50)]);

console.log('\n— Kesish: chiziq —');
test('gorizontal chiziq, x=50 da kesuvchi; chap yarmiga bosilsa chap qism o\'chadi → (50,0)–(100,0)', () => {
  const r = trimAt([H, V50], H, P(25, 0));
  assert.deepEqual(r.remove, ['h']); assert.equal(r.add.length, 1);
  ptsNear(r.add[0].pts, [P(50, 0), P(100, 0)]);
  ptsNear(r.removed.pts, [P(0, 0), P(50, 0)]);
});
test('o\'ng yarmiga bosilsa → (0,0)–(50,0)', () => {
  const r = trimAt([H, V50], H, P(75, 0));
  ptsNear(r.add[0].pts, [P(0, 0), P(50, 0)]);
});
test('ikki kesuvchi (x=30, x=70), o\'rtasiga bosilsa → ikki bo\'lak 0..30 va 70..100', () => {
  const r = trimAt([H, pl('a', [P(30, -9), P(30, 9)]), pl('b', [P(70, -9), P(70, 9)])], H, P(50, 0));
  assert.equal(r.add.length, 2);
  ptsNear(r.add[0].pts, [P(0, 0), P(30, 0)]); ptsNear(r.add[1].pts, [P(70, 0), P(100, 0)]);
});
test('kesuvchi yo\'q → reason; kesuvchi segment nurga tegmasa (u ∉ [0,1]) → reason', () => {
  assert.ok(trimAt([H], H, P(50, 0)).reason);
  assert.ok(trimAt([H, pl('v', [P(50, 10), P(50, 50)])], H, P(50, 0)).reason);
});
test('aylana kesuvchi: (50,0) markazli r 20 aylana chiziqni x=30 va x=70 da kesadi; o\'rtaga bosilsa 30..70 o\'chadi', () => {
  const r = trimAt([H, circle('c', 50, 0, 20)], H, P(50, 0));
  assert.equal(r.add.length, 2); ptsNear(r.add[0].pts, [P(0, 0), P(30, 0)]); ptsNear(r.add[1].pts, [P(70, 0), P(100, 0)]);
});
test('yoy kesuvchi: faqat yoy oralig\'idagi kesishma hisobga olinadi', () => {
  // (50,0) markaz r 20, yoy 0..180 (tepa yarmi, y<0) — chiziq y=0 bilan kesishmasi uchlarida (angInArc chegarasi) → ikkalasi ham 0° va 180° da
  const r = trimAt([H, arc('a', 50, 0, 20, 45, 135)], H, P(50, 0));   // 45..135 — y=0 bilan kesishmaydi
  assert.ok(r.reason);
});

console.log('\n— Kesish: polyline —');
test('3 nuqtali ochiq polyline, o\'rta segmenti kesilsa → ikki polyline, uchlari saqlanadi', () => {
  const p = pl('p', [P(0, 0), P(100, 0), P(100, 100)]);
  const r = trimAt([p, pl('v', [P(50, -10), P(50, 10)]), pl('h2', [P(90, 50), P(110, 50)])], p, P(75, 0), 0);
  assert.equal(r.add.length, 2);
  ptsNear(r.add[0].pts, [P(0, 0), P(50, 0)]);
  ptsNear(r.add[1].pts, [P(100, 0), P(100, 100)]);   // hi = 1 (segment oxiri) — (100,0) dan boshlanadi
});
test('polyline o\'zini kesadi (boshqa segmenti chegara): Z shakl', () => {
  const z = pl('z', [P(0, 0), P(100, 0), P(0, 50), P(100, 50), P(0, 100)]);   // 2-seg (100,0)→(0,50) 4-seg (100,50)→(0,100) bilan kesishmaydi; 3-seg gorizontal
  // 1-segment (0,0)→(100,0) ni hech narsa kesmaydi → reason
  assert.ok(trimAt([z], z, P(50, 0), 0).reason);
});
test('yopiq kvadrat: yuqori qirraning chap yarmi kesilsa → bitta ochiq polyline (50,0) dan halqa bo\'ylab (0,0) gacha', () => {
  const sq = pl('sq', [P(0, 0), P(100, 0), P(100, 100), P(0, 100)], true);
  const r = trimAt([sq, pl('v', [P(50, -10), P(50, 10)])], sq, P(25, 0), 0);
  assert.equal(r.add.length, 1); assert.equal(r.add[0].closed, false);
  ptsNear(r.add[0].pts, [P(50, 0), P(100, 0), P(100, 100), P(0, 100), P(0, 0)]);
});
test('yopiq kvadrat: yopuvchi segment (chap qirra, i=3) o\'rtasi kesilsa', () => {
  const sq = pl('sq', [P(0, 0), P(100, 0), P(100, 100), P(0, 100)], true);
  const r = trimAt([sq, pl('h1', [P(-10, 30), P(10, 30)]), pl('h2', [P(-10, 70), P(10, 70)])], sq, P(0, 50), 3);
  // chap qirra (0,100)→(0,0): lo = 0.3 (y=70), hi = 0.7 (y=30) → (0,30) dan boshlanib (0,0),(100,0),(100,100),(0,100),(0,70)
  ptsNear(r.add[0].pts, [P(0, 30), P(0, 0), P(100, 0), P(100, 100), P(0, 100), P(0, 70)]);
});

console.log('\n— Kesish: yoy va aylana —');
test('chorak yoy (0..90, r 10) x=5 chiziq bilan 60° da kesiladi: boshiga yaqin bosilsa → 60..90 qoladi', () => {
  const a = arc('a', 0, 0, 10, 0, 90);
  const r = trimAt([a, pl('v', [P(5, -20), P(5, 20)])], a, P(9.4, -3.4));   // ~20°
  assert.equal(r.add.length, 1); near(r.add[0].a0, 60, 1e-6); near(r.add[0].a1, 90);
  near(r.removed.a0, 0); near(r.removed.a1, 60, 1e-6);
});
test('yoy: oxiriga yaqin bosilsa → 0..60 qoladi; ikki kesuvchi bo\'lsa o\'rta qismi o\'chadi (2 yoy)', () => {
  const a = arc('a', 0, 0, 10, 0, 90);
  const r = trimAt([a, pl('v', [P(5, -20), P(5, 20)])], a, P(1.7, -9.8));
  near(r.add[0].a0, 0); near(r.add[0].a1, 60, 1e-6);
  const r2 = trimAt([a, pl('v', [P(5, -20), P(5, 20)]), pl('h', [P(-20, -5), P(20, -5)])], a, P(7.07, -7.07));   // 45° o'rtada; kesuvchilar 60° va 30°
  assert.equal(r2.add.length, 2); near(r2.add[0].a1, 30, 1e-6); near(r2.add[1].a0, 60, 1e-6);
});
test('yoy: kursor yoy BOSHIDAN sal tashqarida (−5°) bo\'lsa — boshidagi bo\'lak o\'chadi (oxiridagi emas)', () => {
  const a = arc('a', 0, 0, 10, 0, 90), v = pl('v', [P(5, -20), P(5, 20)]);   // kesuvchi 60° da
  const r = trimAt([a, v], a, P(9.96, 0.87));   // burchak −5° → 355°: boshiga yaqin
  near(r.add[0].a0, 60, 1e-6); near(r.add[0].a1, 90); near(r.removed.a0, 0);
  const r2 = trimAt([a, v], a, P(-0.87, -9.96));   // 95° → oxiriga yaqin → 0..60 qoladi
  near(r2.add[0].a0, 0); near(r2.add[0].a1, 60, 1e-6);
});
test('aylana: ikki vertikal kesuvchi (x=±5), tepasiga bosilsa → 120..60 yoy (300°)', () => {
  const c = circle('c', 0, 0, 10);
  const r = trimAt([c, pl('a', [P(5, -20), P(5, 20)]), pl('b', [P(-5, -20), P(-5, 20)])], c, P(0, -10));
  assert.equal(r.add.length, 1); assert.equal(r.add[0].type, 'arc'); near(r.add[0].a0, 120, 1e-6); near(r.add[0].a1, 60, 1e-6);
});
test('aylana: bitta kesuvchi (2 kesishma) — pastiga bosilsa → 300..240 orqali? yo\'q: 240..300 o\'chadi, 300..240 qoladi', () => {
  const c = circle('c', 0, 0, 10);
  const r = trimAt([c, pl('a', [P(5, -20), P(5, 20)])], c, P(0, 10));   // 270° — kesishmalar 60 va 300 → lo=60? thc=270: lo = 60 (≤270), hi = 300
  near(r.add[0].a0, 300, 1e-6); near(r.add[0].a1, 60, 1e-6);
});
test('aylana: 1 kesishma (tangens) → reason', () => {
  assert.ok(trimAt([circle('c', 0, 0, 10), pl('t', [P(-20, 10), P(20, 10)])], circle('c', 0, 0, 10), P(0, -10)).reason);
});

console.log('\n— Uzaytirish —');
test('chiziq (0,0)–(50,0) oxiri x=100 vertikal chegaragacha → (100,0); boshi x=−30 gacha → (−30,0)', () => {
  const l = pl('l', [P(0, 0), P(50, 0)]);
  const r = extendAt([l, pl('b', [P(100, -50), P(100, 50)])], l, P(45, 0));
  assert.equal(r.end, 'end'); ptsNear(r.patch.pts, [P(0, 0), P(100, 0)]);
  const r2 = extendAt([l, pl('b', [P(-30, -50), P(-30, 50)])], l, P(5, 0));
  assert.equal(r2.end, 'start'); ptsNear(r2.patch.pts, [P(-30, 0), P(50, 0)]);
});
test('eng yaqin chegara olinadi (x=80 va x=100 → 80); orqadagi chegara (x=−10) e\'tiborsiz', () => {
  const l = pl('l', [P(0, 0), P(50, 0)]);
  const r = extendAt([l, pl('b1', [P(100, -50), P(100, 50)]), pl('b2', [P(80, -50), P(80, 50)]), pl('b0', [P(-10, -50), P(-10, 50)])], l, P(50, 0));
  ptsNear(r.patch.pts, [P(0, 0), P(80, 0)]);
});
test('aylana chegara: (150,0) r 20 → (130,0); yoy chegara oralig\'i hisobga olinadi', () => {
  const l = pl('l', [P(0, 0), P(50, 0)]);
  ptsNear(extendAt([l, circle('c', 150, 0, 20)], l, P(50, 0)).patch.pts, [P(0, 0), P(130, 0)]);
  // yoy 150,0 r20 faqat tepa yarmi (0..180): nur y=0 bilan uchlarida (130,0) va (170,0) — chegarada (angInArc) → 130
  ptsNear(extendAt([l, arc('a', 150, 0, 20, 0, 180)], l, P(50, 0)).patch.pts, [P(0, 0), P(130, 0)]);
  // yoy 45..135 — y=0 bilan kesishmaydi → reason
  assert.ok(extendAt([l, arc('a', 150, 0, 20, 45, 135)], l, P(50, 0)).reason);
});
test('chegara yo\'q → reason; yopiq polyline → reason; aylana → reason', () => {
  const l = pl('l', [P(0, 0), P(50, 0)]);
  assert.ok(extendAt([l], l, P(50, 0)).reason);
  const sq = pl('sq', [P(0, 0), P(10, 0), P(10, 10)], true);
  assert.ok(extendAt([sq, l], sq, P(10, 10)).reason);
  assert.ok(extendAt([circle('c', 0, 0, 5), l], circle('c', 0, 0, 5), P(5, 0)).reason);
});
test('polyline: oxirgi segment yo\'nalishida (burilgan bo\'lsa ham)', () => {
  const p = pl('p', [P(0, 0), P(50, 0), P(50, 50)]);   // oxirgi segment pastga
  const r = extendAt([p, pl('b', [P(0, 80), P(100, 80)])], p, P(50, 50));
  ptsNear(r.patch.pts, [P(0, 0), P(50, 0), P(50, 80)]);
});
test('yoy uzaytirish: 0..90 (r 10), chegara x=−5 (kesishma 120° va 240°): oxiri → a1 120; boshi → a0 240', () => {
  const a = arc('a', 0, 0, 10, 0, 90), b = pl('b', [P(-5, -20), P(-5, 20)]);
  const r = extendAt([a, b], a, P(0, -10)); assert.equal(r.end, 'end'); near(r.patch.a1, 120, 1e-6);
  const r2 = extendAt([a, b], a, P(10, 0)); assert.equal(r2.end, 'start'); near(r2.patch.a0, 240, 1e-6);
});
test('yoy uzaytirish: chegara faqat yoyning o\'z oralig\'ida bo\'lsa (davomida yo\'q) → reason', () => {
  const a = arc('a', 0, 0, 10, 0, 90), b = pl('b', [P(5, -20), P(5, 20)]);   // kesishma 60° (yoy ichida) va 300°
  const r = extendAt([a, b], a, P(0, -10));   // oxiri 90 → 300 gacha 210° > 360−90=270? 210 < 270 → mumkin
  near(r.patch.a1, 300, 1e-6);
  const c = arc('c', 0, 0, 10, 0, 350), b2 = pl('b2', [P(5, -20), P(5, 20)]);   // 60° va 300° ikkalasi yoy ichida; davomi 350..360 da chegara yo'q
  assert.ok(extendAt([c, b2], c, P(9.85, 1.7)).reason);
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
