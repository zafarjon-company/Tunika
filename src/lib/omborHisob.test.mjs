// ============================================================
//  OMBOR HISOBI — TESTLAR
//  Ishga tushirish:  node src/lib/omborHisob.test.mjs
//  React kerak emas — sof funksiyalar sinaladi.
//
//  Model: har rulonda O'ZINING narxi ($/t), kursi va yo'lkirasi ($/t)
//  yoziladi — foydalanuvchining daftaridagidek.
// ============================================================
import {
  rulonHisob, kgPerMetr, jamiHisob, turTaxmin, zavodGuruh, narxTop, jadvalQalinliklar, norm, OGOH,
} from './omborHisob.js';
import { SOZLAMA_BOSHLANGICH, RANG_TUR_BOSHLANGICH, NARX_JADVAL_BOSHLANGICH, sozlamaRoyxat } from './omborSeed.js';
import {
  narxHolat, narxBogla, narxObyekt, narxQatorOchir, narxUstunQatorlar, royxatDublikatlar, ustunObyekt,
} from './omborNarxJadval.js';

const R = (n) => Math.round(n);
let xato = 0;
let jami = 0;

function tekshir(nom, kutilgan, olingan) {
  jami += 1;
  const ok = kutilgan === olingan;
  if (!ok) xato += 1;
  console.log(`${ok ? '  ✅' : '  ❌'} ${nom}: ${olingan}${ok ? '' : `  (kutilgan: ${kutilgan})`}`);
}

// Daftardagi qatorlarda yo'lkira YO'Q — shuning uchun 0 bilan solishtiramiz.
const ctx0 = { sozlama: { ...SOZLAMA_BOSHLANGICH, yolkiraTonna: 0 } };
// Rulon yasash: narx va kurs rulonning O'ZIDA
const rulonYasa = (ogirlik, narxTonna, kurs, uzunlik, qoshimcha = {}) => ({
  id: 'r1', nomer: 1, rang: 'Mokriy', zavod: 'SMZ', tur: 'Rangli', qalinlik: 0.4,
  ogirlik, narxTonna, kurs, uzunlik, ...qoshimcha,
});

console.log('\n=== 1) DAFTARDAGI QATORLAR (yo\'lkirasiz) ===\n');

// ---- 18-qator (daftar): 5150 kg, 1120 $/t, kurs 12100, 1422 m ----
//  Daftarda 1 m = 49 080 (kesib yozilgan), aniq hisob 49 080,73 → 49 081.
console.log("18-qator: 5150 kg × 1120 $/t, kurs 12100, uzunlik 1422 m");
{
  const h = rulonHisob(rulonYasa(5150, 1120, 12100, 1422), ctx0);
  tekshir('rulon $',       5768, R(h.rulonDollar));
  tekshir("rulon so'm", 69792800, R(h.rulonSom));
  tekshir("yo'lkira so'm",    0, R(h.yolkiraSom));
  tekshir("1 m tannarx",  49081, R(h.metrTannarx));   // daftar: 49 080 (0,73 farq)
  tekshir('÷0.95',        51664, R(h.sotuv1));
  tekshir('÷0.90',        54534, R(h.sotuv2));
}

// ---- 34-qator: 5150 kg, 1130 $/t, kurs 12100, 1436 m → daftarda 49 036 ----
console.log("\n34-qator: 5150 kg × 1130 $/t, kurs 12100, uzunlik 1436 m");
{
  const h = rulonHisob(rulonYasa(5150, 1130, 12100, 1436), ctx0);
  tekshir('rulon $',       5820, R(h.rulonDollar));   // daftar: 5 819,5
  tekshir("rulon so'm", 70415950, R(h.rulonSom));
  tekshir("1 m tannarx",  49036, R(h.metrTannarx));
  tekshir('÷0.95',        51617, R(h.sotuv1));
  tekshir('÷0.90',        54485, R(h.sotuv2));   // daftar: 54 484 (49 036,18 ÷ 0,9 = 54 484,64 — kalkulyatorda 1 m avval butunlashtirilgan)
}

// ---- 22-qator: 3612 kg, 1210 $/t, kurs 12200, 780 m → daftarda 68 359 ----
console.log("\n22-qator: 3612 kg × 1210 $/t, kurs 12200, uzunlik 780 m");
{
  const h = rulonHisob(rulonYasa(3612, 1210, 12200, 780, { qalinlik: 0.5 }), ctx0);
  tekshir("rulon so'm", 53320344, R(h.rulonSom));
  tekshir("1 m tannarx",  68359, R(h.metrTannarx));
  tekshir('÷0.95',        71957, R(h.sotuv1));
  tekshir('÷0.90',        75955, R(h.sotuv2));   // daftar: 75 954 (68 359,42 ÷ 0,9 = 75 954,9 — o'sha sabab)
}

