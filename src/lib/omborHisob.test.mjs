// ============================================================
//  OMBOR HISOBI — MAJBURIY TEST HOLATLARI (prompt 2.1-bo'lim)
//  Ishga tushirish:  node src/lib/omborHisob.test.mjs
//  React kerak emas — sof funksiyalar sinaladi.
// ============================================================
import { rulonHisob, kgPerMetr, narxTop, jamiHisob, turTaxmin, zavodGuruh, OGOH } from './omborHisob.js';
import { SOZLAMA_BOSHLANGICH, RANG_TUR_BOSHLANGICH, sozlamaRoyxat } from './omborSeed.js';

const R = (n) => Math.round(n);
let xato = 0;
let jami = 0;

function tekshir(nom, kutilgan, olingan) {
  jami += 1;
  const ok = kutilgan === olingan;
  if (!ok) xato += 1;
  console.log(`${ok ? '  ✅' : '  ❌'} ${nom}: ${olingan}${ok ? '' : `  (kutilgan: ${kutilgan})`}`);
}

// Test uchun sozlama: kurs har holatda alohida beriladi, ustama = 50.
// Narx ro'yxatida "toza" zavod narxi turadi, ustama ustiga qo'shiladi —
// ya'ni jadvaldagi 1120 $/t = 1070 (zavod) + 50 (ustama).
const USTAMA = 50;
function ctxYasa(kurs, tozaNarx) {
  return {
    sozlama: { ...SOZLAMA_BOSHLANGICH, kurs, ustama: USTAMA },
    narxlar: [{ id: 't1', zavod: 'SMZ', tur: 'полимерка', qalinlik: 0.4, narx: tozaNarx, sana: '2026-07-30', faol: true }],
  };
}
const rulonYasa = (ogirlik, uzunlik) => ({
  id: 'r1', nomer: 1, rang: 'Mokriy', zavod: 'SMZ', tur: 'полимерка',
  qalinlik: 0.4, ogirlik, uzunlik,
});

console.log('\n=== 2.1 — MAJBURIY TEST HOLATLARI ===\n');

// ---- 1-holat: daftardagi haqiqiy yozuv ----
//  DIQQAT: daftarda 1 m = 49 080 so'm yozilgan, lekin uzunlik AYNAN 1422 m
//  bo'lganda aniq hisob 49 080,73 beradi → yaxlitlanganda 49 081.
//  Sababi: daftardagi uzunlik ekranga yaxlitlab yozilgan (haqiqiy uzunlik
//  ~1422,02 m). Pastdagi 1b-tekshiruv shuni isbotlaydi: uzunlik 1422,0212
//  bo'lsa daftarning UCHALA raqami ham AYNAN chiqadi.
//  Prompt 2-bo'limi va 6.4-qoidasi ("oraliq hisoblarda yaxlitlash yo'q")
//  bajarildi — 2- va 3-holatlar aynan shu qoida bilan mos keladi
//  (kesib tashlash/floor ishlatilsa 2-holat buziladi).
console.log("1a) og'irlik 5150 kg, narx 1120 $/t, kurs 12100, uzunlik 1422 m (aniq hisob)");
{
  const h = rulonHisob(rulonYasa(5150, 1422), ctxYasa(12100, 1120 - USTAMA));
  tekshir('yangi narx $/t', 1120, R(h.yangiNarx));
  tekshir('rulon $',       5768, R(h.rulonDollar));           // daftar: 5 768 $
  tekshir("rulon so'm", 69792800, R(h.rulonSom));             // daftar: 69 792 800
  tekshir("1 m tannarx",  49081, R(h.metrTannarx));           // daftar: 49 080 (0,73 farq)
  tekshir('÷0.95',        51664, R(h.sotuv1));                // daftar: 51 663
  tekshir('÷0.90',        54534, R(h.sotuv2));                // daftar: 54 533
}

console.log("\n1b) O'SHA rulon, uzunlik 1422,0212 m — daftar raqamlari AYNAN chiqadi");
{
  const h = rulonHisob(rulonYasa(5150, 1422.0212), ctxYasa(12100, 1120 - USTAMA));
  tekshir("1 m tannarx",  49080, R(h.metrTannarx));
  tekshir('÷0.95',        51663, R(h.sotuv1));
  tekshir('÷0.90',        54533, R(h.sotuv2));
}

