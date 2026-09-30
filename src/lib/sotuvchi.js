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

// Har qanday saqlangan qiymat → toza ro'yxat (bo'sh sotuvchi/raqamlar tushib qoladi)
export function sotuvchilarOl(v) {
  if (Array.isArray(v)) {
    return v
      .filter((s) => s && typeof s === 'object')
      .map((s, i) => ({
        id: String(s.id || `s${i}`),
        ism: String(s.ism || '').trim(),
        tel: (Array.isArray(s.tel) ? s.tel : [s.tel])
          .map((t) => String(t == null ? '' : t).trim())
          .filter(Boolean),
      }))
      .filter((s) => s.ism || s.tel.length);
  }
  const t = v == null || typeof v === 'object' ? '' : String(v).trim();
  if (!t) return [];
  return t.split('|').map(qismOl).filter((s) => s && (s.ism || s.tel.length));
}

// Ro'yxat → saqlanadigan satr. Ajratgich belgilari (| , ; :) ism/raqam ichida
// bo'lsa — qayta o'qishda buzilmasligi uchun almashtiriladi.
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

// tel: havola uchun — faqat raqam va "+"
export function telHref(t) {
  return `tel:${String(t || '').replace(/[^\d+]/g, '')}`;
}
