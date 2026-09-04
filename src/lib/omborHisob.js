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

// ----- Zavod guruhi (og'irlik jadvali uchun) -----
//  SMZ zavodi listlari boshqalardan OG'IRROQ chiqadi, shuning uchun
//  kg/m jadvali ikki guruhga bo'lingan: 'SMZ' va 'BOSHQA'.
export function zavodGuruh(zavod) {
  // Nomi qo'lda yozilgan bo'lishi mumkin ("SMZ zavod", "smz-2") — shuning uchun
  // aniq tenglik emas, alohida so'z sifatida qidiramiz.
  return /(^|\s|-)smz($|\s|-)/.test(norm(zavod)) ? 'SMZ' : 'BOSHQA';
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

// 1 metr listning og'irligi (kg/m).
//  Avval sozlamadagi kgPerM jadvalidan; jadvalda yo'q qalinlik uchun
//  chiziqli koeffitsient (kgPerM = qalinlik × koef) ishlatiladi.
//  Ikkalasi ham bo'lmasa — null (hisoblab bo'lmaydi).
export function kgPerMetr(sozlama, zavod, qalinlik) {
  const q = son(qalinlik);
  if (!musbat(q)) return null;
  const guruh = zavodGuruh(zavod);
  const jadval = ((sozlama && sozlama.kgPerM) || {})[guruh];
  const jadvaldan = jadvalQiymat(jadval, q);
  if (musbat(jadvaldan)) return jadvaldan;
  const koef = son(guruh === 'SMZ' ? sozlama && sozlama.koefSMZ : sozlama && sozlama.koefBoshqa);
  return musbat(koef) ? q * koef : null;
}

// ----- Ogohlantirish kodlari (3.4-bo'lim) -----
export const OGOH = {
  NARX_YOQ:   'narxYoq',    // narx yoki kurs kiritilmagan — hisoblab bo'lmaydi
  UZUNLIK_YOQ:'uzunlikYoq', // uzunlik kiritilmagan va kg/m dan ham chiqmadi
  QALINLIK:   'qalinlik',   // o'lchangan kg/m jadvaldagidan ±5% dan ko'p farq qiladi
  TASDIQSIZ:  'tasdiqsiz',  // zavod/tur/qalinlik noaniq
};

// O'lchangan va kutilgan kg/m orasidagi ruxsat etilgan farq (±5 %)
export const KG_M_CHEK = 0.05;

// ----- ASOSIY: bitta rulonni to'liq hisoblash -----
//  rulon — { nomer, sana, zavod (kimdan), tur, rang, qalinlik,
//            ogirlik (kg), narxTonna ($/t), kurs (so'm/$), uzunlik (m),
//            yolkiraTonna ($/t yoki null = standart), qoldiq, izoh, tasdiqlanmagan }
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

  // 5) Uzunlik: kiritilgan bo'lsa o'sha (rulon ichidagi qog'ozdan),
  //    bo'lmasa og'irlikdan kg/m jadvali orqali — FAQAT zaxira, "≈" bilan ko'rsatiladi
  const kgM = kgPerMetr(sozlama, r.zavod, qalinlik);
  const kiritilganUzunlik = son(r.uzunlik);
  const hisobUzunlik = (musbat(ogirlik) && musbat(kgM)) ? ogirlik / kgM : null;
  const uzunlik = musbat(kiritilganUzunlik) ? kiritilganUzunlik : hisobUzunlik;
  const uzunlikHisoblangan = !musbat(kiritilganUzunlik) && musbat(hisobUzunlik);

  // 6) 1 m tannarxi so'm
  const metrTannarx = (jamiSom != null && musbat(uzunlik)) ? jamiSom / uzunlik : null;

  // 7-8) Sotuv narxlari (bo'luvchi 0 bo'lsa — hisoblanmaydi)
  const b1 = son(sozlama.bolizvchi1);
  const b2 = son(sozlama.bolizvchi2);
  const sotuv1 = (metrTannarx != null && musbat(b1)) ? metrTannarx / b1 : null;
  const sotuv2 = (metrTannarx != null && musbat(b2)) ? metrTannarx / b2 : null;

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

  // Uzunlik yo'q va hisoblab ham bo'lmadi — 1 m tannarx chiqmaydi
  if (musbat(ogirlik) && !musbat(uzunlik)) {
    ogohlar.push({
      kod: OGOH.UZUNLIK_YOQ, daraja: 'toq',
      matn: "Uzunlik kiritilmagan (rulon ichidagi qog'ozda yozilgan bo'ladi)",
    });
  }

  // O'lchangan kg/m jadvaldagidan ±5 % dan ko'p farq qilsa — qalinlik yoki
  // uzunlik noto'g'ri yozilgan bo'lishi mumkin. FAQAT uzunlik QO'LDA kiritilgan
  // bo'lsa tekshiriladi (hisoblangan uzunlikda farq ta'rifi bo'yicha 0).
  let olchanganKgM = null;
  if (musbat(ogirlik) && musbat(kiritilganUzunlik)) {
    olchanganKgM = ogirlik / kiritilganUzunlik;
    if (musbat(kgM) && Math.abs(olchanganKgM - kgM) / kgM > KG_M_CHEK) {
      ogohlar.push({
        kod: OGOH.QALINLIK, daraja: 'toq',
        matn: `Qalinlik yoki uzunlik mos emas shekilli (o'lchangan ${olchanganKgM.toFixed(2)} kg/m, kutilgan ${kgM.toFixed(2)} kg/m)`,
      });
    }
  }

  return {
    narxTonna, kurs, yolkiraTonna, yolkiraStandart,
    rulonDollar, rulonSom, yolkiraDollar, yolkiraSom, jamiDollar, jamiSom,
    uzunlik, uzunlikHisoblangan, hisobUzunlik,
    metrTannarx, sotuv1, sotuv2,
    qoldiq, qoldiqQiymat,
    kgM, olchanganKgM,
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
