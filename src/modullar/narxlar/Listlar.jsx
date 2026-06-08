// ============================================================
//  NARXLAR → LISTLAR
// ------------------------------------------------------------
//  Tunikalar (list) narxlari bazasi: mavjudlarini tahrirlash,
//  yangi qo'shish va o'chirish.
//  Element: { id, nomi, qalinlik, optom, chakana }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, Layers, Copy, Edit3, Percent } from 'lucide-react';
import { Card, SectionTitle, TovarIcon, RangTanla, RangBadge, SmallModal, SegmentedControl } from '../../components/ui.jsx';
import { fmt, genId, rangHex, rangMatn, rangTozala } from '../../lib/helpers.js';

const BLANK = { nomi: '', qalinlik: '', optom: '', chakana: '', rang: '' };

// Bitta narxni ommaviy qoidaga ko'ra qayta hisoblash
function bulkCalc(x, { tur, yon, v }) {
  const n = Number(x) || 0;
  const sign = yon === 'oshir' ? 1 : -1;
  const r = tur === 'foiz' ? n * (1 + (sign * v) / 100) : n + sign * v;
  return Math.max(0, Math.round(r));
}

// Ommaviy narx o'zgartirish oynasi
function OmmaviyModal({ tunikaBaza, onClose, onApply }) {
  const [tur, setTur] = useState('foiz');      // foiz | summa
  const [yon, setYon] = useState('oshir');     // oshir | kamaytir
  const [qaysi, setQaysi] = useState('ikkala'); // chakana | optom | ikkala
  const [qiymat, setQiymat] = useState('');
  const v = parseFloat(qiymat) || 0;
  const namuna = tunikaBaza[0];
  return (
    <SmallModal onClose={onClose} title="Narxlarni ommaviy yangilash">
      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Amal turi</label>
          <SegmentedControl value={tur} onChange={setTur}
            options={[{ value: 'foiz', label: 'Foiz (%)' }, { value: 'summa', label: "Summa (so'm)" }]} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Yo'nalish</label>
          <SegmentedControl value={yon} onChange={setYon}
            options={[{ value: 'oshir', label: 'Oshirish +' }, { value: 'kamaytir', label: 'Kamaytirish −' }]} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Qaysi narx</label>
          <SegmentedControl value={qaysi} onChange={setQaysi}
            options={[{ value: 'chakana', label: 'Chakana' }, { value: 'optom', label: 'Optom' }, { value: 'ikkala', label: 'Ikkalasi' }]} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{tur === 'foiz' ? 'Necha foiz?' : "Necha so'm?"}</label>
          <input type="number" inputMode="numeric" value={qiymat} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
            onChange={(e) => setQiymat(e.target.value)} placeholder={tur === 'foiz' ? '5' : '2000'}
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white tabular-nums focus:border-slate-900 outline-none" />
        </div>
        {namuna && v > 0 && (
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <span className="text-slate-500">Namuna ({namuna.nomi}):</span>{' '}
            <span className="tabular-nums">Chakana {fmt(namuna.chakana)} → <b>{fmt(qaysi === 'optom' ? namuna.chakana : bulkCalc(namuna.chakana, { tur, yon, v }))}</b></span>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 rounded-lg bg-white font-medium">Bekor</button>
          <button onClick={() => { if (v > 0) onApply({ tur, yon, qaysi, v }); }} disabled={v <= 0}
            className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg font-medium disabled:opacity-40">Qo'llash ({tunikaBaza.length} ta)</button>
        </div>
      </div>
    </SmallModal>
  );
}

export function ListlarTab({ tunikaBaza, updateTunikaBaza, showToast }) {
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [form, setForm] = useState(BLANK);

  function ommaviyApply({ tur, yon, qaysi, v }) {
    updateTunikaBaza(tunikaBaza.map((t) => ({
      ...t,
      optom: (qaysi === 'optom' || qaysi === 'ikkala') ? bulkCalc(t.optom, { tur, yon, v }) : t.optom,
      chakana: (qaysi === 'chakana' || qaysi === 'ikkala') ? bulkCalc(t.chakana, { tur, yon, v }) : t.chakana,
    })));
    setBulk(false);
    showToast('Narxlar yangilandi');
  }

  function patch(id, p) {
    updateTunikaBaza(tunikaBaza.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function addNew() {
    if (!form.nomi.trim()) { showToast('Nom kiriting'); return; }
    const yangi = {
      id: genId(),
      nomi: form.nomi.trim(),
      qalinlik: form.qalinlik.trim(),
      optom: parseFloat(form.optom) || 0,
      chakana: parseFloat(form.chakana) || 0,
      rang: form.rang || '',
    };
    updateTunikaBaza([...tunikaBaza, yangi]);
    setForm(BLANK); setAdding(false);
    showToast('List qo\'shildi');
  }

  function remove(id) {
    updateTunikaBaza(tunikaBaza.filter((x) => x.id !== id));
    setEditingId(null);
    showToast('O\'chirildi');
  }

  function nusxa(t) {
    const idx = tunikaBaza.findIndex((x) => x.id === t.id);
    const yangi = { ...t, id: genId(), nomi: `${t.nomi} (nusxa)` };
    const next = [...tunikaBaza];
    next.splice(idx + 1, 0, yangi);
    updateTunikaBaza(next);
    showToast('Nusxalandi');
  }

  return (
    <Card>
      <SectionTitle icon={Layers}>Listlar narxlari ({tunikaBaza.length})</SectionTitle>

      {adding ? (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Nomi *</label>
              <input value={form.nomi} onChange={(e) => setForm({ ...form, nomi: e.target.value })} placeholder="masalan: Ko'k SMZ" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Qalinlik (mm)</label>
              <input value={form.qalinlik} onChange={(e) => setForm({ ...form, qalinlik: e.target.value })} placeholder="0.40" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Optom narx</label>
              <input type="number" value={form.optom} onWheel={(e) => e.target.blur()} onChange={(e) => setForm({ ...form, optom: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Chakana narx</label>
              <input type="number" value={form.chakana} onWheel={(e) => e.target.blur()} onChange={(e) => setForm({ ...form, chakana: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
          </div>
          <RangTanla value={form.rang} onPick={(r) => setForm({ ...form, rang: r })} />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm(BLANK); }} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
            <button onClick={addNew} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setForm(BLANK); setAdding(true); setEditingId(null); }}
            className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Yangi list qo'shish
          </button>
          {tunikaBaza.length > 0 && (
            <button onClick={() => setBulk(true)} title="Barcha narxlarni birato'la yangilash"
              className="px-3 py-2.5 rounded-lg border-2 border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 flex items-center justify-center gap-1.5 flex-shrink-0">
              <Percent className="w-4 h-4" /> Ommaviy
            </button>
          )}
        </div>
      )}

      {bulk && <OmmaviyModal tunikaBaza={tunikaBaza} onClose={() => setBulk(false)} onApply={ommaviyApply} />}

      <div className="space-y-2">
        {tunikaBaza.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><Layers className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Listlar mavjud emas</p></div>
        ) : tunikaBaza.map((t) => (
          <div key={t.id} className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
            {editingId === t.id ? (
              <div className="p-3 bg-slate-50 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={t.nomi} onChange={(e) => patch(t.id, { nomi: e.target.value })} className="px-2 py-1 border bg-white rounded" />
                  <input value={t.qalinlik} onChange={(e) => patch(t.id, { qalinlik: e.target.value })} className="px-2 py-1 border bg-white rounded" />
                  <input type="number" value={t.optom} onWheel={(e) => e.target.blur()} onChange={(e) => patch(t.id, { optom: parseFloat(e.target.value) || 0 })} className="px-2 py-1 border bg-white rounded" />
                  <input type="number" value={t.chakana} onWheel={(e) => e.target.blur()} onChange={(e) => patch(t.id, { chakana: parseFloat(e.target.value) || 0 })} className="px-2 py-1 border bg-white rounded" />
                </div>
                <RangTanla value={t.rang || ''} onPick={(r) => patch(t.id, { rang: r })} />
                <div className="flex gap-2">
                  <button onClick={() => remove(t.id)} className="py-1.5 px-3 border-2 border-red-200 text-red-700 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 bg-slate-900 text-white rounded">Tayyor</button>
                </div>
              </div>
            ) : (
              <div className="group p-3 flex items-center gap-3 hover:bg-slate-50">
                <RangBadge rang={t.rang || rangTozala(t.nomi)} nomi={t.nomi} kind="tunika" />
                <button onClick={() => { setEditingId(t.id); setAdding(false); }} className="flex-1 min-w-0 text-left">
                  <b className="text-sm text-slate-900 truncate block">{t.nomi}</b><div className="text-slate-400 text-[10px]">{t.qalinlik} mm</div>
                </button>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold tabular-nums">Chakana: {fmt(t.chakana)}</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 tabular-nums">Optom: {fmt(t.optom)}</span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button title="Tahrirlash" onClick={() => { setEditingId(t.id); setAdding(false); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Edit3 className="w-4 h-4" /></button>
                  <button title="Nusxalash" onClick={() => nusxa(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
                  <button title="O'chirish" onClick={() => remove(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
