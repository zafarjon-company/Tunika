// ============================================================
//  NARXLAR → METRLI
// ------------------------------------------------------------
//  Metrlab sotiladigan tovarlar. Bazaviy narx YO'Q — sotuvda
//  tanlangan tunika (list) chakana/optom narxi ishlatiladi:
//    birBirlik = (tunika narxi ÷ variant bo'lak soni) + metri uchun narx
//  Element: { id, nomi, metriNarx, variantlar: [{son, razmer} ×4] }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Ruler, Edit3, Copy } from 'lucide-react';
import { Card, SectionTitle, TovarIcon, RangTanla, RangBadge } from '../../components/ui.jsx';
import { fmt, genId, metrliVariantlar, metrliAddon, rangGuruhlari } from '../../lib/helpers.js';

function toSlots(m) {
  let arr = [];
  if (Array.isArray(m.variantlar)) arr = m.variantlar.map((v) => ({ son: v.son ?? '', razmer: v.razmer ?? '' }));
  else {
    if (m.bolish1) arr.push({ son: m.bolish1, razmer: m.razmer1 || '' });
    if (m.bolish2) arr.push({ son: m.bolish2, razmer: m.razmer2 || '' });
  }
  while (arr.length < 4) arr.push({ son: '', razmer: '' });
  return arr.slice(0, 4);
}

const BLANK = { nomi: '', metriNarx: '', rang: '', variantlar: [{ son: '', razmer: '' }, { son: '', razmer: '' }, { son: '', razmer: '' }, { son: '', razmer: '' }] };

export function MetrliTab({ metrlilar, updateMetrlilar, ranglar = [], showToast }) {
  const rangGuruh = rangGuruhlari(ranglar); // Sozlamalardagi guruhlangan to'liq palitra
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);

  function startAdd() { setForm(BLANK); setAdding(true); setEditingId(null); }
  function startEdit(m) {
    setForm({ nomi: m.nomi, metriNarx: metrliAddon(m) || '', rang: m.rang || '', variantlar: toSlots(m) });
    setEditingId(m.id); setAdding(false);
  }
  function setVariant(i, patch) {
    setForm({ ...form, variantlar: form.variantlar.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  }

  function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= metrlilar.length) return;
    const next = [...metrlilar];
    [next[index], next[j]] = [next[j], next[index]];
    updateMetrlilar(next);
  }

  function save() {
    if (!form.nomi.trim()) { showToast('Nom kiriting'); return; }
    const data = {
      nomi: form.nomi.trim(),
      metriNarx: parseFloat(form.metriNarx) || 0,
      rang: form.rang || '',
      variantlar: form.variantlar.map((v) => ({ son: parseFloat(v.son) || 0, razmer: String(v.razmer || '') })),
    };
    if (adding) { updateMetrlilar([...metrlilar, { id: genId(), ...data }]); showToast('Qo\'shildi'); }
    else { updateMetrlilar(metrlilar.map((m) => (m.id === editingId ? { id: m.id, ...data } : m))); showToast('Saqlandi'); }
    setAdding(false); setEditingId(null);
  }

  function remove(id) {
    updateMetrlilar(metrlilar.filter((m) => m.id !== id));
    setEditingId(null); setAdding(false);
    showToast('O\'chirildi');
  }

  function nusxa(m) {
    const idx = metrlilar.findIndex((x) => x.id === m.id);
    const yangi = { ...m, id: genId(), nomi: `${m.nomi} (nusxa)` };
    const next = [...metrlilar];
    next.splice(idx + 1, 0, yangi);
    updateMetrlilar(next);
    showToast('Nusxalandi');
  }

  const showForm = adding || editingId;

  return (
    <Card>
      <SectionTitle icon={Ruler}>Metrli ({metrlilar.length})</SectionTitle>

      {!showForm && (
        <button onClick={startAdd}
          className="w-full mb-3 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Yangi tovar qo'shish
        </button>
      )}

      {showForm && (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Nomi *</label>
              <input value={form.nomi} onChange={(e) => setForm({ ...form, nomi: e.target.value })} placeholder="Tovar nomi" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Metri uchun narx (so'm)</label>
              <input type="number" value={form.metriNarx} onWheel={(e) => e.target.blur()} onChange={(e) => setForm({ ...form, metriNarx: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pt-1">Variantlar (bo'lak soni + razmer)</div>
          {form.variantlar.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">{i + 1}-variant: bo'lak soni</label>
                <input type="number" value={v.son} onWheel={(e) => e.target.blur()} onChange={(e) => setVariant(i, { son: e.target.value })} placeholder="—" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">{i + 1}-variant: razmer</label>
                <input value={v.razmer} onChange={(e) => setVariant(i, { razmer: e.target.value })} placeholder="masalan: 31.2 sm" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
              </div>
            </div>
          ))}

          <RangTanla value={form.rang} onPick={(r) => setForm({ ...form, rang: r })} groups={rangGuruh} />

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAdding(false); setEditingId(null); }} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
            {editingId && <button onClick={() => remove(editingId)} className="py-2 px-3 border-2 border-red-200 text-red-700 rounded-lg bg-white"><Trash2 className="w-4 h-4" /></button>}
            <button onClick={save} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {metrlilar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Hozircha bo'sh</p>
        ) : metrlilar.map((m, idx) => {
          const vs = metrliVariantlar(m);
          return (
            <div key={m.id} className="group flex items-center gap-2 p-2.5 border border-slate-200 rounded-xl bg-white text-sm">
              <div className="flex flex-col">
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === metrlilar.length - 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <RangBadge rang={m.rang || ''} nomi={m.nomi} kind="metrli" />
              <button onClick={() => startEdit(m)} className="flex-1 min-w-0 text-left">
                <div className="font-medium text-slate-800 truncate">{m.nomi}</div>
                <div className="text-[11px] text-slate-400 tabular-nums truncate">
                  Metri uchun: {fmt(metrliAddon(m))} so'm
                  {vs.length ? ` · ${vs.map((v) => `${v.son}→${v.razmer}`).join(' / ')}` : ''}
                </div>
              </button>
              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button title="Tahrirlash" onClick={() => startEdit(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Edit3 className="w-4 h-4" /></button>
                <button title="Nusxalash" onClick={() => nusxa(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
                <button title="O'chirish" onClick={() => remove(m.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
