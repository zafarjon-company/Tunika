// ============================================================
//  ISHCHI BOTI — testlar (node src/lib/ishchiBot.test.mjs)
// ------------------------------------------------------------
//  Tekshiriladi:
//   • server Toshkent vaqtida hisoblaydi (avans 1–5-kun qoidasi UTC'da buzilmasin);
//   • botdagi "Hozirgi haqqi" ilovadagi ishchiHisobi bilan bir xil;
//   • menyu, oy tugmalari chegaralari, HTML xavfsizligi;
//   • yo'qlama va avans/maosh xabari qarorlari (takrorlanmaslik).
// ============================================================
import {
  esc, oyNomi, keyingiOy, sanaHafta, holatNorm, oyDavomati, boshOy, oyTugmalari, menyuBolimi,
  hisobMatni, davomatMatni, oyAvanslari, avanslarMatni, maoshMatni, yoqlamaXabarMatni, tolovXabarMatni,
} from '../../api/_ishchiMatn.js';
import { yoqlamaQaror, tolovFarqi, ishchiTekshir, ishchiChatlari, xabarYoqilgan } from '../../api/_ishchiBot.js';
import { ishchiHisobi, oylikBalans, avansOyi, fmt } from './helpers.js';

let jami = 0;
let xato = 0;
function tekshir(nom, kutilgan, haqiqiy) {
  jami += 1;
  const ok = JSON.stringify(kutilgan) === JSON.stringify(haqiqiy);
  if (!ok) xato += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${nom}: ${JSON.stringify(haqiqiy)}${ok ? '' : `  (kutilgan: ${JSON.stringify(kutilgan)})`}`);
}
const bor = (nom, matn, qism) => tekshir(nom, true, String(matn).includes(qism));
const yoq = (nom, matn, qism) => tekshir(nom, false, String(matn).includes(qism));

// ---- Namuna ma'lumot ----
const ali = { id: 'ali1', name: 'Ali <Usta>', oylikHaqq: 3100000, phones: ['+998 (90) 123-45-67'] };
const yoqlama = {
  '2026-09-01': { ali1: 'keldi' }, '2026-09-02': { ali1: 'keldi' }, '2026-09-03': { ali1: 'kelmadi' },
  '2026-10-01': { ali1: 'keldi' }, '2026-10-02': { ali1: 'yarim' }, '2026-10-03': { ali1: 'kelmadi' },
  '2026-10-05': { ali1: 'keldi' },
};
const avanslar = {
  '2026-09': { ali1: [{ id: 'a1', method: "So'mda", amount: 100000, createdAt: '2026-09-10T09:00:00.000Z' }] },
  '2026-10': {
    ali1: [
      // 03.10 — o'tgan oy (sentabr) maoshidan
      { id: 'a2', method: "So'mda", amount: 50000, createdAt: '2026-10-03T07:00:00.000Z', notes: 'yo\'lkira' },
      // 05.10 20:30 UTC = 06.10 01:30 Toshkent → OKTABR maoshidan (UTC'da 5-kun bo'lib ketardi!)
      { id: 'a3', method: 'Dollorda', amount: 10, rate: 12800, createdAt: '2026-10-05T20:30:00.000Z' },
    ],
  },
};
const maoshlar = { '2026-09': { ali1: [{ id: 'm1', method: "So'mda", amount: 50000, createdAt: '2026-10-05T06:00:00.000Z' }] } };
const d = { yoqlama, avanslar, maoshlar };

console.log('\n=== 1) TOSHKENT VAQTI ===\n');
tekshir('process.env.TZ', 'Asia/Tashkent', process.env.TZ);
tekshir('05.10 20:30Z → oktabr maoshidan', '2026-10', avansOyi(avanslar['2026-10'].ali1[1], '2026-10'));
tekshir('03.10 07:00Z → sentabr maoshidan', '2026-09', avansOyi(avanslar['2026-10'].ali1[0], '2026-10'));
tekshir('sanaHafta 2026-10-08', '08.10.2026 (payshanba)', sanaHafta('2026-10-08'));

console.log('\n=== 2) YORDAMCHILAR ===\n');
tekshir('esc', 'Ali &lt;Usta&gt; &amp; Co', esc('Ali <Usta> & Co'));
tekshir('oyNomi', 'Oktabr 2026', oyNomi('2026-10'));
tekshir('keyingiOy dekabr → yanvar', '2027-01', keyingiOy('2026-12'));
tekshir("holatNorm yarim → keldi", 'keldi', holatNorm('yarim'));
tekshir('holatNorm bo\'sh → null', null, holatNorm(undefined));
tekshir('menyu tugmasi', 'hisob', menyuBolimi('💰 Hisobim'));
tekshir('menyu /davomat@bot', 'davomat', menyuBolimi('/davomat@TunikaBot'));
tekshir('menyu "avans"', 'avans', menyuBolimi('Avans'));
tekshir('menyu boshqa matn', null, menyuBolimi('salom'));
tekshir('boshOy (ma\'lumotdan)', '2026-09', boshOy(ali, d, '2026-10'));
tekshir('boshOy (ishgaKirgan)', '2026-08', boshOy({ ...ali, ishgaKirgan: '2026-08-15' }, d, '2026-10'));
const tug = oyTugmalari('d', '2026-10', '2026-09', '2026-10');
tekshir('oy tugmalari: faqat ◀', ['ib|d|2026-09'], tug.inline_keyboard[0].map((b) => b.callback_data));
tekshir('oy tugmalari: chegara ichida hech narsa', undefined, oyTugmalari('d', '2026-10', '2026-10', '2026-10'));

console.log('\n=== 3) DAVOMAT ===\n');
const dv = oyDavomati(ali, yoqlama, '2026-10', '2026-10-08');
tekshir('keldi kunlar', [1, 2, 5], dv.keldi);
tekshir('kelmadi kunlar', [3], dv.kelmadi);
tekshir('belgilanmagan (bugungacha)', [4, 6, 7, 8], dv.yoq);
const dm = davomatMatni(ali, yoqlama, '2026-10', '2026-10-08');
bor('davomat matni: keldi 3 kun', dm, 'Keldi — 3 kun');
bor('davomat: ishlangan = 3 × 100 000', dm, `${fmt(300000)} so'm`);

console.log('\n=== 4) HISOBIM — ilova bilan bir xil ===\n');
const h = ishchiHisobi(ali, yoqlama, avanslar, maoshlar);
const hm = hisobMatni(ali, d, '2026-10-08');
bor('Hozirgi haqqi = ishchiHisobi.haqqi', hm, `Hozirgi haqqingiz: ${fmt(Math.round(h.haqqi))} so'm`);
bor('ism HTML-xavfsiz', hm, 'Ali &lt;Usta&gt;');
yoq('xom "<Usta>" yo\'q', hm, '<Usta>');
const bo = oylikBalans(ali, yoqlama, avanslar, maoshlar, '2026-09');
bor('sentabr qoldig\'i ko\'rinadi', hm, `Qoldiq ${fmt(Math.round(bo.qoldiq))} so'm`);
bor('8-oktabr: "hali berilmagan"', hm, 'hali berilmagan');
bor('3-oktabr: "5-oktabrda beriladi"', hisobMatni(ali, d, '2026-10-03'), '5-oktabrda beriladi');

console.log('\n=== 5) AVANSLAR / MAOSH ===\n');
tekshir('sentabr maoshidan: a1 + a2', ['a1', 'a2'], oyAvanslari(ali, avanslar, '2026-09').map((p) => p.id));
tekshir('oktabr maoshidan: a3', ['a3'], oyAvanslari(ali, avanslar, '2026-10').map((p) => p.id));
const am = avanslarMatni(ali, avanslar, '2026-09');
bor('avans izohi', am, "yo'lkira");
bor('avans jami 150 000', am, `${fmt(150000)} so'm`);
bor('dollar avans', avanslarMatni(ali, avanslar, '2026-10'), '10 $');
bor('bo\'sh oy', avanslarMatni(ali, avanslar, '2026-08'), 'avans olinmagan');
const mm = maoshMatni(ali, d, '2026-09', '2026-10-08');
bor('maosh: oy yakuni', mm, `Oy yakuni: ${fmt(bo.yakun)} so'm`);
bor('maosh: berilgan', mm, `Berilgan maosh: ${fmt(50000)} so'm`);

console.log('\n=== 6) XABAR MATNLARI ===\n');
const yx = yoqlamaXabarMatni(ali, '2026-10-03', 'kelmadi', 'keldi', yoqlama);
bor('kelmadi xabari', yx, '<b>kelmadi</b> deb belgilandi');
bor('tuzatildi (avval keldi)', yx, 'avval: Keldi ✅');
yoq('birinchi belgi — tuzatildi yo\'q', yoqlamaXabarMatni(ali, '2026-10-01', 'keldi', null, yoqlama), 'Tuzatildi');
const tx = tolovXabarMatni('avans', ali, d, '2026-10', [avanslar['2026-10'].ali1[1]], []);
bor('avans xabari: oktabr maoshidan', tx, 'Oktabr 2026 maoshidan ushlanadi');
bor('avans xabari: hozirgi haqqi', tx, `Hozirgi haqqingiz: <b>${fmt(Math.round(h.haqqi))} so'm</b>`);
const bx = tolovXabarMatni('maosh', ali, d, '2026-09', [], [{ s: 50000, d: '2026-10-05T06:00:00.000Z' }]);
bor('maosh bekor xabari', bx, 'Maosh yozuvi bekor qilindi — Sentabr 2026');

console.log('\n=== 7) YO\'QLAMA QARORI ===\n');
const now = 1_800_000_000_000;
tekshir('o\'zgarmagan', 'yoq', yoqlamaQaror({ holat: 'keldi', old: { h: 'keldi' }, now, chatsBor: true, faol: true }).tur);
tekshir('birinchi belgi → yangi', { tur: 'yangi', avval: null }, yoqlamaQaror({ holat: 'keldi', old: null, now, chatsBor: true, faol: true }));
tekshir('ulanmagan → jim', 'jim', yoqlamaQaror({ holat: 'keldi', old: null, now, chatsBor: false, faol: true }).tur);
tekshir('xabarsiz belgi olib tashlandi → jim', 'jim', yoqlamaQaror({ holat: null, old: { h: 'keldi', x: 0 }, now, chatsBor: true, faol: true }).tur);
tekshir('xabarli belgi olib tashlandi → yangi', 'yangi', yoqlamaQaror({ holat: null, old: { h: 'keldi', x: 1 }, now, chatsBor: true, faol: true }).tur);
tekshir('1 daqiqada qayta → tahrir (avval = oldingisi)', { tur: 'tahrir', avval: null },
  yoqlamaQaror({ holat: 'kelmadi', old: { h: 'keldi', x: 1, p: '', t: now - 60000, mids: { 5: 9 } }, now, chatsBor: true, faol: true }));
tekshir('10 daqiqadan keyin → yangi (avval: keldi)', { tur: 'yangi', avval: 'keldi' },
  yoqlamaQaror({ holat: 'kelmadi', old: { h: 'keldi', x: 1, t: now - 600000, mids: { 5: 9 } }, now, chatsBor: true, faol: true }));
tekshir('kamera (mids yo\'q) → yangi', 'yangi',
  yoqlamaQaror({ holat: 'kelmadi', old: { h: 'keldi', x: 1, t: now - 1000 }, now, chatsBor: true, faol: true }).tur);
tekshir('faol emas → jim', 'jim', yoqlamaQaror({ holat: 'keldi', old: null, now, chatsBor: true, faol: false }).tur);

console.log('\n=== 8) AVANS / MAOSH FARQI ===\n');
const list = [{ id: 'x1', method: "So'mda", amount: 100 }, { id: 'x2', method: "So'mda", amount: 200 }];
let f = tolovFarqi(list, null, ['x2'], true);
tekshir('birinchi marta: faqat ishora qilingan', ['x2'], f.yangilar.map((p) => p.id));
tekshir('eski yozuv jim yoziladi', { s: 100, d: '', x: 0 }, f.qosh.x1);
f = tolovFarqi(list, { e: { x1: { s: 100, x: 0 } } }, [], true);
tekshir('jurnal bor: ishorasiz ham yuboriladi', ['x2'], f.yangilar.map((p) => p.id));
f = tolovFarqi([list[1]], { e: { x1: { s: 100, x: 1, d: '2026-10-01' }, x2: { s: 200, x: 1 } } }, [], true);
tekshir('o\'chirilgan → bekor', [{ s: 100, x: 1, d: '2026-10-01' }], f.bekorlar);
tekshir('o\'chirilgan → jurnaldan', ['x1'], f.ochir);
f = tolovFarqi([], { e: { x1: { s: 100, x: 0 } } }, [], true);
tekshir('xabarsiz yozuv o\'chdi → bekor xabari yo\'q', [], f.bekorlar);
f = tolovFarqi(list, { e: {} }, [], false);
tekshir('ulanmagan → xabar yo\'q, jim yoziladi', [[], 0], [f.yangilar, f.qosh.x1.x]);

console.log('\n=== 9) ULANISH TEKSHIRUVI ===\n');
const links = {
  111: { ishchiId: 'ali1', phone: '901234567' },
  222: { ishchiId: 'ali1', phone: '935555555' }, // raqam kartochkadan olib tashlangan
  333: { ishchiId: 'yoq' },
};
tekshir('to\'g\'ri raqam → ishchi', 'ali1', ishchiTekshir(links[111], [ali])?.id);
tekshir('raqam olib tashlangan → yopiq', null, ishchiTekshir(links[222], [ali]));
tekshir('ishchiChatlari', ['111'], ishchiChatlari(links, [ali], 'ali1'));
tekshir('xabar sozlamasi sukut — yoqilgan', true, xabarYoqilgan({}, 'avans'));
tekshir('xabar sozlamasi o\'chirilgan', false, xabarYoqilgan({ ishchiXabar: { maosh: false } }, 'maosh'));

console.log(`\n${xato ? '❌' : '✅'} ${jami - xato}/${jami} test o'tdi\n`);
if (xato) process.exit(1);
