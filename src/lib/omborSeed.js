// ============================================================
//  OMBOR → RULONLAR — BOSHLANG'ICH (SEED) MA'LUMOTLAR
// ------------------------------------------------------------
//  Bu fayl FAQAT birinchi to'ldirish uchun. Ilova ishlaganda
//  hamma qiymat Firestore'dan o'qiladi — bu yerdagi raqamlar
//  hisob-kitobda ISHLATILMAYDI (qattiq narx yo'q degani).
//
//  Firestore kalitlari (loyihaning `shop/<kalit>` modeli):
//    'ombor-sozlama'   → { kurs, ustama, bolizvchi1, bolizvchi2,
//                          nom1, nom2, kgPerM, koefSMZ, koefBoshqa, kursSana }
//    'ombor-narxlar'   → { [id]: { id, zavod, tur, qalinlik, narx, sana, faol } }
//    'ombor-rulonlar'  → { [id]: { id, nomer, rang, zavod, tur, qalinlik,
//                                  ogirlik, uzunlik, xaridNarx, xaridKurs,
//                                  xaridSana, qoldiq, izoh, tasdiqlanmagan } }
//    'ombor-rang-tur'  → { qoidalar: [{ naqsh, tur }], standart }
//
//  Seed id lari BARQAROR (sana/tasodifga bog'liq emas) — shuning uchun
//  seedni ikki marta bossa ham DUBLIKAT chiqmaydi (bir xil id ustiga
//  yoziladi), qo'lda kiritilgan yozuvlarga esa tegmaydi.
// ============================================================

// ----- Ro'yxatlar (dropdownlar uchun; foydalanuvchi kengaytira oladi) -----
export const ZAVODLAR = ['SMZ', 'Aziya Steel', 'Master Class (Xitoy)', 'TMZ', 'Demir Master Prime'];

export const TURLAR = ['оцинковка', 'полимерка', 'хопёр', 'глянцевый', 'глянцевый (плёнка)', 'Мебел'];

export const RANGLAR = ['Mokriy', 'Oq', 'Qaymoq', 'Shokolad', 'Bordo', 'Somon', 'Granit', 'Qora', 'Sariq'];

// ----- settings/ombor — boshlang'ich sozlama -----
export const SOZLAMA_BOSHLANGICH = {
  kurs: 12000,        // dollar kursi, so'm
  ustama: 50,         // zavod ro'yxatiga qo'shiladigan $/tonna
  bolizvchi1: 0.95,   // 1-sotuv narxi = 1 m tannarx ÷ 0.95
  bolizvchi2: 0.90,   // 2-sotuv narxi = 1 m tannarx ÷ 0.90
  nom1: '5%',         // 1-ustun sarlavhasi
  nom2: '10%',        // 2-ustun sarlavhasi
  // Qalinlik → 1 m og'irligi (kg). SMZ listlari og'irroq chiqadi.
  kgPerM: {
    SMZ:    { '0.35': 3.27, '0.40': 3.74, '0.45': 4.23, '0.50': 4.63, '0.60': 5.44 },
    BOSHQA: { '0.35': 3.25, '0.40': 3.62, '0.45': 4.07, '0.50': 4.53, '0.60': 5.36 },
  },
  // Jadvalda yo'q qalinlik uchun: kg/m = qalinlik × koef
  koefSMZ: 9.35,
  koefBoshqa: 9.05,
  kursSana: '',       // kurs oxirgi marta qachon o'zgartirilgan
};

// ----- settings/rangTur — rang nomidan turni taxmin qilish -----
//  Qoidalar YUQORIDAN pastga tekshiriladi (birinchi mos kelgani olinadi),
//  hech biri mos kelmasa — `standart`.
export const RANG_TUR_BOSHLANGICH = {
  qoidalar: [
    { naqsh: 'atsenkovka', tur: 'оцинковка' },
    { naqsh: 'salafan',    tur: 'глянцевый (плёнка)' },
    { naqsh: 'plyonka',    tur: 'глянцевый (плёнка)' },
    { naqsh: 'yaltiroq',   tur: 'глянцевый' },
    { naqsh: 'xopyor',     tur: 'хопёр' },
    { naqsh: 'mebel',      tur: 'Мебел' },
  ],
  standart: 'полимерка',
};

// ============================================================
//  4.1 — NARX RO'YXATI (SMZ, 30.07.2026)
// ------------------------------------------------------------
//  Tuzilishi: [zavod, tur, { qalinlik: narx }]. Narx — ZAVOD
//  RO'YXATIDAGI TOZA narx ($/tonna), ustama QO'SHILMAGAN.
// ============================================================
export const NARX_SANA = '2026-07-30';

