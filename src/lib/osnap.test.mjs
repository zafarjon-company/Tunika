// ============================================================
//  OSNAP — TESTLAR
//  Ishga tushirish:  node src/lib/osnap.test.mjs
//  DOM kerak emas — sof geometriya sinaladi.
//
//  Konvensiya: world mm, x o'ngga, y PASTGA. Burchak AutoCAD'dek:
//  0° = o'ng, 90° = TEPA (dy manfiy), soat miliga qarshi musbat.
//  Har testda kutilgan qiymat geometriya bo'yicha MUSTAQIL hisoblanadi.
// ============================================================
import assert from 'node:assert/strict';
import {
  SNAP_KEY, SNAP_MODES, POLAR_INCS, GRID_STEPS, DEFAULT_SNAP, modeName,
  loadSnap, saveSnap,
  norm360, dirVec, vecAng, fmtAng,
  segClosest, lineLineInt, segSegInt, segCircleInts, circleCircleInts, tangentPoints,
  buildGeom, endpointDirs,
  osnapCandidates, osnapBest,
  polarSnap, trackAngles, trackSnap, resolveSnap, updateAcquire,
  autoGridStep, gridStepFor, snapMarkerShapes,
} from './osnap.js';

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

const D2R = Math.PI / 180;
const R2 = Math.SQRT1_2;   // √½
// Sonlarni tolerans bilan solishtirish (-0 / 0 muammosiz)
const near = (olingan, kutilgan, eps = 1e-9, nom = '') => {
  assert.ok(typeof olingan === 'number' && Number.isFinite(olingan), `${nom} son emas: ${olingan}`);
  assert.ok(Math.abs(olingan - kutilgan) <= eps, `${nom} kutilgan ${kutilgan}, olingan ${olingan} (farq ${Math.abs(olingan - kutilgan)})`);
};
const nearPt = (p, x, y, eps = 1e-9, nom = '') => {
  assert.ok(p && typeof p === 'object', `${nom} nuqta emas: ${JSON.stringify(p)}`);
  near(p.x, x, eps, `${nom} x:`);
  near(p.y, y, eps, `${nom} y:`);
};
const nearVec = (v, dx, dy, eps = 1e-9, nom = '') => {
  assert.ok(v && typeof v === 'object', `${nom} vektor emas: ${JSON.stringify(v)}`);
  near(v.dx, dx, eps, `${nom} dx:`);
  near(v.dy, dy, eps, `${nom} dy:`);
};
const klon = (o) => JSON.parse(JSON.stringify(o));
const hammaModes = (v) => Object.fromEntries(SNAP_MODES.map((m) => [m.key, v]));
const faqat = (...keys) => { const m = hammaModes(false); for (const k of keys) m[k] = true; return m; };
const line = (id, x1, y1, x2, y2) => ({ id, type: 'line', x1, y1, x2, y2 });
const circle = (id, cx, cy, r) => ({ id, type: 'circle', cx, cy, r });
const P = (x, y) => ({ x, y });

/* ============================================================ */
console.log('\n=== 1) BURCHAK / VEKTOR ===\n');

test('norm360: 0, 360, -90, 450, -360, 180, 720', () => {
  assert.equal(norm360(0), 0);
  assert.equal(norm360(360), 0);
  assert.equal(norm360(-90), 270);
  assert.equal(norm360(450), 90);
  assert.equal(norm360(-360), 0);
  assert.equal(norm360(180), 180);
  assert.equal(norm360(720), 0);
  assert.equal(norm360(22.5), 22.5);
});
test("norm360: juda kichik manfiy va 360 ga juda yaqin → 0", () => {
  assert.equal(norm360(-1e-12), 0);
  assert.equal(norm360(359.99999999999), 0);
  assert.equal(norm360(-0), 0);
});
test('dirVec: 0° → (1,0); 90° → (0,-1) TEPA; 180° → (-1,0); 270° → (0,1) PAST', () => {
  nearVec(dirVec(0), 1, 0);
  nearVec(dirVec(90), 0, -1);
  nearVec(dirVec(180), -1, 0);
  nearVec(dirVec(270), 0, 1);
});
test('dirVec: 45° → (√½,-√½); 30° → (cos30,-½); birlik uzunlik', () => {
  nearVec(dirVec(45), R2, -R2);
  nearVec(dirVec(30), Math.cos(30 * D2R), -0.5);
  for (const a of [0, 17, 123.4, 250, 359]) { const v = dirVec(a); near(Math.hypot(v.dx, v.dy), 1, 1e-12, `|dirVec(${a})|`); }
});
test('vecAng: 8 asosiy yo\'nalish', () => {
  near(vecAng(1, 0), 0);
  near(vecAng(0, -1), 90);
  near(vecAng(-1, 0), 180);
  near(vecAng(0, 1), 270);
  near(vecAng(1, -1), 45);
  near(vecAng(-1, -1), 135);
  near(vecAng(-1, 1), 225);
  near(vecAng(1, 1), 315);
});
test('vecAng: nol vektor → 0; masshtabga bog\'liq emas', () => {
  assert.equal(vecAng(0, 0), 0);
  near(vecAng(200, -200), 45);
  near(vecAng(3, -4), Math.atan2(4, 3) / D2R);
});
test('vecAng ∘ dirVec = identity', () => {
  for (const a of [0, 37.5, 90, 123, 180, 270, 300.25, 359]) { const v = dirVec(a); near(vecAng(v.dx, v.dy), a, 1e-9, `deg ${a}`); }
});
test("fmtAng: butun → '90°', kasr → '22.5°', 0.1 gacha yaxlitlanadi", () => {
  assert.equal(fmtAng(90), '90°');
  assert.equal(fmtAng(22.5), '22.5°');
  assert.equal(fmtAng(0), '0°');
  assert.equal(fmtAng(180), '180°');
  assert.equal(fmtAng(45.04), '45°');
  assert.equal(fmtAng(45.06), '45.1°');
  assert.equal(fmtAng(33.333), '33.3°');
  assert.equal(fmtAng(-0), '0°');
});

/* ============================================================ */
console.log('\n=== 2) segClosest ===\n');

test('segClosest: o\'rtaga proyeksiya — t=0.5, d=10', () => {
  const r = segClosest(P(5, 10), P(0, 0), P(10, 0));
  nearPt(r, 5, 0); near(r.t, 0.5); near(r.d, 10);
});
test('segClosest: A uchidan tashqarida → t=0 (qisqartirilgan), d=√34', () => {
  const r = segClosest(P(-5, 3), P(0, 0), P(10, 0));
  nearPt(r, 0, 0); near(r.t, 0); near(r.d, Math.sqrt(34));
});
test('segClosest: B uchidan tashqarida → t=1', () => {
  const r = segClosest(P(20, 0), P(0, 0), P(10, 0));
  nearPt(r, 10, 0); near(r.t, 1); near(r.d, 10);
});
test('segClosest: diagonal segment — (10,0) → (5,5), d=5√2', () => {
  const r = segClosest(P(10, 0), P(0, 0), P(10, 10));
  nearPt(r, 5, 5); near(r.t, 0.5); near(r.d, 5 * Math.SQRT2);
});
test('segClosest: nol uzunlikdagi segment → a nuqtasi, t=0', () => {
  const r = segClosest(P(0, 0), P(3, 4), P(3, 4));
  nearPt(r, 3, 4); assert.equal(r.t, 0); near(r.d, 5);
});
test('segClosest: nuqta segment ustida → d=0', () => {
  const r = segClosest(P(2.5, 2.5), P(0, 0), P(10, 10));
  near(r.d, 0); near(r.t, 0.25);
});

/* ============================================================ */
console.log('\n=== 3) lineLineInt ===\n');

test('lineLineInt: perpendikulyar chiziqlar → (5,0), t=0.5, u=0.5', () => {
  const r = lineLineInt(P(0, 0), P(10, 0), P(5, -5), P(5, 5));
  nearPt(r, 5, 0); near(r.t, 0.5); near(r.u, 0.5);
});
test('lineLineInt: parallel → null', () => {
  assert.equal(lineLineInt(P(0, 0), P(10, 0), P(0, 5), P(10, 5)), null);
  assert.equal(lineLineInt(P(0, 0), P(10, 10), P(1, 0), P(11, 10)), null);
});
test('lineLineInt: kollinear (bir chiziq ustida) → null', () => {
  assert.equal(lineLineInt(P(0, 0), P(10, 0), P(20, 0), P(30, 0)), null);
});
test('lineLineInt: cheksiz chiziqlar — segmentdan tashqarida ham topadi (t=5)', () => {
  const r = lineLineInt(P(0, 0), P(1, 0), P(5, -1), P(5, 1));
  nearPt(r, 5, 0); near(r.t, 5); near(r.u, 0.5);
});
test('lineLineInt: diagonallar — (0,0)-(10,10) × (0,10)-(10,0) → (5,5)', () => {
  const r = lineLineInt(P(0, 0), P(10, 10), P(0, 10), P(10, 0));
  nearPt(r, 5, 5);
});
test('lineLineInt: nol uzunlikdagi chiziq → null (den=0)', () => {
  assert.equal(lineLineInt(P(1, 1), P(1, 1), P(0, 0), P(5, 5)), null);
});

/* ============================================================ */
console.log('\n=== 4) segSegInt ===\n');

test('segSegInt: kesishadi → (5,5)', () => {
  nearPt(segSegInt(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), 5, 5);
});
test('segSegInt: chiziqlar kesishadi, segmentlar emas → null', () => {
  assert.equal(segSegInt(P(0, 0), P(10, 0), P(20, -5), P(20, 5)), null);
  assert.equal(segSegInt(P(0, 0), P(10, 0), P(5, 1), P(5, 10)), null);
});
test('segSegInt: uchlari tegadi → uch nuqta', () => {
  nearPt(segSegInt(P(0, 0), P(10, 0), P(10, 0), P(10, 10)), 10, 0);
});
test('segSegInt: T-ulanish (uch segment o\'rtasiga tegadi) → (5,0)', () => {
  nearPt(segSegInt(P(0, 0), P(10, 0), P(5, 0), P(5, 10)), 5, 0);
});
test('segSegInt: parallel → null', () => {
  assert.equal(segSegInt(P(0, 0), P(10, 0), P(0, 1), P(10, 1)), null);
});

/* ============================================================ */
console.log('\n=== 5) segCircleInts ===\n');

