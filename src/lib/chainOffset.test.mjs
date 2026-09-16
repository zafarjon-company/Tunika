// ============================================================
//  ZANJIR (JOIN) OFSETI — TESTLAR
//  Ishga tushirish:  node src/lib/chainOffset.test.mjs   (npm run test:chain)
//  Konvensiya: world mm, x o'ngga, y PASTGA; 0° o'ng, 90° tepa, CCW musbat.
//  D > 0 — yurish yo'nalishining o'ng tomoni. Kutilgan qiymatlar mustaqil hisoblangan.
// ============================================================
import assert from 'node:assert/strict';
import { unitOf, buildChains, chainOf, chainSide, offsetChain, piecesToEnts, offsetChainSeries, pieceStart, pieceEnd, pieceSweep, tangentAt, reversePiece, chainInwardSign, offsetChainInward } from './chainOffset.js';
import { offsetPlinePts } from './offsetGeom.js';

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

// Kvadrat 100×100 — 4 ta ALOHIDA chiziq, aralash tartib va yo'nalishda
const SQ4 = [pl('s3', [P(0, 100), P(100, 100)]), pl('s1', [P(0, 0), P(100, 0)]), pl('s4', [P(0, 0), P(0, 100)]), pl('s2', [P(100, 100), P(100, 0)])];
// Stadion: yuqori chiziq, o'ng yoy (markaz (100,25) r25, 270..90 — o'ngga bo'rtgan), pastki chiziq, chap yoy
const STAD = [pl('t', [P(0, 0), P(100, 0)]), arc('ra', 100, 25, 25, 270, 90), pl('b', [P(100, 50), P(0, 50)]), arc('la', 0, 25, 25, 90, 270)];
// «Oy»: pastga bo'rtgan yarim aylana (markaz (50,0) r50, 180..0 → 270 orqali) + vatar
const MOON = [arc('a', 50, 0, 50, 180, 0), pl('c', [P(100, 0), P(0, 0)])];

console.log('\n— Birliklar / bo\'laklar —');
test('unitOf: ochiq pline → n−1 seg; yopiq → n seg (closed); yoy → 1 yoy bo\'lagi (ccw); aylana → null', () => {
  assert.equal(unitOf(pl('p', [P(0, 0), P(1, 0), P(1, 1)])).pieces.length, 2);
  const c = unitOf(pl('p', [P(0, 0), P(1, 0), P(1, 1)], true)); assert.equal(c.pieces.length, 3); assert.equal(c.closed, true);
  const a = unitOf(arc('a', 0, 0, 10, 0, 90)); assert.equal(a.pieces[0].kind, 'arc'); assert.equal(a.pieces[0].ccw, true); near(a.pieces[0].sa, 0); near(a.pieces[0].ea, 90);
  assert.equal(unitOf({ id: 'k', type: 'circle', cx: 0, cy: 0, r: 5 }), null);
  assert.equal(unitOf(pl('p', [P(0, 0)])), null);
});
test('pieceStart/End, pieceSweep, tangentAt, reversePiece (yoy 0..90 CCW: boshi (10,0), oxiri (0,−10))', () => {
  const p = unitOf(arc('a', 0, 0, 10, 0, 90)).pieces[0];
  ptsNear([pieceStart(p), pieceEnd(p)], [P(10, 0), P(0, -10)]);
  near(pieceSweep(p), 90); near(tangentAt(p, false), 90); near(tangentAt(p, true), 180);
  const r = reversePiece(p); assert.equal(r.ccw, false); near(r.sa, 90); near(r.ea, 0); near(pieceSweep(r), 90); near(tangentAt(r, false), 0);
  ptsNear([pieceStart(r), pieceEnd(r)], [P(0, -10), P(10, 0)]);
});

