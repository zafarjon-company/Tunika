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
        ├── ombor/          # Materiallar, Harakat, Rulonlar, NarxRoyxati, OmborSozlama
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
  - *Rulonlar / Narx ro'yxati* — ombordagi rulonlar va ularning **1 metr
    uchun tannarxi hamda sotuv narxi**. Barcha kirish qiymatlari
    (zavod narx ro'yxati, dollar kursi, ustama, bo'luvchilar, kg/m
    jadvali) interfeysdan tahrirlanadi va Firestore'da saqlanadi —
    kodda birorta narx qattiq yozilmagan.
- **Jurnal** — barcha amallar tarixi.
- **Sozlamalar** — do'kon nomi, kurs, tovarlar, mavzular (ko'plab tema),
  til, tugmalar.

## Ombor → Rulonlar: hisob zanjiri

Har bir rulon uchun (`src/lib/omborHisob.js`, sof funksiya — React'siz):

1. **Zavod narxi** — `ombor-narxlar` dan `zavod + tur + qalinlik` bo'yicha
   topiladi (faqat `faol: true`; bir nechta mos kelsa eng yangi sanasi).
   Topilmasa narx ustunida `YO'Q` yozilib, qator belgilanadi.
2. **Yangi narx $/t** = zavod narxi + `ustama`
3. **Rulon $** = `og'irlik / 1000 × yangi narx`
4. **Rulon so'm** = rulon $ × `kurs`
5. **Uzunlik** — kiritilgan bo'lsa o'sha; bo'lmasa `og'irlik / (kg/m)`
   (`kgPerM` jadvalidan; jadvalda yo'q qalinlik uchun `qalinlik × koef`)
6. **1 m tannarx** = rulon so'm ÷ uzunlik
7. **Sotuv 1 / Sotuv 2** = 1 m tannarx ÷ `bolizvchi1` / `bolizvchi2`

Yaxlitlash **faqat ko'rsatishda** (`Math.round`) — oraliq hisoblarda yo'q.
Hisob zanjirini tekshirish:

```bash
npm run test:ombor
```

Firestore kalitlari: `ombor-sozlama`, `ombor-narxlar`, `ombor-rulonlar`,
`ombor-rang-tur` (hammasi `shop/<kalit>` modelida).

**Narx ro'yxati va rulonlar kodda YO'Q** — ular bo'sh boshlanadi va butunlay
interfeysdan to'ldiriladi:

- *Ombor → Narx ro'yxati* — zavod narxlarini kiritish (zavod / tur / qalinlik /
  narx / sana). Narx kiritilmaguncha rulonlar jadvalida narx ustunlari
  **`YO'Q`** bo'lib turadi — bu xato emas, ogohlantirish.
- *Ombor → Rulonlar* — **`+ Rulon`** tugmasi bilan rulon qo'shish, keyin
  kataklarni bosib joyida to'ldirish.

Kodda faqat *sozlama* boshlang'ich qiymatlari bor (kurs, ustama, bo'luvchilar,
kg/m jadvali, rang→tur qoidalari) — bularsiz hisob umuman ishlamaydi. Ular ham
Sozlama panelidan tahrirlanadi; **"Boshlang'ich sozlamaga qaytarish"** tugmasi
faqat shu sozlamani tiklaydi, narx va rulonlarga tegmaydi.

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
