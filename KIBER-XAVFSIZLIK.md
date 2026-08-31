# KIBER-XAVFSIZLIK YO'RIQNOMASI

Bu hujjat — dastur egasi uchun. Har bir qadamni tartib bilan, shoshilmasdan bajaring.
Qadamlar oson: faqat ko'rsatilgan tugmalarni bosasiz va nusxa ko'chirasiz.

---

## A. NIMA O'ZGARDI (qisqacha)

1. **Login endi serverda tekshiriladi.** Avval parol telefon/kompyuterdagi dasturning
   o'zida solishtirilardi — endi maxsus server funksiyasi (api/login) tekshiradi.
2. **Parollar endi shifrlangan (hash) ko'rinishda saqlanadi.** Avval ochiq matnda edi.
   Har bir foydalanuvchi birinchi marta kirganda paroli avtomatik shifrlangan ko'rinishga o'tadi.
3. **Bazaga kirish qoidalari yopildi** (`firestore.rules` fayli). Endi bazani faqat
   tizimga kirgan xodimlar ko'radi; ishchi narx va sozlamalarni o'zgartira olmaydi;
   foydalanuvchilar ro'yxatini faqat asoschi ko'radi.
4. **Saytga himoya sarlavhalari (headerlar) qo'shildi** — sayt boshqa sayt ichiga
   joylanishi, begona manbalardan kod yuklanishi va shunga o'xshash hujumlar bloklanadi.

Quyidagi qadamlarni bajarmaguningizcha tizim ESKI usulda ishlashda davom etadi —
biznes to'xtamaydi. Har qadam tayyor bo'lgach yangi himoya o'z-o'zidan yoqiladi.

---

## B. 1-QADAM — Firebase service account kalitini olish va Vercelga qo'yish

Bu kalit serverga bazaga to'liq huquq bilan kirish imkonini beradi (login tekshirish uchun shart).

1. Brauzerda **console.firebase.google.com** ga kiring va loyihangizni oching.
2. Chap yuqoridagi **tishli g'ildirak (Settings)** belgisini bosing → **Project settings**.
3. Yuqoridagi qatordan **Service accounts** bo'limini tanlang.
4. **Generate new private key** tugmasini bosing → **Generate key** bilan tasdiqlang.
   Kompyuteringizga `.json` fayl yuklab olinadi.
