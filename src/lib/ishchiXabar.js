// ============================================================
//  ISHCHI BOTI — ilovadan signal (/api/ishchi-bot), YO'QOLMAYDIGAN navbat
// ------------------------------------------------------------
//  Yo'qlama / avans / maosh o'zgarganda serverga "shu joyga qara" deb
//  aytamiz (summa yoki matn yuborilmaydi — server bazadan o'zi o'qiydi).
//
//  Ishonchlilik ("muntazam" xabar talabi):
//   1) signalNiyat — Firestore'ga yozishdan OLDIN navbatga (localStorage)
//      yoziladi: internet uzilib ilova yopilsa ham niyat saqlanib qoladi;
//   2) signalNatija — yozuv serverda tasdiqlangach yuboriladi (yozilmasa —
//      navbatdan o'chadi);
//   3) server javob bermasa yoki "qayta" desa — navbatda qoladi va qayta
//      yuboriladi: 1 daqiqadan keyin, internet qaytganda, ilova qayta
//      ochilganda (avval waitForPendingWrites — oldingi sessiyaning
//      yozuvlari serverga yetib borsin). Internet YO'Q paytdagi urinishlar
//      sanalmaydi — niyat faqat 7 kundan eskirganda tashlanadi.
//  Bir nechta tab bitta navbatni bo'lishadi: saqlashda diskdagisi bilan
//  birlashtiriladi (boshqa tabning niyati o'chib ketmaydi).
//  Server jurnal bilan takrorni o'zi tashlaydi — qayta yuborish xavfsiz.
//  Yo'qlama 6 soniya kutib BITTA so'rovda ketadi.
//  Xatolar jim: bot ishlamasa ham ilova ishlayveradi.
// ============================================================
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from './firebase.js';

const URL = '/api/ishchi-bot';
const KEY = 'ishchi-xabar-navbat-v1';
const KUTISH_MS = 6000;               // yo'qlama to'planishi
const QAYTA_MS = 60 * 1000;           // muvaffaqiyatsizdan keyin qayta urinish
const ESKIRISH_MS = 7 * 86400000;     // undan eski niyat tashlanadi
const MAX_URINISH = 30;               // SERVER javob bergan muvaffaqiyatsiz urinishlar chegarasi
const TARMOQ = { tarmoq: true };      // post(): server umuman javob bermadi (internet yo'q)

