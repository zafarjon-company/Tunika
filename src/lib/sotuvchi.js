// ============================================================
//  SOTUVCHILAR — chekda chiqadigan ism + telefon raqamlar
// ------------------------------------------------------------
//  Istalgancha sotuvchi, har birida istalgancha raqam.
//  Saqlanadi: 'shop-phone' kalitida — Firestore qoidalari shu kalitni
//  ishchidan yopiq tutadi (qoidalarni qayta deploy qilish shart emas).
//
//  QIYMAT DOIM ODDIY SATR (sotuvchilarSatr):
//    "Zafar aka: +998 (90) 123-45-67, +998 (93) 765-43-21 | Sardor: +998 (97) 000-11-22"
//  Sabab: qayta yuklanmagan ESKI ilova nusxalari (kassa, planshet) bu kalitni
//  chekka to'g'ridan-to'g'ri matn qilib chizadi — massiv/obyekt yozilsa React
//  "Objects are not valid as a React child" bilan butun ilovani qulatardi.
//  Satrni eski nusxa ham xavfsiz ko'rsatadi, yangisi esa qayta ajratib o'qiydi.
//  O'qish (sotuvchilarOl) qabul qiladi: shu satr, eski bitta raqam
//  ("+998 90 123 45 67", vergul bilan bir nechta ham) va 0bdb5a4 da qisqa
//  muddat yozilgan massiv [{ id, ism, tel: [] }].
//  DIQQAT: api/zakas.js (ommaviy zakas holati) shu qoidaning nusxasini tutadi.
//  Sinov: npm run test:sotuvchi
// ============================================================

export const SOTUVCHI_AJRAT = ' | ';

// Satrdagi bitta sotuvchi: "Ism: raqam1, raqam2" | "raqam1, raqam2" | "Ism:"
// Ism oxirgi ":" gacha (raqamda ":" bo'lmaydi); raqamlar vergul/nuqtali vergul bilan.
function qismOl(qism, i) {
  const q = qism.trim();
  if (!q) return null;
  const k = q.lastIndexOf(':');
  const ism = k >= 0 ? q.slice(0, k).trim() : '';
  const tel = (k >= 0 ? q.slice(k + 1) : q).split(/[,;]/).map((t) => t.trim()).filter(Boolean);
  return { id: `s${i}`, ism, tel };
}

function satrdan(t) {
  return t.split('|').map(qismOl).filter((s) => s && (s.ism || s.tel.length));
}

// Har qanday saqlangan qiymat → toza ro'yxat (bo'sh sotuvchi/raqamlar tushib qoladi)
export function sotuvchilarOl(v) {
  if (Array.isArray(v)) {
    return v
      .filter((s) => s && typeof s === 'object')
      .flatMap((s, i) => {
        const ism = String(s.ism || '').trim();
        const tels = (Array.isArray(s.tel) ? s.tel : [s.tel])
          .map((t) => String(t == null ? '' : t).trim())
          .filter(Boolean);
        // Qayta yuklanmagan 0bdb5a4 nusxasi satr formatini butunicha BITTA raqam
        // qilib saqlagan bo'lishi mumkin: [{ ism: '', tel: ['Ali: 1, 2 | Vali: 3'] }]
        if (!ism && tels.length === 1 && /[|:]/.test(tels[0])) {
          return satrdan(tels[0]).map((x, k) => ({ ...x, id: `s${i}_${k}` }));
        }
        // Bitta maydonga vergul bilan yozilgan bir nechta raqam — alohida raqamlar
        // (aks holda satrga o'girilganda bitta uzun raqam bo'lib yopishib qolardi)
        return [{ id: String(s.id || `s${i}`), ism, tel: tels.flatMap((t) => t.split(/[,;|]/)).map((t) => t.trim()).filter(Boolean) }];
      })
      .filter((s) => s.ism || s.tel.length);
  }
  const t = v == null || typeof v === 'object' ? '' : String(v).trim();
  if (!t) return [];
  return satrdan(t);
}

