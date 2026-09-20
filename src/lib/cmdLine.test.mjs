// ============================================================
//  BUYRUQ SATRI MANTIG'I — TESTLAR
//  Ishga tushirish:  node src/lib/cmdLine.test.mjs   (npm run test:cmd)
//  Konvensiya: world mm, x o'ngga, y PASTGA; kiritishda Y TEPAGA (AutoCAD).
// ============================================================
import assert from 'node:assert/strict';
import { num1, parseInput, pointFromDist, deriveKeywords, matchKeyword, promptWithOptions, cmdScore, cmdFilter, cmdNorm, evalExpr, normSym } from './cmdLine.js';

let jami = 0, xato = 0;
function test(nom, fn) {
  jami += 1;
  try { fn(); console.log(`  ✅ ${nom}`); }
  catch (e) { xato += 1; console.log(`  ❌ ${nom}\n` + String(e && e.message ? e.message : e).split('\n').map((l) => `     ${l}`).join('\n')); }
}
const near = (o, k, eps = 1e-7, nom = '') => assert.ok(Math.abs(o - k) <= eps, `${nom} kutilgan ${k}, olingan ${o}`);
const pt = (r, x, y, eps = 1e-7) => { assert.equal(r.kind, 'point'); near(r.x, x, eps, 'x'); near(r.y, y, eps, 'y'); };
const SM = { unit: 10 };   // sm rejimi: 1 birlik = 10 mm

console.log('\n— Son va koordinata —');
test('num1: nuqta va vergul kasr ajratkich; bo\'sh/xato → null', () => {
  near(num1('12.5'), 12.5); near(num1('12,5'), 12.5); near(num1(' 7 '), 7); near(num1('-3'), -3);
  assert.equal(num1(''), null); assert.equal(num1('abc'), null); assert.equal(num1(null), null);
});
test('parseInput: bo\'sh → empty; mutlaq koordinata (Y tepaga → ichkarida manfiy)', () => {
  assert.equal(parseInput('', SM).kind, 'empty');
  assert.equal(parseInput('   ', SM).kind, 'empty');
  pt(parseInput('120,80', SM), 1200, -800);
  pt(parseInput('12.5,0', SM), 125, 0);
  pt(parseInput('-5,-3', SM), -50, 30);
  pt(parseInput('0,0', SM), 0, 0);
});
test('parseInput: mm rejimi (unit 1) va bo\'shliqlar', () => {
  pt(parseInput('120,80', { unit: 1 }), 120, -80);
  pt(parseInput(' 10 , 20 ', { unit: 1 }), 10, -20);
  pt(parseInput('10,20'), 10, -20);   // unit berilmasa mm
});
test('parseInput: nisbiy @dx,dy — oldingi nuqtadan', () => {
  pt(parseInput('@30,-20', { unit: 10, from: { x: 100, y: -50 } }), 400, 150);
  pt(parseInput('@0,0', { unit: 10, from: { x: 7, y: 9 } }), 7, 9);
  pt(parseInput('@', { unit: 10, from: { x: 7, y: 9 } }), 7, 9);
});
test('parseInput: nisbiy uchun oldingi nuqta shart', () => {
  assert.equal(parseInput('@30,20', SM).kind, 'invalid');
  assert.equal(parseInput('@', SM).kind, 'invalid');
  assert.ok(/oldingi nuqta/i.test(parseInput('@30,20', SM).reason));
});
test('parseInput: qutbiy masofa<burchak (mutlaq — koordinata boshidan)', () => {
  pt(parseInput('50<0', { unit: 1 }), 50, 0);
  pt(parseInput('50<90', { unit: 1 }), 0, -50, 1e-9);
  pt(parseInput('50<180', { unit: 1 }), -50, 0, 1e-9);
  pt(parseInput('50<270', { unit: 1 }), 0, 50, 1e-9);
});
test('parseInput: nisbiy qutbiy @masofa<burchak — AutoCAD ning eng ko\'p ishlatiladigan shakli', () => {
  pt(parseInput('@50<45', { unit: 10, from: { x: 0, y: 0 } }), 500 * Math.SQRT1_2, -500 * Math.SQRT1_2, 1e-9);
  pt(parseInput('@10<-90', { unit: 10, from: { x: 100, y: 100 } }), 100, 200, 1e-9);
  pt(parseInput('@10<0', { unit: 10, from: { x: 5, y: 5 } }), 105, 5, 1e-9);
});
test('parseInput: @masofa — kursor yo\'nalishida (to\'g\'ridan-to\'g\'ri masofa)', () => {
  const r = parseInput('@50', { unit: 10, from: { x: 0, y: 0 } });
  assert.equal(r.kind, 'dist'); near(r.mm, 500);
});
test('parseInput: bitta son — qiymat (birlikka ko\'paytirilgani ham)', () => {
  const r = parseInput('25', SM);
  assert.equal(r.kind, 'number'); near(r.v, 25); near(r.mm, 250);
  const r2 = parseInput('2.5', { unit: 1 });
  assert.equal(r2.kind, 'number'); near(r2.mm, 2.5);
});
test('parseInput: «12,5» — AutoCAD da bu KOORDINATA (12 va 5), kasr emas', () => {
  pt(parseInput('12,5', SM), 120, -50);
});
test('parseInput: xato kiritishlar — tushunarli sabab bilan', () => {
  for (const s of ['abc', '10,', ',5', '10<', '<45', '10,20,5', '@abc', '#']) {
    const r = parseInput(s, SM);
    assert.equal(r.kind, 'invalid', s + ' → ' + r.kind);
    assert.ok(r.reason && r.reason.length > 3, s);
  }
});
test('pointFromDist: kursor yo\'nalishida; noto\'g\'ri kirishda null', () => {
  const p = pointFromDist({ x: 0, y: 0 }, { x: 10, y: 0 }, 50);
  near(p.x, 50); near(p.y, 0);
  const q = pointFromDist({ x: 0, y: 0 }, { x: 3, y: -4 }, 100);
  near(q.x, 60); near(q.y, -80);
  assert.equal(pointFromDist(null, { x: 1, y: 1 }, 5), null);
  assert.equal(pointFromDist({ x: 0, y: 0 }, { x: 0, y: 0 }, 5), null);
  assert.equal(pointFromDist({ x: 0, y: 0 }, { x: 1, y: 0 }, 0), null);
});