test('segCircleInts: diametr bo\'ylab → 2 nuqta, tartib segment yo\'nalishida (-5,0),(5,0)', () => {
  const r = segCircleInts(P(-10, 0), P(10, 0), P(0, 0), 5);
  assert.equal(r.length, 2);
  nearPt(r[0], -5, 0); nearPt(r[1], 5, 0);
});
test('segCircleInts: tangens → 1 nuqta (0,5)', () => {
  const r = segCircleInts(P(-10, 5), P(10, 5), P(0, 0), 5);
  assert.equal(r.length, 1);
  nearPt(r[0], 0, 5);
});
test('segCircleInts: tegmaydi → []', () => {
  assert.deepEqual(segCircleInts(P(-10, 10), P(10, 10), P(0, 0), 5), []);
});
test('segCircleInts: bir uchi ichkarida → 1 nuqta (5,0)', () => {
  const r = segCircleInts(P(0, 0), P(10, 0), P(0, 0), 5);
  assert.equal(r.length, 1);
  nearPt(r[0], 5, 0);
});
test('segCircleInts: segment butunlay ichkarida → []', () => {
  assert.deepEqual(segCircleInts(P(-1, 0), P(1, 0), P(0, 0), 5), []);
});
test('segCircleInts: nol uzunlikdagi segment → []', () => {
  assert.deepEqual(segCircleInts(P(5, 0), P(5, 0), P(0, 0), 5), []);
});
test('segCircleInts: og\'ma segment — x=y chizig\'i, r=5 → (±5/√2, ±5/√2)', () => {
  const r = segCircleInts(P(-10, -10), P(10, 10), P(0, 0), 5);
  assert.equal(r.length, 2);
  const k = 5 * R2;
  nearPt(r[0], -k, -k); nearPt(r[1], k, k);
});

/* ============================================================ */
console.log('\n=== 6) circleCircleInts ===\n');

test('circleCircleInts: 2 nuqta — (0,0)r5 × (8,0)r5 → (4,-3),(4,3)', () => {
  const r = circleCircleInts(P(0, 0), 5, P(8, 0), 5);
  assert.equal(r.length, 2);
  nearPt(r[0], 4, -3); nearPt(r[1], 4, 3);
});
test('circleCircleInts: tashqi tangens → 1 nuqta (3,0)', () => {
  const r = circleCircleInts(P(0, 0), 3, P(5, 0), 2);
  assert.equal(r.length, 1);
  nearPt(r[0], 3, 0);
});
test('circleCircleInts: ichki tangens → 1 nuqta (5,0)', () => {
  const r = circleCircleInts(P(0, 0), 5, P(3, 0), 2);
  assert.equal(r.length, 1);
  nearPt(r[0], 5, 0);
});
test('circleCircleInts: uzoq → []', () => {
  assert.deepEqual(circleCircleInts(P(0, 0), 1, P(10, 0), 1), []);
});
test('circleCircleInts: biri ikkinchisining ichida (tegmaydi) → []', () => {
  assert.deepEqual(circleCircleInts(P(0, 0), 5, P(1, 0), 1), []);
});
test('circleCircleInts: konsentrik → []', () => {
  assert.deepEqual(circleCircleInts(P(0, 0), 5, P(0, 0), 3), []);
  assert.deepEqual(circleCircleInts(P(2, 2), 5, P(2, 2), 5), []);
});
test('circleCircleInts: vertikal joylashuv — (0,0)r5 × (0,6)r5 → x=±4, y=3', () => {
  const r = circleCircleInts(P(0, 0), 5, P(0, 6), 5);
  assert.equal(r.length, 2);
  // a = 18/12 = 3, h = 4; (mx + h·dy/d, my − h·dx/d) = (4, 3), keyin (−4, 3)
  nearPt(r[0], 4, 3); nearPt(r[1], -4, 3);
});

/* ============================================================ */
console.log('\n=== 7) tangentPoints ===\n');

test('tangentPoints: (10,0) → (0,0)r5 → (2.5, ±5√3/2), avval +', () => {
  const r = tangentPoints(P(10, 0), P(0, 0), 5);
  assert.equal(r.length, 2);
  const h = 5 * Math.sqrt(3) / 2;
  nearPt(r[0], 2.5, h); nearPt(r[1], 2.5, -h);
});
test('tangentPoints: tangens xususiyati — (p−t)·(t−c) = 0, |t−c| = r', () => {
  const p = P(7, -13), c = P(2, 3), r = 4;
  const ts = tangentPoints(p, c, r);
  assert.equal(ts.length, 2);
  for (const t of ts) {
    near((p.x - t.x) * (t.x - c.x) + (p.y - t.y) * (t.y - c.y), 0, 1e-9, 'skalyar');
    near(Math.hypot(t.x - c.x, t.y - c.y), r, 1e-9, 'radius');
  }
});
test('tangentPoints: nuqta ichkarida → []', () => {
  assert.deepEqual(tangentPoints(P(1, 0), P(0, 0), 5), []);
});
test('tangentPoints: nuqta aylana ustida → []', () => {
  assert.deepEqual(tangentPoints(P(5, 0), P(0, 0), 5), []);
});
test('tangentPoints: tepadan (0,-10) → (±5√3/2, -2.5)', () => {
  const r = tangentPoints(P(0, -10), P(0, 0), 5);
  const h = 5 * Math.sqrt(3) / 2;
  // base = -90°, a = 60°: -30° → (h, -2.5); -150° → (-h, -2.5)
  nearPt(r[0], h, -2.5); nearPt(r[1], -h, -2.5);
});

/* ============================================================ */
console.log('\n=== 8) buildGeom ===\n');

test('buildGeom: line → 1 seg, eid saqlanadi', () => {
  const g = buildGeom([line('l1', 0, 0, 10, 0)]);
  assert.deepEqual(g, { segs: [{ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, eid: 'l1' }], circles: [], nodes: [] });
});
test('buildGeom: polyline yopiq 3 nuqta → 3 seg (oxirgi p[2]→p[0])', () => {
  const pts = [P(0, 0), P(10, 0), P(0, 10)];
  const g = buildGeom([{ id: 'p', type: 'polyline', pts, closed: true }]);
  assert.equal(g.segs.length, 3);
  assert.deepEqual(g.segs[2], { a: pts[2], b: pts[0], eid: 'p' });
  assert.equal(g.nodes.length, 0);
});
test('buildGeom: polyline ochiq 3 nuqta → 2 seg', () => {
  const g = buildGeom([{ id: 'p', type: 'polyline', pts: [P(0, 0), P(10, 0), P(0, 10)], closed: false }]);
  assert.equal(g.segs.length, 2);
  assert.deepEqual(g.segs.map((s) => s.eid), ['p', 'p']);
});
test('buildGeom: yopiq 2 nuqtali polyline → faqat 1 seg (yopuvchi takror qo\'shilmaydi)', () => {
  const g = buildGeom([{ id: 'p', type: 'polyline', pts: [P(0, 0), P(10, 0)], closed: true }]);
  assert.equal(g.segs.length, 1);
});
test("buildGeom: 'pline' turi ham polyline kabi", () => {
  const g = buildGeom([{ id: 'q', type: 'pline', pts: [P(0, 0), P(5, 5), P(10, 0), P(0, 0)], closed: false }]);
  assert.equal(g.segs.length, 3);
});
test('buildGeom: circle → circles[{c,r,eid}]', () => {
  const g = buildGeom([circle('c1', 3, 4, 7)]);
  assert.deepEqual(g.circles, [{ c: { x: 3, y: 4 }, r: 7, eid: 'c1' }]);
  assert.equal(g.segs.length, 0);
});
test('buildGeom: dim → 2 tugun (uchlari), seg emas', () => {
  const g = buildGeom([{ id: 'd1', type: 'dim', x1: 1, y1: 2, x2: 3, y2: 4 }]);
  assert.deepEqual(g.nodes, [{ x: 1, y: 2, eid: 'd1' }, { x: 3, y: 4, eid: 'd1' }]);
  assert.equal(g.segs.length, 0);
});
test('buildGeom: 1 nuqtali pline → tugun, seg yo\'q; 0 nuqtali → hech narsa', () => {
  const g = buildGeom([{ id: 'p1', type: 'pline', pts: [P(7, 8)] }, { id: 'p0', type: 'pline', pts: [] }, { id: 'pn', type: 'polyline' }]);
  assert.deepEqual(g.nodes, [{ x: 7, y: 8, eid: 'p1' }]);
  assert.equal(g.segs.length, 0);
});
test('buildGeom: opts.skip bilan element tashlab ketiladi', () => {
  const g = buildGeom([line('a', 0, 0, 1, 0), line('b', 0, 0, 0, 1)], { skip: (e) => e.id === 'a' });
  assert.deepEqual(g.segs.map((s) => s.eid), ['b']);
});
test('buildGeom: opts.nodes / opts.segs qo\'shiladi', () => {
  const n = { x: 0, y: 0, eid: 'origin' }, s = { a: P(1, 1), b: P(2, 2), eid: 'x' };
  const g = buildGeom([line('l', 0, 0, 10, 0)], { nodes: [n], segs: [s] });
  assert.equal(g.nodes.length, 1); assert.equal(g.nodes[0], n);
  assert.equal(g.segs.length, 2); assert.equal(g.segs[1], s);
});
test('buildGeom: null / noma\'lum tur / entities yo\'q — xato bermaydi', () => {
  assert.deepEqual(buildGeom([null, { id: 'z', type: 'text' }, undefined]), { segs: [], circles: [], nodes: [] });
  assert.deepEqual(buildGeom(undefined), { segs: [], circles: [], nodes: [] });
  assert.deepEqual(buildGeom(), { segs: [], circles: [], nodes: [] });
});

/* ============================================================ */
console.log('\n=== 9) endpointDirs ===\n');

test('endpointDirs: (0,0) da 2 segment — tashqariga 180° va 270°', () => {
  const g = buildGeom([line('h', 0, 0, 10, 0), line('v', 0, 0, 0, -10)]);
  const d = endpointDirs(g, P(0, 0));
  // a uchi: b→a yo'nalishi. h: (0,0)-(10,0) → (-10,0) → 180. v: (0,0)-(0,-10) → (0,10) → 270 (past)
  assert.deepEqual(d.map((x) => Math.round(x * 1e6) / 1e6), [180, 270]);
});
test('endpointDirs: b uchida → a→b yo\'nalishi (0°)', () => {
  const g = buildGeom([line('h', 0, 0, 10, 0)]);
  near(endpointDirs(g, P(10, 0))[0], 0);
  assert.equal(endpointDirs(g, P(10, 0)).length, 1);
});
test('endpointDirs: uch bo\'lmagan nuqta → []', () => {
  const g = buildGeom([line('h', 0, 0, 10, 0)]);
  assert.deepEqual(endpointDirs(g, P(5, 0)), []);
  assert.deepEqual(endpointDirs(g, P(5, 5)), []);
});
test('endpointDirs: eps — 0.0005 farq standart eps bilan topilmaydi, 1e-3 bilan topiladi', () => {
  const g = buildGeom([line('h', 0, 0, 10, 0)]);
  assert.equal(endpointDirs(g, P(10, 0.0005)).length, 0);
  assert.equal(endpointDirs(g, P(10, 0.0005), 1e-3).length, 1);
});
test('endpointDirs: og\'ma segment (0,0)-(10,-10): (10,-10) uchida 45°, (0,0) uchida 225°', () => {
  const g = buildGeom([line('d', 0, 0, 10, -10)]);
  near(endpointDirs(g, P(10, -10))[0], 45);
  near(endpointDirs(g, P(0, 0))[0], 225);
});

/* ============================================================ */
console.log('\n=== 10) osnapCandidates / osnapBest ===\n');

const OPT = (extra = {}) => ({ scale: 1, aperture: 12, modes: klon(DEFAULT_SNAP.modes), ...extra });