console.log("\n=== 2) YO'LKIRA ===\n");
{
  // Standart 10 $/t: 5150 kg → 51,5 $ → × 12100 = 623 150 so'm qo'shiladi
  const ctx10 = { sozlama: { ...SOZLAMA_BOSHLANGICH, yolkiraTonna: 10 } };
  const h = rulonHisob(rulonYasa(5150, 1130, 12100, 1436), ctx10);
  tekshir("yo'lkira $ (5,15 t × 10)", 51.5, h.yolkiraDollar);
  tekshir("yo'lkira so'm",        623150, R(h.yolkiraSom));
  tekshir("jami so'm",          71039100, R(h.jamiSom));
  tekshir("1 m tannarx (yo'lkira bilan)", 49470, R(h.metrTannarx));   // 49 036 + 434
  tekshir("standart ishlatildi belgisi", true, h.yolkiraStandart);

  // Rulonda o'zi yozilgan bo'lsa — standart emas, o'sha
  const h2 = rulonHisob(rulonYasa(5150, 1130, 12100, 1436, { yolkiraTonna: 15 }), ctx10);
  tekshir("rulondagi 15 $/t ustun", 77.25, h2.yolkiraDollar);
  tekshir("standart emas belgisi", false, h2.yolkiraStandart);

  // Rulonda 0 yozilsa — yo'lkirasiz (standart QAYTIB kelmaydi)
  const h3 = rulonHisob(rulonYasa(5150, 1130, 12100, 1436, { yolkiraTonna: 0 }), ctx10);
  tekshir("rulonda 0 → yo'lkira yo'q", 0, h3.yolkiraDollar);
  tekshir("0 da tannarx daftardagidek", 49036, R(h3.metrTannarx));

  // Manfiy yozilsa — 0 deb olinadi
  const h4 = rulonHisob(rulonYasa(5150, 1130, 12100, 1436, { yolkiraTonna: -5 }), ctx10);
  tekshir("manfiy → 0", 0, h4.yolkiraDollar);
}

console.log("\n=== 3) NARX VA KURS HAR RULONDA ===\n");
{
  // Sozlamadagi kurs FAQAT yangi rulon uchun taklif — hisobda rulondagi kurs ishlatiladi
  const h = rulonHisob(rulonYasa(5150, 1130, 12500, 1436), { sozlama: { ...SOZLAMA_BOSHLANGICH, kurs: 12000, yolkiraTonna: 0 } });
  tekshir("rulondagi kurs (12500) ishlatildi", 72743750, R(h.rulonSom));
  // Eski maydon nomlari ham o'qiladi — avvalgi yozuvlar yo'qolmasin
  const eski = { id: 'e', nomer: 1, zavod: 'SMZ', tur: 'Rangli', qalinlik: 0.4,
    ogirlik: 5150, xaridNarx: 1130, xaridKurs: 12100, uzunlik: 1436 };
  const he = rulonHisob(eski, ctx0);
  tekshir("eski maydonlar (xaridNarx/xaridKurs) o'qildi", 49036, R(he.metrTannarx));
}

console.log('\n=== 4) KG/M JADVALI (faqat zaxira va tekshiruv uchun) ===\n');
tekshir('SMZ 0.40',    3.74, kgPerMetr(SOZLAMA_BOSHLANGICH, 'SMZ', 0.4));
tekshir('BOSHQA 0.40', 3.62, kgPerMetr(SOZLAMA_BOSHLANGICH, 'Xitoy', 0.4));
tekshir("jadvalda yo'q qalinlik → koef", 2.3375, kgPerMetr(SOZLAMA_BOSHLANGICH, 'SMZ', 0.25));
tekshir("'SMZ Momin' ham SMZ guruhi", 'SMZ', zavodGuruh('SMZ Momin'));
tekshir("'Xitoy' → BOSHQA", 'BOSHQA', zavodGuruh('Xitoy'));
{
  // Uzunlik kiritilmasa — og'irlikdan hisoblanadi va "≈" belgisi qo'yiladi
  const h = rulonHisob(rulonYasa(3740, 1130, 12100, ''), ctx0);
  tekshir('uzunlik (3740 / 3.74)', 1000, R(h.uzunlik));
  tekshir('uzunlik hisoblanganmi', true, h.uzunlikHisoblangan);
  tekshir("uzunlik yo'q ogohi CHIQMAYDI (hisoblandi)", false, h.ogohlar.some((o) => o.kod === OGOH.UZUNLIK_YOQ));
}

