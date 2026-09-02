// ============================================================
//  AVTOMATIK ISHLAR — kunlik Telegram zaxira + kunlik yakun-hisobot
//  ------------------------------------------------------------
//  Sozlama hujjati (Firestore): 'avto-ish' = {
//    zaxira:  { yoqilgan, oxirgi: 'YYYY-MM-DD' },
//    hisobot: { yoqilgan, soat: 0..23, oxirgi: 'YYYY-MM-DD' }
//  }
//  Bu faylda FAQAT sof funksiyalar: Firestore'ga yozilmaydi va Telegram'ga
//  o'zi yuborilmaydi. Yuborish va 'oxirgi' ni saqlashni App.jsx bajaradi.
// ============================================================
import { fmt, formatDay, toDateInput, ishchiFaolmi } from './helpers.js';
import { kamQoldiqlar } from './ombor.js';

export const AVTO_ISH_BLANK = {
  zaxira:  { yoqilgan: false, oxirgi: '' },
  hisobot: { yoqilgan: false, soat: 19, oxirgi: '' },
};

const bool = (v) => v === true || v === 'true' || v === 1;
const kunSana = (s) => String(s == null ? '' : s).slice(0, 10);
// Vergul ham nuqta kabi qabul qilinadi (loyiha qoidasi: "12,5" = 12.5)
const sonXom = (v) => parseFloat(String(v == null ? '' : v).replace(/,/g, '.')); // NaN bo'lishi mumkin
const son = (v) => sonXom(v) || 0;

// Har qanday qiymatdan to'liq/xavfsiz sozlama obyekti (AVTO_ISH_BLANK bilan birlashadi)
export function normAvtoIsh(v) {
  const src = (v && typeof v === 'object') ? v : {};
  const z = (src.zaxira && typeof src.zaxira === 'object') ? src.zaxira : {};
  const h = (src.hisobot && typeof src.hisobot === 'object') ? src.hisobot : {};
  // soat: bo'sh yoki noto'g'ri bo'lsa — asosiy qiymat (19), 0 EMAS
  let soat = Math.floor(sonXom(h.soat));
  if (!Number.isFinite(soat)) soat = AVTO_ISH_BLANK.hisobot.soat;
  soat = Math.min(23, Math.max(0, soat));
  return {
    zaxira: {
      yoqilgan: bool(z.yoqilgan),
      oxirgi: kunSana(z.oxirgi),
    },
    hisobot: {
      yoqilgan: bool(h.yoqilgan),
      soat,
      oxirgi: kunSana(h.oxirgi),
    },
  };
}