// ---- Navbat (xotira + localStorage, tablar orasida birlashtiriladi) ----
function oqi() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((e) => e && e.k && e.tur) : [];
  } catch (e) {
    return [];
  }
}
let navbat = oqi();
const ochirilgan = new Set(); // shu tab navbatdan olib tashlagan kalitlar
function birlashtir() {
  const mine = new Map(navbat.map((e) => [e.k, e]));
  for (const e of oqi()) if (!mine.has(e.k) && !ochirilgan.has(e.k)) mine.set(e.k, e);
  navbat = [...mine.values()].sort((a, b) => (a.t || 0) - (b.t || 0));
}
function saqla() {
  try {
    birlashtir();
    localStorage.setItem(KEY, JSON.stringify(navbat.slice(-300)));
  } catch (e) { /* xotirada qoladi */ }
}
function olibTashla(pred) {
  navbat = navbat.filter((e) => {
    if (!pred(e)) return true;
    ochirilgan.add(e.k);
    return false;
  });
}
let sanoq = 0;
const kalit = () => `${Date.now().toString(36)}-${(sanoq += 1).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ---- Tarmoq: server javobi (obyekt) yoki TARMOQ (hech javob yo'q) ----
const kut = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(body, { keepalive = false, urinish = 3 } = {}) {
  let javobBor = false;
  for (let i = 0; i < urinish; i += 1) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive,
      });
      javobBor = true;
      const j = await r.json().catch(() => null);
      if (r.status < 500 && j) return j;
    } catch (e) { /* tarmoq — qayta urinamiz */ }
    if (i < urinish - 1) await kut(i === 0 ? 2000 : 6000);
  }
  // 5xx (JSON'siz ham) — server bor, lekin ishlamadi: vaqtinchalik xato
  return javobBor ? { ok: false, qayta: true } : TARMOQ;
}

// ---- 1) Niyat va 2) yozuv natijasi ----
// sig: { tur:'yoqlama', sana, ishchiIdlar } | { tur:'avans'|'maosh', oy, ishchiId, yangi }
export function signalNiyat(sig) {
  const k = kalit();
  navbat.push({ ...sig, k, t: Date.now(), tayyor: false, urinish: 0 });
  saqla();
  return k;
}

export function signalNatija(k, ok) {
  const e = navbat.find((x) => x.k === k);
  if (!e) return;
  if (!ok) { olibTashla((x) => x.k === k); saqla(); return; } // yozilmadi — aytadigan narsa yo'q
  e.tayyor = true;
  saqla();
  rejala(e.tur === 'yoqlama' ? KUTISH_MS : 0);
}

// ---- Yuborish ----
let taymer = null;
let muddat = 0;        // rejalashtirilgan eng yaqin vaqt
let ishlayapti = false;
let yana = false;
// Mavjud ERTAROQ taymer kechiktirilmaydi (masalan qayta urinishning 60 s si
// yangi yo'qlamaning 6 s lik taymerini bosib ketmasin)
function rejala(ms) {
  const yangi = Date.now() + ms;
  if (taymer && muddat <= yangi) return;
  if (taymer) clearTimeout(taymer);
  muddat = yangi;
  taymer = setTimeout(() => { taymer = null; muddat = 0; tashla(); }, ms);
}

function eskilarniTashla() {
  const chegara = Date.now() - ESKIRISH_MS;
  const oldin = navbat.length;
  olibTashla((e) => (e.t || 0) < chegara || (e.urinish || 0) >= MAX_URINISH);
  if (navbat.length !== oldin) saqla();
}

// Javobga qarab navbatni yangilash: ok yoki qaytarib bo'lmaydigan xato — o'chadi;
// { qayta:true } — qoladi (urinish +1); TARMOQ — qoladi, urinish SANALMAYDI.
// true qaytarsa — keyinroq qayta urinish kerak.
function natijani(ks, j) {
  if (j === TARMOQ) return true;
  const qolsin = j && j.ok === false && j.qayta === true;
  if (qolsin) {
    navbat = navbat.map((e) => (ks.has(e.k) ? { ...e, urinish: (e.urinish || 0) + 1 } : e));
  } else {
    olibTashla((e) => ks.has(e.k));
  }
  saqla();
  return qolsin;
}

function yoqlamaTanasi(list) {
  const kunlar = {};
  for (const e of list) {
    if (!e.sana) continue;
    kunlar[e.sana] = kunlar[e.sana] || new Set();
    (e.ishchiIdlar || []).forEach((id) => kunlar[e.sana].add(id));
  }
  const out = {};
  Object.keys(kunlar).forEach((s) => { out[s] = [...kunlar[s]]; });
  return { tur: 'yoqlama', kunlar: out };
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

async function tashla() {
  if (ishlayapti) { yana = true; return; }
  // Internet yo'q — urinmaymiz ham, sanamaymiz ham: 'online' hodisasi qayta boshlaydi
  if (offline()) return;
  ishlayapti = true;
  let qaytaKerak = false;
  try {
    eskilarniTashla();
    const tayyor = navbat.filter((e) => e.tayyor);
    const yq = tayyor.filter((e) => e.tur === 'yoqlama');
    if (yq.length) {
      const j = await post(yoqlamaTanasi(yq));
      if (natijani(new Set(yq.map((e) => e.k)), j)) qaytaKerak = true;
    }
    for (const e of tayyor.filter((x) => x.tur === 'avans' || x.tur === 'maosh')) {
      const j = await post({ tur: e.tur, oy: e.oy, ishchiId: e.ishchiId, yangi: e.yangi || [] });
      if (natijani(new Set([e.k]), j)) qaytaKerak = true;
    }
  } finally {
    ishlayapti = false;
  }
  if (yana) { yana = false; rejala(0); } else if (qaytaKerak) rejala(QAYTA_MS);
}

// Ilova ochilganda / internet qaytganda: oldingi sessiyada yozilgan (lekin
// signali ketmagan) o'zgarishlar serverga yetib borgach — ularni yuboramiz.
// Faqat kutish BOSHLANGANDA navbatda bo'lgan niyatlar tayyor qilinadi: undan
// keyin qo'shilganlar o'z signalNatija'sini (yozuvi tasdiqlanishini) kutadi.
let tiklanmoqda = false;
let yanaTiklash = false;
export async function navbatniTiklash() {
  if (tiklanmoqda) { yanaTiklash = true; return; }
  birlashtir(); // yopilgan boshqa tablarning niyatlari ham
  eskilarniTashla();
  if (!navbat.length) return;
  tiklanmoqda = true;
  try {
    const kutilgan = new Set(navbat.map((e) => e.k));
    try { await waitForPendingWrites(db); } catch (e) { /* yozuvlar keyin yetadi */ }
    navbat.forEach((e) => { if (kutilgan.has(e.k)) e.tayyor = true; });
    saqla();
    await tashla();
  } finally {
    tiklanmoqda = false;
  }
  if (yanaTiklash) { yanaTiklash = false; navbatniTiklash(); }
}

// Sahifa yopilsa / fonga o'tsa — tayyorlarini darhol (keepalive) jo'natamiz.
// Navbatdan o'chirilmaydi: javobni kuta olmaymiz; server parallel so'rovni
// "band" deb qaytaradi va takrorni o'zi tashlaydi.
function keepaliveTashla() {
  const tayyor = navbat.filter((e) => e.tayyor);
  if (!tayyor.length) return;
  const yq = tayyor.filter((e) => e.tur === 'yoqlama');
  if (yq.length) post(yoqlamaTanasi(yq), { keepalive: true, urinish: 1 });
  tayyor.filter((e) => e.tur !== 'yoqlama').forEach((e) => {
    post({ tur: e.tur, oy: e.oy, ishchiId: e.ishchiId, yangi: e.yangi || [] }, { keepalive: true, urinish: 1 });
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', keepaliveTashla);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') keepaliveTashla();
    else if (navbat.some((e) => e.tayyor)) rejala(0);
  });
  window.addEventListener('online', () => { navbatniTiklash(); });
}

// ---- Sozlamalar paneli uchun ----
// Server xatosi (5xx / {ok:false}) — null: panel "server javob bermadi" ko'rsatadi
export async function botHolati() {
  try {
    const r = await fetch(URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const j = await r.json().catch(() => null);
    return r.ok && j && j.ok !== false ? j : null;
  } catch (e) {
    return null;
  }
}
const birMarta = async (body) => {
  const j = await post(body, { urinish: 1 });
  return j === TARMOQ ? null : j;
};
export function botniUlash() { return birMarta({ amal: 'ulash' }); }
export function hisobYubor(ishchiId) { return birMarta({ tur: 'hisob', ishchiId }); }
