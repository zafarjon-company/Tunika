// ============================================================
//  MIJOZLAR VA USTALAR TABI
//  + Mijoz tarixi (zakaslar, jami xarid, qarz) modali
//  + Qarzdorlar paneli (kim qancha qarzdor)
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, Search, User, Hammer, Edit3, MapPin, Phone, FileText,
  Wallet, CheckCircle2, Clock, XCircle, AlertTriangle, X, History, MessageCircle,
} from 'lucide-react';

// Telefonni xalqaro raqamga (faqat raqam) — WhatsApp uchun
function telWa(phones) {
  const raw = (phones || []).filter(Boolean)[0] || '';
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('998')) return d;
  if (d.length === 9) return `998${d}`;
  return d;
}
import { Card, PhoneInput, StatBox } from '../../components/ui.jsx';
import { genId, fmt, formatDate } from '../../lib/helpers.js';

const norm = (s) => (s || '').trim().toLowerCase();

// Bir mijozning zakaslari — clientId bo'yicha, bo'lmasa nom bo'yicha
function mijozZakaslari(orders, c) {
  if (!c) return [];
  return orders.filter((o) =>
    o.customer?.clientId
      ? o.customer.clientId === c.id
      : norm(o.customer?.name) === norm(c.name),
  );
}
function jamla(os) {
  return os.reduce((a, o) => ({
    jami: a.jami + (o.totalSum || 0),
    tolangan: a.tolangan + (o.totalPaid || 0),
    qarz: a.qarz + (o.debt || 0),
    n: a.n + 1,
  }), { jami: 0, tolangan: 0, qarz: 0, n: 0 });
}

const STATUS = {
  paid:    { t: "To'langan", Icon: CheckCircle2, c: 'bg-emerald-100 text-emerald-700' },
  partial: { t: 'Qisman',    Icon: Clock,        c: 'bg-amber-100 text-amber-700' },
  unpaid:  { t: 'Qarz',      Icon: XCircle,      c: 'bg-red-100 text-red-700' },
};