const NARX_JADVAL = [
  ['SMZ', 'оцинковка', {
    0.18: 1190, 0.20: 1180, 0.22: 1170, 0.25: 1160, 0.28: 1140, 0.30: 1130,
    0.33: 1110, 0.35: 1090, 0.37: 1070, 0.40: 1050, 0.45: 1040, 0.50: 1020,
    0.60: 1000, 0.70: 1000, 0.80: 990, 0.90: 990, 1.00: 990, 1.10: 990,
    1.20: 990, 1.40: 990, 1.50: 1010, 1.60: 1010, 1.80: 1050, 2.00: 1050,
    2.20: 1050, 2.50: 1050,
  }],
  ['SMZ', 'полимерка', {
    0.28: 1300, 0.30: 1300, 0.33: 1290, 0.35: 1290, 0.37: 1260, 0.40: 1240,
    0.45: 1210, 0.50: 1190, 0.60: 1180, 0.70: 1180,
  }],
  ['SMZ', 'хопёр', {
    0.28: 1340, 0.30: 1340, 0.33: 1340, 0.35: 1340, 0.37: 1330, 0.40: 1320,
    0.45: 1290, 0.50: 1280,
  }],
  ['SMZ', 'глянцевый', { 0.35: 1340, 0.40: 1290, 0.45: 1270 }],
  ['SMZ', 'глянцевый (плёнка)', { 0.35: 1440, 0.40: 1390, 0.45: 1370 }],
  ['SMZ', 'Мебел', { 0.30: 1430, 0.35: 1430 }],
  ['Aziya Steel', 'полимерка', {
    0.25: 1230, 0.28: 1220, 0.30: 1220, 0.33: 1210, 0.35: 1210,
    0.37: 1180, 0.40: 1180, 0.45: 1160, 0.50: 1160,
  }],
  ['Aziya Steel', 'хопёр', { 0.30: 1230, 0.35: 1220, 0.40: 1200, 0.45: 1180, 0.50: 1180 }],
  ['Master Class (Xitoy)', 'полимерка', {
    0.22: 1160, 0.25: 1150, 0.28: 1150, 0.30: 1140, 0.33: 1140,
    0.35: 1140, 0.37: 1130, 0.40: 1130, 0.45: 1120, 0.50: 1120,
  }],
  ['Master Class (Xitoy)', 'хопёр', { 0.30: 1190, 0.35: 1180, 0.40: 1170, 0.45: 1170, 0.50: 1170 }],
  // TMZ va Demir Master Prime — narxlari hozircha YO'Q (foydalanuvchi kiritadi).
];

// Barqaror id yasash uchun qisqartmalar
const ZAVOD_KOD = {
  SMZ: 'smz',
  'Aziya Steel': 'aziya',
  'Master Class (Xitoy)': 'mclass',
  TMZ: 'tmz',
  'Demir Master Prime': 'demir',
};
const TUR_KOD = {
  'оцинковка': 'ots',
  'полимерка': 'pol',
  'хопёр': 'xop',
  'глянцевый': 'gly',
  'глянцевый (плёнка)': 'plen',
  'Мебел': 'meb',
};

// Id: "n-smz-pol-040" — nuqtasiz (Firestore map kalitida nuqta chalkashtiradi)
export function narxId(zavod, tur, qalinlik) {
  const q = String(Math.round((Number(qalinlik) || 0) * 100)).padStart(3, '0');
  const z = ZAVOD_KOD[zavod] || String(zavod).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const t = TUR_KOD[tur] || 'x';
  return `n-${z}-${t}-${q}`;
}

// Narx yozuvlari massivi
export function seedNarxlar(sana = NARX_SANA) {
  const out = [];
  for (const [zavod, tur, jadval] of NARX_JADVAL) {
    for (const q of Object.keys(jadval)) {
      const qalinlik = Number(q);
      out.push({
        id: narxId(zavod, tur, qalinlik),
        zavod, tur, qalinlik,
        narx: jadval[q],
        sana,
        faol: true,
      });
    }
  }
  return out;
}

