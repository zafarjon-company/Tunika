// ============================================================
//  HISOBOT → KASSA (kunlik tushum, to'lov turlari bo'yicha)
// ------------------------------------------------------------
//  Tanlangan kunda qabul qilingan to'lovlar (payment.createdAt
//  bo'yicha), to'lov turiga ko'ra jamlanadi. Dollor → so'mga.
// ============================================================
import React, { useMemo, useState } from 'react';
import { Banknote, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, SectionTitle, StatBox } from '../../components/ui.jsx';
import { fmt } from '../../lib/helpers.js';

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function HisobotKassa({ orders = [] }) {
  const bugun = dayKey(new Date());
  const [kun, setKun] = useState(bugun);

  const data = useMemo(() => {
    const byMethod = new Map();
    let total = 0, soni = 0;
    const zakaslar = new Set();
    orders.forEach((o) => (o.payments || []).forEach((p) => {
      if (!p.createdAt || dayKey(new Date(p.createdAt)) !== kun) return;
      const amt = parseFloat(p.amount) || 0;
      const som = p.method === 'Dollorda' ? amt * (parseFloat(p.rate) || 0) : amt;
      if (som <= 0) return;
      const g = byMethod.get(p.method) || { method: p.method, som: 0, n: 0 };
      g.som += som; g.n += 1; byMethod.set(p.method, g);
      total += som; soni += 1; zakaslar.add(o.id);
    }));
    return { rows: [...byMethod.values()].sort((a, b) => b.som - a.som), total, soni, zakaslar: zakaslar.size };
  }, [orders, kun]);

  function shift(delta) {
    const d = new Date(kun);
    d.setDate(d.getDate() + delta);
    setKun(dayKey(d));
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Banknote}>Kassa — kunlik tushum</SectionTitle>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} title="Oldingi kun"
            className="p-2 rounded-lg border-2 border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={kun} max={bugun} onChange={(e) => setKun(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          <button onClick={() => shift(1)} disabled={kun >= bugun} title="Keyingi kun"
            className="p-2 rounded-lg border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex-shrink-0"><ChevronRight className="w-4 h-4" /></button>
          {kun !== bugun && (
            <button onClick={() => setKun(bugun)}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium flex-shrink-0">Bugun</button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Kunlik tushum" value={data.total} suffix="so'm" color="emerald" />
        <StatBox label="To'lov / zakas" value={`${data.soni} / ${data.zakaslar}`} />
      </div>

      <Card>
        <SectionTitle icon={Wallet}>To'lov turlari bo'yicha</SectionTitle>
        {data.rows.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Bu kuni to'lov qabul qilinmagan</p>
        ) : (
          <div className="space-y-3">
            {data.rows.map((r) => {
              const pct = data.total > 0 ? Math.round((r.som / data.total) * 100) : 0;
              return (
                <div key={r.method}>
                  <div className="flex justify-between items-baseline text-xs mb-1">
                    <span className="text-slate-700">{r.method} <span className="text-slate-400">· {r.n} ta</span></span>
                    <span className="font-semibold tabular-nums text-slate-700">{fmt(r.som)} <span className="text-slate-400">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800">Jami</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">{fmt(data.total)} so'm</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
