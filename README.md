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
        ├── ombor/          # Materiallar, Harakat, Rulonlar, Royxat, OmborSozlama
        ├── hisobot/        # Dashboard, Kassa, Zakaslar, Ishchilar, charts
        ├── jurnal/         # amallar jurnali (log)
        └── sozlamalar/     # Sozlamalar
```

## Bo'limlar

- **Sotuv** — yangi zakas yaratish (mijoz, usta, tovarlar, multi-valyutali
  to'lovlar), zakaslar ro'yxati, chek chiqarish, mijoz/usta bazasi.
- **Narxlar** — listlar, metrli tovarlar va aksessuarlar narx bazasi.
- **Yo'qlama** — kunlik *Keldi / Kelmadi* belgilash, kalendar,
  avans.
- **Ishchilar** — ro'yxat, lavozimlar, qobiliyatlar, kamchiliklar; oylik
  hisob-kitobi.
- **Hisobot** — dashboard, kassa, zakaslar va ishchilar bo'yicha hisobot,
  grafiklar.
- **Ombor** — ikki qism:
  - *Materiallar / Harakat* — material qoldig'i, kirim-chiqim tarixi
    (Harakat jurnaliga yangi rulon kirimi ham tushadi).
  - *Rulonlar* — ombordagi rulonlar daftar jadvali tartibida va ularning
    **1 metr uchun tannarxi hamda sotuv narxi**. Har rulon o'z narxi ($/t),
    kursi va yo'lkirasi bilan yoziladi; standart qiymatlar (kurs, yo'lkira,
    bo'luvchilar, tanlov ro'yxatlari) interfeysdan
    tahrirlanadi va Firestore'da saqlanadi — hisob hech qachon koddagi
    qiymatga qaramaydi (kodda faqat boshlang'ich sozlama bor).
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
| Uzunlik (m) | kiritiladi — rulon ichidagi qog'ozdan | kiritilmasa 1 m tannarx chiqmaydi (ogoh) |
| Yo'lkira $/t | ixtiyoriy — bo'sh bo'lsa standart (sozlamada, boshlang'ich 10) | — |
| **Yo'lkira $** | hisob | `og'irlik / 1000 × yo'lkira $/t` |
| **1 m tannarx** | hisob | `(rulon so'm + yo'lkira so'm) ÷ uzunlik` |
| **5 % / 10 %** (nomlari sozlamada) | hisoblanadi, **yaxlitlangani qo'lda kiritiladi** | `1 m tannarx ÷ 0.95` / `÷ 0.90` (bo'luvchilar sozlamada); formada hisoblangani ko'rinib turadi, foydalanuvchi yaxlitlab (61 476 → 62 000) kiritadi va ro'yxatda o'sha ishlatiladi |
| Qoldiq (m) | kiritiladi | bo'sh bo'lsa = uzunlik |

Yaxlitlash **faqat ko'rsatishda** (`Math.round`) — oraliq hisoblarda yo'q.
Qalinlik hamma joyda verguldan keyin ikki xona bilan ko'rsatiladi (0.40, 0.45).
*Ombor → Ro'yxat* — sotuv uchun qisqa ro'yxat: kimdan · tur · rang · qalinlik ·
kiritilgan 5 % / 10 % narxlari · kg/m (1 m og'irligi = og'irlik ÷ uzunlik;
faqat ko'rish).

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
yo'lkira, bo'luvchilar, tanlov ro'yxatlari, rang→tur qoidalari va
foydalanuvchi bergan 01.09.2026 narx varaqasi). Ular Sozlama
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

## Chizma → Detal chizish / Gul chizish

Savdo bo'limidagi **Chizma** kartasi uch rejimda ishlaydi (tab):

- **Xona konturi** — xona chizmasi, kazirok/devor/qosh/qozon hisobi
  (`src/modullar/sotuv/chizmaEngine.js`).
