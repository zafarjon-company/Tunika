// ============================================================
//  NARXLAR → AKSESSUARLAR
// ------------------------------------------------------------
//  Aksessuarlar ro'yxati: narxini o'zgartirish, qo'shish,
//  o'chirish va TARTIBINI o'zgartirish (yuqori/past).
//  Ro'yxat tartibi savdoda ham aynan shunday ko'rinadi.
//  Element: { id, nomi, narx }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Package, Edit3, Copy } from 'lucide-react';
import { Card, SectionTitle, TovarIcon, RangTanla, RangBadge } from '../../components/ui.jsx';
import { genId, fmt, rangGuruhlari } from '../../lib/helpers.js';

export function AksessuarlarTab({ aksessuarlar, updateAksessuarlar, ranglar = [], showToast }) {
  const rangGuruh = rangGuruhlari(ranglar); // Sozlamalardagi guruhlangan to'liq palitra
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nomi: '', narx: '', birlik: 'dona', rang: '' });

  function setNarx(id, val) {
    updateAksessuarlar(aksessuarlar.map((a) => (a.id === id ? { ...a, narx: parseFloat(val) || 0 } : a)));
  }
  function patch(id, p) {
    updateAksessuarlar(aksessuarlar.map((a) => (a.id === id ? { ...a, ...p } : a)));
  }

  function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= aksessuarlar.length) return;
    const next = [...aksessuarlar];
    [next[index], next[j]] = [next[j], next[index]];
    updateAksessuarlar(next);
  }

  function addNew() {
    if (!form.nomi.trim()) { showToast('Nom kiriting'); return; }
    updateAksessuarlar([...aksessuarlar, { id: genId(), nomi: form.nomi.trim(), narx: parseFloat(form.narx) || 0, birlik: form.birlik, rang: form.rang || '' }]);
    setForm({ nomi: '', narx: '', birlik: 'dona', rang: '' });
    setAdding(false);
    showToast('Aksessuar qo\'shildi');
  }

  function remove(id) {
    updateAksessuarlar(aksessuarlar.filter((a) => a.id !== id));
    showToast('O\'chirildi');
  }

  function nusxa(a) {
    const idx = aksessuarlar.findIndex((x) => x.id === a.id);
    const yangi = { ...a, id: genId(), nomi: `${a.nomi} (nusxa)` };
    const next = [...aksessuarlar];
    next.splice(idx + 1, 0, yangi);
    updateAksessuarlar(next);
    showToast('Nusxalandi');
  }

  return (
    <Card>
      <SectionTitle icon={Package}>Aksessuarlar ({aksessuarlar.length})</SectionTitle>

      {adding ? (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Nomi *</label>
              <input value={form.nomi} onChange={(e) => setForm({ ...form, nomi: e.target.value })} placeholder="Aksessuar nomi" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
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
              </select>
            </div>
          </div>
          <RangTanla value={form.rang} onPick={(r) => setForm({ ...form, rang: r })} groups={rangGuruh} />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm({ nomi: '', narx: '', birlik: 'dona', rang: '' }); }} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
            <button onClick={addNew} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full mb-3 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Yangi aksessuar qo'shish
        </button>
      )}

      <div className="space-y-1.5">
        {aksessuarlar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Aksessuarlar mavjud emas</p>
        ) : aksessuarlar.map((a, idx) => (
          <div key={a.id} className="p-2.5 border border-slate-200 rounded-xl bg-white text-sm">
            {editingId === a.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Nomi</label>
                    <input value={a.nomi} onChange={(e) => patch(a.id, { nomi: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Narx (so'm)</label>
                    <input type="number" value={a.narx} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                      onChange={(e) => setNarx(a.id, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Birlik</label>
                    <select value={a.birlik || 'dona'} onChange={(e) => patch(a.id, { birlik: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white">
                      <option value="dona">dona</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <RangTanla value={a.rang || ''} onPick={(r) => patch(a.id, { rang: r })} groups={rangGuruh} />
                <div className="flex gap-2">
                  <button onClick={() => remove(a.id)} className="py-1.5 px-3 border-2 border-red-200 text-red-700 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (!a.nomi.trim()) { showToast('Nom kiriting'); return; } setEditingId(null); showToast('Saqlandi'); }} className="flex-1 py-1.5 bg-slate-900 text-white rounded font-medium">Tayyor</button>
                </div>
              </div>
            ) : (
              <div className="group flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === aksessuarlar.length - 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <RangBadge rang={a.rang || ''} nomi={a.nomi} kind="aksessuar" />
                <button onClick={() => { setEditingId(a.id); setAdding(false); }} className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-slate-800 truncate">{a.nomi}</div>
                  <div className="text-[11px] text-slate-400 tabular-nums">{fmt(a.narx)} so'm / {a.birlik || 'dona'}</div>
                </button>
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button title="Tahrirlash" onClick={() => { setEditingId(a.id); setAdding(false); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Edit3 className="w-4 h-4" /></button>
                  <button title="Nusxalash" onClick={() => nusxa(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
                  <button title="O'chirish" onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
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