test('END vs MID: kursor o\'rtada → MID (d=0, score 0.12×apertura = 1.44)', () => {
  const g = buildGeom([line('l1', 0, 0, 10, 0)]);
  const b = osnapBest(g, P(5, 0), OPT());
  assert.equal(b.kind, 'MID'); nearPt(b, 5, 0); near(b.dPx, 0); near(b.score, 1.44); assert.equal(b.eid, 'l1');
});
test('END vs MID: teng masofada (2.5) → END ustun (jarima 0 vs 1.44); ro\'yxat tartibi END, MID, END', () => {
  const g = buildGeom([line('l1', 0, 0, 10, 0)]);
  const c = osnapCandidates(g, P(2.5, 0), OPT());
  assert.deepEqual(c.map((x) => x.kind), ['END', 'MID', 'END']);
  nearPt(c[0], 0, 0); near(c[0].score, 2.5);
  nearPt(c[1], 5, 0); near(c[1].score, 2.5 + 1.44);
  nearPt(c[2], 10, 0); near(c[2].score, 7.5);
});
test('END vs MID: (3.5,0) → MID (1.5+1.5=3 < 3.5); (3.2,0) → END (3.2 < 1.8+1.5)', () => {
  const g = buildGeom([line('l1', 0, 0, 10, 0)]);
  assert.equal(osnapBest(g, P(3.5, 0), OPT()).kind, 'MID');
  assert.equal(osnapBest(g, P(3.2, 0), OPT()).kind, 'END');
});
test('Apertura px va scale: 10 mm masofa — scale 1 → topiladi (dPx 10), scale 2 → null (20 px), scale 0.5 → dPx 5', () => {
  const g = buildGeom([line('l1', 0, 0, 100, 0)]);
  const b1 = osnapBest(g, P(0, 10), OPT({ scale: 1 }));
  assert.equal(b1.kind, 'END'); near(b1.dPx, 10);
  assert.equal(osnapBest(g, P(0, 10), OPT({ scale: 2 })), null);
  near(osnapBest(g, P(0, 10), OPT({ scale: 0.5 })).dPx, 5);
});
test('Apertura: 8 px bilan 10 px masofa → null; aniq chegarada (12) → topiladi', () => {
  const g = buildGeom([line('l1', 0, 0, 100, 0)]);
  assert.equal(osnapBest(g, P(0, 10), OPT({ aperture: 8 })), null);
  assert.equal(osnapBest(g, P(0, 12), OPT({ aperture: 12 })).kind, 'END');
  assert.equal(osnapBest(g, P(0, 12.01), OPT({ aperture: 12 })), null);
});
test('Standart opts: aperture / scale / modes berilmasa 12 px, 1, DEFAULT_SNAP.modes', () => {
  const g = buildGeom([line('l1', 0, 0, 100, 0)]);
  assert.equal(osnapBest(g, P(0, 11), {}).kind, 'END');
  assert.equal(osnapBest(g, P(0, 13), {}), null);
});
test('dPx = mm × scale: (1,1) dan (0,0) gacha scale 2 → 2√2', () => {
  const g = buildGeom([line('l1', 0, 0, 100, 0)]);
  near(osnapBest(g, P(1, 1), OPT({ scale: 2 })).dPx, 2 * Math.SQRT2);
});
test('INT: ikki segment kesishmasi (6,0) — kursor (6.3,0.2) → INT, takrorsiz', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0), line('l2', 6, -10, 6, 4)]);
  const c = osnapCandidates(g, P(6.3, 0.2), OPT());
  assert.equal(c[0].kind, 'INT'); nearPt(c[0], 6, 0); near(c[0].dPx, Math.hypot(0.3, 0.2));
  assert.ok(['l1', 'l2'].includes(c[0].eid));
  assert.equal(c.filter((x) => Math.abs(x.x - 6) < 1e-9 && Math.abs(x.y) < 1e-9).length, 1, 'kesishma bitta');
  // Keyingisi — END (6,4): d = hypot(0.3, 3.8)
  assert.equal(c[1].kind, 'END'); nearPt(c[1], 6, 4);
});
test('INT o\'chiq → kesishma yo\'q, END (6,4) yutadi', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0), line('l2', 6, -10, 6, 4)]);
  const c = osnapCandidates(g, P(6.3, 0.2), OPT({ modes: { ...klon(DEFAULT_SNAP.modes), INT: false } }));
  assert.ok(!c.some((x) => x.kind === 'INT'));
  assert.equal(c[0].kind, 'END'); nearPt(c[0], 6, 4);
});
test('INT: segment × aylana (14,0) — INT kvadrant (QUA) bilan bir nuqtada, INT yutadi', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0), circle('c1', 10, 0, 4)]);
  const c = osnapCandidates(g, P(14.2, 0.3), OPT());
  assert.equal(c[0].kind, 'INT'); nearPt(c[0], 14, 0);
  assert.equal(c.filter((x) => Math.abs(x.x - 14) < 1e-9 && Math.abs(x.y) < 1e-9).length, 1);
  assert.ok(!c.some((x) => x.kind === 'QUA' && Math.abs(x.x - 14) < 1e-9 && Math.abs(x.y) < 1e-9));
});
test('INT: aylana × aylana (4,3) — kursor (4.2,3.1)', () => {
  const g = buildGeom([circle('c1', 0, 0, 5), circle('c2', 8, 0, 5)]);
  const b = osnapBest(g, P(4.2, 3.1), OPT());
  assert.equal(b.kind, 'INT'); nearPt(b, 4, 3); near(b.dPx, Math.hypot(0.2, 0.1));
});
test('INT: kursor obyekt ustida emas → kesishma taklif qilinmaydi', () => {
  // Kesishma (50,0); kursor (50,0) dan 13 px yuqorida — hech qaysi segmentga yaqin emas
  const g = buildGeom([line('l1', 0, 0, 100, 0), line('l2', 50, -100, 50, 100)]);
  const c = osnapCandidates(g, P(30, -13), OPT());
  assert.ok(!c.some((x) => x.kind === 'INT'));
});
test('PER: nomzod bor (5,0), lekin apertura ichidagi END (20,0) undan USTUN (AutoCAD)', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  const c = osnapCandidates(g, P(15, 0.5), OPT({ from: P(5, -10) }));
  const per = c.find((x) => x.kind === 'PER');
  assert.ok(per, 'PER nomzod bor'); nearPt(per, 5, 0);
  near(per.dPx, 0.5); near(per.score, 0.5 + 1.05 * 12); assert.equal(per.eid, 'l1');
  assert.equal(c[0].kind, 'END'); nearPt(c[0], 20, 0);   // 5.02 px < PER score 13.1
});
test('PER yolg\'iz qolganda yutadi: uzun chiziq, END/MID apertura tashqarisida', () => {
  const g = buildGeom([line('l1', 0, 0, 200, 0)]);
  const c = osnapCandidates(g, P(50, 0.5), OPT({ from: P(50, -10) }));
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'PER'); nearPt(c[0], 50, 0);
});
test('PER: oyoq segment DAVOMIGA tushsa ham nomzod beriladi (AutoCAD); END yutadi', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  const c = osnapCandidates(g, P(15, 0.5), OPT({ from: P(-5, -10) }));
  const per = c.find((x) => x.kind === 'PER');
  assert.ok(per, 'davomdagi PER bor'); nearPt(per, -5, 0);
  assert.equal(c[0].kind, 'END'); nearPt(c[0], 20, 0);
});
test('PER: oyoq uch nuqtada (t=1) yoki davomida (t>1) — nomzod bor, joyi to\'g\'ri', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  // t=1 da oyoq END bilan ustma-ust — takror tozalanib END bo'lib qoladi (kuchliroq tur)
  const both = osnapCandidates(g, P(15, 0.5), OPT({ from: P(20, -10) }));
  assert.equal(both[0].kind, 'END'); nearPt(both[0], 20, 0);
  assert.ok(!both.some((x) => x.kind === 'PER' && Math.abs(x.x - 20) < 1e-6));
  const p1 = osnapCandidates(g, P(15, 0.5), OPT({ from: P(20, -10), modes: faqat('PER') }))[0];
  assert.ok(p1); assert.equal(p1.kind, 'PER'); nearPt(p1, 20, 0);
  const p2 = osnapCandidates(g, P(15, 0.5), OPT({ from: P(25, -10) })).find((x) => x.kind === 'PER');
  assert.ok(p2); nearPt(p2, 25, 0);
});
test('PER: oyoq tayanchning O\'ZIGA tushsa (from chiziq ustida) → nomzod yo\'q (nol uzunlik)', () => {
  const g = buildGeom([line('l1', 0, 0, 1000, 0)]);
  assert.ok(!osnapCandidates(g, P(300, 2), OPT({ from: P(500, 0) })).some((x) => x.kind === 'PER'));
});
test('PER: kursor obyektdan uzoq (13 px) → PER yo\'q, umuman nomzod yo\'q', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  assert.equal(osnapBest(g, P(15, 13), OPT({ from: P(5, -10) })), null);
});
test('PER: rejim o\'chiq yoki from yo\'q → PER yo\'q', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  assert.ok(!osnapCandidates(g, P(15, 0.5), OPT({ from: P(5, -10), modes: { ...klon(DEFAULT_SNAP.modes), PER: false } })).some((x) => x.kind === 'PER'));
  assert.ok(!osnapCandidates(g, P(15, 0.5), OPT()).some((x) => x.kind === 'PER'));
});
test('PER: aylanada — ikki oyoqdan KURSORGA YAQINI (bitta nomzod); kursor (5.3,0) → QUA yutadi', () => {
  const g = buildGeom([circle('c1', 0, 0, 5)]);
  const c = osnapCandidates(g, P(5.3, 0), OPT({ from: P(3, -20) }));
  const L = Math.sqrt(9 + 400);
  const per = c.filter((x) => x.kind === 'PER');
  assert.equal(per.length, 1);
  nearPt(per[0], 3 / L * 5, -20 / L * 5);          // (5.3,0) ga yaqini
  near(per[0].score, 0.3 + 1.05 * 12);
  assert.equal(c[0].kind, 'QUA'); nearPt(c[0], 5, 0); near(c[0].score, 0.3 + 1.44);
});
test('PER: aylanada kursor QARAMA-QARSHI oyoqda → o\'sha oyoq tanlanadi (sakramaydi)', () => {
  const g = buildGeom([circle('c1', 0, 0, 100)]);
  const c = osnapCandidates(g, P(-60, 80), OPT({ from: P(300, -400), modes: faqat('PER') }));
  assert.equal(c.length, 1); nearPt(c[0], -60, 80);
});
test('TAN: ikki tangensdan KURSORGA YAQINI (bitta nomzod); QUA (0,5) undan ustun', () => {
  const g = buildGeom([circle('c1', 0, 0, 5)]);
  const c = osnapCandidates(g, P(2.6, 4.5), OPT({ from: P(10, 0), modes: faqat('TAN', 'CEN', 'QUA') }));
  const h = 5 * Math.sqrt(3) / 2;
  const tan = c.filter((x) => x.kind === 'TAN');
  assert.equal(tan.length, 1);
  nearPt(tan[0], 2.5, h);
  const dc = Math.abs(Math.hypot(2.6, 4.5) - 5);
  near(tan[0].dPx, dc); near(tan[0].score, dc + 1.05 * 12);
  near((10 - tan[0].x) * tan[0].x + (0 - tan[0].y) * tan[0].y, 0, 1e-9, 'skalyar');
  assert.equal(c[0].kind, 'QUA'); nearPt(c[0], 0, 5);    // apertura ichidagi nuqta magniti ustun
});
test('TAN: kursor ikkinchi tangens nuqtasida → o\'sha nuqta (sakramaydi)', () => {
  const g = buildGeom([circle('c1', 0, 0, 5)]);
  const h = 5 * Math.sqrt(3) / 2;
  const c = osnapCandidates(g, P(2.5, -h), OPT({ from: P(10, 0), modes: faqat('TAN') }));
  assert.equal(c.length, 1); nearPt(c[0], 2.5, -h);
});
test('TAN: rejim o\'chiq / from yo\'q / from aylana ichida → TAN yo\'q', () => {
  const g = buildGeom([circle('c1', 0, 0, 5)]);
  assert.ok(!osnapCandidates(g, P(2.6, 4.5), OPT({ from: P(10, 0) })).some((x) => x.kind === 'TAN'));           // DEFAULT: TAN false
  assert.ok(!osnapCandidates(g, P(2.6, 4.5), OPT({ modes: faqat('TAN') })).some((x) => x.kind === 'TAN'));
  assert.ok(!osnapCandidates(g, P(2.6, 4.5), OPT({ from: P(1, 1), modes: faqat('TAN') })).some((x) => x.kind === 'TAN'));
});
test('NEA: eng past ustunlik — (9,0.5) da MID (10,0) yutadi, NEA (9,0) score 0.5+1.6×apertura', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  const c = osnapCandidates(g, P(9, 0.5), OPT({ modes: hammaModes(true) }));
  assert.equal(c[0].kind, 'MID'); nearPt(c[0], 10, 0);
  const nea = c.find((x) => x.kind === 'NEA');
  assert.ok(nea, 'NEA nomzod bor');
  nearPt(nea, 9, 0); near(nea.dPx, 0.5); near(nea.score, 0.5 + 1.6 * 12);
  assert.ok(c.indexOf(nea) > c.findIndex((x) => x.kind === 'END'), 'NEA END dan keyin');
});
test('NEA: yolg\'iz rejim — segmentda (9,0), aylanada (0,5)', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0)]);
  const b = osnapBest(g, P(9, 0.5), OPT({ modes: faqat('NEA') }));
  assert.equal(b.kind, 'NEA'); nearPt(b, 9, 0);
  const gc = buildGeom([circle('c1', 0, 0, 5)]);
  const bc = osnapBest(gc, P(0, 5.4), OPT({ modes: faqat('NEA') }));
  assert.equal(bc.kind, 'NEA'); nearPt(bc, 0, 5); near(bc.dPx, 0.4);
});
test('NEA: standart rejimlarda o\'chiq — kursor segment ustida bo\'lsa ham NEA chiqmaydi', () => {
  const g = buildGeom([line('l1', 0, 0, 100, 0)]);
  const c = osnapCandidates(g, P(30, 0.5), OPT());
  assert.ok(!c.some((x) => x.kind === 'NEA'));
  assert.equal(c.length, 0);   // END/MID 12 px dan uzoq
});
test('skipEid: o\'z elementi tashlab ketiladi → END (0,5) ikkinchi chiziqdan', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0), line('l2', 0, 5, 20, 5)]);
  nearPt(osnapBest(g, P(0.5, 0.3), OPT()), 0, 0);
  const b = osnapBest(g, P(0.5, 0.3), OPT({ skipEid: 'l1' }));
  assert.equal(b.kind, 'END'); nearPt(b, 0, 5); assert.equal(b.eid, 'l2');
  nearPt(osnapBest(g, P(0.5, 0.3), OPT({ skipEid: 'yoq' })), 0, 0);
});
test('skipEid: kesishma ham hisobga olinmaydi', () => {
  const g = buildGeom([line('l1', 0, 0, 20, 0), line('l3', 6, -10, 6, 4)]);
  const c = osnapCandidates(g, P(6.3, 0.2), OPT({ skipEid: 'l3' }));
  assert.ok(!c.some((x) => x.kind === 'INT'));
  assert.ok(c.every((x) => x.eid === 'l1'));
  assert.equal(c[0].kind, 'MID'); nearPt(c[0], 10, 0);
});
test('skipEid: tugun (NOD) va aylana ham tashlab ketiladi', () => {
  const g = buildGeom([circle('c1', 0, 0, 5)], { nodes: [{ x: 0, y: 0, eid: 'n1' }] });
  assert.equal(osnapBest(g, P(0.2, 0.1), OPT()).kind, 'NOD');
  assert.equal(osnapBest(g, P(0.2, 0.1), OPT({ skipEid: 'n1' })).kind, 'CEN');
  // Aylana tashlab ketilsa QUA (5,0) yo'q — 5.2 px uzoqdagi tugun (0,0) qoladi
  const c = osnapCandidates(g, P(5.2, 0.1), OPT({ skipEid: 'c1' }));
  assert.ok(c.every((x) => x.eid !== 'c1'));
  assert.equal(c.length, 1); assert.equal(c[0].kind, 'NOD'); nearPt(c[0], 0, 0);
  assert.equal(osnapBest(g, P(5.2, 0.1), OPT({ skipEid: 'c1', modes: faqat('QUA', 'CEN') })), null);
});
test('Rejimlar o\'chiq: hammasi false → [] va null; END o\'chiq → END nomzod yo\'q', () => {
  const g = buildGeom([line('l1', 0, 0, 10, 0), circle('c1', 20, 0, 3)]);
  assert.deepEqual(osnapCandidates(g, P(0, 0), OPT({ modes: hammaModes(false) })), []);
  assert.equal(osnapBest(g, P(0, 0), OPT({ modes: hammaModes(false) })), null);
  const c = osnapCandidates(g, P(0.5, 0.3), OPT({ modes: { ...klon(DEFAULT_SNAP.modes), END: false } }));
  assert.ok(!c.some((x) => x.kind === 'END'));
  assert.equal(c[0].kind, 'MID');
});
test('NOD vs END: bir nuqtada tugun va uch → score teng, tugun (avval qo\'shilgan) qoladi, takror yo\'q', () => {
  const g = buildGeom([line('l1', 0, 0, 10, 0)], { nodes: [{ x: 0, y: 0, eid: 'n' }] });
  const c = osnapCandidates(g, P(0.3, 0.4), OPT());
  assert.equal(c.filter((x) => Math.abs(x.x) < 1e-9 && Math.abs(x.y) < 1e-9).length, 1);
  assert.equal(c[0].kind, 'NOD'); near(c[0].dPx, 0.5);
});
test('CEN va QUA: aylana (10,0)r4 — kursor markazda → CEN; (14.1,0) → QUA (14,0)', () => {
  const g = buildGeom([circle('c1', 10, 0, 4)]);
  const b = osnapBest(g, P(10.2, 0), OPT());
  assert.equal(b.kind, 'CEN'); nearPt(b, 10, 0);
  const q = osnapBest(g, P(14.1, 0), OPT());
  assert.equal(q.kind, 'QUA'); nearPt(q, 14, 0);
  const c = osnapCandidates(g, P(10, 0), OPT({ modes: faqat('QUA') }));
  assert.equal(c.length, 4);
  for (const [x, y] of [[14, 0], [6, 0], [10, 4], [10, -4]]) assert.ok(c.some((k) => Math.abs(k.x - x) < 1e-9 && Math.abs(k.y - y) < 1e-9), `QUA (${x},${y})`);
});
test('Nomzodlar takrorsiz va score bo\'yicha tartiblangan (yopiq kvadrat, kursor (1,1))', () => {
  const g = buildGeom([{ id: 'sq', type: 'polyline', closed: true, pts: [P(0, 0), P(10, 0), P(10, 10), P(0, 10)] }]);
  const c = osnapCandidates(g, P(1, 1), OPT());
  // Noyob nuqtalar: (0,0) (5,0) (0,5) (10,0) (0,10) (10,5) (5,10) — (10,10) 12.7 px uzoq
  assert.equal(c.length, 7);
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    assert.ok(Math.abs(c[i].x - c[j].x) > 1e-6 || Math.abs(c[i].y - c[j].y) > 1e-6, `takror: ${i} va ${j}`);
  }
  for (let i = 0; i + 1 < c.length; i++) assert.ok(c[i].score <= c[i + 1].score + 1e-12, `tartib buzilgan ${i}`);
  nearPt(c[0], 0, 0); near(c[0].score, Math.SQRT2);
  assert.ok(c.every((x) => x.dPx <= 12 + 1e-9));
});

