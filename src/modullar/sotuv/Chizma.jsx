// ============================================================
//  CHIZMA OYNASI (Savdo bo'limi ichida — Usta va Tovarlar orasida)
// ------------------------------------------------------------
//  Xona konturini chizib, kazirok/devor/qosh/qozon o'lchovlarini
//  hisoblab beradigan yordamchi vosita. Butun mantiq —
//  chizmaEngine.js da; bu yerda faqat karta, yig'ish (collapse)
//  va to'liq ekran rejimi boshqariladi. Chizma avtomatik
//  saqlanadi (localStorage) — yopib-ochilsa ham yo'qolmaydi.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Maximize2, Minimize2, Ruler } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { mountChizma } from './chizmaEngine.js';

export function ChizmaCard({ tunikaBaza = [] }) {
  const [open, setOpen] = useState(() => localStorage.getItem('chizma-open') === '1');
  const [full, setFull] = useState(false);
  const rootRef = useRef(null);
  const apiRef = useRef(null);
  const tunikaRef = useRef(tunikaBaza);
  tunikaRef.current = tunikaBaza;

  // Ochilganda dvigatelni o'rnatamiz, yopilganda butunlay olib tashlaymiz
  // (chizmaning o'zi localStorage'da saqlanadi — hech narsa yo'qolmaydi).
  useEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const api = mountChizma(rootRef.current, { tunikaBaza: tunikaRef.current });
    apiRef.current = api;
    return () => { api.destroy(); apiRef.current = null; };
  }, [open]);

  // Listlar (tunikalar) ro'yxati o'zgarsa — Kazirok panelidagi List selektorlarini yangilaymiz.
  useEffect(() => {
    apiRef.current?.setTunikaBaza?.(tunikaBaza);
  }, [tunikaBaza]);

  // Ochiq/yopiq holatni eslab qolamiz.
  useEffect(() => {
    try { localStorage.setItem('chizma-open', open ? '1' : '0'); } catch (e) { /* noop */ }
  }, [open]);

  // To'liq ekranda orqa sahifa aylanmasin + Esc bilan chiqish.
  useEffect(() => {
    if (!full) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // Chizmaning uzunlik kiritish qutisi ochiq bo'lsa — avval u yopilsin.
      if (rootRef.current?.querySelector('.chz-inputbox.show')) return;
      setFull(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 -mb-1">
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 text-left" aria-expanded={open}>
          <SectionTitle icon={Ruler}>Chizma</SectionTitle>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0 -mt-3">
          {open && (
            <button type="button" onClick={() => setFull(true)} title="To'liq ekran"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Chizmani yopish' : 'Chizmani ochish'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full text-left px-3 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 transition text-sm text-slate-400">
          Xona konturini chizish — kazirok, devor, qosh va qozon o'lchovlarini hisoblash uchun oching
        </button>
      )}

      {open && (
        <div className={full ? 'chz-full-wrap' : ''}>
          {full && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 bg-white">
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Chizma
              </span>
              <button type="button" onClick={() => setFull(false)} title="Kichraytirish (Esc)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                <Minimize2 className="w-3.5 h-3.5" /> Kichraytirish
              </button>
            </div>
          )}
          <div ref={rootRef} />
        </div>
      )}
    </Card>
  );
}
