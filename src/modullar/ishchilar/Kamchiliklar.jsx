// ============================================================
//  ISHCHILAR → KAMCHILIKLAR (markaziy ro'yxat)
// ------------------------------------------------------------
//  Qobiliyatlardek, lekin baho yulduz emas — negativ (qizil X).
//  Element: { id, nomi, daraja (0..5) }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, X } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { genId } from '../../lib/helpers.js';

// 5 ballik NEGATIV baho — qizil X belgilar.
export function NegativeRating({ value = 0, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange}
          onClick={() => onChange && onChange(n === value ? n - 1 : n)}
          className={onChange ? 'hover:scale-110 transition' : 'cursor-default'}>
          <X className={`w-5 h-5 ${n <= value ? 'text-red-500' : 'text-slate-300'}`} strokeWidth={3} />
        </button>
      ))}
    </div>
  );
}

export function KamchiliklarTab({ kamchiliklar, updateKamchiliklar, showToast }) {
  const [nomi, setNomi] = useState('');
  const [daraja, setDaraja] = useState(0);

  function add() {
    const t = nomi.trim();
    if (!t) { showToast('Nom kiriting'); return; }
    if (kamchiliklar.some((k) => k.nomi.toLowerCase() === t.toLowerCase())) { showToast('Bunday kamchilik bor'); return; }
    updateKamchiliklar([...kamchiliklar, { id: genId(), nomi: t, daraja }]);
    setNomi(''); setDaraja(0);
    showToast('Kamchilik qo\'shildi');
  }

  function setItemDaraja(id, d) {
    updateKamchiliklar(kamchiliklar.map((k) => (k.id === id ? { ...k, daraja: d } : k)));
  }

  function remove(id) {
    updateKamchiliklar(kamchiliklar.filter((k) => k.id !== id));
    showToast('O\'chirildi');
  }

  return (
    <Card>
      <SectionTitle icon={AlertTriangle}>Kamchiliklar ({kamchiliklar.length})</SectionTitle>

      {/* Yangi qo'shish */}
      <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3">
        <input value={nomi} onChange={(e) => setNomi(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Kamchilik nomi (masalan: Kechikish)" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm focus:border-slate-900 outline-none" />
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">Daraja</div>
            <NegativeRating value={daraja} onChange={setDaraja} />
          </div>
          <button onClick={add} className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" /> Qo'shish
          </button>
        </div>
      </div>

      {/* Ro'yxat */}
      <div className="space-y-1">
        {kamchiliklar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Kamchiliklar mavjud emas</p>
        ) : kamchiliklar.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-2 p-3 border border-slate-200 rounded-lg text-sm">
            <span className="font-medium text-slate-800 truncate flex-1 min-w-0">{k.nomi}</span>
            <NegativeRating value={k.daraja || 0} onChange={(d) => setItemDaraja(k.id, d)} />
            <button onClick={() => remove(k.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
