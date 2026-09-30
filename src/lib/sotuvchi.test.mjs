// ============================================================
//  SOTUVCHILAR (chekdagi ism + raqamlar) — SINOV
//  Ishga tushirish:  npm run test:sotuvchi   (node src/lib/sotuvchi.test.mjs)
// ============================================================
import { sotuvchilarOl, sotuvchiQatori, sotuvchilarMatn, telHref } from './sotuvchi.js';

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

console.log('\n=== sotuvchilarOl — eski va yangi format ===\n');
tekshir("bo'sh satr", [], sotuvchilarOl(''));
tekshir('null / undefined', [], sotuvchilarOl(undefined));
tekshir('eski bitta raqam (satr)', [{ id: 'eski', ism: '', tel: ['+998 90 123 45 67'] }], sotuvchilarOl('  +998 90 123 45 67 '));
tekshir('eski son (number)', [{ id: 'eski', ism: '', tel: ['901234567'] }], sotuvchilarOl(901234567));
tekshir('yangi ro\'yxat', [{ id: 'a', ism: 'Ali aka', tel: ['+998 (90) 111-11-11', '+998 (93) 222-22-22'] }],
  sotuvchilarOl([{ id: 'a', ism: ' Ali aka ', tel: ['+998 (90) 111-11-11', ' ', '+998 (93) 222-22-22'] }]));
tekshir("bo'sh sotuvchi tushib qoladi", [{ id: 'b', ism: 'Vali', tel: [] }],
  sotuvchilarOl([{ id: 'x', ism: '  ', tel: ['', null] }, { id: 'b', ism: 'Vali', tel: [] }, null, 'buzuq']));
tekshir('tel massiv emas (bitta satr)', [{ id: 's0', ism: 'Sardor', tel: ['+998 (97) 000-00-00'] }],
  sotuvchilarOl([{ ism: 'Sardor', tel: '+998 (97) 000-00-00' }]));

console.log('\n=== matn ===\n');
tekshir('ism + 2 raqam', 'Ali aka: +998 (90) 111-11-11, +998 (93) 222-22-22',
  sotuvchiQatori({ ism: 'Ali aka', tel: ['+998 (90) 111-11-11', '+998 (93) 222-22-22'] }));
tekshir('faqat raqam', '+998 90 123 45 67', sotuvchiQatori({ ism: '', tel: ['+998 90 123 45 67'] }));
tekshir('faqat ism', 'Vali', sotuvchiQatori({ ism: 'Vali', tel: [] }));
tekshir('qatorlar', ['Ali: +998 (90) 111-11-11', '+998 (71) 200-00-00'],
  sotuvchilarMatn([{ id: 'a', ism: 'Ali', tel: ['+998 (90) 111-11-11'] }, { id: 'b', ism: '', tel: ['+998 (71) 200-00-00'] }]));
tekshir('eski satrdan qatorlar', ['+998 90 123 45 67'], sotuvchilarMatn('+998 90 123 45 67'));
tekshir('telHref', 'tel:+998901112233', telHref('+998 (90) 111-22-33'));

console.log(`\n${xato ? '❌' : '✅'} ${jami - xato}/${jami} o'tdi\n`);
if (xato) process.exit(1);
