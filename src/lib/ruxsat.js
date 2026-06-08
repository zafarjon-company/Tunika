// ============================================================
//  ROLLAR VA RUXSATLAR
// ------------------------------------------------------------
//  Rollar: founder (asoschi) > admin > ishchi.
//   - tabKoradi(role, tab) — qaysi bo'limlarni ko'radi.
//   - ruxsat(role, amal)   — qaysi amallarga ruxsati bor.
//  Foydalanuvchi (login) hisoblari Sozlamalar → Foydalanuvchilarda
//  yaratiladi; har biriga rol beriladi.
// ============================================================
import { Crown, Shield, HardHat } from 'lucide-react';

export const ROLLAR = {
  founder: { nom: 'Asoschi',       icon: Crown,   cls: 'bg-amber-100 text-amber-800' },
  admin:   { nom: 'Administrator', icon: Shield,  cls: 'bg-blue-100 text-blue-800' },
  ishchi:  { nom: 'Ishchi',        icon: HardHat, cls: 'bg-slate-100 text-slate-600' },
};

export function rolNomi(role) { return (ROLLAR[role] || ROLLAR.ishchi).nom; }

// Ishchi faqat shu bo'limlarni ko'radi (qolganlari yashiriladi)
const ISHCHI_TABS = ['new', 'orders', 'mijozlar', 'yoqlama', 'settings'];

export function tabKoradi(role, tab) {
  if (tab === 'jurnal') return role === 'founder' || role === 'admin';
  if (role === 'ishchi') return ISHCHI_TABS.includes(tab);
  return true; // founder, admin — barchasi
}

// amal: 'zakasOchirish' | 'narx' | 'foydalanuvchi' | 'jurnal' | 'kurs' | 'zaxira'
const MATRITSA = {
  founder: { zakasOchirish: true,  narx: true,  foydalanuvchi: true,  jurnal: true,  kurs: true,  zaxira: true },
  admin:   { zakasOchirish: true,  narx: true,  foydalanuvchi: false, jurnal: true,  kurs: true,  zaxira: true },
  ishchi:  { zakasOchirish: false, narx: false, foydalanuvchi: false, jurnal: false, kurs: false, zaxira: false },
};

export function ruxsat(role, amal) {
  return !!((MATRITSA[role] || MATRITSA.ishchi)[amal]);
}
