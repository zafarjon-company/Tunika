// ============================================================
//  OMBOR → HARAKAT (kirim/chiqim tarixi)
// ------------------------------------------------------------
//  Yozuv: { id, ts(ISO), turi:'kirim'|'chiqim'|'tuzatish', omborId,
//           miqdor, narx, izoh, orderId?, orderNumber?, userLogin }
//  Rulon kirimi (Rulonlar bo'limidan): omborId o'rniga rulonId, nomi
//           (snapshot), birlik:'kg', uzunlik (m), narx — 1 m tannarxi,
//           narxBirlik:'m'. Rulon o'chirilsa ham nomi jurnalda qoladi.
//  Faqat ko'rish — yozuvlar Materiallar tabidan, Rulonlar bo'limida yangi
//  rulon saqlanganda va zakas saqlanganda tushadi.
// ============================================================
import React, { useState, useMemo, useCallback } from 'react';
import { History, Search, ArrowDownToLine, ArrowUpFromLine, Wrench } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { fmt, formatDate } from '../../lib/helpers.js';
import { harakatRoyxat, omborRoyxat, birlikBelgisi } from '../../lib/ombor.js';

const KORSATISH_LIMIT = 200;

// Harakat turi — yorliq, belgi va rang
const TUR = {
  kirim:    { nom: 'Kirim',    belgi: '+', icon: ArrowDownToLine, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  chiqim:   { nom: 'Chiqim',   belgi: '−', icon: ArrowUpFromLine, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  tuzatish: { nom: 'Tuzatish', belgi: '±', icon: Wrench,          cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function Harakat({ omborHarakat = {}, ombor = {} }) {
  const [tur, setTur] = useState('all');
  const [matId, setMatId] = useState('all');
  const [query, setQuery] = useState('');

  const barchasi = useMemo(() => harakatRoyxat(omborHarakat), [omborHarakat]);
  const materiallar = useMemo(() => omborRoyxat(ombor), [ombor]);

  // Material nomi/birligi (o'chirilgani ham topilsin — tarix buzilmasin)
  const matById = useCallback((id) => (ombor || {})[id] || null, [ombor]);

  const filtered = useMemo(() => barchasi.filter((h) => {
    if (tur !== 'all' && h.turi !== tur) return false;
    // "rulon" — faqat rulon kirimlari; material id — faqat o'sha material
    if (matId === 'rulon' ? !h.rulonId : (matId !== 'all' && h.omborId !== matId)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const m = h.rulonId ? null : matById(h.omborId);
    return ((m && m.nomi) || '').toLowerCase().includes(q)
      || (h.nomi || '').toLowerCase().includes(q)
      || (h.izoh || '').toLowerCase().includes(q)
      || (h.userLogin || '').toLowerCase().includes(q)
      || String(h.orderNumber || '').includes(q);
  }), [barchasi, tur, matId, query, matById]);

  const korinadi = filtered.slice(0, KORSATISH_LIMIT);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={History}>Ombor harakati ({filtered.length})</SectionTitle>
        <p className="text-xs text-slate-500 mb-3">
          Materiallar kirim-chiqimi va rulon kirimi tarixi — yangi yozuvlar tepada.
          Ko'pi bilan {KORSATISH_LIMIT} ta ko'rsatiladi.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Material, izoh, zakas yoki foydalanuvchi..."
              className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <select value={tur} onChange={(e) => setTur(e.target.value)}
            className="px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm bg-white">
            <option value="all">Hammasi</option>
            <option value="kirim">Kirim</option>
            <option value="chiqim">Chiqim</option>
            <option value="tuzatish">Tuzatish</option>
          </select>
          <select value={matId} onChange={(e) => setMatId(e.target.value)}
            className="px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm bg-white">
            <option value="all">Barcha material</option>
            <option value="rulon">Rulonlar</option>
            {materiallar.map((m) => <option key={m.id} value={m.id}>{m.nomi}</option>)}
          </select>
        </div>
      </Card>

      <Card padding="p-0">
        {korinadi.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Harakat yozuvlari topilmadi</p>
            <p className="text-xs mt-1">Materiallar tabida "Kirim" / "Chiqim" qiling yoki Rulonlar bo'limida rulon kiriting</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {korinadi.map((h) => {
              const t = TUR[h.turi] || TUR.tuzatish;
              const T = t.icon;
              const rulon = Boolean(h.rulonId);
              const m = rulon ? null : matById(h.omborId);
              const nomi = rulon ? (h.nomi || 'Rulon') : ((m && m.nomi) || "O'chirilgan material");
              const birlik = h.birlik || birlikBelgisi(m && m.birlik);
              const narxBirlik = h.narxBirlik || birlik || 'birlik';
              return (
                <div key={h.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg border flex items-center justify-center ${t.cls}`}>
                    <T className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm flex items-center gap-1.5 flex-wrap">
                      <b className="text-slate-900">{nomi}</b>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${t.cls}`}>
                        {t.belgi} {t.nom}
                      </span>
                      <span className="tabular-nums text-slate-700">
                        {t.belgi}{fmt(h.miqdor)} {birlik}
                      </span>
                      {Number(h.uzunlik) > 0 && (
                        <span className="tabular-nums text-slate-700">· {fmt(h.uzunlik)} m</span>
                      )}
                      {Number(h.narx) > 0 && (
                        <span className="text-[11px] text-slate-500 tabular-nums">· {fmt(h.narx)} so'm/{narxBirlik}</span>
                      )}
                      {h.orderNumber ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-semibold">№{h.orderNumber}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {h.izoh || '—'}
                      {h.userLogin && <span className="text-slate-400"> · {h.userLogin}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">{h.ts ? formatDate(h.ts) : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
