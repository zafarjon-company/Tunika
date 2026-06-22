// ============================================================
//  KAZIROK — savdo "Tovarlar" bo'limidagi avtomatik (read-only) blok
//  ------------------------------------------------------------
//  Chizma bo'limida hisoblangan Patalok/Paloska bo'laklari shu yerda
//  AVTOMATIK ko'rinadi (tahrirlab bo'lmaydi). Har qator yopiq turganda
//  asosiy ma'lumot (offset, dona, List, eni), ochilganda chizma bo'limidagi
//  detal chizmasi ko'rinadi. Eng pastda — qaysi Listdan necha metr ketgani,
//  1 metr narxi (tahrirlanadi, List narxidan avtomatik) va 25% xizmat haqi.
//
//  Holat (kazData + narx) App.jsx da turadi — shu blok ham, o'ng tomondagi
//  "Hisob-kitob va To'lov" jadvali ham bir manbadan oziqlanadi (sinxron).
//  Manba: chizmaEngine `chizma:kazirok` hodisasi / localStorage.
// ============================================================
import React, { useState } from 'react';
import { ChevronDown, Ruler, Layers } from 'lucide-react';
import { fmt, rangTozala } from '../../lib/helpers.js';

export const KAZ_NARX_KEY = 'kazirok-narx-v1'; // { [listId]: 1 metr narxi (qo'lda tahrir) }
export function readKazNarx() { try { return JSON.parse(localStorage.getItem(KAZ_NARX_KEY)) || {}; } catch (e) { return {}; } }
export function saveKazNarx(o) { try { localStorage.setItem(KAZ_NARX_KEY, JSON.stringify(o)); } catch (e) { /* noop */ } }

export const KAZ_SERVICE = 0.25; // xizmat haqi = material qiymatining 25% i

// Chizmadan kelgan payloadni — bir xil List bo'yicha yig'ib — narx/xizmat
// qatorlariga aylantiradi. Sof funksiya: App.jsx (umumiy hisob) ham, shu blok ham
// SHUNI ishlatadi. jami = material + 25% (xizmat). Tahrirlanadigan 1 m narxi
// `narx[listId]` (bo'lmasa List optom narxi).
export function computeKazRows(data, tunikaBaza = [], narx = {}) {
  const groups = (data && data.groups) || [];
  const listById = (id) => tunikaBaza.find((t) => String(t.id) === String(id)) || null;
  const optom = (id) => { const t = listById(id); return t ? (Number(t.optom) || 0) : 0; };
  const eff = (id) => { const ov = narx[id]; return (ov != null && ov !== '') ? (Number(ov) || 0) : optom(id); };

  const per = new Map(); // listId -> { metr, pat:Set(eni), pal:Set(eni) } (patalok + paloska birga)
  let totalDona = 0;
  for (const g of groups) {
    for (const kind of ['pat', 'pal']) {
      const it = g[kind];
      if (!it) continue;
      totalDona += it.count;
      const id = it.listId || '';
      let e = per.get(id);
      if (!e) { e = { metr: 0, pat: new Set(), pal: new Set() }; per.set(id, e); }
      e.metr += it.meters;
      e[kind].add(+it.eni);
    }
  }
  // Eni o'lchamlari yorlig'i: masalan "Patalok 62.5 lik · Paloska 7.75 lik"
  const sizeStr = (set) => [...set].sort((a, b) => b - a).map((v) => (+v.toFixed(2)) + ' lik').join(', ');
  const rows = [...per.entries()].map(([id, e]) => {
    const t = listById(id);
    const price = eff(id);
    const material = e.metr * price;
    const segs = [];
    if (e.pat.size) segs.push('Patalok ' + sizeStr(e.pat));
    if (e.pal.size) segs.push('Paloska ' + sizeStr(e.pal));
    return {
      id, listNom: t ? t.nomi : 'List tanlanmagan', rang: t ? (t.rang || rangTozala(t.nomi)) : '',
      sizeLabel: segs.join(' · '), metr: e.metr, price,
      material, xizmat: material * KAZ_SERVICE, jami: material * (1 + KAZ_SERVICE),
    };
  });
  return {
    rows, totalDona,
    totalMaterial: rows.reduce((s, r) => s + r.material, 0),
    totalXizmat: rows.reduce((s, r) => s + r.xizmat, 0),
    totalJami: rows.reduce((s, r) => s + r.jami, 0),
  };
}

