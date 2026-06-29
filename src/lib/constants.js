// ============================================================
//  KONSTANTALAR VA BOSHLANG'ICH BAZA
// ============================================================

export const DEFAULT_TUNIKA_BAZA = [
  { id: 't1',  nomi: "Ko'k SMZ",           qalinlik: "0.45", optom: 61500, chakana: 65000 },
  { id: 't2',  nomi: "Yashil SMZ",         qalinlik: "0.40", optom: 49000, chakana: 51500 },
  { id: 't3',  nomi: "Xapyor SMZ",         qalinlik: "0.40", optom: 60000, chakana: 63000 },
  { id: 't4',  nomi: "Oq SMZ",             qalinlik: "0.40", optom: 49000, chakana: 52000 },
  { id: 't5',  nomi: "Oq SMZ",             qalinlik: "0.35", optom: 44500, chakana: 47000 },
  { id: 't6',  nomi: "Mokriy SMZ",         qalinlik: "0.40", optom: 49000, chakana: 52000 },
  { id: 't7',  nomi: "Oq yaltiroq SMZ",    qalinlik: "0.40", optom: 57000, chakana: 60000 },
  { id: 't8',  nomi: "Qora SMZ",           qalinlik: "0.35", optom: 59000, chakana: 62000 },
  { id: 't9',  nomi: "Oq plyonka SMZ",     qalinlik: "0.40", optom: 56000, chakana: 60000 },
  { id: 't10', nomi: "Qaymoq plyonka SMZ", qalinlik: "0.40", optom: 65000, chakana: 68000 },
];

export const DEFAULT_LATOK = {
  bolish1: 4, razmer1: "31.2 sm",
  bolish2: 3, razmer2: "41.6 sm",
  ustaHaqqi: 3000,
};

export const DEFAULT_SHOP_NAME = "Tunika";
export const BOSHQA_USTA = { id: 'boshqa', name: 'Boshqa', phones: [''] };

export const DEFAULT_PRODUCTS = [
  { id: 'tunika',     name: 'Tunika (list)', type: 'metr', hasSplitting: false },
  { id: 'profnastil', name: 'Profnastil',    type: 'metr', hasSplitting: false, hasStanok: true },
];

// Boshlang'ich aksessuarlar (tartibi muhim — savdoda ham shu tartibda ko'rinadi)
// birlik: 'dona' yoki 'kg' (Semichka va Tom samarez — kilo)
export const DEFAULT_AKSESSUARLAR = [
  { id: 'a1',  nomi: "Varyonka (o'rta)",          narx: 15000, birlik: 'dona' },
  { id: 'a2',  nomi: 'Varyonka burchak (tashqi)', narx: 0,     birlik: 'dona' },
  { id: 'a3',  nomi: 'Varyonka burchak (Ichki)',  narx: 25000, birlik: 'dona' },
  { id: 'a4',  nomi: 'Til',                        narx: 15000, birlik: 'dona' },
  { id: 'a5',  nomi: 'Xomid (Gigurali)',          narx: 6000,  birlik: 'dona' },
  { id: 'a6',  nomi: 'Xomid (Oddiy)',             narx: 4000,  birlik: 'dona' },
  { id: 'a7',  nomi: 'Germetika (Dayson)',        narx: 25000, birlik: 'dona' },
  { id: 'a8',  nomi: 'Germetika (FLYMAX)',        narx: 0,     birlik: 'dona' },
  { id: 'a9',  nomi: 'Semichka (1.6)',            narx: 0,     birlik: 'kg' },
  { id: 'a10', nomi: 'Semichka (3.1)',            narx: 40000, birlik: 'kg' },
  { id: 'a11', nomi: 'Tom samarez',               narx: 40000, birlik: 'kg' },
  { id: 'a12', nomi: 'Qoziq lenta komplekt',      narx: 5000,  birlik: 'dona' },
  { id: 'a13', nomi: 'Kepka',                     narx: 3000,  birlik: 'dona' },
  { id: 'a14', nomi: 'Tirsak',                    narx: 15000, birlik: 'dona' },
];

export const STANOK_OPTIONS = ['Chaprost', 'Gofra'];
export const PAYMENT_METHODS = ["So'mda", "Dollorda", "Clickda", "Kartada", "Perechisleniyada"];

// Yo'qlama holatlari (kunlar — oylik hisobida ish haqi koeffitsiyenti)
export const YOQLAMA_HOLATLAR = [
  { value: 'keldi',   label: 'Keldi',   kunlar: 1 },
  { value: 'yarim',   label: 'Yarim',   kunlar: 0.5 },
  { value: 'kelmadi', label: 'Kelmadi', kunlar: 0 },
];

