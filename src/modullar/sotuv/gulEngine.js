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
//  localStorage: gul-chizma-v1 (joriy chizma), gul-chizma-lib-v1 (kutubxona).
//  mountGul(root) — DOM quradi, { destroy, centerView } qaytaradi.
// ============================================================
import { mountDetal } from './detalEngine.js';

export function mountGul(root) {
  return mountDetal(root, { variant: 'gul' });
}