- **Detal chizish** — alohida detalni (patalok, qosh profili, paloska,
  burchak...) AutoCAD uslubida chizish (`src/modullar/sotuv/detalEngine.js`):
  har segment **uzunlik (sm)** + **burchak (gradus)** bilan kiritiladi
  (dinamik kiritish qutisi: uzunlik → Tab → burchak → Enter), yoki sichqoncha
  bilan bosiladi (nuqta/o'rta/(0,0) ga yopishish, Orto F8, Polar 15° F10).
  Burchak rejimi: **mutlaq** (0° o'ng, 90° tepa) yoki **nisbiy** (oldingi
  chiziqdan burilish). Chizmada har segment uzunligi va har uchdagi ichki
  burchak yozilib turadi. Yon panelda **segmentlar jadvali** (uzunlik/burchak
  tahrirlanadi — kontur qayta quriladi), **yoyilma** (segmentlar yig'indisi =
  profil uchun list eni), gabarit, qayirmalar soni. Asboblar: chiziq,
  to'rtburchak, aylana, o'lcham chizig'i, ko'chirish/nusxa/burish/aks/masshtab/
  offset/o'chirish, griplar, undo/redo. Nomlangan detallar **kutubxonasi**
  (`detal-chizma-lib-v1`, localStorage), joriy chizma `detal-chizma-v1`.
  **DXF** import (mm/sm/m, $INSUNITS) va eksport (mm, LINE/CIRCLE/ARC), **PNG** rasm.
- **Gul chizish** — gul / naqsh konturini Detal chizish bilan bir xil asboblar
  bilan chizish (`src/modullar/sotuv/gulEngine.js` → `detalEngine.js`,
  variant `'gul'`, `VARIANTS` jadvali). Farqi — yon panelda **«Ofset (ichkariga)»**
  masofasi (sm, default 2): chizmadagi shakl hamma tomondan yopiq bo'lsa (uchlari
  0.05 mm ichida tutashgan chiziq va yoylar — xuddi AutoCAD JOIN qilingandek, yoki
  aylana) shu masofada ichkariga parallel kontur **avtomatik, jonli** chiziladi
  (binafsha), chizma yoki son o'zgarganda qayta hisoblanadi; chizmaga element
  sifatida kirmaydi, DXF da alohida `OFSET` qatlami, PNG rasmda ham. 0 — o'chiq.
  Qo'lda «Offset» asbobi ham tutashgan elementlarni bitta kontur sifatida ofset
  qiladi (`src/lib/chainOffset.js`, `npm run test:chain`: chiziq×chiziq,
  chiziq×yoy, yoy×yoy tutashmalari kesishtiriladi, silliq (tangens) tutashmada
  surilgan uchlar o'zi tutashadi, yutilgan bo'laklar tashlanadi, kontur yorilsa —
  sig'madi). Proyeksiyalar bo'limi bu rejimda yo'q. localStorage `gul-chizma-v1`
  (joriy), `gul-chizma-lib-v1` (kutubxona). Gulga xos imkoniyatlar shu rejimga
  qo'shib boriladi.
- **Ichki buyruqlar qatori va Massiv** (Detal va Gul chizish) — asboblar ostida
  joriy asbobning AutoCAD variantlari o'zbekcha: Chiziq — Yopish / Orqaga / Yoy
  (davomida); Aylana — Markaz+radius / Markaz+diametr / 2 nuqta / 3 nuqta;
  Nusxa — Rejim Ko'p/Bitta, Massiv; Ko'chirish, Burish, Masshtab — Nusxa (asli qoladi);
  Aks — Aslini o'chirish; Offset — Ko'p (bir masofa, ketma-ket); Tanlash —
  Hammasi / Bo'shatish. **Massiv** (AR): tanlanganlarni to'rtburchak (qator ×
  ustun, oraliqlar; qatorlar tepaga) yoki qutbiy (markazni bosing, soni,
  to'ldirish burchagi — 360° bo'lsa teng taqsim; gul yaproqlari) ko'paytirish,
  jonli ko'rinish, «Bajarish» yoki Enter. Variantlar chizma bilan saqlanadi.
- **Doska (AutoCAD'dagidek)** — to'q kulrang model maydoni (33,40,48), oq chiziqlar,
  ko'k tanlov, sariq magnit belgisi; krestik kursor (obyekt tanlashda quticha); UCS
  belgisi; kursor ostidagi obyekt ajraladi; tanlash ramkasi ko'k (oyna) / yashil punktir
  (kesib o'tish); pastda buyruq satri (tarix + buyruq qidirish, ro'yxat tepaga
  ochiladi); o'ng tugma — kontekst menyusi (surilsa — surish); Probel = Enter;
  g'ildirak 2× — markazga; Ctrl+A — hammasi; avval buyruq, keyin tanlash (verb-noun:
  Ko'chirish, Nusxa, Burish, Aks, Masshtab, Massiv, Tekislash); tanlov bilan O'chirish —
  darhol. «AutoCAD doska» tugmasi (variantlar qatorida) — mavzu ranglariga qaytish.
- **Asboblar paneli** — AutoCAD lentasi kabi guruhlar (har guruh 3 qatorli ustunlar;
  tor ekranda lenta suriladi): Tanlash · Chizish (Chiziq, To'rtburchak, Ko'pburchak,
  Aylana, Yoy ▾, Halqa, Nuqta, Ellips, Splayn, Yordamchi chiziq, Nur, Shtrix, Kontur) · O'zgartirish (Ko'chirish, Nusxa,
  Burish, Aks, Masshtab, Cho'zish, Tekislash, Massiv, Offset) · Tahrir (Kesish,
  Uzaytirish, Uzish, Uzunlik, Tutashtirish, Faska, Portlatish, Birlashtirish,
  Silliqlash, O'chirish) · Izoh (Matn, O'lchamlar: Chiziqli, Parallel, Burchak, Radius, Diametr) ·
  O'lchash (Masofa, Yuza, Bo'lish, O'lchab qo'yish) · Chizma.