console.log('\n— Kalit so\'zlar —');
test('deriveKeywords: birinchi harf; to\'qnashsa ikkinchi so\'z harfi, keyin 2-3 harf', () => {
  assert.deepEqual(deriveKeywords(['Radius', 'Polyline (butun kontur)', 'Kesish (Trim)', 'Faska']), ['R', 'P', 'K', 'F']);
  assert.deepEqual(deriveKeywords(['Markaz, radius', 'Markaz, diametr', '2 nuqta', '3 nuqta']), ['M', 'MD', '2N', '3N']);
  assert.deepEqual(deriveKeywords(['Delta', 'Foiz', 'Umumiy']), ['D', 'F', 'U']);
});
test('deriveKeywords: sof raqamli kalit bo\'lmaydi — «2» radius qiymati bilan chalkashmasin', () => {
  for (const k of deriveKeywords(['2 nuqta', '3 nuqta', '10 marta', 'Radius'])) assert.ok(/[A-Z]/.test(k), 'kalit: ' + k);
});
test('deriveKeywords: hamma kalit takrorlanmas (tasodifiy yorliqlarda ham)', () => {
  const labs = ['Aylana', 'Aylana 2', 'Aylana 3', 'Aylana 4', 'Aylana 5'];
  const k = deriveKeywords(labs);
  assert.equal(new Set(k).size, k.length);
  assert.equal(k.length, labs.length);
});
test('matchKeyword: aniq kalit, noaniq (-2), mos emas (-1), yorliq boshlanishi', () => {
  const o = [{ label: 'Radius', kw: 'R' }, { label: 'Polyline', kw: 'P' }, { label: 'Kesish', kw: 'K' }];
  assert.equal(matchKeyword('r', o), 0);
  assert.equal(matchKeyword('R', o), 0);
  assert.equal(matchKeyword('pol', o), 1);
  assert.equal(matchKeyword('kesish', o), 2);
  assert.equal(matchKeyword('z', o), -1);
  assert.equal(matchKeyword('', o), -1);
  const amb = [{ label: 'Markaz, radius', kw: 'M' }, { label: 'Markaz, diametr', kw: 'MD' }];
  assert.equal(matchKeyword('m', amb), 0);       // aniq kalit — noaniqlik emas
  assert.equal(matchKeyword('markaz', amb), -2); // ikkala yorliq ham shunday boshlanadi
  const amb2 = [{ label: 'Masofa 1', kw: 'M' }, { label: 'Masofa 2', kw: 'M2' }];
  assert.equal(matchKeyword('m', amb2), 0);      // aniq kalit
  const amb3 = [{ label: 'Birinchi', kw: 'BI' }, { label: 'Boshqa', kw: 'BO' }];
  assert.equal(matchKeyword('b', amb3), -2);     // kalit prefiksi noaniq — yorliqqa o'tilmaydi
});
test('matchKeyword: AutoCAD inglizcha kaliti (alt) ham qabul qilinadi', () => {
  const o = [{ label: 'Yopish', kw: 'Y', alt: 'C' }, { label: 'Orqaga', kw: 'O', alt: 'U' }, { label: 'Yoy', kw: 'YO', alt: 'A' }];
  assert.equal(matchKeyword('y', o), 0);
  assert.equal(matchKeyword('c', o), 0);
  assert.equal(matchKeyword('u', o), 1);
  assert.equal(matchKeyword('a', o), 2);
  assert.equal(matchKeyword('yo', o), 2);
  assert.equal(matchKeyword('yopish', o), 0);
  assert.equal(matchKeyword('q', o), -1);
});
test('promptWithOptions: AutoCAD ko\'rinishi [A/B/C]; kalit yorliqqa mos kelmasa qavsda', () => {
  assert.equal(promptWithOptions('Birinchi obyektni tanlang', [{ label: 'Radius', kw: 'R' }, { label: 'Kesish', kw: 'K' }]),
    'Birinchi obyektni tanlang yoki [Radius/Kesish]');
  assert.equal(promptWithOptions('Nuqtani belgilang', [{ label: 'Markaz, diametr', kw: 'MD' }]),
    'Nuqtani belgilang yoki [Markaz, diametr (MD)]');
  assert.equal(promptWithOptions('Nuqtani belgilang', []), 'Nuqtani belgilang');
  assert.equal(promptWithOptions('Keyingi nuqta', [{ label: 'Yopish', kw: 'Y', alt: 'C' }]), 'Keyingi nuqta yoki [Yopish (C)]');
});

