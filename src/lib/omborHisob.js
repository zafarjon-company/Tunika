// ============================================================
//  OMBOR → RULONLAR — HISOBLASH YADROSI (sof funksiyalar)
// ------------------------------------------------------------
//  Bu faylda React YO'Q — faqat matematika. Shuning uchun uni
//  brauzersiz (node) ham sinash mumkin: `node src/lib/omborHisob.test.mjs`.
//
//  QAT'IY QOIDA: bu yerda birorta ham narx/kurs/koeffitsient
//  QATTIQ YOZILMAGAN. Hammasi rulon yozuvi va `sozlama` orqali
//  tashqaridan (Firestore'dan) keladi.
//
//  MODEL — foydalanuvchining daftaridagidek: har rulon uchun
//  SOTIB OLINGAN narx va o'sha kungi kurs yoziladi (zavod narx
//  ro'yxati yo'q). Hisob zanjiri (aynan shu tartibda):
//    1) rulon $      = ogirlik / 1000 × narxTonna   (rulonda yozilgan $/t)
//    2) rulon so'm   = rulon $ × kurs               (rulonda yozilgan kurs)
//    3) yo'lkira $   = ogirlik / 1000 × yolkiraTonna (rulonda; bo'lmasa
//                      sozlamadagi standart, masalan 10 $/t)
//    4) jami so'm    = rulon so'm + yo'lkira so'm
//    5) uzunlik      = kiritilgani (rulon ichidagi qog'ozdan);
//                      bo'lmasa ogirlik / (kg/m) — faqat zaxira
//    6) 1 m tannarx  = jami so'm ÷ uzunlik
//    7) sotuv 1      = 1 m tannarx ÷ sozlama.bolizvchi1  (masalan 0.95)
//    8) sotuv 2      = 1 m tannarx ÷ sozlama.bolizvchi2  (masalan 0.90)
//
//  YAXLITLASH: oraliq hisoblarda YO'Q. Yaxlitlash faqat
//  ko'rsatishda (fmt / Math.round) qilinadi.
// ============================================================

// ----- Kichik yordamchilar -----

// Har qanday kiritmani songa aylantiradi (vergul ham tushunarli).
// Bo'sh / yaroqsiz -> null (0 dan farqli: "kiritilmagan" degani).
export function son(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[\s  ]/g, '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
}

// Musbat sonmi (0 va null — yo'q)
const musbat = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

