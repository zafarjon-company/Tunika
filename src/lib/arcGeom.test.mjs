// ============================================================
//  YOY (ARC) GEOMETRIYASI — TESTLAR
//  Ishga tushirish:  node src/lib/arcGeom.test.mjs   (npm run test:arc)
//  DOM kerak emas — sof geometriya sinaladi.
//
//  Konvensiya: world mm, x o'ngga, y PASTGA. 0° = o'ng, 90° = TEPA (y manfiy),
//  soat miliga qarshi musbat. Har testda kutilgan qiymat MUSTAQIL hisoblangan.
// ============================================================
import assert from 'node:assert/strict';
import {
  norm180, arcSweep, arcLen, arcPt, arcStart, arcEnd, arcMid, angInArc, arcBounds, distToArc, arcSamples, arcDrawnEnd,
  arcSCA, arcSCE, arcSCL, arcSEA, arcSED, arcSER, arcFrom3, arcContinue, arcMap, arcSvgPath,
} from './arcGeom.js';

let jami = 0;
let xato = 0;
function test(nom, fn) {
  jami += 1;
  try { fn(); console.log(`  ✅ ${nom}`); }
  catch (e) {
    xato += 1;
    const msg = String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n');
    console.log(`  ❌ ${nom}\n${msg}`);
  }
}
const near = (olingan, kutilgan, eps = 1e-9, nom = '') => {
  assert.ok(Math.abs(olingan - kutilgan) <= eps, `${nom} kutilgan ${kutilgan}, olingan ${olingan}`);
};
const P = (x, y) => ({ x, y });
const R2 = Math.SQRT1_2;
// Yoyni solishtirish (burchaklar 0..360 da, 1e-7 tolerans)
const arcNear = (o, k, eps = 1e-7) => {
  assert.ok(o, 'yoy null');
  near(o.cx, k.cx, eps, 'cx'); near(o.cy, k.cy, eps, 'cy'); near(o.r, k.r, eps, 'r');
  near(o.a0, k.a0, eps, 'a0'); near(o.a1, k.a1, eps, 'a1');
  if (k.ccw !== undefined) assert.equal(o.ccw, k.ccw, 'ccw');
};
const Q = { cx: 0, cy: 0, r: 10, a0: 0, a1: 90 };   // chorak yoy: (10,0) → (0,−10), o'ngdan tepaga

console.log('\n— Xossalar —');
test('norm180: 270 → −90, 90 → 90, 180 → 180, −190 → 170', () => {
  near(norm180(270), -90); near(norm180(90), 90); near(norm180(180), 180); near(norm180(-190), 170);
});
test('arcSweep: 0→90 = 90; 350→10 = 20; a0 == a1 → 360 (to\'liq)', () => {
  near(arcSweep(Q), 90); near(arcSweep({ a0: 350, a1: 10 }), 20); near(arcSweep({ a0: 30, a1: 30 }), 360);
});
test('arcLen: r=10, 90° → 5π', () => { near(arcLen(Q), 5 * Math.PI); });
test('arcStart/End/Mid: (10,0), (0,−10), 45° → (7.07,−7.07)', () => {
  const s = arcStart(Q), e = arcEnd(Q), m = arcMid(Q);
  near(s.x, 10); near(s.y, 0); near(e.x, 0); near(e.y, -10); near(m.x, 10 * R2); near(m.y, -10 * R2);
  const p = arcPt({ cx: 5, cy: 5, r: 2 }, 180); near(p.x, 3); near(p.y, 5);
});
test('angInArc: 0..90 ichida 45 ✓, 0 ✓, 90 ✓, 135 ✗; 300..60 (120°) ichida 0/30/350 ✓, 90 ✗', () => {
  assert.ok(angInArc(Q, 45)); assert.ok(angInArc(Q, 0)); assert.ok(angInArc(Q, 90)); assert.ok(!angInArc(Q, 135));
  const e2 = { cx: 0, cy: 0, r: 1, a0: 300, a1: 60 };
  assert.ok(angInArc(e2, 0)); assert.ok(angInArc(e2, 30)); assert.ok(angInArc(e2, 350)); assert.ok(!angInArc(e2, 90));
});
test('arcBounds: chorak yoy → x 0..10, y −10..0; yuqori yarim (0..180) → x −10..10, y −10..0', () => {
  const b = arcBounds(Q); near(b.minX, 0); near(b.maxX, 10); near(b.minY, -10); near(b.maxY, 0);
  const h = arcBounds({ cx: 0, cy: 0, r: 10, a0: 0, a1: 180 }); near(h.minX, -10); near(h.maxX, 10); near(h.minY, -10); near(h.maxY, 0);
  // 45..135 (tepa qismi): kvadrant 90 kiradi → minY −10; uchlari y = −7.07 → maxY −7.07
  const t = arcBounds({ cx: 0, cy: 0, r: 10, a0: 45, a1: 135 }); near(t.minY, -10); near(t.maxY, -10 * R2); near(t.minX, -10 * R2); near(t.maxX, 10 * R2);
});
test('distToArc: burchak ichida — aylanagacha; tashqarida — yaqin uchigacha', () => {
  near(distToArc(Q, P(20, 0)), 10);                      // 0° ichida
  near(distToArc(Q, P(20 * R2, -20 * R2)), 10);          // 45° ichida
  near(distToArc(Q, P(0, 20)), Math.hypot(10, 20));      // 270° tashqarida → (10,0) uchigacha √500
  near(distToArc(Q, P(-3, -10)), 3);                     // 180-ga yaqin tashqarida → (0,−10) uchigacha 3
  near(distToArc(Q, P(0, 0)), 10);                       // markaz (d=0) → uchlargacha 10
});
test('arcSamples: n=2 → boshi, o\'rtasi, oxiri', () => {
  const s = arcSamples(Q, 2);
  assert.equal(s.length, 3);
  near(s[1].x, 10 * R2); near(s[1].y, -10 * R2); near(s[2].y, -10);
});
test('arcDrawnEnd: ccw → oxiri (0,−10), yo\'nalish 180; cw → boshi (10,0), yo\'nalish 270', () => {
  const a = arcDrawnEnd(Q, true); near(a.x, 0); near(a.y, -10); near(a.ang, 180);
  const b = arcDrawnEnd(Q, false); near(b.x, 10); near(b.y, 0); near(b.ang, 270);
});

