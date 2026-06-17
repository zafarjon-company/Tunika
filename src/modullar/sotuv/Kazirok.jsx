// ============================================================
//  KAZIROK BO'LIMI (Savdo > Chizma ichida)
// ------------------------------------------------------------
//  Kazirok detallarini chizma ko'rinishida, parametrik (razmeri
//  o'zgartiriladigan) holda ko'rsatadi. Hozircha faqat "Patalok":
//  list 62.5 sm enidan yasaladigan simmetrik detal. Faqat ikki
//  razmer o'zgaradi — PESHONA (yuqori qism) va RAZMERI (asosiy
//  tana). Detal simmetrik: chap tomon o'zgarsa, o'ng tomon ham
//  aynan o'zgaradi. Razmerlar chapda, sm da ko'rinadi.
//  Qiymatlar localStorage'da saqlanadi.
// ============================================================
import React, { useState, useEffect } from 'react';
import { ChevronDown, Frame } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';

const LS_KEY = 'kazirok-patalok-v1';

// --- Patalok qat'iy o'lchovlari (sm) ---
const W = 62.5;      // list eni (qat'iy)
const NOTCH_H = 1.6; // buklanish (peshona burmasi) o'yig'i balandligi
const NOTCH_D = 1.5; // o'yiqning ichkariga kirishi
const HEM = 1.5;     // yuqori/past qatlama (buklangan chet)

const GREEN = '#16a34a';   // razmer rangi (AutoCAD uslubidagi yashil)
const INK = '#0f172a';     // detal chizig'i rangi

const DEF = { peshona: 10, razmeri: 50 };

function loadVals() {
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY));
    if (o && o.peshona > 0 && o.razmeri > 0) return { peshona: +o.peshona, razmeri: +o.razmeri };
  } catch (e) { /* noop */ }
  return { ...DEF };
}

// Patalok geometriyasini (sm da) hisoblaydi. Simmetrik — o'yiqlar ikki
// chetda bir xil. yB1..yB2 — peshona burmasi (bend); pasti — asosiy tana.
function patalokGeom(P, R) {
  const yB1 = P;                 // peshona pastki chizig'i (bend boshi)
  const yB2 = P + NOTCH_H;       // bend oxiri
  const H = yB2 + R;             // umumiy balandlik

  // Tashqi kontur (soat strelkasi bo'yicha), ikki chetda o'yiq bilan.
  const outer = [
    [0, 0], [W, 0],                                  // yuqori chet
    [W, yB1], [W - NOTCH_D, yB1], [W - NOTCH_D, yB2], [W, yB2],  // o'ng o'yiq
    [W, H], [0, H],                                  // pastki chet
    [0, yB2], [NOTCH_D, yB2], [NOTCH_D, yB1], [0, yB1],          // chap o'yiq
    [0, 0],
  ];
  // Qatlama (hem) chiziqlari — yuqori va past buklangan chet.
  const hems = [
    [[0, HEM], [W, HEM]],
    [[0, H - HEM], [W, H - HEM]],
  ];
  return { outer, hems, yB1, yB2, H };
}

const ptsStr = (pts) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');

// Chap tarafdagi vertikal razmer (o'q + strelkalar + sm yozuvi).
function VDim({ x, y1, y2, label }) {
  const a = 1.5, hw = 0.7;     // strelka uzunligi / yarim eni (sm)
  const mid = (y1 + y2) / 2;
  return (
    <g>
      {/* uzaytirgich chiziqlar (detal chetidan razmer o'qigacha) */}
      <line x1={0} y1={y1} x2={x} y2={y1} stroke={GREEN} strokeWidth={0.16} />
      <line x1={0} y1={y2} x2={x} y2={y2} stroke={GREEN} strokeWidth={0.16} />
      {/* razmer o'qi */}
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={GREEN} strokeWidth={0.22} />
      {/* strelkalar (tashqariga qaragan) */}
      <polygon points={`${x},${y1} ${x - hw},${y1 + a} ${x + hw},${y1 + a}`} fill={GREEN} />
      <polygon points={`${x},${y2} ${x - hw},${y2 - a} ${x + hw},${y2 - a}`} fill={GREEN} />
      {/* qiymat (sm) — vertikal yozuv, oq halo bilan o'q ustida */}
      <text x={x} y={mid} fill={GREEN} fontSize={3.4} fontWeight="700"
        textAnchor="middle" dominantBaseline="central"
        transform={`rotate(-90 ${x} ${mid})`}
        stroke="#ffffff" strokeWidth={1.1} paintOrder="stroke">
        {label}
      </text>
    </g>
  );
}

