// ============================================================
//  ISHCHI BOTI — server mantiqi (Firestore + Telegram)
// ------------------------------------------------------------
//  1) Ishchini aniqlash: telegram-links[tid] → ishchiId, va ulangan
//     raqam HALI HAM ishchi kartochkasida turibdimi (raqam olib
//     tashlansa — kirish ham, xabarlar ham yopiladi).
//  2) Xabarlar (ilova o'zgarishdan keyin /api/ishchi-bot ni chaqiradi,
//     kuniga bir marta Vercel cron esa o'tkazib yuborilganlarni to'ldiradi):
//     - yo'qlama: bazadagi holat jurnaldagidan farq qilsa yuboriladi;
//       bir so'rovda bir ishchiga bir necha kun kelsa — bitta yig'ma xabar;
//     - avans / maosh: yangi yozuv → "berildi", o'chirilgan → "bekor".
//     Hamma narsa SERVERDA bazadan qayta o'qiladi — klient faqat
//     "qayerga qarash kerak"ligini aytadi (soxta summa yuborib bo'lmaydi).
//  3) "Bir xabar — bir marta, lekin yo'qolmasin" — jurnal (ishchi-*-log):
//     - qaror va "band qilish" Firestore TRANZAKSIYASIDA; manba (yoqlama /
//       avanslar / maoshlar) ham o'sha tranzaksiyada o'qiladi;
//     - band qilingan yozuvda b (yoki o'chirishda o) = vaqt belgisi — "yuborilmoqda".
//       Yetkazilgach belgi olinadi. Funksiya o'rtada to'xtasa (Vercel timeout),
//       BAND_MS dan keyin belgi "eskirgan" deb hisoblanadi va xabar qayta yuboriladi;
//     - Telegram vaqtincha qabul qilmasa (429, 5xx, tarmoq) — jurnal SHARTLI
//       (hali o'sha band qilish turgan bo'lsa) qaytariladi, javob {qayta:true};
//       ishchi botni bloklagan bo'lsa (403/400) — qayta urinilmaydi.
//     - yo'qlamada a = ishchiga oxirgi AYTILGAN holat ("Tuzatildi — avval: …" uchun).
// ============================================================
import { readShop, mergeShop, txShop, FieldValue } from './_firebase.js';
import { sendMessage, natijaTuri } from './_tg.js';
import { normPhone } from './_match.js';
import { bugunTashkent } from './_attendance.js';
import {
  holatNorm, yoqlamaXabarMatni, yoqlamaJamlanmaMatni, tolovXabarMatni, hisobMatni, davomatMatni,
  avanslarMatni, maoshMatni, oyTugmalari, oyChegarasi, keyingiOy, MENYU,
} from './_ishchiMatn.js';
import { avansYozuvlari, tolovlarSummasi, ishchiFaolmi, oldingiOy, MAOSH_KUNI } from '../src/lib/helpers.js';

export const YOQ_LOG = 'ishchi-yoqlama-log';
export const TOLOV_LOG = 'ishchi-tolov-log';
export const BAND_MS = 2 * 60 * 1000; // "yuborilmoqda" belgisi shuncha vaqtdan keyin eskirgan
const HISOB_ORALIQ_MS = 60 * 1000;   // "Hisobini yuborish" — bir ishchiga daqiqada bir marta
const YOQ_SAQLASH_KUN = 70;          // yo'qlama jurnali necha kun saqlanadi
const YOQ_QABUL_KUN = 60;            // undan eski sana uchun xabar yo'q (jurnal tozalangan bo'lishi mumkin)
const TOLOV_SAQLASH_OY = 14;         // avans/maosh jurnali necha oy saqlanadi
const TOLOV_QABUL_OY = 12;           // undan eski oy uchun xabar yo'q (saqlash muddatining ichida)
const YANGI_YOZUV_MS = 3 * 86400000; // jurnal yo'q katakda shu muddatdagi yozuvlar ham e'lon qilinadi
const TOPLAM = 20;                   // bir vaqtda nechta ishchiga yuboriladi (Telegram ~30/s)

