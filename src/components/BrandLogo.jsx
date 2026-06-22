// ============================================================
//  BREND MONOGRAMI — "Z" (Zafarjon), po'lat (metall) uslubida
// ------------------------------------------------------------
//  Plastinka (orqa fon) rangi MAVZU AKSENTIDAN olinadi
//  (var(--c-btn)/var(--c-btnh)) — shuning uchun mavzu almashsa
//  logo rangi ham unga MOS o'zgaradi. "Z" harfi esa po'lat
//  (kumush) jiloda — metall mahsulot hissi. Diagonalda nozik
//  "buklama" yorug'lik chizig'i (tom/profnastil ishorasi).
//
//  plate=false  -> faqat po'lat "Z" (fonsiz), masalan to'q joyda
//  size className orqali beriladi (w-10 h-10 ...).
// ============================================================
import React from 'react';

let _uid = 0;
export function BrandLogo({ className = '', plate = true, rounded = 22 }) {
  // Har nusxa uchun noyob gradient id (bir sahifada bir nechta bo'lsa to'qnashmasin)
  const id = React.useMemo(() => `bl${(_uid += 1)}`, []);
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Logo">
      <defs>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
          {/* var() faqat CSS-da ishlaydi — shuning uchun style orqali (mavzuga moslashadi) */}
          <stop offset="0" style={{ stopColor: 'var(--c-btnh, #334155)' }} />
          <stop offset="1" style={{ stopColor: 'var(--c-btn, #0f172a)' }} />
        </linearGradient>
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbfdff" />
          <stop offset=".42" stopColor="#d2dae3" />
          <stop offset=".56" stopColor="#a9b5c3" />
          <stop offset="1" stopColor="#eaf0f6" />
        </linearGradient>
      </defs>

      {plate && (
        <rect x="2" y="2" width="96" height="96" rx={rounded} fill={`url(#${id}-plate)`} />
      )}

      {/* "Z" — qalin lenta shaklida (tepa chiziq + diagonal + past chiziq) */}
      <polygon
        points="22,20 78,20 78,31 45,69 78,69 78,80 22,80 22,69 55,31 22,31"
        fill={`url(#${id}-steel)`}
        stroke="rgba(0,0,0,.20)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* Diagonal bo'ylab "buklama" yorug'lik (metall qatlama hissi) */}
      <line x1="66.5" y1="31" x2="33.5" y2="69" stroke="#ffffff" strokeWidth="1.5" strokeOpacity=".5" strokeLinecap="round" />
    </svg>
  );
}
