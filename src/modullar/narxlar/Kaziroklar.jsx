// ============================================================
//  NARXLAR → KAZIROKLAR
// ------------------------------------------------------------
//  Kaziroklar ro'yxati: narxini o'zgartirish, qo'shish,
//  o'chirish va TARTIBINI o'zgartirish (yuqori/past).
//  Element: { id, nomi, narx, birlik, rang }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Triangle, Edit3, Copy } from 'lucide-react';
import { Card, SectionTitle, RangTanla, RangBadge } from '../../components/ui.jsx';
import { genId, fmt } from '../../lib/helpers.js';

export function KazirokTab({ kaziroklar, updateKaziroklar, showToast }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nomi: '', narx: '', birlik: 'dona', rang: '' });

  function setNarx(id, val) {
    updateKaziroklar(kaziroklar.map((k) => (k.id === id ? { ...k, narx: parseFloat(val) || 0 } : k)));
  }
  function patch(id, p) {
    updateKaziroklar(kaziroklar.map((k) => (k.id === id ? { ...k, ...p } : k)));
  }

  function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= kaziroklar.length) return;
    const next = [...kaziroklar];
    [next[index], next[j]] = [next[j], next[index]];
    updateKaziroklar(next);
  }

  function addNew() {
    if (!form.nomi.trim()) { showToast('Nom kiriting'); return; }
    updateKaziroklar([...kaziroklar, { id: genId(), nomi: form.nomi.trim(), narx: parseFloat(form.narx) || 0, birlik: form.birlik, rang: form.rang || '' }]);
    setForm({ nomi: '', narx: '', birlik: 'dona', rang: '' });
    setAdding(false);
    showToast("Kazirok qo'shildi");
  }

  function remove(id) {
    updateKaziroklar(kaziroklar.filter((k) => k.id !== id));
    showToast("O'chirildi");
  }

  function nusxa(k) {
    const idx = kaziroklar.findIndex((x) => x.id === k.id);
    const yangi = { ...k, id: genId(), nomi: `${k.nomi} (nusxa)` };
    const next = [...kaziroklar];
    next.splice(idx + 1, 0, yangi);
    updateKaziroklar(next);
    showToast('Nusxalandi');
  }

  return (
    <Card>
      <SectionTitle icon={Triangle}>Kaziroklar ({kaziroklar.length})</SectionTitle>

      {adding ? (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Nomi *</label>
              <input value={form.nomi} onChange={(e) => setForm({ ...form, nomi: e.target.value })} placeholder="Kazirok nomi" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Narx (so'm)</label>
              <input type="number" value={form.narx} onWheel={(e) => e.target.blur()} onChange={(e) => setForm({ ...form, narx: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Birlik</label>
              <select value={form.birlik} onChange={(e) => setForm({ ...form, birlik: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white">
                <option value="dona">dona</option>
                <option value="kg">kg</option>
                <option value="metr">metr</option>
              </select>
            </div>
          </div>
          <RangTanla value={form.rang} onPick={(r) => setForm({ ...form, rang: r })} />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm({ nomi: '', narx: '', birlik: 'dona', rang: '' }); }} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
            <button onClick={addNew} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full mb-3 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Yangi kazirok qo'shish
        </button>
      )}

      <div className="space-y-1.5">
        {kaziroklar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Kaziroklar mavjud emas</p>
        ) : kaziroklar.map((k, idx) => (
          <div key={k.id} className="p-2.5 border border-slate-200 rounded-xl bg-white text-sm">
            {editingId === k.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Nomi</label>
                    <input value={k.nomi} onChange={(e) => patch(k.id, { nomi: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Narx (so'm)</label>
                    <input type="number" value={k.narx} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                      onChange={(e) => setNarx(k.id, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Birlik</label>
                    <select value={k.birlik || 'dona'} onChange={(e) => patch(k.id, { birlik: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white">
                      <option value="dona">dona</option>
                      <option value="kg">kg</option>
                      <option value="metr">metr</option>
                    </select>
                  </div>
                </div>
                <RangTanla value={k.rang || ''} onPick={(r) => patch(k.id, { rang: r })} />
                <div className="flex gap-2">
                  <button onClick={() => remove(k.id)} className="py-1.5 px-3 border-2 border-red-200 text-red-700 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (!k.nomi.trim()) { showToast('Nom kiriting'); return; } setEditingId(null); showToast('Saqlandi'); }} className="flex-1 py-1.5 bg-slate-900 text-white rounded font-medium">Tayyor</button>
                </div>
              </div>
            ) : (
              <div className="group flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === kaziroklar.length - 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <RangBadge rang={k.rang || ''} nomi={k.nomi} kind="aksessuar" />
                <button onClick={() => { setEditingId(k.id); setAdding(false); }} className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-slate-800 truncate">{k.nomi}</div>
                  <div className="text-[11px] text-slate-400 tabular-nums">{fmt(k.narx)} so'm / {k.birlik || 'dona'}</div>
                </button>
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button title="Tahrirlash" onClick={() => { setEditingId(k.id); setAdding(false); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Edit3 className="w-4 h-4" /></button>
                  <button title="Nusxalash" onClick={() => nusxa(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
                  <button title="O'chirish" onClick={() => remove(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        Tartibni ▲▼ bilan o'zgartirasiz — savdoda ham aynan shu tartibda ko'rinadi.
        Narx faqat shu yerda o'zgartiriladi (savdoda emas).
      </p>
    </Card>
  );
}
