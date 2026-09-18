// ============================================================
//  GUL CHIZISH DVIGATELI — Chizma oynasining 3-rejimi
// ------------------------------------------------------------
//  Gul (naqsh, bezak) konturini Detal chizish bilan BIR XIL asboblar bilan
//  chizish: chiziq (uzunlik + burchak), to'rtburchak, aylana, o'lcham,
//  ko'chirish/nusxa/burish/aks/masshtab/offset/o'chirish, griplar, undo/redo,
//  AutoCAD magnitlari (OSNAP) va holat paneli, DXF import/eksport, PNG.
//  Farqi — yon panelda «Ofset (ichkariga)» masofasi (sm, default 2): shakl hamma
//  tomondan yopiq bo'lsa (uchlari tutashgan chiziq/yoylar — join, yoki aylana) shu
//  masofada ichkariga parallel kontur avtomatik, jonli chiziladi (chainOffset.js).
//  Qo'lda «Offset» ham tutashgan elementlarni bitta kontur sifatida ofset qiladi.
//  Proyeksiyalar bo'limi bu rejimda yo'q. Dvigatelning o'zi detalEngine.js
//  (variant: 'gul') — bitta kod, ikki rejim; gulga xos yangi imkoniyatlar
//  VARIANTS.gul / V.autoOffset / V.zakas / V.joinOffset shoxlariga qo'shiladi.
//  Yon panel tepasida ZAKASDAGI GULLAR ro'yxati: har zakas (opts.zakasKey —
//  zakas draft'ining gulKey'i) o'z gullariga ega, ular orasida bosib o'tiladi,
//  nomi + o'lchami (eni × bo'yi) ko'rinadi (localStorage gul-zakas-v1).
//  localStorage: gul-chizma-v1 (ishchi holat), gul-chizma-lib-v1 (kutubxona).
//  mountGul(root, { zakasKey }) — DOM quradi, { destroy, centerView } qaytaradi.
// ============================================================
import { mountDetal } from './detalEngine.js';

export function mountGul(root, opts) {
  return mountDetal(root, { variant: 'gul', zakasKey: opts && opts.zakasKey });
}
