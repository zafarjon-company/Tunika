# Tunika — Savdo boshqaruv bazasi

Tunika / metall mahsulotlar sexi uchun to'liq savdo-boshqaruv tizimi:
zakaslar, mijozlar, ustalar, to'lovlar, ishchilar, yo'qlama, oylik,
narxlar bazasi va hisobotlar. React + Vite + Tailwind asosida,
ma'lumotlar **Firebase (Firestore)** bulutida sinxronlanadi va offline
 keshlanadi (PWA — telefonga o'rnatса bo'ladi).

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda chiqqan manzilni (odatda http://localhost:5173) oching.

Production build:

```bash
npm run build      # natija: dist/
npm run preview    # build'ni lokal sinash
```

## Texnologiyalar

- **React 18** + **Vite 6** + **Tailwind CSS 3**
- **Firebase**: Firestore (bulut baza) + anonim Auth, offline kesh
  (`persistentLocalCache`)
- **lucide-react** — ikonkalar
- **PWA** — service worker (`public/sw.js`), `manifest.webmanifest`,
  offline ishlash va telefonga o'rnatish

## Struktura

```
.
├── index.html
├── vite.config.js          # React plugin + manualChunks (firebase/react)
├── tailwind.config.js, postcss.config.js
├── vercel.json             # Vercel: framework=vite, SPA rewrite
├── public/                 # ikonka, manifest, sw.js, mahsulot rasmlari
└── src/
    ├── main.jsx            # kirish nuqtasi + SW ro'yxatdan o'tkazish
    ├── index.css           # Tailwind + print uslublari
    ├── App.jsx             # asosiy: holat, auth, routing, mavzular, modallar
    ├── lib/
    │   ├── firebase.js     # Firebase init (Firestore + Auth)
    │   ├── storage.js      # ma'lumotlarni o'qish/yozish (Firestore + kesh)
    │   ├── constants.js    # boshlang'ich baza, tovarlar, to'lov turlari
    │   ├── helpers.js      # fmt, genId, calcItem, makeBlank* ...
    │   ├── kurs.js         # valyuta kurslari
    │   ├── ruxsat.js       # rollar / ruxsatlar (founder, ...)
    │   ├── til.js          # ko'p tillilik
    │   ├── keybind.js      # klaviatura tugmalari
    │   ├── eksport.js      # eksport (chek/hisobot) — CSV
    │   ├── xlsx.js         # .xlsx (Excel) yozuvchi — kutubxonasiz, OOXML+ZIP
    │   ├── ombor.js        # ombor materiallari (qoldiq, kirim/chiqim)
    │   ├── omborHisob.js   # rulon tannarxi/sotuv narxi — SOF funksiyalar
    │   ├── omborSeed.js    # rulonlar moduli: ro'yxatlar + boshlang'ich sozlama
    │   └── zaxira.js       # zaxira (backup) / tiklash
    ├── components/
    │   ├── ui.jsx          # Card, SectionTitle, Row, SegmentedControl, modallar
    │   ├── LoginScreen.jsx, GlobalSearch.jsx, LiveClock.jsx, InstallPrompt.jsx
    └── modullar/
        ├── sotuv/          # YangiZakaz, Zakazlar, Mijozlar, Tolovlar, pickers, Chek
        ├── yoqlama/        # Belgilash, Kalendar, Avans
        ├── ishchilar/      # Royxat, Lavozimlar, Qobiliyatlar, Kamchiliklar
        ├── narxlar/        # Listlar, Metrli, Aksessuarlar
        ├── ombor/          # Materiallar, Harakat, Rulonlar, OmborSozlama
        ├── hisobot/        # Dashboard, Kassa, Zakaslar, Ishchilar, charts
        ├── jurnal/         # amallar jurnali (log)
        └── sozlamalar/     # Sozlamalar
```

## Bo'limlar

- **Sotuv** — yangi zakas yaratish (mijoz, usta, tovarlar, multi-valyutali
  to'lovlar), zakaslar ro'yxati, chek chiqarish, mijoz/usta bazasi.
- **Narxlar** — listlar, metrli tovarlar va aksessuarlar narx bazasi.
- **Yo'qlama** — kunlik *Keldi / Yarim / Kelmadi* belgilash, kalendar,
  avans.
- **Ishchilar** — ro'yxat, lavozimlar, qobiliyatlar, kamchiliklar; oylik
  hisob-kitobi.
- **Hisobot** — dashboard, kassa, zakaslar va ishchilar bo'yicha hisobot,
  grafiklar.
- **Ombor** — ikki qism:
  - *Materiallar / Harakat* — material qoldig'i, kirim-chiqim tarixi.
  - *Rulonlar* — ombordagi rulonlar daftar jadvali tartibida va ularning
    **1 metr uchun tannarxi hamda sotuv narxi**. Har rulon o'z narxi ($/t),
    kursi va yo'lkirasi bilan yoziladi; standart qiymatlar (kurs, yo'lkira,
    bo'luvchilar, kg/m jadvali, tanlov ro'yxatlari) interfeysdan
    tahrirlanadi va Firestore'da saqlanadi — kodda birorta narx qattiq
    yozilmagan.
- **Jurnal** — barcha amallar tarixi.
- **Sozlamalar** — do'kon nomi, kurs, tovarlar, mavzular (ko'plab tema),
  til, tugmalar.

## Ombor → Rulonlar: hisob zanjiri

