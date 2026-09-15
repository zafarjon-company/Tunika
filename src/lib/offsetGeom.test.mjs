// ============================================================
//  OFSET GEOMETRIYASI — TESTLAR
//  Ishga tushirish:  node src/lib/offsetGeom.test.mjs   (npm run test:offset)
//  DOM kerak emas — sof geometriya sinaladi.
//
//  Konvensiya: world mm, x o'ngga, y PASTGA. Segment normali n = (−dy, dx)
//  (yo'nalishni soat mili bo'yicha 90° burish); +1 tomon — shu normal tomoni.
//  Har testda kutilgan qiymat geometriya bo'yicha MUSTAQIL hisoblanadi.
// ============================================================
import assert from 'node:assert/strict';
import {
  distToSeg, lineInt, plineSegs, signedArea,
  offsetSide, offsetPlinePts, offsetEnt, offsetSeries, multiOffset,
} from './offsetGeom.js';

let jami = 0;
let xato = 0;

function test(nom, fn) {
  jami += 1;
  try {
    fn();
    console.log(`  ✅ ${nom}`);
  } catch (e) {
    xato += 1;
    const msg = String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n');
    console.log(`  ❌ ${nom}\n${msg}`);
  }
}

// Sonlarni tolerans bilan solishtirish (-0 / 0 muammosiz)
const near = (olingan, kutilgan, eps = 1e-9, nom = '') => {
  assert.ok(Math.abs(olingan - kutilgan) <= eps, `${nom} kutilgan ${kutilgan}, olingan ${olingan}`);
};
// Nuqtalar ro'yxatini solishtirish
const ptsNear = (olingan, kutilgan, eps = 1e-9) => {
  assert.equal(olingan.length, kutilgan.length, `nuqtalar soni: kutilgan ${kutilgan.length}, olingan ${olingan.length}`);
  for (let i = 0; i < kutilgan.length; i++) {
    near(olingan[i].x, kutilgan[i].x, eps, `pts[${i}].x`);
    near(olingan[i].y, kutilgan[i].y, eps, `pts[${i}].y`);
  }
};
const P = (x, y) => ({ x, y });
const pline = (pts, closed = false) => ({ type: 'pline', pts, closed });
const circle = (cx, cy, r) => ({ type: 'circle', cx, cy, r });
const LINE = pline([P(0, 0), P(100, 0)]);                                      // gorizontal, o'ngga
const KVADRAT = pline([P(0, 0), P(100, 0), P(100, 100), P(0, 100)], true);     // 100×100, soat mili bo'yicha (y pastga)
const S2 = Math.SQRT2;

console.log('\n— Yordamchilar —');
test('distToSeg: kesma o\'rtasi, uchi tashqarisi', () => {
  near(distToSeg(50, 30, 0, 0, 100, 0), 30);
  near(distToSeg(130, 40, 0, 0, 100, 0), 50);      // (130,40) → (100,0): √(30²+40²)
  near(distToSeg(5, 5, 3, 3, 3, 3), Math.hypot(2, 2));   // nol uzunlik — nuqtagacha
});
test('lineInt: kesishma va parallel', () => {
  const i = lineInt(P(0, 0), P(100, 0), P(50, -10), P(50, 10));
  near(i.x, 50); near(i.y, 0);
  assert.equal(lineInt(P(0, 0), P(100, 0), P(0, 10), P(100, 10)), null);
});
test('plineSegs: ochiq / yopiq / 2 nuqtali yopiq', () => {
  assert.equal(plineSegs(LINE.pts, false).length, 1);
  assert.equal(plineSegs(KVADRAT.pts, true).length, 4);
  assert.equal(plineSegs(KVADRAT.pts, true)[3].i, 3);
  assert.equal(plineSegs([P(0, 0), P(10, 0)], true).length, 1);   // 2 nuqta — yopuvchi segment yo'q
  assert.equal(plineSegs(null, true).length, 0);
});

