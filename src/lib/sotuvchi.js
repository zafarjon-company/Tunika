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
// Har zakasga saqlashdan oldin tanlanadi: order.sotuvchi = NOYOB kalit. Id emas,
// chunki satr formatida barqaror id yo'q. Kalit MAZMUNDAN yasaladi (pozitsiyadan
// emas) — sotuvchilar joyi almashsa yoki biri o'chirilsa ham o'sha odamga ishora qiladi:
//   ism (ro'yxatda yagona)          → "Sardor"
//   ism takrorlansa                 → "Ali#901111111" (ism + 1-raqam sonlari)
//   ismsiz                          → uning 1-raqami ("+998 (71) 200-00-00")
// Sotuvchi o'chirilsa/nomi o'zgarsa — Sozlamalardagi tartib qoladi.
export function sotuvchiKalit(s) {
  return (s && (s.ism || (s.tel || [])[0])) || '';
}
const kichik = (a) => String(a || '').trim().toLowerCase();
const kalitTeng = (a, b) => kichik(a) === kichik(b);
// Raqamni formatdan qat'i nazar solishtirish: faqat sonlar, boshidagi 998 siz
// ("+998 (90) 222-22-22" = "90 222 22 22")
export function telRaqam(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length > 9 && d.startsWith('998')) d = d.slice(3);
  return d;
}

// Ro'yxatdagi har sotuvchining noyob kaliti (tartib bilan bir xil indekslarda)
export function sotuvchiKalitlari(v) {
  const l = sotuvchilarOl(v);
  const ismSoni = {};
  for (const s of l) if (s.ism) ismSoni[kichik(s.ism)] = (ismSoni[kichik(s.ism)] || 0) + 1;
  const band = new Set();
  return l.map((s, i) => {
    let k = sotuvchiKalit(s);
    if (s.ism && ismSoni[kichik(s.ism)] > 1) k = `${s.ism}#${telRaqam(s.tel[0]) || `n${i + 1}`}`;
    // Kafolat: bir xil ism VA bir xil 1-raqam (yoki "Filial#2" kabi haqiqiy ism) bo'lsa ham takrorlanmasin
    const asl = k;
    for (let n = 2; band.has(kichik(k)); n += 1) k = `${asl}~${n}`;
    band.add(kichik(k));
    return k;
  });
}

// Kalit bo'yicha sotuvchi indeksi (-1 = yo'q):
//  1) aniq noyob kalit (ismsizning o'z raqami ham) — umumiy raqam boshqa sotuvchini
//     "yoqib" yubormaydi;
//  2) "Ism#<raqam>": shu ismli va shu raqamli; bo'lmasa shu ismlining birinchisi;
//     "Ism#<n>" (7c8c005 dagi pozitsion eski kalit) — shu ismlilarning n-chisi;
//  3) ism bo'yicha;
//  4) raqam bo'yicha (formatdan qat'i nazar): avval ismsiz sotuvchining o'z raqami,
//     keyin istalgan sotuvchining istalgan raqami.
function sotuvchiIndeksi(l, kalitlar, kalit) {
  if (!kalit) return -1;
  let i = kalitlar.findIndex((k) => kalitTeng(k, kalit));
  if (i >= 0) return i;
  let asos = String(kalit).trim();
  const m = /^(.+)#(\d+)$/.exec(asos);
  if (m) {
    const [, ism, dum] = m;
    const shuIsm = l.map((s, j) => j).filter((j) => kalitTeng(l[j].ism, ism));
    if (dum.length >= 7) {
      const j = shuIsm.find((x) => l[x].tel.some((t) => telRaqam(t) === telRaqam(dum)));
      if (j != null) return j;
    } else if (shuIsm.length >= Number(dum) && Number(dum) > 0) return shuIsm[Number(dum) - 1];
    if (shuIsm.length) return shuIsm[0];
    asos = dum.length >= 7 ? dum : ism;
  }
  i = l.findIndex((s) => kalitTeng(s.ism, asos));
  if (i >= 0) return i;
  const d = telRaqam(asos);
  if (d.length < 7) return -1;
  i = l.findIndex((s) => !s.ism && s.tel.length && telRaqam(s.tel[0]) === d);
  if (i >= 0) return i;
  return l.findIndex((s) => s.tel.some((t) => telRaqam(t) === d));
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
