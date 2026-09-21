// node --test src/lib/cadLayer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACI, LT, LW_BYLAYER, LW_DEFAULT, lwLabel, lwPx, normLayerName, layerNameError, makeLayer,
  defaultLayers, findLayer, sortLayers, canDeleteLayer, ltDash, aciHex, darkenForWhite,
  resolveStyle, usedLayerNames, migrateEnts, sanitizeLayers,
} from './cadLayer.js';

test('ACI: 7 — fon bo\'yicha (hex yo\'q), qolganlari hex', () => {
  assert.equal(ACI[7], null);
  assert.equal(ACI[1], '#ff0000');
  assert.equal(aciHex(7, '#ffffff'), '#ffffff');   // to'q doskada oq
  assert.equal(aciHex(7, '#0f172a'), '#0f172a');   // oq fonda qora
  assert.equal(aciHex(1, '#ffffff'), '#ff0000');
  assert.equal(aciHex(999, '#123456'), '#123456'); // noma'lum raqam — fon bo'yicha
});

test('normLayerName: bo\'shliqlar yig\'iladi, 255 belgigacha kesiladi', () => {
  assert.equal(normLayerName('  DEVOR   ichki '), 'DEVOR ichki');
  assert.equal(normLayerName(null), '');
  assert.equal(normLayerName('a'.repeat(300)).length, 255);
});

test('layerNameError: bo\'sh, taqiqlangan belgi, takror nom', () => {
  const list = [makeLayer('0'), makeLayer('DEVOR')];
  assert.equal(layerNameError('YANGI', list), '');
  assert.match(layerNameError('', list), /bo/);
  assert.match(layerNameError('a/b', list), /belgilari/);
  assert.match(layerNameError('a,b', list), /belgilari/);
  assert.match(layerNameError('devor', list), /bor/);           // katta-kichik harf farqsiz
  assert.equal(layerNameError('devor', list, 'DEVOR'), '');     // o'zini qayta nomlash
});

test('makeLayer: standart qiymatlar va noto\'g\'ri kiritishni tuzatish', () => {
  const l = makeLayer('TEST', { color: 'x', lt: 'YO\'Q', lw: 'a', on: false, frozen: 1 });
  assert.equal(l.color, 7);
  assert.equal(l.lt, 'CONTINUOUS');
  assert.equal(l.lw, LW_BYLAYER);
  assert.equal(l.on, false);
  assert.equal(l.frozen, true);
  assert.equal(l.plot, true);
});

test('defaultLayers: «0» birinchi, asosiy qatlam nomlanadi', () => {
  const L = defaultLayers('GUL');
  assert.equal(L[0].nomi, '0');
  assert.ok(findLayer(L, 'GUL'));
  assert.ok(findLayer(L, 'OFSET'));
  assert.equal(findLayer(L, 'YORDAMCHI').plot, false);
  assert.equal(findLayer(L, 'MARKAZ').lt, 'CENTER');
});

test('findLayer: katta-kichik harf farqsiz', () => {
  const L = defaultLayers('DETAL');
  assert.equal(findLayer(L, 'detal').nomi, 'DETAL');
  assert.equal(findLayer(L, 'yo\'q'), null);
});

test('sortLayers: «0» doim birinchi, qolgani tabiiy tartibda', () => {
  const L = [makeLayer('Q10'), makeLayer('Q2'), makeLayer('0'), makeLayer('A')];
  assert.deepEqual(sortLayers(L).map((l) => l.nomi), ['0', 'A', 'Q2', 'Q10']);
});

test('canDeleteLayer: «0», joriy va elementli qatlam o\'chirilmaydi', () => {
  const L = defaultLayers('DETAL');
  assert.match(canDeleteLayer(L, '0', [], 'DETAL'), /o/);
  assert.match(canDeleteLayer(L, 'DETAL', [], 'DETAL'), /Joriy/);
  assert.match(canDeleteLayer(L, 'MATN', ['MATN'], 'DETAL'), /elementlar/);
  assert.equal(canDeleteLayer(L, 'MATN', ['DETAL'], 'DETAL'), '');
  assert.match(canDeleteLayer(L, 'BORMAS', [], 'DETAL'), /yo/);
});

test('ltDash: uzluksiz — bo\'sh, punktir masshtabga ko\'payadi', () => {
  assert.equal(ltDash('CONTINUOUS', 1, 4), '');
  assert.equal(ltDash('HIDDEN', 1, 4), '24.00 12.00');
  assert.equal(ltDash('HIDDEN', 2, 4), '48.00 24.00');   // LTSCALE 2
  assert.equal(ltDash('HIDDEN', 1, 1), '6.00 3.00');
  assert.equal(ltDash('BORMAS', 1, 4), '');
});

test('ltDash: nuqta ham ko\'rinadi (0 emas)', () => {
  const d = ltDash('DOT', 1, 0.01).split(' ').map(Number);
  assert.ok(d.every((v) => v >= 0.35), 'har shtrix ko\'rinarli: ' + d.join(','));
});

test('lwPx: Default — 0.25 mm, zoomga bog\'liq emas', () => {
  assert.equal(lwLabel(LW_BYLAYER), 'Default (0.25 mm)');
  assert.equal(lwLabel(50), '0.50 mm');
  assert.ok(Math.abs(lwPx(LW_BYLAYER, 1) - (LW_DEFAULT / 100) * 3.8) < 1e-9);
  assert.ok(lwPx(200, 1) > lwPx(25, 1));
  assert.ok(lwPx(0, 1) >= 0.6);   // 0.00 mm ham ko'rinadi (eng ingichka)
});