Kiritish formasi va Excel eksporti daftardagi ustunlar tartibida. Yulduzchali
maydonlar foydalanuvchi kiritadi, qolgani o'zi hisoblanadi
(`src/lib/omborHisob.js`, sof funksiya — React'siz):

| Ustun | Kim to'ldiradi | Hisob |
|---|---|---|
| №, Sana, Kimdan (zavod), Rang, Qalinlik | kiritiladi | — |
| Tur (zavod kategoriyasi) | rangdan o'zi chiqadi (rang → tur qoidalari), qo'lda o'zgartirsa bo'ladi | — |
| Og'irlik (kg) | kiritiladi | — |
| Narx $/t | **zavod narx jadvalidan** o'zi tushadi (kimdan + tur + qalinlik), qo'lda o'zgartirsa bo'ladi | — |
| **Rulon $** | hisob | `og'irlik / 1000 × narx $/t` |
| Kurs | kiritiladi (yangi rulonda standart kurs avtomatik) | — |
| **Rulon so'm** | hisob | `rulon $ × kurs` |
| Uzunlik (m) | kiritiladi — rulon ichidagi qog'ozdan | bo'sh bo'lsa `og'irlik / (kg/m)` taxminan (≈ belgisi) |
| Yo'lkira $/t | ixtiyoriy — bo'sh bo'lsa standart (sozlamada, boshlang'ich 10) | — |
| **Yo'lkira $** | hisob | `og'irlik / 1000 × yo'lkira $/t` |
| **1 m tannarx** | hisob | `(rulon so'm + yo'lkira so'm) ÷ uzunlik` |
| **5 % / 10 %** (nomlari sozlamada) | hisob | `1 m tannarx ÷ 0.95` / `÷ 0.90` (bo'luvchilar sozlamada) |
| Qoldiq (m) | kiritiladi | bo'sh bo'lsa = uzunlik |

Yaxlitlash **faqat ko'rsatishda** (`Math.round`) — oraliq hisoblarda yo'q.
kg/m jadvali faqat uzunlik yozilmaganda ishlatiladi; uzunlik yozilgan bo'lsa
haqiqiy kg/m jadvaldagidan ±5 % dan ko'p farq qilsa qator ogohlantiriladi
(qalinlik noto'g'ri bo'lishi mumkin).

Hisob zanjirini tekshirish:

```bash
npm run test:ombor
```

Firestore kalitlari: `ombor-sozlama`, `ombor-rulonlar`, `ombor-rang-tur`
(hammasi `shop/<kalit>` modelida).

**Rulonlar kodda YO'Q** — ular bo'sh boshlanadi va butunlay interfeysdan
to'ldiriladi: *Ombor → Rulonlar* — **«Rulon qo'shish»** tugmasi alohida
forma ochadi; har bir rulon shu formada kiritiladi (hisob natijasi yozayotganda
jonli ko'rinib turadi) va **«Saqlash»** bosilgandan keyingina ro'yxatga
tushadi. Sana va kurs avtomatik to'ldiriladi, qolganini foydalanuvchi yozadi.
Ro'yxatda avval asosiy ma'lumot (kimdan, tur, rang, qalinlik) va **sotuv
narxlari (5 % / 10 %)** ko'rinadi, keyin xarid tafsilotlari; qatorni bosib
tahrirlash oynasi ochiladi.

### Zavod narx jadvali

Zavodning narx varaqasi sozlamada saqlanadi (`ombor-sozlama.narxJadval`)
va Sozlama panelidagi **"Zavod narx jadvali ($ / tonna)"** bo'limidan
tahrirlanadi — varaqadagi tartibda: zavod → kategoriya (tur) → qalinlik → $/t.
Kategoriya nomlari `turlar` ro'yxati bilan bir xil (Polimerka → Rangli,
Xopyor → Xapyor, Otsinkovka → Atsenkovka, Glyansoviy → Yaltiroq,
Glyansoviy plyonka → Salafan, Mebel). Xapyor, Atsenkovka, "Oq yaltiroq",
"Qaymoq yaltiroq salafan" kabi nomlar **rang** ro'yxatida turadi — sotuvda
boshqa ranglar qatorida; rang → tur qoidasi ularni zavod kategoriyasiga
o'tkazadi, narx esa shu kategoriya bo'yicha topiladi.

Formada kimdan + rang + qalinlik tanlansa narx jadvaldan tushadi; jadvaldagi
qalinliklar tugma sifatida chiqadi. Saqlangan rulonda narx **snapshot** —
varaqa yangilansa eski rulonlar o'zgarmaydi (tahrirda «jadvaldan ol» tugmasi
bilan qayta olinadi). Rulonda `narxManba: 'jadval' | 'qolda'` saqlanadi.

Kodda faqat *sozlama* boshlang'ich qiymatlari bor (standart kurs, standart
yo'lkira, bo'luvchilar, kg/m jadvali, tanlov ro'yxatlari, rang→tur
qoidalari va foydalanuvchi bergan 01.09.2026 narx varaqasi). Ular Sozlama
panelidan tahrirlanadi; **"Boshlang'ich sozlamaga qaytarish"** tugmasi faqat
shu sozlamani tiklaydi, rulonlarga tegmaydi.

## Ma'lumotlar qayerda?

Asosiy ma'lumotlar **Firebase Firestore**da saqlanadi va qurilmalar
o'rtasida sinxronlanadi. Offline rejimda kesh ishlaydi, internet
qaytganda fonda sinxronlanadi.

> **Eslatma (xavfsizlik):** `src/lib/firebase.js` dagi `apiKey` ommaviy
> identifikator — bu maxfiy emas (Firebase web ilovalarida normal holat).
> Haqiqiy himoya **Firestore Security Rules** orqali bo'ladi; ularni
> Firebase konsolida to'g'ri sozlab qo'ying.

## Deploy (Vercel)

Loyiha GitHub repozitoriysiga ulangan; Vercel `vercel.json` asosida
avtomatik build qiladi (`npm run build` → `dist/`). `main`/`master`
branchга push qilinganda Vercel o'zi qayta deploy qiladi.