export const OY_NOMLARI = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

// Hafta kunlari — getDay() indeksiga mos (0 = Yakshanba)
export const HAFTA_KUNLARI = [
  'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba',
];

// O'chirib bo'lmaydigan asosiy tovarlar (Sozlamalarda)
export const PROTECTED_PRODUCT_IDS = ['tunika', 'profnastil'];

export const DEFAULT_USD_RATE = 12600;

export const DEFAULT_KAZIROKLAR = [];

// ============================================================
//  KAZIROK TURLARI (fasonlar) — narxlar > Kaziroklar
// ------------------------------------------------------------
//  Har tur (masalan "Qosh 90 gradus") ichida Patalok va Paloska
//  detallari turadi. Har detal — eni/peshona/razmeri parametrlari,
//  jonli chizmasi (kazirokGeom) va list metridan hisoblangan narxi.
//  `foyda` — butun turga umumiy foyda foizi (sotuv = material × (1 + foyda%)).
//  Har detal: { id, eni, peshona, razmeri, fold?, metrNarx } (sm va so'm/m).
// ============================================================
export const DEFAULT_KAZ_TURLARI = [
  {
    id: 'qosh90',
    nomi: 'Qosh 90 gradus',
    foyda: 30, // foyda foizi (%) — o'zgartirsa bo'ladigan parametr
    pataloklar: [
      { id: 'p2', eni: 62.5, peshona: 10, razmeri: 50, fold: false, metrNarx: 0 },
      { id: 'p3', eni: 41.6, peshona: 10, razmeri: 50, fold: false, metrNarx: 0 },
      { id: 'p4', eni: 31.6, peshona: 10, razmeri: 50, fold: false, metrNarx: 0 },
    ],
    paloskalar: [
      { id: 'l16', eni: 7.75, peshona: 10.1, razmeri: 51.5, metrNarx: 0 },
      { id: 'l15', eni: 8.3,  peshona: 10.1, razmeri: 51.5, metrNarx: 0 },
      { id: 'l14', eni: 8.85, peshona: 10.1, razmeri: 51.5, metrNarx: 0 },
    ],
    // Qozon = shu turning BURCHAK patalogi (razmeri/peshona har tomon alohida)
    qozonlar: [
      { id: 'q1', razX: 60, peshX: 7, razY: 60, peshY: 7, metrNarx: 0 },
    ],
  },
];

// Saqlangan (Firestore) kazirok turlarini standartga moslaydi. ESKI ma'lumotda
// (masalan qozon qo'shilmasdan oldin saqlangan) yetishmayotgan guruhlarni
// standartdan to'ldiradi — foydalanuvchi o'zgartirishlari (foyda, narx, ...) saqlanadi.
// Faqat guruh UMUMAN bo'lmasa (undefined) to'ldiriladi; bo'sh massiv [] (ataylab
// o'chirilgan) tegilmaydi.
export function normalizeKazTurlari(v) {
  const arr = Array.isArray(v) ? v : DEFAULT_KAZ_TURLARI;
  return arr.map((t) => {
    const def = DEFAULT_KAZ_TURLARI.find((d) => d.id === t.id) || {};
    return {
      ...t,
      pataloklar: t.pataloklar === undefined ? (def.pataloklar || []) : t.pataloklar,
      paloskalar: t.paloskalar === undefined ? (def.paloskalar || []) : t.paloskalar,
      qozonlar: t.qozonlar === undefined ? (def.qozonlar || []) : t.qozonlar,
    };
  });
}

// ============================================================
//  RANGLAR PALITRASI — ASOSIY METALL RANGLAR + SOYALARI
// ------------------------------------------------------------
//  Ranglar metall list uchun. Noyob ranglar emas — asosiy mashhur
//  ranglar olingan, har biri SOYA pog'onalari bilan:
//    Juda och → Och → Ochroq → [asosiy] → To'qroq → To'q → Juda to'q
//  Soyalar asl rangdan avtomatik hisoblanadi (oq/qora tomon aralashtirib).
//  Bu ro'yxat ilovaning yagona rang manbai — Sozlamalar > Ranglar
//  (nomlari bilan) va list/aksessuar/kazirok rang tanlashida (faqat
//  namunalar, nomsiz). rangHex() shu yerdagi aniq nomni birinchi
//  tekshiradi. Metall guruhi jilo bilan ko'rsatiladi (rangFon/isMetall).
// ============================================================

