// ============================================================
//  YORDAMCHI FUNKSIYALAR
// ============================================================
import { DEFAULT_USD_RATE, STANOK_OPTIONS } from './constants.js';

export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('uz-UZ');

// Foydalanuvchi harakatni kamaytirishni yoqqanmi? (animatsiyalarni o'tkazib yuborish uchun)
export const reducedMotion = () =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Telefon raqamini shablonga solish: +998 (88) 334-66-69
export const formatPhone = (rawVal) => {
  if (!rawVal) return '';
  let digits = rawVal.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length > 9) {
    digits = digits.substring(3);
  }
  digits = digits.substring(0, 9);

  let res = '+998 ';
  if (digits.length > 0) {
    res += '(' + digits.substring(0, 2);
  }
  if (digits.length > 2) {
    res += ') ' + digits.substring(2, 5);
  }
  if (digits.length > 5) {
    res += '-' + digits.substring(5, 7);
  }
  if (digits.length > 7) {
    res += '-' + digits.substring(7, 9);
  }
  return res;
};

const blankCalc = (nomi = "O'chirilgan") => ({
  nomi, tafsilot: '', birlik: 'metr', soni: 0, uzunlik: 0,
  birBirlikNarxi: 0, jamiMeyor: 0, jamiSumma: 0, bolishLabel: '', rang: '',
});

// Metrli tovarning variantlari ({son, razmer}), son>0 bo'lganlari.
// Eski format (bolish1/razmer1...) ham qo'llab-quvvatlanadi.
export function metrliVariantlar(m) {
  if (!m) return [];
  if (Array.isArray(m.variantlar)) {
    return m.variantlar
      .map((v) => ({ son: parseFloat(v.son) || 0, razmer: v.razmer || '' }))
      .filter((v) => v.son > 0);
  }
  const out = [];
  if (m.bolish1) out.push({ son: Number(m.bolish1) || 0, razmer: m.razmer1 || '' });
  if (m.bolish2) out.push({ son: Number(m.bolish2) || 0, razmer: m.razmer2 || '' });
  return out.filter((v) => v.son > 0);
}

// Metri uchun qo'shimcha narx (eski ustaHaqqi ham qabul qilinadi)
export function metrliAddon(m) {
  return Number(m && (m.metriNarx != null ? m.metriNarx : m.ustaHaqqi)) || 0;
}

// ----- RANGLAR -----
// List nomidan faqat rangni ajratish ("SMZ" va o'lchov qavslari olib tashlanadi)
// "SMZ", "plyonka", "yaltiroq" va o'lchov qavslari olib tashlanadi — faqat sof rang qoladi
export function rangTozala(nom) {
  return (nom || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(smz|plyonka|plyonkali|yaltiroq|yaltiroqli|mat)\b/ig, '')
    .replace(/\d+([.,]\d+)?\s*(mm|sm|mkm|mikron)?/gi, '') // qalinlik/o'lcham raqamlari (0.40, 0.45 ...)
    .replace(/\s+/g, ' ')
    .trim();
}
// Rang nomidan haqiqiy rang (swatch uchun). Noma'lum bo'lsa — nomdan barqaror rang.
export function rangHex(nom) {
  const s = (nom || '').toLowerCase().replace(/['`’]/g, '');
  const map = [
    [/qaymoq|krem|cream|bej|beige/, '#f4ecd2'],
    [/oppoq|\boq\b|white/, '#f8fafc'],
    [/qora|black|chern/, '#1f2937'],
    [/mokriy|mokr|xapyor|xapyer/, '#334155'],
    [/kulrang|\bkul\b|seriy|gray|grey/, '#6b7280'],
    [/kok|kuk|blue|siniy|havorang|havo|zangor|zangori/, '#2563eb'],
    [/biruza|turq/, '#0ea5e9'],
    [/yashil|green|zelyon/, '#16a34a'],
    [/qizil|red|krasn/, '#dc2626'],
    [/sariq|yellow|jolt/, '#eab308'],
    [/pushti|pink|roz/, '#ec4899'],
    [/binafsha|siyoh|purple|fiolet/, '#7c3aed'],
    [/jigar|korich|brown/, '#92400e'],
    [/tilla|oltin|gold|zolot/, '#d4af37'],
    // Aksinkofka / otsinkovka — haqiqiy metall tusi (alyuminiy/mis kabi, jonli kulrang-metall)
    [/aksink|aktsink|otsink|atsink|sinkof|sinkov|оцинк|galvan|sinkala/, '#9aa3ad'],
    [/kumush|kümüsh|xrom|serebr|silver|metall/, '#b8c0cc'],
  ];
  for (const [re, hex] of map) if (re.test(s)) return hex;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 55%)`;
}

// Fon rangiga qarab o'qiladigan matn rangi (oq yoki qora)
export function rangMatn(nom) {
  const c = rangHex(nom);
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 170 ? '#111827' : '#ffffff';
  }
  const m = c.match(/hsl\(\d+,\s*\d+%,\s*(\d+)%/);
  return (m ? Number(m[1]) : 50) > 62 ? '#111827' : '#ffffff';
}

// Bu rang metallmi? (jilo effekti uchun)
export function isMetall(nom) {
  return /aksink|aktsink|otsink|atsink|sinkof|sinkov|оцинк|galvan|kumush|xrom|silver|metall|alyumin|alumin|tilla|oltin|gold|zolot|\bmis\b|copper|bronza|bronz/i
    .test((nom || '').replace(/['`’]/g, ''));
}

