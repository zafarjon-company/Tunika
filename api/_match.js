// ============================================================
//  MOSLASHTIRISH — kamera nomi / telefon → Tunika ishchisi
// ============================================================

// Telefon: faqat raqamlar, 998 olib tashlanadi → milliy 9 raqam.
//  "+998 (88) 334-66-69" → "883346669"; "998883346669" → "883346669"
export function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('998') && d.length > 9) d = d.slice(-9);
  return d.slice(-9);
}

// Ism: kichik harf, apostrof variantlari (oʻ/o'/o, gʻ/g'/g) bir xil,
//  ortiqcha belgilar bo'shliqqa, ko'p bo'shliq bittaga.
export function normName(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[ʻʼ‘’'`´]/g, '') // apostroflar olib tashlanadi
    .replace(/[^0-9a-zЀ-ӿ]+/gi, ' ')          // qolgan belgilar → bo'shliq
    .replace(/\s+/g, ' ')
    .trim();
}

// Faqat BITTA aniq moslik bo'lsa qaytaradi (noaniqlikda null — avto-bog'lamaymiz).
export function findIshchiByName(ishchilar, name) {
  const n = normName(name);
  if (!n) return null;
  const m = (ishchilar || []).filter((i) => normName(i.name) === n);
  return m.length === 1 ? m[0] : null;
}

export function findIshchiByPhone(ishchilar, phone) {
  const p = normPhone(phone);
  if (!p || p.length < 7) return null;
  const m = (ishchilar || []).filter((i) =>
    (i.phones || []).some((ph) => normPhone(ph) === p));
  return m.length === 1 ? m[0] : null;
}
