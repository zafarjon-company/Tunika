// ============================================================
//  MIJOZ — sof yordamchilar (React'siz, node testlanadi)
// ------------------------------------------------------------
//  - mijozZakaslari / realQarz / jamla — mijoz statistikasi
//  - klentKalit / klentTavsiyalar — yangi mijoz ochilayotganda
//    shu ismdagi avval yozilgan mijozlarni topish (tavsiya)
//  Sinov: npm run test:mijoz
// ============================================================

export const norm = (s) => (s || '').trim().toLowerCase();

// Bir mijozning zakaslari — clientId bo'yicha, bo'lmasa nom bo'yicha
export function mijozZakaslari(orders, c) {
  if (!c) return [];
  return (orders || []).filter((o) =>
    o.customer?.clientId
      ? o.customer.clientId === c.id
      : norm(o.customer?.name) === norm(c.name),
  );
}

// Haqiqiy qarz: to'lov umuman kiritilmagan zakas "Hisob (xom)" hisoblanadi
// (Zakaslar bo'limidagi qoida bilan bir xil) — u qarz statistikasiga kirmaydi.
export function realQarz(o) {
  return (o.debt > 0 && (o.totalPaid || 0) > 0) ? o.debt : 0;
}

export function jamla(os) {
  return os.reduce((a, o) => ({
    jami: a.jami + (o.totalSum || 0),
    tolangan: a.tolangan + (o.totalPaid || 0),
    qarz: a.qarz + realQarz(o),
    n: a.n + 1,
    oxirgi: o.createdAt && (!a.oxirgi || new Date(o.createdAt) > new Date(a.oxirgi)) ? o.createdAt : a.oxirgi,
  }), { jami: 0, tolangan: 0, qarz: 0, n: 0, oxirgi: null });
}

// ----- Ismni taqqoslash kaliti -----
// Kiril → lotin (o'zbek + rus harflari). Apostroflar keyin butunlay olib
// tashlanadi, shuning uchun ў/ғ → o/g ("O'ktam" ham, "Ўктам" ham → "oktam").
const KIRIL = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};
const KIRIL_UNLI = 'аеёиоуыэюяў';

function kirilLotin(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    // So'z boshida yoki unlidan keyin е → ye ("Елена" → "yelena")
    if (ch === 'е') {
      const old = s[i - 1];
      if (!old || !/[\p{L}]/u.test(old) || KIRIL_UNLI.includes(old)) { out += 'ye'; continue; }
    }
    out += KIRIL[ch] ?? ch;
  }
  return out;
}