console.log('\n— Zanjirlarni qurish —');
test('4 alohida chiziq (aralash tartib/yo\'nalish) → bitta YOPIQ zanjir, 4 bo\'lak, uchlari ketma-ket tutash', () => {
  const ch = buildChains(SQ4);
  assert.equal(ch.length, 1); assert.equal(ch[0].closed, true); assert.equal(ch[0].pieces.length, 4); assert.equal(ch[0].ids.size, 4);
  for (let i = 0; i < 4; i++) near(Math.hypot(pieceEnd(ch[0].pieces[i]).x - pieceStart(ch[0].pieces[(i + 1) % 4]).x, pieceEnd(ch[0].pieces[i]).y - pieceStart(ch[0].pieces[(i + 1) % 4]).y), 0, 1e-9, `tutash ${i}`);
});
test('stadion: chiziq + yoy + chiziq + yoy → yopiq zanjir, yoylar kerakli yo\'nalishda (CW) buriladi', () => {
  const ch = buildChains(STAD);
  assert.equal(ch.length, 1); assert.equal(ch[0].closed, true); assert.equal(ch[0].pieces.length, 4);
  const kinds = ch[0].pieces.map((p) => p.kind); assert.deepEqual(kinds, ['seg', 'arc', 'seg', 'arc']);
  assert.equal(ch[0].pieces[1].ccw, false); near(ch[0].pieces[1].sa, 90); near(ch[0].pieces[1].ea, 270);
  assert.equal(ch[0].pieces[3].ccw, false); near(ch[0].pieces[3].sa, 270); near(ch[0].pieces[3].ea, 90);
});
test('uzilish (> tol) → alohida zanjirlar; yopiq polyline o\'zi halqa (tegib turgan chiziq unga qo\'shilmaydi)', () => {
  const ch = buildChains([pl('a', [P(0, 0), P(10, 0)]), pl('b', [P(10.2, 0), P(20, 0)])]);
  assert.equal(ch.length, 2); assert.equal(ch[0].closed, false);
  const ch2 = buildChains([pl('sq', [P(0, 0), P(10, 0), P(10, 10), P(0, 10)], true), pl('x', [P(10, 0), P(20, 0)])]);
  assert.equal(ch2.length, 2); assert.equal(ch2[0].closed, true); assert.equal(ch2[0].pieces.length, 4);
  assert.equal(chainOf(ch2 && [pl('sq', [P(0, 0), P(10, 0), P(10, 10), P(0, 10)], true), pl('x', [P(10, 0), P(20, 0)])], 'x').pieces.length, 1);
});
test('boshidan teskariga davom: zanjir o\'rtasidan boshlansa ham hammasi yig\'iladi (ochiq)', () => {
  const ch = buildChains([pl('m', [P(10, 0), P(20, 0)]), pl('l', [P(0, 0), P(10, 0)]), pl('r', [P(30, 0), P(20, 0)])]);
  assert.equal(ch.length, 1); assert.equal(ch[0].closed, false); assert.equal(ch[0].pieces.length, 3);
  ptsNear([pieceStart(ch[0].pieces[0]), pieceEnd(ch[0].pieces[2])], [P(0, 0), P(30, 0)]);
});

console.log('\n— Tomon —');
test('chainSide: kvadrat — ichkari va tashqari qarama-qarshi ishorada (zanjir yo\'nalishi birinchi elementdan), nd — masofa; stadion (CW) ichkari +1', () => {
  const sq = buildChains(SQ4)[0];
  const inn = chainSide(sq, P(50, 50)).side;
  const o = chainSide(sq, P(50, -10)); assert.equal(o.side, -inn); near(o.nd, 10);
  assert.equal(chainSide(sq, P(50, 45)).side, inn); near(chainSide(sq, P(50, 45)).nd, 45);
  const st = buildChains(STAD)[0];
  assert.equal(chainSide(st, P(50, 25)).side, 1);
  const rr = chainSide(st, P(135, 25)); assert.equal(rr.side, -1); near(rr.nd, 10);
  assert.equal(chainSide(st, P(115, 25)).side, 1);
});

