// ============================================================
//  ISHCHI BOTI — matnlar (SOF funksiyalar: Firestore/Telegram'siz)
// ------------------------------------------------------------
//  Ishchi Telegram botda faqat O'ZINING ma'lumotini ko'radi:
//  hozirgi haqqi, davomati, avanslari, maoshi. Boshqa ishchilar,
//  savdo, narxlar va h.k. bu yerga umuman kirmaydi.
//  Hisob yadrosi — ilovadagi bilan BIR XIL (src/lib/helpers.js):
//  ishchiHisobi / oylikBalans / avansOyi. Shuning uchun botdagi raqam
//  ilovadagi Avans/Maosh bo'limidagi raqam bilan doim mos keladi.
//  Test: npm run test:ishchibot
// ============================================================
import {
  fmt, sonQiymat, formatDate, formatDay, daysInMonth, ishKuniMi, ishchiFaolmi,
  avansYozuvlari, avansOyi, oldingiOy, oylikYoqlama, ishchiHisobi, oylikBalans,
  tolovlarSummasi, MAOSH_KUNI,
} from '../src/lib/helpers.js';
import { OY_NOMLARI } from '../src/lib/constants.js';

// Server (Vercel) UTC'da ishlaydi, ilova esa Toshkent vaqtida: avans sanasi
// (1–5-kun qoidasi) va soatlar bir xil chiqishi uchun mahalliy vaqt — Toshkent.
// Node TZ o'zgarishini ish vaqtida qabul qiladi; sanalar faqat chaqiruvda hisoblanadi.
process.env.TZ = 'Asia/Tashkent';

export const CHIZIQ = '━━━━━━━━━━━━';
const HAFTA = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

// Telegram HTML uchun xavfsiz matn (ism, izoh — foydalanuvchi yozgan)
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pad = (n) => String(n).padStart(2, '0');
const soM = (n) => `${fmt(n)} so'm`;
const kasr = (n) => (Number(n) || 0).toLocaleString('uz-UZ', { maximumFractionDigits: 2 });

export function oyNomi(oy) {
  const [y, m] = String(oy || '').split('-').map(Number);
  if (!y || !m) return String(oy || '');
  return `${OY_NOMLARI[m - 1] || m} ${y}`;
}
const oyKichik = (oy) => (OY_NOMLARI[Number(String(oy).slice(5, 7)) - 1] || '').toLowerCase();