console.log('\n=== 5) OGOHLANTIRISHLAR ===\n');
{
  const kod = (h) => h.ogohlar.map((o) => o.kod);
  // Narx yo'q
  const h1 = rulonHisob(rulonYasa(5150, '', 12100, 1436), ctx0);
  tekshir("narx yo'q → ogoh", true, kod(h1).includes(OGOH.NARX_YOQ));
  tekshir("narx yo'q → tannarx null", true, h1.metrTannarx === null);
  // Kurs yo'q
  const h2 = rulonHisob(rulonYasa(5150, 1130, '', 1436), ctx0);
  tekshir("kurs yo'q → ogoh", true, kod(h2).includes(OGOH.NARX_YOQ));
  tekshir("kurs yo'q matni", true, h2.ogohlar.find((o) => o.kod === OGOH.NARX_YOQ).matn.includes('kurs'));
  // Uzunlik yo'q va kg/m ham chiqmadi (qalinlik yo'q)
  const h3 = rulonHisob(rulonYasa(5150, 1130, 12100, '', { qalinlik: '' }), ctx0);
  tekshir("uzunlik va qalinlik yo'q → uzunlik ogohi", true, kod(h3).includes(OGOH.UZUNLIK_YOQ));
  // ±5 %: 5150/1422 = 3.62 (SMZ 0.40 kutilgani 3.74 → 3.2 % — chegarada, OGOH YO'Q)
  const h4 = rulonHisob(rulonYasa(5150, 1130, 12100, 1422), ctx0);
  tekshir("±5 % ichida — qalinlik ogohi yo'q", false, kod(h4).includes(OGOH.QALINLIK));
  // 5150/1200 = 4.29 → 14.7 % farq → OGOH
  const h5 = rulonHisob(rulonYasa(5150, 1130, 12100, 1200), ctx0);
  tekshir('±5 % dan tashqarida — qalinlik ogohi bor', true, kod(h5).includes(OGOH.QALINLIK));
  // Daftardagi 33-qator: "0,45" deb yozilgan, lekin 5332/1472 = 3.62 → 0.40 ga o'xshaydi
  const h6 = rulonHisob(rulonYasa(5332, 1090, 12100, 1472, { qalinlik: 0.45 }), ctx0);
  tekshir("33-qator (0,45 deb yozilgan) ogoh beradi", true, kod(h6).includes(OGOH.QALINLIK));
  // Tasdiqlanmagan
  const h7 = rulonHisob(rulonYasa(5150, 1130, 12100, 1436, { tasdiqlanmagan: true }), ctx0);
  tekshir('tasdiqlanmagan ogohi', true, kod(h7).includes(OGOH.TASDIQSIZ));
  // Og'irlik yo'q — hech qanday pul ogohi chiqmaydi (hali to'ldirilmagan qator)
  const h8 = rulonHisob({ id: 'b', nomer: 1 }, ctx0);
  tekshir("bo'sh qatorda pul ogohi yo'q", 0, h8.ogohlar.length);
}

console.log("\n=== 6) RANG → TUR ===\n");
tekshir('Atsenkovka',  'Atsenkovka', turTaxmin(RANG_TUR_BOSHLANGICH, 'Atsenkovka'));
tekshir('Oq (yaltiroq)', 'Yaltiroq', turTaxmin(RANG_TUR_BOSHLANGICH, 'Oq (yaltiroq)'));
tekshir('Salafan',     'Salafan',    turTaxmin(RANG_TUR_BOSHLANGICH, 'Salafan'));
tekshir('Xapyor',      'Xapyor',     turTaxmin(RANG_TUR_BOSHLANGICH, 'Xapyor'));
tekshir('Qora mebel',  'Mebel',      turTaxmin(RANG_TUR_BOSHLANGICH, 'Qora mebel'));
tekshir('Mokriy → standart', 'Rangli', turTaxmin(RANG_TUR_BOSHLANGICH, 'Mokriy'));

