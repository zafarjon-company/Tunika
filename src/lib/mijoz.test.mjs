// ============================================================
//  MIJOZ TAVSIYASI — SINOV
//  Ishga tushirish:  npm run test:mijoz   (node src/lib/mijoz.test.mjs)
// ============================================================
import {
  klentKalit, klentTavsiyalar, klentBolaklar, telKalit, telefonTakrorlar, klentTakrorXabar, klentQidiruvMos,
  mijozZakaslari, jamla, realQarz,
} from './mijoz.js';

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

console.log('\n=== klentKalit ===\n');
tekshir("bo'sh joylar", 'ali valiyev', klentKalit('  Ali   Valiyev '));
tekshir('null', '', klentKalit(null));
tekshir('apostrof turlari', 'gayrat oktam', klentKalit("G‘ayrat Oʻktam"));
tekshir("to'g'ri apostrof", 'gayrat oktam', klentKalit("G'ayrat O'ktam"));
tekshir('kiril ў/ғ', 'gayrat oktam', klentKalit('Ғайрат Ўктам'));
tekshir('kiril ш/ю/ё/қ (q = k)', 'sherzod yulduz yokub', klentKalit('Шерзод Юлдуз Ёқуб'));
tekshir('kiril е so\'z boshida', 'yelena', klentKalit('Елена'));
tekshir('kiril е undoshdan keyin', 'meli', klentKalit('Мели'));
tekshir('kiril э/х/ҳ (x = h)', 'erkin hurshid hamid', klentKalit('Эркин Хуршид Ҳамид'));
tekshir('defis/nuqta ajratadi', 'ali aka v', klentKalit('Ali-aka V.'));
tekshir('lotin diakritika', 'oktam', klentKalit('Öktam'));
tekshir('raqam saqlanadi', 'ali 2', klentKalit('Ali 2'));

console.log('\n=== klentTavsiyalar ===\n');
const K = [
  { id: 'a', name: 'Ali Valiyev', phones: ['+998 90 111 11 11'] },
  { id: 'b', name: 'Alisher Karimov', phones: [''] },
  { id: 'c', name: 'Anvar Valiyev' },
  { id: 'd', name: 'ali  valiyev' },
  { id: 'e', name: 'Abdukarim' },
  { id: 'f', name: "G'ayrat O'ktam" },
  { id: 'g' },                // ismsiz — yiqilmasin
  null,                        // buzuq yozuv — yiqilmasin
];
const ids = (r) => r.map((x) => `${x.c.id}${x.daraja}`);

tekshir('1 harf — tavsiya yo\'q', [], ids(klentTavsiyalar(K, 'a')));
tekshir("bo'sh", [], ids(klentTavsiyalar(K, '   ')));
tekshir('undefined ism', [], ids(klentTavsiyalar(K, undefined)));
tekshir('undefined ro\'yxat', [], ids(klentTavsiyalar(undefined, 'Ali')));
tekshir('"Ali" → boshlanishi (Valiyev ichidagi "ali" emas)', ['a1', 'd1', 'b1'], ids(klentTavsiyalar(K, 'Ali')));
tekshir('"Ali Valiyev" → aynan (ikkalasi) + familiyadosh', ['a0', 'd0', 'c4'], ids(klentTavsiyalar(K, 'Ali Valiyev')));
tekshir('"ali   VALIYEV " → aynan', ['a0', 'd0', 'c4'], ids(klentTavsiyalar(K, 'ali   VALIYEV ')));
tekshir('"valiyev ali" → so\'zlar teskari (+ yozilayotgan "ali" boshi)', ['a2', 'd2', 'b4', 'c4'], ids(klentTavsiyalar(K, 'valiyev ali')));
tekshir('"Valiyev" → familiya', ['a2', 'd2', 'c2'], ids(klentTavsiyalar(K, 'Valiyev')));
tekshir('"Karim" → so\'z boshi + ichida', ['b2', 'e3'], ids(klentTavsiyalar(K, 'Karim')));
tekshir('"ali ali" → so\'z ikki marta ishlatilmaydi (faqat ismdosh)', ['a4', 'd4', 'b4'], ids(klentTavsiyalar(K, 'ali ali')));
tekshir('kiril "Али" → lotin ismlar', ['a1', 'd1', 'b1'], ids(klentTavsiyalar(K, 'Али')));
tekshir('apostrofsiz "gayrat" → G\'ayrat', ['f1'], ids(klentTavsiyalar(K, 'gayrat')));
tekshir('kiril "Ғайрат Ўктам" → aynan', ['f0'], ids(klentTavsiyalar(K, 'Ғайрат Ўктам')));
tekshir('"Bobur" → hech kim', [], ids(klentTavsiyalar(K, 'Bobur')));
tekshir('"al" (2 harf) → boshlanishi', ['a1', 'd1', 'b1'], ids(klentTavsiyalar(K, 'al')));