test('chainInwardSign: kvadrat (CCW zanjir) −1, stadion (CW) +1, oy (CCW) −1 — chainSide ichki nuqtasi bilan mos', () => {
  const sq = buildChains(SQ4)[0], st = buildChains(STAD)[0], mo = buildChains(MOON)[0];
  assert.equal(chainInwardSign(sq), chainSide(sq, P(50, 50)).side);
  assert.equal(chainInwardSign(st), 1); assert.equal(chainInwardSign(st), chainSide(st, P(50, 25)).side);
  assert.equal(chainInwardSign(mo), -1); assert.equal(chainInwardSign(mo), chainSide(mo, P(50, 20)).side);
});
test('offsetChainInward: ishorasiz masofa — har doim ichkariga (kvadrat 10..90; stadion r 20; oy r 40)', () => {
  const sq = piecesToEnts(offsetChainInward(buildChains(SQ4)[0], 10), true)[0].pts.map((p) => p.x).sort((a, b) => a - b);
  near(sq[0], 10); near(sq[3], 90);
  const st = piecesToEnts(offsetChainInward(buildChains(STAD)[0], -5), true);   // manfiy berilsa ham ichkariga
  for (const a of st.filter((e) => e.type === 'arc')) near(a.r, 20);
  const mo = piecesToEnts(offsetChainInward(buildChains(MOON)[0], 10), true);
  near(mo.find((e) => e.type === 'arc').r, 40);
});

console.log('\n— Ofset: faqat chiziqlar —');
test('4 alohida chiziqli kvadrat, ichkariga 10 (tomon kursordan) → BITTA yopiq polyline 10..90; tashqariga → −10..110', () => {
  const ch = buildChains(SQ4)[0];
  const inn = chainSide(ch, P(50, 50)).side;
  const ents = piecesToEnts(offsetChain(ch, 10 * inn), true);
  assert.equal(ents.length, 1); assert.equal(ents[0].type, 'pline'); assert.equal(ents[0].closed, true);
  const xs = ents[0].pts.map((p) => p.x).sort((a, b) => a - b), ys = ents[0].pts.map((p) => p.y).sort((a, b) => a - b);
  near(xs[0], 10); near(xs[3], 90); near(ys[0], 10); near(ys[3], 90); assert.equal(ents[0].pts.length, 4);
  const out = piecesToEnts(offsetChain(ch, -10 * inn), true)[0].pts.map((p) => p.x).sort((a, b) => a - b);
  near(out[0], -10); near(out[3], 110);
});
test('paritet offsetPlinePts bilan: faskali kvadrat (D=2, D=10 — faska yutiladi) va U shakl (−5, −15 → null)', () => {
  const fs = pl('f', [P(0, 0), P(95, 0), P(100, 5), P(100, 100), P(0, 100)], true);
  for (const D of [2, 10, -7]) {
    const a = piecesToEnts(offsetChain(buildChains([fs])[0], D), true)[0].pts, b = offsetPlinePts(fs.pts, true, D);
    ptsNear(a, b, 1e-7);
  }
  const u = pl('u', [P(0, 0), P(0, 50), P(20, 50), P(20, 0)]);
  const ch = buildChains([u])[0];
  ptsNear(piecesToEnts(offsetChain(ch, -5), false)[0].pts, offsetPlinePts(u.pts, false, -5));
  assert.equal(offsetChain(ch, -15), null);
});
test('offsetChainSeries: kvadrat ichkariga qadam 10 × 6 → faqat 4 tasi sig\'adi (80, 60, 40, 20)', () => {
  const ch = buildChains(SQ4)[0];
  const s = offsetChainSeries(ch, 10 * chainSide(ch, P(50, 50)).side, 6);
  assert.equal(s.length, 4);
  s.forEach((ents, i) => { const w = Math.max(...ents[0].pts.map((p) => p.x)) - Math.min(...ents[0].pts.map((p) => p.x)); near(w, 80 - 20 * i); });
});

