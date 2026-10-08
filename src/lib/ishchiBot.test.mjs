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
import {
  yoqlamaQaror, tolovFarqi, ishchiTekshir, ishchiChatlari, xabarYoqilgan, izohKorinsin, tolovRoyxati, sanaQosh,
  oyQosh, aytilganHolat,
} from '../../api/_ishchiBot.js';
import { oyChegarasi, yoqlamaJamlanmaMatni } from '../../api/_ishchiMatn.js';
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
yoq('avans izohi SUKUT bo\'yicha yashirin', am, "yo'lkira");
bor('izoh yoqilsa ko\'rinadi', avanslarMatni(ali, avanslar, '2026-09', { izoh: true }), "yo'lkira");
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
const q = (a) => { const r = yoqlamaQaror({ chatsBor: true, faol: true, now, ...a }); return r.tur === 'yangi' ? { tur: r.tur, avval: r.avval } : r.tur; };
tekshir('o\'zgarmagan', 'yoq', q({ holat: 'keldi', old: { h: 'keldi' } }));
tekshir('birinchi belgi → yangi', { tur: 'yangi', avval: null }, q({ holat: 'keldi', old: null }));
tekshir('ulanmagan → jim', 'jim', q({ holat: 'keldi', old: null, chatsBor: false }));
tekshir('xabarsiz belgi olib tashlandi → jim', 'jim', q({ holat: null, old: { h: 'keldi', x: 0 } }));
tekshir('xabarli belgi olib tashlandi → yangi', { tur: 'yangi', avval: 'keldi' }, q({ holat: null, old: { h: 'keldi', x: 1 } }));
tekshir('1 daqiqada tuzatish ham → YANGI push (jim tahrir emas)', { tur: 'yangi', avval: 'keldi' },
  q({ holat: 'kelmadi', old: { h: 'keldi', x: 1, t: now - 60000 } }));
tekshir('aytilmagan holat avval deb yozilmaydi', { tur: 'yangi', avval: null }, q({ holat: 'kelmadi', old: { h: 'keldi', x: 0 } }));
tekshir('faol emas → jim', 'jim', q({ holat: 'keldi', old: null, faol: false }));
// a — oxirgi AYTILGAN holat (jim o'zgarishlar uni o'zgartirmaydi)
tekshir('jim o\'zgargan holat "avval" bo\'lmaydi (a=keldi)', { tur: 'yangi', avval: 'keldi' },
  q({ holat: null, old: { h: 'kelmadi', a: 'keldi', x: 1 } }));
tekshir('ishchi allaqachon biladi (holat === a) → jim', 'jim', q({ holat: 'keldi', old: { h: 'kelmadi', a: 'keldi', x: 1 } }));
tekshir('hech narsa aytilmagan, belgi olib tashlandi → jim', 'jim', q({ holat: null, old: { h: 'kelmadi', a: '', x: 0 } }));
// b — "yuborilmoqda" belgisi
tekshir('boshqa so\'rov hozir yubormoqda → band', 'band', q({ holat: 'keldi', old: { h: 'keldi', a: 'keldi', x: 1, b: now - 5000, pa: '' } }));
tekshir('eskirgan band (funksiya to\'xtagan) → qayta yuboriladi', { tur: 'yangi', avval: null },
  q({ holat: 'keldi', old: { h: 'keldi', a: 'keldi', x: 1, b: now - 10 * 60000, pa: '' } }));
tekshir('eskirgan band, avvalgi aytilgan saqlanadi', { tur: 'yangi', avval: 'kelmadi' },
  q({ holat: 'keldi', old: { h: 'keldi', a: 'keldi', x: 1, b: now - 10 * 60000, pa: 'kelmadi' } }));
tekshir('aytilganHolat — eski yozuv (a yo\'q, x:1)', 'keldi', aytilganHolat({ h: 'keldi', x: 1 }));

console.log('\n=== 8) AVANS / MAOSH FARQI ===\n');
const DEL = '__DEL__';
const list = [{ id: 'x1', method: "So'mda", amount: 100 }, { id: 'x2', method: "So'mda", amount: 200 }];
const tf = (lst, yozuv, ishora, yub = true, yaq = () => false) => tolovFarqi(lst, yozuv, ishora, yub, yaq, now, DEL);
let f = tf(list, null, ['x2']);
tekshir('birinchi marta: faqat ishora qilingan', ['x2'], f.yangilar.map((p) => p.id));
tekshir('eski yozuv jim yoziladi', { s: 100, d: '', x: 0 }, f.qosh.x1);
tekshir('e\'lon qilinayotgan yozuv "band" belgisi bilan', { s: 200, d: '', x: 1, b: now }, f.qosh.x2);
f = tf(list, { e: { x1: { s: 100, x: 0 } } }, []);
tekshir('jurnal bor: ishorasiz ham yuboriladi', ['x2'], f.yangilar.map((p) => p.id));
f = tf([list[1]], { e: { x1: { s: 100, x: 1, d: '2026-10-01' }, x2: { s: 200, x: 1 } } }, []);
tekshir('o\'chirilgan → bekor', [{ id: 'x1', s: 100, d: '2026-10-01', x: 1 }], f.bekorlar);
tekshir('bekor — darhol o\'chirilmaydi, "o" belgisi bilan band', [[], { o: now }], [f.ochir, f.qosh.x1]);
f = tf([], { e: { x1: { s: 100, x: 0 } } }, []);
tekshir('xabarsiz yozuv o\'chdi → bekor xabari yo\'q, jurnaldan o\'chadi', [[], ['x1']], [f.bekorlar, f.ochir]);
f = tf(list, { e: {} }, [], false);
tekshir('ulanmagan → xabar yo\'q, jim yoziladi', [[], 0], [f.yangilar, f.qosh.x1.x]);
f = tf(list, { e: { x1: { s: 100, x: 1, b: now - 3000 }, x2: { s: 200, x: 1 } } }, []);
tekshir('boshqa so\'rov e\'lon qilmoqda → band', [true, []], [f.band, f.yangilar]);
f = tf(list, { e: { x1: { s: 100, x: 1, b: now - 10 * 60000 }, x2: { s: 200, x: 1 } } }, []);
tekshir('eskirgan "e\'lon qilinmoqda" → qayta e\'lon', ['x1'], f.yangilar.map((p) => p.id));
f = tf([list[1]], { e: { x1: { s: 100, x: 1, o: now - 10 * 60000 }, x2: { s: 200, x: 1 } } }, []);
tekshir('eskirgan "bekor qilinmoqda" → qayta bekor', ['x1'], f.bekorlar.map((b) => b.id));
f = tf([list[1]], { e: { x1: { s: 100, x: 1, o: now - 3000 }, x2: { s: 200, x: 1 } } }, []);
tekshir('bekor qilinmoqda (yangi) → band', true, f.band);
f = tf(list, { e: { x1: { s: 100, x: 1, o: now - 3000 }, x2: { s: 200, x: 1 } } }, []);
tekshir('o\'chirilgan yozuv qaytdi → bekor to\'xtaydi', { o: DEL }, f.qosh.x1);