// ----- Mijoz tarixi modali -----
function MijozDetailModal({ customer, orders, onClose, onEdit }) {
  const zak = useMemo(
    () => mijozZakaslari(orders, customer).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [orders, customer],
  );
  const s = jamla(zak);
  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-end sm:items-center justify-center no-print" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* sarlavha */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0">
            {(customer.name || '?').charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 truncate">{customer.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {(customer.phones || []).filter(Boolean).join(', ') || 'Telefon yo\'q'}
              {customer.address ? ` · ${customer.address}` : ''}
            </div>
          </div>
          {onEdit && (
            <button onClick={() => { onEdit(customer); onClose(); }} title="Tahrirlash"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex-shrink-0"><Edit3 className="w-4 h-4" /></button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {/* statistikalar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBox label="Zakaslar" value={s.n} />
            <StatBox label="Jami xarid" value={s.jami} suffix="so'm" />
            <StatBox label="To'langan" value={s.tolangan} suffix="so'm" color="emerald" />
            <StatBox label="Qoldiq qarz" value={s.qarz} suffix="so'm" color="amber" />
          </div>

          {/* zakaslar tarixi */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Zakaslar tarixi</div>
            {zak.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm"><FileText className="w-8 h-8 mx-auto mb-1.5 opacity-40" />Hali zakas yo'q</div>
            ) : (
              <div className="space-y-1.5">
                {zak.map((o) => {
                  const st = STATUS[o.status] || null;
                  return (
                    <div key={o.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 text-sm">
                      <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">№{o.number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-700 tabular-nums">{formatDate(o.createdAt)}</span>
                          {st && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-0.5 ${st.c}`}><st.Icon className="w-2.5 h-2.5" />{st.t}</span>}
                        </div>
                        <div className="text-[11px] text-slate-400">{(o.items || []).length} ta tovar</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-slate-900 tabular-nums">{fmt(o.totalSum)}</div>
                        {o.debt > 0 && <div className="text-[11px] text-amber-700 tabular-nums">qarz: {fmt(o.debt)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MijozlarTab({ klentlar, updateKlentlar, ustalar, updateUstalar, orders = [], shopName = '', showToast }) {
  const [sub, setSub] = useState('klentlar');

  const qarzJami = useMemo(() => orders.reduce((s, o) => s + (o.debt > 0 ? o.debt : 0), 0), [orders]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { k: 'klentlar', label: 'Mijozlar', icon: User, count: klentlar.length },
          { k: 'ustalar',  label: 'Ustalar',  icon: Hammer, count: ustalar.length },
          { k: 'qarzdor',  label: 'Qarzdorlar', icon: Wallet, count: null },
        ].map(({ k, label, icon: Icon, count }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3 rounded-lg font-medium border-2 transition ${
              sub === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
            {count != null && <span className={`text-xs px-1.5 py-0.5 rounded-full ${sub === k ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>}
          </button>
        ))}
      </div>

      {sub === 'klentlar' && <KlentlarSubTab klentlar={klentlar} updateKlentlar={updateKlentlar} orders={orders} showToast={showToast} />}
      {sub === 'ustalar' && <UstalarSubTab ustalar={ustalar} updateUstalar={updateUstalar} showToast={showToast} />}
      {sub === 'qarzdor' && <QarzdorlarSubTab orders={orders} klentlar={klentlar} qarzJami={qarzJami} shopName={shopName} />}
    </div>
  );
}

function KlentlarSubTab({ klentlar, updateKlentlar, orders, showToast }) {
  const [query, setQuery]     = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding]   = useState(false);
  const [detail, setDetail]   = useState(null); // ko'rilayotgan mijoz
  const [form, setForm]       = useState({ name: '', phones: [''], address: '', orientir: '' });

  const filtered = klentlar.filter((c) =>
    !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.phones.some((p) => p.includes(query)) || (c.address || '').toLowerCase().includes(query.toLowerCase())
  );

  function startAdd() { setForm({ name: '', phones: [''], address: '', orientir: '' }); setAdding(true); setEditing(null); }
  function startEdit(c) { setForm({ name: c.name, phones: c.phones || [''], address: c.address || '', orientir: c.orientir || '' }); setEditing(c.id); setAdding(false); }

  function changePhoneValue(idx, val) {
    const updated = [...form.phones];
    updated[idx] = val;
    setForm({ ...form, phones: updated });
  }

  function saveForm() {
    if (!form.name.trim()) { showToast('Ism kiriting'); return; }
    const cleaned = form.phones.map((p) => p.trim()).filter(Boolean);
    const finalData = { ...form, phones: cleaned.length ? cleaned : [''] };

    if (adding) { updateKlentlar([{ id: genId(), ...finalData }, ...klentlar]); showToast('Mijoz qo\'shildi'); }
    else { updateKlentlar(klentlar.map((c) => (c.id === editing ? { ...c, ...finalData } : c))); showToast('Saqlandi'); }
    setAdding(false); setEditing(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-4 items-start">
      {/* CHAP: sticky qidiruv + qo'shish/forma */}
      <aside className="lg:sticky lg:top-36">
        <Card>
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mijoz qidirish..." className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
      </div>

      <button onClick={startAdd} className="w-full mb-2 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Yangi mijoz</button>

      {(adding || editing) && (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Ism familiya *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ism familiya" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
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
            <label className="block text-xs text-slate-600 mb-1 font-medium">Manzil</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Manzil" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Orientir (mo'ljal)</label>
            <input value={form.orientir} onChange={(e) => setForm({ ...form, orientir: e.target.value })} placeholder="masalan: katta do'kon yonida" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setAdding(false); setEditing(null); }} className="flex-1 py-2 border-2 border-slate-200 text-slate-700 rounded-lg bg-white">Bekor</button>
            <button onClick={saveForm} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      )}
        </Card>
      </aside>

      {/* O'NG: mijozlar ro'yxati */}
      <Card>
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><User className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Mijozlar mavjud emas</p></div>
        ) : filtered.map((c) => {
          const s = jamla(mijozZakaslari(orders, c));
          return (
            <div key={c.id} className="group w-full p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-3 text-sm transition">
              <button onClick={() => setDetail(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0">{(c.name || '?').charAt(0).toUpperCase()}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 truncate">{c.phones?.filter(Boolean).join(', ')} {c.address && `· ${c.address}`} {c.orientir && <span className="inline-flex items-center gap-0.5"> · <MapPin className="w-3 h-3" />{c.orientir}</span>}</div>
                </div>
              </button>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {s.qarz > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold tabular-nums whitespace-nowrap hidden sm:inline">Qarz {fmt(s.qarz)}</span>}
                {s.n > 0 && <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold tabular-nums">{s.n} ta</span>}
                <button onClick={() => setDetail(c)} title="Tarix" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><History className="w-4 h-4" /></button>
                <button onClick={() => startEdit(c)} title="Tahrirlash" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Edit3 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
      </div>
      </Card>

      {detail && <MijozDetailModal customer={detail} orders={orders} onClose={() => setDetail(null)} onEdit={startEdit} />}
    </div>
  );
}

// ----- Qarzdorlar paneli -----
function QarzdorlarSubTab({ orders, klentlar, qarzJami, shopName = '' }) {
  const [detail, setDetail] = useState(null);

  // Qarzdorga WhatsApp eslatma
  function eslat(d, e) {
    e.stopPropagation();
    const L = [`Assalomu alaykum${d.name && d.name !== '—' ? ', ' + d.name : ''}!`,
      `Sizda ${fmt(d.qarz)} so'm qarz mavjud.`,
      'Imkoningiz bo\'lsa, to\'lab qo\'yishingizni so\'raymiz. Rahmat!'];
    if (shopName) L.push(shopName);
    const text = encodeURIComponent(L.join('\n'));
    const tel = telWa(d.phones);
    window.open(tel ? `https://wa.me/${tel}?text=${text}` : `https://wa.me/?text=${text}`, '_blank', 'noopener');
  }

  const debtors = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      if (!(o.debt > 0)) return;
      const key = o.customer?.clientId || `nom:${norm(o.customer?.name)}`;
      let g = map.get(key);
      if (!g) {
        g = { key, name: o.customer?.name || '—', clientId: o.customer?.clientId || null,
              phones: (o.customer?.phones || []).filter(Boolean), qarz: 0, n: 0, oldest: o.createdAt };
        map.set(key, g);
      }
      g.qarz += o.debt || 0; g.n += 1;
      if (new Date(o.createdAt) < new Date(g.oldest)) g.oldest = o.createdAt;
      if (!g.phones.length && o.customer?.phones) g.phones = o.customer.phones.filter(Boolean);
    });
    return [...map.values()].sort((a, b) => b.qarz - a.qarz);
  }, [orders]);

  function openDetail(d) {
    const klent = d.clientId
      ? klentlar.find((k) => k.id === d.clientId)
      : klentlar.find((k) => norm(k.name) === norm(d.name));
    setDetail(klent || { id: d.clientId, name: d.name, phones: d.phones });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Umumiy qarz" value={qarzJami} suffix="so'm" color="amber" />
        <StatBox label="Qarzdorlar" value={debtors.length} />
      </div>

      <Card>
        {debtors.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-emerald-400" /><p className="text-sm">Qarzdorlar yo'q — hammasi to'langan!</p></div>
        ) : (
          <div className="space-y-1.5">
            {debtors.map((d, i) => (
              <button key={d.key} onClick={() => openDetail(d)}
                className="w-full p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-3 text-sm transition text-left">
                <span className="w-7 text-center text-slate-400 font-bold flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{d.name}</div>
                  <div className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                    {d.phones.length > 0 && <span className="inline-flex items-center gap-0.5"><Phone className="w-3 h-3" />{d.phones[0]}</span>}
                    <span className="inline-flex items-center gap-0.5"><FileText className="w-3 h-3" />{d.n} ta zakas</span>
                    <span className="text-slate-400">eng eski: {formatDate(d.oldest)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold tabular-nums whitespace-nowrap">{fmt(d.qarz)}</span>
                  <span role="button" tabIndex={0} onClick={(e) => eslat(d, e)} title="WhatsApp eslatma"
                    className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"><MessageCircle className="w-4 h-4" /></span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {detail && <MijozDetailModal customer={detail} orders={orders} onClose={() => setDetail(null)} />}
    </div>
  );
}

function UstalarSubTab({ ustalar, updateUstalar, showToast }) {
  const [query, setQuery]     = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ name: '', phones: [''] });

  const filtered = ustalar.filter((u) => !query.trim() || u.name.toLowerCase().includes(query.toLowerCase()) || u.phones.some((p) => p.includes(query)));

  function changePhoneValue(idx, val) {
    const updated = [...form.phones];
    updated[idx] = val;
    setForm({ ...form, phones: updated });
  }

  function startEdit(u) {
    setForm({ name: u.name, phones: u.phones && u.phones.length ? u.phones : [''] });
    setEditing(u.id);
    setAdding(false);
  }

  function saveForm() {
    if (!form.name.trim()) { showToast('Ism kiriting'); return; }
    const cleaned = form.phones.map((p) => p.trim()).filter(Boolean);
    const finalData = { ...form, phones: cleaned.length ? cleaned : [''] };

    if (adding) { updateUstalar([...ustalar, { id: genId(), ...finalData }]); showToast('Usta qo\'shildi'); }
    else { updateUstalar(ustalar.map((u) => (u.id === editing ? { ...u, ...finalData } : u))); showToast('Saqlandi'); }
    setAdding(false); setEditing(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-4 items-start">
      {/* CHAP: sticky qidiruv + qo'shish/forma */}
      <aside className="lg:sticky lg:top-36">
        <Card>
      <div className="relative mb-3"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Usta qidirish..." className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" /></div>
      <button onClick={() => { setForm({ name: '', phones: [''] }); setAdding(true); setEditing(null); }} className="w-full mb-2 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Yangi usta</button>

      {(adding || editing) && (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-3 mb-3 text-sm">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Usta ismi" className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white" />
          <div>
            {form.phones.map((phone, pIdx) => (
              <div key={pIdx} className="flex gap-1 mb-1">
                <PhoneInput value={phone} onChange={(v) => changePhoneValue(pIdx, v)} className="flex-1 px-3 py-1.5 border-2 border-slate-200 rounded-lg bg-white text-xs tabular-nums" />
                {form.phones.length > 1 && <button type="button" onClick={() => setForm({ ...form, phones: form.phones.filter((_, i) => i !== pIdx) })} className="px-2 text-red-600 border border-slate-200 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, phones: [...form.phones, ''] })} className="text-xs text-slate-900 font-bold mt-1">+ Raqam qo'shish</button>
          </div>
          <div className="flex gap-2"><button onClick={() => { setAdding(false); setEditing(null); }} className="flex-1 py-2 border border-slate-200 rounded-lg bg-white">Bekor</button><button onClick={saveForm} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button></div>
        </div>
      )}
        </Card>
      </aside>

      {/* O'NG: ustalar ro'yxati */}
      <Card>
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><Hammer className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Ustalar topilmadi</p></div>
        ) : filtered.map((u) => (
          <button key={u.id} onClick={() => startEdit(u)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-3 text-sm transition">
            <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0"><Hammer className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0"><div className="font-semibold text-slate-900 truncate">{u.name}</div><div className="text-xs text-slate-500 truncate">{u.phones?.filter(Boolean).join(', ') || 'Telefon kiritilmagan'}</div></div>
            <Edit3 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>
        ))}
      </div>
      </Card>
    </div>
  );
}