console.log('\n— Ofset: chiziq + yoy (silliq tutashma) —');
test('stadion ichkariga 5 → chiziqlar y=5/45, yoylar r=20 (burchaklar saqlanadi), 4 element', () => {
  const ents = piecesToEnts(offsetChain(buildChains(STAD)[0], 5), true);
  assert.equal(ents.length, 4);
  const arcs = ents.filter((e) => e.type === 'arc'), pls = ents.filter((e) => e.type === 'pline');
  assert.equal(arcs.length, 2); assert.equal(pls.length, 2);
  for (const a of arcs) near(a.r, 20);
  const ra = arcs.find((a) => a.cx === 100); near(ra.a0, 270); near(ra.a1, 90);
  const la = arcs.find((a) => a.cx === 0); near(la.a0, 90); near(la.a1, 270);
  const ys = pls.map((p) => p.pts[0].y).sort((x, y) => x - y); near(ys[0], 5); near(ys[1], 45);
  for (const p of pls) { assert.equal(p.pts.length, 2); near(Math.abs(p.pts[1].x - p.pts[0].x), 100); }
});
test('stadion tashqariga (−5) → yoylar r=30, chiziqlar y=−5/55; ichkariga 20 → r=5 (bor); 25 va 30 → null', () => {
  const ch = buildChains(STAD)[0];
  const o = piecesToEnts(offsetChain(ch, -5), true);
  for (const a of o.filter((e) => e.type === 'arc')) near(a.r, 30);
  const ys = o.filter((e) => e.type === 'pline').map((p) => p.pts[0].y).sort((x, y) => x - y); near(ys[0], -5); near(ys[1], 55);
  const t = piecesToEnts(offsetChain(ch, 20), true); assert.equal(t.length, 4); for (const a of t.filter((e) => e.type === 'arc')) near(a.r, 5);
  assert.equal(offsetChain(ch, 25), null);
  assert.equal(offsetChain(ch, 30), null);
});
test('«oy» (yarim aylana + vatar) ichkariga 10: yoy r 40 kesilib 194.5°..345.5°, vatar y=10, x 11.27..88.73', () => {
  const ch = buildChains(MOON)[0];
  assert.equal(ch.closed, true); assert.equal(ch.pieces.length, 2);
  const ents = piecesToEnts(offsetChain(ch, -10), true);   // yurish CCW → ichkari = chap = D < 0
  assert.equal(ents.length, 2);
  const a = ents.find((e) => e.type === 'arc'), c = ents.find((e) => e.type === 'pline');
  near(a.r, 40); near(a.cx, 50); near(a.cy, 0);
  const h = Math.sqrt(1600 - 100);   // 38.73
  const a0 = (Math.atan2(-10, -h) * 180 / Math.PI + 360) % 360, a1 = (Math.atan2(-10, h) * 180 / Math.PI + 360) % 360;
  near(a.a0, a0, 1e-6); near(a.a1, a1, 1e-6);
  const xs = c.pts.map((p) => p.x).sort((x, y) => x - y);
  near(xs[0], 50 - h, 1e-7); near(xs[1], 50 + h, 1e-7); near(c.pts[0].y, 10); near(c.pts[1].y, 10);
});
test('«oy» juda katta ichki ofset (−30, −40): vatar aylanani kesmaydi, tutashma silliq emas → null', () => {
  const ch = buildChains(MOON)[0];
  assert.equal(offsetChain(ch, -30), null);
  assert.equal(offsetChain(ch, -40), null);
  assert.ok(offsetChain(ch, -20));
});
test('«oy» tashqariga (+10): yoy r 60, vatar y=−10, x kengayadi', () => {
  const ents = piecesToEnts(offsetChain(buildChains(MOON)[0], 10), true);
  const a = ents.find((e) => e.type === 'arc'), c = ents.find((e) => e.type === 'pline');
  near(a.r, 60);
  const h = Math.sqrt(3600 - 100);
  const xs = c.pts.map((p) => p.x).sort((x, y) => x - y); near(xs[0], 50 - h, 1e-7); near(xs[1], 50 + h, 1e-7); near(c.pts[0].y, -10);
});

