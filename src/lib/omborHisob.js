// ============================================================
//  OMBOR → RULONLAR — HISOBLASH YADROSI (sof funksiyalar)
// ------------------------------------------------------------
//  Bu faylda React YO'Q — faqat matematika. Shuning uchun uni
//  brauzersiz (node) ham sinash mumkin: `node src/lib/omborHisob.test.mjs`.
//
//  QAT'IY QOIDA: bu yerda birorta ham narx/kurs/koeffitsient
//  QATTIQ YOZILMAGAN. Hammasi `sozlama` va `narxlar` orqali
//  tashqaridan (Firestore'dan) keladi.
//
//  Hisob zanjiri (aynan shu tartibda):
//    1) zavod narxi  = narx ro'yxatidan (zavod + tur + qalinlik, faol)
//    2) yangi narx $/t = zavod narxi + sozlama.ustama
//    3) rulon $      = ogirlik / 1000 × yangi narx
//    4) rulon so'm   = rulon $ × sozlama.kurs
//    5) uzunlik      = kiritilgani; bo'lmasa ogirlik / (kg/m)
//    6) 1 m tannarx  = rulon so'm ÷ uzunlik
//    7) sotuv 1      = 1 m tannarx ÷ sozlama.bolizvchi1
//    8) sotuv 2      = 1 m tannarx ÷ sozlama.bolizvchi2
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

// ----- Narx ro'yxatidan mos yozuvni topish -----
//  narxlar — massiv yoki obyekt-xarita ({id: yozuv}). Faqat `faol !== false`
//  yozuvlar hisobga olinadi (eski narxlar tarixi saqlanadi, lekin ishlatilmaydi).
//  Bir nechta mos kelsa — SANASI eng yangisi olinadi.
export function narxRoyxat(narxlar) {
  const xom = Array.isArray(narxlar) ? narxlar : Object.values(narxlar || {});
  return xom.filter((n) => n && typeof n === 'object' && !n.ochirilgan);
}

export function narxTop(narxlar, zavod, tur, qalinlik) {
  const z = norm(zavod);
  const t = norm(tur);
  if (!z || !t || !musbat(son(qalinlik))) return null;
  let eng = null;
  for (const n of narxRoyxat(narxlar)) {
    if (n.faol === false) continue;
    if (norm(n.zavod) !== z || norm(n.tur) !== t) continue;
    if (!qalinlikTeng(n.qalinlik, qalinlik)) continue;
    if (!musbat(son(n.narx))) continue;
    if (!eng || String(n.sana || '') > String(eng.sana || '')) eng = n;
  }
  return eng;
}

// ----- Ogohlantirish kodlari (3.4-bo'lim) -----
export const OGOH = {
  NARX_YOQ:   'narxYoq',    // narx ro'yxatida mos yozuv yo'q
  ARZONLADI:  'arzonladi',  // yangi narx xarid narxidan past
  QALINLIK:   'qalinlik',   // o'lchangan kg/m jadvaldagidan ±5% dan ko'p farq qiladi
  TASDIQSIZ:  'tasdiqsiz',  // zavod/tur/qalinlik noaniq
};

// O'lchangan va kutilgan kg/m orasidagi ruxsat etilgan farq (±5 %)
export const KG_M_CHEK = 0.05;