- **4-to'lqin: egri chiziqlar va izohlar** (`src/lib/curveGeom.js`, `npm run test:curve`):
  **Ellips** (EL — markaz / «O'q, uch»; silliq yopiq polyline, parametrlari saqlanadi:
  griplar — markaz va o'q uchlari, 2 marta bosib yarim o'qlar; magnit — Markaz va
  Kvadrant), **Splayn** (SPL — fit nuqtalar orqali silliq egri, yopiq variant, C / Backspace;
  griplar — fit nuqtalar). Ikkalasi odatdagi polyline kabi Offset, Kesish, Tutashtirish,
  avto-ofset bilan ishlaydi; yozuvi — bitta umumiy uzunlik, ichki tugunlarga END/MID
  yopishmaydi. **Matn** (T / DT — joyni bosing, yozing, Enter — keyingi qator; balandlik
  va burchak variantlar qatorida; 2 marta bosib tahrir; aks ettirishda o'qiladigan
  qoladi — MIRRTEXT=0; DXF TEXT). **O'lchamlar**: Chiziqli (DLI — kursorga qarab
  gorizontal/vertikal), Parallel (DAL), Burchak (DAN — ikki chiziq, yoy yoki 3 nuqta;
  4 sektordan biri), Radius (DRA), Diametr (DDI).
