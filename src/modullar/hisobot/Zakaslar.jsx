// ============================================================
//  HISOBOT → ZAKASLAR
// ------------------------------------------------------------
//  Umumiy ko'rsatkichlar + holat va to'lov bo'yicha taqsimot.
// ============================================================
import React from 'react';
import { FileText, ClipboardList, Wallet, Clock, Hourglass, CheckCircle2, Lock, Timer, Truck, Package } from 'lucide-react';
import { Card, SectionTitle, StatBox, KanyokImg, TeskariBadge } from '../../components/ui.jsx';
import { fmt, formatMs, rangHex, rangMatn } from '../../lib/helpers.js';
import { itemDisp } from '../sotuv/Zakazlar.jsx';

// O'rtacha davomiylik (ms). from/to — order maydonlari nomi.
function avgMs(orders, fromKey, toKey) {
  const lar = orders
    .map((o) => (o[fromKey] && o[toKey] ? new Date(o[toKey]) - new Date(o[fromKey]) : null))
    .filter((m) => m != null && m >= 0);
  if (lar.length === 0) return { ms: null, n: 0 };
  return { ms: lar.reduce((s, m) => s + m, 0) / lar.length, n: lar.length };
}

function Bar({ label, val, total, cls }) {
  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-700">{val} <span className="text-slate-400">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function HisobotZakaslar({ orders = [] }) {
  const n = orders.length;
  const jamiSumma = orders.reduce((s, o) => s + (o.totalSum || 0), 0);
  const tushum = orders.reduce((s, o) => s + (o.totalPaid || 0), 0);
  const qarz = orders.reduce((s, o) => s + (o.debt || 0), 0);

  const holat = (h) => orders.filter((o) => (o.holat || 'jarayon') === h).length;
  const pay = (s) => orders.filter((o) => o.status === s).length;

  // Vaqt o'rtachalari
  const tayyorAvg = avgMs(orders, 'createdAt', 'tayyorAt');   // qabuldan tayyorgacha
  const chiqdiAvg = avgMs(orders, 'tayyorAt', 'yopilganAt');  // tayyordan chiqishgacha
  const jamiAvg   = avgMs(orders, 'createdAt', 'yopilganAt'); // qabuldan chiqishgacha

  // Tovar turlari bo'yicha jamlash (nomi + tafsilot + rang + teskari quloq)
  const tovarlar = (() => {
    const map = new Map();
    orders.forEach((o) => (o.items || []).forEach((it) => {
      const d = itemDisp(it);
      const key = `${d.nomi}||${d.tafsilot}||${it.rang || ''}||${it.teskariQuloq ? 1 : 0}`;
      let g = map.get(key);
      if (!g) { g = { it, nomi: d.nomi, tafsilot: d.tafsilot, metr: 0, dona: 0, kg: 0, jami: 0, lines: 0 }; map.set(key, g); }
      const soni = parseFloat(it.soni) || 0;
      const uz = parseFloat(it.uzunlik) || 0;
      if (it.kind === 'aksessuar') { if ((it.birlik || 'dona') === 'kg') g.kg += soni; else g.dona += soni; }
      else if (it.kind === 'metrli') { g.metr += uz; }
      else { g.metr += uz * soni; g.dona += soni; }
      g.jami += (it.jamiSumma || 0);
      g.lines += 1;
    }));
    return [...map.values()].sort((a, b) => b.jami - a.jami);
  })();
  const miqdorStr = (g) => {
    const p = [];
    if (g.dona) p.push(`${fmt(g.dona)} dona`);
    if (g.metr) p.push(`${(Math.round(g.metr * 10) / 10).toLocaleString('uz-UZ')} m`);
    if (g.kg) p.push(`${(Math.round(g.kg * 10) / 10).toLocaleString('uz-UZ')} kg`);
    return p.join(' · ') || '—';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Zakaslar" value={n} />
        <StatBox label="Tushum" value={tushum} suffix="so'm" color="emerald" />
        <StatBox label="Qarz" value={qarz} suffix="so'm" color="amber" />
      </div>

      <Card>
        <SectionTitle icon={FileText}>Umumiy aylanma</SectionTitle>
        <div className="flex justify-between items-center rounded-xl border-2 border-slate-900 p-3">
          <span className="text-sm font-semibold text-slate-700">Umumiy summa</span>
          <b className="text-xl tabular-nums text-slate-900">{fmt(jamiSumma)} so'm</b>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Package}>Sotilgan tovarlar (jamlangan)</SectionTitle>
        {tovarlar.length === 0 ? <p className="text-sm text-slate-400 text-center py-2">Zakaslar yo'q</p> : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[500px] text-xs">
              <thead>
                <tr className="text-left text-[11px] text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-2 font-semibold">Nomi</th>
                  <th className="py-1.5 px-1 font-semibold text-center">Razmeri</th>
                  <th className="py-1.5 px-1 font-semibold">Rang</th>
                  <th className="py-1.5 px-1 font-semibold text-right">Miqdor</th>
                  <th className="py-1.5 px-1 font-semibold text-right">Marta</th>
                  <th className="py-1.5 pl-1 font-semibold text-right">Jami (so'm)</th>
                </tr>
              </thead>
              <tbody>
                {tovarlar.map((g, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium text-slate-800 flex items-center gap-1">{g.nomi}<TeskariBadge item={g.it} /></div>
                      <div className="text-[11px] text-slate-500">{g.tafsilot}</div>
                    </td>
                    <td className="py-1.5 px-1 text-center"><KanyokImg item={g.it} size="w-14 h-9" /></td>
                    <td className="py-1.5 px-1">
                      {g.it.rang
                        ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-black/10 whitespace-nowrap" style={{ background: rangHex(g.it.rang), color: rangMatn(g.it.rang) }}>{g.it.rang}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-1.5 px-1 text-right tabular-nums whitespace-nowrap text-slate-700">{miqdorStr(g)}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums text-slate-500">{g.lines}</td>
                    <td className="py-1.5 pl-1 text-right tabular-nums whitespace-nowrap font-semibold text-slate-900">{fmt(g.jami)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={ClipboardList}>Holat bo'yicha</SectionTitle>
        {n === 0 ? <p className="text-sm text-slate-400 text-center py-2">Zakaslar yo'q</p> : (
          <div className="space-y-3">
            <Bar label={<span className="inline-flex items-center gap-1"><Hourglass className="w-3 h-3" /> Jarayonda</span>} val={holat('jarayon')} total={n} cls="bg-blue-500" />
            <Bar label={<span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Tayyor</span>} val={holat('tayyor')} total={n} cls="bg-emerald-500" />
            <Bar label={<span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Yopilgan</span>} val={holat('yopilgan')} total={n} cls="bg-slate-400" />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={Clock}>O'rtacha vaqt</SectionTitle>
        {tayyorAvg.n === 0 && chiqdiAvg.n === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">Hali vaqt o'lchanmagan (zakaslarni "Tayyor" / "Chiqib ketti" qiling)</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                <div className="text-[11px] text-emerald-700 mb-0.5 flex items-center justify-center gap-1"><Timer className="w-3 h-3" /> O'rtacha tayyorlanish</div>
                <div className="font-bold text-emerald-800">{tayyorAvg.ms != null ? formatMs(tayyorAvg.ms) : '—'}</div>
                <div className="text-[10px] text-emerald-600/70">{tayyorAvg.n} ta zakas</div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                <div className="text-[11px] text-slate-500 mb-0.5 flex items-center justify-center gap-1"><Truck className="w-3 h-3" /> O'rtacha chiqib ketish</div>
                <div className="font-bold text-slate-700">{chiqdiAvg.ms != null ? formatMs(chiqdiAvg.ms) : '—'}</div>
                <div className="text-[10px] text-slate-400">{chiqdiAvg.n} ta zakas</div>
              </div>
            </div>
            <div className="flex justify-between items-center rounded-xl border-2 border-slate-900 p-3">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Hourglass className="w-4 h-4" /> Qabuldan chiqishgacha (o'rtacha)</span>
              <b className="text-base text-slate-900">{jamiAvg.ms != null ? formatMs(jamiAvg.ms) : '—'}</b>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={Wallet}>To'lov bo'yicha</SectionTitle>
        {n === 0 ? <p className="text-sm text-slate-400 text-center py-2">Zakaslar yo'q</p> : (
          <div className="space-y-3">
            <Bar label="To'langan" val={pay('paid')} total={n} cls="bg-emerald-500" />
            <Bar label="Qisman to'langan" val={pay('partial')} total={n} cls="bg-amber-500" />
            <Bar label="Qarzdor" val={pay('unpaid')} total={n} cls="bg-red-500" />
          </div>
        )}
      </Card>
    </div>
  );
}