// ----- ASOSIY: bitta rulonni to'liq hisoblash -----
//  rulon   — { rang, zavod, tur, qalinlik, ogirlik, uzunlik, qoldiq,
//              xaridNarx, xaridKurs, xaridSana, izoh, tasdiqlanmagan }
//  ctx     — { sozlama, narxlar }
//  Natija — barcha oraliq qiymatlar YAXLITLANMAGAN holda.
//  Hisoblab bo'lmagan qiymat = null (0 emas! "0 so'm" deb ko'rsatilmasin).
export function rulonHisob(rulon, ctx = {}) {
  const r = rulon || {};
  const sozlama = ctx.sozlama || {};
  const narxlar = ctx.narxlar || [];

  const ogirlik  = son(r.ogirlik);
  const qalinlik = son(r.qalinlik);
  const kurs     = son(sozlama.kurs);
  const ustama   = son(sozlama.ustama) || 0;

  // 1) Zavod narxi
  const narxYozuv = narxTop(narxlar, r.zavod, r.tur, qalinlik);
  const zavodNarx = narxYozuv ? son(narxYozuv.narx) : null;

  // 2) Yangi narx $/t (zavod ro'yxati + ustama)
  const yangiNarx = musbat(zavodNarx) ? zavodNarx + ustama : null;

  // 3) Rulon narxi $
  const rulonDollar = (musbat(ogirlik) && musbat(yangiNarx))
    ? (ogirlik / 1000) * yangiNarx
    : null;

  // 4) Rulon narxi so'm
  const rulonSom = (rulonDollar != null && musbat(kurs)) ? rulonDollar * kurs : null;

  // 5) Uzunlik: kiritilgan bo'lsa o'sha, bo'lmasa og'irlikdan hisoblanadi
  const kgM = kgPerMetr(sozlama, r.zavod, qalinlik);       // kutilgan (jadvaldan)
  const kiritilganUzunlik = son(r.uzunlik);
  const hisobUzunlik = (musbat(ogirlik) && musbat(kgM)) ? ogirlik / kgM : null;
  const uzunlik = musbat(kiritilganUzunlik) ? kiritilganUzunlik : hisobUzunlik;
  const uzunlikHisoblangan = !musbat(kiritilganUzunlik) && musbat(hisobUzunlik);

  // 6) 1 m tannarxi so'm
  const metrTannarx = (rulonSom != null && musbat(uzunlik)) ? rulonSom / uzunlik : null;

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

  // ----- Ogohlantirishlar (3.4-bo'lim) -----
  const ogohlar = [];

  if (r.tasdiqlanmagan) {
    ogohlar.push({
      kod: OGOH.TASDIQSIZ, daraja: 'sariq',
      matn: 'Zavod / tur / qalinlik tasdiqlanmagan — tekshiring',
    });
  }

  // Zavod yoki tur umuman ko'rsatilmagan bo'lsa ham narx topilmaydi
  if (!narxYozuv) {
    ogohlar.push({
      kod: OGOH.NARX_YOQ, daraja: 'toq',
      matn: "Bu zavod/tur/qalinlik narx ro'yxatida yo'q",
    });
  }

  // Yangi narx xarid narxidan past — turi noto'g'ri yozilgan bo'lishi mumkin
  const xaridNarx = son(r.xaridNarx);
  if (musbat(xaridNarx) && musbat(yangiNarx) && yangiNarx < xaridNarx) {
    ogohlar.push({
      kod: OGOH.ARZONLADI, daraja: 'qizil',
      matn: `Yangi narx eski narxdan past (${Math.round(yangiNarx)} $ < ${Math.round(xaridNarx)} $) — turini tekshiring`,
    });
  }

  // O'lchangan kg/m jadvaldagidan ±5 % dan ko'p farq qilsa — qalinlik mos emas.
  // FAQAT uzunlik QO'LDA kiritilgan bo'lsa tekshiriladi (hisoblangan uzunlikda
  // o'lchangan qiymat ta'rifi bo'yicha jadvalga aynan teng chiqadi).
  let olchanganKgM = null;
  if (musbat(ogirlik) && musbat(kiritilganUzunlik)) {
    olchanganKgM = ogirlik / kiritilganUzunlik;
    if (musbat(kgM) && Math.abs(olchanganKgM - kgM) / kgM > KG_M_CHEK) {
      ogohlar.push({
        kod: OGOH.QALINLIK, daraja: 'toq',
        matn: `Qalinlik mos emas shekilli (o'lchangan ${olchanganKgM.toFixed(2)} kg/m, kutilgan ${kgM.toFixed(2)} kg/m)`,
      });
    }
  }

  return {
    zavodNarx, yangiNarx, rulonDollar, rulonSom,
    uzunlik, uzunlikHisoblangan, hisobUzunlik,
    metrTannarx, sotuv1, sotuv2,
    qoldiq, qoldiqQiymat,
    kgM, olchanganKgM,
    narxYozuv,
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
  for (const q of qatorlar) {
    ogirlik += son(q.ogirlik) || 0;
    uzunlik += (q.h && musbat(q.h.uzunlik)) ? q.h.uzunlik : 0;
    qoldiq  += (q.h && q.h.qoldiq != null) ? q.h.qoldiq : 0;
    qiymat  += (q.h && q.h.qoldiqQiymat != null) ? q.h.qoldiqQiymat : 0;
  }
  return { soni: qatorlar.length, ogirlik, uzunlik, qoldiq, qiymat };
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
