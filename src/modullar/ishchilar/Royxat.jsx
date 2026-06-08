// ============================================================
//  ISHCHILAR RO'YXATI (CRUD)
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, Search, Edit3, Star, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, PhoneInput } from '../../components/ui.jsx';
import { fmt, genId, formatDate } from '../../lib/helpers.js';
import { DarajaNishon, StarRating } from './Lavozimlar.jsx';
import { NegativeRating } from './Kamchiliklar.jsx';

const BLANK = { name: '', phones: [''], lavozimlar: [], oylikHaqq: '', qobiliyatlar: [], kamchiliklar: [], oylikTarix: [] };
const lavOf = (i) => (i.lavozimlar?.length ? i.lavozimlar : (i.lavozim ? [i.lavozim] : []));

export function IshchilarRoyxat({ ishchilar, updateIshchilar, lavozimlar = [], qobiliyatRoyxati = [], kamchilikRoyxati = [], showToast }) {
  const [query, setQuery]     = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState(BLANK);
  const [oylikDelta, setOylikDelta] = useState('');

  const ballOf = (i) =>
    (i.qobiliyatlar || []).reduce((s, q) => s + (q.ball || 0), 0)
    - (i.kamchiliklar || []).reduce((s, k) => s + (k.ball || 0), 0);

  const filtered = ishchilar
    .filter((i) =>
      !query.trim() || i.name.toLowerCase().includes(query.toLowerCase()) ||
      lavOf(i).some((n) => n.toLowerCase().includes(query.toLowerCase())) ||
      (i.phones || []).some((p) => p.includes(query))
    )
    .sort((a, b) => ballOf(b) - ballOf(a)); // ball ko'p bo'lgani tepada

  function startAdd() { setForm(BLANK); setAdding(true); setEditing(null); }
  function startEdit(i) {
    setForm({ name: i.name, phones: i.phones || [''], lavozimlar: lavOf(i), oylikHaqq: i.oylikHaqq || '', qobiliyatlar: i.qobiliyatlar || [], kamchiliklar: i.kamchiliklar || [], oylikTarix: i.oylikTarix || [] });
    setEditing(i.id); setAdding(false);
  }

  function toggleLavozim(nomi) {
    setForm({
      ...form,
      lavozimlar: form.lavozimlar.includes(nomi)
        ? form.lavozimlar.filter((n) => n !== nomi)
        : [...form.lavozimlar, nomi],
    });
  }

  function oylikKotarTushir(sign) {
    const d = parseFloat(oylikDelta) || 0;
    if (d <= 0) { showToast('Summani kiriting'); return; }
    const cur = parseFloat(form.oylikHaqq) || 0;
    const next = sign > 0 ? cur + d : Math.max(0, cur - d);
    const entry = { id: genId(), sana: new Date().toISOString(), turi: sign > 0 ? 'kotar' : 'tushir', summa: d, eski: cur, yangi: next };
    setForm({ ...form, oylikHaqq: next, oylikTarix: [entry, ...(form.oylikTarix || [])] });
    setOylikDelta('');
    showToast(sign > 0 ? `Oylik ${fmt(d)} so'm ko'tarildi` : `Oylik ${fmt(d)} so'm tushirildi`);
  }
  function removeTarix(tid) {
    setForm({ ...form, oylikTarix: (form.oylikTarix || []).filter((t) => t.id !== tid) });
  }

  function changePhoneValue(idx, val) {
    const updated = [...form.phones];
    updated[idx] = val;
    setForm({ ...form, phones: updated });
  }

  function toggleQob(c) {
    const has = form.qobiliyatlar.some((q) => q.nomi === c.nomi);
    setForm({
      ...form,
      qobiliyatlar: has
        ? form.qobiliyatlar.filter((q) => q.nomi !== c.nomi)
        : [...form.qobiliyatlar, { nomi: c.nomi, ball: c.daraja || 0 }],
    });
  }
  function setQobBall(nomi, ball) {
    setForm({ ...form, qobiliyatlar: form.qobiliyatlar.map((q) => (q.nomi === nomi ? { ...q, ball } : q)) });
  }

  function toggleKam(c) {
    const has = form.kamchiliklar.some((k) => k.nomi === c.nomi);
    setForm({
      ...form,
      kamchiliklar: has
        ? form.kamchiliklar.filter((k) => k.nomi !== c.nomi)
        : [...form.kamchiliklar, { nomi: c.nomi, ball: c.daraja || 0 }],
    });
  }
  function setKamBall(nomi, ball) {
    setForm({ ...form, kamchiliklar: form.kamchiliklar.map((k) => (k.nomi === nomi ? { ...k, ball } : k)) });
  }

  function saveForm() {
    if (!form.name.trim()) { showToast('Ism kiriting'); return; }
    const cleaned = form.phones.map((p) => p.trim()).filter(Boolean);
    const finalData = {
      ...form,
      phones: cleaned.length ? cleaned : [''],
      oylikHaqq: parseFloat(form.oylikHaqq) || 0,
      qobiliyatlar: form.qobiliyatlar.filter((q) => q.nomi.trim()).map((q) => ({ nomi: q.nomi.trim(), ball: q.ball || 0 })),
      kamchiliklar: form.kamchiliklar.filter((k) => k.nomi.trim()).map((k) => ({ nomi: k.nomi.trim(), ball: k.ball || 0 })),
    };

    if (adding) { updateIshchilar([{ id: genId(), ...finalData }, ...ishchilar]); showToast('Ishchi qo\'shildi'); }
    else { updateIshchilar(ishchilar.map((i) => (i.id === editing ? { ...i, ...finalData } : i))); showToast('Saqlandi'); }
    setAdding(false); setEditing(null);
  }

  function removeIshchi(id) {
    updateIshchilar(ishchilar.filter((i) => i.id !== id));
    setEditing(null); setAdding(false);
    showToast('Ishchi o\'chirildi');
  }

  return (
    <Card>
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ishchi qidirish..." className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
      </div>

      <button onClick={startAdd} className="w-full mb-2 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Yangi ishchi</button>

      {(adding || editing) && (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Ism familiya *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ism familiya" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Oylik ish haqi (so'm)</label>
            <input type="number" value={form.oylikHaqq} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, oylikHaqq: e.target.value })} placeholder="0" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm tabular-nums" />
            {/* Ko'tarish / Tushirish — alohida summa qo'shish yoki ayirish */}
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <input type="number" value={oylikDelta} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                onChange={(e) => setOylikDelta(e.target.value)} placeholder="Summa"
                className="w-full sm:flex-1 sm:min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm tabular-nums" />
              <div className="flex gap-2">
                <button type="button" onClick={() => oylikKotarTushir(1)}
                  className="flex-1 justify-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 whitespace-nowrap inline-flex items-center gap-1"><ArrowUp className="w-4 h-4" /> Ko'tarish</button>
                <button type="button" onClick={() => oylikKotarTushir(-1)}
                  className="flex-1 justify-center px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 whitespace-nowrap inline-flex items-center gap-1"><ArrowDown className="w-4 h-4" /> Tushirish</button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Summani yozib "Ko'tarish" yoki "Tushirish"ni bosing — oylik o'zgaradi. Keyin "Saqlash".</p>
            {(form.oylikTarix || []).length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Oylik o'zgarishlar tarixi:</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {form.oylikTarix.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 text-[11px] bg-white border border-slate-200 rounded px-2 py-1">
                      <span className="text-slate-500 flex-shrink-0">{formatDate(t.sana)}</span>
                      <span className={`tabular-nums font-semibold inline-flex items-center gap-0.5 ${t.turi === 'kotar' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {t.turi === 'kotar' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {t.turi === 'kotar' ? '+' : '−'}{fmt(t.summa)} <span className="text-slate-400 font-normal ml-0.5">→ {fmt(t.yangi)}</span>
                      </span>
                      <button type="button" onClick={() => removeTarix(t.id)} className="text-slate-300 hover:text-red-600 flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Lavozim(lar)</label>
            {lavozimlar.length === 0 ? (
              <p className="text-xs text-slate-400">Avval "Lavozimlar" bo'limidan lavozim qo'shing.</p>
            ) : (
              <div className="space-y-0.5">
                {lavozimlar.map((l) => {
                  const on = form.lavozimlar.includes(l.nomi);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-2 py-0.5 px-1">
                      <button type="button" onClick={() => toggleLavozim(l.nomi)}
                        className={`text-sm text-left transition ${on ? 'text-emerald-700 font-semibold underline underline-offset-2' : 'text-slate-400 hover:text-slate-600'}`}>
                        {l.nomi}
                      </button>
                      {l.daraja > 0 && <DarajaNishon daraja={l.daraja} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Telefon raqamlari</label>
            {form.phones.map((phone, pIdx) => (
              <div key={pIdx} className="flex gap-1 mb-1">
                <PhoneInput value={phone} onChange={(v) => changePhoneValue(pIdx, v)} className="flex-1 px-3 py-1.5 border-2 border-slate-200 rounded-lg bg-white text-xs tabular-nums" />
                {form.phones.length > 1 && <button type="button" onClick={() => setForm({ ...form, phones: form.phones.filter((_, i) => i !== pIdx) })} className="px-2 text-red-600 border border-slate-200 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, phones: [...form.phones, ''] })} className="text-xs text-slate-900 font-bold mt-1">+ Raqam qo'shish</button>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Qobiliyatlari</label>
            {qobiliyatRoyxati.length === 0 ? (
              <p className="text-xs text-slate-400">Avval "Qobiliyatlar" bo'limidan qobiliyat qo'shing.</p>
            ) : (
              <div className="space-y-0.5">
                {qobiliyatRoyxati.map((c) => {
                  const sel = form.qobiliyatlar.find((q) => q.nomi === c.nomi);
                  const on = !!sel;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 py-0.5 px-1">
                      <button type="button" onClick={() => toggleQob(c)}
                        className={`text-sm text-left transition ${on ? 'text-emerald-700 font-semibold underline underline-offset-2' : 'text-slate-400 hover:text-slate-600'}`}>
                        {c.nomi}
                      </button>
                      {on && <StarRating value={sel.ball || 0} onChange={(b) => setQobBall(c.nomi, b)} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Kamchiliklari</label>
            {kamchilikRoyxati.length === 0 ? (
              <p className="text-xs text-slate-400">Avval "Kamchiliklar" bo'limidan kamchilik qo'shing.</p>
            ) : (
              <div className="space-y-0.5">
                {kamchilikRoyxati.map((c) => {
                  const sel = form.kamchiliklar.find((k) => k.nomi === c.nomi);
                  const on = !!sel;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 py-0.5 px-1">
                      <button type="button" onClick={() => toggleKam(c)}
                        className={`text-sm text-left transition ${on ? 'text-red-600 font-semibold underline underline-offset-2' : 'text-slate-400 hover:text-slate-600'}`}>
                        {c.nomi}
                      </button>
                      {on && <NegativeRating value={sel.ball || 0} onChange={(b) => setKamBall(c.nomi, b)} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAdding(false); setEditing(null); }} className="flex-1 py-2 border-2 border-slate-200 text-slate-700 rounded-lg bg-white">Bekor</button>
            {editing && <button onClick={() => removeIshchi(editing)} className="py-2 px-3 border-2 border-red-200 text-red-700 rounded-lg bg-white"><Trash2 className="w-4 h-4" /></button>}
            <button onClick={saveForm} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Ishchilar mavjud emas</p> : filtered.map((i) => {
          const lavList = lavOf(i);
          const daraja = Math.max(0, ...lavList.map((n) => lavozimlar.find((l) => l.nomi === n)?.daraja || 0));
          const ball = ballOf(i);
          return (
            <button key={i.id} onClick={() => startEdit(i)} className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-3 text-sm">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="font-medium text-slate-900 truncate">{i.name}</div>
                {lavList.length > 0 && <div className="text-xs text-slate-600 truncate">{lavList.join(' · ')}</div>}
                {i.qobiliyatlar?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-emerald-700">
                    {i.qobiliyatlar.map((q, qi) => (
                      <span key={qi} className="inline-flex items-center gap-0.5">
                        {q.nomi}
                        {q.ball > 0 && Array.from({ length: q.ball }).map((_, si) => <Star key={si} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />)}
                      </span>
                    ))}
                  </div>
                )}
                {i.kamchiliklar?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-red-600">
                    {i.kamchiliklar.map((k, ki) => (
                      <span key={ki} className="inline-flex items-center gap-0.5">
                        {k.nomi}
                        {k.ball > 0 && Array.from({ length: k.ball }).map((_, xi) => <X key={xi} className="w-2.5 h-2.5 text-red-500" strokeWidth={3} />)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-slate-500 truncate">
                  {i.phones?.filter(Boolean).join(', ')}
                </div>
              </div>
              {ball !== 0 && <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${ball > 0 ? 'text-emerald-700' : 'text-red-600'}`}>{ball} ball</span>}
              {daraja > 0 && <DarajaNishon daraja={daraja} />}
              <Edit3 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