- **Qatlamlar (AutoCAD Layer)** (`src/lib/cadLayer.js`, `npm run test:layer`) — lentada **Qatlam**
  (joriy qatlam ro'yxati + «Qatlamlar» oynasi + «Joriy qilish») va **Xususiyatlar** (rang ·
  chiziq turi · qalinlik — «Qatlam bo'yicha» yoki alohida) guruhlari. Har element `lay` maydoniga ega;
  qatlamsiz eski chizmalar ochilganda avtomatik **DETAL** qatlamiga o'tadi (DXF nomi o'zgarmaydi).
  Qatlamlar oynasi (LA): joriy belgisi, nomi (o'zgartirsa elementlar ham ko'chadi), **lampochka**
  (ko'rinishi), **qor** (muzlatish — magnit ham ishlamaydi), **qulf** (ko'rinadi, tanlanmaydi — xira
  chiziladi), **printer** (DXF/rasmga chiqishi), rang (ACI 1–254 o'zbekcha nomlar bilan), chiziq turi
  (Uzluksiz, Yashirin punktir, O'q chizig'i, Shtrix-nuqta, Fantom, ISO…), qalinlik (0.00–2.11 mm),
  elementlar soni, o'chirish. **LTSCALE** — punktir masshtabi, **Qalinlik** tugmasi (LWDISPLAY) —
  qalinlikni ekranda ko'rsatish. Buyruqlar: `LA`, `LAYMCUR`, `LAYCUR`, `LAYOFF`/`LAYON`,
  `LAYFRZ`/`LAYTHW`, `LAYLCK`/`LAYULK`, `LAYISO`/`LAYUNISO`, `MA` (xususiyat nusxasi), `PR`
  (Xususiyatlar, Ctrl+1), `LTS`, `LWD`. Kesish/Ofset/Portlatish natijasi asl qatlamda qoladi.
  DXF eksportda **LTYPE** va **LAYER** jadvallari yoziladi (rang, chiziq turi, qalinlik), ko'rinmas va
  «chop etilmaydi» qatlamlar chiqmaydi. Yon paneldagi **Xususiyatlar** (Ctrl+1) — tanlanganning
  qatlami/rangi/chiziq turi/qalinligi (o'zgartiriladi) va o'lchovlari (radius, uzunlik, yuza, burchak).
- **Buyruq satri (AutoCAD command line)** (`src/lib/cmdLine.js`, `npm run test:cmd`) — chizma ostida:
  «Buyruq:» so'rovi, 3 qatorli tarix (F2 — butun tarix oynasi, matnni nusxalash mumkin),
  AutoComplete ro'yxati (nom + qisqartma; Tab/Shift+Tab — takliflar orasida aylanish; tez-tez
  ishlatilgan buyruq yuqorida), o'ng tugma — **oxirgi buyruqlar** (6 ta) va F2.
  Kiritish AutoCAD'dagidek: buyruq nomi yoki qisqartmasi (L, C, REC, M, CO, TR, O…);
  **kalit so'z** — so'rovda `[Radius/Polyline/Kesish]` ko'rinadi, o'zbekcha (R, P, K) yoki
  AutoCAD inglizchasi (C — Close, U — Undo, T — Trim) yoziladi; raqamli variant `Radius <2 sm>:`
  so'raydi, bo'sh Enter — standart qiymat; **koordinata**: `120,80` (mutlaq, Y tepaga),
  `@30,20` (nisbiy), `@50<45` (qutbiy), `50` (to'g'ridan-to'g'ri masofa), `@` — oxirgi nuqta;
  **arifmetika**: `50*2`, `(30+20)/2`; **bir martalik magnit**: END, MID, CEN, PER… ;
  bo'sh **Enter yoki Probel** — oxirgi buyruqni takrorlaydi, strelka TEPA — avval yozilganlar,
  Esc — ro'yxat → matn → buyruq (uch bosqich), `'` — shaffof buyruq (`'Z`).
  Chizma ustida harf, raqam yoki `@ , < .` bosilsa matn shu satrga tushadi; chizmaga bosilganda
  yozilgan matn saqlanadi; Ctrl+Z / Ctrl+Y / Ctrl+A / Ctrl+E va Delete satrda ham ishlaydi;
  rejim o'zgarishi `<Orto yoqildi>` ko'rinishida tarixga yoziladi.
  Kalit so'zlar so'rovda **bosiladigan havola** (AutoCAD 2014+); takliflarda yozilgan harflar qalin.
  Probel — Enter kabi bajaradi, **Shift+Probel** — oddiy bo'shliq (ko'p so'zli qidiruv uchun);
  F2 faqat chizma faol bo'lganda ishlaydi, oyna ochiqligida harflar satrga yozilmaydi.
  Buyruq boshlanganda (XL → [Gorizontal/Vertikal/…]) yoki bajarilayotganda kalit so'z ustun, buyruq
  tugagach «Buyruq:» holatiga qaytadi — harflar yana buyruqni ishga tushiradi (A — Yoy, H — Shtrix).
- **Silliqlash (PEDIT, PE)** — siniq chiziqni bosing: uchlari fit nuqta bo'lib silliq
  splaynga aylanadi; splaynni bosing — qaytadan siniq chiziq (AutoCAD PEDIT Spline /
  Decurve). Ellips/splayndan Offset, Kesish, Uzish bilan hosil bo'lgan bo'laklar ham
  silliq qoladi (bitta uzunlik yozuvi). Matn balandligi — bosh harf balandligi (AutoCAD).
- **Yordamchi chiziq (XLINE, XL) / Nur (RAY)** — ikki / bir tomonga cheksiz chiziqlar
  (`{ x, y, ang }`): nuqta orqali (asos + har bosishda yangi yo'nalish), gorizontal,
  vertikal yoki berilgan burchak. Ko'rinish oynasiga qirqib chiziladi, Kesish/Uzaytirish
  chegarasi (`trimExtend.js`), magnitda kesishma/perpendikulyar (`osnap.js`), griplar —
  asos va yo'nalish; PNG rasmga chiqmaydi, gabaritga (Ctrl+E) faqat asosi kiradi.
- **Shtrix (HATCH, H) / Kontur (BOUNDARY, BO)** (`src/lib/hatchGeom.js`, `npm run test:hatch`):
  yopiq soha ichiga bosing — soha yopiq polyline, uchlari tutashgan chiziq/yoylar zanjiri,
  aylana yoki ellipsdan topiladi (eng kichik o'rovchi halqa); ichidagi yopiq konturlar —
  orollar (juft-toq qoida, AutoCAD «Normal»). Naqshlar: Yaxlit, Qiya (ANSI31), To'r,
  Gorizontal — oraliq va burchak bilan; kursor ostida soha oldindan ko'rinadi; shtrix
  boshqa chiziqlar ostida chiziladi, rasmga (PNG) kiradi, «Yuza» asbobi shtrix yuzasini
  beradi. Kontur — soha chegarasi (va orollari) yangi element sifatida nusxalanadi.
- **3-to'lqin asboblari** (`src/lib/editGeom.js`, `npm run test:edit`): Ko'pburchak
  (POL — ichki / tashqi / tomon bo'yicha), Halqa (DO — ikki aylana), Nuqta (PO —
  yangi `point` elementi: magnit Tugun, DXF POINT), Cho'zish (S — ramka ichidagi
  tugunlar; yoy bitta uchi bilan — sagitta saqlanadi), Tekislash (AL — 2 juft nuqta:
  ko'chirish + burish, masshtab ixtiyoriy; Enter 1 juftdan keyin — faqat ko'chirish),
  Uzish (BR — ikki nuqta orasi / nuqtada; yopiq polyline ochiladi, aylana yoyga),
  Uzunlik (LEN — delta / foiz / umumiy; chiziq va yoy), Masofa (DI), Yuza (AA —
  yopiq polyline, aylana, tutash chiziq/yoylar zanjiri yoki nuqtalar; sm² va m²),
  Bo'lish (DIV) / O'lchab qo'yish (ME) — nuqtalar. Buyruq qisqartmalari AutoCAD'dek
  (S endi Cho'zish, Tanlash — SEL).
- **Tutashtirish (Fillet, F) / Faska (Chamfer, CHA) / Portlatish (Explode, X) /
  Birlashtirish (Join, J)** (Detal va Gul chizish, `src/lib/modifyGeom.js`,
  `npm run test:modify`). Tutashtirish: ikki obyekt (chiziq, polyline segmenti, yoy,
  aylana) radiusli urinma yoy bilan ulanadi; bosilgan qismlar saqlanadi, qolgani
  kesiladi/uzayadi (AutoCAD); Shift+bosish yoki radius 0 — burchakka; parallel
  chiziqlar — yarim aylana; bir polyline'ning qo'shni segmentlari — burchak
  yumaloqlanadi (polyline yoy joyida ajraladi); variantlar Radius / Polyline (butun
  konturning barcha burchaklari, qisqa segmentlar o'tkazib yuboriladi) / Kesish
  Ha-Yo'q; natija jonli ko'rinadi. Faska: masofa 1 va 2 (polyline bitta qoladi).
  Portlatish: polyline → alohida chiziqlar. Birlashtirish: uchlari tutashgan
  chiziqlar → bitta polyline (halqa — yopiq), bir aylanadagi tutash yoylar → bitta
  yoy (to'liq bo'lsa aylana).
- **Kesish (Trim) / Uzaytirish (Extend)** (Detal va Gul chizish, `src/lib/trimExtend.js`,
  `npm run test:trim`) — AutoCAD tez rejimi: chegara tanlanmaydi, chizmadagi
  boshqa elementlar (chiziq segmentlari, yoylar, aylanalar, polyline'ning boshqa
  segmentlari) chegara. Kesish: olib tashlanadigan qismga bosing — eng yaqin
  kesishmalargacha o'chadi (kesishma yo'q tomonda — uchigacha); ochiq polyline
  0–2 bo'lakka, yopiq polyline bitta ochiq polyline'ga, aylana (≥ 2 kesishma)
  yoyga aylanadi; kursor ostida olib tashlanadigan qism qizil ko'rinadi.
  Uzaytirish: chiziq/ochiq polyline uchi oxirgi segment yo'nalishida, yoy uchi
  aylanasi bo'ylab eng yaqin chegaragacha; punktir ko'rinish.
- **AutoCAD klaviatura mantiqi** (Detal va Gul chizish): **Esc** — faqat joriy
  buyruq/tanlovni bekor qiladi (to'liq ekrandan chiqarmaydi — «Kichraytirish»
  tugmasi); **Enter / Tab** — buyruqni tugatadi, bo'sh joyda → Tanlash, yana
  bosilsa → oxirgi asbob takrorlanadi; **harf bosilsa** buyruq qidirish maydoni
  ochiladi — o'zbekcha nomi yoki AutoCAD qisqartmasi (L, C, A, M, CO, RO, MI,
  SC, O, E, U, Z…), ↑↓ bilan tanlab Enter.
- **Yoy (Arc)** — Detal va Gul chizishda «Yoy ▾» tugmasi: AutoCAD «Arc» menyusidagi
  11 usul o'zbekcha — 3 nuqta; Boshi, Markaz, Oxiri / Burchak / Vatar; Boshi, Oxiri,
  Burchak / Yo'nalish / Radius; Markaz, Boshi, Oxiri / Burchak / Vatar; Davom ettirish
  (oxirgi chiziq yoki yoy uchidan tangens bo'ylab). Nuqtalar bosiladi yoki oldingi
  nuqtadan masofa + burchak yoziladi; oxirgi qiymat yoziladi yoki sichqoncha bilan
  beriladi (manfiy — soat mili bo'yicha / katta yoy). Yoy CCW saqlanadi
  (`{cx,cy,r,a0,a1}`); griplari: boshi, oxiri, o'rtasi (bo'rtish), markaz; 2 marta
  bosib radius/burchak; ko'chirish/burish/aks/masshtab/offset ishlaydi; yoyilma
  hisobiga uzunligi kiradi; DXF eksportda ARC. Geometriya `src/lib/arcGeom.js`
  (`npm run test:arc`); magnitlar (END/MID/CEN/QUA/INT/PER/TAN/NEA/EXT) yoy
  oralig'ida — `osnap.js` `buildGeom` `arc`.
- **Zakasdagi gullar** (Gul chizish, yon panel tepasi) — har zakas (draft `gulKey`,
  `makeBlankDraft`) o'z gullar ro'yxatiga ega: «Yangi gul», gulni bosib unga o'tish
  (joriysi avtomatik saqlanadi), nomi + o'lchami (eni × bo'yi), o'chirish. localStorage
  `gul-zakas-v1` — `{ [gulKey]: { active, items } }`, 40 zakasgacha; zakas
  saqlanganda `gulKey` zakas bilan yoziladi (tahrirda o'sha gullar ochiladi).

### Xona konturi → Tahrir rejimi (AutoCAD qulayliklari)

Xona chizmasidagi **Tahrir** (erkin geometriya) qatlami ham AutoCAD uslubida
ishlaydi: Line/Polyline/Rectangle/Circle'da nuqtani bosgach **dinamik kiritish
qutisi** chiqadi — uzunlik (mm/sm/m) + burchak (mutlaq yoki nisbiy) yozib
Enter; Move/Copy (masofa + burchak), Rotate (gradus), Scale (koeffitsient),
Offset (masofa; polyline ham) qiymat bilan. **Orto** (F8) / **Polar 15°** (F10),
nuqta/o'rta/xona burchaklariga yopishish (belgi bilan), tanlangan elementning
**griplari** (sudrash), chiziqqa 2 marta bosib uzunlik/burchak tahriri,
**Explode** (polyline → chiziqlar), **Masofa** (DI) o'lchash, **Ctrl+A**,
**buyruq satri** (harf bossangiz o'zi tushadi): L, PL, REC, C, DIM, M, CO, RO,
MI, SC, O, TR, EX, F, E, X, DI, U, Z.

### Magnitlar (OSNAP) va holat paneli — ikkala chizma uchun umumiy

`src/lib/osnap.js` (sof geometriya, `npm run test:osnap`) va `src/lib/cadStatusBar.js`
(holat paneli) — Xona konturi Tahrir rejimi ham, Detal chizish ham shu moduldan
foydalanadi; sozlamalar localStorage `cad-snap-v1` kalitida umumiy.

- **OSNAP** (F3, menyu ▾): uch nuqta (END), o'rta (MID), markaz (CEN), tugun
  (NOD — xona burchaklari, (0,0)), kvadrant (QUA), kesishma (INT), davomi (EXT),
  perpendikulyar (PER), tangens (TAN), eng yaqin (NEA). Belgi shakli AutoCAD'dek
  (kvadrat, uchburchak, aylana, romb, ×, ⊥ ...), yonida nomi; magnit radiusi
  sozlanadi. Bir nechta nomzod bo'lsa kursorga eng yaqini ustunlik bilan tanlanadi
  (END/INT kuchli, NEA eng kuchsiz). Xona konturida devor/qosh chiziqlari va
  burchaklariga ham yopishadi.
- **ORTHO** (F8) / **POLAR** (F10, qadam 5…90°) — polar nur punktir chiziq bilan
  ko'rsatiladi; ikkalasi bir vaqtda yonmaydi.
- **OTRACK** (F11): yopishgan nuqta ustida ~0.25 s turilsa nuqta "olinadi" (+ belgi),
  undan gorizontal/vertikal/polar kuzatish chiziqlari chiqadi; ikki chiziq (yoki
  chiziq × polar nur) kesishmasiga yopishadi. Nuqta belgilangach olinganlar tozalanadi.
- **SNAP** (F9) — to'r tugunlariga; **GRID** (F7, qadam ▾ avto/1 mm…1 m); **DYN** (F12)
  — uzunlik/burchak kiritish qutisi. Chapda kursor koordinatasi (Y yuqoriga).

### Detal chizish → 3 proyeksiya (chizma geometriya)

Yon paneldagi **«3 ta proyeksiya»** yoqilsa maydon Monge usulida to'rt kvadrantga
bo'linadi: **OLD (V)** chap-yuqori (x, z), **USTDAN (H)** chap-past (x, chuqurlik
pastga), **YON (W)** o'ng-yuqori (chuqurlik o'ngga, z); 45° buklash chizig'i H↔W
chuqurligini bog'laydi. Element qaysi kvadrantda turgan bo'lsa o'sha proyeksiyaga
tegishli. Ikkita proyeksiyani chizib (masalan H da 15 sm, W da 25 sm kesma),
**«... ni hosil qilish»** tugmasi uchinchisini quradi: kontur — ekstentlar
to'rtburchagi, ichki chiziqlar — boshqa proyeksiyalardagi oraliq uchlar (qayirma
chiziqlari); tekis detal uchun kesma. Natija oddiy chiziqlar — grip, jadval va
asboblar bilan tahrirlanadi (chetidagi mayda detallar). Chizganda kursor boshqa
proyeksiyalardagi uchlarning **bog'lanish chiziqlariga** yopishadi (osnap.js
`guides`, maslahat «Proyeksiya»); tanlangan elementning proyeksiya chiziqlari
45° orqali ko'rsatiladi. Burchakdagi kvadratchani sudrab proyeksiyalar suriladi,
oraliq sozlanadi. Hisob (yoyilma, gabarit) faol proyeksiya bo'yicha.