console.log('\n=== ismi yoki familiyasi bir xil (daraja 4) ===\n');
const K2 = [
  { id: 'a', name: 'Ali Valiyev', phones: ['+998 90 111 11 11'] },
  { id: 'k', name: 'Ali Karimov' },
  { id: 'v', name: 'Anvar Valiyev' },
  { id: 'x', name: 'Bobur Toshev' },
  { id: 'y', name: 'Alijon Soliyev' },
];
tekshir('"Ali Valiyev" → aynan + ismdosh + familiyadosh', ['a0', 'k4', 'v4'], ids(klentTavsiyalar(K2, 'Ali Valiyev')));
tekshir('"Ali Vali" → yozilayotgan familiya boshi ham', ['a1', 'k4', 'v4'], ids(klentTavsiyalar(K2, 'Ali Vali')));
tekshir('"Ali V" → 1 harfli so\'z ismdosh qilmaydi, Ali Karimov qoladi', ['a1', 'k4'], ids(klentTavsiyalar(K2, 'Ali V')));
tekshir('"Karimov Ali" → teskari tartib aynan emas, so\'zlar mos', ['k2', 'a4', 'y4'], ids(klentTavsiyalar(K2, 'Karimov Ali')));
tekshir('"Toshev" (1 so\'z) — ismdosh qoidasi ishlamaydi, faqat so\'z boshi', ['x2'], ids(klentTavsiyalar(K2, 'Toshev')));
tekshir('ismdosh: false — faqat 0–3', ['a0'], ids(klentTavsiyalar(K2, 'Ali Valiyev', { ismdosh: false })));

console.log('\n=== ko\'rik topilmalari: murojaat so\'zlari, tartib, imlo variantlari ===\n');
const K3 = [
  { id: 'ab', name: 'Abdulla aka' }, { id: 'ba', name: 'Bahodir aka' }, { id: 'di', name: 'Dilshod aka' },
  { id: 'ka', name: 'Karim' }, { id: 'do', name: 'Dilnoza opa' },
];
tekshir('"Karim aka" → "Karim" aynan, boshqa "... aka"lar chiqmaydi', ['ka0'], ids(klentTavsiyalar(K3, 'Karim aka')));
tekshir('"Karim opa" → "Dilnoza opa" chiqmaydi', ['ka0'], ids(klentTavsiyalar(K3, 'Karim opa')));
tekshir('saqlangan "Abdulla aka" ← yozilgan "Abdulla" aynan', ['ab0'], ids(klentTavsiyalar(K3, 'Abdulla')));
const K4 = [{ id: 'a2', name: 'Ali 2' }, { id: 'a3', name: 'Ali-2' }, { id: 'ak', name: 'Ali Karimov' }, { id: 'av', name: 'Ali Valiyev' }];
tekshir('"Ali Valiyev aka" → haqiqiy takror birinchi (aynan)', 'av0', ids(klentTavsiyalar(K4, 'Ali Valiyev aka'))[0]);
tekshir('"Ali Valiyev Chilonzor" → saqlangan ism so\'zlari ichida (2)', 'av2', ids(klentTavsiyalar(K4, 'Ali Valiyev Chilonzor'))[0]);
const K5 = [{ id: 'b1', name: 'Aziz Toshmatov' }, { id: 'b2', name: 'Abror Karim' }, { id: 'b3', name: 'Karim Toshmatov Olim' }];
tekshir('4-darajada ko\'p so\'z mos kelgani oldinda (2 so\'z > 1 so\'z)', ['b34', 'b24', 'b14'],
  ids(klentTavsiyalar(K5, 'Karim Toshmatov Samarqand')));