console.log('\n=== 7) JAMI QATORI ===\n');
{
  const ctx10 = { sozlama: { ...SOZLAMA_BOSHLANGICH, yolkiraTonna: 10 } };
  const qatorlar = [
    { ...rulonYasa(5150, 1130, 12100, 1436), id: 'a' },
    { ...rulonYasa(3612, 1210, 12200, 780), id: 'b', nomer: 2, qalinlik: 0.5 },
  ].map((r) => ({ ...r, h: rulonHisob(r, ctx10) }));
  const j = jamiHisob(qatorlar);
  tekshir('rulonlar soni', 2, j.soni);
  tekshir("umumiy og'irlik (kg)", 8762, R(j.ogirlik));
  tekshir('umumiy uzunlik (m)', 2216, R(j.uzunlik));
  tekshir("jami so'm (yo'lkira bilan)", R(qatorlar[0].h.jamiSom + qatorlar[1].h.jamiSom), R(j.jamiSom));
  tekshir("jami yo'lkira so'm", R(qatorlar[0].h.yolkiraSom + qatorlar[1].h.yolkiraSom), R(j.yolkiraSom));
  // Jadval tagidagi yig'indilar: rulon $ / rulon so'm (yo'lkirasiz) va yo'lkira $
  tekshir('jami rulon $ (yo\'lkirasiz)', R(5.15 * 1130 + 3.612 * 1210), R(j.rulonDollar));
  tekshir("jami rulon so'm (yo'lkirasiz)", R(5.15 * 1130 * 12100 + 3.612 * 1210 * 12200), R(j.rulonSom));
  tekshir("jami yo'lkira $", R((5.15 + 3.612) * 10), R(j.yolkiraDollar));
  tekshir("jami $ = rulon $ + yo'lkira $", R(j.rulonDollar + j.yolkiraDollar), R(j.jamiDollar));
  tekshir("jami so'm = rulon so'm + yo'lkira so'm", R(j.rulonSom + j.yolkiraSom), R(j.jamiSom));
  tekshir("ombor qiymati (qoldiq × tannarx)", R(qatorlar[0].h.qoldiqQiymat + qatorlar[1].h.qoldiqQiymat), R(j.qiymat));
}

console.log("\n=== 8) TANLOV RO'YXATLARI ===\n");
{
  const teng = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  tekshir("maydon yo'q → boshlang'ich", true, teng(sozlamaRoyxat({}, 'zavodlar'), SOZLAMA_BOSHLANGICH.zavodlar));
  tekshir("bo'sh massiv bo'sh qoladi", 0, sozlamaRoyxat({ zavodlar: [] }, 'zavodlar').length);
  tekshir("kiritilgan ro'yxat o'zi qaytadi", true, teng(sozlamaRoyxat({ zavodlar: ['A', 'B'] }, 'zavodlar'), ['A', 'B']));
  tekshir("massiv emas → boshlang'ich", true, teng(sozlamaRoyxat({ ranglar: 'xato' }, 'ranglar'), SOZLAMA_BOSHLANGICH.ranglar));
}

console.log("\n=== 9) NOMNI HAMMA RULONDA QAYTA NOMLASH ===\n");
{
  // App.jsx dagi omborQaytaNomla bilan bir xil algoritm (endi faqat rulonlar)
  function qaytaNomla(maydon, eski, yangi, rulonlar) {
    const e = norm(eski);
    const y = String(yangi == null ? '' : yangi).trim();
    if (!e || !y) return 0;
    const patch = {};
    for (const id in rulonlar) {
      const rec = rulonlar[id];
      if (!rec || rec.ochirilgan) continue;
      if (norm(rec[maydon]) !== e) continue;
      patch[id] = { ...rec, [maydon]: y };
    }
    Object.assign(rulonlar, patch);
    return Object.keys(patch).length;
  }
  const rulonlar = {
    a: { id: 'a', zavod: 'SMZ', tur: 'Rangli', rang: 'Oq' },
    b: { id: 'b', zavod: 'smz', tur: 'Xapyor', rang: 'Oq' },      // registr boshqacha
    c: { id: 'c', zavod: 'TMZ', tur: 'Rangli', rang: 'Qora' },
    d: { id: 'd', zavod: 'SMZ', tur: 'Rangli', ochirilgan: true }, // o'chirilgan
  };
  tekshir('almashdi (registr farqisiz)', 2, qaytaNomla('zavod', 'SMZ', 'SMZ Momin', rulonlar));
  tekshir('a → yangi nom', 'SMZ Momin', rulonlar.a.zavod);
  tekshir('b (kichik harf) ham', 'SMZ Momin', rulonlar.b.zavod);
  tekshir("c tegilmadi", 'TMZ', rulonlar.c.zavod);
  tekshir("o'chirilgan tegilmadi", 'SMZ', rulonlar.d.zavod);
  tekshir("bo'sh eski nom → 0", 0, qaytaNomla('zavod', '', 'X', rulonlar));
  tekshir("bo'sh yangi nom → 0", 0, qaytaNomla('zavod', 'TMZ', '  ', rulonlar));

  // O'zgarishni aniqlash (OmborSozlama: qaytaNomlar)
  const sanoq = new Map([['smz', 3]]);
  const aniqla = (r) => {
    const eski = String(r.asl || '').trim(), yng = String(r.v || '').trim();
    if (!eski || !yng || norm(eski) === norm(yng)) return false;
    return (sanoq.get(norm(eski)) || 0) > 0;
  };
  tekshir("nom o'zgargan va ishlatilgan → aniqlanadi", true, aniqla({ asl: 'SMZ', v: 'SMZ Momin' }));
  tekshir("yangi qator (asl bo'sh) → emas", false, aniqla({ asl: '', v: 'Yangi' }));
  tekshir("faqat registr → emas", false, aniqla({ asl: 'SMZ', v: 'smz' }));
  tekshir("ishlatilmagan nom → emas", false, aniqla({ asl: 'Demir', v: 'Demir Master' }));
}

