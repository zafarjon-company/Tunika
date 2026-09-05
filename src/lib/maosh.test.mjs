// ============================================================
//  MAOSH / AVANS HISOBI — testlar (node src/lib/maosh.test.mjs)
// ------------------------------------------------------------
//  Qoidalar:
//   • maosh 5-sanada O'TGAN OY uchun; yangi oyning 1–5-kunidagi avans
//     o'tgan oy maoshidan ushlanadi, yangi oy kunlari hisobga kirmaydi;
//   • yarim kun yo'q — eski 'yarim' yozuv to'liq kun;
//   • har avans faqat bitta oyda hisoblanadi (teleskopik tenglik).
// ============================================================
import {
  MAOSH_KUNI, oldingiOy, avansOyi, avansTaqsimot, tolovlarSummasi, avansYozuvlari,
  oyIshlangan, oylikYoqlama, ishchiHisobi, oylikBalans, ishKuniMi,
} from './helpers.js';

let jami = 0;
let xato = 0;
function tekshir(nom, kutilgan, haqiqiy) {
  jami += 1;
  const ok = JSON.stringify(kutilgan) === JSON.stringify(haqiqiy);
  if (!ok) xato += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${nom}: ${JSON.stringify(haqiqiy)}${ok ? '' : `  (kutilgan: ${JSON.stringify(kutilgan)})`}`);
}
const R = (x) => Math.round(x);

console.log('\n=== 1) AVANS QAYSI OYDAN USHLANADI ===\n');
tekshir('MAOSH_KUNI = 5', 5, MAOSH_KUNI);
tekshir('oldingiOy 2026-01 → 2025-12', '2025-12', oldingiOy('2026-01'));
tekshir('oldingiOy 2026-09 → 2026-08', '2026-08', oldingiOy('2026-09'));
tekshir('1-kun → o\'tgan oy', '2026-08', avansOyi({ createdAt: '2026-09-01T12:00:00' }, '2026-09'));
tekshir('5-kun → o\'tgan oy', '2026-08', avansOyi({ createdAt: '2026-09-05T18:30:00' }, '2026-09'));
tekshir('6-kun → o\'z oyi', '2026-09', avansOyi({ createdAt: '2026-09-06T08:00:00' }, '2026-09'));
tekshir('faqat sana ("2026-09-03") → o\'tgan oy', '2026-08', avansOyi({ createdAt: '2026-09-03' }, '2026-09'));
tekshir('eski (sonli) yozuv → o\'z oyi', '2026-09', avansOyi({ eski: true, createdAt: '2026-09-01' }, '2026-09'));
tekshir('sanasiz yozuv → o\'z oyi', '2026-09', avansOyi({ createdAt: null }, '2026-09'));
tekshir("avansYozuvlari eski sonli → eski: true", true, avansYozuvlari(300000, '2026-09')[0].eski);

console.log('\n=== 2) OYLIK BALANS: SENTABR 1–5 AVANSI AVGUST MAOSHIDAN ===\n');
{
  const ishchi = { id: 'w1', oylikHaqq: 3100000 }; // avgust 31 kun → kunlik 100 000
  const yoqlama = {};
  for (let d = 1; d <= 31; d += 1) yoqlama[`2026-08-${String(d).padStart(2, '0')}`] = { w1: 'keldi' };
  for (let d = 1; d <= 10; d += 1) yoqlama[`2026-09-${String(d).padStart(2, '0')}`] = { w1: 'keldi' }; // sentabr 30 kun → kunlik 103 333
  const avanslar = {
    '2026-08': { w1: [{ id: 'a1', method: "So'mda", amount: 500000, createdAt: '2026-08-10T12:00:00' }] },
    '2026-09': { w1: [
      { id: 'a2', method: "So'mda", amount: 200000, createdAt: '2026-09-03T12:00:00' }, // → avgust
      { id: 'a3', method: 'Dollorda', amount: 10, rate: 12000, createdAt: '2026-09-05T12:00:00' }, // 120 000 → avgust
      { id: 'a4', method: "So'mda", amount: 100000, createdAt: '2026-09-10T12:00:00' }, // sentabr
    ] },
  };
  const taq = avansTaqsimot(avanslar, 'w1');
  tekshir('taqsimot: avgust = 500k + 200k + 120k', 820000, taq['2026-08']);
  tekshir('taqsimot: sentabr = 100k', 100000, taq['2026-09']);
  const barchasi = Object.values(avanslar).flatMap((o) => o.w1);
  tekshir('ikki marta hisoblanmaydi (jami teng)', tolovlarSummasi(barchasi), Object.values(taq).reduce((s, v) => s + v, 0));

  const avg = oylikBalans(ishchi, yoqlama, avanslar, {}, '2026-08');
  tekshir('avgust ishlangan = 3 100 000 (31 kun)', 3100000, R(avg.ishlangan));
  tekshir('avgust avans = 820 000 (sentabr 1–5 bilan)', 820000, R(avg.avans));
  tekshir('avgust yakun = 2 280 000', 2280000, R(avg.yakun));
  tekshir('avgust boshida = 0', 0, R(avg.boshida));

  // Maosh 5-sentabrda avgust uchun to'liq berildi
  const maoshlar = { '2026-08': { w1: [{ id: 'm1', method: "So'mda", amount: 2280000, createdAt: '2026-09-05T10:00:00' }] } };
  const avg2 = oylikBalans(ishchi, yoqlama, avanslar, maoshlar, '2026-08');
  tekshir("avgust qoldiq maoshdan keyin = 0", 0, R(avg2.qoldiq));
  const sen = oylikBalans(ishchi, yoqlama, avanslar, maoshlar, '2026-09');
  tekshir('sentabr boshida = 0 (avgust yopilgan)', 0, R(sen.boshida));
  tekshir('sentabr avans = faqat 100 000 (1–5 kun avgustga ketdi)', 100000, R(sen.avans));
  tekshir('sentabr ishlangan = 10 kun × 103 333', R(3100000 / 30 * 10), R(sen.ishlangan));
  tekshir('sentabr qoldiq = ishlangan − 100 000', R(3100000 / 30 * 10 - 100000), R(sen.qoldiq));
  const h = ishchiHisobi(ishchi, yoqlama, avanslar, maoshlar);
  tekshir('teleskopik: butun davr haqqi = sentabr qoldiq', R(sen.qoldiq), R(h.haqqi));
  tekshir('butun davr avans = 920 000', 920000, R(h.avans));
}

console.log("\n=== 3) FAQAT 1–5 KUN AVANSI BOR OY (boshqa ma'lumot yo'q) ===\n");
{
  const ishchi = { id: 'w2', oylikHaqq: 3000000 };
  const avanslar = { '2026-10': { w2: [{ id: 'b1', method: "So'mda", amount: 50000, createdAt: '2026-10-02T12:00:00' }] } };
  const h = ishchiHisobi(ishchi, {}, avanslar, {});
  tekshir('sentabrga o\'tgan avans butun davrda hisoblanadi', 50000, R(h.avans));
  tekshir('haqqi = −50 000', -50000, R(h.haqqi));
  const sen = oylikBalans(ishchi, {}, avanslar, {}, '2026-09');
  tekshir('sentabr balansida avans 50 000', 50000, R(sen.avans));
  const okt = oylikBalans(ishchi, {}, avanslar, {}, '2026-10');
  tekshir('oktabr boshida = −50 000 (sentabrdan ko\'chgan)', -50000, R(okt.boshida));
  tekshir('oktabr avans = 0', 0, R(okt.avans));
}

console.log("\n=== 4) YARIM KUN YO'Q — ESKI 'yarim' TO'LIQ KUN ===\n");
{
  const ishchi = { id: 'w3', oylikHaqq: 3000000 }; // sentabr 30 kun → kunlik 100 000
  const yoqlama = { '2026-09-01': { w3: 'keldi' }, '2026-09-02': { w3: 'yarim' }, '2026-09-03': { w3: 'kelmadi' } };
  tekshir("ishKuniMi('yarim') = true", true, ishKuniMi('yarim'));
  tekshir("ishKuniMi('kelmadi') = false", false, ishKuniMi('kelmadi'));
  tekshir('ishlangan = 2 to\'liq kun', 200000, R(oyIshlangan(ishchi, yoqlama, '2026-09')));
  tekshir('oylikYoqlama.toliq = 2, jamiKun = 2', { toliq: 2, jamiKun: 2 }, oylikYoqlama(yoqlama, '2026-09', 'w3'));
}

console.log("\n=== 5) ESKI SONLI AVANS — OYI O'ZGARMAYDI ===\n");
{
  const taq = avansTaqsimot({ '2026-09': { w4: 300000 } }, 'w4');
  tekshir('eski sonli avans o\'z oyida', { '2026-09': 300000 }, taq);
}

console.log(`\n${'='.repeat(46)}`);
console.log(xato === 0 ? `✅ HAMMASI O'TDI — ${jami} ta tekshiruv` : `❌ ${xato} / ${jami} TEKSHIRUV O'TMADI`);
console.log(`${'='.repeat(46)}\n`);
process.exit(xato === 0 ? 0 : 1);
