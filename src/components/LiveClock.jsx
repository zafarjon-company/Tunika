// ============================================================
//  JONLI SANA / SOAT
// ------------------------------------------------------------
//  Har soniyada yangilanadi. Alohida komponent bo'lgani uchun
//  faqat o'zi qayta render bo'ladi (butun App emas).
//  Ko'rinishi:  2026-yil 25-may, Chorshanba, 13:45:16
// ============================================================
import React, { useState, useEffect } from 'react';
import { OY_NOMLARI, HAFTA_KUNLARI } from '../lib/constants.js';

const pad = (n) => String(n).padStart(2, '0');

function hozir() {
  const d = new Date();
  const y = d.getFullYear();
  const kun = d.getDate();
  const oy = (OY_NOMLARI[d.getMonth()] || '').toLowerCase();
  const hafta = HAFTA_KUNLARI[d.getDay()] || '';
  const vaqt = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${y}-yil ${kun}-${oy}, ${hafta}, ${vaqt}`;
}

export function LiveClock() {
  const [matn, setMatn] = useState(hozir);

  useEffect(() => {
    const id = setInterval(() => setMatn(hozir()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{matn}</span>
  );
}