console.log('\n— offsetSide (tomon va masofa) —');
test('gorizontal chiziq: kursor pastda → +1 (normal (0,1) pastga), tepada → −1', () => {
  const p = offsetSide(LINE, P(50, 30)); assert.equal(p.side, 1); near(p.nd, 30);
  const t = offsetSide(LINE, P(50, -30)); assert.equal(t.side, -1); near(t.nd, 30);
});
test('chiziq ustidagi kursor → +1 (0 ishorasi musbat deb olinadi), nd = 0', () => {
  const s = offsetSide(LINE, P(40, 0)); assert.equal(s.side, 1); near(s.nd, 0);
});
test('aylana: tashqarida +1, ichida −1, nd — chiziqqacha', () => {
  const c = circle(0, 0, 50);
  const o = offsetSide(c, P(80, 0)); assert.equal(o.side, 1); near(o.nd, 30);
  const i = offsetSide(c, P(10, 0)); assert.equal(i.side, -1); near(i.nd, 40);
  const on = offsetSide(c, P(50, 0)); assert.equal(on.side, 1); near(on.nd, 0);
});
test('kvadrat: ichkarida +1 (birinchi segment normali ichkariga), tashqarida −1', () => {
  assert.equal(offsetSide(KVADRAT, P(50, 50)).side, 1);
  const t = offsetSide(KVADRAT, P(50, -20)); assert.equal(t.side, -1); near(t.nd, 20);
  const r = offsetSide(KVADRAT, P(130, 50)); near(r.nd, 30);   // o'ng segmentgacha
});
test('eng yaqin segment tanlanadi: kursor o\'ng segmentga yaqin', () => {
  // (95, 50): pastki/yuqori segmentlargacha 50, o'ngdagi (100,0)→(100,100) gacha 5
  const s = offsetSide(KVADRAT, P(95, 50)); near(s.nd, 5); assert.equal(s.side, 1);   // ichkarida
});
test('noto\'g\'ri kirish → null', () => {
  assert.equal(offsetSide(null, P(0, 0)), null);
  assert.equal(offsetSide({ type: 'dim' }, P(0, 0)), null);
  assert.equal(offsetSide(pline([P(0, 0)]), P(1, 1)), null);         // segment yo'q
  assert.equal(offsetSide(LINE, P(NaN, 0)), null);
});

console.log('\n— offsetPlinePts (parallel surish) —');
test('gorizontal chiziq D=+30 → 30 pastga; D=−30 → 30 tepaga', () => {
  ptsNear(offsetPlinePts(LINE.pts, false, 30), [P(0, 30), P(100, 30)]);
  ptsNear(offsetPlinePts(LINE.pts, false, -30), [P(0, -30), P(100, -30)]);
});
test('45° chiziq (0,0)→(100,100), D=−10√2 → (10,−10) ga suriladi', () => {
  // n = (−100, 100)/141.4 = (−√½, √½); D = −10√2 → surish (10, −10)
  ptsNear(offsetPlinePts([P(0, 0), P(100, 100)], false, -10 * S2), [P(10, -10), P(110, 90)], 1e-9);
});
test('yopiq kvadrat D=+10 → ichki kvadrat 10..90 (burchaklar kesishmada)', () => {
  ptsNear(offsetPlinePts(KVADRAT.pts, true, 10), [P(10, 10), P(90, 10), P(90, 90), P(10, 90)]);
});
test('yopiq kvadrat D=−10 → tashqi kvadrat −10..110', () => {
  ptsNear(offsetPlinePts(KVADRAT.pts, true, -10), [P(-10, -10), P(110, -10), P(110, 110), P(-10, 110)]);
});
test('L shakl (ochiq): burchak kesishmada, uchlar surilgan', () => {
  // (0,0)→(100,0)→(100,100); D=+10: 1-seg y=10, 2-seg (n=(−1,0)) x=90 → (0,10),(90,10),(90,100)
  ptsNear(offsetPlinePts([P(0, 0), P(100, 0), P(100, 100)], false, 10), [P(0, 10), P(90, 10), P(90, 100)]);
});
test('kollinear qo\'shni segmentlar (parallel) — oraliq uch surilgan holda qoladi', () => {
  ptsNear(offsetPlinePts([P(0, 0), P(50, 0), P(100, 0)], false, 10), [P(0, 10), P(50, 10), P(100, 10)]);
});
test('nol uzunlikdagi segment tashlab yuboriladi (NaN yo\'q): 3 nuqta → 2', () => {
  const r = offsetPlinePts([P(0, 0), P(0, 0), P(100, 0)], false, 10);
  ptsNear(r, [P(0, 10), P(100, 10)]);
});
test('AutoCAD kabi: ichkariga ofsetda qisqa faska yutiladi, qo\'shnilari qayta kesishtiriladi', () => {
  // 100×100 kvadrat, o'ng-yuqori burchagida 5 mm faska: (95,0)→(100,5)
  const fs = pline([P(0, 0), P(95, 0), P(100, 5), P(100, 100), P(0, 100)], true);
  // D=2 — faska qoladi (5 nuqta); surilgan faska chizig'i y = x − 95 + 2√2:
  //   yuqori (y=2) bilan kesishma x = 97 − 2√2, o'ng (x=98) bilan y = 3 + 2√2
  const s2 = 2 * S2;
  ptsNear(offsetPlinePts(fs.pts, true, 2), [P(2, 2), P(97 - s2, 2), P(98, 3 + s2), P(98, 98), P(2, 98)], 1e-9);
  // D=10 — faska teskari bo'lib "yutiladi" → toza kvadrat 10..90 (4 nuqta)
  ptsNear(offsetPlinePts(fs.pts, true, 10), [P(10, 10), P(90, 10), P(90, 90), P(10, 90)]);
  // tashqariga (D=−10) — faska kengayadi, 5 nuqta
  assert.equal(offsetPlinePts(fs.pts, true, -10).length, 5);
});
test('ochiq U shakl: yarim kenglikdan kichik ofset bor, kattasi (tubi yutilib, yonlari parallel) → null', () => {
  const u = [P(0, 0), P(0, 50), P(20, 50), P(20, 0)];   // ichkari — D manfiy tomon
  ptsNear(offsetPlinePts(u, false, -5), [P(5, 0), P(5, 45), P(15, 45), P(15, 0)]);
  assert.equal(offsetPlinePts(u, false, -15), null);
  assert.equal(offsetPlinePts(u, false, 15).length, 4);   // tashqariga — bor
});
test('uchburchak ichki ofset: barcha uchlar bissektrisa bo\'ylab ichkarida', () => {
  // Teng tomonli uchburchak, tomoni 100, ichki radiusi r = 100/(2√3) ≈ 28.87; D=10 → ichki uchburchak
  const h = 100 * Math.sqrt(3) / 2;
  const tri = [P(0, 0), P(100, 0), P(50, h)];   // soat mili bo'yicha ekranda (y pastga)
  const r = offsetPlinePts(tri, true, 10);
  assert.equal(r.length, 3);
  // Markaz (50, h/3); har uch markazga 2·D = 20 ga yaqinlashadi (60° burchakda masofa D/sin30 = 2D)
  const cx = 50, cy = h / 3;
  const R0 = Math.hypot(tri[0].x - cx, tri[0].y - cy);
  for (let i = 0; i < 3; i++) near(Math.hypot(r[i].x - cx, r[i].y - cy), R0 - 20, 1e-9, `uch ${i}`);
});
test('bo\'sh / noto\'g\'ri kirish → null', () => {
  assert.equal(offsetPlinePts([P(0, 0)], false, 10), null);
  assert.equal(offsetPlinePts(LINE.pts, false, NaN), null);
});