const K6 = [{ id: 'h', name: 'Hamid Qodirov' }, { id: 's', name: 'Shuhrat' }, { id: 'z', name: 'Abdulaziz' }];
tekshir('x = h, q = k: "Xamid Kodirov" → aynan', ['h0'], ids(klentTavsiyalar(K6, 'Xamid Kodirov')));
tekshir('kiril "Шухрат" → "Shuhrat" aynan', ['s0'], ids(klentTavsiyalar(K6, 'Шухрат')));
tekshir('"Abdul Aziz" → "Abdulaziz" aynan (bo\'shliqsiz)', ['z0'], ids(klentTavsiyalar(K6, 'Abdul Aziz')));
tekshir('saqlashda: "Karim aka" → "Karim" ogohlantirishi', '"Karim" ismli mijoz allaqachon bor.\nBaribir yangi mijoz ochilsinmi?',
  klentTakrorXabar(K3, 'Karim aka', []));
tekshir('saqlashda: "Xamid Kodirov" → imlo varianti ham', true, klentTakrorXabar(K6, 'Xamid Kodirov', []).startsWith('"Hamid Qodirov"'));

console.log('\n=== klentBolaklar (belgilash) ===\n');
tekshir('mos so\'zlar belgilanadi', [['Ali', true], [' ', false], ['Karimov', false]],
  klentBolaklar('Ali Karimov', 'Ali Valiyev').map((b) => [b.matn, b.mos]));
tekshir('kiril yozuv ham belgilaydi', [['Anvar', false], [' ', false], ['Valiyev', true]],
  klentBolaklar('Anvar Valiyev', 'Али Валиев').map((b) => [b.matn, b.mos]));
tekshir('ichida (4+) belgilanadi', [['Abdukarim', true]], klentBolaklar('Abdukarim', 'Karim').map((b) => [b.matn, b.mos]));

console.log('\n=== telefon takrori ===\n');
tekshir('telKalit to\'liq', '901111111', telKalit('+998 90 111 11 11'));
tekshir('telKalit 998siz', '901111111', telKalit('90 111-11-11'));
tekshir('telKalit chala → bo\'sh', '', telKalit('+998 90 111'));
tekshir('telKalit PhoneInput chala (6 raqam, 998 bilan 9 ta!) → bo\'sh', '', telKalit('+998 (90) 111-1'));
tekshir('telKalit PhoneInput chala (8 raqam) → bo\'sh', '', telKalit('+998 (90) 111-11-1'));
tekshir('telKalit PhoneInput to\'liq', '901111111', telKalit('+998 (90) 111-11-11'));
tekshir('telKalit 998 bilan, plyussiz', '901111111', telKalit('998901111111'));
tekshir('telKalit 99 8.. abonent (plyussiz 9 raqam)', '998901111', telKalit('99 890 11 11'));
tekshir('chala raqam boshqa mijozning to\'liq raqamiga mos kelmaydi', [],
  telefonTakrorlar([{ id: 'u', phones: ['+998 (99) 890-11-11'] }], ['+998 (90) 111-1']).map((c) => c.id));
tekshir('telKalit bo\'sh', '', telKalit(undefined));
tekshir('takror topiladi (format boshqacha)', ['a'], telefonTakrorlar(K2, ['', '(90) 111 11 11']).map((c) => c.id));
tekshir('chala raqam — takror yo\'q', [], telefonTakrorlar(K2, ['+998 90 111 11']).map((c) => c.id));
tekshir('phones yo\'q mijoz yiqitmaydi', [], telefonTakrorlar([{ id: 'z' }, null], ['+998 90 111 11 11']));

console.log('\n=== saqlashdagi ogohlantirish ===\n');
tekshir('raqam takrori', '+998 90 111 11 11 raqami allaqachon "Ali Valiyev" mijozida bor.\nBaribir yangi mijoz ochilsinmi?',
  klentTakrorXabar(K2, 'Alijon aka', ['+998 90 111 11 11']));