f = tf(list, null, [], true, (p) => p.id === 'x1');
tekshir('jurnal yo\'q + yaqinda qilingan → e\'lon (yo\'qolgan signal tiklanadi)', ['x1'], f.yangilar.map((p) => p.id));
tekshir('eski sonli avans va "eski" id — hech qachon e\'lon qilinmaydi', ['n1'],
  tolovRoyxati({ '2026-03': { ali1: [{ id: 'eski', amount: 450000 }, { id: 'n1', amount: 5 }] } }, '2026-03', 'ali1').map((p) => p.id));
tekshir('sonli katak — bo\'sh ro\'yxat', [], tolovRoyxati({ '2026-03': { ali1: 450000 } }, '2026-03', 'ali1'));
tekshir('oyQosh: 12 oy oldin', '2025-10', oyQosh('2026-10', -12));
tekshir('oyQosh: yil chegarasi', '2027-01', oyQosh('2026-12', 1));

console.log('\n=== 8b) YANGI QOIDALAR ===\n');
tekshir('sanaQosh oy chegarasi', '2026-09-30', sanaQosh('2026-10-01', -1));
tekshir('sanaQosh kabisa', '2028-02-29', sanaQosh('2028-03-01', -1));
tekshir('izoh sukut — yashirin', false, izohKorinsin({}));
tekshir('izoh yoqilgan', true, izohKorinsin({ ishchiXabar: { izoh: true } }));
// 1-oktabrda ishga kirgan, 3-oktabrda avans oldi → avans SENTABR maoshidan; Sentabr ham ochilsin
const yangiIshchi = { id: 'v1', name: 'Vali', oylikHaqq: 3100000, ishgaKirgan: '2026-10-01', phones: [] };
const avYangi = { '2026-10': { v1: [{ id: 'q1', method: "So'mda", amount: 300000, createdAt: '2026-10-03T07:00:00.000Z' }] } };
tekshir('oyChegarasi: 1–5-kun avansi oyi ham kiradi', { min: '2026-09', max: '2026-10' },
  oyChegarasi(yangiIshchi, { yoqlama: {}, avanslar: avYangi, maoshlar: {} }, '2026-10'));
tekshir('oyChegarasi: ishgaKirgan\'dan oldingi tarix ham', '2026-08',
  oyChegarasi({ ...ali, ishgaKirgan: '2026-10-01' }, { yoqlama: { '2026-08-20': { ali1: 'keldi' } }, avanslar: {}, maoshlar: {} }, '2026-10').min);
// Hisobim: shu oy uchun berilgan maosh ko'rinadi; o'tgan oy manfiy qoldiq yashirinmaydi
const dMaosh = { yoqlama, avanslar, maoshlar: { ...maoshlar, '2026-10': { ali1: [{ id: 'm9', method: "So'mda", amount: 70000, createdAt: '2026-10-07T06:00:00.000Z' }] } } };
bor('Hisobim: shu oy berilgan maosh qatori', hisobMatni(ali, dMaosh, '2026-10-08'), `Berilgan maosh: ${fmt(70000)} so'm`);
const dManfiy = {
  yoqlama: { '2026-09-01': { ali1: 'keldi' } },
  avanslar: { '2026-10': { ali1: [{ id: 'z1', method: "So'mda", amount: 500000, createdAt: '2026-10-05T12:00:00.000Z' }] } },
  maoshlar: { '2026-09': { ali1: [{ id: 'z2', method: "So'mda", amount: 100000, createdAt: '2026-10-05T05:00:00.000Z' }] } },
};
const hm2 = hisobMatni(ali, dManfiy, '2026-10-08');
bor('o\'tgan oy manfiy qoldiq ko\'rinadi', hm2, 'ortiqcha olingan');
yoq('manfiyda "To\'liq berilgan" yo\'q', hm2, 'To\'liq berilgan');
// Ko'p kunlik yig'ma xabar
const jm = yoqlamaJamlanmaMatni(ali, [
  { sana: '2026-10-01', holat: 'keldi', avval: null },
  { sana: '2026-10-03', holat: 'kelmadi', avval: 'keldi' },
], yoqlama);
bor('yig\'ma: sarlavha 2 kun', jm, 'Yo\'qlama yangilandi — 2 kun');
bor('yig\'ma: tuzatish belgisi', jm, 'avval: Keldi');
bor('yig\'ma: oy yig\'indisi', jm, 'Oktabr 2026: ✅');

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