// ---- 2-holat ----
console.log("\n2) og'irlik 5150 kg, narx 1250 $/t, kurs 12000, uzunlik 1422 m");
{
  const h = rulonHisob(rulonYasa(5150, 1422), ctxYasa(12000, 1250 - USTAMA));
  tekshir('rulon $',       6438, R(h.rulonDollar));     // 6 437,5
  tekshir("rulon so'm", 77250000, R(h.rulonSom));
  tekshir("1 m tannarx",  54325, R(h.metrTannarx));
  tekshir('÷0.95',        57184, R(h.sotuv1));
  tekshir('÷0.90',        60361, R(h.sotuv2));
}

// ---- 3-holat ----
console.log("\n3) og'irlik 3612 kg, narx 1330 $/t, kurs 12000, uzunlik 780 m");
{
  const h = rulonHisob(rulonYasa(3612, 780), ctxYasa(12000, 1330 - USTAMA));
  tekshir("1 m tannarx",  73907, R(h.metrTannarx));
  tekshir('÷0.95',        77797, R(h.sotuv1));
  tekshir('÷0.90',        82119, R(h.sotuv2));
}

console.log('\n=== QO\'SHIMCHA TEKSHIRUVLAR ===\n');

// kg/m jadvali
console.log('4) kg/m jadvali va zaxira koeffitsient');
tekshir('SMZ 0.40',    3.74, kgPerMetr(SOZLAMA_BOSHLANGICH, 'SMZ', 0.4));
tekshir('BOSHQA 0.40', 3.62, kgPerMetr(SOZLAMA_BOSHLANGICH, 'Aziya Steel', 0.4));
tekshir('SMZ 0.25 (jadvalda yo\'q → 0.25×9.35)', 2.3375, kgPerMetr(SOZLAMA_BOSHLANGICH, 'SMZ', 0.25));
tekshir('BOSHQA 0.25 (0.25×9.05)', 2.2625, kgPerMetr(SOZLAMA_BOSHLANGICH, 'TMZ', 0.25));
tekshir("'SMZ zavod' ham SMZ guruhi", 'SMZ', zavodGuruh('SMZ zavod'));
tekshir("'Aziya Steel' -> BOSHQA", 'BOSHQA', zavodGuruh('Aziya Steel'));
tekshir("bo'sh zavod -> BOSHQA", 'BOSHQA', zavodGuruh(''));
tekshir("qalinlik yo'q -> kg/m null", null, kgPerMetr(SOZLAMA_BOSHLANGICH, 'SMZ', ''));
tekshir("sozlama bo'sh {} -> kg/m null", null, kgPerMetr({}, 'SMZ', 0.4));

// Uzunlik og'irlikdan hisoblanishi
console.log("\n5) Uzunlik kiritilmasa — og'irlikdan hisoblanadi");
{
  const h = rulonHisob({ ...rulonYasa(3740, ''), zavod: 'SMZ' }, ctxYasa(12000, 1200));
  tekshir('uzunlik (3740 / 3.74)', 1000, R(h.uzunlik));
  tekshir('uzunlik hisoblanganmi', true, h.uzunlikHisoblangan);
  tekshir('qoldiq uzunlikka teng', 1000, R(h.qoldiq));
}