console.log('\n— Arifmetik ifoda —');
test('evalExpr: «50*2», «(30+20)/2», «100-15» — hisoblanadi; oddiy son yoki matn — null', () => {
  near(evalExpr('50*2'), 100); near(evalExpr('(30+20)/2'), 25); near(evalExpr('100-15'), 85);
  near(evalExpr('2*3+4'), 10); near(evalExpr('2+3*4'), 14); near(evalExpr('-5+10'), 5);
  near(evalExpr('3*-2'), -6); near(evalExpr('10--5'), 15); near(evalExpr('2*(-3+5)'), 4); near(evalExpr('-2*-3'), 6);
  near(evalExpr('100 - 15'), 85);   // uzilmas probel
  near(evalExpr('50−10'), 40);           // unicode minus
  assert.equal(evalExpr('50'), null);      // amal yo'q — oddiy son
  assert.equal(evalExpr('10,20'), null);   // koordinata
  assert.equal(evalExpr('abc'), null);
  assert.equal(evalExpr('5/0'), null);     // nolga bo'lish
  assert.equal(evalExpr('(5+2'), null);    // yopilmagan qavs
  assert.equal(evalExpr('@50<45'), null);
});

console.log('\n— Buyruq qidiruvi —');
const CM = [
  { id: 'pline', nomi: 'Chiziq', al: ['L', 'PL', 'LINE', 'PLINE'] },
  { id: 'circle', nomi: 'Aylana', al: ['C', 'CIRCLE'] },
  { id: 'copy', nomi: 'Nusxa', al: ['CO', 'CP', 'COPY'] },
  { id: 'chamfer', nomi: 'Faska', al: ['CHA', 'CHAMFER'] },
  { id: 'trim', nomi: 'Kesish', al: ['TR', 'TRIM'] },
];
test('cmdScore: aniq qisqartma eng kuchli, keyin qisqartma boshlanishi, nom boshlanishi', () => {
  assert.equal(cmdScore(CM[1], 'c'), 0);
  assert.equal(cmdScore(CM[2], 'c'), 1);
  assert.equal(cmdScore(CM[0], 'chiz'), 2);
  assert.equal(cmdScore(CM[4], 'esi'), 3);
  assert.equal(cmdScore(CM[0], 'zzz'), -1);
});
test('cmdFilter: «c» → Aylana birinchi; «tr» → Kesish; bo\'sh so\'rov → []', () => {
  const r = cmdFilter(CM, 'c');
  assert.equal(r[0].id, 'circle');
  assert.equal(cmdFilter(CM, 'tr')[0].id, 'trim');
  assert.deepEqual(cmdFilter(CM, ''), []);
  assert.deepEqual(cmdFilter(CM, 'qqq'), []);
  assert.ok(cmdFilter(CM, 'c').length <= 9);
  // bir xil ballda ko'p ishlatilgani oldinga chiqadi (adaptiv takliflar)
  const r2 = cmdFilter(CM, 'c', 9, { copy: 10 });
  assert.equal(r2[0].id, 'circle');   // aniq qisqartma «c» — baribir birinchi
  const r3 = cmdFilter([CM[2], CM[3]], 'c', 9, { chamfer: 5 });
  assert.equal(r3[0].id, 'chamfer');
});
test('normSym: unicode minus, uzilmas probel, to\'liq kenglikdagi belgilar oddiysiga aylanadi', () => {
  assert.equal(normSym('50−10'), '50-10');
  assert.equal(normSym('10 , 20'), '10 , 20');
  assert.equal(normSym('＠10，20'), '@10,20');
  assert.equal(normSym('50＜45'), '50<45');
});
test('cmdNorm: katta-kichik harf va o\'zbek apostroflari bir xil', () => {
  assert.equal(cmdNorm('Ko‘chirish'), cmdNorm("ko'chirish"));
  assert.equal(cmdNorm('  TRIM '), 'trim');
});

console.log(`\nJami: ${jami}, xato: ${xato}`);
if (xato) process.exit(1);
