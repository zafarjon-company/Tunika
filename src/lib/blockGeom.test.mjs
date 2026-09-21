// node --test src/lib/blockGeom.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  xform, insMap, mapEntCopy, explodeIns, makeBlockDef, blockNameError, normBlockName,
  findBlock, blockUses, usedBlockNames, applyInsLayer, BLOCK_MAX_DEPTH,
} from './blockGeom.js';

const near = (a, b, t = 1e-6) => assert.ok(Math.abs(a - b) < t, a + ' ≈ ' + b);
const REC = { type: 'pline', pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: -5 }, { x: 0, y: -5 }], closed: true, lay: '0' };
const BLK = { nomi: 'ESHIK', ents: [REC, { type: 'circle', cx: 5, cy: -2, r: 1, lay: 'MATN' }], izoh: '' };

test('xform: masshtabsiz/burilishsiz — faqat ko\'chirish', () => {
  const f = xform({ x: 100, y: 50, sc: 1, rot: 0 });
  assert.deepEqual(f({ x: 10, y: -5 }), { x: 110, y: 45 });
});

test('xform: 90° burilish — o\'ng TEPAGA (y pastga konvensiyasi)', () => {
  const f = xform({ x: 0, y: 0, sc: 1, rot: 90 });
  const p = f({ x: 1, y: 0 });
  near(p.x, 0); near(p.y, -1);
});

test('xform: masshtab burilishdan keyin qo\'llanadi', () => {
  const f = xform({ x: 0, y: 0, sc: 2, rot: 180 });
  const p = f({ x: 3, y: 0 });
  near(p.x, -6); near(p.y, 0);
});

test('xform: noto\'g\'ri sc/x/y — xavfsiz standart', () => {
  const f = xform({ x: undefined, y: null, sc: 0, rot: undefined });
  assert.deepEqual(f({ x: 4, y: 7 }), { x: 4, y: 7 });
});

test('mapEntCopy: manbani O\'ZGARTIRMAYDI (blok ta\'rifi buzilmasin)', () => {
  const src = JSON.parse(JSON.stringify(REC));
  const copy = mapEntCopy(src, (p) => ({ x: p.x + 100, y: p.y }), null);
  assert.deepEqual(src.pts[1], { x: 10, y: 0 }, 'manba tegilmagan');
  assert.deepEqual(copy.pts[1], { x: 110, y: 0 });
  assert.notEqual(copy, src);
});

test('mapEntCopy: aylana radiusi rFactor bilan', () => {
  const c = mapEntCopy({ type: 'circle', cx: 0, cy: 0, r: 5 }, (p) => ({ x: p.x * 3, y: p.y * 3 }), 3);
  near(c.r, 15);
});

test('mapEntCopy: nuqta, xline va matn turlari', () => {
  const f = (p) => ({ x: p.x + 10, y: p.y - 4 });
  assert.deepEqual(mapEntCopy({ type: 'point', x: 1, y: 2 }, f), { type: 'point', x: 11, y: -2 });
  const xl = mapEntCopy({ type: 'xline', x: 0, y: 0, ang: 0 }, xform({ x: 0, y: 0, sc: 1, rot: 90 }));
  near(xl.ang, 90);
  const t = mapEntCopy({ type: 'text', x: 0, y: 0, h: 10, rot: 0, text: 'AB' }, f, null, () => 12);
  near(t.x, 10); near(t.y, -4);
});

test('mapEntCopy: ichma-ich blok nusxasi — burchak va masshtab qo\'shiladi', () => {
  const inner = { type: 'ins', bn: 'A', x: 1, y: 0, sc: 2, rot: 30 };
  const c = mapEntCopy(inner, xform({ x: 0, y: 0, sc: 3, rot: 60 }), 3);
  near(c.rot, 90);
  near(c.sc, 6);
  near(Math.hypot(c.x, c.y), 3);
});

test('insMap: aks ettirishda burchak ayiriladi va mir almashadi', () => {
  const c = insMap({ type: 'ins', bn: 'A', x: 0, y: 0, sc: 1, rot: 30 }, (p) => ({ x: -p.x, y: p.y }));
  near(c.rot, 330);
  assert.equal(c.mir, true);
  const c2 = insMap({ type: 'ins', bn: 'A', x: 0, y: 0, sc: 1, rot: 30, mir: true }, (p) => ({ x: -p.x, y: p.y }));
  assert.equal(c2.mir, false);
});

test('xform + mir: aks ettirilgan blok haqiqatan ko\'zguda (masshtab musbat qoladi)', () => {
  const f = xform({ x: 0, y: 0, sc: 1, rot: 0, mir: true });
  assert.deepEqual(f({ x: 3, y: 4 }), { x: -3, y: 4 });
  const g = xform({ x: 0, y: 0, sc: 2, rot: 0, mir: false });
  assert.deepEqual(g({ x: 3, y: 4 }), { x: 6, y: 8 });
  const h = xform({ x: 0, y: 0, sc: -2, rot: 0 });   // manfiy masshtab — modul olinadi
  assert.deepEqual(h({ x: 3, y: 4 }), { x: 6, y: 8 });
});

test('aks ettirilgan blok: ikki marta aks — asl holat', () => {
  const ins = { type: 'ins', bn: 'ESHIK', x: 0, y: 0, sc: 1, rot: 0 };
  const flip = (p) => ({ x: -p.x, y: p.y });
  const once = explodeIns(insMap(JSON.parse(JSON.stringify(ins)), flip), [BLK]);
  near(once[0].pts[1].x, -10);
  const twice = explodeIns(insMap(insMap(JSON.parse(JSON.stringify(ins)), flip), flip), [BLK]);
  near(twice[0].pts[1].x, 10);
});

