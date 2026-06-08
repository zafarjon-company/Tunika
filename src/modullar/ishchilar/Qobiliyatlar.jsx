// ============================================================
//  ISHCHILAR → QOBILIYATLAR (markaziy ro'yxat)
// ------------------------------------------------------------
//  Qobiliyat: { id, nomi, daraja (0..5 yulduz) } — Lavozimlardek.
//  Ishchi formasida shu ro'yxatdan tanlanadi.
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, Award } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { genId } from '../../lib/helpers.js';
import { StarRating } from './Lavozimlar.jsx';

export function QobiliyatlarTab({ qobiliyatlar, updateQobiliyatlar, showToast }) {
  const [nomi, setNomi] = useState('');
  const [daraja, setDaraja] = useState(0);

  function add() {
    const t = nomi.trim();
    if (!t) { showToast('Nom kiriting'); return; }
    if (qobiliyatlar.some((q) => q.nomi.toLowerCase() === t.toLowerCase())) { showToast('Bunday qobiliyat bor'); return; }
    updateQobiliyatlar([...qobiliyatlar, { id: genId(), nomi: t, daraja }]);
    setNomi(''); setDaraja(0);
    showToast('Qobiliyat qo\'shildi');
  }

  function setItemDaraja(id, d) {
    updateQobiliyatlar(qobiliyatlar.map((q) => (q.id === id ? { ...q, daraja: d } : q)));
  }

  function remove(id) {
    updateQobiliyatlar(qobiliyatlar.filter((q) => q.id !== id));
    showToast('O\'chirildi');
  }

  return (
    <Card>
      <SectionTitle icon={Award}>Qobiliyatlar ({qobiliyatlar.length})</SectionTitle>

      {/* Yangi qo'shish */}
      <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3">
        <input value={nomi} onChange={(e) => setNomi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Qobiliyat nomi (masalan: Payvandlash)" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm focus:border-slate-900 outline-none" />
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
        {qobiliyatlar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Qobiliyatlar mavjud emas</p>
        ) : qobiliyatlar.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-2 p-3 border border-slate-200 rounded-lg text-sm">
            <span className="font-medium text-slate-800 truncate flex-1 min-w-0">{q.nomi}</span>
            <StarRating value={q.daraja || 0} onChange={(d) => setItemDaraja(q.id, d)} />
            <button onClick={() => remove(q.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
