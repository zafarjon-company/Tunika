// ============================================================
//  ISHCHILAR → LAVOZIMLAR (boshqaruv)
// ------------------------------------------------------------
//  Lavozim: { id, nomi, daraja (0..5 yulduzcha) }.
//  Ishchi formasida shu ro'yxatdan TANLANADI (u yerda yangi
//  lavozim qo'shilmaydi).
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, Briefcase, Star } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { genId } from '../../lib/helpers.js';

// 5 yulduzcha — onChange berilsa bosib o'zgartiriladi, aks holda faqat ko'rsatadi.
export function StarRating({ value = 0, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange}
          onClick={() => onChange && onChange(n === value ? n - 1 : n)}
          className={onChange ? 'hover:scale-110 transition' : 'cursor-default'}>
          <Star className={`w-5 h-5 ${n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  );
}

// Daraja nishoni — yulduzlar shakl bo'yicha joylashadi (oddiy qator emas).
// 1–4: qatorlar; 5: beshburchak (5 yulduz uchlaridek).
const NISHON_LAYOUTS = {
  1: [[1]],
  2: [[2]],
  3: [[1], [2]],   // uchburchak (1 tepada, 2 pastda)
  4: [[2], [2]],   // kvadratning 4 burchagi (2×2)
};

// 5 yulduzning 5 burchagi (beshburchak, uchi tepada)
const PENTAGON = [
  { left: '50%', top: '6%' },
  { left: '8%',  top: '40%' },
  { left: '92%', top: '40%' },
  { left: '27%', top: '88%' },
  { left: '73%', top: '88%' },
];

export function DarajaNishon({ daraja = 0 }) {
  if (!daraja) return null;
  const d = Math.min(5, Math.max(1, daraja));

  if (d === 5) {
    return (
      <div className="relative w-7 h-7 flex-shrink-0">
        {PENTAGON.map((p, i) => (
          <Star key={i} style={{ left: p.left, top: p.top }}
            className="w-2.5 h-2.5 text-amber-400 fill-amber-400 absolute -translate-x-1/2 -translate-y-1/2" />
        ))}
      </div>
    );
  }

  const rows = NISHON_LAYOUTS[d] || [[d]];
  return (
    <div className="inline-flex flex-col items-center gap-px">
      {rows.map((cnt, ri) => (
        <div key={ri} className="flex gap-px">
          {Array.from({ length: cnt }).map((_, ci) => (
            <Star key={ci} className="w-3 h-3 text-amber-400 fill-amber-400" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LavozimlarTab({ lavozimlar, updateLavozimlar, showToast }) {
  const [nomi, setNomi] = useState('');
  const [daraja, setDaraja] = useState(0);

  function add() {
    const t = nomi.trim();
    if (!t) { showToast('Nom kiriting'); return; }
    if (lavozimlar.some((l) => l.nomi.toLowerCase() === t.toLowerCase())) { showToast('Bunday lavozim bor'); return; }
    updateLavozimlar([...lavozimlar, { id: genId(), nomi: t, daraja }]);
    setNomi(''); setDaraja(0);
    showToast('Lavozim qo\'shildi');
  }

  function setItemDaraja(id, d) {
    updateLavozimlar(lavozimlar.map((l) => (l.id === id ? { ...l, daraja: d } : l)));
  }

  function remove(id) {
    updateLavozimlar(lavozimlar.filter((l) => l.id !== id));
    showToast('O\'chirildi');
  }

  return (
    <Card>
      <SectionTitle icon={Briefcase}>Lavozimlar ({lavozimlar.length})</SectionTitle>

      {/* Yangi qo'shish */}
      <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3">
        <input value={nomi} onChange={(e) => setNomi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Lavozim nomi (masalan: Operator)" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm focus:border-slate-900 outline-none" />
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">Daraja</div>
            <StarRating value={daraja} onChange={setDaraja} />
          </div>
          <button onClick={add} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Qo'shish
          </button>
        </div>
      </div>

      {/* Ro'yxat */}
      <div className="space-y-1">
        {lavozimlar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Lavozimlar mavjud emas</p>
        ) : lavozimlar.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-2 p-3 border border-slate-200 rounded-lg text-sm">
            <span className="font-medium text-slate-800 truncate flex-1 min-w-0">{l.nomi}</span>
            <StarRating value={l.daraja || 0} onChange={(d) => setItemDaraja(l.id, d)} />
            <button onClick={() => remove(l.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
