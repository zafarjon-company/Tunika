// ============================================================
//  HISOBOT → DASHBOARD (analitika)
// ------------------------------------------------------------
//  Kunlik/oylik tushum, eng ko'p sotilgan tovar, eng faol mijozlar.
//  Grafiklar — kutubxonasiz, CSS bilan.
// ============================================================
import React, { useMemo, useState } from 'react';
import { TrendingUp, CalendarDays, Package, Users, Filter, PieChart, Wallet, Hammer, Download, Coins } from 'lucide-react';
import { Card, SectionTitle, StatBox } from '../../components/ui.jsx';
import { fmt, formatDate } from '../../lib/helpers.js';
import { OY_NOMLARI } from '../../lib/constants.js';
import { itemDisp } from '../sotuv/Zakazlar.jsx';
import { downloadCSV } from '../../lib/eksport.js';
import { Donut, AreaChart } from './charts.jsx';

const STATUS_LABEL = { paid: "To'langan", partial: 'Qisman', unpaid: 'Qarz' };
const HOLAT_LABEL = { jarayon: 'Jarayonda', tayyor: 'Tayyor', yopilgan: 'Yopilgan' };

// Usta donut segmentlari uchun rang palitra
const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#ec4899', '#f97316'];

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Vertikal ustunli mini-grafik
function MiniBars({ data, color = 'bg-slate-900' }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1">
          <div className="w-full flex items-end justify-center flex-1">
            <div className={`w-full max-w-[22px] rounded-t ${color} transition-all`}
              style={{ height: `${d.value > 0 ? Math.max(4, Math.round((d.value / max) * 100)) : 0}%` }}
              title={`${d.full || d.label}: ${fmt(d.value)} so'm`} />
          </div>
          <span className="text-[9px] text-slate-400 truncate w-full text-center leading-none">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// Reyting ro'yxati (gorizontal bar)
function RankList({ rows, empty }) {
  if (!rows.length) return <p className="text-sm text-slate-400 text-center py-2">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex justify-between items-baseline gap-2 text-xs mb-1">
            <span className="truncate text-slate-700"><span className="text-slate-400 font-semibold">{i + 1}.</span> {r.label}{r.sub ? <span className="text-slate-400"> · {r.sub}</span> : ''}</span>
            <span className="font-semibold tabular-nums text-slate-700 flex-shrink-0">{fmt(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${Math.round((r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HisobotDashboard({ orders = [] }) {
  const [from, setFrom] = useState('');  // YYYY-MM-DD ('' = ochiq)
  const [to, setTo] = useState('');
  const [usta, setUsta] = useState('');  // '' = barcha ustalar

  // Ustalar ro'yxati (barcha zakaslardan, barqaror)
  const ustaList = useMemo(
    () => [...new Set(orders.map((o) => (o.masterName || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [orders],
  );

  const data = useMemo(() => {
    const now = new Date();
    // sana oralig'i + usta bo'yicha filtr (dayKey leksikografik taqqoslanadi)
    const fil = orders.filter((o) => {
      const dk = dayKey(new Date(o.createdAt));
      if (from && dk < from) return false;
      if (to && dk > to) return false;
      if (usta && (o.masterName || '').trim() !== usta) return false;
      return true;
    });

    let tushum = 0, umumiy = 0, qarz = 0;
    let sotuv = 0, foyda = 0; // tovarlar sotuvi va undagi sof foyda (tan narxdan)
    const oyMap = {};   // 'YYYY-MM' -> tushum
    const kunMap = {};  // 'YYYY-MM-DD' -> tushum
    const tovarMap = new Map();
    const mijozMap = new Map();
    const holatCount = { jarayon: 0, tayyor: 0, yopilgan: 0 };
    const payCount = { paid: 0, partial: 0, unpaid: 0 };
    const ustaMap = new Map();

    fil.forEach((o) => {
      const d = new Date(o.createdAt);
      const paid = o.totalPaid || 0;
      tushum += paid; umumiy += o.totalSum || 0; qarz += o.debt || 0;
      oyMap[monKey(d)] = (oyMap[monKey(d)] || 0) + paid;
      kunMap[dayKey(d)] = (kunMap[dayKey(d)] || 0) + paid;
      // holat taqsimoti
      const h = o.holat || 'jarayon';
      if (holatCount[h] != null) holatCount[h] += 1;
      // to'lov holati (status yo'q bo'lsa qarz/to'lovdan keltirib chiqaramiz)
      const st = o.status || (o.debt <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'));
      if (payCount[st] != null) payCount[st] += 1;
      // usta bo'yicha tushum
      const un = (o.masterName || '—').trim() || '—';
      ustaMap.set(un, (ustaMap.get(un) || 0) + paid);
      (o.items || []).forEach((it) => {
        const disp = itemDisp(it);
        const g = tovarMap.get(disp.nomi) || { label: disp.nomi, value: 0 };
        g.value += it.jamiSumma || 0;
        tovarMap.set(disp.nomi, g);
        // foyda = sotilgan − tan narx (tanNarx yo'q bo'lsa — eski zakas, foyda 0)
        const sold = it.jamiSumma || 0;
        const cost = it.tanNarx != null ? it.tanNarx : sold;
        sotuv += sold; foyda += sold - cost;
      });
      const nm = (o.customer?.name || '—').trim() || '—';
      const m = mijozMap.get(nm) || { label: nm, value: 0, n: 0 };
      m.value += o.totalSum || 0; m.n += 1;
      mijozMap.set(nm, m);
    });

    // oxirgi 6 oy
    const oylar = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      oylar.push({ label: OY_NOMLARI[d.getMonth()].slice(0, 3), full: `${OY_NOMLARI[d.getMonth()]} ${d.getFullYear()}`, value: oyMap[monKey(d)] || 0 });
    }
    // oxirgi 14 kun
    const kunlar = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      kunlar.push({ label: pad2(d.getDate()), full: dayKey(d), value: kunMap[dayKey(d)] || 0 });
    }

    const topTovar = [...tovarMap.values()].sort((a, b) => b.value - a.value).slice(0, 6);
    const topMijoz = [...mijozMap.values()].sort((a, b) => b.value - a.value).slice(0, 6)
      .map((m) => ({ label: m.label, value: m.value, sub: `${m.n} ta` }));

    // usta bo'yicha tushum — yuqori 7 ta, palitra ranglarda
    const ustaIncome = [...ustaMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .filter((u) => u.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
      .map((u, i) => ({ ...u, color: PALETTE[i % PALETTE.length] }));

    return { count: fil.length, tushum, umumiy, qarz, sotuv, foyda, oylar, kunlar, topTovar, topMijoz, holatCount, payCount, ustaIncome };
  }, [orders, from, to, usta]);

  // tezkor oraliqlar
  function preset(kind) {
    const t = new Date();
    if (kind === 'all') { setFrom(''); setTo(''); }
    else if (kind === 'today') { const k = dayKey(t); setFrom(k); setTo(k); }
    else if (kind === '7') { setFrom(dayKey(addDays(t, -6))); setTo(dayKey(t)); }
    else if (kind === '30') { setFrom(dayKey(addDays(t, -29))); setTo(dayKey(t)); }
    else if (kind === 'month') { setFrom(`${t.getFullYear()}-${pad2(t.getMonth() + 1)}-01`); setTo(dayKey(t)); }
  }
  const presets = [
    { k: 'today', label: 'Bugun' }, { k: '7', label: '7 kun' },
    { k: '30', label: '30 kun' }, { k: 'month', label: 'Shu oy' }, { k: 'all', label: 'Hammasi' },
  ];

  // Tanlangan filtr (sana + usta) bo'yicha zakaslarni Excel/CSV ga eksport
  function exportExcel() {
    const fil = orders.filter((o) => {
      const dk = dayKey(new Date(o.createdAt));
      if (from && dk < from) return false;
      if (to && dk > to) return false;
      if (usta && (o.masterName || '').trim() !== usta) return false;
      return true;
    });
    const headers = ['№', 'Sana', 'Mijoz', 'Telefon', 'Manzil', 'Usta', 'Holat', "To'lov", 'Jami', "To'langan", 'Qarz'];
    const rows = fil.map((o) => [
      o.number, formatDate(o.createdAt), o.customer?.name || '',
      (o.customer?.phones || []).filter(Boolean).join(' '), o.customer?.address || '',
      o.masterName || '', HOLAT_LABEL[o.holat || 'jarayon'] || '', STATUS_LABEL[o.status] || '',
      Math.round(o.totalSum || 0), Math.round(o.totalPaid || 0), Math.round(o.debt || 0),
    ]);
    const nom = `dashboard${from ? '_' + from : ''}${to ? '_' + to : ''}${usta ? '_' + usta.replace(/\s+/g, '-') : ''}.csv`;
    downloadCSV(nom, headers, rows);
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Filter}>Sana oralig'i</SectionTitle>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button key={p.k} onClick={() => preset(p.k)}
              className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 hover:border-slate-400">{p.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Dan</label>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Gacha</label>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
        </div>
        {ustaList.length > 0 && (
          <div className="mt-2">
            <label className="block text-[11px] text-slate-500 mb-1">Usta</label>
            <select value={usta} onChange={(e) => setUsta(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none bg-white text-sm">
              <option value="">Barcha ustalar</option>
              {ustaList.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
        <button onClick={exportExcel} disabled={data.count === 0}
          className="mt-3 w-full py-2.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Excel'ga eksport ({data.count} ta)
        </button>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Davr tushumi" value={data.tushum} suffix="so'm" color="emerald" />
        <StatBox label="Zakaslar" value={data.count} />
        <StatBox label="Umumiy summa" value={data.umumiy} suffix="so'm" />
        <StatBox label="Qarz" value={data.qarz} suffix="so'm" color="amber" />
      </div>

      {/* Sof foyda (tovarlardan, tan narx = optom) */}
      <Card>
        <SectionTitle icon={Coins}>Sof foyda (tovarlardan)</SectionTitle>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xl font-bold text-emerald-700 tabular-nums truncate">{fmt(data.foyda)} so'm</div>
            <div className="text-xs text-slate-500 mt-0.5">Sotuv: {fmt(data.sotuv)} so'm</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-extrabold text-emerald-600 tabular-nums leading-none">{data.sotuv > 0 ? Math.round((data.foyda / data.sotuv) * 100) : 0}%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">margin (foyda ulushi)</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Tan narx = optom narx. Tan narxsiz eski zakaslar foydaga 0 hissa qo'shadi.</p>
      </Card>

      <Card>
        <SectionTitle icon={TrendingUp}>Oylik tushum (6 oy)</SectionTitle>
        <MiniBars data={data.oylar} color="bg-emerald-500" />
      </Card>

      <Card>
        <SectionTitle icon={CalendarDays}>Kunlik tushum oqimi (14 kun)</SectionTitle>
        <AreaChart data={data.kunlar} />
      </Card>

      {/* Doira diagrammalar — holat va to'lov taqsimoti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={PieChart}>Holat taqsimoti</SectionTitle>
          {data.count === 0 ? <p className="text-sm text-slate-400 text-center py-2">Ma'lumot yo'q</p> : (
            <Donut centerLabel="zakas" segments={[
              { label: 'Jarayonda', value: data.holatCount.jarayon, color: '#3b82f6' },
              { label: 'Tayyor', value: data.holatCount.tayyor, color: '#10b981' },
              { label: 'Yopilgan', value: data.holatCount.yopilgan, color: '#94a3b8' },
            ]} />
          )}
        </Card>
        <Card>
          <SectionTitle icon={Wallet}>To'lov holati</SectionTitle>
          {data.count === 0 ? <p className="text-sm text-slate-400 text-center py-2">Ma'lumot yo'q</p> : (
            <Donut centerLabel="zakas" segments={[
              { label: "To'langan", value: data.payCount.paid, color: '#10b981' },
              { label: 'Qisman', value: data.payCount.partial, color: '#f59e0b' },
              { label: 'Qarzdor', value: data.payCount.unpaid, color: '#ef4444' },
            ]} />
          )}
        </Card>
      </div>

      {data.ustaIncome.length > 1 && (
        <Card>
          <SectionTitle icon={Hammer}>Usta bo'yicha tushum</SectionTitle>
          <RankList rows={data.ustaIncome} empty="Ma'lumot yo'q" />
        </Card>
      )}

      <Card>
        <SectionTitle icon={Package}>Eng ko'p sotilgan tovarlar</SectionTitle>
        <RankList rows={data.topTovar} empty="Ma'lumot yo'q" />
      </Card>

      <Card>
        <SectionTitle icon={Users}>Eng faol mijozlar</SectionTitle>
        <RankList rows={data.topMijoz} empty="Ma'lumot yo'q" />
      </Card>
    </div>
  );
}