// Ro'yxat → saqlanadigan satr. Raqamlar sotuvchilarOl'da vergul bo'yicha
// ajratilgan; qolgan ajratgich belgilari (| :) ism/raqam ichida bo'lsa —
// qayta o'qishda buzilmasligi uchun almashtiriladi.
export function sotuvchilarSatr(list) {
  return sotuvchilarOl(list)
    .map((s) => {
      const ism = s.ism.replace(/[|:]/g, '/').trim();
      const tel = s.tel.map((t) => t.replace(/[|,;:]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
      if (ism) return tel ? `${ism}: ${tel}` : `${ism}:`;
      return tel;
    })
    .filter(Boolean)
    .join(SOTUVCHI_AJRAT);
}

// Bitta sotuvchi matnda: "Ali aka: +998 (90) 123-45-67, +998 (93) 765-43-21"
export function sotuvchiQatori(s) {
  const t = (s.tel || []).join(', ');
  if (s.ism && t) return `${s.ism}: ${t}`;
  return s.ism || t;
}

// Matn qatorlari (Telegram / ulashish): har sotuvchi alohida qatorda
export function sotuvchilarMatn(v) {
  return sotuvchilarOl(v).map(sotuvchiQatori).filter(Boolean);
}

// ----- Zakas bo'yicha: chekda qaysi sotuvchi BIRINCHI turadi -----
// Har zakasga saqlashdan oldin tanlanadi: order.sotuvchi = NOYOB kalit (ism,
// ismsiz bo'lsa birinchi raqami; bir xil ism takrorlansa "Ali#2"). Id emas,
// chunki satr formatida barqaror id yo'q; sotuvchi keyin o'chirilsa/nomi
// o'zgarsa — Sozlamalardagi tartib qoladi.
export function sotuvchiKalit(s) {
  return (s && (s.ism || (s.tel || [])[0])) || '';
}
const kalitTeng = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// Ro'yxatdagi har sotuvchining noyob kaliti (tartib bilan bir xil indekslarda)
export function sotuvchiKalitlari(v) {
  const soni = {};
  return sotuvchilarOl(v).map((s) => {
    const k = sotuvchiKalit(s);
    const n = k.trim().toLowerCase();
    soni[n] = (soni[n] || 0) + 1;
    return soni[n] > 1 ? `${k}#${soni[n]}` : k;
  });
}

// Kalit bo'yicha sotuvchi indeksi (-1 = yo'q):
//  1) aniq noyob kalit ("Ali#2", ismsizning o'z raqami);
//  2) "#n"siz asos kalit — takrorning biri o'chirilgan bo'lsa ham qolgani topiladi;
//  3) eski: istalgan raqami bo'yicha.
// Aniq moslik birinchi — umumiy raqam boshqa sotuvchini "yoqib" yubormaydi.
function sotuvchiIndeksi(l, kalitlar, kalit) {
  if (!kalit) return -1;
  let i = kalitlar.findIndex((k) => kalitTeng(k, kalit));
  if (i >= 0) return i;
  const asos = String(kalit).replace(/#\d+$/, '');
  i = l.findIndex((s) => kalitTeng(sotuvchiKalit(s), asos));
  if (i >= 0) return i;
  return l.findIndex((s) => (s.tel || []).some((t) => kalitTeng(t, asos)));
}

// Ro'yxatda shu kalitli sotuvchi bormi (tanlov hali amaldami)
export function sotuvchiBormi(v, kalit) {
  const l = sotuvchilarOl(v);
  return sotuvchiIndeksi(l, sotuvchiKalitlari(l), kalit) >= 0;
}

// Tanlangan sotuvchi birinchi, qolganlari Sozlamalardagi tartibda.
// Topilmasa — o'zgarishsiz (eski zakaslar, o'chirilgan sotuvchi).
export function sotuvchilarTartib(v, kalit) {
  const l = sotuvchilarOl(v);
  const i = sotuvchiIndeksi(l, sotuvchiKalitlari(l), kalit);
  return i > 0 ? [l[i], ...l.slice(0, i), ...l.slice(i + 1)] : l;
}

// Zakasda amaldagi tanlov (NOYOB kalit): zakasning o'zi → shu qurilmada oxirgi
// tanlangan → Sozlamalardagi birinchi sotuvchi. Ro'yxatda yo'q kalit hisobga olinmaydi.
export function tanlanganSotuvchi(v, zakasdagi, qurilmadagi) {
  const l = sotuvchilarOl(v);
  const ks = sotuvchiKalitlari(l);
  let i = sotuvchiIndeksi(l, ks, zakasdagi);
  if (i < 0) i = sotuvchiIndeksi(l, ks, qurilmadagi);
  return ks[i < 0 ? 0 : i] || '';
}

// Shu qurilmada oxirgi tanlangan sotuvchi (har sotuvchi odatda o'z telefonidan
// ishlaydi — keyingi zakasda qayta tanlash shart bo'lmasin)
const QURILMA_KALIT = 'zakas-sotuvchi';
export function qurilmaSotuvchisi() {
  try { return localStorage.getItem(QURILMA_KALIT) || ''; } catch (e) { return ''; }
}
export function qurilmaSotuvchisiniSaqla(kalit) {
  try { localStorage.setItem(QURILMA_KALIT, kalit || ''); } catch (e) { /* noop */ }
}

// tel: havola uchun — faqat raqam va "+"
export function telHref(t) {
  return `tel:${String(t || '').replace(/[^\d+]/g, '')}`;
}
