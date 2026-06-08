// ============================================================
//  HISOBOT GRAFIK KOMPONENTLARI (kutubxonasiz, SVG)
// ------------------------------------------------------------
//  Donut (doira diagramma) + AreaChart (trend chizig'i).
//  Mavzuga moslashadi: chiziq accent rangida (var(--c-btn)),
//  donut segmentlari semantik ranglarda. reduced-motion hurmat.
// ============================================================
import React from 'react';
import { fmt } from '../../lib/helpers.js';

// ----- Donut (doira) diagramma + yon legenda -----
// segments: [{ label, value, color }]. total/centerLabel — markaz yozuvi.
export function Donut({ segments = [], total = null, centerLabel = '', size = 128 }) {
  const segs = segments.filter((s) => s.value > 0);
  const sum = total != null ? total : segments.reduce((s, x) => s + (x.value || 0), 0);
  let acc = 0; // foizda jamlangan siljish
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="w-full h-full anim-donut">
          {/* fon halqasi */}
          <circle cx="60" cy="60" r="42" fill="none" strokeWidth="15" style={{ stroke: 'var(--c-chip, #eef1f5)' }} />
          {sum > 0 && segs.map((s, i) => {
            const pct = (s.value / sum) * 100;
            const el = (
              <circle key={i} cx="60" cy="60" r="42" fill="none" strokeWidth="15"
                pathLength="100" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-acc}
                transform="rotate(-90 60 60)" style={{ stroke: s.color }} />
            );
            acc += pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-slate-900 tabular-nums leading-none">{sum}</span>
          {centerLabel && <span className="text-[10px] text-slate-400 mt-0.5">{centerLabel}</span>}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {segments.map((s, i) => {
          const pct = sum > 0 ? Math.round((s.value / sum) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-slate-600 truncate flex-1">{s.label}</span>
              <span className="font-semibold tabular-nums text-slate-700 flex-shrink-0">
                {s.value} <span className="text-slate-400">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Area/trend chizig'i (to'ldirilgan gradient + nuqtalar) -----
// data: [{ label, value, full }]. color — chiziq rangi (default accent).
export function AreaChart({ data = [], height = 130, color = 'var(--c-btn)', suffix = "so'm" }) {
  const W = 320, H = 110, pad = 6;
  const n = data.length;
  if (n === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, n - 1);
  const y = (v) => H - pad - ((v || 0) / max) * (H - 2 * pad);
  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPath = `M ${x(0)},${H - pad} L ${data.map((d, i) => `${x(i)},${y(d.value)}`).join(' L ')} L ${x(n - 1)},${H - pad} Z`;
  const hideEvery = n > 10; // ko'p nuqtada har 2-yorliqni yashir
  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaFill)" />
          <polyline points={linePts} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" className="anim-draw" style={{ stroke: color }} />
        </svg>
        {/* Nuqtalar — HTML qatlam (har doim yumaloq, tooltip bilan) */}
        {data.map((d, i) => (
          <span key={i} title={`${d.full || d.label}: ${fmt(d.value)} ${suffix}`}
            className="absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 ring-2 ring-white"
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(d.value) / H) * 100}%`, background: color }} />
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {data.map((d, i) => (
          <span key={i} className="text-[9px] text-slate-400 leading-none text-center"
            style={{ visibility: hideEvery && i % 2 === 1 ? 'hidden' : 'visible' }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
