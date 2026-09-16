// ============================================================
//  GUL CHIZISH DVIGATELI — Chizma oynasining 3-rejimi
// ------------------------------------------------------------
//  Gul (naqsh, bezak) konturini Detal chizish bilan BIR XIL asboblar bilan
//  chizish: chiziq (uzunlik + burchak), to'rtburchak, aylana, o'lcham,
//  ko'chirish/nusxa/burish/aks/masshtab/offset/o'chirish, griplar, undo/redo,
//  AutoCAD magnitlari (OSNAP) va holat paneli, DXF import/eksport, PNG.
//  Farqi — yon panelda «Nechta ofset tashlansin» soni: Offset asbobi bitta
//  masofa bilan shuncha parallel kontur (masofa, 2×, 3×…) tashlaydi — naqsh
//  qatorlari uchun. Proyeksiyalar bo'limi bu rejimda yo'q.
//  Dvigatelning o'zi detalEngine.js (variant: 'gul') — bitta kod, ikki rejim;
//  gulga xos yangi imkoniyatlar VARIANTS.gul / V.multiOffset shoxlariga qo'shiladi.
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