console.log('\n— offsetEnt (k-nchi ofset) —');
test('aylana: r + k·D; radius 0 ga tushsa null', () => {
  const c = circle(5, 7, 50);
  const o = offsetEnt(c, 10, 3); assert.equal(o.type, 'circle'); near(o.r, 80); near(o.cx, 5); near(o.cy, 7);
  const i = offsetEnt(c, -20, 2); near(i.r, 10);
  assert.equal(offsetEnt(c, -25, 2), null);      // 50 − 50 = 0
  assert.equal(offsetEnt(c, -20, 3), null);      // manfiy
});
test('polyline: k·D masofada, closed saqlanadi, id yo\'q', () => {
  const o = offsetEnt(KVADRAT, 10, 2);
  assert.equal(o.type, 'pline'); assert.equal(o.closed, true); assert.equal(o.id, undefined);
  ptsNear(o.pts, [P(20, 20), P(80, 20), P(80, 80), P(20, 80)]);
  assert.equal(offsetEnt(LINE, 5, 1).closed, false);
});
test('k ≤ 0, D NaN, dim → null', () => {
  assert.equal(offsetEnt(LINE, 10, 0), null);
  assert.equal(offsetEnt(LINE, NaN, 1), null);
  assert.equal(offsetEnt({ type: 'dim', x1: 0, y1: 0, x2: 1, y2: 1, off: 5 }, 10, 1), null);
});
test('asl element o\'zgarmaydi', () => {
  const src = pline([P(0, 0), P(100, 0)]);
  offsetEnt(src, 10, 1);
  ptsNear(src.pts, [P(0, 0), P(100, 0)]);
});
test('signedArea: kvadrat 100×100 → +10000 (soat mili bo\'yicha, y pastga); teskari → manfiy', () => {
  near(signedArea(KVADRAT.pts), 10000);
  near(signedArea(KVADRAT.pts.slice().reverse()), -10000);
  near(signedArea([P(0, 0), P(10, 0)]), 0);
});
test('yopiq kontur ichkariga sig\'masa null: 75×50 to\'rtburchak, D=12.5 → k=1 bor, k=2 (yuza 0) va k=3 (ag\'darilgan) null', () => {
  const rect = pline([P(0, 0), P(75, 0), P(75, 50), P(0, 50)], true);
  const o1 = offsetEnt(rect, 12.5, 1);
  ptsNear(o1.pts, [P(12.5, 12.5), P(62.5, 12.5), P(62.5, 37.5), P(12.5, 37.5)]);
  assert.equal(offsetEnt(rect, 12.5, 2), null);
  assert.equal(offsetEnt(rect, 12.5, 3), null);
  assert.equal(offsetEnt(rect, 12.5, 1.99).pts.length, 4);   // 24.875 < 25 — hali sig'adi
});
test('tashqariga ofset hech qachon "sig\'masdan" qolmaydi (yuza o\'sadi)', () => {
  const rect = pline([P(0, 0), P(75, 0), P(75, 50), P(0, 50)], true);
  assert.equal(offsetEnt(rect, -12.5, 40).pts.length, 4);
  near(signedArea(offsetEnt(rect, -12.5, 40).pts), (75 + 1000) * (50 + 1000));
});
test('teskari yo\'nalishli (soat miliga qarshi) yopiq kontur ham ichkarida to\'g\'ri to\'xtaydi', () => {
  const rev = pline([P(0, 0), P(0, 50), P(75, 50), P(75, 0)], true);   // yuza manfiy; ichkari — D manfiy tomon
  const o = offsetEnt(rev, -10, 1);
  ptsNear(o.pts, [P(10, 10), P(10, 40), P(65, 40), P(65, 10)]);
  assert.equal(offsetEnt(rev, -10, 3), null);     // 30 > 25
  assert.equal(offsetEnt(rev, 10, 3).pts.length, 4);   // tashqariga — bor
});
test('ochiq L shakl: ichki tomonga juda katta ofset (ikkala oyoq teskari) → null; tashqi tomonga — bor', () => {
  const L = pline([P(0, 0), P(100, 0), P(100, 100)]);
  assert.equal(offsetEnt(L, 10, 30), null);                                  // 300 mm ichkariga
  ptsNear(offsetEnt(L, -10, 30).pts, [P(0, -300), P(400, -300), P(400, 100)]);   // 300 mm tashqariga
});
test('o\'z-o\'zini kesuvchi yopiq kontur (sakkizlik) kichik masofada oddiy miter bilan ofset qilinadi', () => {
  const bow = pline([P(0, 0), P(100, 100), P(100, 0), P(0, 100)], true);   // ishorali yuza 0
  near(signedArea(bow.pts), 0);
  // Surilgan chiziqlar: seg0 y = x + 5√2, seg1 x = 105, seg2 y = −x + 100 − 5√2, seg3 x = 5
  const o = offsetEnt(bow, 5, 1);
  ptsNear(o.pts, [P(5, 5 + 5 * S2), P(105, 105 + 5 * S2), P(105, -5 - 5 * S2), P(5, 95 - 5 * S2)], 1e-9);
});
test('nosimmetrik «bantik» (ko\'rikda topilgan holat): kichik masofada ikkala tomonga ham ofset RAD ETILMAYDI', () => {
  const bow = pline([P(0, 0), P(100, 100), P(100, 0), P(0, 100.5)], true);
  for (const D of [1, -1, 3, -3]) {
    const o = offsetEnt(bow, D, 1);
    assert.ok(o && o.pts.length === 4, `D=${D} rad etildi`);
    // har segment yo'nalishi aslidagi bilan bir xil (hech narsa yutilmagan)
    for (let i = 0; i < 4; i++) {
      const a = bow.pts[i], b = bow.pts[(i + 1) % 4], p = o.pts[i], q = o.pts[(i + 1) % 4];
      assert.ok((q.x - p.x) * (b.x - a.x) + (q.y - p.y) * (b.y - a.y) > 0, `D=${D} segment ${i} teskari`);
    }
  }
});