/* ============================================================ */
console.log('\n=== 11) polarSnap ===\n');

const S_ORTHO = { ortho: true, polar: true, polarInc: 15, aperture: 12 };
const S_POLAR = { ortho: false, polar: true, polarInc: 15, aperture: 12 };

test('ORTHO: (10,-3) → 0° nurga proyeksiya (10,0)', () => {
  const r = polarSnap(P(0, 0), P(10, -3), S_ORTHO, 1);
  assert.equal(r.kind, 'ortho'); assert.equal(r.ang, 0); nearPt(r, 10, 0);
});
test('ORTHO: (2,-10) → 90° (tepa) → (0,-10)', () => {
  const r = polarSnap(P(0, 0), P(2, -10), S_ORTHO, 1);
  assert.equal(r.kind, 'ortho'); assert.equal(r.ang, 90); nearPt(r, 0, -10);
});
test('ORTHO: (-10,3) → 180° → (-10,0); (3,10) → 270° (past) → (0,10)', () => {
  const r1 = polarSnap(P(0, 0), P(-10, 3), S_ORTHO, 1);
  assert.equal(r1.ang, 180); nearPt(r1, -10, 0);
  const r2 = polarSnap(P(0, 0), P(3, 10), S_ORTHO, 1);
  assert.equal(r2.ang, 270); nearPt(r2, 0, 10);
});
test('ORTHO: tayanch (0,0) emas — from (5,5), cur (15,3) → (15,5)', () => {
  const r = polarSnap(P(5, 5), P(15, 3), S_ORTHO, 1);
  assert.equal(r.ang, 0); nearPt(r, 15, 5);
});
test('ORTHO: 359.4° → 0° ga o\'raladi (360 emas)', () => {
  const r = polarSnap(P(0, 0), P(10, 0.1), S_ORTHO, 1);
  assert.equal(r.ang, 0); nearPt(r, 10, 0);
});
test('ORTHO: 0 uzunlik → null; toleransga bog\'liq emas (uzoq burchak ham yopishadi)', () => {
  assert.equal(polarSnap(P(3, 3), P(3, 3), S_ORTHO, 1), null);
  const r = polarSnap(P(0, 0), P(100, -40), S_ORTHO, 10);   // 21.8°, perp 40 mm × 10 = 400 px — ortho baribir
  assert.equal(r.kind, 'ortho'); nearPt(r, 100, 0);
});
test('ORTHO va POLAR bir vaqtda → ORTHO ustun', () => {
  const r = polarSnap(P(0, 0), P(10, -2.5), S_ORTHO, 1);   // 14° — polar 15° ga tushardi
  assert.equal(r.kind, 'ortho'); assert.equal(r.ang, 0);
});
test('POLAR: (10,-2.5) 14° → 15° nur, proyeksiya (10cos15+2.5sin15)·(cos15,-sin15)', () => {
  const r = polarSnap(P(0, 0), P(10, -2.5), S_POLAR, 1);
  assert.equal(r.kind, 'polar'); assert.equal(r.ang, 15);
  const L = 10 * Math.cos(15 * D2R) + 2.5 * Math.sin(15 * D2R);
  nearPt(r, L * Math.cos(15 * D2R), -L * Math.sin(15 * D2R));
});
test('POLAR: tolerans — (100,-13): scale 1 → 13 px > 12 null; scale 0.5 → 6.5 px yopishadi (100,0); scale 2 → null', () => {
  assert.equal(polarSnap(P(0, 0), P(100, -13), S_POLAR, 1), null);
  const r = polarSnap(P(0, 0), P(100, -13), S_POLAR, 0.5);
  assert.equal(r.ang, 0); nearPt(r, 100, 0);
  assert.equal(polarSnap(P(0, 0), P(100, -13), S_POLAR, 2), null);
});
test('POLAR: aniq chegara — (100,-12) scale 1 → 12 px ≤ 12 yopishadi', () => {
  const r = polarSnap(P(0, 0), P(100, -12), S_POLAR, 1);
  assert.equal(r.ang, 0); nearPt(r, 100, 0);
});
test('POLAR: 352.6° → 0° ga o\'raladi, (10,1.3) → (10,0)', () => {
  const r = polarSnap(P(0, 0), P(10, 1.3), S_POLAR, 1);
  assert.equal(r.ang, 0); nearPt(r, 10, 0);
});
test('POLAR: 90° va 270° nurlar — (0.5,-20) → (0,-20); (-0.5,20) → (0,20)', () => {
  const r1 = polarSnap(P(0, 0), P(0.5, -20), S_POLAR, 1);
  assert.equal(r1.ang, 90); nearPt(r1, 0, -20);
  const r2 = polarSnap(P(0, 0), P(-0.5, 20), S_POLAR, 1);
  assert.equal(r2.ang, 270); nearPt(r2, 0, 20);
});
test('POLAR: qadam 45 — 40° → 45° nur; qadam berilmasa 15', () => {
  const r = polarSnap(P(0, 0), P(Math.cos(40 * D2R) * 50, -Math.sin(40 * D2R) * 50), { polar: true, polarInc: 45, aperture: 12 }, 1);
  assert.equal(r.ang, 45);
  near(r.x, 50 * Math.cos(5 * D2R) * R2); near(r.y, -50 * Math.cos(5 * D2R) * R2);
  const r2 = polarSnap(P(0, 0), P(Math.cos(31 * D2R) * 50, -Math.sin(31 * D2R) * 50), { polar: true }, 1);
  assert.equal(r2.ang, 30);
});
test('POLAR: orqaga yo\'nalish (proj<0) → null (qadam 360, 170° → 0° nur)', () => {
  const s = { polar: true, polarInc: 360, aperture: 12 };
  assert.equal(polarSnap(P(0, 0), P(10 * Math.cos(170 * D2R), -10 * Math.sin(170 * D2R)), s, 1), null);
  // to'g'ri yo'nalishda (10°) esa yopishadi
  const r = polarSnap(P(0, 0), P(10 * Math.cos(10 * D2R), -10 * Math.sin(10 * D2R)), s, 1);
  assert.equal(r.ang, 0); near(r.x, 10 * Math.cos(10 * D2R));
});
test('POLAR: 0 uzunlik → null; ortho ham polar ham o\'chiq → null', () => {
  assert.equal(polarSnap(P(1, 1), P(1, 1), S_POLAR, 1), null);
  assert.equal(polarSnap(P(0, 0), P(10, 0), { ortho: false, polar: false }, 1), null);
});

