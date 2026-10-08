// ============================================================
//  ISHCHI BOTI — server mantiqi (Firestore + Telegram)
// ------------------------------------------------------------
//  1) Ishchini aniqlash: telegram-links[tid] → ishchiId, va ulangan
//     raqam HALI HAM ishchi kartochkasida turibdimi (raqam olib
//     tashlansa — kirish ham yopiladi).
//  2) Xabarlar (ilova o'zgarishdan keyin /api/ishchi-bot ni chaqiradi):
//     - yo'qlama: bazadagi holat jurnaldagidan farq qilsa yuboriladi;
//       3 daqiqa ichida qayta o'zgarsa — yangi xabar emas, o'sha tahrir.
//     - avans / maosh: yangi yozuv → "berildi", o'chirilgan → "bekor".
//     Hamma narsa SERVERDA bazadan qayta o'qiladi — klient faqat
//     "qayerga qarash kerak"ligini aytadi (soxta summa yuborib bo'lmaydi),
//     har yozuv uchun xabar BIR MARTA ketadi (jurnal: ishchi-*-log).
// ============================================================
import { readShop, mergeShop, FieldValue } from './_firebase.js';
import { sendMessage, editMessageText } from './_tg.js';
import { normPhone } from './_match.js';
import { bugunTashkent } from './_attendance.js';
import {
  holatNorm, yoqlamaXabarMatni, tolovXabarMatni, hisobMatni, davomatMatni, avanslarMatni,
  maoshMatni, oyTugmalari, boshOy, MENYU,
} from './_ishchiMatn.js';
import { avansYozuvlari, tolovlarSummasi, ishchiFaolmi, oldingiOy } from '../src/lib/helpers.js';

export const YOQ_LOG = 'ishchi-yoqlama-log';
export const TOLOV_LOG = 'ishchi-tolov-log';
const TAHRIR_MS = 3 * 60 * 1000;     // shu muddatda qayta o'zgarsa — xabar tahrirlanadi
const HISOB_ORALIQ_MS = 60 * 1000;   // "Hisobini yuborish" — bir ishchiga daqiqada bir marta
const YOQ_SAQLASH_KUN = 70;          // yo'qlama jurnali necha kun saqlanadi
const TOLOV_SAQLASH_OY = 14;         // avans/maosh jurnali necha oy saqlanadi

const SANA_RE = /^\d{4}-\d{2}-\d{2}$/;
const OY_RE = /^\d{4}-\d{2}$/;
const IDRE = /^[A-Za-z0-9_-]{1,64}$/;

