// ============================================================
//  SOTUVCHILAR (chekdagi ism + raqamlar) — SINOV
//  Ishga tushirish:  npm run test:sotuvchi   (node src/lib/sotuvchi.test.mjs)
// ============================================================
import {
  sotuvchilarOl, sotuvchilarSatr, sotuvchiQatori, sotuvchilarMatn, telHref,
  sotuvchiKalit, sotuvchiBormi, sotuvchilarTartib, tanlanganSotuvchi,
} from './sotuvchi.js';

let xato = 0;
let jami = 0;
function tekshir(nom, kutilgan, olingan) {
  jami += 1;
  const a = JSON.stringify(kutilgan);
  const b = JSON.stringify(olingan);
  const ok = a === b;
  if (!ok) xato += 1;
  console.log(`${ok ? '  ✅' : '  ❌'} ${nom}: ${b}${ok ? '' : `  (kutilgan: ${a})`}`);
}
const soddala = (l) => l.map(({ ism, tel }) => ({ ism, tel }));

console.log('\n=== sotuvchilarOl — eski satr ===\n');
tekshir("bo'sh satr", [], sotuvchilarOl(''));
tekshir('null / undefined', [], sotuvchilarOl(undefined));
tekshir('obyekt (massiv emas) — e\'tiborsiz', [], sotuvchilarOl({ a: 1 }));
tekshir('eski bitta raqam', [{ ism: '', tel: ['+998 90 123 45 67'] }], soddala(sotuvchilarOl('  +998 90 123 45 67 ')));
tekshir('eski son (number)', [{ ism: '', tel: ['901234567'] }], soddala(sotuvchilarOl(901234567)));
tekshir('eski vergul bilan 2 raqam → alohida', [{ ism: '', tel: ['90 123 45 67', '93 765 43 21'] }],
  soddala(sotuvchilarOl('90 123 45 67, 93 765 43 21')));
tekshir('eski "Tel: ..." — "Tel" ism bo\'lib o\'qiladi (chekda avvalgidek)', [{ ism: 'Tel', tel: ['+998 90 123 45 67'] }],
  soddala(sotuvchilarOl('Tel: +998 90 123 45 67')));

console.log('\n=== satr format (yozish ↔ o\'qish) ===\n');
const L = [
  { id: 'a', ism: 'Zafar aka', tel: ['+998 (90) 123-45-67', '+998 (93) 765-43-21'] },
  { id: 'b', ism: 'Sardor', tel: ['+998 (97) 000-11-22'] },
  { id: 'c', ism: '', tel: ['+998 (71) 200-00-00'] },
  { id: 'd', ism: 'Faqat ism', tel: [] },
];
const S = sotuvchilarSatr(L);
tekshir('satr', 'Zafar aka: +998 (90) 123-45-67, +998 (93) 765-43-21 | Sardor: +998 (97) 000-11-22 | +998 (71) 200-00-00 | Faqat ism:', S);
tekshir('aylanma: satr → ro\'yxat', soddala(L), soddala(sotuvchilarOl(S)));
tekshir('natija har doim satr (eski ilova uchun xavfsiz)', 'string', typeof sotuvchilarSatr(L));
tekshir('bo\'sh ro\'yxat → bo\'sh satr', '', sotuvchilarSatr([{ id: 'x', ism: ' ', tel: [''] }]));
tekshir('ismdagi ":" va "|" almashtiriladi', [{ ism: 'A/B/C', tel: ['1'] }], soddala(sotuvchilarOl(sotuvchilarSatr([{ ism: 'A:B|C', tel: ['1'] }]))));
tekshir('raqamdagi "," bo\'linib ketmaydi', [{ ism: 'X', tel: ['90 12 34'] }], soddala(sotuvchilarOl(sotuvchilarSatr([{ ism: 'X', tel: ['90,12;34'] }]))));

console.log('\n=== massiv (0bdb5a4 da qisqa muddat yozilgan format) ===\n');
tekshir('massiv o\'qiladi', [{ id: 'a', ism: 'Ali aka', tel: ['+998 (90) 111-11-11', '+998 (93) 222-22-22'] }],
  sotuvchilarOl([{ id: 'a', ism: ' Ali aka ', tel: ['+998 (90) 111-11-11', ' ', '+998 (93) 222-22-22'] }]));
