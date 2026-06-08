// ============================================================
//  GLOBAL QIDIRUV — istalgan joydan zakas/mijoz topish
// ------------------------------------------------------------
//  Header'dagi qidiruv ikonkasi ochadi. Zakas raqami, mijoz nomi,
//  telefon, manzil, usta bo'yicha qidiradi. Zakas → chek ochiladi,
//  mijoz → Mijozlar bo'limiga o'tadi.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, User, Phone } from 'lucide-react';
import { fmt, formatDate } from '../lib/helpers.js';

export function GlobalSearch({ orders = [], klentlar = [], onOrder, onCustomer, onClose }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 50); return () => clearTimeout(t); }, []);

  const query = q.trim().toLowerCase();
  const orderHits = !query ? [] : orders.filter((o) => {
    return String(o.number).includes(query)
      || (o.customer?.name || '').toLowerCase().includes(query)
      || (o.customer?.phones || []).some((p) => (p || '').includes(query))
      || (o.customer?.address || '').toLowerCase().includes(query)
      || (o.masterName || '').toLowerCase().includes(query);
  }).slice(0, 8);
  const custHits = !query ? [] : klentlar.filter((c) =>
    (c.name || '').toLowerCase().includes(query)
    || (c.phones || []).some((p) => (p || '').includes(query))
    || (c.address || '').toLowerCase().includes(query),
  ).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-start justify-center p-4 no-print" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl mt-[8vh] overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Zakas raqami, mijoz, telefon, manzil, usta..."
            className="flex-1 min-w-0 py-1.5 outline-none text-sm bg-transparent" />
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-2">
          {!query ? (
            <p className="text-sm text-slate-400 text-center py-8">Qidirish uchun yozing…</p>
          ) : orderHits.length === 0 && custHits.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Hech narsa topilmadi</p>
          ) : (
            <div className="space-y-3">
              {orderHits.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Zakaslar</div>
                  <div className="space-y-1">
                    {orderHits.map((o) => (
                      <button key={o.id} onClick={() => onOrder(o)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 flex items-center gap-3 transition">
                        <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">№{o.number}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 truncate text-sm">{o.customer?.name || '—'}</div>
                          <div className="text-[11px] text-slate-400 truncate">{formatDate(o.createdAt)}{o.masterName && o.masterName !== 'Boshqa' ? ` · ${o.masterName}` : ''}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-slate-900 tabular-nums text-sm">{fmt(o.totalSum)}</div>
                          {o.debt > 0 && <div className="text-[11px] text-amber-700 tabular-nums">qarz: {fmt(o.debt)}</div>}
                        </div>
                        <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {custHits.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">Mijozlar</div>
                  <div className="space-y-1">
                    {custHits.map((c) => (
                      <button key={c.id} onClick={() => onCustomer(c)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 flex items-center gap-3 transition">
                        <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold flex-shrink-0">{(c.name || '?').charAt(0).toUpperCase()}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 truncate text-sm">{c.name}</div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                            {(c.phones || []).filter(Boolean)[0] && <><Phone className="w-3 h-3" />{(c.phones || []).filter(Boolean)[0]}</>}
                            {c.address ? ` · ${c.address}` : ''}
                          </div>
                        </div>
                        <User className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