console.log('\n— Ofset: yoy + yoy —');
test('bitta yoy zanjiri: r ± D, burchaklar saqlanadi; radius tugasa null', () => {
  const ch = buildChains([arc('a', 0, 0, 10, 0, 90)])[0];
  const o = piecesToEnts(offsetChain(ch, 3), false); assert.equal(o.length, 1); near(o[0].r, 13); near(o[0].a0, 0); near(o[0].a1, 90);
  const i = piecesToEnts(offsetChain(ch, -3), false); near(i[0].r, 7);
  assert.equal(offsetChain(ch, -10), null);
});
test('S-egri (ikki tangens yoy, qarama-qarshi yo\'nalish): ofsetda biri kengayadi, biri torayadi, tutashma nuqtasi (0,12)', () => {
  // arc1: markaz (0,0) r10, 90..270 (chapga bo'rtgan), (0,−10)→(0,10); arc2: markaz (0,20) r10, 270..90 (o'ngga), (0,10)→(0,30)
  const ch = buildChains([arc('a1', 0, 0, 10, 90, 270), arc('a2', 0, 20, 10, 270, 90)])[0];
  assert.equal(ch.closed, false); assert.equal(ch.pieces.length, 2);
  assert.equal(ch.pieces[0].ccw, true); assert.equal(ch.pieces[1].ccw, false);
  const ents = piecesToEnts(offsetChain(ch, 2), false);
  assert.equal(ents.length, 2);
  near(ents[0].r, 12); near(ents[1].r, 8);
  // tutashma: arc1' oxiri (270°) = (0,12); arc2' boshi — (0,20) dan (0,12) → 90°
  near(ents[0].a1, 270); near(ents[1].a1, 90);   // arc2 CW bo'lak → element a1 = sa = 90
  near(ents[1].cx, 0); near(ents[1].cy, 20);
});

test('«linza» (ikki yoy o\'tkir burchak ostida, silliq emas): ichkariga ofset — radiuslar kamayadi, uchlar simmetrik ichkariga suriladi', () => {
  // yuqori yoy: markaz (50,50) r 50√2, (0,0)→(100,0) tepadan (CW: 135..45); pastki yoy: markaz (50,−50), (100,0)→(0,0) pastdan
  const up = arc('u', 50, 50, 50 * Math.SQRT2, 45, 135), dn = arc('d', 50, -50, 50 * Math.SQRT2, 225, 315);
  const ch = buildChains([up, dn])[0];
  assert.equal(ch.closed, true); assert.equal(ch.pieces.length, 2);
  const inn = chainSide(ch, P(50, 0)).side;
  const ents = piecesToEnts(offsetChain(ch, 5 * inn), true);
  assert.equal(ents.length, 2);
  for (const e of ents) { assert.equal(e.type, 'arc'); near(e.r, 50 * Math.SQRT2 - 5); }
  // uchlar: ikkala kichraygan aylananing kesishmalari — y = 0 da, x simmetrik (50 ± h)
  const rr = 50 * Math.SQRT2 - 5, h = Math.sqrt(rr * rr - 2500);
  const ptsU = [arcPtOf(ents[0], ents[0].a0), arcPtOf(ents[0], ents[0].a1)].sort((a, b) => a.x - b.x);
  near(ptsU[0].x, 50 - h, 1e-6); near(ptsU[1].x, 50 + h, 1e-6); near(ptsU[0].y, 0, 1e-6); near(ptsU[1].y, 0, 1e-6);
  assert.equal(offsetChain(ch, 30 * inn), null);   // 5√2·10 − 30 = 40.7 < 50 — aylanalar kesishmaydi → sig'madi
});
function arcPtOf(e, ang) { const r = ang * Math.PI / 180; return { x: e.cx + e.r * Math.cos(r), y: e.cy - e.r * Math.sin(r) }; }

console.log('\n— piecesToEnts —');
test('yopiq aralash: segment qatori halqa bo\'ylab bo\'linmaydi (yoydan keyin boshlanadi)', () => {
  const pieces = [
    { kind: 'seg', a: P(0, 10), b: P(0, 0) }, { kind: 'seg', a: P(0, 0), b: P(10, 0) },
    { kind: 'arc', cx: 10, cy: 5, r: 5, sa: 90, ea: 270, ccw: false },
    { kind: 'seg', a: P(10, 10), b: P(0, 10) },
  ];
  const ents = piecesToEnts(pieces, true);
  assert.equal(ents.length, 2);
  const p = ents.find((e) => e.type === 'pline'); assert.equal(p.closed, false);
  ptsNear(p.pts, [P(10, 10), P(0, 10), P(0, 0), P(10, 0)]);
});
test('bo\'sh / null → bo\'sh massiv; offsetChain noto\'g\'ri D → null', () => {
  assert.deepEqual(piecesToEnts([], true), []);
  assert.deepEqual(piecesToEnts(null, false), []);
  assert.equal(offsetChain(buildChains(SQ4)[0], 0), null);
  assert.equal(offsetChain(buildChains(SQ4)[0], NaN), null);
  assert.equal(offsetChain(null, 5), null);
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
