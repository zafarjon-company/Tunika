// ============================================================
//  OMBOR → ZAVOD NARX JADVALI — sozlama tahrirlagichi uchun SOF mantiq
// ------------------------------------------------------------
//  Saqlangan shakl (ombor-sozlama.narxJadval):
//    { [zavod]: { [tur]: { [qalinlik]: $/t } } }
//  Forma holati (OmborSozlama.jsx): zavod va tur RO'YXAT QATORLARINING
//  ID lari bo'yicha:
//    narx[zavodQatorId][turQatorId] = [{ id, q, v }]  (q — qalinlik, v — narx; matn)
//  Ro'yxat qatori: { id, v, asl } — v joriy nom, asl saqlangan nom ('' — yangi).
//
//  Qoidalar:
//   • Nom o'zgarsa jadval unga ERGASHADI (saqlashda joriy nom bilan yoziladi).
//   • Ro'yxatda YO'Q (eski) zavod / tur narxlari TEGILMAYDI — sozlamani saqlash
//     jimgina ma'lumot o'chirmasin. Qator o'chirilsa yoki nomi tozalansa ham.
//   • Qator qo'shilib / nomi o'zgartirilib saqlangan nomga tushsa — o'sha
//     nomning narxlari qayta bog'lanadi (narxBogla) va ko'rinib turadi.
//   • Bir xil (norm bo'yicha) nomli ikki qator — xato (royxatDublikatlar);
//     saqlashda har nomdan birinchisi olinadi.
//  React yo'q — node testlari (omborHisob.test.mjs) bilan tekshiriladi.
// ============================================================
import { son, norm, kalitTop } from './omborHisob.js';

