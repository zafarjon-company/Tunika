// ============================================================
//  OMBOR → RULONLAR — RO'YXATLAR VA BOSHLANG'ICH SOZLAMA
// ------------------------------------------------------------
//  Bu faylda FAQAT tuzilma bor:
//    • dropdownlar uchun ro'yxatlar (zavod / tur / rang),
//    • hisob ishlashi uchun zarur boshlang'ich SOZLAMA.
//
//  RULONLAR bu yerda YO'Q — foydalanuvchi interfeysdan o'zi kiritadi.
//  Har rulonning narxi va kursi rulonning o'zida yoziladi (daftardagidek),
//  shu sabab kodda birorta narx ham, birorta rulon ham qattiq yozilmagan.
//
//  Firestore kalitlari (loyihaning `shop/<kalit>` modeli):
//    'ombor-sozlama'   → { kurs, yolkiraTonna, bolizvchi1, bolizvchi2,
//                          nom1, nom2, kgPerM, koefSMZ, koefBoshqa, kursSana,
//                          zavodlar, turlar, ranglar }
//    'ombor-rang-tur'  → { qoidalar: [{ naqsh, tur }], standart }
//    'ombor-rulonlar'  → { [id]: { id, nomer, sana, zavod, tur, rang, qalinlik,
//                                  ogirlik, narxTonna, kurs, uzunlik, yolkiraTonna,
//                                  qoldiq, izoh, tasdiqlanmagan } }  ← bo'sh boshlanadi
// ============================================================

// ----- Dropdown ro'yxatlari — BOSHLANG'ICH qiymat -----
//  Bular faqat bo'sh bazada ko'rinadigan boshlang'ich ro'yxat. Haqiqiy
//  ro'yxat `ombor-sozlama` ichida saqlanadi va Sozlama panelidan
//  tahrirlanadi (qo'shish / o'zgartirish / o'chirish / tartib almashtirish).
//  Bundan tashqari mavjud yozuvlardagi noyob qiymatlar ham dropdownga
//  qo'shilib boradi — shuning uchun ro'yxatdan o'chirilgan nom eski
//  yozuvlarda ko'rinishda qolaveradi (ma'lumot yo'qolmaydi).

// ----- Boshlang'ich sozlama (Sozlama panelidan tahrirlanadi) -----
//  Bularsiz hisob umuman ishlamaydi (kurs 0 bo'lsa hamma narx "—" chiqadi),
//  shuning uchun ular boshlang'ich qiymat sifatida turadi. Hammasi
//  interfeysdan o'zgartiriladi va Firestore'da saqlanadi.
export const SOZLAMA_BOSHLANGICH = {
  kurs: 12000,        // yangi rulon uchun taklif qilinadigan kurs (har rulonda o'zgartiriladi)
  yolkiraTonna: 10,   // standart yo'lkira, $/tonna (har rulonda o'zgartiriladi)
  bolizvchi1: 0.95,   // 1-sotuv narxi = 1 m tannarx ÷ 0.95
  bolizvchi2: 0.90,   // 2-sotuv narxi = 1 m tannarx ÷ 0.90
  nom1: '5%',         // 1-ustun sarlavhasi
  nom2: '10%',        // 2-ustun sarlavhasi
  // Qalinlik → 1 m og'irligi (kg). SMZ listlari boshqalardan og'irroq chiqadi.
  // Bu o'lchov ma'lumoti — uzunlik og'irlikdan shu jadval orqali hisoblanadi.
  kgPerM: {
    SMZ:    { '0.35': 3.27, '0.40': 3.74, '0.45': 4.23, '0.50': 4.63, '0.60': 5.44 },
    BOSHQA: { '0.35': 3.25, '0.40': 3.62, '0.45': 4.07, '0.50': 4.53, '0.60': 5.36 },
  },
  // Jadvalda yo'q qalinlik uchun: kg/m = qalinlik × koef
  koefSMZ: 9.35,
  koefBoshqa: 9.05,
  kursSana: '',       // kurs oxirgi marta qachon o'zgartirilgan
  // Dropdown ro'yxatlari — Sozlama panelidan to'liq tahrirlanadi
  //  "Kimdan / zavod" — daftardagidek: zavod yoki yetkazib beruvchi ("SMZ Momin")
  zavodlar: ['SMZ', 'Xitoy', 'Aziya Steel', 'TMZ'],
  //  Tur — qoplama turi; zavod bilan birga "SMZ rangli", "Xitoy xapyor" bo'lib o'qiladi
  turlar: ['Rangli', 'Xapyor', 'Atsenkovka', 'Yaltiroq', 'Salafan', 'Mebel'],
  ranglar: ['Mokriy', 'Oq', 'Qaymoq', 'Shokolad', 'Bordo', 'Somon', 'Granit', 'Qora', 'Sariq', "Ko'k", 'Yashil'],
};

// Eski kod (va rang→tur qoidalari tahriri) uchun qulay yorliqlar —
// sozlamada ro'yxat bo'lmasa shular ishlatiladi.
export const ZAVODLAR = SOZLAMA_BOSHLANGICH.zavodlar;
export const TURLAR = SOZLAMA_BOSHLANGICH.turlar;
export const RANGLAR = SOZLAMA_BOSHLANGICH.ranglar;

// Sozlamadagi ro'yxatni xavfsiz o'qish.
//  Maydon YO'Q bo'lsa (eski sozlama hujjati) — boshlang'ich ro'yxat.
//  Maydon BOR, lekin bo'sh massiv bo'lsa — bo'sh qoladi: foydalanuvchi
//  ro'yxatni ataylab tozalagan bo'lsa, standart nomlar qaytib kelmasin.
export function sozlamaRoyxat(sozlama, nom) {
  const v = sozlama && sozlama[nom];
  return Array.isArray(v) ? v : (SOZLAMA_BOSHLANGICH[nom] || []);
}

// ----- Rang → tur taxmini -----
//  Rulon qo'shganda rang tanlansa, tur BO'SH bo'lsa shu qoidalar bo'yicha
//  avtomatik to'ldiriladi. Qoidalar YUQORIDAN pastga tekshiriladi (birinchi
//  mos kelgani olinadi), hech biri mos kelmasa — `standart`.
//  Sozlama panelida tahrirlanadi.
export const RANG_TUR_BOSHLANGICH = {
  qoidalar: [
    { naqsh: 'atsenkovka', tur: 'Atsenkovka' },
    { naqsh: 'salafan',    tur: 'Salafan' },
    { naqsh: 'plyonka',    tur: 'Salafan' },
    { naqsh: 'yaltiroq',   tur: 'Yaltiroq' },
    { naqsh: 'xopyor',     tur: 'Xapyor' },
    { naqsh: 'xapyor',     tur: 'Xapyor' },
    { naqsh: 'mebel',      tur: 'Mebel' },
  ],
  standart: 'Rangli',
};

// ----- Boshlang'ich to'plam -----
//  FAQAT sozlama va rang→tur qoidalari. Narx ro'yxati va rulonlar
//  ATAYIN yo'q — ularni foydalanuvchi o'zi kiritadi.
export function seedToplam() {
  return {
    'ombor-sozlama': SOZLAMA_BOSHLANGICH,
    'ombor-rang-tur': RANG_TUR_BOSHLANGICH,
  };
}