// ============================================================
//  4.3 — OMBORDAGI RULONLAR
//  [nomer, rang, qalinlik, zavod, tur, izoh]
//  Og'irlik / uzunlik / qoldiq — BO'SH (foydalanuvchi kiritadi).
// ============================================================
const RULON_JADVAL = [
  [1,  'Mokriy',            0.40, 'Master Class (Xitoy)', 'полимерка',          ''],
  [2,  'Mokriy',            0.40, 'SMZ',                  'полимерка',          ''],
  [3,  'Oq (yaltiroq)',     0.40, 'SMZ',                  'глянцевый',          ''],
  [4,  'Atsenkovka',        0.40, '',                     'оцинковка',          "zavod noma'lum"],
  [5,  'Somon',             0.45, 'SMZ',                  'полимерка',          "rang o'qilishi noaniq"],
  [6,  'Qaymoq',            0.40, 'Aziya Steel',          'полимерка',          ''],
  [7,  'MTC',               0.30, 'Demir Master Prime',   'полимерка',          "rang o'qilishi noaniq"],
  [8,  'Qaymoq',            0.30, 'Demir Master Prime',   'полимерка',          ''],
  [9,  'Atsenkovka',        0.30, '',                     'оцинковка',          "zavod noma'lum"],
  [10, 'Xopyor',            0.40, 'Master Class (Xitoy)', 'хопёр',              ''],
  [11, 'Oq',                0.40, '',                     'глянцевый (плёнка)', 'salafan'],
  [12, 'Bordo',             null, '',                     'полимерка',          "qalinlik yo'q"],
  [13, 'Shokolad',          0.35, 'Aziya Steel',          'полимерка',          ''],
  [14, 'Qaymoq',            0.35, 'SMZ',                  'полимерка',          ''],
  [15, 'Mokriy',            0.60, 'TMZ',                  'полимерка',          "narx ro'yxati yo'q"],
  [16, 'Oq (yaltiroq)',     0.40, 'SMZ',                  'глянцевый',          ''],
  [17, 'Mokriy (yaltiroq)', 0.22, '',                     'глянцевый',          "zavod noma'lum"],
  [18, 'Oq',                0.35, '',                     'полимерка',          "zavod noma'lum"],
  [19, 'Qaymoq',            0.40, '',                     'глянцевый (плёнка)', 'salafan'],
  [20, 'Shokolad',          0.28, 'Demir Master Prime',   'полимерка',          ''],
  [21, 'Shokolad',          0.40, 'Master Class (Xitoy)', 'полимерка',          ''],
  [22, 'Mokriy',            0.35, 'Master Class (Xitoy)', 'полимерка',          ''],
  [23, 'Oq Granit',         null, '',                     'полимерка',          "qalinlik yo'q"],
  [24, 'Qora mebel',        null, '',                     'Мебел',              "qalinlik yo'q"],
  [25, 'Sariq mebel',       null, '',                     'Мебел',              "qalinlik yo'q"],
  [26, 'Oq',                0.30, 'Aziya Steel',          'полимерка',          ''],
];

// Zavod/tur/qalinlik noaniq bo'lgan rulonlar — qatori och-sariq fonda
const TASDIQLANMAGAN = new Set([4, 5, 7, 9, 11, 12, 15, 17, 18, 19, 23, 24, 25]);

export const rulonId = (nomer) => `r-${String(nomer).padStart(3, '0')}`;

export function seedRulonlar() {
  return RULON_JADVAL.map(([nomer, rang, qalinlik, zavod, tur, izoh]) => ({
    id: rulonId(nomer),
    nomer,
    rang,
    zavod: zavod || '',
    tur: tur || '',
    qalinlik: qalinlik == null ? '' : qalinlik,
    ogirlik: '',      // foydalanuvchi kiritadi
    uzunlik: '',      // bo'sh bo'lsa kg/m orqali hisoblanadi
    qoldiq: '',       // boshlanishida = uzunlik
    xaridNarx: null,
    xaridKurs: null,
    xaridSana: null,
    izoh: izoh || '',
    tasdiqlanmagan: TASDIQLANMAGAN.has(nomer),
  }));
}

// ----- Massivni obyekt-xaritaga aylantirish (Firestore merge modeli) -----
export function xaritaga(massiv) {
  const out = {};
  for (const x of massiv) out[x.id] = x;
  return out;
}

// ----- To'liq seed to'plami (yozuvchi shu obyektni Firestore'ga yozadi) -----
export function seedToplam(sana = NARX_SANA) {
  return {
    'ombor-sozlama':  SOZLAMA_BOSHLANGICH,
    'ombor-narxlar':  xaritaga(seedNarxlar(sana)),
    'ombor-rulonlar': xaritaga(seedRulonlar()),
    'ombor-rang-tur': RANG_TUR_BOSHLANGICH,
  };
}