// Narx ro'yxati va ogohlantirishlar
console.log('\n6) Ogohlantirishlar');
{
  const kod = (h) => h.ogohlar.map((o) => o.kod).join(',');
  const yoq = rulonHisob({ ...rulonYasa(5150, 1422), zavod: 'TMZ' }, ctxYasa(12000, 1200));
  tekshir("narx yo'q ogohi", true, kod(yoq).includes(OGOH.NARX_YOQ));
  tekshir("narx yo'q → yangiNarx null", true, yoq.yangiNarx === null);

  const arzon = rulonHisob({ ...rulonYasa(5150, 1422), xaridNarx: 1400 }, ctxYasa(12000, 1200));
  tekshir('arzonladi ogohi', true, kod(arzon).includes(OGOH.ARZONLADI));

  // 5150 kg / 1422 m = 3.622 kg/m; SMZ 0.40 kutilgani 3.74 → farq 3.2 % (chegarada, ogoh YO'Q)
  const chek1 = rulonHisob(rulonYasa(5150, 1422), ctxYasa(12000, 1200));
  tekshir("±5 % ichida — qalinlik ogohi yo'q", false, kod(chek1).includes(OGOH.QALINLIK));
  // 5150 kg / 1200 m = 4.29 kg/m → 3.74 dan 14.7 % farq → OGOH
  const chek2 = rulonHisob(rulonYasa(5150, 1200), ctxYasa(12000, 1200));
  tekshir('±5 % dan tashqarida — qalinlik ogohi bor', true, kod(chek2).includes(OGOH.QALINLIK));

  const tasdiqsiz = rulonHisob({ ...rulonYasa(5150, 1422), tasdiqlanmagan: true }, ctxYasa(12000, 1200));
  tekshir('tasdiqlanmagan ogohi', true, kod(tasdiqsiz).includes(OGOH.TASDIQSIZ));
}

// Seed narx ro'yxati
console.log("\n7) Narx ro'yxatidan mos yozuvni topish");
{
  // Narx ro'yxati KODDA YO'Q — foydalanuvchi o'zi kiritadi. Shu sabab bu yerda
  // qo'lda tuzilgan ro'yxat ustida narxTop() mantig'i sinaladi.
  const narxlar = [
    { id: 'a', zavod: 'SMZ', tur: 'полимерка', qalinlik: 0.40, narx: 1240, sana: '2026-07-30', faol: true },
    { id: 'b', zavod: 'SMZ', tur: 'полимерка', qalinlik: 0.45, narx: 1210, sana: '2026-07-30', faol: true },
    { id: 'c', zavod: 'Aziya Steel', tur: 'хопёр', qalinlik: 0.50, narx: 1180, sana: '2026-07-30', faol: true },
    // Bir xil zavod+tur+qalinlik, ikki sana — YANGISI olinishi kerak
    { id: 'd', zavod: 'SMZ', tur: 'глянцевый', qalinlik: 0.40, narx: 1290, sana: '2026-06-01', faol: true },
    { id: 'e', zavod: 'SMZ', tur: 'глянцевый', qalinlik: 0.40, narx: 1330, sana: '2026-08-15', faol: true },
    // Arxivlangan yozuv — ISHLATILMASLIGI kerak
    { id: 'f', zavod: 'TMZ', tur: 'полимерка', qalinlik: 0.60, narx: 999, sana: '2026-07-30', faol: false },
  ];
  tekshir('SMZ полимерка 0.40', 1240, narxTop(narxlar, 'SMZ', 'полимерка', 0.4).narx);
  tekshir('Aziya Steel хопёр 0.50', 1180, narxTop(narxlar, 'Aziya Steel', 'хопёр', 0.5).narx);
  tekshir('bir nechta mos kelsa — eng YANGI sana', 1330, narxTop(narxlar, 'SMZ', 'глянцевый', 0.4).narx);
  tekshir("faol:false yozuv ishlatilmaydi", true, narxTop(narxlar, 'TMZ', 'полимерка', 0.6) === null);
  tekshir("ro'yxatda yo'q zavod → null", true, narxTop(narxlar, "Demir Master Prime", 'полимерка', 0.4) === null);
  tekshir("qalinlik mos emas → null", true, narxTop(narxlar, 'SMZ', 'полимерка', 0.35) === null);
  tekshir("bo'sh ro'yxat → null", true, narxTop([], 'SMZ', 'полимерка', 0.4) === null);
  tekshir("obyekt-xarita ham qabul qilinadi", 1240,
    narxTop({ a: narxlar[0] }, 'SMZ', 'полимерка', 0.4).narx);
  // "0.40" (matn) va 0.4 (son) bir xil qalinlik deb qaralishi kerak
  tekshir("qalinlik matn ko'rinishida ham topiladi", 1240,
    narxTop([{ zavod: 'SMZ', tur: 'полимерка', qalinlik: '0.40', narx: 1240, faol: true }], 'SMZ', 'полимерка', 0.4).narx);
  // Registr va ortiqcha bo'shliq farq qilmasin
  tekshir('registr/bo\'shliq farq qilmaydi', 1180,
    narxTop(narxlar, '  aziya   steel ', 'ХОПЁР', 0.5).narx);
}