tekshir("bo'sh sotuvchi tushib qoladi", [{ id: 'b', ism: 'Vali', tel: [] }],
  sotuvchilarOl([{ id: 'x', ism: '  ', tel: ['', null] }, { id: 'b', ism: 'Vali', tel: [] }, null, 'buzuq']));
tekshir('massiv → satrga o\'giriladi', 'Ali: 1, 2', sotuvchilarSatr([{ id: 'a', ism: 'Ali', tel: ['1', '2'] }]));

console.log('\n=== matn ===\n');
tekshir('ism + 2 raqam', 'Ali aka: +998 (90) 111-11-11, +998 (93) 222-22-22',
  sotuvchiQatori({ ism: 'Ali aka', tel: ['+998 (90) 111-11-11', '+998 (93) 222-22-22'] }));
tekshir('faqat raqam', '+998 90 123 45 67', sotuvchiQatori({ ism: '', tel: ['+998 90 123 45 67'] }));
tekshir('faqat ism', 'Vali', sotuvchiQatori({ ism: 'Vali', tel: [] }));
tekshir('qatorlar (satrdan)', ['Zafar aka: +998 (90) 123-45-67, +998 (93) 765-43-21', 'Sardor: +998 (97) 000-11-22', '+998 (71) 200-00-00', 'Faqat ism'],
  sotuvchilarMatn(S));
tekshir('eski satrdan qatorlar', ['+998 90 123 45 67'], sotuvchilarMatn('+998 90 123 45 67'));
tekshir('telHref', 'tel:+998901112233', telHref('+998 (90) 111-22-33'));

console.log('\n=== zakas bo\'yicha birinchi sotuvchi ===\n');
const Z = 'Zafar aka: +998 (90) 123-45-67 | Sardor: +998 (97) 000-11-22 | +998 (71) 200-00-00';
const ismlar = (l) => l.map((s) => s.ism || s.tel[0]);
tekshir('kalit — ism', 'Sardor', sotuvchiKalit({ ism: 'Sardor', tel: ['1'] }));
tekshir('kalit — ismsiz bo\'lsa 1-raqam', '+998 (71) 200-00-00', sotuvchiKalit({ ism: '', tel: ['+998 (71) 200-00-00'] }));
tekshir('kalit — bo\'sh', '', sotuvchiKalit(undefined));
tekshir('tanlanmagan → Sozlamalar tartibi', ['Zafar aka', 'Sardor', '+998 (71) 200-00-00'], ismlar(sotuvchilarTartib(Z, '')));
tekshir('"Sardor" birinchi', ['Sardor', 'Zafar aka', '+998 (71) 200-00-00'], ismlar(sotuvchilarTartib(Z, 'Sardor')));
tekshir('katta-kichik harf farqi yo\'q', ['Sardor', 'Zafar aka', '+998 (71) 200-00-00'], ismlar(sotuvchilarTartib(Z, ' sardor ')));
tekshir('ismsiz sotuvchi raqami bilan', ['+998 (71) 200-00-00', 'Zafar aka', 'Sardor'], ismlar(sotuvchilarTartib(Z, '+998 (71) 200-00-00')));
tekshir('o\'chirilgan sotuvchi → o\'zgarishsiz', ['Zafar aka', 'Sardor', '+998 (71) 200-00-00'], ismlar(sotuvchilarTartib(Z, 'Bobur')));
tekshir('tanlov: zakasdagi', 'Sardor', tanlanganSotuvchi(Z, 'Sardor', 'Zafar aka'));
tekshir('tanlov: zakasda yo\'q → qurilmadagi', 'Zafar aka', tanlanganSotuvchi(Z, '', 'Zafar aka'));
tekshir('tanlov: o\'chirilgan → qurilmadagi', 'Sardor', tanlanganSotuvchi(Z, 'Bobur', 'Sardor'));
tekshir('tanlov: hech biri → birinchi', 'Zafar aka', tanlanganSotuvchi(Z, 'Bobur', 'Eski'));
tekshir('tanlov: sotuvchi yo\'q → bo\'sh', '', tanlanganSotuvchi('', 'Sardor', 'Sardor'));
tekshir('bormi', [true, false], [sotuvchiBormi(Z, 'Sardor'), sotuvchiBormi(Z, '')]);

console.log(`\n${xato ? '❌' : '✅'} ${jami - xato}/${jami} o'tdi\n`);
if (xato) process.exit(1);
