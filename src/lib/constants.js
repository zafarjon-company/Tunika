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

export const DEFAULT_SHOP_NAME = "Tunika Sex";
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