/* ============================================================ */
console.log('\n=== 12) trackAngles ===\n');

test('polar 15 → 12 ta: 0,15,…,165', () => {
  const a = trackAngles({ polar: true, ortho: false, polarInc: 15 });
  assert.deepEqual(a, [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165]);
});
test('ortho → [0,90] (polar yoqilgan bo\'lsa ham); polar o\'chiq → [0,90]', () => {
  assert.deepEqual(trackAngles({ polar: true, ortho: true, polarInc: 15 }), [0, 90]);
  assert.deepEqual(trackAngles({ polar: false, ortho: false, polarInc: 15 }), [0, 90]);
  assert.deepEqual(trackAngles({}), [0, 90]);
});
test('polar 45 → 4 ta; 22.5 → 8 ta; 90 → [0,90]; 18 → 10 ta; qadam yo\'q → 15', () => {
  assert.deepEqual(trackAngles({ polar: true, polarInc: 45 }), [0, 45, 90, 135]);
  assert.deepEqual(trackAngles({ polar: true, polarInc: 22.5 }), [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5]);
  assert.deepEqual(trackAngles({ polar: true, polarInc: 90 }), [0, 90]);
  assert.equal(trackAngles({ polar: true, polarInc: 18 }).length, 10);
  assert.equal(trackAngles({ polar: true }).length, 12);
});

/* ============================================================ */
console.log('\n=== 13) trackSnap ===\n');

const S_TR = { ortho: true, polar: false, aperture: 12, modes: { EXT: true } };   // burchaklar [0,90]

test('Bitta olingan nuqta: gorizontal chiziq proyeksiyasi (50,3) → (50,0), ang 0, d=3', () => {
  const A = P(0, 0);
  const r = trackSnap([A], P(50, 3), S_TR, 1);
  assert.equal(r.kind, 'otrack'); nearPt(r, 50, 0); near(r.d, 3);
  assert.equal(r.lines.length, 1); assert.equal(r.lines[0].A, A); assert.equal(r.lines[0].ang, 0);
});
test('Bitta olingan nuqta: vertikal (2,-40) → (0,-40), ang 90; chiziq ikki tomonga — (-50,3) → (-50,0)', () => {
  const r = trackSnap([P(0, 0)], P(2, -40), S_TR, 1);
  assert.equal(r.kind, 'otrack'); nearPt(r, 0, -40); assert.equal(r.lines[0].ang, 90);
  const r2 = trackSnap([P(0, 0)], P(-50, 3), S_TR, 1);
  nearPt(r2, -50, 0); assert.equal(r2.lines[0].ang, 0);
});
test('Tolerans px: (50,3) scale 5 → 15 px > 12 → null; scale 3 → 9 px topiladi', () => {
  assert.equal(trackSnap([P(0, 0)], P(50, 3), S_TR, 5), null);
  const r = trackSnap([P(0, 0)], P(50, 3), S_TR, 3);
  nearPt(r, 50, 0); near(r.d, 9);
});
test('Ikki olingan nuqta chiziqlari kesishmasi → otrack-int (100,0), 2 chiziq', () => {
  const A1 = P(0, 0), A2 = P(100, -60);
  const r = trackSnap([A1, A2], P(98, -2), S_TR, 1);
  assert.equal(r.kind, 'otrack-int'); nearPt(r, 100, 0); near(r.d, Math.hypot(2, 2));
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].A, A1); assert.equal(r.lines[0].ang, 0);
  assert.equal(r.lines[1].A, A2); assert.equal(r.lines[1].ang, 90);
});
test('Ikki nuqta, faqat bitta chiziq yaqin → oddiy otrack (60,0)', () => {
  const r = trackSnap([P(0, 0), P(100, -60)], P(60, -3), S_TR, 1);
  assert.equal(r.kind, 'otrack'); nearPt(r, 60, 0); assert.equal(r.lines.length, 1);
});
test('Kesishma kursordan 1.5×tolerans dan uzoq → eng yaqin chiziq (perp bo\'yicha)', () => {
  // A1 (0,0) 0° chizig'i y=0; A2 (0,100) 45° chizig'i x+y=100 → kesishma (100,0)
  const s = { ortho: false, polar: true, polarInc: 45, aperture: 12 };
  const A1 = P(0, 0), A2 = P(0, 100);
  const r = trackSnap([A1, A2], P(122, -8), s, 1);   // d1=8, d2=14/√2≈9.9, kesishmagacha hypot(22,8)=23.4 > 18
  assert.equal(r.kind, 'otrack'); nearPt(r, 122, 0); assert.equal(r.lines[0].A, A1); near(r.d, 8);
  // Yaqinroq bo'lsa kesishma
  const r2 = trackSnap([A1, A2], P(103, -3), s, 1);
  assert.equal(r2.kind, 'otrack-int'); nearPt(r2, 100, 0);
});
test('Kesishma chegarasi tol×1.5 = 18 px: (117,-5) → 17.72 ≤ 18 int; (118,-5) → 18.68 > 18 → chiziq (118,0)', () => {
  // A1 (0,0) 0° chizig'i y=0; A2 (0,100) 45° chizig'i x+y=100 → kesishma (100,0)
  const s = { ortho: false, polar: true, polarInc: 45, aperture: 12 };
  const A1 = P(0, 0), A2 = P(0, 100);
  const r = trackSnap([A1, A2], P(117, -5), s, 1);   // d1=5, d2=12/√2=8.49, kesishmagacha hypot(17,5)=17.72
  assert.equal(r.kind, 'otrack-int'); nearPt(r, 100, 0); near(r.d, Math.hypot(17, 5));
  const r2 = trackSnap([A1, A2], P(118, -5), s, 1);   // d2=13/√2=9.19, kesishmagacha hypot(18,5)=18.68
  assert.equal(r2.kind, 'otrack'); nearPt(r2, 118, 0); assert.equal(r2.lines[0].A, A1); near(r2.d, 5);
  // Tolerans px da: scale 2 bilan (117,-5) → d1 10, d2 16.97 > 12 → faqat 1 chiziq → otrack (117,0)
  const r3 = trackSnap([A1, A2], P(117, -5), s, 2);
  assert.equal(r3.kind, 'otrack'); nearPt(r3, 117, 0);
});
test('EXT: olingan nuqtaning dirs (30°) chizig\'i qo\'shiladi — (86,-50) proyeksiya', () => {
  const A = { x: 0, y: 0, dirs: [30] };
  const r = trackSnap([A], P(86, -50), S_TR, 1);
  assert.equal(r.kind, 'EXT'); assert.equal(r.lines[0].ang, 30);
  const c = Math.cos(30 * D2R), sn = 0.5;
  const proj = 86 * c + 50 * sn;
  nearPt(r, proj * c, -proj * sn);
  near(r.d, Math.abs(86 * (-sn) - (-50) * c));
});
test('EXT o\'chiq (modes.EXT false yoki modes yo\'q) → dirs e\'tiborsiz → null', () => {
  const A = { x: 0, y: 0, dirs: [30] };
  assert.equal(trackSnap([A], P(86, -50), { ...S_TR, modes: { EXT: false } }, 1), null);
  assert.equal(trackSnap([A], P(86, -50), { ortho: true, aperture: 12 }, 1), null);
});
test('EXT faqat OLDINGA (davom yo\'nalishi): dirs 210° → 30° tomonda topilmaydi, 210° tomonda topiladi', () => {
  const A = { x: 0, y: 0, dirs: [-150] };   // norm360 → 210
  assert.equal(trackSnap([A], P(86, -50), S_TR, 1), null);       // orqa tomon — kuzatilmaydi
  const r = trackSnap([A], P(-86, 50), S_TR, 1);
  assert.ok(r); assert.equal(r.kind, 'EXT'); assert.equal(r.lines[0].ang, 210);
  const c = Math.cos(30 * D2R), proj = 86 * c + 50 * 0.5;
  nearPt(r, -proj * c, proj * 0.5);
});
test('Polar nur × kuzatish chizig\'i kesishmasi → otrack-int, 2-chiziq polar', () => {
  const s = { ortho: false, polar: true, polarInc: 45, aperture: 12 };
  const from = P(0, 0), A = P(0, -60), cur = P(58, -59);
  const pr = polarSnap(from, cur, s, 1);
  assert.equal(pr.ang, 45);
  const r = trackSnap([A], cur, s, 1, pr, from);
  assert.equal(r.kind, 'otrack-int'); nearPt(r, 60, -60); near(r.d, Math.hypot(2, 1));
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].A, A); assert.equal(r.lines[0].ang, 0); assert.ok(!r.lines[0].polar);
  assert.equal(r.lines[1].A, from); assert.equal(r.lines[1].ang, 45); assert.equal(r.lines[1].polar, true);
});
test('Polar nur berilmasa — faqat kuzatish chizig\'i (58,-60)', () => {
  const s = { ortho: false, polar: true, polarInc: 45, aperture: 12 };
  const r = trackSnap([P(0, -60)], P(58, -59), s, 1, null, P(0, 0));
  assert.equal(r.kind, 'otrack'); nearPt(r, 58, -60);
});
test('Polar nur bor, kuzatish chizig\'i yo\'q → null (polar o\'zi trackSnap natijasi emas)', () => {
  const s = { ortho: false, polar: true, polarInc: 45, aperture: 12 };
  const from = P(0, 0), cur = P(58, -59);
  const pr = polarSnap(from, cur, s, 1);
  assert.equal(trackSnap([P(500, 500)], cur, s, 1, pr, from), null);
});
test('Olingan nuqtalar yo\'q / bo\'sh / uzoq → null', () => {
  assert.equal(trackSnap([], P(50, 3), S_TR, 1), null);
  assert.equal(trackSnap(null, P(50, 3), S_TR, 1), null);
  assert.equal(trackSnap([P(0, 0)], P(50, 30), S_TR, 1), null);
});
test('Bir xil koordinatali ikki olingan nuqta — parallel chiziqlar kesishmaydi, otrack qaytadi', () => {
  const r = trackSnap([P(0, 0), P(0, 0)], P(50, 3), S_TR, 1);
  assert.equal(r.kind, 'otrack'); nearPt(r, 50, 0);
});

