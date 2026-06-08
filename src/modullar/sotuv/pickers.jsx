// ============================================================
//  TANLASH (PICKER) MODALLARI
//  ProductPickerModal, ClientPickerModal, MasterPickerModal
// ============================================================
import React, { useState } from 'react';
import { Trash2, ChevronLeft, ChevronRight, Layers, Package, Ruler, Search } from 'lucide-react';
import { FullModal, PhoneInput } from '../../components/ui.jsx';
import { fmt, genId, metrliVariantlar } from '../../lib/helpers.js';
import { BOSHQA_USTA } from '../../lib/constants.js';

// 2 bosqichli guruhli tanlov: guruh -> tovar
export function ProductPickerModal({ tunikaBaza = [], metrlilar = [], aksessuarlar = [], onSelect, onClose }) {
  const [sel, setSel] = useState(null);
  const [query, setQuery] = useState('');

  const groups = [
    { key: 'tunika',     label: 'Listlar',      kind: 'tunika',     icon: Layers,  items: tunikaBaza,
      getLabel: (t) => `${t.nomi} (${t.qalinlik} mm)`, getHint: (t) => `Ch: ${fmt(t.chakana)} · Op: ${fmt(t.optom)}` },
    { key: 'profnastil', label: 'Profnastil',   kind: 'profnastil', icon: Layers,  items: tunikaBaza,
      getLabel: (t) => `${t.nomi} (${t.qalinlik} mm)`, getHint: (t) => `Ch: ${fmt(t.chakana)} · Op: ${fmt(t.optom)}` },
    { key: 'metrli',     label: 'Metrli',       kind: 'metrli',     icon: Ruler,   items: metrlilar,
      getLabel: (m) => m.nomi, getHint: (m) => `${metrliVariantlar(m).length} variant` },
    { key: 'aksessuar',  label: 'Aksessuarlar', kind: 'aksessuar',  icon: Package, items: aksessuarlar,
      getLabel: (a) => a.nomi, getHint: (a) => `${fmt(a.narx)} so'm/${a.birlik || 'dona'}` },
  ];

  const group = groups.find((g) => g.key === sel);
  const q = query.trim().toLowerCase();

  // Qidiruv yoqilganda — barcha guruhlar bo'ylab tekis (flat) natija
  const searchHits = q
    ? groups.flatMap((g) => g.items
        .filter((item) => g.getLabel(item).toLowerCase().includes(q))
        .map((item) => ({ g, item })))
    : [];

  function pick(g, item) {
    if (g.kind === 'metrli') onSelect({ kind: 'metrli', metrliId: item.id });
    else if (g.kind === 'aksessuar') onSelect({ kind: 'aksessuar', aksId: item.id });
    else onSelect({ kind: g.kind, tunikaId: item.id });
  }

  // Bitta tovar qatori (ham qidiruvda, ham guruh ichida ishlatiladi)
  function ItemBtn({ g, item, badge = false }) {
    return (
      <button onClick={() => pick(g, item)}
        className="w-full text-left p-3 rounded-xl border-2 border-slate-200 hover:border-slate-900 transition flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <g.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-sm truncate flex items-center gap-1.5">
              {g.getLabel(item)}
              {badge && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">{g.label}</span>}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">{g.getHint(item)}</div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
      </button>
    );
  }

  return (
    <FullModal onClose={onClose} title={q ? 'Qidiruv natijasi' : group ? group.label : 'Guruhni tanlang'}>
      <div className="p-4 space-y-2">
        {/* Qidiruv — har doim tepada */}
        <div className="relative mb-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            placeholder="Tovar qidirish (list, metrli, aksessuar...)"
            className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
        </div>

        {q ? (
          searchHits.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">"{query}" bo'yicha hech narsa topilmadi</p>
          ) : (
            searchHits.map(({ g, item }) => <ItemBtn key={`${g.key}-${item.id}`} g={g} item={item} badge />)
          )
        ) : !group ? (
          <div className="grid grid-cols-2 gap-2">
            {groups.map((g) => (
              <button key={g.key} onClick={() => setSel(g.key)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-slate-900 transition">
                <g.icon className="w-6 h-6 text-slate-700" />
                <span className="font-bold text-sm">{g.label}</span>
                <span className="text-[11px] text-slate-400">{g.items.length} ta</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button onClick={() => setSel(null)} className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 mb-1">
              <ChevronLeft className="w-4 h-4" /> Guruhlar
            </button>
            {group.items.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Bu guruhda tovar yo'q</p>
            ) : group.items.map((item) => <ItemBtn key={item.id} g={group} item={item} />)}
          </>
        )}
      </div>
    </FullModal>
  );
}

export function ClientPickerModal({ klentlar, updateKlentlar, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phones: [''], address: '', orientir: '' });

  const filtered = klentlar.filter((c) => !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()));

  function changePhone(idx, v) {
    setForm({ ...form, phones: form.phones.map((p, i) => (i === idx ? v : p)) });
  }

  function saveAndSelect() {
    if (!form.name.trim()) return;
    const cleaned = form.phones.map((p) => p.trim()).filter(Boolean);
    const nK = {
      id: genId(),
      name: form.name.trim(),
      phones: cleaned.length ? cleaned : [''],
      address: form.address.trim(),
      orientir: form.orientir.trim(),
    };
    updateKlentlar([nK, ...klentlar]);
    onSelect(nK);
  }

  return (
    <FullModal onClose={onClose} title="Mijoz tanlash">
      <div className="p-4 space-y-3 text-xs">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mijoz qidirish..." className="w-full px-3 py-2 border-2 rounded-lg text-sm" />
        {adding ? (
          <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 text-sm">
            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Ism familiya *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ism familiya" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Telefon raqamlari</label>
              {form.phones.map((phone, pIdx) => (
                <div key={pIdx} className="flex gap-1 mb-1">
                  <PhoneInput value={phone} onChange={(v) => changePhone(pIdx, v)} className="flex-1 px-3 py-1.5 border-2 border-slate-200 rounded-lg bg-white text-xs tabular-nums" />
                  {form.phones.length > 1 && <button type="button" onClick={() => setForm({ ...form, phones: form.phones.filter((_, i) => i !== pIdx) })} className="px-2 text-red-600 border border-slate-200 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, phones: [...form.phones, ''] })} className="text-xs text-slate-900 font-bold mt-1">+ Raqam qo'shish</button>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Manzil</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Manzil" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1 font-medium">Orientir (mo'ljal)</label>
              <input value={form.orientir} onChange={(e) => setForm({ ...form, orientir: e.target.value })} placeholder="masalan: katta do'kon yonida" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdding(false)} className="flex-1 py-2 border-2 border-slate-200 text-slate-700 rounded-lg bg-white">Bekor</button>
              <button onClick={saveAndSelect} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash va tanlash</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full py-2 border border-dashed rounded text-center">+ Yangi mijoz ochish</button>
        )}
        <div className="space-y-1">{filtered.map((c) => <button key={c.id} onClick={() => onSelect(c)} className="w-full text-left p-2.5 border rounded-lg hover:bg-slate-50 block"><b>{c.name}</b> <div className="text-slate-400">{c.phones?.filter(Boolean).join(', ')}</div></button>)}</div>
      </div>
    </FullModal>
  );
}

export function MasterPickerModal({ ustalar, updateUstalar, onSelect, onClose }) {
  return (
    <FullModal onClose={onClose} title="Ustani tanlang">
      <div className="p-4 space-y-3 text-xs">
        <button onClick={() => onSelect(BOSHQA_USTA)} className="w-full text-left p-3 border rounded-lg bg-slate-50"><b>Boshqa usta</b></button>
        {ustalar.map((u) => <button key={u.id} onClick={() => onSelect(u)} className="w-full text-left p-3 border rounded-lg block"><b>{u.name}</b></button>)}
      </div>
    </FullModal>
  );
}
