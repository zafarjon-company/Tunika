// ============================================================
//  SOTUVCHILAR (chekdagi ism + raqamlar) — SINOV
//  Ishga tushirish:  npm run test:sotuvchi   (node src/lib/sotuvchi.test.mjs)
// ============================================================
import { readFileSync } from 'node:fs';
import {
  sotuvchilarOl, sotuvchilarSatr, sotuvchiQatori, sotuvchilarMatn, telHref,
  sotuvchiKalit, sotuvchiKalitlari, sotuvchiBormi, sotuvchilarTartib, tanlanganSotuvchi,
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
tekshir('bitta maydonda vergulli raqamlar → alohida (yopishmaydi)', [{ ism: 'X', tel: ['90 123 45 67', '93 765 43 21'] }],
  soddala(sotuvchilarOl(sotuvchilarSatr([{ ism: 'X', tel: ['90 123 45 67, 93 765 43 21'] }]))));
tekshir('massivga o\'ralgan satr (eski 0bdb5a4 nusxasi) → qayta ajraladi',
  [{ ism: 'Zafar aka', tel: ['+998 (90) 123-45-67', '+998 (93) 765-43-21'] }, { ism: 'Sardor', tel: ['+998 (97) 000-11-22'] }],
  soddala(sotuvchilarOl([{ id: 'q', ism: '', tel: ['Zafar aka: +998 (90) 123-45-67, +998 (93) 765-43-21 | Sardor: +998 (97) 000-11-22'] }])));
tekshir('… va satrga to\'g\'ri o\'giriladi', 'Zafar aka: +998 (90) 123-45-67, +998 (93) 765-43-21 | Sardor: +998 (97) 000-11-22',
  sotuvchilarSatr([{ id: 'q', ism: '', tel: ['Zafar aka: +998 (90) 123-45-67, +998 (93) 765-43-21 | Sardor: +998 (97) 000-11-22'] }]));
tekshir('0bdb5a4 massivi: ism + vergulli bitta tel', 'Zafar aka: 90 123 45 67, 93 765 43 21',
  sotuvchilarSatr([{ id: 'a', ism: 'Zafar aka', tel: ['90 123 45 67, 93 765 43 21'] }]));

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

console.log('\n=== noyob kalitlar (ko\'rik topilmalari) ===\n');
const T = 'Ali: +998 (90) 111-11-11 | ALI: +998 (93) 222-22-22 | Vali: +998 (94) 333-33-33';
tekshir('bir xil ism → ism + raqam (pozitsiya emas)', ['Ali#901111111', 'ALI#932222222', 'Vali'], sotuvchiKalitlari(T));
const tel1 = (l) => l.map((s) => s.tel[0]);
tekshir('2-Ali tanlansa u birinchi', ['+998 (93) 222-22-22', '+998 (90) 111-11-11', '+998 (94) 333-33-33'],
  tel1(sotuvchilarTartib(T, 'ALI#932222222')));
tekshir('tanlov 2-Ali ni qaytaradi', 'ALI#932222222', tanlanganSotuvchi(T, 'ALI#932222222', ''));
tekshir('ikki Ali joyi almashsa ham o\'sha odam', ['+998 (93) 222-22-22', '+998 (90) 111-11-11'],
  tel1(sotuvchilarTartib('ALI: +998 (93) 222-22-22 | Ali: +998 (90) 111-11-11', 'ALI#932222222')));
tekshir('uch Alidan o\'rtadagisi o\'chirilsa — 3-si baribir topiladi', ['+998 (94) 333-33-33', '+998 (90) 111-11-11'],
  tel1(sotuvchilarTartib('Ali: +998 (90) 111-11-11 | Ali: +998 (94) 333-33-33', 'Ali#943333333')));
tekshir('eski pozitsion "Ali#2" (7c8c005) — 2-Ali', ['+998 (93) 222-22-22', '+998 (90) 111-11-11', '+998 (94) 333-33-33'],
  tel1(sotuvchilarTartib(T, 'ALI#2')));
tekshir('1-Ali o\'chirilsa "Ali#2" qolganini topadi', ['+998 (93) 222-22-22', '+998 (94) 333-33-33'],
  tel1(sotuvchilarTartib('Ali: +998 (93) 222-22-22 | Vali: +998 (94) 333-33-33', 'Ali#2')));
tekshir('takroriy Ali biri qayta nomlansa — qolgan Ali (API bilan bir xil)', ['222', '111'],
  tel1(sotuvchilarTartib('Alisher: 111 | Ali: 222', 'Ali#2')));
const F = 'Filial: 1 | Filial: 2 | Filial#2: 3';
tekshir('haqiqiy "Filial#2" ismi bilan ham kalitlar noyob', 3, new Set(sotuvchiKalitlari(F).map((k) => k.toLowerCase())).size);
tekshir('… 3-sotuvchini tanlasa bo\'ladi', '3', sotuvchilarTartib(F, sotuvchiKalitlari(F)[2])[0].tel[0]);
tekshir('ismsiz sotuvchi raqami formati o\'zgarsa ham topiladi', ['90 222 22 22', 'Zafar'],
  ismlar(sotuvchilarTartib('Zafar: 1 | 90 222 22 22', '+998 (90) 222-22-22')));
const U = 'Zafar: +998 (90) 111-11-11, +998 (71) 200-00-00 | +998 (71) 200-00-00 | Sardor: +998 (97) 000-11-22';
tekshir('umumiy raqamli ismsiz sotuvchi — o\'zi tanlanadi (Zafar emas)', ['+998 (71) 200-00-00', 'Zafar', 'Sardor'],
  ismlar(sotuvchilarTartib(U, '+998 (71) 200-00-00')));
tekshir('eski kalit — faqat raqam bo\'yicha (aniq mos yo\'q)', ['Sardor', 'Zafar', '+998 (71) 200-00-00'],
  ismlar(sotuvchilarTartib(U, '+998 (97) 000-11-22')));
tekshir('tahrir: tanlovsiz eski zakas → hozirgi birinchi (qurilma emas)', 'Zafar', tanlanganSotuvchi(U, undefined, ''));

console.log('\n=== api/zakas.js nusxasi kutubxona bilan bir xilmi ===\n');
{
  // api/ src/ dan import qilmaydi — nusxa tutadi. Blokni fayldan ajratib, bir xil
  // kirishlarda solishtiramiz (nusxa farqlanib ketsa shu yerda ushlanadi).
  const src = readFileSync(new URL('../../api/zakas.js', import.meta.url), 'utf8');
  const a = src.indexOf('function satrdanSotuvchilar');
  const b = src.indexOf('// Kazirok qatorining nomi');
  tekshir('api blok topildi', true, a > 0 && b > a);
  const api = new Function(`${src.slice(a, b)}; return { ol: sotuvchilarOl, tartib: (v, k) => sotuvchilarTartib(sotuvchilarOl(v), k) };`)();
  const soddaOl = (l) => l.map(({ ism, tel }) => ({ ism, tel }));
  const qiymatlar = ['', null, { a: 1 }, 901234567, '+998 90 123 45 67', '90 123 45 67, 93 765 43 21', 'Tel: 1', Z, T, U, F,
    'Ali: 111 | Ali: 333', 'Alisher: 111 | Ali: 222', 'Zafar: 1 | 90 222 22 22', 'ALI: +998 (93) 222-22-22 | Ali: +998 (90) 111-11-11',
    [{ id: 'a', ism: ' Ali ', tel: ['1, 2', ' '] }], [{ ism: '', tel: ['Z: 1, 2 | S: 3'] }], [{ ism: '', tel: [] }, null, { ism: 'X', tel: '1' }]];
  let farq = 0; let n = 0;
  for (const v of qiymatlar) {
    n += 1;
    if (JSON.stringify(api.ol(v)) !== JSON.stringify(soddaOl(sotuvchilarOl(v)))) farq += 1;
    const kalitlar = ['', undefined, 'Sardor', ' sardor ', 'ALI#2', 'Ali#2', 'Ali#943333333', 'ALI#932222222', 'Filial#2', '71',
      '+998 (71) 200-00-00', '+998 (90) 222-22-22', 'Bobur', 'Vali', '3', ...sotuvchiKalitlari(v)];
    for (const k of kalitlar) {
      n += 1;
      if (JSON.stringify(api.tartib(v, k)) !== JSON.stringify(soddaOl(sotuvchilarTartib(v, k)))) farq += 1;
    }
  }
  tekshir(`api = kutubxona (${n} holat)`, 0, farq);
}

console.log(`\n${xato ? '❌' : '✅'} ${jami - xato}/${jami} o'tdi\n`);
if (xato) process.exit(1);
