// ============================================================
//  ZAKASLAR KO'RINISHI TABI (+ bitta zakas kartasi)
// ============================================================
import React, { useState } from 'react';
import { Trash2, Printer, FileText, Search, Wallet, MapPin, Download, Calculator, Hourglass, CheckCircle2, Lock, PackageCheck, Undo2, RotateCcw, Timer, Truck, SlidersHorizontal, ArrowDownUp, MessageCircle, Edit3 } from 'lucide-react';
import { Card, SectionTitle, StatBox, KanyokImg, TeskariBadge, rangChipStyle } from '../../components/ui.jsx';
import { fmt, formatDate, formatDuration } from '../../lib/helpers.js';
import { downloadCSV } from '../../lib/eksport.js';
import { kazRowNom } from './KazirokSavdo.jsx';

function RangChip({ rang }) {
  if (!rang) return <span className="text-slate-400">—</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-black/10 whitespace-nowrap" style={rangChipStyle(rang)}>{rang}</span>;
}

const STATUS_LABEL = { paid: "To'langan", partial: 'Qisman', unpaid: 'Qarz' };

// Zakas qatorini ko'rsatish uchun normallashtirish (yangi + eski format)
// Narx turini (Chakana/Optom) tafsilotdan olib tashlash — chek va ro'yxatda ko'rinmaydi
const stripNarxTuri = (s) => (s || '').replace(/\s*\((Optom|Chakana)\)/g, '').trim();

export function itemDisp(it) {
  if (it.nomi !== undefined) {
    const zapas = parseFloat(it.zapas) || 0;
    const olchov = (it.kind === 'aksessuar' || it.kind === 'kazirok')
      ? `${it.soni} ${it.birlik || 'dona'}`
      : it.kind === 'metrli'
        ? `${it.jamiMeyor || it.uzunlik || 0} metr`
        : `${it.uzunlik || 0} metr × ${it.soni} dona`;
    return { nomi: it.nomi, tafsilot: stripNarxTuri(it.tafsilot), olchov, jami: it.jamiSumma };
  }
  // eski format
  const olchov = it.productUnit === 'kvadrat' ? `${it.uzunlik}x${it.eni}x${it.soni}` : `${it.uzunlik}x${it.soni}`;
  return {
    nomi: it.tunikaName,
    tafsilot: `${it.productName || ''} ${it.bolishLabel || ''}`.trim(),
    olchov, jami: it.jamiSumma,
  };
}

const holatOf = (o) => o.holat || 'jarayon';
// "Hisob" (xom chot) = umuman to'lov berilmagan zakas. Statistikaga qo'shilmaydi.
const isHisob = (o) => (o.totalPaid || 0) <= 0;