// Qator id si — faqat forma ichida noyob bo'lishi kifoya (saqlanmaydi)
let idSanoq = 0;
export const yangiId = () => `nj${(idSanoq += 1).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Qalinlik kaliti: "0,40" → "0.4" (jadval kaliti MATN bo'lib saqlanadi)
export function qalKalit(x) {
  const n = son(x);
  return n != null && n > 0 ? String(n) : '';
}

// Ustun (obyekt) → tahrirlanadigan qatorlar (qalinlik bo'yicha tartiblangan)
export function ustunQatorlar(ustun) {
  const obj = (ustun && typeof ustun === 'object') ? ustun : {};
  return Object.keys(obj)
    .map((k) => ({ id: yangiId(), q: k, v: obj[k] == null ? '' : String(obj[k]) }))
    .sort((a, b) => (son(a.q) ?? 0) - (son(b.q) ?? 0));
}

// Qatorlar → ustun obyekti (bo'sh va yaroqsiz qatorlar tushib qoladi)
export function ustunObyekt(qatorlar) {
  const out = {};
  for (const r of (qatorlar || [])) {
    const k = qalKalit(r.q);
    const v = son(r.v);
    if (!k || v == null || !(v > 0)) continue;
    out[k] = v;
  }
  return out;
}

// Qatorlar saqlangan ustun bilan mazmunan tengmi (avto bog'langan, tegilmagan)
function ustunTeng(qatorlar, ustun) {
  const a = ustunObyekt(qatorlar);
  const b = ustunObyekt(Object.entries(ustun || {}).map(([q, v]) => ({ q, v })));
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return bk.every((k) => a[k] != null && Math.abs(a[k] - b[k]) < 1e-9);
}

// Saqlangan jadvaldan nomzod nomlar bo'yicha ustun (birinchi topilgani), yo'q — null
function saqlanganUstun(jadval, zNomlar, tNomlar) {
  const j = (jadval && typeof jadval === 'object') ? jadval : {};
  for (const zn of zNomlar) {
    const zk = kalitTop(j, zn);
    if (zk == null || !j[zk] || typeof j[zk] !== 'object') continue;
    for (const tn of tNomlar) {
      const tk = kalitTop(j[zk], tn);
      if (tk != null && j[zk][tk] && typeof j[zk][tk] === 'object') return j[zk][tk];
    }
  }
  return null;
}

// Forma holati: saqlangan jadval → zavod / tur qator id lari bo'yicha ustunlar
export function narxHolat(jadval, zavodQatorlar, turQatorlar) {
  const out = {};
  for (const z of zavodQatorlar) {
    out[z.id] = {};
    for (const t of turQatorlar) {
      const u = saqlanganUstun(jadval, [z.v, z.asl], [t.v, t.asl]);
      out[z.id][t.id] = u ? ustunQatorlar(u) : [];
    }
  }
  return out;
}

// Forma holatidagi bitta ustun (zavod × tur) — yo'q bo'lsa bo'sh
export const narxUstunQatorlar = (f, zId, tId) => ((f.narx && f.narx[zId] && f.narx[zId][tId]) || []);

// Qator NOMI o'zgarganda (zId — zavod qatori, tId — tur qatori; eskiNom — avvalgi nom):
// saqlangan jadvalda yangi nom bo'lsa, uning narxlari ustunlarga qayta bog'lanadi.
//  • bo'sh ustun — har doim yangi nomdan to'ldiriladi (yo'q bo'lsa bo'sh qoladi);
//  • YANGI qator (asl === '') uchun avvalgi nomdan AVTO bog'langan (tegilmagan)
//    ustun ham yangi nomga almashadi — "Xito" → "Xitoy" → "Xitoy2" deb yozganda
//    Xitoy narxlari Xitoy2 ga ko'chib qolmasin;
//  • foydalanuvchi to'ldirgan / o'zgartirgan ustunga TEGILMAYDI;
//  • yuklangan (asl bor) qator qayta nomlansa — narxlari unga ergashadi, faqat
//    bo'sh ustunlari yangi nomdan to'ldiriladi.
export function narxBogla(f, jadval, { zId = null, tId = null, eskiNom = '' } = {}) {
  const narx = { ...(f.narx || {}) };
  for (const z of f.royxat.zavodlar) {
    if (zId != null && z.id !== zId) continue;
    const zCol = { ...(narx[z.id] || {}) };
    for (const t of f.royxat.turlar) {
      if (tId != null && t.id !== tId) continue;
      const joriy = zCol[t.id] || [];
      let avto = joriy.length === 0;
      if (!avto && eskiNom) {
        const yangiQator = zId != null ? !norm(z.asl) : !norm(t.asl);
        if (yangiQator) {
          const eskiU = zId != null
            ? saqlanganUstun(jadval, [eskiNom], [t.v])
            : saqlanganUstun(jadval, [z.v], [eskiNom]);
          avto = !!eskiU && ustunTeng(joriy, eskiU);
        }
      }
      if (!avto) continue;
      const u = saqlanganUstun(jadval, [z.v], [t.v]);
      zCol[t.id] = u ? ustunQatorlar(u) : [];
    }
    narx[z.id] = zCol;
  }
  return { ...f, narx };
}

// Ro'yxat qatori o'chirilganda uning ustunlarini forma holatidan olib tashlash
export function narxQatorOchir(f, nom, id) {
  const narx = { ...(f.narx || {}) };
  if (nom === 'zavodlar') delete narx[id];
  if (nom === 'turlar') {
    for (const zId of Object.keys(narx)) {
      if (narx[zId] && narx[zId][id] !== undefined) {
        const { [id]: _olib, ...qoldiq } = narx[zId];
        narx[zId] = qoldiq;
      }
    }
  }
  return { ...f, narx };
}

// Forma → saqlanadigan jadval.
//  Ro'yxatdagi zavod / turlar joriy nomi bilan qayta yoziladi. Ro'yxatda YO'Q
//  (eski) zavod yoki turlarning narxlari TEGILMAYDI. Nomi tozalangan qator —
//  o'chirilgan qator kabi (eski nomi ro'yxatda yo'q hisoblanadi, narxi saqlanadi).
//  Bog'lanmagan (undefined) ustun — saqlangandagi holicha qoladi; [] — foydalanuvchi
//  bo'shatgan (yozilmaydi). Takror nomlardan birinchisi olinadi.
export function narxObyekt(f, eskiJadval) {
  const eski = (eskiJadval && typeof eskiJadval === 'object') ? eskiJadval : {};
  const nomlar = (qatorlar) => {
    const st = new Set();
    for (const r of qatorlar) {
      if (!norm(r.v)) continue; // nomi bo'sh qator ro'yxatda qolmaydi
      st.add(norm(r.v));
      if (norm(r.asl)) st.add(norm(r.asl));
    }
    return st;
  };
  const zNomlar = nomlar(f.royxat.zavodlar);
  const tNomlar = nomlar(f.royxat.turlar);
  const out = {};
  // 1) Ro'yxatda yo'q eski zavodlar — butunlay saqlanadi
  for (const [z, turlar] of Object.entries(eski)) {
    if (!zNomlar.has(norm(z)) && turlar && typeof turlar === 'object') out[z] = turlar;
  }
  // 2) Ro'yxatdagi zavodlar — joriy nomi bilan
  const zYozilgan = new Set();
  for (const z of f.royxat.zavodlar) {
    const zNom = String(z.v || '').trim();
    if (!zNom || zYozilgan.has(norm(zNom))) continue;
    zYozilgan.add(norm(zNom));
    const turlarOut = {};
    // shu zavodning (eski yoki yangi nomi bilan) ro'yxatda yo'q turlari saqlanadi
    for (const nom of [z.asl, z.v]) {
      const zk = kalitTop(eski, nom);
      if (zk == null || !eski[zk] || typeof eski[zk] !== 'object') continue;
      for (const [t, ustun] of Object.entries(eski[zk])) if (!tNomlar.has(norm(t))) turlarOut[t] = ustun;
    }
    const tYozilgan = new Set();
    for (const t of f.royxat.turlar) {
      const tNom = String(t.v || '').trim();
      if (!tNom || tYozilgan.has(norm(tNom))) continue;
      tYozilgan.add(norm(tNom));
      const qatorlar = (f.narx && f.narx[z.id]) ? f.narx[z.id][t.id] : undefined;
      const ustun = qatorlar === undefined
        ? (saqlanganUstun(eski, [z.v, z.asl], [t.v, t.asl]) || {})
        : ustunObyekt(qatorlar);
      if (Object.keys(ustun).length) turlarOut[tNom] = ustun;
    }
    if (Object.keys(turlarOut).length) out[zNom] = turlarOut;
  }
  return out;
}

// Ro'yxatda takror (norm bo'yicha) nomli qatorlar id lari — saqlashni bloklaydi
export function royxatDublikatlar(qatorlar) {
  const korilgan = new Map();
  const dubl = new Set();
  for (const r of (qatorlar || [])) {
    const k = norm(r.v);
    if (!k) continue;
    if (korilgan.has(k)) { dubl.add(korilgan.get(k)); dubl.add(r.id); } else korilgan.set(k, r.id);
  }
  return dubl;
}