test('darkenForWhite: sariq oq fonda qoraytiriladi, to\'q rang tegilmaydi', () => {
  assert.notEqual(darkenForWhite('#ffff00'), '#ffff00');
  assert.equal(darkenForWhite('#0000ff'), '#0000ff');
  assert.equal(darkenForWhite('nima'), 'nima');
});

test('resolveStyle: qatlam bo\'yicha va element ustunligi', () => {
  const L = defaultLayers('DETAL');
  const opts = { ink: '#ffffff', ltscale: 1, pxPerMm: 4, mainLayer: 'DETAL' };
  const s1 = resolveStyle({ type: 'pline', lay: 'MATN' }, L, opts);
  assert.equal(s1.color, '#00ff00');            // MATN — yashil (3)
  assert.equal(s1.dash, '');
  const s2 = resolveStyle({ type: 'pline', lay: 'MATN', col: 1 }, L, opts);
  assert.equal(s2.color, '#ff0000');            // element rangi ustun
  const s3 = resolveStyle({ type: 'pline', lay: 'DETAL', lt: 'HIDDEN' }, L, opts);
  assert.equal(s3.dash, '24.00 12.00');
  const s4 = resolveStyle({ type: 'pline', lay: 'MARKAZ' }, L, opts);
  assert.equal(s4.dash, ltDash('CENTER', 1, 4));
});

test('resolveStyle: qatlamsiz element asosiy qatlamga tushadi', () => {
  const L = defaultLayers('DETAL');
  const s = resolveStyle({ type: 'pline' }, L, { ink: '#fff', mainLayer: 'DETAL' });
  assert.equal(s.layer.nomi, 'DETAL');
  assert.equal(s.hidden, false);
});

test('resolveStyle: yo\'q qatlamdagi element ham chiziladi (asosiyga qaytadi)', () => {
  const L = defaultLayers('DETAL');
  const s = resolveStyle({ type: 'pline', lay: 'YO\'Q-QATLAM' }, L, { ink: '#fff', mainLayer: 'DETAL' });
  assert.equal(s.layer.nomi, 'DETAL');
});

test('resolveStyle: o\'chiq va muzlatilgan — hidden; qulflangan — locked', () => {
  const L = defaultLayers('DETAL');
  findLayer(L, 'MATN').on = false;
  findLayer(L, 'SHTRIX').frozen = true;
  findLayer(L, 'OLCHAM').locked = true;
  const o = { ink: '#fff', mainLayer: 'DETAL' };
  assert.equal(resolveStyle({ lay: 'MATN' }, L, o).hidden, true);
  assert.equal(resolveStyle({ lay: 'SHTRIX' }, L, o).hidden, true);
  assert.equal(resolveStyle({ lay: 'OLCHAM' }, L, o).hidden, false);
  assert.equal(resolveStyle({ lay: 'OLCHAM' }, L, o).locked, true);
});

test('resolveStyle: eksportda ACI 7 — siyoh rangi, yorug\' ranglar qoraytiriladi', () => {
  const L = defaultLayers('DETAL');
  const o = { ink: '#0f172a', mainLayer: 'DETAL', exportMode: true };
  assert.equal(resolveStyle({ lay: 'DETAL' }, L, o).color, '#0f172a');
  assert.notEqual(resolveStyle({ lay: 'OLCHAM' }, L, o).color, '#ffff00');
});

test('resolveStyle: qalinlik faqat LWDISPLAY yoqilganda', () => {
  const L = defaultLayers('DETAL');
  assert.equal(resolveStyle({ lay: 'DETAL' }, L, { mainLayer: 'DETAL' }).width, null);
  const w = resolveStyle({ lay: 'DETAL' }, L, { mainLayer: 'DETAL', lwOn: true, mult: 1 }).width;
  assert.ok(Math.abs(w - lwPx(50, 1)) < 1e-9);   // DETAL qatlami — 0.50 mm
});

test('usedLayerNames / migrateEnts: eski chizma asosiy qatlamga o\'tadi', () => {
  const ents = [{ type: 'pline' }, { type: 'circle', lay: 'MATN' }];
  assert.deepEqual(usedLayerNames(ents, 'DETAL').sort(), ['DETAL', 'MATN']);
  assert.equal(migrateEnts(ents, 'DETAL'), 1);
  assert.equal(ents[0].lay, 'DETAL');
  assert.equal(ents[1].lay, 'MATN');
  assert.equal(migrateEnts(ents, 'DETAL'), 0);   // ikkinchi marta hech narsa o'zgarmaydi
});

test('sanitizeLayers: buzuq yozuvlar tashlanadi, «0» va asosiy qatlam qoladi', () => {
  const L = sanitizeLayers([null, { nomi: '' }, { nomi: 'a/b' }, { nomi: 'DEVOR', color: 5 }, { nomi: 'devor' }], 'DETAL');
  assert.deepEqual(L.map((l) => l.nomi), ['0', 'DEVOR', 'DETAL']);
  assert.equal(findLayer(L, 'DEVOR').color, 5);
  assert.equal(sanitizeLayers(null, 'GUL').length, defaultLayers('GUL').length);
});

test('LT: har bir chiziq turi nomlangan va juft sonli naqshga ega', () => {
  for (const k of Object.keys(LT)) {
    assert.ok(LT[k].nomi, k + ' — nomi yo\'q');
    assert.equal(LT[k].pat.length % 2, 0, k + ' — naqsh juft bo\'lishi kerak');
  }
});