// Rang foni — metall ranglar uchun "jilo" (gradient), aks holda oddiy rang.
// Faqat ko'rinish (swatch/badge) uchun — backgroundColor talab qiladigan joylarda rangHex ishlating.
export function rangFon(nom) {
  const s = (nom || '').toLowerCase().replace(/['`’]/g, '');
  if (/tilla|oltin|gold|zolot/.test(s)) // oltin jilo
    return 'linear-gradient(135deg,#fbf0c4 0%,#e6c25a 26%,#b8902f 50%,#f3d885 72%,#d4af37 100%)';
  if (/\bmis\b|copper|bronza|bronz/.test(s)) // mis/bronza jilo
    return 'linear-gradient(135deg,#f7d3b3 0%,#c87a45 28%,#9c5a2c 52%,#e0996a 74%,#b87333 100%)';
  if (/aksink|aktsink|otsink|atsink|sinkof|sinkov|оцинк|galvan|kumush|xrom|silver|metall|alyumin|alumin/.test(s)) // alyuminiy/otsinkovka jilo
    return 'linear-gradient(135deg,#f2f5f8 0%,#bcc3cc 22%,#828b97 46%,#c6cdd5 64%,#9aa3ad 82%,#eef1f4 100%)';
  return rangHex(nom);
}

// "Oq" har doim eng tepada
function oqTepadaCmp(a, b) {
  const ao = /oq/i.test(a) ? 0 : 1; const bo = /oq/i.test(b) ? 0 : 1;
  return ao !== bo ? ao - bo : a.localeCompare(b);
}
// Barcha mavjud ranglar: Listlardan (tozalangan) + qo'shimcha ranglar, takrorsiz, Oq tepada
export function barchaRanglar(tunikaBaza = [], ranglar = []) {
  // Listga rang qo'lda berilgan bo'lsa (t.rang) — o'shani, aks holda nomdan
  const fromList = tunikaBaza.map((t) => (t.rang || rangTozala(t.nomi))).filter(Boolean);
  const custom = (ranglar || []).map((r) => (r.nom || '').trim()).filter(Boolean);
  return [...new Set([...fromList, ...custom])].sort(oqTepadaCmp);
}
// Bu aksessuarga rang kerakmi? (qoziq lenta va germetikaga kerak emas)
export function aksRangKerak(nom) {
  return !/qoziq|lenta|germet/i.test(nom || '');
}

// Kanyok / konyok tovarini aniqlash (nom bo'yicha; razmer/bo'lakka bog'liq emas).
// Ham draft (nomi), ham eski format (tunikaName) tekshiriladi.
function kanyokNom(it) {
  return ((it && (it.nomi || it.tunikaName)) || '').toLowerCase().replace(/['`’ʻ‘]/g, '');
}
// Har qanday kanyok (ichki yoki tashqi) — "Teskari quloq" tugmasi shu tovarlarga
export function isKanyokAny(it) {
  return /kanyok|konyok/.test(kanyokNom(it));
}
// Kanyok ichki
export function isKanyokIchki(it) {
  const n = kanyokNom(it);
  return /kanyok|konyok/.test(n) && /ichki/.test(n);
}
// Oddiy (tashqi) kanyok — "ichki" so'zi yo'q
export function isKanyokTashqi(it) {
  const n = kanyokNom(it);
  return /kanyok|konyok/.test(n) && !/ichki/.test(n);
}
// Latok figurali
export function isLatokFigurali(it) {
  const n = kanyokNom(it);
  return /latok/.test(n) && /figural/.test(n);
}
// Latok oddiy
export function isLatokOddiy(it) {
  const n = kanyokNom(it);
  return /latok/.test(n) && /oddiy/.test(n);
}
// Eski no'v (apostrof kanyokNom'da olib tashlanadi → "eski nov")
export function isEskiNov(it) {
  const n = kanyokNom(it);
  return /eski/.test(n) && /nov/.test(n);
}

// Qo'lda narx (narxOverride) qo'llanadi: eski narxni "qotirish" uchun.
// Belgilangan bo'lsa — birBirlikNarxi shu qiymat, jamiSumma o'lchovga ko'ra qayta hisoblanadi.
function applyOverride(r, item) {
  const ov = parseFloat(item.narxOverride);
  if (item.narxOverride == null || item.narxOverride === '' || Number.isNaN(ov) || ov <= 0) return r;
  return { ...r, birBirlikNarxi: ov, jamiSumma: ov * (r.jamiMeyor || 0), narxOverride: ov };
}

// Zakas qatori hisob-kitobi. ctx = { tunikaBaza, metrlilar, aksessuarlar, products }
export function calcItem(item, ctx = {}) {
  const { tunikaBaza = [], metrlilar = [], aksessuarlar = [], products = [] } = ctx;
  const soni = parseFloat(item.soni) || 0;
  const uzunlik = parseFloat(item.uzunlik) || 0;

  // ----- Aksessuar -----
  if (item.kind === 'aksessuar') {
    const a = aksessuarlar.find((x) => x.id === item.aksId);
    if (!a) return blankCalc("O'chirilgan aksessuar");
    const birBirlikNarxi = Number(a.narx) || 0;
    return applyOverride({
      nomi: a.nomi, tafsilot: 'Aksessuar', birlik: a.birlik || 'dona',
      soni, uzunlik: 0, birBirlikNarxi, jamiMeyor: soni,
      jamiSumma: birBirlikNarxi * soni, bolishLabel: '',
      rang: aksRangKerak(a.nomi) ? (item.rang || '') : '',
      tanNarxBirlik: birBirlikNarxi, // aksessuarda tan narx noma'lum → foyda 0
    }, item);
  }

  // ----- Metrli: (tanlangan tunika chakana/optom narxi ÷ variant soni) + metri uchun narx -----
  if (item.kind === 'metrli') {
    const m = metrlilar.find((x) => x.id === item.metrliId);
    const tunika = tunikaBaza.find((t) => t.id === item.tunikaId);
    if (!m || !tunika) return blankCalc("O'chirilgan metrli tovar");
    const variants = metrliVariantlar(m);
    const v = variants[item.variantIndex] || variants[0];
    if (!v) return blankCalc(m.nomi);
    const base = item.priceType === 'optom' ? Number(tunika.optom) : Number(tunika.chakana);
    const birBirlikNarxi = base / (v.son || 1) + metrliAddon(m);
    const tanNarxBirlik = Number(tunika.optom) / (v.son || 1) + metrliAddon(m); // tan narx = optom asosida
    const zapas = parseFloat(item.zapas) || 0; // qo'shimcha (zapas) metr — umumiy metrga qo'shiladi
    const jamiMeyor = uzunlik * soni + zapas;
    return applyOverride({
      nomi: m.nomi,
      tafsilot: `${tunika.nomi} · ${v.son} bo'lak (${v.razmer})`,
      birlik: 'metr', soni, uzunlik, zapas, birBirlikNarxi, jamiMeyor,
      jamiSumma: jamiMeyor * birBirlikNarxi,
      bolishLabel: `${v.son} bo'lakka (${v.razmer})`,
      rang: rangTozala(tunika.nomi),
      tanNarxBirlik,
    }, item);
  }

  // ----- Tunika / Profnastil (metr, material narxida) -----
  const tunika = tunikaBaza.find((t) => t.id === item.tunikaId);
  const prodDef = products.find((p) => p.id === item.productId);
  if (!tunika || !prodDef) return blankCalc("O'chirilgan tovar");
  const birBirlikNarxi = item.priceType === 'optom' ? Number(tunika.optom) : Number(tunika.chakana);
  const jamiMeyor = uzunlik * soni;
  const stanokTxt = item.productId === 'profnastil' && item.stanok ? ` · ${item.stanok}` : '';
  return applyOverride({
    nomi: `${tunika.nomi} (${tunika.qalinlik} mm)`,
    tafsilot: `${prodDef.name}${stanokTxt}`,
    birlik: 'metr', soni, uzunlik, birBirlikNarxi, jamiMeyor,
    jamiSumma: jamiMeyor * birBirlikNarxi, bolishLabel: '',
    rang: rangTozala(tunika.nomi),
    tanNarxBirlik: Number(tunika.optom), // tan narx = optom
    tunika, productDef: prodDef,
  }, item);
}

// Guruhli pickerdan kelgan descriptor bo'yicha bo'sh qator yaratish.
// desc: { kind:'tunika'|'profnastil'|'metrli'|'aksessuar', tunikaId|metrliId|aksId }
export function makeBlankItem(desc, tunikaBaza = [], lastTunikaId = '') {
  const id = genId();
  const oxirgi = lastTunikaId || tunikaBaza[0]?.id || '';
  if (desc.kind === 'tunika' || desc.kind === 'profnastil') {
    return {
      id, kind: desc.kind, productId: desc.kind,
      tunikaId: desc.tunikaId || oxirgi,
      uzunlik: '', soni: '0', priceType: 'chakana', stanok: 'Chaprost',
    };
  }
  if (desc.kind === 'metrli') {
    // soni — latok uchun ichki ko'paytuvchi (UI'da ko'rsatilmaydi), 1 bo'lib qoladi.
    return {
      id, kind: 'metrli', metrliId: desc.metrliId,
      tunikaId: oxirgi, priceType: 'chakana', variantIndex: 0,
      uzunlik: '', soni: '1', zapas: '',
    };
  }
  return { id, kind: 'aksessuar', aksId: desc.aksId, soni: '0' };
}

// Ikki satr orasidagi tahrir masofasi (Levenshtein) — imlo farqlarini topish uchun.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
const normNom = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Ro'yxatdan nom bo'yicha eng mos elementni topish:
//  1) aniq (normallashtirilgan) moslik, bo'lmasa
//  2) eng yaqin imlo (kichik farq chegarasida — masalan "Gigurali" ↔ "Figurali").
// getName — elementdan taqqoslanadigan nomni oladi. Topilmasa null.
export function nearestByName(target, list = [], getName = (x) => x.nomi) {
  const t = normNom(target);
  if (!t) return null;
  let exact = list.find((x) => normNom(getName(x)) === t);
  if (exact) return exact;
  let best = null, bestD = Infinity;
  for (const x of list) {
    const d = levenshtein(t, normNom(getName(x)));
    if (d < bestD) { bestD = d; best = x; }
  }
  // Faqat farq kichik bo'lsa qabul qilamiz (uzunlikning ~25% i yoki 3 dan oshmasa)
  const chegara = Math.min(3, Math.max(1, Math.floor(t.length * 0.25)));
  return bestD <= chegara ? best : null;
}

// Bir birlik narxidan narx turini (optom/chakana) taxminlash — qaysi biriga yaqin bo'lsa.
// fn(base) — narxni hisoblash funksiyasi (metrlida bo'lish/addon hisobga olinadi).
function inferPriceType(birBirlikNarxi, tunika, fn) {
  const target = Number(birBirlikNarxi) || 0;
  const optom = fn(Number(tunika.optom) || 0);
  const chakana = fn(Number(tunika.chakana) || 0);
  return Math.abs(target - optom) < Math.abs(target - chakana) ? 'optom' : 'chakana';
}

// Saqlangan zakas qatorini (srcItems yo'q ESKI zakas) qaytadan tahrirlanadigan
// draft qatoriga aylantirish — katalog id larini nom/tafsilot bo'yicha topib.
// Katalogda topilmasa null qaytaradi (o'sha tovar nusxada o'tkazib yuboriladi).
export function orderItemToDraft(it, ctx = {}) {
  const { tunikaBaza = [], metrlilar = [], aksessuarlar = [] } = ctx;
  if (!it || it.nomi === undefined) return null; // juda eski (tunikaName) format — qo'llab-quvvatlanmaydi
  const id = genId();
  const uzunlik = it.uzunlik != null ? String(it.uzunlik) : '';
  const soni = it.soni != null ? String(it.soni) : '';

  if (it.kind === 'aksessuar') {
    const a = nearestByName(it.nomi, aksessuarlar, (x) => x.nomi);
    if (!a) return null;
    return { id, kind: 'aksessuar', aksId: a.id, soni: soni || '1', rang: it.rang || '' };
  }

  if (it.kind === 'metrli') {
    const m = nearestByName(it.nomi, metrlilar, (x) => x.nomi);
    if (!m) return null;
    // tafsilot: "<tunika nomi> · <son> bo'lak (<razmer>)"
    const tunikaNomi = (it.tafsilot || '').split('·')[0].trim();
    const tunika = tunikaBaza.find((t) => t.nomi === tunikaNomi) || nearestByName(tunikaNomi, tunikaBaza, (t) => t.nomi) || tunikaBaza[0];
    if (!tunika) return null;
    const variants = metrliVariantlar(m);
    let variantIndex = variants.findIndex((v) => (it.tafsilot || '').includes(`${v.son} bo'lak (${v.razmer})`));
    if (variantIndex < 0) variantIndex = 0;
    const v = variants[variantIndex];
    const priceType = inferPriceType(it.birBirlikNarxi, tunika, (base) => base / ((v && v.son) || 1) + metrliAddon(m));
    return { id, kind: 'metrli', metrliId: m.id, tunikaId: tunika.id, variantIndex, priceType, uzunlik, soni: soni || '1' };
  }

  // tunika / profnastil: nomi = "<nomi> (<qalinlik> mm)"
  const tunika = tunikaBaza.find((t) => `${t.nomi} (${t.qalinlik} mm)` === it.nomi)
    || tunikaBaza.find((t) => (it.nomi || '').startsWith(t.nomi))
    || nearestByName(it.nomi, tunikaBaza, (t) => `${t.nomi} (${t.qalinlik} mm)`);
  if (!tunika) return null;
  const kind = it.kind === 'profnastil' ? 'profnastil' : 'tunika';
  const priceType = inferPriceType(it.birBirlikNarxi, tunika, (base) => base);
  let stanok = 'Chaprost';
  for (const s of STANOK_OPTIONS) if ((it.tafsilot || '').includes(s)) stanok = s;
  return { id, kind, productId: kind, tunikaId: tunika.id, priceType, stanok, uzunlik, soni: soni || '1' };
}

export function makeBlankPayment(usdRate, defaultMethod = "So'mda") {
  return {
    id: genId(),
    method: defaultMethod,
    amount: '',
    rate: usdRate || DEFAULT_USD_RATE,
    createdAt: new Date().toISOString(),
    notes: ''
  };
}

export function makeBlankDraft(usdRate) {
  return {
    customer: { clientId: '', name: '', phones: [''], address: '', orientir: '' },
    masterId: 'boshqa',
    masterName: 'Boshqa',
    items: [],
    payments: [makeBlankPayment(usdRate)],
    notes: '',
    dastafka: { ichida: false, summa: '' }, // ichida=true → narxga kiritilgan (bepul qo'shimcha)
  };
}

export function formatDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Millisekundni "kun/soat" ko'rinishida: "2 kun 5 soat", "3 soat 10 daqiqa", "8 daqiqa"
export function formatMs(ms) {
  if (!(ms >= 0)) return '';
  const min = Math.floor(ms / 60000);
  const kun = Math.floor(min / 1440);
  const soat = Math.floor((min % 1440) / 60);
  const daqiqa = min % 60;
  if (kun > 0)  return `${kun} kun${soat > 0 ? ` ${soat} soat` : ''}`;
  if (soat > 0) return `${soat} soat${daqiqa > 0 ? ` ${daqiqa} daqiqa` : ''}`;
  return `${daqiqa} daqiqa`;
}

// Ikki ISO vaqt orasidagi farq ("kun/soat"). Biri yo'q yoki teskari bo'lsa — ''.
export function formatDuration(fromIso, toIso) {
  if (!fromIso || !toIso) return '';
  const ms = new Date(toIso) - new Date(fromIso);
  if (!(ms >= 0)) return '';
  return formatMs(ms);
}

// <input type="date"> uchun: 'YYYY-MM-DD'
export const toDateInput = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// <input type="month"> uchun: 'YYYY-MM'
export const toMonthInput = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// 'YYYY-MM-DD' -> 'DD.MM.YYYY'
export function formatDay(sana) {
  if (!sana) return '';
  const [y, m, d] = sana.split('-');
  return `${d}.${m}.${y}`;
}

// Berilgan oydagi kunlar soni. oy = 'YYYY-MM'.
// (may → 31, aprel → 30, fevral → 28 yoki kabisada 29)
export function daysInMonth(oy) {
  const [y, m] = (oy || '').split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate(); // keyingi oyning 0-kuni = shu oyning oxirgi kuni
}

// Bitta ishchining berilgan oy bo'yicha yo'qlama yig'indisi.
// yoqlama tuzilishi: { 'YYYY-MM-DD': { ishchiId: 'keldi'|'yarim'|'kelmadi' } }
export function oylikYoqlama(yoqlama, oy, ishchiId) {
  let toliq = 0;
  let yarim = 0;
  for (const sana in yoqlama) {
    if (!sana.startsWith(oy)) continue;
    const holat = yoqlama[sana]?.[ishchiId];
    if (holat === 'keldi') toliq += 1;
    else if (holat === 'yarim') yarim += 1;
  }
  return { toliq, yarim, jamiKun: toliq + yarim * 0.5 };
}