test('explodeIns: nusxa elementlarga yoyiladi, ta\'rif tegilmaydi', () => {
  const ins = { type: 'ins', bn: 'ESHIK', x: 100, y: 100, sc: 1, rot: 0 };
  const parts = explodeIns(ins, [BLK]);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts[0].pts[0], { x: 100, y: 100 });
  near(parts[1].cx, 105); near(parts[1].cy, 98);
  assert.deepEqual(BLK.ents[0].pts[0], { x: 0, y: 0 }, "ta'rif o'zgarmadi");
});

test('explodeIns: masshtab radiusni ham o\'zgartiradi', () => {
  const parts = explodeIns({ type: 'ins', bn: 'ESHIK', x: 0, y: 0, sc: 4, rot: 0 }, [BLK]);
  near(parts[1].r, 4);
  near(parts[0].pts[1].x, 40);
});

test('explodeIns: yo\'q blok yoki bo\'sh ta\'rif — bo\'sh massiv', () => {
  assert.deepEqual(explodeIns({ type: 'ins', bn: 'YO\'Q' }, [BLK]), []);
  assert.deepEqual(explodeIns({ type: 'ins', bn: 'X' }, [{ nomi: 'X', ents: [] }]), []);
  assert.deepEqual(explodeIns(null, [BLK]), []);
});

test('explodeIns: ichma-ich blok yoyiladi', () => {
  const blocks = [BLK, { nomi: 'ESHIK2', ents: [{ type: 'ins', bn: 'ESHIK', x: 0, y: 0, sc: 1, rot: 0 }, { type: 'point', x: 1, y: 1 }] }];
  const parts = explodeIns({ type: 'ins', bn: 'ESHIK2', x: 0, y: 0, sc: 1, rot: 0 }, blocks);
  assert.equal(parts.length, 3);
});

test('explodeIns: o\'z-o\'ziga havola cheksiz halqa bermaydi', () => {
  const blocks = [{ nomi: 'A', ents: [{ type: 'ins', bn: 'A', x: 0, y: 0, sc: 1, rot: 0 }, { type: 'point', x: 0, y: 0 }] }];
  const parts = explodeIns({ type: 'ins', bn: 'A', x: 0, y: 0, sc: 1, rot: 0 }, blocks);
  assert.ok(parts.length <= BLOCK_MAX_DEPTH + 2, 'chuqurlik cheklangan: ' + parts.length);
});

test('makeBlockDef: tayanch nuqta yangi (0,0), id lar olib tashlanadi', () => {
  const def = makeBlockDef('YANGI', [{ id: 7, type: 'circle', cx: 50, cy: 20, r: 3 }], 50, 20);
  assert.equal(def.nomi, 'YANGI');
  assert.equal(def.ents[0].id, undefined);
  assert.deepEqual([def.ents[0].cx, def.ents[0].cy], [0, 0]);
});

test('makeBlockDef: manba elementlar o\'zgarmaydi', () => {
  const src = { id: 1, type: 'pline', pts: [{ x: 5, y: 5 }], closed: false };
  makeBlockDef('B', [src], 5, 5);
  assert.deepEqual(src.pts[0], { x: 5, y: 5 });
  assert.equal(src.id, 1);
});

test('blockNameError: bo\'sh, taqiqlangan belgi, takror', () => {
  const list = [{ nomi: 'ESHIK', ents: [] }];
  assert.equal(blockNameError('DERAZA', list), '');
  assert.match(blockNameError('', list), /bo/);
  assert.match(blockNameError('a/b', list), /belgilari/);
  assert.match(blockNameError('eshik', list), /bor/);
  assert.equal(blockNameError('eshik', list, 'ESHIK'), '');
  assert.equal(normBlockName('  M12   BOLT '), 'M12 BOLT');
});

test('findBlock: katta-kichik harf farqsiz', () => {
  assert.equal(findBlock([BLK], 'eshik').nomi, 'ESHIK');
  assert.equal(findBlock([BLK], 'yo\'q'), null);
  assert.equal(findBlock(null, 'x'), null);
});

test('blockUses: halqani aniqlaydi', () => {
  const blocks = [{ nomi: 'A', ents: [{ type: 'ins', bn: 'B' }] }, { nomi: 'B', ents: [{ type: 'ins', bn: 'C' }] }, { nomi: 'C', ents: [] }];
  assert.equal(blockUses(blocks, 'A', 'C'), true);
  assert.equal(blockUses(blocks, 'C', 'A'), false);
});

test('usedBlockNames: ichma-ich bloklar ham sanaladi', () => {
  const blocks = [{ nomi: 'A', ents: [{ type: 'ins', bn: 'B' }] }, { nomi: 'B', ents: [] }, { nomi: 'C', ents: [] }];
  const used = usedBlockNames([{ type: 'ins', bn: 'A' }, { type: 'point', x: 0, y: 0 }], blocks);
  assert.deepEqual(used.sort(), ['a', 'b']);
});

test('applyInsLayer: «0» qatlami nusxa qatlamiga tushadi, boshqasi qoladi', () => {
  const parts = applyInsLayer([{ lay: '0' }, { lay: 'MATN' }, {}], { lay: 'DEVOR' }, 'DETAL');
  assert.deepEqual(parts.map((p) => p.lay), ['DEVOR', 'MATN', 'DEVOR']);
  const p2 = applyInsLayer([{ lay: '0' }], {}, 'DETAL');
  assert.equal(p2[0].lay, 'DETAL');
});
