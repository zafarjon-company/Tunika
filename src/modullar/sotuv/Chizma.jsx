// ============================================================
//  CHIZMA OYNASI (Savdo bo'limi ichida — Usta va Tovarlar orasida)
// ------------------------------------------------------------
//  Uch rejim (tab):
//   • Xona konturi — xonani chizib kazirok/devor/qosh/qozon o'lchovlarini
//     hisoblash (chizmaEngine.js).
//   • Detal chizish — alohida detalni (patalok, qosh profili, paloska...)
//     AutoCAD uslubida sm + gradus bilan chizish (detalEngine.js).
//   • Gul chizish — gul/naqsh konturini xuddi shu asboblar bilan chizish,
//     yon panelda avtomatik ichki ofset masofasi va zakasdagi gullar ro'yxati
//     (gulEngine.js → detalEngine variant 'gul').
//  Bu yerda faqat karta, tab, yig'ish (collapse) va to'liq ekran rejimi
//  boshqariladi. Barcha chizmalar avtomatik saqlanadi (localStorage) —
//  yopib-ochilsa yoki rejim almashsa ham yo'qolmaydi.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Maximize2, Minimize2, Ruler, PenTool, Flower2 } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { mountChizma } from './chizmaEngine.js';
import { mountDetal } from './detalEngine.js';
import { mountGul } from './gulEngine.js';

const MODE_KEY = 'xona-chizma-mode';   // oxirgi tanlangan rejim ('xona' | 'detal' | 'gul')
const MODES = [
  { v: 'xona', label: 'Xona konturi', hint: 'Kazirok · devor · qosh · qozon', Icon: Ruler },
  { v: 'detal', label: 'Detal chizish', hint: 'sm + gradus, AutoCAD uslubi', Icon: PenTool },
  { v: 'gul', label: 'Gul chizish', hint: 'Gul / naqsh konturi, avtomatik ichki ofset (join) bilan', Icon: Flower2 },
];

function readMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return MODES.some((x) => x.v === m) ? m : 'xona';
  } catch (e) { return 'xona'; }
}

// zakasId — Gul chizish: shu zakasga tegishli gullar ro'yxati kaliti (draft.gulKey)
function mountFor(mode, root, tunikaBaza, zakasId) {
  if (mode === 'detal') return mountDetal(root);
  if (mode === 'gul') return mountGul(root, { zakasKey: zakasId });
  return mountChizma(root, { tunikaBaza });
}

export function ChizmaCard({ tunikaBaza = [], zakasId = '' }) {
  // HAR DOIM yopiq ochiladi (foydalanuvchi xohishi) — chizmaning O'ZI baribir
  // localStorage'da saqlanadi, ochilganda joyida turadi.
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState(readMode);
  const rootRef = useRef(null);
  const apiRef = useRef(null);
  const tunikaRef = useRef(tunikaBaza);
  tunikaRef.current = tunikaBaza;

  function pickMode(m) {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* noop */ }
  }

  // Ochilganda (yoki rejim almashganda) tegishli dvigatelni o'rnatamiz,
  // yopilganda butunlay olib tashlaymiz (holat localStorage'da — hech narsa yo'qolmaydi).
  useEffect(() => {
    if (!open || !rootRef.current) return undefined;
    const api = mountFor(mode, rootRef.current, tunikaRef.current, zakasId);
    apiRef.current = api;
    return () => { api.destroy(); apiRef.current = null; };
  }, [open, mode, zakasId]);

  // Listlar (tunikalar) ro'yxati o'zgarsa — Kazirok panelidagi List selektorlarini yangilaymiz.
  useEffect(() => {
    apiRef.current?.setTunikaBaza?.(tunikaBaza);
  }, [tunikaBaza]);

  // To'liq ekranda orqa sahifa aylanmasin. Esc to'liq ekrandan CHIQARMAYDI
  // (AutoCAD'dek: Esc faqat joriy buyruq/tanlovni bekor qiladi — dvigatel
  // ichida) — chiqish faqat «Kichraytirish» tugmasi bilan.
  useEffect(() => {
    if (!full) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [full]);

  const tabs = (
    <div className="chz-tabs" role="tablist">
      {MODES.map((m) => (
        <button type="button" key={m.v} role="tab" aria-selected={mode === m.v}
          className={'chz-tab' + (mode === m.v ? ' on' : '')} onClick={() => pickMode(m.v)} title={m.hint}>
          <m.Icon className="w-3.5 h-3.5" />
          {m.label}
        </button>
      ))}
    </div>
  );
  const modeLabel = MODES.find((m) => m.v === mode)?.label || 'Chizma';

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
          Xona konturini chizish (kazirok, devor, qosh, qozon hisobi), alohida detal
          (patalok, qosh profili) yoki gul / naqsh chizish (avtomatik ichki ofset bilan) — sm va gradus bilan,
          AutoCAD uslubida. Ochish uchun bosing
        </button>
      )}

      {open && (
        <div className={full ? 'chz-full-wrap' : ''}>
          {full ? (
            <div className="chz-fullhead flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 bg-white">
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Chizma <span className="text-slate-400 font-medium normal-case tracking-normal">· {modeLabel}</span>
              </span>
              {tabs}
              <button type="button" onClick={() => setFull(false)} title="Kichraytirish"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                <Minimize2 className="w-3.5 h-3.5" /> Kichraytirish
              </button>
            </div>
          ) : (
            <div className="chz-tabsrow">{tabs}</div>
          )}
          <div ref={rootRef} key={mode} />
        </div>
      )}
    </Card>
  );
}