export function OrdersTab({ orders, usdRate, usdOlish, onPay, onDelete, onReceipt, onHolat, onEdit, canDelete = true, shopName = '' }) {
  const [holatF, setHolatF] = useState('all');
  const [faqatQarz, setFaqatQarz] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('yangi'); // yangi | eski | summa | qarz

  const filtered = orders.filter((o) => {
    if (holatF === 'hisob') { if (!isHisob(o)) return false; }
    else if (holatF !== 'all') {
      // jarayon/tayyor/yopilgan — xom hisoblar bu yerda ko'rinmaydi
      if (isHisob(o)) return false;
      if (holatOf(o) !== holatF) return false;
    }
    if (faqatQarz && o.debt === 0) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (o.customer.name || '').toLowerCase().includes(q)
        || (o.customer.address || '').toLowerCase().includes(q)
        || (o.masterName || '').toLowerCase().includes(q)
        || String(o.number).includes(q);
    }
    return true;
  });

  // Saralash (yangi standart)
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'eski') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sort === 'summa') return (b.totalSum || 0) - (a.totalSum || 0);
    if (sort === 'qarz') return (b.debt || 0) - (a.debt || 0);
    return new Date(b.createdAt) - new Date(a.createdAt); // yangi
  });

  // Sanoqlar: holat tablari faqat haqiqiy (to'lov bo'lgan) zakaslarni sanaydi
  const hisobN = orders.filter(isHisob).length;
  const soni = { jarayon: 0, tayyor: 0, yopilgan: 0 };
  orders.forEach((o) => { if (!isHisob(o)) soni[holatOf(o)] = (soni[holatOf(o)] || 0) + 1; });

  // Statistika — faqat haqiqiy zakaslar (xom hisoblar qo'shilmaydi)
  const real = orders.filter((o) => !isHisob(o));
  const statTushum = real.reduce((s, o) => s + (o.totalPaid || 0), 0);
  const statQarz = real.reduce((s, o) => s + (o.debt || 0), 0);

  function exportExcel() {
    const headers = ['№', 'Sana', 'Mijoz', 'Telefon', 'Manzil', 'Orientir', 'Usta', 'Jami', "To'langan", 'Qarz', 'Holat'];
    const rows = filtered.map((o) => [
      o.number, formatDate(o.createdAt), o.customer.name,
      (o.customer.phones || []).filter(Boolean).join(' '), o.customer.address || '', o.customer.orientir || '',
      o.masterName || '', Math.round(o.totalSum), Math.round(o.totalPaid || 0),
      Math.round(o.debt), STATUS_LABEL[o.status] || '',
    ]);
    downloadCSV('zakaslar.csv', headers, rows);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] gap-4 items-start">
      {/* ===================== CHAP: sticky filtr + statistika ===================== */}
      <aside className="lg:sticky lg:top-36 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Zakaslar" value={real.length} />
          <StatBox label="Tushum" value={statTushum} suffix="so'm" color="emerald" />
          <StatBox label="Qarz" value={statQarz} suffix="so'm" color="amber" />
        </div>

        <Card>
          <SectionTitle icon={SlidersHorizontal}>Filtr</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { k: 'all',      label: 'Hammasi',     n: orders.length },
              { k: 'hisob',    label: 'Hisoblashdi', n: hisobN },
              { k: 'jarayon',  label: 'Jarayonda',   n: soni.jarayon },
              { k: 'tayyor',   label: 'Tayyor',      n: soni.tayyor },
              { k: 'yopilgan', label: 'Yopilgan',    n: soni.yopilgan },
            ].map(({ k, label, n }) => (
              <button key={k} onClick={() => setHolatF(k)}
                className={`px-2 py-2.5 rounded-lg text-sm font-medium border-2 flex items-center justify-center gap-1.5 ${
                  holatF === k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                {label}
                <span className={`text-xs px-1.5 rounded-full ${holatF === k ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{n}</span>
              </button>
            ))}
          </div>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Mijoz, manzil, usta yoki raqam..."
              className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0"><ArrowDownUp className="w-3.5 h-3.5" /> Saralash</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="flex-1 min-w-0 px-2 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none bg-white text-sm">
              <option value="yangi">Avval yangi</option>
              <option value="eski">Avval eski</option>
              <option value="summa">Katta summa</option>
              <option value="qarz">Ko'p qarz</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setFaqatQarz((v) => !v)}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border-2 ${
                faqatQarz ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>Faqat qarzdor</button>
            {orders.length > 0 && (
              <button onClick={exportExcel} title="Excelga yuklash"
                className="px-3 py-2.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <Download className="w-4 h-4" /> Excel
              </button>
            )}
          </div>
        </Card>
      </aside>

      {/* ===================== O'NG: zakaslar ro'yxati ===================== */}
      <div className="space-y-3 min-w-0">
        {sorted.length === 0 ? (
          <Card><div className="text-center py-8 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-2 opacity-40" /><p>Zakaslar topilmadi</p></div></Card>
        ) : (
          sorted.map((o) => <OrderCard key={o.id} order={o} usdRate={usdRate} usdOlish={usdOlish} onPay={() => onPay(o)} onDelete={() => onDelete(o)} onReceipt={() => onReceipt(o)} onHolat={onHolat} onEdit={onEdit ? () => onEdit(o) : null} canDelete={canDelete} shopName={shopName} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, usdRate, usdOlish, onPay, onDelete, onReceipt, onHolat, onEdit, canDelete = true, shopName = '' }) {
  // Mijozga WhatsApp xabar (tayyor bo'lganda — "olib ketishingiz mumkin")
  function mijozTel() {
    const raw = (order.customer?.phones || []).filter(Boolean)[0] || '';
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('998')) return d;
    if (d.length === 9) return `998${d}`;
    return d;
  }
  function xabarYubor() {
    const h = order.holat || 'jarayon';
    const holatMatn = h === 'tayyor' ? "tayyor bo'ldi, olib ketishingiz mumkin"
      : h === 'yopilgan' ? 'topshirildi'
      : 'qabul qilindi';
    const L = [`Assalomu alaykum${order.customer?.name ? ', ' + order.customer.name : ''}!`,
      `Zakasingiz № ${order.number} ${holatMatn}.`];
    if (order.debt > 0) L.push(`Qoldiq qarz: ${fmt(order.debt)} so'm.`);
    if (shopName) L.push(shopName);
    const text = encodeURIComponent(L.join('\n'));
    const tel = mijozTel();
    window.open(tel ? `https://wa.me/${tel}?text=${text}` : `https://wa.me/?text=${text}`, '_blank', 'noopener');
  }
  const [open, setOpen] = useState(false);
  const olishUsd = usdOlish > 0 && order.debt > 0 ? order.debt / usdOlish : 0;
  const sotishUsd = usdRate > 0 && order.debt > 0 ? order.debt / usdRate : 0;
  const statusBadge = {
    paid:    { text: "To'langan", cls: 'bg-emerald-100 text-emerald-800' },
    partial: { text: 'Qisman',    cls: 'bg-amber-100 text-amber-800' },
    unpaid:  { text: 'Qarz',      cls: 'bg-red-100 text-red-800' },
  }[order.status] || { text: 'Noma\'lum', cls: 'bg-slate-100 text-slate-800' };
  const holat = holatOf(order);
  const hisob = (order.totalPaid || 0) <= 0;
  const holatBadge = hisob
    ? { text: 'Hisob (xom)', Icon: Calculator, cls: 'bg-amber-100 text-amber-800' }
    : {
      jarayon:  { text: 'Jarayonda', Icon: Hourglass,    cls: 'bg-blue-100 text-blue-800' },
      tayyor:   { text: 'Tayyor',    Icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800' },
      yopilgan: { text: 'Yopilgan',  Icon: Lock,         cls: 'bg-slate-200 text-slate-600' },
    }[holat];

  return (
    <Card padding="p-0">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4 hover:bg-slate-50/50 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold text-slate-400">Zakas {order.number}</span>
              {holatBadge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${holatBadge.cls}`}><holatBadge.Icon className="w-3 h-3" />{holatBadge.text}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>{statusBadge.text}</span>
              {order.masterName && order.masterName !== 'Boshqa' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">Usta: {order.masterName}</span>
              )}
            </div>
            <div className="font-bold text-slate-900 truncate">{order.customer.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {order.customer.phones?.filter(Boolean).length > 0 && <span>{order.customer.phones.filter(Boolean).join(', ')} · </span>}
              {formatDate(order.createdAt)}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-slate-900 tabular-nums">{fmt(order.totalSum)}</div>
            {order.debt > 0 && (
              <div className="text-xs text-amber-700 font-semibold tabular-nums">
                Qarz: {fmt(order.debt)}
                {(olishUsd > 0 || sotishUsd > 0) && (
                  <span className="block text-slate-400 font-normal">
                    {olishUsd > 0 && <>≈{olishUsd.toFixed(1)}$ olish</>}
                    {sotishUsd > 0 && <> · {sotishUsd.toFixed(1)}$ sotish</>}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/30 space-y-3">
          {(order.customer.address || order.customer.orientir) && (
            <div className="text-sm flex items-start gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>
                {order.customer.address && <>Manzil: {order.customer.address}</>}
                {order.customer.orientir && <>{order.customer.address ? ' · ' : ''}{order.customer.orientir}</>}
              </span>
            </div>
          )}

          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="text-xs text-slate-500 text-left border-b border-slate-200">
                  <th className="py-1.5 font-semibold">Nomi</th>
                  <th className="py-1.5 font-semibold">Rang</th>
                  <th className="py-1.5 font-semibold text-right">O'lchov</th>
                  <th className="py-1.5 font-semibold text-right">Narx</th>
                  <th className="py-1.5 font-semibold text-right">Jami</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => {
                  const d = itemDisp(it);
                  return (
                    <tr key={it.id} className="border-b border-slate-100 text-xs">
                      <td className="py-1.5 pr-2">
                        <div className="text-slate-800 font-medium flex items-center flex-wrap gap-1">{d.nomi}<KanyokImg item={it} size="w-14 h-8" /><TeskariBadge item={it} /></div>
                        <div className="text-slate-500">{d.tafsilot}</div>
                      </td>
                      <td className="py-1.5 pr-2"><RangChip rang={it.rang} /></td>
                      <td className="py-1.5 text-right tabular-nums">{d.olchov}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(it.birBirlikNarxi)} so'm</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(d.jami)}</td>
                    </tr>
                  );
                })}
                {(order.kazRows || []).map((r) => (
                  <tr key={'kaz-' + r.id} className="border-b border-slate-100 text-xs">
                    <td className="py-1.5 pr-2">
                      <div className="text-slate-800 font-medium">{kazRowNom(r)}</div>
                      <div className="text-slate-500">{r.listNom}{r.sizeLabel ? ' · ' + r.sizeLabel : ''}</div>
                    </td>
                    <td className="py-1.5 pr-2"><RangChip rang={r.rang} /></td>
                    <td className="py-1.5 text-right tabular-nums">{(r.metr || 0).toFixed(2)} m</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(r.price)}+25%</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(r.jami)}</td>
                  </tr>
                ))}
                {(order.aksessuarlar || []).map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 text-xs">
                    <td className="py-1.5 pr-2">
                      <div className="text-slate-800 font-medium">{a.nomi}</div>
                      <div className="text-slate-500">Aksessuar</div>
                    </td>
                    <td className="py-1.5 pr-2"><RangChip rang={a.rang} /></td>
                    <td className="py-1.5 text-right tabular-nums">{a.soni} {a.birlik || 'dona'}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(a.narx)} so'm</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">{fmt(a.jami)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {order.payments && order.payments.length > 0 && (
            <div className="bg-white p-3 border border-slate-200 rounded-lg space-y-1 text-xs">
              <span className="font-bold text-slate-700 block mb-1">To'lovlar tarixi:</span>
              {order.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-slate-600 border-b border-slate-100 pb-1 last:border-0">
                  <span>{formatDate(p.createdAt)} - {p.method} {p.notes ? `(${p.notes})` : ''}</span>
                  <span className="font-semibold tabular-nums text-emerald-800">
                    {p.method === 'Dollorda' ? `${p.amount} $` : `${fmt(p.amount)} so'm`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {order.dastafka && (order.dastafka.ichida || order.dastafka.summa > 0) && (
            <div className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-600 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Dastafka xizmati</span>
              <span className="font-semibold text-slate-800">{order.dastafka.ichida ? 'Ichida (narxga kiritilgan)' : `${fmt(order.dastafka.summa)} so'm`}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-sm pt-2 border-t border-slate-200">
            <div><div className="text-xs text-slate-500">Jami</div><div className="font-bold tabular-nums">{fmt(order.totalSum)}</div></div>
            <div><div className="text-xs text-slate-500">To'landi</div><div className="font-bold tabular-nums text-emerald-700">{fmt(order.totalPaid)}</div></div>
            <div><div className="text-xs text-slate-500">Qarz qoldiq</div><div className="font-bold tabular-nums text-amber-700">{fmt(order.debt)}
              {olishUsd > 0 && <span className="block text-[11px] font-normal text-slate-400">≈ {olishUsd.toFixed(1)} $ olish</span>}
              {sotishUsd > 0 && <span className="block text-[11px] font-normal text-slate-400">≈ {sotishUsd.toFixed(1)} $ sotish</span>}
            </div></div>
          </div>

          {order.notes && <div className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded p-2"><b>Izoh:</b> {order.notes}</div>}

          {/* Vaqt: tayyorlanish va chiqib ketish muddati */}
          {(order.tayyorAt || order.yopilganAt) && (
            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-slate-200">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                <div className="text-[11px] text-emerald-700 flex items-center gap-1"><Timer className="w-3 h-3" /> Tayyor bo'ldi</div>
                <div className="font-bold text-emerald-800">{formatDuration(order.createdAt, order.tayyorAt) || '—'}</div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-1"><Truck className="w-3 h-3" /> Chiqib ketdi</div>
                <div className="font-bold text-slate-700">{formatDuration(order.tayyorAt, order.yopilganAt) || '—'}<span className="block text-[10px] font-normal text-slate-400">tayyor bo'lgach</span></div>
              </div>
            </div>
          )}

          {/* Holat boshqaruvi */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
            {holat === 'jarayon' && (
              <button onClick={() => onHolat(order, 'tayyor')} className="flex-1 min-w-[140px] py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Tayyor bo'ldi</button>
            )}
            {holat === 'tayyor' && (
              <>
                <button onClick={() => onHolat(order, 'yopilgan')} className="flex-1 min-w-[140px] py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 flex items-center justify-center gap-1.5"><PackageCheck className="w-4 h-4" /> Chiqib ketti</button>
                <button onClick={() => onHolat(order, 'jarayon')} className="py-2 px-3 rounded-lg border-2 border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-1.5"><Undo2 className="w-4 h-4" /> Jarayonga</button>
              </>
            )}
            {holat === 'yopilgan' && (
              <button onClick={() => onHolat(order, 'jarayon')} className="flex-1 min-w-[140px] py-2 rounded-lg border-2 border-blue-300 text-blue-700 text-sm font-bold hover:bg-blue-50 flex items-center justify-center gap-1.5"><RotateCcw className="w-4 h-4" /> Qayta ochish</button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={onReceipt} className="flex-1 min-w-[120px] py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-1.5"><Printer className="w-4 h-4" /> Chek chiqarish</button>
            <button onClick={xabarYubor} title="Mijozga WhatsApp xabar"
              className={`flex-1 min-w-[120px] py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
                holat === 'tayyor' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}><MessageCircle className="w-4 h-4" /> Xabar</button>
            {order.debt > 0 && <button onClick={onPay} className="flex-1 min-w-[120px] py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 flex items-center justify-center gap-1.5"><Wallet className="w-4 h-4" /> To'lov qo'shish</button>}
            {onEdit && <button onClick={onEdit} aria-label="Zakasni tahrirlash" title="Tahrirlash" className="py-2 px-3 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-1.5"><Edit3 className="w-4 h-4" /></button>}
            {canDelete && <button onClick={onDelete} aria-label="Zakasni o'chirish" title="O'chirish" className="py-2 px-3 rounded-lg border-2 border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /></button>}
          </div>
        </div>
      )}
    </Card>
  );
}