export function keyingiOy(oy) {
  const [y, m] = String(oy || '').split('-').map(Number);
  if (!y || !m) return oy;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// 'YYYY-MM-DD' → '08.10.2026 (chorshanba)'
export function sanaHafta(sana) {
  const d = new Date(`${sana}T12:00:00`);
  const kun = Number.isNaN(d.getTime()) ? '' : ` (${HAFTA[d.getDay()]})`;
  return `${formatDay(sana)}${kun}`;
}

// To'lov sanasi: to'liq ISO → '08.10.2026 14:32'; faqat sana → '08.10.2026'
function vaqtMatni(createdAt) {
  if (!createdAt) return '';
  const s = String(createdAt);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDay(s);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : formatDate(s);
}

// Bitta to'lov summasi: so'm yoki dollar (kurs bilan)
function summaMatni(p) {
  const amt = sonQiymat(p.amount);
  if (p.method === 'Dollorda') {
    const r = sonQiymat(p.rate);
    return `<b>${kasr(amt)} $</b> × ${fmt(r)} = ${soM(amt * r)}`;
  }
  return `<b>${soM(amt)}</b>`;
}

function tolovSatri(p) {
  const vaqt = vaqtMatni(p.createdAt);
  let s = `• ${vaqt ? `${vaqt} — ` : ''}${summaMatni(p)}${p.method ? ` · ${esc(p.method)}` : ''}`;
  if (p.notes) s += `\n   📝 ${esc(p.notes)}`;
  return s;
}

// 'yarim' (eski/kamera) — to'liq kun (ilovadagi ishKuniMi bilan bir xil)
export function holatNorm(h) {
  if (ishKuniMi(h)) return 'keldi';
  return h === 'kelmadi' ? 'kelmadi' : null;
}

// Oydagi kunlar: keldi / kelmadi (belgilangan hamma kunlar) va belgilanmagan
// (bugungacha, ishchi faol bo'lgan kunlar). Kun raqamlari bilan.
export function oyDavomati(ishchi, yoqlama = {}, oy, bugun) {
  const keldi = []; const kelmadi = []; const yoq = [];
  const n = daysInMonth(oy);
  for (let d = 1; d <= n; d += 1) {
    const sana = `${oy}-${pad(d)}`;
    const h = holatNorm(yoqlama[sana] && yoqlama[sana][ishchi.id]);
    if (h === 'keldi') keldi.push(d);
    else if (h === 'kelmadi') kelmadi.push(d);
    else if (sana <= bugun && ishchiFaolmi(ishchi, sana)) yoq.push(d);
  }
  return { keldi, kelmadi, yoq };
}

// Ishchining ma'lumoti boshlangan oy (navigatsiya chegarasi)
export function boshOy(ishchi, { yoqlama = {}, avanslar = {}, maoshlar = {} }, joriy) {
  let min = joriy;
  if (ishchi.ishgaKirgan) {
    const m = String(ishchi.ishgaKirgan).slice(0, 7);
    if (m < min) min = m;
    return min;
  }
  for (const sana in yoqlama) {
    if (yoqlama[sana] && yoqlama[sana][ishchi.id] && sana.slice(0, 7) < min) min = sana.slice(0, 7);
  }
  for (const oy in avanslar) if (avanslar[oy] && avanslar[oy][ishchi.id] && oy < min) min = oy;
  for (const oy in maoshlar) if (maoshlar[oy] && maoshlar[oy][ishchi.id] && oy < min) min = oy;
  return min;
}

// Oy bo'yicha ◀ ▶ tugmalari. k: d (davomat) | a (avans) | m (maosh)
export function oyTugmalari(k, oy, minOy, maxOy) {
  const qator = [];
  const old = oldingiOy(oy);
  const keyin = keyingiOy(oy);
  if (old >= minOy) qator.push({ text: `◀ ${oyNomi(old)}`, callback_data: `ib|${k}|${old}` });
  if (keyin <= maxOy) qator.push({ text: `${oyNomi(keyin)} ▶`, callback_data: `ib|${k}|${keyin}` });
  return qator.length ? { inline_keyboard: [qator] } : undefined;
}

// Pastdagi doimiy menyu (faqat shaxsiy chatda)
export const MENYU_TUGMALAR = {
  hisob: '💰 Hisobim', davomat: '📅 Davomat', avans: '💸 Avanslar', maosh: '🧾 Maosh',
};
export const MENYU = {
  keyboard: [
    [{ text: MENYU_TUGMALAR.hisob }, { text: MENYU_TUGMALAR.davomat }],
    [{ text: MENYU_TUGMALAR.avans }, { text: MENYU_TUGMALAR.maosh }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Matndan menyu bo'limini aniqlash: tugma, /buyruq yoki oddiy so'z
export function menyuBolimi(text) {
  const t = String(text || '').trim().toLowerCase().replace(/@\w+$/, '');
  if (!t) return null;
  if (t === MENYU_TUGMALAR.hisob.toLowerCase() || t === '/hisob' || t === '/balans' || /^hisob/.test(t)) return 'hisob';
  if (t === MENYU_TUGMALAR.davomat.toLowerCase() || t === '/davomat' || /^davomat/.test(t)) return 'davomat';
  if (t === MENYU_TUGMALAR.avans.toLowerCase() || t === '/avans' || /^avans/.test(t)) return 'avans';
  if (t === MENYU_TUGMALAR.maosh.toLowerCase() || t === '/maosh' || /^maosh/.test(t)) return 'maosh';
  if (t === '/menu' || t === '/menyu' || t === 'menyu') return 'menyu';
  return null;
}

export function menyuMatni(ism) {
  return `Salom, <b>${esc(ism)}</b>! 👋\n`
    + `Pastdagi tugmalar orqali o'z hisobingizni istalgan payt ko'ring:\n\n`
    + `💰 <b>Hisobim</b> — hozirgi haqqingiz, shu oy va o'tgan oy\n`
    + `📅 <b>Davomat</b> — kelgan / kelmagan kunlaringiz\n`
    + `💸 <b>Avanslar</b> — olgan avanslaringiz\n`
    + `🧾 <b>Maosh</b> — oylik hisob-kitob va berilgan maosh\n\n`
    + `🔔 Avans yoki maosh berilganda, yo'qlama belgilanganda shu yerga xabar keladi.`;
}

// ---------------- 💰 HISOBIM ----------------
export function hisobMatni(ishchi, d, bugun) {
  const { yoqlama = {}, avanslar = {}, maoshlar = {} } = d;
  const joriy = bugun.slice(0, 7);
  const otgan = oldingiOy(joriy);
  const h = ishchiHisobi(ishchi, yoqlama, avanslar, maoshlar);
  const bj = oylikBalans(ishchi, yoqlama, avanslar, maoshlar, joriy);
  const bo = oylikBalans(ishchi, yoqlama, avanslar, maoshlar, otgan);
  const dv = oyDavomati(ishchi, yoqlama, joriy, bugun);
  const oylik = Number(ishchi.oylikHaqq) || 0;
  const kunSoni = daysInMonth(joriy);

  const q = [
    `👤 <b>${esc(ishchi.name)}</b> — hisobingiz`,
    `📆 Bugun: ${formatDay(bugun)}`,
    '',
    `<b>${oyNomi(joriy)}</b> (shu oy)`,
    `✅ Keldi: ${dv.keldi.length} kun · ❌ Kelmadi: ${dv.kelmadi.length} kun`,
    `💼 Ishlangan: ${soM(bj.ishlangan)}`,
    `💸 Avans: ${soM(bj.avans)}`,
    `<i>Oylik ${soM(oylik)} · kunlik ${soM(kunSoni ? oylik / kunSoni : 0)}</i>`,
  ];

  const otganBor = Math.round(bo.yakun) !== 0 || bo.maosh > 0 || bo.ishlangan > 0 || bo.avans > 0;
  if (otganBor) {
    q.push('', `<b>${oyNomi(otgan)} maoshi</b>`);
    if (Math.round(bo.boshida) !== 0) q.push(`Oy boshida qoldiq: ${bo.boshida < 0 ? '−' : ''}${soM(Math.abs(bo.boshida))}`);
    q.push(`➕ Ishlangan: ${soM(bo.ishlangan)}`);
    // 1–5-sanada olingan avans ham shu yerda (o'tgan oy maoshidan ushlanadi)
    if (bo.avans > 0) q.push(`➖ Avans: ${soM(bo.avans)}`);
    q.push(`🟰 Oy yakuni: ${soM(bo.yakun)}`);
    if (bo.maosh > 0) q.push(`➖ Berilgan: ${soM(bo.maosh)}`);
    const qoldiq = Math.round(bo.qoldiq);
    if (qoldiq > 0) {
      const kun = Number(bugun.slice(8, 10));
      q.push(kun <= MAOSH_KUNI
        ? `⏳ Qoldiq ${soM(qoldiq)} — ${MAOSH_KUNI}-${oyKichik(joriy)}da beriladi`
        : `⏳ Qoldiq ${soM(qoldiq)} — hali berilmagan`);
    } else if (bo.maosh > 0) {
      q.push('✅ To\'liq berilgan');
    } else if (qoldiq < 0) {
      q.push(`Qoldiq: −${soM(-qoldiq)} (avans ko'p olingan)`);
    }
  }

  q.push('', CHIZIQ);
  const haqqi = Math.round(h.haqqi);
  if (haqqi >= 0) q.push(`💰 <b>Hozirgi haqqingiz: ${soM(haqqi)}</b>`);
  else q.push(`💰 <b>Hozirgi holat: −${soM(-haqqi)}</b>`, '<i>Olingan avans ishlaganingizdan ko\'p</i>');
  q.push('<i>(ishlagan haqingiz − olingan avanslar − berilgan maoshlar)</i>');
  return q.join('\n');
}

// ---------------- 📅 DAVOMAT ----------------
export function davomatMatni(ishchi, yoqlama = {}, oy, bugun) {
  const q = [`📅 <b>Davomat — ${oyNomi(oy)}</b>`, ''];
  const dv = oyDavomati(ishchi, yoqlama, oy, bugun);
  if (!dv.keldi.length && !dv.kelmadi.length && !dv.yoq.length) {
    q.push(oy > bugun.slice(0, 7) ? 'Bu oy hali boshlanmagan.' : 'Bu oyda belgilangan kun yo\'q.');
    return q.join('\n');
  }
  const kunlar = (arr) => arr.join(', ');
  q.push(`✅ <b>Keldi — ${dv.keldi.length} kun</b>${dv.keldi.length ? `\n${kunlar(dv.keldi)}` : ''}`);
  q.push('', `❌ <b>Kelmadi — ${dv.kelmadi.length} kun</b>${dv.kelmadi.length ? `\n${kunlar(dv.kelmadi)}` : ''}`);
  if (dv.yoq.length) q.push('', `▫️ <b>Belgilanmagan — ${dv.yoq.length} kun</b>\n${kunlar(dv.yoq)}`);

  const oylik = Number(ishchi.oylikHaqq) || 0;
  const kunSoni = daysInMonth(oy);
  const y = oylikYoqlama(yoqlama, oy, ishchi.id);
  q.push('', CHIZIQ,
    `💼 Ishlangan: <b>${soM(kunSoni ? (oylik / kunSoni) * y.toliq : 0)}</b> (${y.toliq} kun)`,
    `<i>Kunlik haq: ${soM(kunSoni ? oylik / kunSoni : 0)} (oylik ÷ ${kunSoni} kun)</i>`);
  return q.join('\n');
}

// Shu oy maoshidan ushlanadigan avans yozuvlari (o'z oyi + keyingi oyning 1–5-kuni)
export function oyAvanslari(ishchi, avanslar = {}, oy) {
  const out = [];
  for (const k of [oy, keyingiOy(oy)]) {
    for (const p of avansYozuvlari(avanslar[k] && avanslar[k][ishchi.id], k)) {
      if (p && avansOyi(p, k) === oy) out.push(p);
    }
  }
  const t = (p) => { const v = new Date(p.createdAt || 0).getTime(); return Number.isNaN(v) ? 0 : v; };
  return out.sort((a, b) => t(a) - t(b));
}

// ---------------- 💸 AVANSLAR ----------------
export function avanslarMatni(ishchi, avanslar = {}, oy) {
  const list = oyAvanslari(ishchi, avanslar, oy);
  const q = [
    `💸 <b>Avanslar — ${oyNomi(oy)} maoshidan</b>`,
    `<i>${MAOSH_KUNI + 1}-${oyKichik(oy)}dan ${MAOSH_KUNI}-${oyKichik(keyingiOy(oy))}gacha olinganlar</i>`,
    '',
  ];
  if (!list.length) {
    q.push('Bu oy maoshidan avans olinmagan.');
    return q.join('\n');
  }
  list.forEach((p) => q.push(tolovSatri(p)));
  q.push(CHIZIQ, `Jami: <b>${soM(tolovlarSummasi(list))}</b> (${list.length} ta)`);
  return q.join('\n');
}

// ---------------- 🧾 MAOSH ----------------
export function maoshMatni(ishchi, d, oy, bugun) {
  const { yoqlama = {}, avanslar = {}, maoshlar = {} } = d;
  const b = oylikBalans(ishchi, yoqlama, avanslar, maoshlar, oy);
  const y = oylikYoqlama(yoqlama, oy, ishchi.id);
  const oylik = Number(ishchi.oylikHaqq) || 0;
  const kunSoni = daysInMonth(oy);
  const q = [
    `🧾 <b>Maosh — ${oyNomi(oy)}</b>`,
    `<i>Oylik ${soM(oylik)} · ${kunSoni} kun · kunlik ${soM(kunSoni ? oylik / kunSoni : 0)}</i>`,
    '',
  ];
  if (Math.round(b.boshida) !== 0) q.push(`Oy boshida qoldiq: ${b.boshida < 0 ? '−' : ''}${soM(Math.abs(b.boshida))}`);
  q.push(
    `➕ Ishlangan (${y.toliq} kun): ${soM(b.ishlangan)}`,
    `➖ Avans: ${soM(b.avans)}`,
    `🟰 <b>Oy yakuni: ${soM(b.yakun)}</b>`,
  );
  if (b.maosh > 0) q.push(`➖ Berilgan maosh: ${soM(b.maosh)}`);
  q.push(CHIZIQ);
  const qoldiq = Math.round(b.qoldiq);
  if (qoldiq > 0) {
    const holat = oy >= bugun.slice(0, 7) ? 'oy hali tugamagan' : '⏳ hali berilmagan';
    q.push(`Qoldiq: <b>${soM(qoldiq)}</b> — ${holat}`);
  } else if (qoldiq === 0 && b.maosh > 0) {
    q.push(`Qoldiq: <b>0 so'm</b> ✅ To'liq berildi`);
  } else {
    q.push(`Qoldiq: <b>${qoldiq < 0 ? '−' : ''}${soM(Math.abs(qoldiq))}</b>`);
  }
  const tolovlar = avansYozuvlari(maoshlar[oy] && maoshlar[oy][ishchi.id], oy);
  if (tolovlar.length) {
    q.push('', '<b>Berilgan maoshlar:</b>');
    tolovlar.forEach((p) => q.push(tolovSatri(p)));
  }
  q.push('', `<i>Maosh ${MAOSH_KUNI}-sanada o'tgan oy uchun beriladi.</i>`);
  return q.join('\n');
}

// ---------------- 🔔 YO'QLAMA XABARI ----------------
const HOLAT_NOM = { keldi: 'Keldi ✅', kelmadi: 'Kelmadi ❌' };

export function yoqlamaXabarMatni(ishchi, sana, holat, avval, yoqlama = {}) {
  const oy = sana.slice(0, 7);
  const oylik = Number(ishchi.oylikHaqq) || 0;
  const kunSoni = daysInMonth(oy);
  const q = [];
  if (holat === 'keldi') {
    q.push(`✅ <b>${sanaHafta(sana)}</b>`, 'Yo\'qlama: ishga <b>keldi</b> deb belgilandi.');
  } else if (holat === 'kelmadi') {
    q.push(`❌ <b>${sanaHafta(sana)}</b>`, 'Yo\'qlama: <b>kelmadi</b> deb belgilandi.',
      `<i>Bu kun uchun haq hisoblanmaydi (kunlik ${soM(kunSoni ? oylik / kunSoni : 0)}).</i>`);
  } else {
    q.push(`▫️ <b>${sanaHafta(sana)}</b>`, 'Yo\'qlamadagi belgi olib tashlandi.');
  }
  if (avval && avval !== holat && HOLAT_NOM[avval]) q.push(`✏️ <i>Tuzatildi — avval: ${HOLAT_NOM[avval]}</i>`);
  let keldi = 0; let kelmadi = 0;
  for (const s in yoqlama) {
    if (!s.startsWith(oy)) continue;
    const h = holatNorm(yoqlama[s] && yoqlama[s][ishchi.id]);
    if (h === 'keldi') keldi += 1; else if (h === 'kelmadi') kelmadi += 1;
  }
  q.push('', `📅 ${oyNomi(oy)}: ✅ ${keldi} kun · ❌ ${kelmadi} kun`);
  if (holat === 'kelmadi') q.push('<i>Xato bo\'lsa, boshliqqa ayting.</i>');
  return q.join('\n');
}

// ---------------- 🔔 AVANS / MAOSH XABARI ----------------
//  yangilar — yangi to'lov yozuvlari (asl yozuvlar)
//  bekorlar — o'chirilgan yozuvlar jurnaldan: [{ s: so'm, d: createdAt }]
export function tolovXabarMatni(tur, ishchi, d, oy, yangilar = [], bekorlar = []) {
  const { yoqlama = {}, avanslar = {}, maoshlar = {} } = d;
  const q = [];
  if (tur === 'avans') {
    if (yangilar.length) {
      q.push(`💸 <b>${yangilar.length > 1 ? 'Avanslar berildi' : 'Avans berildi'}</b>`);
      yangilar.forEach((p) => {
        q.push(tolovSatri(p), `   <i>→ ${oyNomi(avansOyi(p, oy))} maoshidan ushlanadi</i>`);
      });
    }
    if (bekorlar.length) {
      if (q.length) q.push('');
      q.push('↩️ <b>Avans yozuvi bekor qilindi</b>');
      bekorlar.forEach((e) => q.push(`• ${e.d ? `${vaqtMatni(e.d)} — ` : ''}${soM(e.s)}`));
    }
    const birinchi = yangilar[0] || (bekorlar[0] ? { createdAt: bekorlar[0].d } : null);
    const uOy = birinchi ? avansOyi(birinchi, oy) : oy;
    const jami = tolovlarSummasi(oyAvanslari(ishchi, avanslar, uOy));
    q.push(CHIZIQ, `💸 ${oyNomi(uOy)} maoshidan jami avans: ${soM(jami)}`);
  } else {
    if (yangilar.length) {
      q.push(`🧾 <b>Maosh berildi — ${oyNomi(oy)}</b>`);
      yangilar.forEach((p) => q.push(tolovSatri(p)));
    }
    if (bekorlar.length) {
      if (q.length) q.push('');
      q.push(`↩️ <b>Maosh yozuvi bekor qilindi — ${oyNomi(oy)}</b>`);
      bekorlar.forEach((e) => q.push(`• ${e.d ? `${vaqtMatni(e.d)} — ` : ''}${soM(e.s)}`));
    }
    const b = oylikBalans(ishchi, yoqlama, avanslar, maoshlar, oy);
    const qoldiq = Math.round(b.qoldiq);
    q.push(CHIZIQ, `🟰 Oy yakuni: ${soM(b.yakun)} · berilgan: ${soM(b.maosh)}`);
    q.push(qoldiq > 0 ? `⏳ Qoldiq: <b>${soM(qoldiq)}</b>`
      : qoldiq === 0 ? '✅ Shu oy maoshi to\'liq berildi'
        : `Qoldiq: <b>−${soM(-qoldiq)}</b>`);
  }
  const haqqi = Math.round(ishchiHisobi(ishchi, yoqlama, avanslar, maoshlar).haqqi);
  q.push(haqqi >= 0 ? `💰 Hozirgi haqqingiz: <b>${soM(haqqi)}</b>` : `💰 Hozirgi holat: <b>−${soM(-haqqi)}</b>`);
  return q.join('\n');
}