/* ============================================================ */
console.log('\n=== 14) resolveSnap — ustunlik tartibi ===\n');

const SET = (extra = {}) => ({ ...klon(DEFAULT_SNAP), ...extra });
const G_EMPTY = buildGeom([]);

test('OSNAP hammadan ustun: from + acquired bo\'lsa ham END (100,0), tracks bo\'sh', () => {
  const geom = buildGeom([line('l1', 0, 0, 100, 0)]);
  const r = resolveSnap({ geom, cur: P(99, 1), scale: 1, settings: SET({ ortho: true }), from: P(0, -50), acquired: [P(0, 0)] });
  assert.equal(r.kind, 'END'); nearPt(r, 100, 0);
  assert.ok(r.snap); assert.equal(r.snap.kind, 'END'); assert.equal(r.snap.eid, 'l1'); nearPt(r.snap, 100, 0);
  assert.deepEqual(r.tracks, []); assert.equal(r.tip, 'Uch nuqta');
});
test('OSNAP o\'chiq (settings.osnap=false) → geometriya e\'tiborsiz, ORTHO (10,0)', () => {
  const geom = buildGeom([line('l1', 0, 0, 100, 0)]);
  const r = resolveSnap({ geom, cur: P(10, -3), scale: 1, settings: SET({ osnap: false, ortho: true }), from: P(0, 0) });
  assert.equal(r.kind, 'ortho'); nearPt(r, 10, 0); assert.equal(r.snap, null);
  assert.equal(r.tip, 'Orto 0°');
  assert.equal(r.tracks.length, 1);
  nearPt(r.tracks[0].from, 0, 0); nearPt(r.tracks[0].to, 10, 0); assert.equal(r.tracks[0].ang, 0); assert.equal(r.tracks[0].polar, true);
});
test('OSNAP nomzod yo\'q (kursor uzoq) → POLAR (50,-40), tip "Polar 0°"', () => {
  const geom = buildGeom([line('l1', 0, 0, 100, 0)]);
  const r = resolveSnap({ geom, cur: P(50, -38), scale: 1, settings: SET(), from: P(0, -40) });
  assert.equal(r.kind, 'polar'); nearPt(r, 50, -40); assert.equal(r.tip, 'Polar 0°'); assert.equal(r.snap, null);
  assert.equal(r.tracks.length, 1); nearPt(r.tracks[0].from, 0, -40); assert.equal(r.tracks[0].polar, true);
});
test('OTRACK-INT > POLAR: polar nur × kuzatish chizig\'i → (60,-60), tracks 2 (biri polar)', () => {
  const s = SET({ polarInc: 45 });
  const r = resolveSnap({ geom: G_EMPTY, cur: P(58, -59), scale: 1, settings: s, from: P(0, 0), acquired: [P(0, -60)] });
  assert.equal(r.kind, 'otrack-int'); nearPt(r, 60, -60); assert.equal(r.tip, 'Kuzatish kesishmasi'); assert.equal(r.snap, null);
  assert.equal(r.tracks.length, 2);
  nearPt(r.tracks[0].from, 0, -60); nearPt(r.tracks[0].to, 60, -60); assert.equal(r.tracks[0].ang, 0); assert.equal(r.tracks[0].polar, false);
  nearPt(r.tracks[1].from, 0, 0); nearPt(r.tracks[1].to, 60, -60); assert.equal(r.tracks[1].ang, 45); assert.equal(r.tracks[1].polar, true);
});
test('OTRACK-INT: ikki olingan nuqta (from yo\'q) → (100,0)', () => {
  const r = resolveSnap({ geom: G_EMPTY, cur: P(98, -2), scale: 1, settings: SET({ ortho: true }), acquired: [P(0, 0), P(100, -60)] });
  assert.equal(r.kind, 'otrack-int'); nearPt(r, 100, 0);
  assert.equal(r.tracks.length, 2); assert.ok(r.tracks.every((t) => t.polar === false));
});
test('POLAR > OTRACK chizig\'i: ikkalasi yaqin, kesishma uzoq → polar (85,0)', () => {
  const s = SET({ polarInc: 45 });
  const r = resolveSnap({ geom: G_EMPTY, cur: P(85, -10), scale: 1, settings: s, from: P(0, 0), acquired: [P(0, 60)] });
  assert.equal(r.kind, 'polar'); nearPt(r, 85, 0); assert.equal(r.tip, 'Polar 0°');
  assert.equal(r.tracks.length, 1); assert.equal(r.tracks[0].polar, true); assert.equal(r.tracks[0].ang, 0);
});
test('OTRACK chizig\'i (polar yo\'q — from yo\'q) → (77.5,-17.5), tip "Kuzatish 45°"', () => {
  const s = SET({ polarInc: 45 });
  const r = resolveSnap({ geom: G_EMPTY, cur: P(85, -10), scale: 1, settings: s, acquired: [P(0, 60)] });
  assert.equal(r.kind, 'otrack'); nearPt(r, 77.5, -17.5); assert.equal(r.tip, 'Kuzatish 45°');
  assert.equal(r.tracks.length, 1);
  nearPt(r.tracks[0].from, 0, 60); nearPt(r.tracks[0].to, 77.5, -17.5); assert.equal(r.tracks[0].ang, 45); assert.equal(r.tracks[0].polar, false);
});
test('OTRACK: polar nur yo\'q (kursor nurdan uzoq), chiziq yaqin → otrack', () => {
  // from (0,0), cur (85,-30): 19.4° → 15°/30° nurdan 3.9° = 5.8 mm... scale 3 → 17 px > 12 → polar null
  const s = SET({ polarInc: 15 });
  const r = resolveSnap({ geom: G_EMPTY, cur: P(85, -30), scale: 3, settings: s, from: P(0, 0), acquired: [P(200, -30)] });
  assert.equal(r.kind, 'otrack'); nearPt(r, 85, -30);
});
test('OTRACK o\'chiq → olingan nuqtalar e\'tiborsiz → raw', () => {
  const s = SET({ polarInc: 45, otrack: false });
  const r = resolveSnap({ geom: G_EMPTY, cur: P(85, -10), scale: 1, settings: s, acquired: [P(0, 60)] });
  assert.equal(r.kind, 'raw'); nearPt(r, 85, -10); assert.deepEqual(r.tracks, []); assert.equal(r.tip, '');
});
test('GRID: gridSnap + ctx.gridStep 10 → (83,-14) → (80,-10); snap null, tracks bo\'sh', () => {
  const r = resolveSnap({ geom: G_EMPTY, cur: P(83, -14), scale: 1, settings: SET({ gridSnap: true }), gridStep: 10 });
  assert.equal(r.kind, 'grid'); nearPt(r, 80, -10); assert.equal(r.snap, null); assert.deepEqual(r.tracks, []); assert.equal(r.tip, '');
});
test('GRID: gridStep 0 yoki gridSnap o\'chiq → raw', () => {
  const r1 = resolveSnap({ geom: G_EMPTY, cur: P(83, -14), scale: 1, settings: SET({ gridSnap: true }), gridStep: 0 });
  assert.equal(r1.kind, 'raw'); nearPt(r1, 83, -14);
  const r2 = resolveSnap({ geom: G_EMPTY, cur: P(83, -14), scale: 1, settings: SET({ gridSnap: false }), gridStep: 10 });
  assert.equal(r2.kind, 'raw'); nearPt(r2, 83, -14);
});
test('POLAR > GRID: from bor, nur yaqin → polar (to\'r emas)', () => {
  const r = resolveSnap({ geom: G_EMPTY, cur: P(83, -1), scale: 1, settings: SET({ gridSnap: true }), gridStep: 10, from: P(0, 0) });
  assert.equal(r.kind, 'polar'); nearPt(r, 83, 0);
});
test('RAW: hech narsa mos kelmasa — xom kursor', () => {
  const geom = buildGeom([line('l1', 0, 0, 100, 0)]);
  const r = resolveSnap({ geom, cur: P(50, 40), scale: 1, settings: SET() });
  assert.deepEqual(r, { x: 50, y: 40, kind: 'raw', snap: null, tracks: [], tip: '' });
});
test('settings berilmasa DEFAULT_SNAP: END (0,0) topiladi; geom null → osnap o\'tkazib yuboriladi', () => {
  const geom = buildGeom([line('l1', 0, 0, 100, 0)]);
  const r = resolveSnap({ geom, cur: P(1, 1), scale: 1 });
  assert.equal(r.kind, 'END'); nearPt(r, 0, 0);
  const r2 = resolveSnap({ geom: null, cur: P(1, 1), scale: 1 });
  assert.equal(r2.kind, 'raw');
});
test('skipEid resolveSnap orqali uzatiladi → END (0,5)', () => {
  const geom = buildGeom([line('l1', 0, 0, 20, 0), line('l2', 0, 5, 20, 5)]);
  const r = resolveSnap({ geom, cur: P(0.5, 0.3), scale: 1, settings: SET(), skipEid: 'l1' });
  assert.equal(r.kind, 'END'); nearPt(r, 0, 5); assert.equal(r.snap.eid, 'l2');
});
test('PER resolveSnap orqali: tip "Perpendikulyar" (uzun chiziq — END/MID uzoqda)', () => {
  const geom = buildGeom([line('l1', 0, 0, 200, 0)]);
  const r = resolveSnap({ geom, cur: P(50, 0.5), scale: 1, settings: SET(), from: P(50, -10) });
  assert.equal(r.kind, 'PER'); nearPt(r, 50, 0); assert.equal(r.tip, 'Perpendikulyar');
});
test('Apertura settings.aperture dan olinadi: 6 px bilan 10 mm uzoq END topilmaydi', () => {
  const geom = buildGeom([line('l1', 0, 0, 100, 0)]);
  assert.equal(resolveSnap({ geom, cur: P(0, 10), scale: 1, settings: SET({ aperture: 6 }) }).kind, 'raw');
  assert.equal(resolveSnap({ geom, cur: P(0, 10), scale: 1, settings: SET({ aperture: 12 }) }).kind, 'END');
});
test('ORTHO + POLAR ikkalasi yoqiq → ortho ("Orto 90°")', () => {
  const r = resolveSnap({ geom: G_EMPTY, cur: P(2, -10), scale: 1, settings: SET({ ortho: true, polar: true }), from: P(0, 0) });
  assert.equal(r.kind, 'ortho'); assert.equal(r.tip, 'Orto 90°'); nearPt(r, 0, -10);
});