console.log('\n— Boshi, Markaz, * —');
test('arcSCA: (10,0), markaz (0,0), +90 → 0..90 ccw; −90 → 270..0 cw; 0 va ±360 → null', () => {
  arcNear(arcSCA(P(10, 0), P(0, 0), 90), { cx: 0, cy: 0, r: 10, a0: 0, a1: 90, ccw: true });
  arcNear(arcSCA(P(10, 0), P(0, 0), -90), { cx: 0, cy: 0, r: 10, a0: 270, a1: 0, ccw: false });
  assert.equal(arcSCA(P(10, 0), P(0, 0), 0), null);
  assert.equal(arcSCA(P(10, 0), P(0, 0), 360), null);
  assert.equal(arcSCA(P(0, 0), P(0, 0), 90), null);   // r = 0
});
test('arcSCE: oxirgi nuqta faqat burchak beradi (radius boshidan), har doim CCW', () => {
  arcNear(arcSCE(P(10, 0), P(0, 0), P(0, -5)), { cx: 0, cy: 0, r: 10, a0: 0, a1: 90, ccw: true });
  arcNear(arcSCE(P(10, 0), P(0, 0), P(0, 50)), { cx: 0, cy: 0, r: 10, a0: 0, a1: 270, ccw: true });   // pastga → 270° CCW
  assert.equal(arcSCE(P(10, 0), P(0, 0), P(30, 0)), null);   // bir xil burchak
});
test('arcSCL: vatar 10√2 → 90°; −10√2 → 270° (katta yoy); 20 → 180°; 30 > 2r → null', () => {
  arcNear(arcSCL(P(10, 0), P(0, 0), 10 * Math.SQRT2), { cx: 0, cy: 0, r: 10, a0: 0, a1: 90, ccw: true });
  arcNear(arcSCL(P(10, 0), P(0, 0), -10 * Math.SQRT2), { cx: 0, cy: 0, r: 10, a0: 0, a1: 270, ccw: true });
  arcNear(arcSCL(P(10, 0), P(0, 0), 20), { cx: 0, cy: 0, r: 10, a0: 0, a1: 180 });
  assert.equal(arcSCL(P(10, 0), P(0, 0), 30), null);
  assert.equal(arcSCL(P(10, 0), P(0, 0), 0), null);
});