export function KazirokSavdo({ data, rows = [], tunikaBaza = [], narx = {}, onPrice }) {
  const [open, setOpen] = useState({}); // qator kaliti -> ochiqmi
  const groups = (data && data.groups) || [];
  if (!groups.length) return null; // chizmada kazirok yo'q — blok ham yo'q

  const listById = (id) => tunikaBaza.find((t) => String(t.id) === String(id)) || null;
  const listNom = (id) => { const t = listById(id); return t ? t.nomi : 'List tanlanmagan'; };
  const optom = (id) => { const t = listById(id); return t ? (Number(t.optom) || 0) : 0; };
  const narxInputVal = (id) => (narx[id] !== undefined ? narx[id] : String(optom(id) || ''));
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const totalDona = groups.reduce((s, g) => s + (g.pat?.count || 0) + (g.pal?.count || 0), 0);
  const jamiMaterial = rows.reduce((s, r) => s + r.material, 0);
  const jamiXizmat = rows.reduce((s, r) => s + r.xizmat, 0);

  // Bitta detal qatori (patalok yoki paloska)
  const detRow = (g, kind) => {
    const it = g[kind];
    if (!it) return null;
    const k = g.offCm + ':' + kind;
    const isOpen = !!open[k];
    const nomi = kind === 'pat' ? 'Patalok' : 'Paloska';
    return (
      <div key={k} className={`border rounded-xl bg-white overflow-hidden transition-colors ${isOpen ? 'border-slate-900' : 'border-slate-200'}`}>
        <button type="button" onClick={() => toggle(k)}
          className="w-full flex items-center gap-2 p-2.5 text-left">
          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${kind === 'pat' ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'}`}>
            {it.count}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-sm text-slate-800 leading-tight">{nomi}</span>
            <span className="block text-[11px] text-slate-500 truncate">
              Chiqishi {g.offCm} sm · {it.count} dona · {listNom(it.listId)} · eni {it.eni} sm
            </span>
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums hidden sm:inline mr-1">{it.meters.toFixed(2)} m</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="px-3 pb-3 pt-1 border-t border-slate-200/70 space-y-2">
            {/* Chizma bo'limidagidek detal chizmasi (faqat ko'rinish) */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 flex justify-center text-slate-700 max-h-[300px] overflow-auto"
              dangerouslySetInnerHTML={{ __html: it.svg }} />
            {/* Asosiy razmerlar (read-only) */}
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <Fact label="Eni" val={it.eni + ' sm'} />
              <Fact label="Peshona" val={it.peshona + ' sm'} />
              <Fact label="Razmeri" val={it.razmeri + ' sm'} />
              <Fact label="Bo'lak" val={it.bolak + ' ta'} />
              <Fact label="1 bo'lak" val={(it.pieceLenCm / 100).toFixed(2) + ' m'} />
              <Fact label="List metri" val={it.meters.toFixed(2) + ' m'} />
            </div>
            {kind === 'pat' && it.fold && (
              <div className="text-[11px] text-slate-500">Orqasi qayrilgan (pastdan +1.5 sm)</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-2.5 sm:p-3">
      {/* Sarlavha */}
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
          <Ruler className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-slate-800 leading-tight">Kazirok</div>
          <div className="text-[11px] text-slate-500">Chizmadan avtomatik · {totalDona} dona · {groups.length} chiqish</div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">
          avtomatik
        </span>
      </div>

      {/* Detal qatorlari (patalok + paloska) */}
      <div className="space-y-2">
        {groups.flatMap((g) => [detRow(g, 'pat'), detRow(g, 'pal')]).filter(Boolean)}
      </div>

      {/* ----- Material va xizmat hisobi (eng pastda) ----- */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-600">Material va xizmat</span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id || '—'} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="min-w-0">
                  <span className="block font-semibold text-xs text-slate-800 truncate">{r.listNom}</span>
                  {r.sizeLabel && <span className="block text-[10px] text-slate-400 truncate">{r.sizeLabel}</span>}
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums flex-shrink-0">{r.metr.toFixed(2)} m</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input type="text" inputMode="decimal" value={narxInputVal(r.id)}
                    onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                    onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v) || v === '') onPrice && onPrice(r.id, v); }}
                    className="w-28 px-2 py-1.5 border-2 border-slate-200 rounded-lg bg-white tabular-nums text-xs outline-none focus:border-slate-900 transition" />
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">so'm / m</span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 tabular-nums leading-tight">{fmt(r.material)} so'm</div>
                  <div className="text-xs font-bold text-emerald-700 tabular-nums leading-tight">xizmat: {fmt(r.xizmat)} so'm</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Jami */}
        <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            Material: <span className="tabular-nums font-medium text-slate-600">{fmt(jamiMaterial)}</span> so'm
          </div>
          <div className="text-sm font-extrabold text-emerald-700 tabular-nums">
            Jami xizmat: {fmt(jamiXizmat)} so'm
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, val }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
      <div className="text-[10px] text-slate-400 leading-tight">{label}</div>
      <div className="text-xs font-semibold text-slate-700 tabular-nums leading-tight">{val}</div>
    </div>
  );
}