console.log("\n=== 10) ZAVOD NARX JADVALI ===\n");
{
  const s = SOZLAMA_BOSHLANGICH;
  tekshir('SMZ · Rangli · 0.45 → 1270', 1270, narxTop(s, 'SMZ', 'Rangli', 0.45));
  tekshir('registr / vergul farqsiz ("smz", "rangli", "0,45")', 1270, narxTop(s, 'smz', 'rangli', '0,45'));
  tekshir('SMZ · Xapyor · "0.40" → 1380', 1380, narxTop(s, 'SMZ', 'Xapyor', '0.40'));
  tekshir('SMZ · Atsenkovka · 2.5 → 1090', 1090, narxTop(s, 'SMZ', 'Atsenkovka', 2.5));
  tekshir('SMZ · Salafan · 0.35 → 1480', 1480, narxTop(s, 'SMZ', 'Salafan', 0.35));
  tekshir('Aziya Steel · Xapyor · 0.4 → 1260', 1260, narxTop(s, 'Aziya Steel', 'Xapyor', 0.4));
  tekshir('Xitoy · Rangli · 0.22 → 1200', 1200, narxTop(s, 'Xitoy', 'Rangli', 0.22));
  tekshir("jadvalda yo'q zavod (TMZ) → null", null, narxTop(s, 'TMZ', 'Rangli', 0.4));
  tekshir("jadvalda yo'q qalinlik (SMZ Mebel 0.5) → null", null, narxTop(s, 'SMZ', 'Mebel', 0.5));
  tekshir("bo'sh tur → null", null, narxTop(s, 'SMZ', '', 0.4));
  tekshir("sozlamada jadval yo'q → null", null, narxTop({}, 'SMZ', 'Rangli', 0.4));
  tekshir('qalinliklar: SMZ Yaltiroq', '0.35,0.4,0.45', jadvalQalinliklar(s, 'SMZ', 'Yaltiroq').join(','));
  tekshir('qalinliklar: SMZ Atsenkovka 26 ta', 26, jadvalQalinliklar(s, 'SMZ', 'Atsenkovka').length);
  tekshir("qalinliklar: yo'q zavod → []", 0, jadvalQalinliklar(s, 'TMZ', 'Rangli').length);
  // Nol / manfiy narxli qator jadvaldan tushib qoladi
  const s2 = { narxJadval: { A: { B: { '0.4': 0, '0.5': 1000, '0.6': -5 } } } };
  tekshir('nol narx → null', null, narxTop(s2, 'A', 'B', 0.4));
  tekshir("nol/manfiy narxli qalinlik ro'yxatga tushmaydi", '0.5', jadvalQalinliklar(s2, 'A', 'B').join(','));
  // Boshlang'ich jadval butunligi: har katak musbat son, kalit — son matni,
  // zavod / tur nomlari ro'yxatlarda bor (aks holda formada topilmaydi)
  let kataklar = 0;
  let buzuq = 0;
  for (const [z, turlar] of Object.entries(NARX_JADVAL_BOSHLANGICH)) {
    if (!SOZLAMA_BOSHLANGICH.zavodlar.some((x) => norm(x) === norm(z))) buzuq += 1;
    for (const [t, ustun] of Object.entries(turlar)) {
      if (!SOZLAMA_BOSHLANGICH.turlar.some((x) => norm(x) === norm(t))) buzuq += 1;
      for (const [q, v] of Object.entries(ustun)) {
        kataklar += 1;
        if (!(Number(q) > 0) || !(Number(v) > 0) || String(Number(q)) !== q) buzuq += 1;
      }
    }
  }
  tekshir("boshlang'ich jadval: 81 katak (01.09.2026 varaqasi)", 81, kataklar);
  tekshir("boshlang'ich jadval: buzuq katak / nom yo'q", 0, buzuq);
  // Rang → tur: yangi ranglar o'z kategoriyasiga tushadi
  tekshir("'Xapyor' rangi → Xapyor turi", 'Xapyor', turTaxmin(RANG_TUR_BOSHLANGICH, 'Xapyor'));
  tekshir("'Atsenkovka' rangi → Atsenkovka", 'Atsenkovka', turTaxmin(RANG_TUR_BOSHLANGICH, 'Atsenkovka'));
  tekshir("'Oq yaltiroq' → Yaltiroq", 'Yaltiroq', turTaxmin(RANG_TUR_BOSHLANGICH, 'Oq yaltiroq'));
  tekshir("'Qaymoq yaltiroq salafan' → Salafan", 'Salafan', turTaxmin(RANG_TUR_BOSHLANGICH, 'Qaymoq yaltiroq salafan'));
  // Har boshlang'ich rang uchun taxmin qilingan tur — tur ro'yxatida bor
  const yoqTur = SOZLAMA_BOSHLANGICH.ranglar.filter((r) => !SOZLAMA_BOSHLANGICH.turlar.includes(turTaxmin(RANG_TUR_BOSHLANGICH, r)));
  tekshir("har rangning turi tur ro'yxatida bor", '', yoqTur.join(','));
}