/* ============================================================ */
console.log('\n=== 15) updateAcquire ===\n');

const S_ACQ = { otrack: true, acquireMs: 250 };
const RES = (x, y) => ({ x, y, kind: 'END', snap: { x, y, kind: 'END', eid: 'e' } });

test('Vaqt bo\'yicha olish: 0 ms → hover, 100 ms → yo\'q, 250 ms → olindi (true), keyin qayta emas', () => {
  const tr = { hover: null, acq: [] };
  assert.equal(updateAcquire(tr, RES(10, 0), 0, null, S_ACQ), false);
  assert.ok(tr.hover); nearPt(tr.hover, 10, 0); assert.equal(tr.hover.since, 0); assert.equal(tr.hover.done, false);
  assert.equal(updateAcquire(tr, RES(10, 0), 100, null, S_ACQ), false);
  assert.equal(tr.acq.length, 0);
  assert.equal(updateAcquire(tr, RES(10, 0), 250, null, S_ACQ), true);
  assert.equal(tr.acq.length, 1); nearPt(tr.acq[0], 10, 0); assert.deepEqual(tr.acq[0].dirs, []);
  assert.equal(tr.hover.done, true);
  assert.equal(updateAcquire(tr, RES(10, 0), 900, null, S_ACQ), false);
  assert.equal(tr.acq.length, 1);
});
test('Boshqa nuqtaga o\'tish hover ni qayta boshlaydi; yangi olingan nuqta ro\'yxat boshiga (unshift)', () => {
  const tr = { hover: null, acq: [] };
  updateAcquire(tr, RES(10, 0), 0, null, S_ACQ); updateAcquire(tr, RES(10, 0), 250, null, S_ACQ);
  assert.equal(updateAcquire(tr, RES(20, 0), 300, null, S_ACQ), false);
  assert.equal(tr.hover.since, 300); assert.equal(tr.hover.done, false);
  assert.equal(updateAcquire(tr, RES(20, 0), 549, null, S_ACQ), false);
  assert.equal(updateAcquire(tr, RES(20, 0), 550, null, S_ACQ), true);
  assert.equal(tr.acq.length, 2); nearPt(tr.acq[0], 20, 0); nearPt(tr.acq[1], 10, 0);
});
test('Qayta turilsa OLIB TASHLANADI (AutoCAD): 2 ta olingan → 10 ustida qayta turish → 1 ta qoladi', () => {
  const tr = { hover: null, acq: [] };
  updateAcquire(tr, RES(10, 0), 0, null, S_ACQ); updateAcquire(tr, RES(10, 0), 250, null, S_ACQ);
  updateAcquire(tr, RES(20, 0), 300, null, S_ACQ); updateAcquire(tr, RES(20, 0), 600, null, S_ACQ);
  assert.equal(tr.acq.length, 2);
  updateAcquire(tr, RES(10, 0), 700, null, S_ACQ);
  assert.equal(updateAcquire(tr, RES(10, 0), 1000, null, S_ACQ), true);
  assert.equal(tr.acq.length, 1); nearPt(tr.acq[0], 20, 0);
  assert.equal(tr.hover.done, true);
});
test('7 tadan oshmaydi (MAX_ACQUIRED): 8-nuqta olinganda eng eskisi tushib qoladi', () => {
  const tr = { hover: null, acq: [] };
  let t = 0;
  for (const x of [10, 20, 30, 40, 50, 60, 70, 80]) { updateAcquire(tr, RES(x, 0), t, null, S_ACQ); assert.equal(updateAcquire(tr, RES(x, 0), t + 250, null, S_ACQ), true); t += 1000; }
  assert.equal(tr.acq.length, 7);
  assert.deepEqual(tr.acq.map((a) => a.x), [80, 70, 60, 50, 40, 30, 20]);
});
test('res.snap null → hover null, false (olingan ro\'yxat saqlanadi)', () => {
  const tr = { hover: { x: 10, y: 0, since: 0, done: false }, acq: [{ x: 1, y: 1, dirs: [] }] };
  assert.equal(updateAcquire(tr, { x: 5, y: 5, kind: 'raw', snap: null }, 100, null, S_ACQ), false);
  assert.equal(tr.hover, null); assert.equal(tr.acq.length, 1);
});
test('otrack o\'chiq → hover null, hech qachon olinmaydi', () => {
  const tr = { hover: null, acq: [] };
  assert.equal(updateAcquire(tr, RES(10, 0), 0, null, { otrack: false, acquireMs: 250 }), false);
  assert.equal(tr.hover, null);
  assert.equal(updateAcquire(tr, RES(10, 0), 1000, null, { otrack: false, acquireMs: 250 }), false);
  assert.equal(tr.acq.length, 0);
});
test('geom berilsa dirs = endpointDirs (EXT uchun); (10,0) uchida 0°', () => {
  const tr = { hover: null, acq: [] };
  const geom = buildGeom([line('l', 0, 0, 10, 0)]);
  updateAcquire(tr, RES(10, 0), 0, geom, S_ACQ); updateAcquire(tr, RES(10, 0), 250, geom, S_ACQ);
  assert.equal(tr.acq[0].dirs.length, 1); near(tr.acq[0].dirs[0], 0);
});
test('acquireMs berilmasa 250; settings berilmasa DEFAULT_SNAP (otrack true, 250)', () => {
  const tr = { hover: null, acq: [] };
  updateAcquire(tr, RES(10, 0), 0, null, { otrack: true });
  assert.equal(updateAcquire(tr, RES(10, 0), 249, null, { otrack: true }), false);
  assert.equal(updateAcquire(tr, RES(10, 0), 250, null, { otrack: true }), true);
  const tr2 = { hover: null, acq: [] };
  updateAcquire(tr2, RES(3, 3), 0);
  assert.equal(updateAcquire(tr2, RES(3, 3), 250), true);
});

/* ============================================================ */
console.log('\n=== 16) loadSnap / saveSnap (soxta storage) ===\n');

const soxtaStorage = (init = {}) => {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};