// "  G‘ayrat  O'ktam-ov " → "gayrat oktam ov". Kiril ham lotinga o'tadi.
// NFD (diakritikani olib tashlash: "Ö" → "o") FAQAT kiril o'girilgandan keyin —
// aks holda й/ё/ў ham bo'linib ketardi.
// Talaffuzi bir xil imlo variantlari bitta kalitga tushadi — takror aynan shunday
// paydo bo'ladi: x = h ("Xamid" = "Hamid", "Shuxrat" = "Shuhrat"), q = k
// ("Qodir" = "Kodir"). Shuning uchun kalit o'qish uchun emas, FAQAT solishtirish uchun.
export function klentKalit(s) {
  return kirilLotin(String(s || '').normalize('NFC').toLowerCase())
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/['ʻʼ‘’`´]/g, '')           // apostroflar: o' = o
    .replace(/[^a-z0-9]+/g, ' ')         // qolgan belgi — so'z ajratgich
    .replace(/x/g, 'h').replace(/q/g, 'k')
    .trim();
}

// Murojaat so'zlari ("Karim aka", "Dilnoza opa") — ism emas. Solishtirishda
// e'tiborga olinmaydi, aks holda "Karim aka" yozilganda barcha "... aka"lar
// ismdosh bo'lib chiqib, haqiqiy "Karim" ortga surilardi. (Kalit shaklida: x→h.)
const MUROJAAT = new Set([
  'aka', 'akajon', 'opa', 'opajon', 'uka', 'ukajon', 'singil', 'ota', 'ona', 'hola', 'amaki',
  'toga', 'pochcha', 'domla', 'usta', 'hoji', 'bobo', 'buvi', 'momo', 'honim', 'janob',
]);
// Ismning asosiy so'zlari (murojaatsiz). Faqat murojaatdan iborat bo'lsa — o'zi.
function asosiy(sozlar) {
  const t = sozlar.filter((w) => w && !MUROJAAT.has(w));
  return t.length ? t : sozlar.filter(Boolean);
}
// Ikki ism "aynan bir xil"mi: murojaatsiz, bo'shliqsiz ("Abdul Aziz" = "Abdulaziz").
function ismTeng(a, b) {
  return !!a.length && a.join('') === b.join('');
}

// Yozilgan ism bo'yicha avval yozilgan mijozlar (tavsiya).
//  Maqsad: bir mijozni adashib qayta kiritmaslik, tez topish va ismi yoki
//  familiyasi bir xil mijozlarni chalkashtirmaslik.
//  Hammasi murojaat so'zlarisiz (aka/opa...) va imlo variantlariga chidamli kalitda.
//  daraja 0 — aynan shu ism ("Karim aka" = "Karim", "Abdul Aziz" = "Abdulaziz")
//         1 — ism shu yozuv bilan boshlanadi ("Ali" → "Alisher Karimov")
//         2 — so'zlar mos: har bir yozilgan so'z qaysidir so'zning boshi
//             ("valiyev ali" → "Ali Valiyev") YOKI saqlangan ismning barcha so'zlari
//             yozilganda bor ("Karim Toshmatov Chilonzor" → "Karim Toshmatov")
//         3 — so'z (4+ harf) ism ichida uchraydi ("Karim" → "Abdukarim")
//         4 — ISMI YOKI FAMILIYASI bir xil: 2+ so'zli yozuvda kamida bitta to'liq
//             so'z (3+ harf) mos ("Ali Valiyev" → "Ali Karimov", "Anvar Valiyev").
//             Oxirgi (hali yozilayotgan) so'z uchun so'z boshi ham yetadi.
//             Ko'proq so'zi mos kelgani oldinda. ismdosh: false — o'chiriladi
//             (qidiruv ro'yxati uchun).
//  Qaytaradi: [{ c, daraja }] — daraja (4 da mos so'zlar soni), keyin ism bo'yicha
//  (bir xil ismlarda ro'yxatdagi asl tartib — eng yangisi oldin — saqlanadi).
export const TAVSIYA_MIN = 2;

export function klentTavsiyalar(klentlar, ism, { ismdosh = true } = {}) {
  const q = klentKalit(ism);
  if (q.replace(/ /g, '').length < TAVSIYA_MIN) return [];
  const qAsl = asosiy(q.split(' '));             // yozilish tartibida
  const qc = qAsl.join(' ');
  const oxirgi = qAsl[qAsl.length - 1];
  const qs = [...qAsl].sort((a, b) => b.length - a.length);

  const out = [];
  for (const c of klentlar || []) {
    if (!c) continue;
    const n = klentKalit(c.name);
    if (!n) continue;
    const ns = asosiy(n.split(' '));
    const nc = ns.join(' ');
    let daraja = -1;
    let soni = 0;                                 // 4-darajada mos so'zlar soni
    if (ismTeng(ns, qAsl)) daraja = 0;
    else if (nc.startsWith(qc)) daraja = 1;
    else {
      const band = new Set();
      const sozlar = qs.every((t) => {
        const j = ns.findIndex((w, k) => !band.has(k) && w.startsWith(t));
        if (j < 0) return false;
        band.add(j);
        return true;
      });
      const qBand = new Set();
      const ichida = ns.every((w) => {
        const j = qAsl.findIndex((t, k) => !qBand.has(k) && t === w);
        if (j < 0) return false;
        qBand.add(j);
        return true;
      });
      if (sozlar || ichida) daraja = 2;
      else if (qs.every((t) => t.length >= 4 && nc.includes(t))) daraja = 3;
      else if (ismdosh && qAsl.length >= 2) {
        soni = qAsl.filter((t) => t.length >= 3
          && ns.some((w) => w === t || (t === oxirgi && w.startsWith(t)))).length;
        if (soni > 0) daraja = 4;
      }
    }
    if (daraja >= 0) out.push({ c, daraja, soni, n: nc, i: out.length });
  }
  return out
    .sort((a, b) => a.daraja - b.daraja || b.soni - a.soni
      || (a.n < b.n ? -1 : a.n > b.n ? 1 : 0) || a.i - b.i)
    .map(({ c, daraja }) => ({ c, daraja }));
}

// Ismni so'zlarga bo'lib, yozilgan ismga mos so'zlarni belgilaydi — kartada
// nima uchun tavsiya qilingani ko'rinsin: [{ matn, mos }] (bo'shliqlar saqlanadi).
export function klentBolaklar(name, ism) {
  const qs = klentKalit(ism).split(' ').filter(Boolean);
  return String(name || '').split(/(\s+)/).filter((s) => s !== '').map((matn) => {
    const ws = klentKalit(matn).split(' ').filter(Boolean);
    const mos = ws.some((w) => qs.some((t) => w.startsWith(t) || (t.length >= 4 && w.includes(t))));
    return { matn, mos };
  });
}

// ----- Telefon bo'yicha takror -----
// Solishtirish kaliti — abonent raqamining 9 ta raqami ("+998 (90) 111-11-11" → "901111111").
// PhoneInput qiymati CHALA bo'lsa ham "+998" bilan boshlanadi ("+998 (90) 111-1" →
// 998901111 — 9 ta raqam!), shuning uchun "+" yoki 9 tadan ortiq raqam bo'lsa 998
// prefiksi avval olinadi (ui.jsx phoneDigits bilan bir xil) va FAQAT roppa-rosa
// 9 raqam kalit bo'ladi — chala raqam yozilayotganda shovqin bo'lmasin.
export function telKalit(p) {
  const s = String(p || '');
  let d = s.replace(/\D/g, '');
  if ((/^\s*\+/.test(s) || d.length > 9) && d.startsWith('998')) d = d.slice(3);
  return d.length === 9 ? d : '';
}

// Shu raqamlardan birortasi allaqachon yozilgan mijozlar.
export function telefonTakrorlar(klentlar, phones) {
  const kalitlar = new Set((phones || []).map(telKalit).filter(Boolean));
  if (!kalitlar.size) return [];
  return (klentlar || []).filter((c) => c && (c.phones || []).some((p) => kalitlar.has(telKalit(p))));
}

// Saqlashdan oldingi ogohlantirish matni: aynan shu ism yoki shu raqamli mijoz
// bo'lsa — tasdiq so'raladi (boshqa odam bo'lishi mumkin, shuning uchun taqiqlanmaydi).
// Takror bo'lmasa '' qaytadi.
export function klentTakrorXabar(klentlar, name, phones) {
  const telda = telefonTakrorlar(klentlar, phones);
  if (telda.length) {
    const c = telda[0];
    const raqam = (c.phones || []).find((p) => (phones || []).some((x) => telKalit(x) && telKalit(x) === telKalit(p)));
    return `${raqam} raqami allaqachon "${c.name}" mijozida bor.\nBaribir yangi mijoz ochilsinmi?`;
  }
  // "Aynan" — tavsiyadagi 0-daraja bilan bir xil: murojaatsiz, imlo variantlariga chidamli
  const q = asosiy(klentKalit(name).split(' '));
  const aynan = q.length ? (klentlar || []).filter((c) => c && ismTeng(asosiy(klentKalit(c.name).split(' ')), q)) : [];
  if (aynan.length) {
    const tel = (aynan[0].phones || []).filter(Boolean)[0];
    return `"${aynan[0].name}" ismli mijoz allaqachon bor${aynan.length > 1 ? ` (${aynan.length} ta)` : ''}${tel ? ` — ${tel}` : ''}.\nBaribir yangi mijoz ochilsinmi?`;
  }
  return '';
}

// Mijozlar ro'yxatidagi qidiruv: eski qoida (ism/manzil/telefon matni ichida)
// + ism normallashtirilgan holda (apostrof, kiril, so'z tartibi) + telefon
// raqamlari bo'shliqsiz ("901111111" → "+998 90 111 11 11").
export function klentQidiruvMos(c, query) {
  const q = String(query || '').trim();
  if (!q) return true;
  if (!c) return false;
  const ql = q.toLowerCase();
  const phones = c.phones || [];
  if (String(c.name || '').toLowerCase().includes(ql)) return true;
  if (String(c.address || '').toLowerCase().includes(ql)) return true;
  if (phones.some((p) => String(p || '').includes(q))) return true;
  const qd = q.replace(/\D/g, '');
  if (qd.length >= 3 && qd.length === q.replace(/[\s+()-]/g, '').length
    && phones.some((p) => String(p || '').replace(/\D/g, '').includes(qd))) return true;
  return klentTavsiyalar([c], q, { ismdosh: false }).length > 0;
}