console.log('\n— Boshi, Oxiri, * —');
test('arcSEA: (0,0)→(100,0), 180° → markaz (50,0), r 50, 180..0 (pastdan o\'tadi)', () => {
  arcNear(arcSEA(P(0, 0), P(100, 0), 180), { cx: 50, cy: 0, r: 50, a0: 180, a1: 0, ccw: true });
});
test('arcSEA: 90° → markaz (50,−50) (vatar tepasida), r 70.71, 225..315 — yoy pastga bo\'rtadi', () => {
  const a = arcSEA(P(0, 0), P(100, 0), 90);
  arcNear(a, { cx: 50, cy: -50, r: 50 * Math.SQRT2, a0: 225, a1: 315, ccw: true });
  const m = arcMid(a); near(m.x, 50); near(m.y, -50 + 50 * Math.SQRT2);   // (50, 20.7) — vatar ostida
});
test('arcSEA: −90° → soat mili bo\'yicha: markaz (50,50), 45..135, ccw=false — yoy tepaga bo\'rtadi', () => {
  const a = arcSEA(P(0, 0), P(100, 0), -90);
  arcNear(a, { cx: 50, cy: 50, r: 50 * Math.SQRT2, a0: 45, a1: 135, ccw: false });
  const m = arcMid(a); near(m.x, 50); near(m.y, 50 - 50 * Math.SQRT2);   // (50, −20.7) — vatar tepasida
});
test('arcSEA: 270° (katta yoy) → markaz (50,50), 135..45', () => {
  arcNear(arcSEA(P(0, 0), P(100, 0), 270), { cx: 50, cy: 50, r: 50 * Math.SQRT2, a0: 135, a1: 45, ccw: true });
});
test('arcSEA: 0, 360, bir xil nuqtalar → null', () => {
  assert.equal(arcSEA(P(0, 0), P(100, 0), 0), null);
  assert.equal(arcSEA(P(0, 0), P(100, 0), 360), null);
  assert.equal(arcSEA(P(0, 0), P(0, 0), 90), null);
});
test('arcSED: yo\'nalish tepaga (90°) → yuqori yarim aylana, cw; pastga (270°) → pastki yarim, ccw', () => {
  arcNear(arcSED(P(0, 0), P(100, 0), 90), { cx: 50, cy: 0, r: 50, a0: 0, a1: 180, ccw: false });
  arcNear(arcSED(P(0, 0), P(100, 0), 270), { cx: 50, cy: 0, r: 50, a0: 180, a1: 0, ccw: true });
});
test('arcSED: yo\'nalish 45° → boshida tangens 45° bo\'lgan yoy (markaz (50,50), 45..135, cw)', () => {
  const a = arcSED(P(0, 0), P(100, 0), 45);
  arcNear(a, { cx: 50, cy: 50, r: 50 * Math.SQRT2, a0: 45, a1: 135, ccw: false });
  // chizilgan boshi (0,0) — a1 uchi (135°); u yerdagi CCW tangens 225°, chizish yo'nalishi teskari → 45°
  const d = arcDrawnEnd(a, a.ccw); near(d.x, 100); near(d.y, 0); near(d.ang, norm180(45 - 90) + 360 === 315 ? 315 : 315);
});
test('arcSED: vatar bo\'ylab (0°) yoki teskari (180°) → null', () => {
  assert.equal(arcSED(P(0, 0), P(100, 0), 0), null);
  assert.equal(arcSED(P(0, 0), P(100, 0), 180), null);
});
test('arcSER: R=50 → yarim; R=50√2 → 90° (markaz tepada); −50√2 → 270°; R=40 < 50 → null', () => {
  arcNear(arcSER(P(0, 0), P(100, 0), 50), { cx: 50, cy: 0, r: 50, a0: 180, a1: 0, ccw: true });
  arcNear(arcSER(P(0, 0), P(100, 0), 50 * Math.SQRT2), { cx: 50, cy: -50, r: 50 * Math.SQRT2, a0: 225, a1: 315 });
  arcNear(arcSER(P(0, 0), P(100, 0), -50 * Math.SQRT2), { cx: 50, cy: 50, r: 50 * Math.SQRT2, a0: 135, a1: 45 });
  assert.equal(arcSER(P(0, 0), P(100, 0), 40), null);
});

