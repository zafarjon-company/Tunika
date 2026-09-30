// ============================================================
//  SOTUVCHILAR — chekda chiqadigan ism + telefon raqamlar
// ------------------------------------------------------------
//  Istalgancha sotuvchi, har birida istalgancha raqam.
//  Saqlanadi: 'shop-phone' kalitida — Firestore qoidalari shu kalitni
//  ishchidan yopiq tutadi, shuning uchun yangi kalit ochilmadi
//  (qoidalarni qayta deploy qilish shart emas). Qiymat:
//    yangi: [{ id, ism, tel: ['+998 (90) 123-45-67', ...] }]
//    eski:  '+998 90 123 45 67' (bitta satr) — ismsiz bitta sotuvchi bo'lib o'qiladi
//  DIQQAT: api/zakas.js (ommaviy zakas holati) shu formatni o'zi o'qiydi.
//  Sinov: npm run test:sotuvchi
// ============================================================

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
  const t = v == null ? '' : String(v).trim();
  return t ? [{ id: 'eski', ism: '', tel: [t] }] : [];
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