// Sozlamalar → Nazorat boti → "Ishchilarga xabar" (yo'q bo'lsa — yoqilgan)
export function xabarYoqilgan(settings, tur) {
  const x = (settings && settings.ishchiXabar) || {};
  return x[tur] !== false;
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
export function bolimMatni(bolim, ishchi, d, oyTanlangan) {
  const bugun = bugunTashkent();
  const joriy = bugun.slice(0, 7);
  const minOy = boshOy(ishchi, d, joriy);
  const chegara = (oy, sukut) => {
    let o = OY_RE.test(String(oy || '')) ? oy : sukut;
    if (o > joriy) o = joriy;
    if (o < minOy) o = minOy;
    return o;
  };
  if (bolim === 'davomat') {
    const oy = chegara(oyTanlangan, joriy);
    return { text: davomatMatni(ishchi, d.yoqlama, oy, bugun), reply_markup: oyTugmalari('d', oy, minOy, joriy) };
  }
  if (bolim === 'avans') {
    const oy = chegara(oyTanlangan, joriy);
    return { text: avanslarMatni(ishchi, d.avanslar, oy), reply_markup: oyTugmalari('a', oy, minOy, joriy) };
  }
  if (bolim === 'maosh') {
    // Sukut — o'tgan oy (maosh 5-sanada o'tgan oy uchun beriladi)
    const oy = chegara(oyTanlangan, oldingiOy(joriy));
    return { text: maoshMatni(ishchi, d, oy, bugun), reply_markup: oyTugmalari('m', oy, minOy, joriy) };
  }
  return { text: hisobMatni(ishchi, d, bugun), reply_markup: MENYU };
}

// ---- SOF qarorlar (test: src/lib/ishchiBot.test.mjs) ----

// Yo'qlama: bazadagi holat (holat) va jurnaldagi oxirgi yozuv (old) bo'yicha nima qilish kerak.
//  'yoq'    — o'zgarmagan, hech narsa;
//  'jim'    — jurnalga yoziladi, xabar yo'q (ulanmagan / xabar o'chiq / hech qachon
//             xabar berilmagan belgi olib tashlandi / ishchi o'sha kuni faol emas);
//  'tahrir' — 3 daqiqa ichidagi o'z xabarimiz tahrirlanadi;
//  'yangi'  — yangi xabar.  avval — "Tuzatildi — avval: …" uchun.
export function yoqlamaQaror({ holat, old, now, chatsBor, faol }) {
  const oldH = (old && old.h) || null;
  if (holat === oldH) return { tur: 'yoq' };
  if (!chatsBor || !faol || (!holat && !(old && old.x))) return { tur: 'jim' };
  if (old && old.mids && Object.keys(old.mids).length && now - (old.t || 0) < TAHRIR_MS) {
    return { tur: 'tahrir', avval: old.p || null };
  }
  return { tur: 'yangi', avval: oldH };
}

// Avans/maosh: bazadagi yozuvlar (list) va jurnal (yozuv) farqi.
//  ishora — ilova "yangi qo'shildi" degan yozuv idlari. Jurnal hali yo'q bo'lsa
//  (birinchi marta) faqat ular uchun xabar; qolgan eski yozuvlar jim yozib qo'yiladi
//  (eski tarix yog'ilib ketmasin). Jurnal bor bo'lsa — hamma yangi yozuvga xabar
//  (oldingi chaqiriq yetib bormagan bo'lsa ham keyingisi to'ldiradi).
export function tolovFarqi(list, yozuv, ishora, yuborsaBoladi) {
  const known = (yozuv && yozuv.e) || {};
  const ish = new Set((ishora || []).map(String));
  const qosh = {}; const ochir = []; const yangilar = []; const bekorlar = [];
  const bor = new Set();
  for (const p of list) {
    bor.add(p.id);
    if (known[p.id]) continue;
    const yubor = (!!yozuv || ish.has(String(p.id))) && yuborsaBoladi;
    qosh[p.id] = { s: Math.round(tolovlarSummasi([p])), d: p.createdAt || '', x: yubor ? 1 : 0 };
    if (yubor) yangilar.push(p);
  }
  for (const id of Object.keys(known)) {
    if (bor.has(id)) continue;
    ochir.push(id);
    if (known[id] && known[id].x && yuborsaBoladi) bekorlar.push(known[id]);
  }
  return { qosh, ochir, yangilar, bekorlar };
}

// Eski jurnal kalitlarini o'chirish (hujjat 1 MB dan oshib ketmasin)
function eskiSanalar(log, kun) {
  const chegara = new Date(Date.now() - kun * 86400000).toISOString().slice(0, 10);
  const out = {};
  for (const s in (log || {})) if (s < chegara) out[s] = FieldValue.delete();
  return out;
}

// ---------------- YO'QLAMA ----------------
export async function yoqlamaXabarlari(db, sana, ishchiIdlar) {
  if (!SANA_RE.test(String(sana || ''))) return { ok: false, error: 'sana' };
  const ids = [...new Set((Array.isArray(ishchiIdlar) ? ishchiIdlar : [])
    .map((x) => String(x)).filter((x) => IDRE.test(x)))].slice(0, 300);
  if (!ids.length) return { ok: true, yuborildi: 0 };

  const [settings, links, d, log] = await Promise.all([
    readShop(db, 'telegram-settings'), readShop(db, 'telegram-links'), ishchiMalumoti(db), readShop(db, YOQ_LOG),
  ]);
  const yoqilgan = xabarYoqilgan(settings, 'yoqlama');
  const kun = d.yoqlama[sana] || {};
  const logKun = (log && log[sana]) || {};
  const now = Date.now();
  const patch = {};
  let yuborildi = 0;

  await Promise.all(ids.map(async (id) => {
    const ishchi = d.ishchilar.find((i) => i.id === id);
    if (!ishchi) return;
    const holat = holatNorm(kun[id]);
    const old = logKun[id] || null;
    const chats = yoqilgan ? ishchiChatlari(links, d.ishchilar, id) : [];
    const q = yoqlamaQaror({ holat, old, now, chatsBor: chats.length > 0, faol: ishchiFaolmi(ishchi, sana) });
    if (q.tur === 'yoq') return; // o'zgarmagan (masalan "Hammasi keldi" qayta bosildi)
    if (q.tur === 'jim') {
      patch[id] = { h: holat || '', t: now, p: (old && old.h) || '', x: (old && old.x) || 0, mids: FieldValue.delete() };
      return;
    }
    // Yaqinda (3 daqiqa) yuborilgan o'z xabarimiz bo'lsa — yangisini emas, o'shani tahrirlaymiz
    const yaqin = q.tur === 'tahrir';
    const avval = q.avval;
    const matn = yoqlamaXabarMatni(ishchi, sana, holat, avval, d.yoqlama);
    const mids = {};
    await Promise.all(chats.map(async (tid) => {
      if (yaqin && old.mids[tid]) {
        const r = await editMessageText(tid, old.mids[tid], matn);
        if ((r && r.ok) || /not modified/i.test((r && r.description) || '')) { mids[tid] = old.mids[tid]; return; }
      }
      const r = await sendMessage(tid, matn);
      if (r && r.ok && r.result) { mids[tid] = r.result.message_id; yuborildi += 1; }
    }));
    patch[id] = { h: holat || '', t: now, p: avval || '', x: 1, mids };
  }));

  if (Object.keys(patch).length) {
    await mergeShop(db, YOQ_LOG, { ...eskiSanalar(log, YOQ_SAQLASH_KUN), [sana]: patch });
  }
  return { ok: true, yuborildi };
}

// Kamera "keldi" yozganda (api/arrival.js) — jurnalga ham yozamiz, shunda
// keyin "Hammasi keldi" bosilsa ishchiga ikkinchi marta xabar ketmaydi.
// xabarBerildi — "xush kelibsiz" yetib bordimi. Xabar tahrirlanmaydi (mids yo'q).
export async function yoqlamaKameraLog(db, sana, ishchiId, xabarBerildi) {
  await mergeShop(db, YOQ_LOG, {
    [sana]: { [ishchiId]: { h: 'keldi', t: Date.now(), p: '', x: xabarBerildi ? 1 : 0, mids: FieldValue.delete() } },
  });
}

// ---------------- AVANS / MAOSH ----------------
export async function tolovXabarlari(db, tur, oy, ishchiId, yangi = []) {
  if (tur !== 'avans' && tur !== 'maosh') return { ok: false, error: 'tur' };
  if (!OY_RE.test(String(oy || ''))) return { ok: false, error: 'oy' };
  if (!IDRE.test(String(ishchiId || ''))) return { ok: false, error: 'ishchi' };

  const [settings, links, d, log] = await Promise.all([
    readShop(db, 'telegram-settings'), readShop(db, 'telegram-links'), ishchiMalumoti(db), readShop(db, TOLOV_LOG),
  ]);
  const ishchi = d.ishchilar.find((i) => i.id === ishchiId);
  if (!ishchi) return { ok: true, yuborildi: 0 };

  const manba = tur === 'avans' ? d.avanslar : d.maoshlar;
  const list = avansYozuvlari(manba[oy] && manba[oy][ishchiId], oy)
    .filter((p) => p && p.id && !p.eski && IDRE.test(String(p.id)));
  const yozuv = (log && log[tur] && log[tur][oy] && log[tur][oy][ishchiId]) || null;
  const chats = xabarYoqilgan(settings, tur) ? ishchiChatlari(links, d.ishchilar, ishchiId) : [];
  const { qosh, ochir, yangilar, bekorlar } = tolovFarqi(list, yozuv, Array.isArray(yangi) ? yangi : [], chats.length > 0);
  const patchE = { ...qosh };
  for (const id of ochir) patchE[id] = FieldValue.delete();
  if (!Object.keys(patchE).length) return { ok: true, yuborildi: 0 };

  // Eski oylar jurnalini tozalash
  const chegara = new Date(Date.now() - TOLOV_SAQLASH_OY * 31 * 86400000).toISOString().slice(0, 7);
  const ildiz = {};
  for (const t of ['avans', 'maosh']) {
    for (const o in ((log && log[t]) || {})) {
      if (o < chegara) { ildiz[t] = ildiz[t] || {}; ildiz[t][o] = FieldValue.delete(); }
    }
  }
  ildiz[tur] = { ...(ildiz[tur] || {}), [oy]: { [ishchiId]: { e: patchE } } };
  // Avval jurnal ("band qilish") — parallel chaqiriq xabarni ikki marta yubormasin
  await mergeShop(db, TOLOV_LOG, ildiz);

  if (!yangilar.length && !bekorlar.length) return { ok: true, yuborildi: 0 };
  const matn = tolovXabarMatni(tur, ishchi, d, oy, yangilar, bekorlar);
  let yuborildi = 0;
  await Promise.all(chats.map(async (tid) => {
    const r = await sendMessage(tid, matn);
    if (r && r.ok) yuborildi += 1;
  }));
  return { ok: true, yuborildi };
}

// ---------------- "Hisobini yuborish" (ilovadan qo'lda) ----------------
export async function hisobYubor(db, ishchiId) {
  if (!IDRE.test(String(ishchiId || ''))) return { ok: false, error: 'ishchi' };
  const [links, d, log] = await Promise.all([
    readShop(db, 'telegram-links'), ishchiMalumoti(db), readShop(db, TOLOV_LOG),
  ]);
  const ishchi = d.ishchilar.find((i) => i.id === ishchiId);
  if (!ishchi) return { ok: false, error: 'ishchi' };
  const chats = ishchiChatlari(links, d.ishchilar, ishchiId);
  if (!chats.length) return { ok: false, error: 'ulanmagan' };
  const oxirgi = Number(log && log.hisob && log.hisob[ishchiId]) || 0;
  if (Date.now() - oxirgi < HISOB_ORALIQ_MS) return { ok: false, error: 'tez' };
  await mergeShop(db, TOLOV_LOG, { hisob: { [ishchiId]: Date.now() } });
  const matn = `📨 <i>Hisobingiz yuborildi</i>\n\n${hisobMatni(ishchi, d, bugunTashkent())}`;
  let yuborildi = 0;
  await Promise.all(chats.map(async (tid) => {
    const r = await sendMessage(tid, matn, { reply_markup: MENYU });
    if (r && r.ok) yuborildi += 1;
  }));
  return yuborildi ? { ok: true, yuborildi } : { ok: false, error: 'yuborilmadi' };
}
