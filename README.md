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
    │   ├── eksport.js      # eksport (chek/hisobot)
    │   └── zaxira.js       # zaxira (backup) / tiklash
    ├── components/
    │   ├── ui.jsx          # Card, SectionTitle, Row, SegmentedControl, modallar
    │   ├── LoginScreen.jsx, GlobalSearch.jsx, LiveClock.jsx, InstallPrompt.jsx
    └── modullar/
        ├── sotuv/          # YangiZakaz, Zakazlar, Mijozlar, Tolovlar, pickers, Chek
        ├── yoqlama/        # Belgilash, Kalendar, Avans
        ├── ishchilar/      # Royxat, Lavozimlar, Qobiliyatlar, Kamchiliklar
        ├── narxlar/        # Listlar, Metrli, Aksessuarlar
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
- **Jurnal** — barcha amallar tarixi.
- **Sozlamalar** — do'kon nomi, kurs, tovarlar, mavzular (ko'plab tema),
  til, tugmalar.

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