console.log("\n=== 11) NARX JADVALI TAHRIRLAGICHI (sof mantiq) ===\n");
{
  // Tartib: Object.keys butun sonli kalitlarni ('1','2') oldinga chiqaradi — sort kerak
  tekshir('qalinliklar: SMZ Atsenkovka tartibi',
    '0.18,0.2,0.22,0.25,0.28,0.3,0.33,0.35,0.37,0.4,0.45,0.5,0.6,0.7,0.8,0.9,1,1.1,1.2,1.4,1.5,1.6,1.8,2,2.2,2.5',
    jadvalQalinliklar(SOZLAMA_BOSHLANGICH, 'SMZ', 'Atsenkovka').join(','));
  tekshir('qalinliklar: butun va kasr aralash → son tartibi', '0.18,1,2,10',
    jadvalQalinliklar({ narxJadval: { A: { B: { 2: 1, '0.18': 1, 10: 1, 1: 1 } } } }, 'A', 'B').join(','));

  const seed = NARX_JADVAL_BOSHLANGICH;
  let idS = 0;
  const qator = (v, asl = v) => ({ id: `r${idS += 1}`, v, asl });
  const royxat = (zavodlar, turlar) => ({ zavodlar: zavodlar.map((z) => qator(z)), turlar: turlar.map((t) => qator(t)) });
  const formaYasa = (jadval, zavodlar, turlar) => {
    const r = royxat(zavodlar, turlar);
    return { royxat: r, narx: narxHolat(jadval, r.zavodlar, r.turlar) };
  };
  const Z = SOZLAMA_BOSHLANGICH.zavodlar;
  const T = SOZLAMA_BOSHLANGICH.turlar;
  const kataklar = (j) => Object.values(j).reduce((n, t) => n + Object.values(t).reduce((m, u) => m + Object.keys(u).length, 0), 0);
  const teng = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const norml = (j) => Object.fromEntries(Object.entries(j).sort().map(([z, t]) => [z, Object.fromEntries(Object.entries(t).sort().map(([k, u]) => [k, Object.fromEntries(Object.entries(u).sort())]))]));

  // A) O'zgarishsiz: yuklab qayta saqlash — mazmuni bir xil
  const fA = formaYasa(seed, Z, T);
  tekshir('A: yuklab-saqlash mazmuni bir xil', true, teng(norml(narxObyekt(fA, seed)), norml(seed)));
  tekshir('A: 81 katak', 81, kataklar(narxObyekt(fA, seed)));

  // Nomni yozish (royxatSet kabi): qator v o'zgaradi, so'ng narxBogla
  const nomYoz = (f, nom, id, v) => {
    const eski = f.royxat[nom].find((r) => r.id === id);
    const next = { ...f, royxat: { ...f.royxat, [nom]: f.royxat[nom].map((r) => (r.id === id ? { ...r, v } : r)) } };
    const opts = { eskiNom: eski.v };
    if (nom === 'zavodlar') opts.zId = id; else opts.tId = id;
    return narxBogla(next, seed, opts);
  };
  const ochir = (f, nom, id) => narxQatorOchir({ ...f, royxat: { ...f.royxat, [nom]: f.royxat[nom].filter((r) => r.id !== id) } }, nom, id);
  const qosh = (f, nom) => { const q = qator('', ''); return [{ ...f, royxat: { ...f.royxat, [nom]: [...f.royxat[nom], q] } }, q.id]; };

  // B) Zavodni o'chirib, qayta qo'shib, nomini yozib saqlash — narxlar qoladi
  let fB = formaYasa(seed, Z, T);
  fB = ochir(fB, 'zavodlar', fB.royxat.zavodlar.find((r) => r.v === 'Xitoy').id);
  let idB; [fB, idB] = qosh(fB, 'zavodlar');
  fB = nomYoz(fB, 'zavodlar', idB, 'Xitoy');
  const tRangli = fB.royxat.turlar.find((r) => r.v === 'Rangli').id;
  tekshir("B: qayta qo'shilgan Xitoy ustunlari formada ko'rinadi", 10, narxUstunQatorlar(fB, idB, tRangli).length);
  const oB = narxObyekt(fB, seed);
  tekshir("B: saqlashda Xitoy Rangli 0.22 qoladi", 1200, oB.Xitoy && oB.Xitoy.Rangli && oB.Xitoy.Rangli['0.22']);
  tekshir('B: katak soni 81', 81, kataklar(oB));

  // C) Ikki sessiya: o'chirib saqlash (yetim qoladi) → keyin qayta qo'shib saqlash
  let fC = formaYasa(seed, Z, T);
  fC = ochir(fC, 'zavodlar', fC.royxat.zavodlar.find((r) => r.v === 'Xitoy').id);
  const saqC1 = narxObyekt(fC, seed);
  tekshir("C: o'chirib saqlansa Xitoy yetim sifatida qoladi", 1210, saqC1.Xitoy && saqC1.Xitoy.Xapyor['0.4']);
  let fC2 = formaYasa(saqC1, Z.filter((z) => z !== 'Xitoy'), T);
  let idC; [fC2, idC] = qosh(fC2, 'zavodlar');
  fC2 = nomYoz(fC2, 'zavodlar', idC, 'xitoy'); // registr farqi bilan
  const saqC2 = narxObyekt(fC2, saqC1);
  const xitoyKalit = Object.keys(saqC2).find((k) => norm(k) === 'xitoy');
  tekshir("C: qayta qo'shilganda Xitoy Xapyor 0.4 qoladi", 1210, xitoyKalit && saqC2[xitoyKalit].Xapyor['0.4']);
  tekshir("C: Xitoy bitta kalit bilan (takror emas)", 1, Object.keys(saqC2).filter((k) => norm(k) === 'xitoy').length);

  // D) Turni o'chirib saqlash → SMZ Mebel qoladi; qayta qo'shib saqlash → yana bor
  let fD = formaYasa(seed, Z, T);
  fD = ochir(fD, 'turlar', fD.royxat.turlar.find((r) => r.v === 'Mebel').id);
  const saqD1 = narxObyekt(fD, seed);
  tekshir("D: tur o'chirilsa SMZ Mebel yetim qoladi", 1470, saqD1.SMZ.Mebel && saqD1.SMZ.Mebel['0.3']);
  let fD2 = formaYasa(saqD1, Z, T.filter((t) => t !== 'Mebel'));
  let idD; [fD2, idD] = qosh(fD2, 'turlar');
  fD2 = nomYoz(fD2, 'turlar', idD, 'Mebel');
  const saqD2 = narxObyekt(fD2, saqD1);
  tekshir("D: tur qayta qo'shilsa SMZ Mebel 0.3 qoladi", 1470, saqD2.SMZ.Mebel && saqD2.SMZ.Mebel['0.3']);
  tekshir("D: katak soni 81", 81, kataklar(saqD2));

  // E) Qayta nomlash: Xitoy → Master Class — narxlar ergashadi, eski nom qolmaydi
  let fE = formaYasa(seed, Z, T);
  fE = nomYoz(fE, 'zavodlar', fE.royxat.zavodlar.find((r) => r.v === 'Xitoy').id, 'Master Class');
  const oE = narxObyekt(fE, seed);
  tekshir('E: yangi nom bilan yoziladi', 1200, oE['Master Class'] && oE['Master Class'].Rangli['0.22']);
  tekshir('E: eski nom qolmaydi', undefined, oE.Xitoy);

  // F) Nomi tozalangan qator ({asl:'Xitoy', v:''}) — o'chirilgan kabi: narxi saqlanadi
  let fF = formaYasa(seed, Z, T);
  fF = { ...fF, royxat: { ...fF.royxat, zavodlar: fF.royxat.zavodlar.map((r) => (r.v === 'Xitoy' ? { ...r, v: '' } : r)) } };
  const oF = narxObyekt(fF, seed);
  tekshir("F: nomi tozalangan zavod narxi yetim sifatida qoladi", 1200, oF.Xitoy && oF.Xitoy.Rangli['0.22']);

  // G) Takror nomlar: 'SMZ' va 'smz' — bitta kalit, ikkalasi ham xato sifatida belgilanadi
  let fG = formaYasa(seed, [...Z, 'smz'], T);
  const oG = narxObyekt(fG, seed);
  tekshir('G: takror nomdan bitta kalit yoziladi', 1, Object.keys(oG).filter((k) => norm(k) === 'smz').length);
  tekshir('G: royxatDublikatlar ikkala qatorni belgilaydi', 2, royxatDublikatlar(fG.royxat.zavodlar).size);
  tekshir("G: takror yo'q → bo'sh", 0, royxatDublikatlar(formaYasa(seed, Z, T).royxat.zavodlar).size);

  // H) Yangi qator nomini yozish: "Xito" → bo'sh, "Xitoy" → bog'lanadi, "Xitoy2" → yana bo'sh (ko'chib qolmaydi)
  let fH = formaYasa(seed, Z.filter((z) => z !== 'Xitoy'), T);
  let idH; [fH, idH] = qosh(fH, 'zavodlar');
  const tXap = fH.royxat.turlar.find((r) => r.v === 'Xapyor').id;
  fH = nomYoz(fH, 'zavodlar', idH, 'Xito');
  tekshir("H: 'Xito' → bo'sh", 0, narxUstunQatorlar(fH, idH, tXap).length);
  fH = nomYoz(fH, 'zavodlar', idH, 'Xitoy');
  tekshir("H: 'Xitoy' → Xapyor 5 qator", 5, narxUstunQatorlar(fH, idH, tXap).length);
  fH = nomYoz(fH, 'zavodlar', idH, 'Xitoy2');
  tekshir("H: 'Xitoy2' → avto bog'langan ustun bo'shaydi", 0, narxUstunQatorlar(fH, idH, tXap).length);
  // qo'lda to'ldirilgan ustun nom o'zgarsa ham qoladi
  fH = { ...fH, narx: { ...fH.narx, [idH]: { ...fH.narx[idH], [tXap]: [{ id: 'x', q: '0.4', v: '999' }] } } };
  fH = nomYoz(fH, 'zavodlar', idH, 'Xitoy');
  tekshir("H: qo'lda to'ldirilgan ustunga tegilmaydi", 999, ustunObyekt(narxUstunQatorlar(fH, idH, tXap))['0.4']);

  // I) Yuklangan qator qayta nomlansa — narxlari ergashadi (bo'shatilmaydi)
  let fI = formaYasa(seed, Z, T);
  const idI = fI.royxat.zavodlar.find((r) => r.v === 'Xitoy').id;
  const tRangliI = fI.royxat.turlar.find((r) => r.v === 'Rangli').id;
  fI = nomYoz(fI, 'zavodlar', idI, 'Xitoy (Master)');
  tekshir("I: yuklangan qator qayta nomlansa Rangli 10 qator qoladi", 10, narxUstunQatorlar(fI, idI, tRangliI).length);
  tekshir("I: saqlashda yangi nom bilan yoziladi", 1200, narxObyekt(fI, seed)['Xitoy (Master)'].Rangli['0.22']);

  // J) Bog'lanmagan (undefined) ustun — saqlangandagi qoladi; [] — bo'shatilgan, yozilmaydi
  let fJ = formaYasa(seed, Z, T);
  const idJ = fJ.royxat.zavodlar.find((r) => r.v === 'SMZ').id;
  const tMebel = fJ.royxat.turlar.find((r) => r.v === 'Mebel').id;
  const { [idJ]: _smz, ...boshqa } = fJ.narx;
  const oJ1 = narxObyekt({ ...fJ, narx: boshqa }, seed);
  tekshir("J: undefined ustunlar saqlangandagi holicha", 1270, oJ1.SMZ.Rangli['0.45']);
  const oJ2 = narxObyekt({ ...fJ, narx: { ...fJ.narx, [idJ]: { ...fJ.narx[idJ], [tMebel]: [] } } }, seed);
  tekshir("J: bo'shatilgan ustun yozilmaydi", undefined, oJ2.SMZ.Mebel);

  // K) narxQatorOchir: zavod o'chirilsa uning ustunlari, tur o'chirilsa hamma zavoddagi ustuni ketadi
  let fK = formaYasa(seed, Z, T);
  const idK = fK.royxat.zavodlar.find((r) => r.v === 'SMZ').id;
  const tMebelK = fK.royxat.turlar.find((r) => r.v === 'Mebel').id;
  tekshir('K: zavod ustunlari olib tashlanadi', undefined, narxQatorOchir(fK, 'zavodlar', idK).narx[idK]);
  tekshir('K: avval tur ustuni bor edi', true, Object.values(fK.narx).every((z) => Array.isArray(z[tMebelK])));
  const fK2 = narxQatorOchir(fK, 'turlar', tMebelK);
  tekshir('K: tur ustuni har zavoddan olib tashlanadi', true, Object.values(fK2.narx).every((z) => z[tMebelK] === undefined));
}

console.log(`\n${'='.repeat(46)}`);
console.log(xato === 0 ? `✅ HAMMASI O'TDI — ${jami} ta tekshiruv` : `❌ ${xato} / ${jami} TEKSHIRUV O'TMADI`);
console.log(`${'='.repeat(46)}\n`);
process.exit(xato === 0 ? 0 : 1);