const SANA_RE = /^\d{4}-\d{2}-\d{2}$/;
const OY_RE = /^\d{4}-\d{2}$/;
const IDRE = /^[A-Za-z0-9_-]{1,64}$/;
const kut = (ms) => new Promise((r) => setTimeout(r, ms));

// 'YYYY-MM-DD' + n kun (Toshkent sanasi ustida, soatsiz)
export function sanaQosh(sana, n) {
  const d = new Date(`${sana}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// 'YYYY-MM' + n oy
export function oyQosh(oy, n) {
  const [y, m] = String(oy).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Sozlamalar → Ishchilar boti → "Ishchiga xabar yuborilsin" (yo'q bo'lsa — yoqilgan)
export function xabarYoqilgan(settings, tur) {
  const x = (settings && settings.ishchiXabar) || {};
  return x[tur] !== false;
}
// To'lov izohlari ishchiga ko'rinsinmi — SUKUT: YO'Q (izohda ichki gap bo'lishi mumkin)
export function izohKorinsin(settings) {
  const x = (settings && settings.ishchiXabar) || {};
  return x.izoh === true;
}

// Ulangan Telegram akkaunt hali ham shu ishchiga tegishlimi
export function ishchiTekshir(link, ishchilar) {
  if (!link || !link.ishchiId) return null;
  const ishchi = (ishchilar || []).find((i) => i && i.id === link.ishchiId);
  if (!ishchi) return null;
  if (link.phone) {
    const p = normPhone(link.phone);
    if (!(ishchi.phones || []).some((ph) => normPhone(ph) === p)) return null;
  }
  return ishchi;
}

// Ishchiga ulangan barcha Telegram chatlari (tid = shaxsiy chat id)
export function ishchiChatlari(links, ishchilar, ishchiId) {
  return Object.keys(links || {}).filter((tid) => {
    const l = links[tid];
    return l && l.ishchiId === ishchiId && ishchiTekshir(l, ishchilar);
  });
}

export async function ishchiMalumoti(db) {
  const [ishchilar, yoqlama, avanslar, maoshlar] = await Promise.all([
    readShop(db, 'ishchilar'), readShop(db, 'yoqlama'), readShop(db, 'avanslar'), readShop(db, 'maoshlar'),
  ]);
  return {
    ishchilar: Array.isArray(ishchilar) ? ishchilar.filter(Boolean) : [],
    yoqlama: yoqlama || {}, avanslar: avanslar || {}, maoshlar: maoshlar || {},
  };
}

// Menyu bo'limi matni + oy tugmalari. bolim: hisob | davomat | avans | maosh
//  opts.izoh — to'lov izohlari ko'rinsinmi (izohKorinsin)
export function bolimMatni(bolim, ishchi, d, oyTanlangan, opts = {}) {
  const bugun = bugunTashkent();
  const joriy = bugun.slice(0, 7);
  const { min: minOy, max } = oyChegarasi(ishchi, d, joriy);
  const maxOy = max > joriy ? max : joriy;
  const chegara = (oy, sukut) => {
    let o = OY_RE.test(String(oy || '')) ? oy : sukut;
    if (o > maxOy) o = maxOy;
    if (o < minOy) o = minOy;
    return o;
  };
  if (bolim === 'davomat') {
    const oy = chegara(oyTanlangan, joriy);
    return { text: davomatMatni(ishchi, d.yoqlama, oy, bugun), reply_markup: oyTugmalari('d', oy, minOy, maxOy) };
  }
  if (bolim === 'avans') {
    // 1–5-kunlarda olingan avans o'tgan oy maoshidan ushlanadi — sukut o'sha oy
    // (bugungi kun aynan o'sha oraliqda; aks holda yangi avans "olinmagan" ko'rinardi)
    const sukut = Number(bugun.slice(8, 10)) <= MAOSH_KUNI ? oldingiOy(joriy) : joriy;
    const oy = chegara(oyTanlangan, sukut);
    return { text: avanslarMatni(ishchi, d.avanslar, oy, opts), reply_markup: oyTugmalari('a', oy, minOy, maxOy) };
  }
  if (bolim === 'maosh') {
    // Sukut — o'tgan oy (maosh 5-sanada o'tgan oy uchun beriladi)
    const oy = chegara(oyTanlangan, oldingiOy(joriy));
    return { text: maoshMatni(ishchi, d, oy, bugun, opts), reply_markup: oyTugmalari('m', oy, minOy, maxOy) };
  }
  return { text: hisobMatni(ishchi, d, bugun), reply_markup: MENYU };
}

// Bir ishchining barcha chatlariga ketma-ket yuboradi.
// 'ok' — kamida bittasiga yetdi; 'vaqtinchalik' — keyin qayta urinish kerak;
// 'doimiy' — hech qachon yetmaydi (bloklangan / chat yo'q / matn yaroqsiz).
async function chatlargaYubor(tids, matn, extra) {
  let natija = 'doimiy';
  for (const tid of tids) {
    const r = await sendMessage(tid, matn, extra);
    const t = natijaTuri(r);
    if (t === 'ok') natija = 'ok';
    else if (t === 'vaqtinchalik' && natija !== 'ok') natija = 'vaqtinchalik';
  }
  return tids.length ? natija : 'doimiy';
}

// Ro'yxatni TOPLAM tadan bo'lib ishlaydi, to'plamlar orasida 1 s (Telegram ommaviy limiti)
async function toplamlab(items, fn) {
  for (let i = 0; i < items.length; i += TOPLAM) {
    await Promise.all(items.slice(i, i + TOPLAM).map(fn));
    if (i + TOPLAM < items.length) await kut(1000);
  }
}

// ---- SOF qarorlar (test: src/lib/ishchiBot.test.mjs) ----

// Jurnal yozuvidan ishchiga oxirgi AYTILGAN holat ('keldi' | 'kelmadi' | null).
// Eski yozuvlarda a yo'q — x:1 bo'lsa h aytilgan deb olinadi.
export function aytilganHolat(old) {
  if (!old) return null;
  if (old.a !== undefined) return old.a || null;
  return old.x ? (old.h || null) : null;
}

// Yo'qlama: bazadagi holat va jurnaldagi oxirgi yozuv (old) bo'yicha nima qilish kerak.
//  'yoq'   — o'zgarmagan, hech narsa;
//  'band'  — boshqa so'rov hozir shu kun haqida xabar yubormoqda (qayta urinish kerak);
//  'jim'   — jurnalga yoziladi, xabar yo'q (ulanmagan / xabar o'chiq / ishchi o'sha kuni
//            faol emas / ishchi bu holatni allaqachon biladi);
//  'yangi' — yangi xabar (har doim push). avval — ishchiga oxirgi AYTILGAN holat.
export function yoqlamaQaror({ holat, old, chatsBor, faol, now = 0 }) {
  let o = old;
  if (o && o.b) {
    if (now - o.b < BAND_MS) return { tur: 'band' };
    // Eskirgan band: funksiya yuborishdan oldin to'xtagan — da'vo qilingan holat AYTILMAGAN
    o = { h: '\u0000', a: o.pa || '' };
  }
  const oldH = (o && o.h) || null;
  const aytilgan = aytilganHolat(o);
  if ((holat || null) === oldH) return { tur: 'yoq' };
  if (!chatsBor || !faol) return { tur: 'jim', aytilgan };
  if ((holat || null) === aytilgan) return { tur: 'jim', aytilgan };
  return { tur: 'yangi', avval: aytilgan, aytilgan };
}

// Avans/maosh: bazadagi yozuvlar (list) va jurnal (yozuv) farqi.
//  ishora — ilova "yangi qo'shildi" degan yozuv idlari; yaqinmi(p) — yozuv yaqinda
//  qilinganmi. Jurnal hali yo'q bo'lsa (katakda birinchi marta) faqat ishora qilingan
//  yoki yaqinda qilingan yozuvlar e'lon qilinadi, qolgan eski tarix jim yozib qo'yiladi.
//  Jurnal bor bo'lsa — har bir ko'rilmagan yozuv e'lon qilinadi.
//  Jurnal yozuvi: { s, d, x } (+ b: e'lon qilinmoqda, o: bekor qilinmoqda — vaqt belgisi).
//  del — maydonni o'chirish belgisi (Firestore'da FieldValue.delete()).
//  Natija: qosh (yoziladigan/yangilanadigan yozuvlar), ochir (jurnaldan o'chadigan idlar),
//  yangilar, bekorlar ({id, s, d, x}), band (boshqa so'rov hozir yubormoqda).
export function tolovFarqi(list, yozuv, ishora, yuborsaBoladi, yaqinmi = () => false, now = 0, del = null) {
  const known = (yozuv && yozuv.e) || {};
  const ish = new Set((ishora || []).map(String));
  const qosh = {}; const ochir = []; const yangilar = []; const bekorlar = [];
  let band = false;
  const bor = new Set();
  const yangiMi = (t) => t && now - t < BAND_MS;
  for (const p of list) {
    bor.add(p.id);
    const k = known[p.id];
    const s = Math.round(tolovlarSummasi([p]));
    if (k) {
      if (yangiMi(k.b)) { band = true; continue; }
      if (k.b) {
        // Eskirgan "e'lon qilinmoqda" — xabar yetmagan bo'lishi mumkin: qayta
        if (yuborsaBoladi) { qosh[p.id] = { s, d: p.createdAt || '', x: 1, b: now }; yangilar.push(p); }
        else qosh[p.id] = { x: 0, b: del };
      } else if (k.o) {
        qosh[p.id] = { o: del }; // yozuv qaytib keldi — bekor qilish to'xtaydi
      }
      continue;
    }
    const yubor = (!!yozuv || ish.has(String(p.id)) || yaqinmi(p)) && yuborsaBoladi;
    qosh[p.id] = yubor ? { s, d: p.createdAt || '', x: 1, b: now } : { s, d: p.createdAt || '', x: 0 };
    if (yubor) yangilar.push(p);
  }
  for (const id of Object.keys(known)) {
    if (bor.has(id)) continue;
    const k = known[id] || {};
    if (yangiMi(k.b) || yangiMi(k.o)) { band = true; continue; }
    if ((k.x || k.b || k.o) && yuborsaBoladi) {
      qosh[id] = { o: now };
      bekorlar.push({ id, s: k.s, d: k.d || '', x: 1 });
    } else {
      ochir.push(id);
    }
  }
  return { qosh, ochir, yangilar, bekorlar, band };
}

// Avans/maosh yozuvlari (eski sonli format va 'eski' idli yozuv hech qachon e'lon qilinmaydi)
export function tolovRoyxati(manba, oy, ishchiId) {
  return avansYozuvlari(manba && manba[oy] && manba[oy][ishchiId], oy)
    .filter((p) => p && p.id && !p.eski && p.id !== 'eski' && IDRE.test(String(p.id)));
}

// Yo'qlama jurnal yozuvini asl holatiga qaytarish uchun to'liq patch (yo'q maydon — o'chadi)
function yoqAsl(old) {
  const del = FieldValue.delete();
  const out = {};
  for (const f of ['h', 't', 'a', 'x', 'b', 'pa']) out[f] = old[f] === undefined ? del : old[f];
  return out;
}

// ---------------- YO'QLAMA ----------------
//  kunlar — { 'YYYY-MM-DD': [ishchiId, ...] }
export async function yoqlamaXabarlari(db, kunlar) {
  const bugun = bugunTashkent();
  const quyi = sanaQosh(bugun, -YOQ_QABUL_KUN);
  // Avval saralash (juda eski va kelajak sanalar tashlanadi), keyin cheklash —
  // aks holda eski sanalar 62 talik joyni egallab, yangi kunlar tushib qolardi
  const sanalar = Object.keys(kunlar || {})
    .filter((s) => SANA_RE.test(s) && s >= quyi && s <= bugun)
    .sort()
    .slice(-62);
  const juftlar = [];
  const korilgan = new Set();
  for (const sana of sanalar) {
    for (const raw of (Array.isArray(kunlar[sana]) ? kunlar[sana] : []).slice(0, 300)) {
      const id = String(raw);
      if (!IDRE.test(id) || korilgan.has(`${sana}|${id}`)) continue;
      korilgan.add(`${sana}|${id}`);
      juftlar.push({ sana, id });
    }
  }
  if (!juftlar.length) return { ok: true, yuborildi: 0 };

  const [settings, links, d] = await Promise.all([
    readShop(db, 'telegram-settings'), readShop(db, 'telegram-links'), ishchiMalumoti(db),
  ]);
  const yoqilgan = xabarYoqilgan(settings, 'yoqlama');
  const ish = {}; const chatlar = {};
  for (const { id } of juftlar) {
    if (id in ish) continue;
    ish[id] = d.ishchilar.find((i) => i.id === id) || null;
    chatlar[id] = yoqilgan && ish[id] ? ishchiChatlari(links, d.ishchilar, id) : [];
  }
  // now — band qilish belgisi ham: kasr qismi ikki parallel so'rovni farqlaydi
  const now = Date.now() + Math.random();
  const del = FieldValue.delete();

  // 1) Atomar: manba (yoqlama) + jurnal o'qiladi, qaror va band qilish (+ eski sanalarni tozalash)
  const { yuborish, band, yoqlama } = await txShop(db, YOQ_LOG, (log, q) => {
    const L = log || {};
    const Y = (q && q.yoqlama) || {};
    const patch = {}; const yub = []; let bnd = false;
    for (const { sana, id } of juftlar) {
      const ishchi = ish[id];
      if (!ishchi) continue;
      const holat = holatNorm(Y[sana] && Y[sana][id]);
      const old = (L[sana] && L[sana][id]) || null;
      const qr = yoqlamaQaror({ holat, old, chatsBor: chatlar[id].length > 0, faol: ishchiFaolmi(ishchi, sana), now });
      if (qr.tur === 'yoq') continue;
      if (qr.tur === 'band') { bnd = true; continue; }
      patch[sana] = patch[sana] || {};
      if (qr.tur === 'jim') {
        patch[sana][id] = { h: holat || '', t: now, a: qr.aytilgan || '', x: qr.aytilgan ? 1 : 0, b: del, pa: del };
        continue;
      }
      patch[sana][id] = { h: holat || '', t: now, a: holat || '', x: 1, b: now, pa: qr.aytilgan || '' };
      yub.push({ sana, id, holat, avval: qr.avval, aytilgan: qr.aytilgan, old: old ? { ...old } : null });
    }
    const chegara = sanaQosh(bugun, -YOQ_SAQLASH_KUN);
    for (const s of Object.keys(L)) if (s < chegara && !patch[s]) patch[s] = del;
    return { patch, natija: { yuborish: yub, band: bnd, yoqlama: Y } };
  }, ['yoqlama']);

  // 2) Har ishchiga BITTA xabar: bir kun — oddiy, bir necha kun — yig'ma
  const guruh = {};
  for (const r of yuborish) (guruh[r.id] = guruh[r.id] || []).push(r);
  let yuborildi = 0; let qayta = band;
  const natijalar = []; // { kunlarI, t }
  await toplamlab(Object.keys(guruh), async (id) => {
    const kunlarI = guruh[id].sort((a, b) => (a.sana < b.sana ? -1 : 1));
    const matn = kunlarI.length === 1
      ? yoqlamaXabarMatni(ish[id], kunlarI[0].sana, kunlarI[0].holat, kunlarI[0].avval, yoqlama)
      : yoqlamaJamlanmaMatni(ish[id], kunlarI, yoqlama);
    const t = await chatlargaYubor(chatlar[id], matn);
    if (t === 'ok') yuborildi += 1;
    if (t === 'vaqtinchalik') qayta = true;
    natijalar.push({ kunlarI, t });
  });

  // 3) Yakunlash — SHARTLI: jurnalda hali ham aynan shu so'rovning band qilishi
  //    (b === now) turgan bo'lsagina. Oraliqda boshqa so'rov yozgan bo'lsa — tegmaymiz.
  if (natijalar.length) {
    await txShop(db, YOQ_LOG, (log) => {
      const L = log || {};
      const patch = {};
      for (const { kunlarI, t } of natijalar) {
        for (const k of kunlarI) {
          const cur = L[k.sana] && L[k.sana][k.id];
          if (!cur || cur.b !== now) continue;
          patch[k.sana] = patch[k.sana] || {};
          if (t === 'ok') patch[k.sana][k.id] = { b: del, pa: del };
          else if (t === 'doimiy') patch[k.sana][k.id] = { a: k.aytilgan || '', x: k.aytilgan ? 1 : 0, b: del, pa: del };
          else patch[k.sana][k.id] = k.old ? yoqAsl(k.old) : del;
        }
      }
      return { patch, natija: null };
    });
  }
  return qayta ? { ok: false, qayta: true, error: 'telegram', yuborildi } : { ok: true, yuborildi };
}

// Kamera "keldi" yozganda (api/arrival.js) — jurnalga ham yozamiz, shunda keyin
// "Hammasi keldi" bosilsa ishchiga ikkinchi xabar ketmaydi.
// xabarBerildi — "xush kelibsiz" yetib bordimi (yetmasa — "keldi" aytilmagan).
export async function yoqlamaKameraLog(db, sana, ishchiId, xabarBerildi) {
  const del = FieldValue.delete();
  await mergeShop(db, YOQ_LOG, {
    [sana]: {
      [ishchiId]: {
        h: 'keldi', t: Date.now(), a: xabarBerildi ? 'keldi' : '', x: xabarBerildi ? 1 : 0, b: del, pa: del,
      },
    },
  });
}

// ---------------- AVANS / MAOSH ----------------
//  maqsadlar — [{ tur:'avans'|'maosh', oy:'YYYY-MM', ishchiId, yangi:[yozuvId...] }]
export async function tolovXabarlari(db, maqsadlar) {
  const joriy = bugunTashkent().slice(0, 7);
  const quyiOy = oyQosh(joriy, -TOLOV_QABUL_OY);
  const yuqoriOy = keyingiOy(joriy);
  const bir = new Map();
  for (const m of (Array.isArray(maqsadlar) ? maqsadlar : []).slice(0, 500)) {
    if (!m || (m.tur !== 'avans' && m.tur !== 'maosh')) continue;
    if (!OY_RE.test(String(m.oy || '')) || !IDRE.test(String(m.ishchiId || ''))) continue;
    // Juda eski oy (jurnali tozalangan bo'lishi mumkin — takror e'lon) va uzoq kelajak — yo'q
    if (m.oy < quyiOy || m.oy > yuqoriOy) continue;
    const k = `${m.tur}|${m.oy}|${m.ishchiId}`;
    const yangi = (Array.isArray(m.yangi) ? m.yangi : []).map(String);
    const eski = bir.get(k);
    bir.set(k, { tur: m.tur, oy: m.oy, ishchiId: String(m.ishchiId), yangi: eski ? [...eski.yangi, ...yangi] : yangi });
  }
  if (!bir.size) return { ok: true, yuborildi: 0 };

  const [settings, links, d] = await Promise.all([
    readShop(db, 'telegram-settings'), readShop(db, 'telegram-links'), ishchiMalumoti(db),
  ]);
  // now — band qilish belgisi ham: kasr qismi ikki parallel so'rovni farqlaydi
  const now = Date.now() + Math.random();
  const del = FieldValue.delete();
  const opts = { izoh: izohKorinsin(settings) };
  const yaqinmi = (p) => {
    const t = new Date(p.createdAt || 0).getTime();
    return !Number.isNaN(t) && t > now - YANGI_YOZUV_MS && t < now + 86400000;
  };
  const tayyor = [...bir.values()].map((m) => {
    const ishchi = d.ishchilar.find((i) => i.id === m.ishchiId) || null;
    const chats = ishchi && xabarYoqilgan(settings, m.tur) ? ishchiChatlari(links, d.ishchilar, m.ishchiId) : [];
    return { ...m, ishchi, chats };
  }).filter((m) => m.ishchi);
  // Ikkalasi ham kerak: avans xabarida hozirgi haqqi maoshga, maosh xabarida qoldiq avansga bog'liq
  const manbalar = ['avanslar', 'maoshlar'];

  // 1) Atomar: manba + jurnal o'qiladi, farq + band qilish (+ eski oylarni tozalash)
  const { ishlar, band, manba } = await txShop(db, TOLOV_LOG, (log, q) => {
    const L = log || {};
    const A = (q && q.avanslar) || {};
    const M = (q && q.maoshlar) || {};
    const patch = {}; const ish = []; let bnd = false;
    for (const m of tayyor) {
      const list = tolovRoyxati(m.tur === 'avans' ? A : M, m.oy, m.ishchiId);
      const yozuv = (L[m.tur] && L[m.tur][m.oy] && L[m.tur][m.oy][m.ishchiId]) || null;
      const f = tolovFarqi(list, yozuv, m.yangi, m.chats.length > 0, yaqinmi, now, del);
      if (f.band) bnd = true;
      const e = { ...f.qosh };
      f.ochir.forEach((id) => { e[id] = del; });
      if (!Object.keys(e).length) continue; // bo'sh map merge'da butun katakni o'chirardi
      patch[m.tur] = patch[m.tur] || {};
      patch[m.tur][m.oy] = patch[m.tur][m.oy] || {};
      patch[m.tur][m.oy][m.ishchiId] = { e };
      if (f.yangilar.length || f.bekorlar.length) ish.push({ m, yangilar: f.yangilar, bekorlar: f.bekorlar });
    }
    const chegara = oyQosh(joriy, -TOLOV_SAQLASH_OY);
    for (const t of ['avans', 'maosh']) {
      for (const o of Object.keys((L[t]) || {})) {
        if (o < chegara && !(patch[t] && patch[t][o])) { patch[t] = patch[t] || {}; patch[t][o] = del; }
      }
    }
    return { patch, natija: { ishlar: ish, band: bnd, manba: { avanslar: A, maoshlar: M } } };
  }, manbalar);

  // 2) Yuborish
  const dYangi = { ...d, avanslar: manba.avanslar, maoshlar: manba.maoshlar };
  let yuborildi = 0; let qayta = band;
  const natijalar = [];
  await toplamlab(ishlar, async (ishItem) => {
    const { m, yangilar, bekorlar } = ishItem;
    const matn = tolovXabarMatni(m.tur, m.ishchi, dYangi, m.oy, yangilar, bekorlar, opts);
    const t = await chatlargaYubor(m.chats, matn);
    if (t === 'ok') yuborildi += 1;
    if (t === 'vaqtinchalik') qayta = true;
    natijalar.push({ ...ishItem, t });
  });

  // 3) Yakunlash — SHARTLI (jurnalda hali shu so'rovning b/o belgisi turgan bo'lsa)
  if (natijalar.length) {
    await txShop(db, TOLOV_LOG, (log) => {
      const L = log || {};
      const patch = {};
      for (const { m, yangilar, bekorlar, t } of natijalar) {
        const E = (L[m.tur] && L[m.tur][m.oy] && L[m.tur][m.oy][m.ishchiId] && L[m.tur][m.oy][m.ishchiId].e) || {};
        const e = {};
        for (const p of yangilar) {
          if (!E[p.id] || E[p.id].b !== now) continue;
          if (t === 'ok') e[p.id] = { b: del };
          else if (t === 'doimiy') e[p.id] = { x: 0, b: del };
          else e[p.id] = del; // keyingi signal / kunlik tekshiruv qayta e'lon qiladi
        }
        for (const b of bekorlar) {
          if (!E[b.id] || E[b.id].o !== now) continue;
          if (t === 'vaqtinchalik') e[b.id] = { o: del }; // keyingi safar yana "bekor" urinadi
          else e[b.id] = del;
        }
        if (!Object.keys(e).length) continue;
        patch[m.tur] = patch[m.tur] || {};
        patch[m.tur][m.oy] = patch[m.tur][m.oy] || {};
        patch[m.tur][m.oy][m.ishchiId] = { e };
      }
      return { patch, natija: null };
    });
  }
  return qayta ? { ok: false, qayta: true, error: 'telegram', yuborildi } : { ok: true, yuborildi };
}

// ---------------- KUNLIK TEKSHIRUV (Vercel cron) ----------------
// Ilova signali yo'qolgan bo'lsa (internet uzilgan, ilova yopilgan, server xatosi)
// — oxirgi 3 kun yo'qlamasi va joriy/o'tgan oy avans-maoshini jurnal bilan
// solishtirib, aytilmaganlarini yuboradi. Jurnal bor joyda takror yo'q.
export async function kunlikTekshiruv(db) {
  const bugun = bugunTashkent();
  const [d, yLog, tLog] = await Promise.all([ishchiMalumoti(db), readShop(db, YOQ_LOG), readShop(db, TOLOV_LOG)]);
  const kunlar = {};
  for (const sana of [0, 1, 2].map((n) => sanaQosh(bugun, -n))) {
    const ids = new Set([...Object.keys(d.yoqlama[sana] || {}), ...Object.keys((yLog && yLog[sana]) || {})]);
    if (ids.size) kunlar[sana] = [...ids];
  }
  const joriy = bugun.slice(0, 7);
  const maqsadlar = [];
  for (const tur of ['avans', 'maosh']) {
    const manba = tur === 'avans' ? d.avanslar : d.maoshlar;
    for (const oy of [joriy, oldingiOy(joriy)]) {
      const ids = new Set([
        ...Object.keys(manba[oy] || {}),
        ...Object.keys((tLog && tLog[tur] && tLog[tur][oy]) || {}),
      ]);
      ids.forEach((ishchiId) => maqsadlar.push({ tur, oy, ishchiId, yangi: [] }));
    }
  }
  const y = Object.keys(kunlar).length ? await yoqlamaXabarlari(db, kunlar) : { ok: true, yuborildi: 0 };
  const t = maqsadlar.length ? await tolovXabarlari(db, maqsadlar) : { ok: true, yuborildi: 0 };
  return { ok: !!(y.ok && t.ok), yoqlama: y, tolov: t };
}

// ---------------- "Hisobini yuborish" (ilovadan qo'lda) ----------------
export async function hisobYubor(db, ishchiId) {
  if (!IDRE.test(String(ishchiId || ''))) return { ok: false, error: 'ishchi' };
  const [links, d] = await Promise.all([readShop(db, 'telegram-links'), ishchiMalumoti(db)]);
  const ishchi = d.ishchilar.find((i) => i.id === ishchiId);
  if (!ishchi) return { ok: false, error: 'ishchi' };
  const chats = ishchiChatlari(links, d.ishchilar, ishchiId);
  if (!chats.length) return { ok: false, error: 'ulanmagan' };
  // Atomar daqiqalik cheklov — parallel so'rovlar ham bitta xabar beradi
  const now = Date.now();
  const ruxsat = await txShop(db, TOLOV_LOG, (log) => {
    const oxirgi = Number(log && log.hisob && log.hisob[ishchiId]) || 0;
    if (now - oxirgi < HISOB_ORALIQ_MS) return { patch: null, natija: false };
    return { patch: { hisob: { [ishchiId]: now } }, natija: true };
  });
  if (!ruxsat) return { ok: false, error: 'tez' };
  const matn = `📨 <i>Hisobingiz yuborildi</i>\n\n${hisobMatni(ishchi, d, bugunTashkent())}`;
  const t = await chatlargaYubor(chats, matn, { reply_markup: MENYU });
  return t === 'ok' ? { ok: true, yuborildi: 1 } : { ok: false, error: 'yuborilmadi' };
}