// Matnni solishtirish uchun normallashtirish: registr, apostrof va
// ortiqcha bo'shliqlar farq qilmasin ("Aziya Steel" == "aziya  steel").
export function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/['`’ʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Qalinliklar teng deb hisoblanadimi (0.40 === 0.4 === "0,40")
const QAL_EPS = 1e-9;
export function qalinlikTeng(a, b) {
  const x = son(a);
  const y = son(b);
  if (x == null || y == null) return false;
  return Math.abs(x - y) < QAL_EPS;
}

// Jadvaldan qalinlik bo'yicha qiymat olish. Kalitlar matn ("0.40"), kiritma
// esa son (0.4) bo'lishi mumkin — shuning uchun son sifatida solishtiramiz.
function jadvalQiymat(jadval, qalinlik) {
  const q = son(qalinlik);
  if (q == null || !jadval || typeof jadval !== 'object') return null;
  for (const kalit of Object.keys(jadval)) {
    if (qalinlikTeng(kalit, q)) {
      const v = son(jadval[kalit]);
      if (musbat(v)) return v;
    }
  }
  return null;
}

// Qalinlikni ko'rsatish: HAR DOIM verguldan keyin ikki xona ("0.40", "0.45",
// "1.00") — do'konda shunday o'rganilgan. Kasri ko'proq bo'lsa (0.225) o'zicha.
export function qalKor(q) {
  const n = son(q);
  if (n == null) return '';
  const kasr = (String(n).split('.')[1] || '').length;
  return kasr > 2 ? String(n) : n.toFixed(2);
}

// ----- Zavod narx jadvali ($/tonna) -----
//  sozlama.narxJadval = { [zavod]: { [tur]: { [qalinlik]: narx } } } — zavodning
//  narx varaqasi (rasmdagi jadval) sozlamada saqlanadi va interfeysdan
//  tahrirlanadi. Zavod va tur nomlari norm() bilan (registr / apostrof
//  farqisiz), qalinlik son sifatida ("0,40" === 0.4) solishtiriladi.
//
//  MUHIM: jadval FAQAT yangi rulon kiritishda narxni TAKLIF qiladi. Hisob
//  uchun asos — rulonning o'zida yozilgan narx (xarid paytidagi). Varaqa
//  yangilansa eski rulonlar o'zgarmaydi — daftardagidek.

// Obyektda nomi norm() bo'yicha mos kalitni topish (saqlangan yozuvi bilan)
export function kalitTop(obj, nom) {
  const n = norm(nom);
  if (!n || !obj || typeof obj !== 'object') return null;
  for (const k of Object.keys(obj)) if (norm(k) === n) return k;
  return null;
}

// Zavod + tur uchun qalinlik → narx ustuni (yo'q bo'lsa null)
function narxUstun(sozlama, zavod, tur) {
  const jadval = sozlama && sozlama.narxJadval;
  const zk = kalitTop(jadval, zavod);
  if (zk == null) return null;
  const tk = kalitTop(jadval[zk], tur);
  if (tk == null) return null;
  const ustun = jadval[zk][tk];
  return (ustun && typeof ustun === 'object') ? ustun : null;
}

// Jadvaldan narx ($/t). Zavod, tur yoki qalinlik topilmasa — null.
export function narxTop(sozlama, zavod, tur, qalinlik) {
  const ustun = narxUstun(sozlama, zavod, tur);
  return ustun ? jadvalQiymat(ustun, qalinlik) : null;
}

// Zavod + tur uchun jadvaldagi qalinliklar (son, o'sish tartibida) —
// formada tez tanlash uchun. Narxi yo'q / nol qatorlar tushib qoladi.
export function jadvalQalinliklar(sozlama, zavod, tur) {
  const ustun = narxUstun(sozlama, zavod, tur);
  if (!ustun) return [];
  const out = new Set();
  for (const k of Object.keys(ustun)) {
    const q = son(k);
    if (musbat(q) && musbat(son(ustun[k]))) out.add(q);
  }
  return [...out].sort((a, b) => a - b);
}

// ----- Ogohlantirish kodlari (3.4-bo'lim) -----
export const OGOH = {
  NARX_YOQ:   'narxYoq',    // narx yoki kurs kiritilmagan — hisoblab bo'lmaydi
  UZUNLIK_YOQ:'uzunlikYoq', // uzunlik kiritilmagan — 1 m tannarx chiqmaydi
  TASDIQSIZ:  'tasdiqsiz',  // zavod/tur/qalinlik noaniq
};

// ----- ASOSIY: bitta rulonni to'liq hisoblash -----
//  rulon — { nomer, sana, zavod (kimdan), tur, rang, qalinlik,
//            ogirlik (kg), narxTonna ($/t), kurs (so'm/$), uzunlik (m),
//            yolkiraTonna ($/t yoki null = standart), qoldiq, izoh, tasdiqlanmagan,
//            narx1, narx2 — foydalanuvchi KIRITGAN (yaxlitlangan) sotuv narxlari }
//  ctx   — { sozlama }
//  Natija — barcha oraliq qiymatlar YAXLITLANMAGAN holda.
//  Hisoblab bo'lmagan qiymat = null (0 emas! "0 so'm" deb ko'rsatilmasin).
export function rulonHisob(rulon, ctx = {}) {
  const r = rulon || {};
  const sozlama = ctx.sozlama || {};

  const ogirlik  = son(r.ogirlik);
  const qalinlik = son(r.qalinlik);
  // Narx va kurs — HAR RULON uchun alohida (sotib olingan kungi). Eski maydon
  // nomlari (xaridNarx / xaridKurs) ham o'qiladi — avvalgi yozuvlar yo'qolmasin.
  const narxTonna = son(r.narxTonna) ?? son(r.xaridNarx);
  const kurs      = son(r.kurs) ?? son(r.xaridKurs);
  // Yo'lkira $/t: rulonda yozilgan bo'lsa o'sha, bo'lmasa sozlamadagi standart.
  // 0 — yo'lkirasiz (masalan o'zi olib kelgan). Manfiy bo'lmaydi.
  const yolkiraXom = son(r.yolkiraTonna);
  const yolkiraTonna = Math.max(0, yolkiraXom ?? son(sozlama.yolkiraTonna) ?? 0);
  const yolkiraStandart = yolkiraXom == null;   // ko'rsatishda "standart" deb belgilash uchun

  const tonna = musbat(ogirlik) ? ogirlik / 1000 : null;

  // 1) Rulon narxi $
  const rulonDollar = (tonna != null && musbat(narxTonna)) ? tonna * narxTonna : null;
  // 2) Rulon narxi so'm
  const rulonSom = (rulonDollar != null && musbat(kurs)) ? rulonDollar * kurs : null;
  // 3) Yo'lkira ($ va so'm) — og'irlik bo'lsa hisoblanadi (narxsiz ham)
  const yolkiraDollar = tonna != null ? tonna * yolkiraTonna : null;
  const yolkiraSom = (yolkiraDollar != null && musbat(kurs)) ? yolkiraDollar * kurs : null;
  // 4) Jami so'm — tannarx asosi (yo'lkira ham kiradi: bu rulonning haqiqiy xarajati)
  const jamiSom = rulonSom != null ? rulonSom + (yolkiraSom || 0) : null;
  const jamiDollar = rulonDollar != null ? rulonDollar + (yolkiraDollar || 0) : null;

  // 5) Uzunlik — FAQAT kiritilgani (rulon ichidagi qog'ozdan). Og'irlikdan
  //    taxmin qilinmaydi: kiritilmasa 1 m tannarx chiqmaydi va ogoh beriladi.
  const kiritilganUzunlik = son(r.uzunlik);
  const uzunlik = musbat(kiritilganUzunlik) ? kiritilganUzunlik : null;

  // 6) 1 m tannarxi so'm
  const metrTannarx = (jamiSom != null && musbat(uzunlik)) ? jamiSom / uzunlik : null;

  // 7-8) Sotuv narxlari: HISOBLANGANI (tannarx ÷ bo'luvchi) va foydalanuvchi
  //    KIRITGANI (yaxlitlangan, masalan 61 476 → 62 000). Ro'yxat va hisobda
  //    kiritilgani ustun turadi; kiritilmagan bo'lsa hisoblangani olinadi.
  const b1 = son(sozlama.bolizvchi1);
  const b2 = son(sozlama.bolizvchi2);
  const sotuv1Hisob = (metrTannarx != null && musbat(b1)) ? metrTannarx / b1 : null;
  const sotuv2Hisob = (metrTannarx != null && musbat(b2)) ? metrTannarx / b2 : null;
  const narx1 = son(r.narx1);
  const narx2 = son(r.narx2);
  const sotuv1Qolda = musbat(narx1);
  const sotuv2Qolda = musbat(narx2);
  const sotuv1 = sotuv1Qolda ? narx1 : sotuv1Hisob;
  const sotuv2 = sotuv2Qolda ? narx2 : sotuv2Hisob;

  // Rulonning ombordagi qoldig'i (kiritilmagan bo'lsa — uzunlikka teng)
  const qoldiqXom = son(r.qoldiq);
  const qoldiq = qoldiqXom != null ? qoldiqXom : (musbat(uzunlik) ? uzunlik : null);
  // Qoldiqdagi mahsulotning tannarx bo'yicha qiymati (jami qatori uchun)
  const qoldiqQiymat = (metrTannarx != null && qoldiq != null) ? metrTannarx * qoldiq : null;

  // ----- Ogohlantirishlar -----
  const ogohlar = [];

  if (r.tasdiqlanmagan) {
    ogohlar.push({
      kod: OGOH.TASDIQSIZ, daraja: 'sariq',
      matn: 'Zavod / tur / qalinlik tasdiqlanmagan — tekshiring',
    });
  }

  // Narx yoki kurs yo'q — pul hisoblanmaydi
  if (musbat(ogirlik) && (!musbat(narxTonna) || !musbat(kurs))) {
    const yetishmaydi = [!musbat(narxTonna) && 'narx ($/t)', !musbat(kurs) && 'kurs'].filter(Boolean).join(' va ');
    ogohlar.push({ kod: OGOH.NARX_YOQ, daraja: 'toq', matn: `Kiritilmagan: ${yetishmaydi}` });
  }

  // Uzunlik yo'q — 1 m tannarx chiqmaydi
  if (musbat(ogirlik) && !musbat(uzunlik)) {
    ogohlar.push({
      kod: OGOH.UZUNLIK_YOQ, daraja: 'toq',
      matn: "Uzunlik kiritilmagan (rulon ichidagi qog'ozda yozilgan bo'ladi)",
    });
  }

  return {
    narxTonna, kurs, yolkiraTonna, yolkiraStandart,
    rulonDollar, rulonSom, yolkiraDollar, yolkiraSom, jamiDollar, jamiSom,
    uzunlik,
    metrTannarx, sotuv1, sotuv2, sotuv1Hisob, sotuv2Hisob, sotuv1Qolda, sotuv2Qolda,
    qoldiq, qoldiqQiymat,
    ogohlar,
    // Qator fonini tanlash uchun eng "og'ir" daraja
    daraja: ogohlar.some((o) => o.daraja === 'qizil') ? 'qizil'
      : ogohlar.some((o) => o.daraja === 'toq') ? 'toq'
      : ogohlar.some((o) => o.daraja === 'sariq') ? 'sariq'
      : '',
  };
}

// ----- Butun ro'yxatni hisoblash -----
//  rulonlar — massiv yoki obyekt-xarita. Natija: [{ ...rulon, h: <hisob> }]
//  Tartib: `nomer` bo'yicha o'sish (nomeri yo'qlar oxirida).
export function rulonRoyxat(rulonlar) {
  const xom = Array.isArray(rulonlar) ? rulonlar : Object.values(rulonlar || {});
  return xom
    .filter((r) => r && typeof r === 'object' && r.id && !r.ochirilgan)
    .sort((a, b) => (son(a.nomer) ?? 1e9) - (son(b.nomer) ?? 1e9));
}

export function hisobla(rulonlar, ctx) {
  return rulonRoyxat(rulonlar).map((r) => ({ ...r, h: rulonHisob(r, ctx) }));
}

// ----- Jami qatori (3.1 → 6-talab) -----
//  qatorlar — hisobla() natijasi (yoki filtrlangan qismi).
export function jamiHisob(qatorlar = []) {
  let ogirlik = 0;   // kg
  let qoldiq = 0;    // m
  let qiymat = 0;    // so'm (qoldiqdagi mahsulot tannarxi)
  let uzunlik = 0;   // m (rulonlarning to'liq uzunligi)
  let jamiSom = 0;   // so'm (rulonlarga to'langan jami, yo'lkira bilan)
  let jamiDollar = 0;
  let rulonDollar = 0;   // $ (faqat rulon narxi, yo'lkirasiz)
  let rulonSom = 0;      // so'm (faqat rulon narxi, yo'lkirasiz)
  let yolkiraDollar = 0; // $ (faqat yo'lkira)
  let yolkiraSom = 0;
  const ol = (q, nom) => (q.h && q.h[nom] != null) ? q.h[nom] : 0;
  for (const q of qatorlar) {
    ogirlik += son(q.ogirlik) || 0;
    uzunlik += (q.h && musbat(q.h.uzunlik)) ? q.h.uzunlik : 0;
    qoldiq  += ol(q, 'qoldiq');
    qiymat  += ol(q, 'qoldiqQiymat');
    jamiSom += ol(q, 'jamiSom');
    jamiDollar += ol(q, 'jamiDollar');
    rulonDollar += ol(q, 'rulonDollar');
    rulonSom += ol(q, 'rulonSom');
    yolkiraDollar += ol(q, 'yolkiraDollar');
    yolkiraSom += ol(q, 'yolkiraSom');
  }
  return {
    soni: qatorlar.length, ogirlik, uzunlik, qoldiq, qiymat,
    jamiSom, jamiDollar, rulonDollar, rulonSom, yolkiraDollar, yolkiraSom,
  };
}

// ----- Rang → tur taxmini (4.2-bo'lim) -----
//  rangTur — { qoidalar: [{ naqsh, tur }], standart: '<tur>' } — Firestore'dan,
//  tahrirlanadi. Mos qoida topilmasa `standart` qaytadi.
export function turTaxmin(rangTur, rang) {
  const r = norm(rang);
  if (!r) return (rangTur && rangTur.standart) || '';
  for (const q of ((rangTur && rangTur.qoidalar) || [])) {
    if (!q || !q.naqsh) continue;
    if (r.includes(norm(q.naqsh))) return q.tur || '';
  }
  return (rangTur && rangTur.standart) || '';
}