function PatalokSvg({ peshona, razmeri }) {
  const { outer, hems, yB1, yB2, H } = patalokGeom(peshona, razmeri);
  const dimX = -7;                       // razmer o'qi ustuni (chapda)
  const padL = 15, padR = 5, padT = 4, padB = 4;
  const vbW = W + padL + padR;
  const vbH = H + padT + padB;
  return (
    <svg viewBox={`${-padL} ${-padT} ${vbW} ${vbH}`} width="100%" style={{ height: 'auto', maxHeight: '62vh', display: 'block' }}>
      {/* detal */}
      <polyline points={ptsStr(outer)} fill="#f8fafc" stroke={INK} strokeWidth={0.45} strokeLinejoin="round" strokeLinecap="round" />
      {hems.map((h, i) => (
        <line key={i} x1={h[0][0]} y1={h[0][1]} x2={h[1][0]} y2={h[1][1]} stroke={INK} strokeWidth={0.28} />
      ))}
      {/* razmerlar (chapda, sm) */}
      <VDim x={dimX} y1={0} y2={yB1} label={`${+peshona.toFixed(1)} sm`} />
      <VDim x={dimX} y1={yB2} y2={H} label={`${+razmeri.toFixed(1)} sm`} />
    </svg>
  );
}

function NumField({ label, value, onChange, hint }) {
  return (
    <label className="flex-1 min-w-0">
      <span className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</span>
      <div className="relative">
        <input type="number" min="1" step="0.5" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-800 focus:border-slate-900 focus:outline-none" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">sm</span>
      </div>
      {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  );
}

export function KazirokCard() {
  const [open, setOpen] = useState(() => localStorage.getItem('kazirok-open') === '1');
  const [vals, setVals] = useState(loadVals);

  useEffect(() => {
    try { localStorage.setItem('kazirok-open', open ? '1' : '0'); } catch (e) { /* noop */ }
  }, [open]);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(vals)); } catch (e) { /* noop */ }
  }, [vals]);

  // Bo'sh/0 yozilsa — chizma buzilmasin (input bo'sh tursa, chizmada default ishlatiladi).
  const peshona = +vals.peshona > 0 ? +vals.peshona : DEF.peshona;
  const razmeri = +vals.razmeri > 0 ? +vals.razmeri : DEF.razmeri;
  const total = (peshona + NOTCH_H + razmeri).toFixed(1);

  const setField = (key) => (raw) => {
    const v = raw === '' ? '' : Math.max(0, parseFloat(raw) || 0);
    setVals((s) => ({ ...s, [key]: v }));
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 -mb-1">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 min-w-0 text-left" aria-expanded={open}>
          <SectionTitle icon={Frame}>Kazirok</SectionTitle>
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Yopish' : 'Ochish'}
          className="p-1.5 -mt-3 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex-shrink-0">
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="w-full text-left px-3 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 transition text-sm text-slate-400">
          Patalok detali — peshona va razmerini o'zgartirib chizmasini ko'rish uchun oching
        </button>
      )}

      {open && (
        <div className="mt-1">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Patalok</span>
            <span className="text-[11px] text-slate-400">eni {W} sm • bo'yi {total} sm</span>
          </div>

          <div className="flex gap-3 mb-4">
            <NumField label="Peshona" value={vals.peshona} onChange={setField('peshona')} />
            <NumField label="Razmeri" value={vals.razmeri} onChange={setField('razmeri')} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 flex justify-center">
            <PatalokSvg peshona={peshona} razmeri={razmeri} />
          </div>

          <p className="text-[11px] text-slate-400 mt-2 leading-snug">
            Detal simmetrik — chap tomon razmeri o'zgarsa, o'ng tomon ham aynan o'zgaradi.
            Razmerlar chap tarafda sm da ko'rsatilgan.
          </p>
        </div>
      )}
    </Card>
  );
}