console.log('\n— offsetSeries / multiOffset (Gul: nechta ofset tashlansin) —');
test('chiziq, kursor pastda, 10 mm × 3 → y = 10, 20, 30', () => {
  const r = multiOffset(LINE, P(50, 5), 10, 3);
  assert.equal(r.length, 3);
  ptsNear(r[0].pts, [P(0, 10), P(100, 10)]);
  ptsNear(r[1].pts, [P(0, 20), P(100, 20)]);
  ptsNear(r[2].pts, [P(0, 30), P(100, 30)]);
});
test('chiziq, kursor tepada, masofa yozilmagan → qadam = kursorgacha (30), 2 ta: −30, −60', () => {
  const r = multiOffset(LINE, P(50, -30), null, 2);
  assert.equal(r.length, 2);
  ptsNear(r[0].pts, [P(0, -30), P(100, -30)]);
  ptsNear(r[1].pts, [P(0, -60), P(100, -60)]);
});
test('kvadrat ichkariga 10 mm × 2 → 10..90 va 20..80', () => {
  const r = multiOffset(KVADRAT, P(50, 50), 10, 2);
  assert.equal(r.length, 2);
  ptsNear(r[0].pts, [P(10, 10), P(90, 10), P(90, 90), P(10, 90)]);
  ptsNear(r[1].pts, [P(20, 20), P(80, 20), P(80, 80), P(20, 80)]);
  assert.equal(r[1].closed, true);
});
test('kvadrat tashqariga 10 mm × 2 → −10..110 va −20..120', () => {
  const r = multiOffset(KVADRAT, P(50, -20), 10, 2);
  ptsNear(r[0].pts, [P(-10, -10), P(110, -10), P(110, 110), P(-10, 110)]);
  ptsNear(r[1].pts, [P(-20, -20), P(120, -20), P(120, 120), P(-20, 120)]);
});
test('aylana tashqariga 10 × 3 → 60, 70, 80', () => {
  const r = multiOffset(circle(0, 0, 50), P(80, 0), 10, 3);
  assert.deepEqual(r.map((o) => o.r), [60, 70, 80]);
});
test('aylana ichkariga 20 × 5 → faqat sig\'ganlari: 30, 10 (keyingisi ≤ 0 — to\'xtaydi)', () => {
  const r = multiOffset(circle(0, 0, 50), P(10, 0), 20, 5);
  assert.deepEqual(r.map((o) => o.r), [30, 10]);
});
test('aylana ichkariga masofasiz: qadam = kursorgacha (40) → 10, keyingisi sig\'maydi', () => {
  const r = multiOffset(circle(0, 0, 50), P(10, 0), null, 3);
  assert.deepEqual(r.map((o) => o.r), [10]);
});
test('n = 1 — oddiy Detal chizish offseti bilan bir xil (bitta nusxa)', () => {
  const r = multiOffset(KVADRAT, P(50, 50), 15, 1);
  assert.equal(r.length, 1);
  ptsNear(r[0].pts, [P(15, 15), P(85, 15), P(85, 85), P(15, 85)]);
});
test('n = 0, n kasr, n manfiy → bo\'sh / butun qism', () => {
  assert.equal(multiOffset(LINE, P(50, 5), 10, 0).length, 0);
  assert.equal(multiOffset(LINE, P(50, 5), 10, -2).length, 0);
  assert.equal(multiOffset(LINE, P(50, 5), 10, 2.9).length, 2);
});
test('kursor chiziq ustida va masofa yozilmagan → qadam 0 → hech narsa', () => {
  assert.equal(multiOffset(LINE, P(50, 0), null, 3).length, 0);
  assert.equal(multiOffset(LINE, P(50, 0), 0, 3).length, 0);
});
test('mos kelmagan element → bo\'sh', () => {
  assert.equal(multiOffset({ type: 'dim' }, P(0, 0), 10, 2).length, 0);
  assert.equal(multiOffset(null, P(0, 0), 10, 2).length, 0);
});
test('offsetSeries: ishorali qadam to\'g\'ridan-to\'g\'ri', () => {
  const r = offsetSeries(LINE, -5, 2);
  ptsNear(r[0].pts, [P(0, -5), P(100, -5)]);
  ptsNear(r[1].pts, [P(0, -10), P(100, -10)]);
  assert.equal(offsetSeries(LINE, 5, '3').length, 3);
  assert.equal(offsetSeries(LINE, 5, 'x').length, 0);
});
test('offsetSeries: n = Infinity cheksiz sikl bermaydi — 1000 bilan chegaralanadi', () => {
  assert.equal(offsetSeries(LINE, 5, Infinity).length, 1000);
  assert.equal(offsetSeries(LINE, 5, 1e9).length, 1000);
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
