// ============================================================
//  METRLI NARX — 500 GA YAXLITLASH — SINOV
//  Ishga tushirish:  npm run test:metrli   (node src/lib/metrli.test.mjs)
// ============================================================
import { metrliNarx, calcItem, orderItemToDraft, METRLI_QADAM } from './helpers.js';

let xato = 0;
let jami = 0;
function tekshir(nom, kutilgan, olingan) {
  jami += 1;
  const ok = kutilgan === olingan;
  if (!ok) xato += 1;
  console.log(`${ok ? '  ✅' : '  ❌'} ${nom}: ${olingan}${ok ? '' : `  (kutilgan: ${kutilgan})`}`);
}

const M = (metriNarx) => ({ id: 'm', nomi: 'Latok', metriNarx, variantlar: [{ son: 2, razmer: '62' }, { son: 3, razmer: '41' }, { son: 4, razmer: '31' }, { son: 5, razmer: '25' }, { son: 6, razmer: '20' }] });

console.log('\n=== metrliNarx (eng yaqin 500) ===\n');
tekshir('qadam', 500, METRLI_QADAM);
tekshir('17 250 → 17 500 (o\'rtada — yuqoriga)', 17500, metrliNarx(45750, 3, M(2000)));   // 15250+2000
tekshir('19 300 → 19 500', 19500, metrliNarx(65200, 4, M(3000)));                         // 16300+3000
tekshir('16 700 → 16 500', 16500, metrliNarx(58500, 5, M(5000)));                         // 11700+5000
tekshir('17 249 → 17 000', 17000, metrliNarx(30498, 2, M(2000)));                         // 15249+2000
tekshir('aniq 18 000 o\'zgarmaydi', 18000, metrliNarx(48000, 3, M(2000)));
tekshir('suzuvchi xato: 51750/3 + 0 = 17250 → 17 500', 17500, metrliNarx(51750, 3, M(0)));
tekshir('1/3 kasr: 50000/3 + 2000 = 18666.67 → 18 500', 18500, metrliNarx(50000, 3, M(2000)));
tekshir('eski ustaHaqqi', 17500, metrliNarx(45750, 3, { ustaHaqqi: 2000 }));
tekshir('son 0 → 1 deb olinadi', 50000, metrliNarx(48000, 0, M(2000)));
tekshir('qadamdan kichik narx o\'zgarmaydi', 200, metrliNarx(400, 2, M(0)));
tekshir('narx 0', 0, metrliNarx(0, 3, M(0)));
tekshir('narx yo\'q (undefined)', 0, metrliNarx(undefined, 3, M(0)));

console.log('\n=== calcItem (metrli) ===\n');
const tunikaBaza = [{ id: 't', nomi: 'Oq SMZ', qalinlik: 0.45, chakana: 45750, optom: 42000 }];
const ctx = { tunikaBaza, metrlilar: [M(2000)] };
const it = (patch) => ({ id: 'i', kind: 'metrli', metrliId: 'm', tunikaId: 't', priceType: 'chakana', variantIndex: 1, uzunlik: '10', soni: '1', zapas: '', ...patch });

let r = calcItem(it({}), ctx);
tekshir('chakana 3 bo\'lak: 45750/3+2000 = 17250 → 17 500', 17500, r.birBirlikNarxi);
tekshir('jami = 10 m × 17 500', 175000, r.jamiSumma);
tekshir('tan narx yaxlitlanmaydi: 42000/3+2000', 16000, r.tanNarxBirlik);
r = calcItem(it({ priceType: 'optom', variantIndex: 3 }), ctx);
tekshir('optom 5 bo\'lak: 42000/5+2000 = 10400 → 10 500', 10500, r.birBirlikNarxi);
r = calcItem(it({ narxOverride: '17300' }), ctx);
tekshir('qo\'lda narx (override) yaxlitlanmaydi', 17300, r.birBirlikNarxi);

console.log('\n=== orderItemToDraft (srcItems\'siz ESKI zakas, yaxlitlanmagan narx) ===\n');
// chakana 43000, optom 42000, metri 2000: 5 bo'lakda eski optom narx 10 400, chakana 10 600 —
// yaxlitlanganda ikkalasi 10 500 bo'lib, optom "chakana" deb tiklanardi (ko'rik topilmasi).
const tb2 = [{ id: 't2', nomi: 'Qizil SMZ', qalinlik: 0.45, chakana: 43000, optom: 42000 }];
const eski = (birBirlikNarxi) => ({ kind: 'metrli', nomi: 'Latok', tafsilot: "Qizil SMZ · 5 bo'lak (25)", birBirlikNarxi, uzunlik: 10, soni: 1 });
const ctx2 = { tunikaBaza: tb2, metrlilar: [M(2000)] };
tekshir('eski optom 10 400 → optom', 'optom', orderItemToDraft(eski(10400), ctx2).priceType);
tekshir('eski chakana 10 600 → chakana', 'chakana', orderItemToDraft(eski(10600), ctx2).priceType);
tekshir('variant 5 bo\'lak topildi', 3, orderItemToDraft(eski(10400), ctx2).variantIndex);

console.log(`\n${xato ? '❌' : '✅'} ${jami - xato}/${jami} o'tdi\n`);
if (xato) process.exit(1);