// Rang → tur
console.log('\n8) Rang → tur bog\'lanishi');
tekshir('Atsenkovka',  'оцинковка',           turTaxmin(RANG_TUR_BOSHLANGICH, 'Atsenkovka'));
tekshir('Oq (yaltiroq)', 'глянцевый',         turTaxmin(RANG_TUR_BOSHLANGICH, 'Oq (yaltiroq)'));
tekshir('Salafan',     'глянцевый (плёнка)',  turTaxmin(RANG_TUR_BOSHLANGICH, 'Salafan'));
tekshir('Xopyor',      'хопёр',               turTaxmin(RANG_TUR_BOSHLANGICH, 'Xopyor'));
tekshir('Qora mebel',  'Мебел',               turTaxmin(RANG_TUR_BOSHLANGICH, 'Qora mebel'));
tekshir('Mokriy',      'полимерка',           turTaxmin(RANG_TUR_BOSHLANGICH, 'Mokriy'));

// Jami qatori
console.log('\n9) Jami qatori');
{
  const ctx = ctxYasa(12000, 1200);
  const qatorlar = [
    { ...rulonYasa(5150, 1422), id: 'a' },
    { ...rulonYasa(3612, 780),  id: 'b', nomer: 2 },
  ].map((r) => ({ ...r, h: rulonHisob(r, ctx) }));
  const j = jamiHisob(qatorlar);
  tekshir('rulonlar soni', 2, j.soni);
  tekshir("umumiy og'irlik (kg)", 8762, R(j.ogirlik));
  tekshir('umumiy qoldiq (m)', 2202, R(j.qoldiq));
  tekshir("ombor qiymati (so'm)", R(qatorlar[0].h.qoldiqQiymat + qatorlar[1].h.qoldiqQiymat), R(j.qiymat));
}

// Tanlov ro'yxatlari sozlamadan o'qiladi (Sozlama panelida tahrirlanadi)
console.log("\n10) Tanlov ro'yxatlari (zavod / tur / rang)");
{
  const teng = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Eski sozlama hujjatida bu maydonlar yo'q — boshlang'ich ro'yxat ishlatiladi
  tekshir("maydon yo'q → boshlang'ich ro'yxat", true,
    teng(sozlamaRoyxat({}, 'zavodlar'), SOZLAMA_BOSHLANGICH.zavodlar));
  tekshir("sozlama null → boshlang'ich", true,
    teng(sozlamaRoyxat(null, 'turlar'), SOZLAMA_BOSHLANGICH.turlar));
  // Foydalanuvchi ro'yxatni ataylab tozalasa — standart nomlar QAYTIB KELMASLIGI kerak
  tekshir("bo'sh massiv bo'sh qoladi", 0, sozlamaRoyxat({ zavodlar: [] }, 'zavodlar').length);
  tekshir('kiritilgan ro\'yxat o\'zi qaytadi', true,
    teng(sozlamaRoyxat({ zavodlar: ['A', 'B'] }, 'zavodlar'), ['A', 'B']));
  // Buzuq qiymat (masalan qo'lda noto'g'ri yozilgan) — yiqilmaydi
  tekshir('massiv emas → boshlang\'ich', true,
    teng(sozlamaRoyxat({ ranglar: 'xato' }, 'ranglar'), SOZLAMA_BOSHLANGICH.ranglar));
  tekshir("rang ro'yxati bo'sh emas", true, SOZLAMA_BOSHLANGICH.ranglar.length > 0);
}

console.log(`\n${'='.repeat(46)}`);
console.log(xato === 0 ? `✅ HAMMASI O'TDI — ${jami} ta tekshiruv` : `❌ ${xato} / ${jami} TEKSHIRUV O'TMADI`);
console.log(`${'='.repeat(46)}\n`);
process.exit(xato === 0 ? 0 : 1);