console.log('\n— 3 nuqta / Davom ettirish —');
test('arcFrom3: (10,0),(0,−10),(−10,0) → markaz (0,0), r 10, 0..180, ccw', () => {
  arcNear(arcFrom3(P(10, 0), P(0, -10), P(-10, 0)), { cx: 0, cy: 0, r: 10, a0: 0, a1: 180, ccw: true });
});
test('arcFrom3 teskari tartib (−10,0),(0,−10),(10,0) → o\'sha yoy, ccw=false', () => {
  arcNear(arcFrom3(P(-10, 0), P(0, -10), P(10, 0)), { cx: 0, cy: 0, r: 10, a0: 0, a1: 180, ccw: false });
});
test('arcFrom3 pastdan: (10,0),(0,10),(−10,0) → 180..0 (270° orqali), ccw=false', () => {
  arcNear(arcFrom3(P(10, 0), P(0, 10), P(-10, 0)), { cx: 0, cy: 0, r: 10, a0: 180, a1: 0, ccw: false });
});
test('arcFrom3: umumiy holat — markaz uch nuqtadan teng uzoqlikda', () => {
  const a = arcFrom3(P(3, 7), P(11, 2), P(20, 9));
  for (const p of [P(3, 7), P(11, 2), P(20, 9)]) near(Math.hypot(p.x - a.cx, p.y - a.cy), a.r, 1e-9);
  assert.ok(angInArc(a, Math.atan2(-(2 - a.cy), 11 - a.cx) * 180 / Math.PI + (Math.atan2(-(2 - a.cy), 11 - a.cx) < 0 ? 360 : 0)));
});
test('arcFrom3: bir chiziqda → null', () => { assert.equal(arcFrom3(P(0, 0), P(5, 5), P(10, 10)), null); });
test('arcContinue: o\'ngga ketayotgan chiziqdan (100,−100) ga → markaz (0,−100), 270..0, boshida tangens 0°', () => {
  const a = arcContinue({ x: 0, y: 0, ang: 0 }, P(100, -100));
  arcNear(a, { cx: 0, cy: -100, r: 100, a0: 270, a1: 0, ccw: true });
  assert.equal(arcContinue({ x: 0, y: 0 }, P(1, 1)), null);
  assert.equal(arcContinue(null, P(1, 1)), null);
});

console.log('\n— O\'zgartirish / SVG —');
test('arcMap surish (+5,+5): markaz (5,5), burchaklar o\'zgarmaydi', () => {
  arcNear(arcMap(Q, (p) => P(p.x + 5, p.y + 5)), { cx: 5, cy: 5, r: 10, a0: 0, a1: 90 });
});
test('arcMap aks (x → −x): 0..90 → 90..180 (yo\'nalish teskarisi o\'rta nuqta orqali tuzatiladi)', () => {
  arcNear(arcMap(Q, (p) => P(-p.x, p.y)), { cx: 0, cy: 0, r: 10, a0: 90, a1: 180 });
});
test('arcMap burish 90° CCW: 0..90 → 90..180', () => {
  const rot = (p) => P(p.y, -p.x);   // (x,y) → 90° CCW (ekranda): (10,0)→(0,−10)
  arcNear(arcMap(Q, rot), { cx: 0, cy: 0, r: 10, a0: 90, a1: 180 });
});
test('arcMap masshtab ×2: r 20', () => { arcNear(arcMap(Q, (p) => P(2 * p.x, 2 * p.y)), { cx: 0, cy: 0, r: 20, a0: 0, a1: 90 }); });
test('arcMap nol o\'lcham → null', () => { assert.equal(arcMap(Q, () => P(0, 0)), null); });
test('arcSvgPath: chorak → sweep-flag 0, large 0; 270° → large 1; to\'liq → ikki yarim', () => {
  const id = (x, y) => P(x, y);
  // "M10 0 A10 10 0 0 0 6e-16 -10" — sonlar tolerans bilan (cos 90° = 6·10⁻¹⁷)
  const t = arcSvgPath(Q, id, 1).replace(/[MA]/g, '').trim().split(/\s+/).map(Number);
  assert.equal(t.length, 9);
  [10, 0, 10, 10, 0, 0, 0, 0, -10].forEach((k, i) => near(t[i], k, 1e-9, `path[${i}]`));
  assert.equal(arcSvgPath({ cx: 0, cy: 0, r: 10, a0: 0, a1: 270 }, id, 1).split(' ')[5], '1');   // M x y A rx ry rot LARGE sweep x y
  assert.ok(arcSvgPath({ cx: 0, cy: 0, r: 10, a0: 0, a1: 0 }, id, 1).includes('A10 10 0 1 0'));
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