// ISO vaqtdan mahalliy 'YYYY-MM-DD' kalit.
// Diqqat: 'YYYY-MM-DD' (faqat sana) satrini new Date() UTC yarim tuni deb o'qiydi —
// mahalliy zonaga o'tkazilsa kun surilib ketishi mumkin. Shuning uchun bunday
// satrni Date'ga bermay, o'zini qaytaramiz.
function isoKun(iso) {
  if (!iso) return '';
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10)) && s.length <= 10) return s.slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return kunSana(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Bitta to'lovning so'mdagi qiymati (dollor bo'lsa kurs bilan)
function tolovSom(p) {
  const amount = son(p && p.amount);
  return p && p.method === 'Dollorda' ? amount * son(p.rate) : amount;
}

// Kunlik yakun-hisobot MATNI (Telegram uchun oddiy matn — HTML/markdown emas)
export function kunlikHisobotMatni({
  orders = [], yoqlama = {}, ishchilar = [], ombor = {}, sana, shopName = '',
} = {}) {
  const kun = kunSana(sana) || toDateInput();
  const list = Array.isArray(orders) ? orders : [];

  // --- Yangi zakaslar (shu kuni ochilganlar) ---
  const yangi = list.filter((o) => o && isoKun(o.createdAt) === kun);
  const yangiSumma = yangi.reduce((s, o) => s + (Number(o.totalSum) || 0), 0);
  const yangiQarz  = yangi.reduce((s, o) => s + (Number(o.debt) || 0), 0);

  // --- Kassa tushumi (to'lov sanasi bo'yicha) ---
  let tushum = 0;
  list.forEach((o) => {
    (Array.isArray(o && o.payments) ? o.payments : []).forEach((p) => {
      if (!p || !p.createdAt) return;
      if (isoKun(p.createdAt) !== kun) return;
      tushum += tolovSom(p);
    });
  });

  // --- Tayyor / chiqib ketgan ---
  const tayyor  = list.filter((o) => o && isoKun(o.tayyorAt) === kun).length;
  const chiqdi  = list.filter((o) => o && isoKun(o.yopilganAt) === kun).length;

  // --- Muddati bugun yoki kechikkan (yopilmagan) zakaslar ---
  const muddatli = list.filter((o) => {
    if (!o || !o.muddat) return false;
    if (o.holat === 'yopilgan') return false;
    const m = isoKun(o.muddat);
    return !!m && m <= kun;
  }).length;

  // --- Yo'qlama (faqat O'SHA KUNI faol bo'lgan ishchilar hisoblanadi;
  //     maydonlari yo'q eski ishchilar doim faol) ---
  const ishList = Array.isArray(ishchilar)
    ? ishchilar.filter((w) => w && ishchiFaolmi(w, kun))
    : [];
  const kunYoq = (yoqlama && typeof yoqlama === 'object' && yoqlama[kun]) || {};
  let keldi = 0, yarim = 0, kelmadi = 0;
  ishList.forEach((w) => {
    const h = kunYoq[w.id];
    if (h === 'keldi') keldi += 1;
    else if (h === 'yarim') yarim += 1;
    else if (h === 'kelmadi') kelmadi += 1;
  });

  // --- Kam qoldiq materiallar (Ombor moduli bilan bir xil qoida:
  //     o'chirilganlar hisobga olinmaydi, faqat minQoldiq belgilanganlar) ---
  const kam = kamQoldiqlar(ombor)
    .map((m) => ({
      nomi: (m.nomi || '—'),
      birlik: m.birlik || '',
      qoldiq: son(m.qoldiq),
    }))
    .sort((a, b) => a.qoldiq - b.qoldiq);

  const sarlavha = (shopName || '').trim();
  const qatorlar = [];
  qatorlar.push(`📊 ${sarlavha ? sarlavha + ' — ' : ''}kunlik yakun`);
  qatorlar.push(`📅 ${formatDay(kun) || kun}`);
  qatorlar.push('');
  qatorlar.push(`🆕 Yangi zakaslar: ${yangi.length} ta — ${fmt(yangiSumma)} so'm`);
  qatorlar.push(`💰 Kassa tushumi: ${fmt(tushum)} so'm`);
  qatorlar.push(`🧾 Yangi qarz: ${fmt(yangiQarz)} so'm`);
  qatorlar.push(`✅ Tayyor bo'ldi: ${tayyor} ta`);
  qatorlar.push(`🚚 Chiqib ketdi: ${chiqdi} ta`);
  qatorlar.push(`⏰ Muddati bugun/kechikkan: ${muddatli} ta`);
  qatorlar.push('');
  qatorlar.push(`👷 Yo'qlama (jami ${ishList.length} ishchi):`);
  qatorlar.push(`   keldi ${keldi} · yarim ${yarim} · kelmadi ${kelmadi}`);
  qatorlar.push('');
  qatorlar.push(`📦 Kam qoldiq materiallar: ${kam.length} ta`);
  if (kam.length) {
    kam.slice(0, 8).forEach((m) => {
      qatorlar.push(`   • ${m.nomi} — ${fmt(m.qoldiq)}${m.birlik ? ' ' + m.birlik : ''}`);
    });
    if (kam.length > 8) qatorlar.push(`   va yana ${kam.length - 8} ta`);
  }

  return qatorlar.join('\n');
}

// Zaxira fayli (JSON Blob) — eksportZaxira bilan bir xil formatda
export function zaxiraFayli(data, sana) {
  const kun = kunSana(sana) || toDateInput();
  const payload = { __app: 'tunika', __version: 2, sana: kun, data: data || {} };
  const json = JSON.stringify(payload, null, 2);
  return {
    blob: new Blob([json], { type: 'application/json' }),
    filename: `tunika-zaxira-${kun}.json`,
  };
}

// Bugun nimani yuborish kerak? { zaxira, hisobot }
// sana berilmasa — bugungi kun; soatHozir berilmasa — hozirgi soat.
export function bugunKerakmi(cfg, sana, soatHozir) {
  const c = normAvtoIsh(cfg);
  const kun = kunSana(sana) || toDateInput();
  const s = Math.floor(sonXom(soatHozir));
  const soat = Number.isFinite(s) ? s : new Date().getHours();
  return {
    zaxira:  c.zaxira.yoqilgan && c.zaxira.oxirgi !== kun,
    hisobot: c.hisobot.yoqilgan && c.hisobot.oxirgi !== kun && soat >= c.hisobot.soat,
  };
}