test('Bo\'sh storage → DEFAULT_SNAP nusxasi (deep), asl obyekt o\'zgarmaydi', () => {
  const s = loadSnap(soxtaStorage());
  assert.deepEqual(s, DEFAULT_SNAP);
  assert.notEqual(s, DEFAULT_SNAP); assert.notEqual(s.modes, DEFAULT_SNAP.modes);
  s.modes.END = false; s.polarInc = 90;
  assert.equal(DEFAULT_SNAP.modes.END, true); assert.equal(DEFAULT_SNAP.polarInc, 15);
});
test('Buzuq JSON → standart', () => {
  assert.deepEqual(loadSnap(soxtaStorage({ [SNAP_KEY]: 'abc{' })), DEFAULT_SNAP);
  assert.deepEqual(loadSnap(soxtaStorage({ [SNAP_KEY]: '' })), DEFAULT_SNAP);
  assert.deepEqual(loadSnap(soxtaStorage({ [SNAP_KEY]: 'null' })), DEFAULT_SNAP);
  assert.deepEqual(loadSnap(soxtaStorage({ [SNAP_KEY]: '"matn"' })), DEFAULT_SNAP);
  assert.deepEqual(loadSnap(soxtaStorage({ [SNAP_KEY]: '42' })), DEFAULT_SNAP);
});
test('getItem xato bersa → standart, exception chiqmaydi', () => {
  const st = { getItem: () => { throw new Error('yopiq'); }, setItem: () => {} };
  assert.deepEqual(loadSnap(st), DEFAULT_SNAP);
});
test('To\'g\'ri qiymatlar o\'qiladi: boolean maydonlar, polarInc 45, gridStep 25, aperture 20', () => {
  const s = loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ ortho: true, polar: false, otrack: false, grid: false, gridSnap: true, dyn: false, osnap: false, polarInc: 45, gridStep: 25, aperture: 20, acquireMs: 999 }) }));
  assert.equal(s.ortho, true); assert.equal(s.polar, false); assert.equal(s.otrack, false); assert.equal(s.grid, false);
  assert.equal(s.gridSnap, true); assert.equal(s.dyn, false); assert.equal(s.osnap, false);
  assert.equal(s.polarInc, 45); assert.equal(s.gridStep, 25); assert.equal(s.aperture, 20);
  assert.equal(s.acquireMs, 250);   // acquireMs storage'dan o'qilmaydi — standart
  assert.deepEqual(s.modes, DEFAULT_SNAP.modes);
});
test('Noto\'g\'ri polarInc (7, "15", null) rad etiladi → 15', () => {
  for (const v of [7, '15', null, -15, 0]) assert.equal(loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ polarInc: v }) })).polarInc, 15, `polarInc ${v}`);
  for (const v of POLAR_INCS) assert.equal(loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ polarInc: v }) })).polarInc, v);
});
test('Noto\'g\'ri gridStep (3, -1, "10") rad etiladi → 0; ro\'yxatdagilar qabul', () => {
  for (const v of [3, -1, '10', 7.5]) assert.equal(loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ gridStep: v }) })).gridStep, 0, `gridStep ${v}`);
  for (const v of GRID_STEPS) assert.equal(loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ gridStep: v }) })).gridStep, v);
});
test('Aperture: 4..40 oralig\'i — 3 va 41 rad, 4 va 40 qabul, null/NaN rad', () => {
  const ap = (v) => loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ aperture: v }) })).aperture;
  assert.equal(ap(3), 12); assert.equal(ap(41), 12); assert.equal(ap(null), 12); assert.equal(ap(-10), 12);
  assert.equal(ap(4), 4); assert.equal(ap(40), 40); assert.equal(ap(20), 20);
});
test('Boolean bo\'lmagan boolean maydonlar rad etiladi ("yes", 1, null)', () => {
  const s = loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ ortho: 'yes', osnap: 0, polar: null, otrack: 1 }) }));
  assert.equal(s.ortho, false); assert.equal(s.osnap, true); assert.equal(s.polar, true); assert.equal(s.otrack, true);
});
test('modes qisman: NEA true, END false — qolganlari standart; boolean bo\'lmagan qiymat rad', () => {
  const s = loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ modes: { NEA: true, END: false, MID: 'no', QUA: 0, YOQ: true } }) }));
  assert.equal(s.modes.NEA, true); assert.equal(s.modes.END, false);
  assert.equal(s.modes.MID, true); assert.equal(s.modes.QUA, true);
  assert.equal('YOQ' in s.modes, false);
  assert.equal(Object.keys(s.modes).length, SNAP_MODES.length);
});
test('modes obyekt emas ("x", 5, null, massiv) → standart modes', () => {
  for (const v of ['x', 5, null, true]) assert.deepEqual(loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ modes: v }) })).modes, DEFAULT_SNAP.modes);
});
test('Noma\'lum kalitlar natijaga o\'tmaydi', () => {
  const s = loadSnap(soxtaStorage({ [SNAP_KEY]: JSON.stringify({ foo: 1, bar: 'x', ortho: true }) }));
  assert.equal('foo' in s, false); assert.equal('bar' in s, false);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(DEFAULT_SNAP).sort());
});
test('saveSnap → SNAP_KEY ostida JSON; loadSnap bilan aylanma (round-trip) teng', () => {
  const st = soxtaStorage();
  const s = { ...klon(DEFAULT_SNAP), ortho: true, polar: false, polarInc: 30, gridStep: 50, aperture: 18, modes: { ...DEFAULT_SNAP.modes, TAN: true, NEA: true, INT: false } };
  saveSnap(s, st);
  assert.equal(typeof st.data[SNAP_KEY], 'string');
  assert.deepEqual(JSON.parse(st.data[SNAP_KEY]), s);
  assert.deepEqual(loadSnap(st), s);
});
test('saveSnap: setItem xato bersa jim; storage yo\'q (null) → hech narsa qilmaydi', () => {
  saveSnap(DEFAULT_SNAP, { getItem: () => null, setItem: () => { throw new Error('to\'la'); } });
  saveSnap(DEFAULT_SNAP, null);
  assert.equal(typeof localStorage, 'undefined');
  assert.deepEqual(loadSnap(), DEFAULT_SNAP);   // Node'da localStorage yo'q → standart
});
test('SNAP_KEY / SNAP_MODES / DEFAULT_SNAP izchil: 10 rejim, har biri modes da, pri 0..4', () => {
  assert.equal(SNAP_KEY, 'cad-snap-v1');
  assert.equal(SNAP_MODES.length, 10);
  assert.deepEqual(SNAP_MODES.map((m) => m.key), ['END', 'MID', 'CEN', 'NOD', 'QUA', 'INT', 'EXT', 'PER', 'TAN', 'NEA']);
  for (const m of SNAP_MODES) { assert.equal(typeof DEFAULT_SNAP.modes[m.key], 'boolean', m.key); assert.ok(m.pri >= 0 && m.pri <= 4); assert.ok(m.nomi); assert.ok(m.marker); }
  assert.ok(POLAR_INCS.includes(DEFAULT_SNAP.polarInc)); assert.ok(GRID_STEPS.includes(DEFAULT_SNAP.gridStep));
  assert.ok(DEFAULT_SNAP.aperture >= 4 && DEFAULT_SNAP.aperture <= 40);
});

/* ============================================================ */
console.log('\n=== 17) autoGridStep / gridStepFor ===\n');

test('autoGridStep: scale 1 → 50 (50 px ≥ 22); scale 10 → 5; scale 100 → 1', () => {
  assert.equal(autoGridStep(1), 50);
  assert.equal(autoGridStep(10), 5);
  assert.equal(autoGridStep(100), 1);
});
test('autoGridStep: scale 0.1 → 500; 0.001 → 5000 (eng katta); 0.2 → 200', () => {
  assert.equal(autoGridStep(0.1), 500);
  assert.equal(autoGridStep(0.001), 5000);
  assert.equal(autoGridStep(0.2), 200);
});
test('autoGridStep: minPx parametri — scale 1, minPx 60 → 100; aniq chegara 22 → 22 px (scale 2.2 → 10)', () => {
  assert.equal(autoGridStep(1, 60), 100);
  assert.equal(autoGridStep(2.2), 10);
  assert.equal(autoGridStep(2.19), 20);
});
test('gridStepFor: sozlamada qadam bo\'lsa o\'sha; 0 → avto; sozlama yo\'q → avto', () => {
  assert.equal(gridStepFor({ gridStep: 25 }, 1), 25);
  assert.equal(gridStepFor({ gridStep: 0 }, 1), 50);
  assert.equal(gridStepFor(null, 10), 5);
  assert.equal(gridStepFor(undefined, 100), 1);
  assert.equal(gridStepFor({ gridStep: -5 }, 1), 50);
});

/* ============================================================ */
console.log('\n=== 18) snapMarkerShapes ===\n');

test('Har rejim uchun bo\'sh bo\'lmagan massiv, tag/attrs, stroke rangi, fill none', () => {
  for (const m of SNAP_MODES) {
    const sh = snapMarkerShapes(m.key, 100, 200, '#f00');
    assert.ok(Array.isArray(sh) && sh.length > 0, m.key);
    for (const el of sh) {
      assert.equal(typeof el.tag, 'string', m.key);
      assert.equal(el.attrs.stroke, '#f00', m.key); assert.equal(el.attrs.fill, 'none', m.key);
      assert.equal(el.attrs['stroke-width'], 1.6); assert.equal(el.attrs['pointer-events'], 'none');
    }
  }
});
test('END → kvadrat rect (sx−r, sy−r, 2r×2r); r standart 6, r=10 bilan 20', () => {
  const [q] = snapMarkerShapes('END', 100, 200, '#0f0');
  assert.equal(q.tag, 'rect'); assert.equal(q.attrs.x, 94); assert.equal(q.attrs.y, 194); assert.equal(q.attrs.width, 12); assert.equal(q.attrs.height, 12);
  const [q2] = snapMarkerShapes('END', 100, 200, '#0f0', 10);
  assert.equal(q2.attrs.width, 20); assert.equal(q2.attrs.x, 90);
});
test('INT → 2 diagonal chiziq (X)', () => {
  const sh = snapMarkerShapes('INT', 100, 200, '#00f');
  assert.equal(sh.length, 2); assert.ok(sh.every((e) => e.tag === 'line'));
  assert.deepEqual([sh[0].attrs.x1, sh[0].attrs.y1, sh[0].attrs.x2, sh[0].attrs.y2], [94, 194, 106, 206]);
  assert.deepEqual([sh[1].attrs.x1, sh[1].attrs.y1, sh[1].attrs.x2, sh[1].attrs.y2], [94, 206, 106, 194]);
});
test('NOD → aylana + 2 chiziq; CEN → 1 aylana r=6, markazda', () => {
  const nod = snapMarkerShapes('NOD', 100, 200, '#000');
  assert.equal(nod.length, 3); assert.equal(nod[0].tag, 'circle'); assert.equal(nod[1].tag, 'line'); assert.equal(nod[2].tag, 'line');
  const cen = snapMarkerShapes('CEN', 100, 200, '#000');
  assert.equal(cen.length, 1); assert.equal(cen[0].tag, 'circle'); assert.equal(cen[0].attrs.cx, 100); assert.equal(cen[0].attrs.cy, 200); assert.equal(cen[0].attrs.r, 6);
});
test('MID / QUA / NEA → polygon (points matni sx,sy atrofida); PER → 4 chiziq; TAN → aylana + chiziq; EXT → shtrixli rect', () => {
  for (const k of ['MID', 'QUA', 'NEA']) {
    const [p] = snapMarkerShapes(k, 100, 200, '#000');
    assert.equal(p.tag, 'polygon', k); assert.equal(typeof p.attrs.points, 'string', k);
    const nums = p.attrs.points.split(/[ ,]/).map(Number);
    assert.ok(nums.every((n) => Number.isFinite(n) && Math.abs(n - (nums.indexOf(n) % 2 ? 200 : 100)) <= 8), `${k} nuqtalar markaz atrofida: ${p.attrs.points}`);
  }
  const per = snapMarkerShapes('PER', 100, 200, '#000');
  assert.equal(per.length, 4); assert.ok(per.every((e) => e.tag === 'line'));
  const tan = snapMarkerShapes('TAN', 100, 200, '#000');
  assert.equal(tan.length, 2); assert.equal(tan[0].tag, 'circle'); assert.equal(tan[1].tag, 'line');
  const [ext] = snapMarkerShapes('EXT', 100, 200, '#000');
  assert.equal(ext.tag, 'rect'); assert.equal(ext.attrs['stroke-dasharray'], '2 2');
});
test("Noma'lum kind ('polar', 'otrack', 'grid', '') → '+' — 2 chiziq: gorizontal va vertikal", () => {
  for (const k of ['polar', 'otrack', 'otrack-int', 'grid', 'ortho', '', undefined]) {
    const sh = snapMarkerShapes(k, 100, 200, '#abc');
    assert.equal(sh.length, 2, String(k)); assert.ok(sh.every((e) => e.tag === 'line'), String(k));
    assert.deepEqual([sh[0].attrs.x1, sh[0].attrs.y1, sh[0].attrs.x2, sh[0].attrs.y2], [94, 200, 106, 200], String(k));
    assert.deepEqual([sh[1].attrs.x1, sh[1].attrs.y1, sh[1].attrs.x2, sh[1].attrs.y2], [100, 194, 100, 206], String(k));
    assert.equal(sh[0].attrs.stroke, '#abc');
  }
});

/* ============================================================ */
console.log('\n=== 19) modeName ===\n');

test('modeName: rejim nomlari va kuzatish turlari; noma\'lum → ""', () => {
  assert.equal(modeName('END'), 'Uch nuqta');
  assert.equal(modeName('MID'), "O'rta nuqta");
  assert.equal(modeName('PER'), 'Perpendikulyar');
  assert.equal(modeName('NEA'), 'Eng yaqin');
  assert.equal(modeName('ortho'), 'Orto');
  assert.equal(modeName('polar'), 'Polar');
  assert.equal(modeName('otrack'), 'Kuzatish');
  assert.equal(modeName('otrack-int'), 'Kuzatish kesishmasi');
  assert.equal(modeName('grid'), "To'r");
  assert.equal(modeName('raw'), '');
  assert.equal(modeName(undefined), '');
  for (const m of SNAP_MODES) assert.equal(modeName(m.key), m.nomi);
});

/* ============================================================ */
console.log(`\n${'='.repeat(46)}`);
console.log(xato === 0 ? `✅ HAMMASI O'TDI — ${jami} ta test` : `❌ ${xato} / ${jami} TEST O'TMADI`);
console.log(`${'='.repeat(46)}\n`);
process.exitCode = xato === 0 ? 0 : 1;