tekshir('aynan ism', '"Ali Valiyev" ismli mijoz allaqachon bor — +998 90 111 11 11.\nBaribir yangi mijoz ochilsinmi?',
  klentTakrorXabar(K2, "  ali  VALIYEV", ['']));
tekshir('ismdosh — ogohlantirish yo\'q (boshqa odam)', '', klentTakrorXabar(K2, 'Ali Toshev', ['']));
tekshir('ikki nomdosh', '"Ali Valiyev" ismli mijoz allaqachon bor (2 ta) — +998 90 111 11 11.\nBaribir yangi mijoz ochilsinmi?',
  klentTakrorXabar([...K2, { id: 'a2', name: 'Ali Valiyev' }], 'Ali Valiyev', []));

console.log('\n=== qidiruv (klentQidiruvMos) ===\n');
const Q = { id: 'q', name: "G'ayrat O'ktamov", phones: ['+998 90 111 11 11'], address: 'Chilonzor' };
tekshir('bo\'sh qidiruv', true, klentQidiruvMos(Q, '  '));
tekshir('eski: ism ichida', true, klentQidiruvMos(Q, "ayrat"));
tekshir('eski: manzil', true, klentQidiruvMos(Q, 'chilon'));
tekshir('eski: telefon formatida', true, klentQidiruvMos(Q, '90 111'));
tekshir('yangi: apostrofsiz', true, klentQidiruvMos(Q, 'gayrat oktam'));
tekshir('yangi: kiril', true, klentQidiruvMos(Q, 'Ғайрат'));
tekshir('yangi: teskari tartib', true, klentQidiruvMos(Q, "oktamov gayrat"));
tekshir('yangi: raqam bo\'shliqsiz', true, klentQidiruvMos(Q, '901111111'));
tekshir('raqam + harf aralash — raqam qoidasi ishlamaydi', false, klentQidiruvMos(Q, 'a901'));
tekshir('mos emas', false, klentQidiruvMos(Q, 'Bobur'));
tekshir('ismdosh qidiruvga kirmaydi', false, klentQidiruvMos(Q, "G'ayrat Toshev"));
tekshir('buzuq yozuv', false, klentQidiruvMos({ id: 'z' }, 'ali'));

console.log('\n=== statistika ===\n');
const O = [
  { id: 1, customer: { clientId: 'a', name: 'Ali Valiyev' }, totalSum: 100, totalPaid: 40, debt: 60, createdAt: '2026-09-01T10:00:00Z' },
  { id: 2, customer: { clientId: 'a', name: 'Ali Valiyev' }, totalSum: 50, totalPaid: 0, debt: 50, createdAt: '2026-09-20T10:00:00Z' },
  { id: 3, customer: { name: '  ali valiyev' }, totalSum: 30, totalPaid: 30, debt: 0, createdAt: '2026-08-01T10:00:00Z' },
  { id: 4, customer: { clientId: 'd', name: 'ali valiyev' }, totalSum: 70, totalPaid: 70, debt: 0, createdAt: '2026-09-25T10:00:00Z' },
];
tekshir('clientId + clientId\'siz nomdosh zakas', [1, 2, 3],mijozZakaslari(O, K[0]).map((o) => o.id));
tekshir('clientId yo\'q → nom bo\'yicha', [3], mijozZakaslari(O, { id: 'z', name: 'Ali Valiyev' }).map((o) => o.id));
tekshir('xom hisob qarz emas', 0, realQarz(O[1]));
tekshir('jamla', { jami: 180, tolangan: 70, qarz: 60, n: 3, oxirgi: '2026-09-20T10:00:00Z' }, jamla(mijozZakaslari(O, K[0])));
tekshir('jamla bo\'sh', { jami: 0, tolangan: 0, qarz: 0, n: 0, oxirgi: null }, jamla([]));

console.log(`\n${xato ? '❌' : '✅'} ${jami - xato}/${jami} o'tdi\n`);
if (xato) process.exit(1);
