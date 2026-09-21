// node --test src/lib/overkillGeom.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { overkill, sameGeom, overkillable, OVERKILL_TOL } from './overkillGeom.js';

const pl = (id, pts, closed, lay) => ({ id, type: 'pline', pts: pts.map(([x, y]) => ({ x, y })), closed: !!closed, lay: lay || 'DETAL' });
const SQ = [[0, 0], [100, 0], [100, 100], [0, 100]];

test('overkill: aynan bir xil ikki chiziq — ikkinchisi o\'chadi', () => {
  const r = overkill([pl(1, SQ, true), pl(2, SQ, true)]);
  assert.deepEqual(r.remove, [2]);
  assert.deepEqual(r.add, []);
});

test('overkill: birinchisi saqlanadi (keyingilari o\'chadi)', () => {
  const r = overkill([pl(5, SQ, true), pl(6, SQ, true), pl(7, SQ, true)]);
  assert.deepEqual(r.remove, [6, 7]);
  assert.equal(r.kept, 1);
});

test('overkill: teskari yo\'nalishdagi nusxa ham dublikat', () => {
  const r = overkill([pl(1, SQ, false), pl(2, SQ.slice().reverse(), false)]);
  assert.deepEqual(r.remove, [2]);
});

test('overkill: yopiq kontur boshqa tugundan boshlansa ham dublikat', () => {
  const rot = SQ.slice(2).concat(SQ.slice(0, 2));
  const r = overkill([pl(1, SQ, true), pl(2, rot, true)]);
  assert.deepEqual(r.remove, [2]);
});

test('overkill: yopiq kontur teskari va siljigan — dublikat', () => {
  const rot = SQ.slice(1).concat(SQ.slice(0, 1)).reverse();
  const r = overkill([pl(1, SQ, true), pl(2, rot, true)]);
  assert.deepEqual(r.remove, [2]);
});

test('overkill: chegaradan (tol) uzoq chiziq dublikat emas', () => {
  const far = SQ.map(([x, y]) => [x + 0.5, y]);
  assert.deepEqual(overkill([pl(1, SQ, true), pl(2, far, true)]).remove, []);
  const close = SQ.map(([x, y]) => [x + 0.02, y]);
  assert.deepEqual(overkill([pl(1, SQ, true), pl(2, close, true)]).remove, [2]);
});

test('overkill: chelak chegarasida ham topiladi (yaxlitlash tuzog\'i)', () => {
  const cell = OVERKILL_TOL * 4;
  const base = [[cell, 0], [cell + 50, 0], [cell + 50, 50]];
  const shifted = base.map(([x, y]) => [x - OVERKILL_TOL * 0.9, y]);
  assert.deepEqual(overkill([pl(1, base, false), pl(2, shifted, false)]).remove, [2]);
});

test('overkill: turli qatlam — dublikat emas (ignoreLay bilan — dublikat)', () => {
  const a = pl(1, SQ, true, 'DETAL'), b = pl(2, SQ, true, 'MATN');
  assert.deepEqual(overkill([a, b]).remove, []);
  assert.deepEqual(overkill([a, b], { ignoreLay: true }).remove, [2]);
});

test('overkill: turli tugun soni yoki yopiqligi — dublikat emas', () => {
  assert.deepEqual(overkill([pl(1, SQ, true), pl(2, SQ.concat([[50, 50]]), true)]).remove, []);
  assert.deepEqual(overkill([pl(1, SQ, true), pl(2, SQ, false)]).remove, []);
});

test('overkill: aylana, yoy, nuqta, matn', () => {
  const c1 = { id: 1, type: 'circle', cx: 0, cy: 0, r: 10, lay: 'A' };
  const c2 = { id: 2, type: 'circle', cx: 0.01, cy: 0, r: 10, lay: 'A' };
  const c3 = { id: 3, type: 'circle', cx: 0, cy: 0, r: 12, lay: 'A' };
  assert.deepEqual(overkill([c1, c2, c3]).remove, [2]);
  const a1 = { id: 4, type: 'arc', cx: 0, cy: 0, r: 50, a0: 0, a1: 90, lay: 'A' };
  const a2 = { id: 5, type: 'arc', cx: 0, cy: 0, r: 50, a0: 0, a1: 90, lay: 'A' };
  const a3 = { id: 6, type: 'arc', cx: 0, cy: 0, r: 50, a0: 0, a1: 180, lay: 'A' };
  assert.deepEqual(overkill([a1, a2, a3]).remove, [5]);
  const p1 = { id: 7, type: 'point', x: 5, y: 5, lay: 'A' }, p2 = { id: 8, type: 'point', x: 5, y: 5, lay: 'A' };
  assert.deepEqual(overkill([p1, p2]).remove, [8]);
  const t1 = { id: 9, type: 'text', x: 0, y: 0, h: 10, rot: 0, text: 'AB', lay: 'A' };
  const t2 = { id: 10, type: 'text', x: 0, y: 0, h: 10, rot: 0, text: 'AB', lay: 'A' };
  const t3 = { id: 11, type: 'text', x: 0, y: 0, h: 10, rot: 0, text: 'CD', lay: 'A' };
  assert.deepEqual(overkill([t1, t2, t3]).remove, [10]);
});

test('overkill: shtrix, o\'lcham va blok nusxasi tegilmaydi', () => {
  const h = { id: 1, type: 'hatch', loops: [[{ x: 0, y: 0 }]], lay: 'A' };
  const d = { id: 2, type: 'dim', x1: 0, y1: 0, x2: 1, y2: 0, off: 5, lay: 'A' };
  const i = { id: 3, type: 'ins', bn: 'A', x: 0, y: 0, lay: 'A' };
  assert.equal(overkillable(h), false);
  assert.deepEqual(overkill([h, JSON.parse(JSON.stringify(h)), d, i]).remove, []);
});

test('overkill: bo\'sh yoki noto\'g\'ri kirish — xavfsiz', () => {
  assert.deepEqual(overkill(null).remove, []);
  assert.deepEqual(overkill([null, undefined, {}]).remove, []);
});

test('sameGeom: turli tur — false', () => {
  assert.equal(sameGeom({ type: 'circle' }, { type: 'arc' }, 0.05), false);
  assert.equal(sameGeom(null, null, 0.05), false);
});

test('overkill: katta chizmada ham tez (500 element)', () => {
  const list = [];
  for (let i = 0; i < 250; i++) { list.push(pl(i * 2 + 1, [[i * 10, 0], [i * 10 + 5, 0]], false)); list.push(pl(i * 2 + 2, [[i * 10, 0], [i * 10 + 5, 0]], false)); }
  const r = overkill(list);
  assert.equal(r.remove.length, 250);
});