// Ikki hex orasini aralashtirish (t: 0..1, target tomon)
function rangMix(hex, target, t) {
  const a = hex.replace('#', ''); const b = target.replace('#', '');
  const ch = (i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
  const hx = (n) => n.toString(16).padStart(2, '0');
  return `#${hx(ch(0))}${hx(ch(2))}${hx(ch(4))}`;
}
const RANG_OQ = '#ffffff'; const RANG_QORA = '#000000';

// Asosiy rangdan 7 pog'onali soya (juda och → juda to'q; asl rang o'rtada)
function soyalar7(nom, hex) {
  const k = nom.toLowerCase();
  return [
    { nom: `Juda och ${k}`,  hex: rangMix(hex, RANG_OQ, 0.62) },
    { nom: `Och ${k}`,       hex: rangMix(hex, RANG_OQ, 0.40) },
    { nom: `Ochroq ${k}`,    hex: rangMix(hex, RANG_OQ, 0.20) },
    { nom,                   hex },
    { nom: `To'qroq ${k}`,   hex: rangMix(hex, RANG_QORA, 0.18) },
    { nom: `To'q ${k}`,      hex: rangMix(hex, RANG_QORA, 0.36) },
    { nom: `Juda to'q ${k}`, hex: rangMix(hex, RANG_QORA, 0.55) },
  ];
}
// 5 pog'onali soya (kamroq mashhur ranglar uchun)
function soyalar5(nom, hex) {
  const k = nom.toLowerCase();
  return [
    { nom: `Juda och ${k}`,  hex: rangMix(hex, RANG_OQ, 0.55) },
    { nom: `Och ${k}`,       hex: rangMix(hex, RANG_OQ, 0.30) },
    { nom,                   hex },
    { nom: `To'q ${k}`,      hex: rangMix(hex, RANG_QORA, 0.30) },
    { nom: `Juda to'q ${k}`, hex: rangMix(hex, RANG_QORA, 0.52) },
  ];
}

export const RANG_GROUPS = [
  // Oq → kulrang → qora (neytral o'q)
  { guruh: 'Oq–kulrang–qora', ranglar: [
    { nom: 'Oq',                hex: '#f8fafc' },
    { nom: 'Juda och kulrang',  hex: rangMix('#6b7280', RANG_OQ, 0.72) },
    { nom: 'Och kulrang',       hex: rangMix('#6b7280', RANG_OQ, 0.46) },
    { nom: 'Kulrang',           hex: '#6b7280' },
    { nom: "To'q kulrang",      hex: rangMix('#6b7280', RANG_QORA, 0.30) },
    { nom: "Juda to'q kulrang", hex: rangMix('#6b7280', RANG_QORA, 0.55) },
    { nom: 'Qora',              hex: '#1f2937' },
  ] },
  // Qaymoq / bej (issiq och — metall devor/tom uchun mashhur)
  { guruh: 'Qaymoq va bej', ranglar: [
    { nom: 'Och qaymoq', hex: '#f8f1de' },
    { nom: 'Qaymoq',     hex: '#f4ecd2' },
    { nom: 'Bej',        hex: '#e3d2ad' },
    { nom: "To'q bej",   hex: '#c9b184' },
  ] },
  // Tabiiy metall (bo'yalmagan — jilo bilan)
  { guruh: 'Tabiiy metall', ranglar: [
    { nom: 'Xrom',       hex: '#d3dae3' },
    { nom: 'Kumush',     hex: '#b8c0cc' },
    { nom: 'Aksinkofka', hex: '#9aa3ad' },
    { nom: "Po'lat",     hex: '#7e8893' },
    { nom: 'Tilla',      hex: '#d4af37' },
    { nom: 'Bronza',     hex: '#cd7f32' },
    { nom: 'Mis',        hex: '#b87333' },
  ] },
  // Asosiy mashhur ranglar — to'liq soya pog'onalari
  { guruh: "Ko'k",      ranglar: soyalar7("Ko'k", '#2563eb') },
  { guruh: 'Yashil',    ranglar: soyalar7('Yashil', '#16a34a') },
  { guruh: 'Qizil',     ranglar: soyalar7('Qizil', '#dc2626') },
  { guruh: 'Jigarrang', ranglar: soyalar7('Jigarrang', '#92400e') },
  { guruh: 'Sariq',     ranglar: soyalar7('Sariq', '#eab308') },
  // Qo'shimcha ranglar — qisqaroq soya pog'onalari
  { guruh: 'Pushti',    ranglar: soyalar5('Pushti', '#ec4899') },
  { guruh: 'Binafsha',  ranglar: soyalar5('Binafsha', '#7c3aed') },
];

// Yassi (flat) ro'yxat — rangHex() qidiruvi va boshqa joylar uchun
export const RANG_PALETTE = RANG_GROUPS.flatMap((g) => g.ranglar);
// Faqat nomlar
export const RANG_NOMLARI = RANG_PALETTE.map((r) => r.nom);