5. Endi brauzerda **vercel.com** ga kiring → loyihangizni (`tunika-sex`) oching.
6. Yuqoridan **Settings** → chap menyudan **Environment Variables** ni tanlang.
7. Yangi o'zgaruvchi qo'shing:
   - **Name (Key)**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: yuklab olingan `.json` faylni Bloknot (Notepad) bilan oching,
     ICHIDAGI HAMMA MATNNI to'liq nusxalab shu maydonga qo'ying (bitta uzun satr bo'lsa ham mayli).
   - Muhitlar: **Production, Preview, Development** — hammasini belgilang.
8. **Save** bosing.
9. Yangi o'zgaruvchi kuchga kirishi uchun saytni qayta joylang: Vercel → **Deployments** →
   eng yuqoridagi deploy yonidagi **...** (uch nuqta) → **Redeploy**.

> ⚠️ **OGOHLANTIRISH:** bu `.json` fayl — bazangizning "bosh kaliti". Uni HECH KIMGA
> yubormang, Telegramga tashlamang, kod omboriga (git/GitHub) qo'shmang. Vercelga
> qo'ygach, kompyuterdagi faylni xavfsiz joyga olib qo'ying yoki o'chirib yuboring.

**Qanday bilaman ishlayotganini:** redeploy tugagach saytga kirganingizda login odatdagidek
ishlaydi — lekin endi tekshiruv serverda bo'ladi (siz farqni sezmaysiz, bu yaxshi belgi).

---

## C. 2-QADAM — Vercel muhit o'zgaruvchilarini tekshirish

Vercel → loyiha → **Settings** → **Environment Variables** ro'yxatida quyidagilarni tekshiring:

1. **ARRIVAL_SECRET** — agar bor bo'lsa, tegmang, qoladi.
2. **TG_WEBHOOK_SECRET** — endi MAJBURIY. Bo'lmasa Telegram xabarlari serverda
   401 (rad etildi) bo'ladi. Qo'shish:
   - **Name**: `TG_WEBHOOK_SECRET`
   - **Value**: uzun tasodifiy satr o'ylab toping (masalan 30-40 ta harf-raqam aralash).
     Uni biror joyga yozib qo'ying — hozir kerak bo'ladi.
   - Barcha muhitlarga saqlang va **Redeploy** qiling.
3. Endi Telegram botni shu maxfiy so'z bilan qayta ulash kerak. Brauzer manzil
   satriga quyidagini yozing (o'zingiznikiga moslab):

   ```
   https://api.telegram.org/bot<BOT_TOKENINGIZ>/setWebhook?url=https://tunika-sex.vercel.app/api/telegram&secret_token=<TG_WEBHOOK_SECRET_QIYMATI>
   ```

   - `<BOT_TOKENINGIZ>` — botning tokeni (BotFather bergan).
   - `<TG_WEBHOOK_SECRET_QIYMATI>` — 2-bandda o'ylab topgan maxfiy so'zingiz.
   - Javobda `"ok":true` chiqsa — ulandi.

**Qanday bilaman ishlayotganini:** botga xabar yuboring — ilovadagi Telegram funksiyalari
(masalan, zakas xabarlari) avvalgidek ishlashi kerak.

---

## D. 3-QADAM — Birinchi login sinovi va asoschi parolini almashtirish

1. Saytga kirib odatdagi login-parol bilan tizimga kiring. Endi tekshiruvni server
   bajaradi va parolingiz o'sha zahoti shifrlangan (hash) ko'rinishga o'tadi.
2. Boshqa xodimlar ham keyingi kirishlarida avtomatik shifrlangan ko'rinishga o'tadi —
   ular hech narsa qilishi shart emas.
3. **DARHOL asoschi parolini almashtiring:** ilovada **Sozlamalar → Foydalanuvchilar →
   Parol almashtirish**. 

> ⚠️ **NEGA SHART:** eski asoschi paroli dastur kodining ichida OCHIQ yozilgan edi —
> ya'ni saytni ochgan har kim bilishi mumkin edi. Yangi parol qo'ymaguningizcha
> bu xavf saqlanib qoladi. Yangi parol uzun bo'lsin (kamida 10 belgi, harf + raqam).

**Qanday bilaman ishlayotganini:** yangi parol bilan chiqib-qayta kirsangiz ishlaydi,
eski parol bilan esa kirib bo'lmaydi.

---

## E. 4-QADAM — Firestore qoidalarini yoqish

Bu qadam bazani begonalar uchun butunlay yopadi. Uni 1–3 qadamlar TUGAGACH bajaring.

> ⚠️ **1-QADAMSIZ BU QADAMNI BAJARMANG!** `FIREBASE_SERVICE_ACCOUNT` qo'yilmagan
> bo'lsa, server funksiyalari (login, Telegram bot, kamera, chekdagi QR sahifasi)
> bazaga oddiy (anonim) usulda kiradi — qoidalar yopilgach ularning hammasi
> ishlamay qoladi. Avval 1-qadam, keyin shu qadam.

1. **console.firebase.google.com** → loyihangiz → chap menyudan **Firestore Database**.
2. Yuqoridagi qatordan **Rules** (Qoidalar) bo'limini tanlang.
3. Ochilgan matn maydonidagi ESKI matnni to'liq o'chiring.
4. Loyihadagi **`firestore.rules`** faylini oching (kod papkasida turibdi), ichidagi
   HAMMA matnni nusxalab, Firebase'dagi maydonga qo'ying.
5. **Publish** (Nashr etish) tugmasini bosing.

**Eslatmalar:**
- Bundan keyin **barcha telefon/kompyuterlarda ilovani yangilab, QAYTA LOGIN qilish kerak**
  (chiqib qayta kirish). Aks holda "ruxsat yo'q" xatosi chiqadi.
- Kirgandan keyin ma'lumotlar (zakas, narxlar) ko'rinmay tursa — **sahifani yana
  bir marta yangilang** (birinchi kirishda shunday bo'lishi mumkin).
- **Zaxira (Backup)** — qoidalar yopilgach zaxira yuklab olish va avtomatik kunlik
  zaxira faqat **asoschi bilan kirilgan qurilmada** to'liq ishlaydi (chunki
  foydalanuvchilar ro'yxatini faqat asoschi o'qiy oladi). Avto-zaxira yoqilgan
  bo'lsa, kamida bitta qurilmada asoschi hisobi ochiq tursin.
- **YOLO kamera xizmati ishlashda davom etadi** — unga kerakli `yolo_*` kalitlari
  anonim ulanish uchun ochiq qoldirilgan.

**Qanday bilaman ishlayotganini:** qayta login qilgan xodimlarda hammasi ishlaydi;
login qilmagan (yoki begona) odam bazadan hech narsa o'qiy olmaydi. Ishchi rolidagi
xodim narxlarni o'zgartira olmasligini ham tekshirib ko'ring.

---

## F. 5-QADAM — tunika.uz domeniga o'tish

1. **Vercel** → loyiha → **Settings** → **Domains** → **Add** → `tunika.uz` yozing.
2. Vercel sizga DNS yozuvini ko'rsatadi. Domen sotib olingan joydagi (registrator)
   DNS sozlamalariga shuni qo'ying:
   - **A yozuv**: `@` → `76.76.21.21` (yoki Vercel ko'rsatgan manzil), **yoki**
   - **CNAME**: `cname.vercel-dns.com` (Vercel qaysi birini ko'rsatsa, o'shani qiling).
3. `www.tunika.uz` ni ham qo'shing — Vercel avtomatik `tunika.uz` ga yo'naltirishni
   (redirect) taklif qiladi, **Redirect to tunika.uz** ni tanlang.
4. **Firebase Console** → **Authentication** → **Settings** → **Authorized domains** →
   **Add domain** → `tunika.uz` qo'shing. (Busiz yangi domenda login ishlamaydi!)

**Qanday bilaman ishlayotganini:** brauzerda `tunika.uz` ochilsa va login ishlasa — tayyor.
`www.tunika.uz` yozsangiz ham `tunika.uz` ga o'tishi kerak.

---

## G. 6-QADAM — Firebase API kalitini cheklash (ixtiyoriy, lekin tavsiya qilinadi)

Bu qadam kalitni faqat SIZNING saytlaringizdan ishlatilishini ta'minlaydi.

1. **console.cloud.google.com** ga kiring (Firebase bilan bir xil Google hisob).
2. Yuqoridan loyihangizni tanlang → menyudan **APIs & Services** → **Credentials**.
3. **API Keys** ro'yxatidan **Browser key** (yoki "Web API key") ustiga bosing.
4. **Application restrictions** bo'limida **HTTP referrers (web sites)** ni tanlang.
5. **Add** bilan quyidagilarni birma-bir qo'shing:
   - `tunika.uz/*`
   - `www.tunika.uz/*`
   - `*.vercel.app/*`
   - `localhost:*` (kompyuterda sinash uchun)
6. **Save** bosing.

**Qanday bilaman ishlayotganini:** sayt avvalgidek ishlaydi; lekin kimdir kalitni
o'z saytida ishlatmoqchi bo'lsa — ishlamaydi.

---

## H. KEYINGI BOSQICH (hozir shart emas)

Bular kelajakda yanada mustahkamlash uchun:

1. **Firebase App Check** — faqat haqiqiy ilova/saytdan kelgan so'rovlarni o'tkazadi.
2. **yolo_* kalitlarini ham yopish** — kompyuterdagi YOLO kamera xizmatiga ham
   service account berib, anonim kirishni butunlay o'chirish.
3. **Har zakasni alohida hujjatga ko'chirish** — hozir hammasi bitta katta hujjatda;
   alohida hujjatlar tezroq va xavfsizroq bo'ladi.
4. **Ombor va avans yozuvlarini server orqali o'tkazish** — hozir zakas saqlanganda
   ombordan avtomatik chiqim va avans yozuvi to'g'ridan-to'g'ri klientdan yoziladi,
   shu sabab bu kalitlar ishchi uchun ham ochiq. Server orqali o'tkazilgach ularni
   qoidalarda ishchidan butunlay yopish mumkin.

---

## I. TEKSHIRUV RO'YXATI

Har qadamdan keyin belgilab boring:

- [ ] **1-QADAM:** `FIREBASE_SERVICE_ACCOUNT` Vercelga qo'yildi, redeploy qilindi.
      *Tekshiruv:* saytga login qilinsa ishlaydi (server tekshiradi).
- [ ] **2-QADAM:** `TG_WEBHOOK_SECRET` qo'yildi va Telegram `setWebhook` bilan qayta ulandi.
      *Tekshiruv:* botga xabar yuborilsa, ilova funksiyalari avvalgidek ishlaydi.
- [ ] **3-QADAM:** birinchi login qilindi, asoschi paroli ALMASHTIRILDI.
      *Tekshiruv:* eski parol bilan kirib bo'lmaydi, yangisi bilan kiriladi.
- [ ] **4-QADAM:** `firestore.rules` matni Firebase'da Publish qilindi.
      *Tekshiruv:* login qilinmagan qurilma bazadan hech narsa ololmaydi; xodimlar
      qayta login qilgach ishlaydi; YOLO kamera xizmati ishlashda davom etadi.
- [ ] **5-QADAM:** `tunika.uz` ulandi, Firebase Authorized domains ga qo'shildi.
      *Tekshiruv:* `tunika.uz` da sayt ochiladi va login ishlaydi.
- [ ] **6-QADAM (ixtiyoriy):** API kalitiga HTTP referrer cheklovi qo'yildi.
      *Tekshiruv:* sayt avvalgidek ishlaydi.

Biror qadamda muammo chiqsa — keyingisiga o'tmang, avval o'shani hal qiling.
Eng muhimi: **service account faylini hech kimga bermang** va **asoschi parolini
almashtirishni unutmang**.
