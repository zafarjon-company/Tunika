// ============================================================
//  SAVDO (YANGI ZAKAS) TABI (+ har bir qator)
//  Qatorlar: tunika / profnastil / metrli / aksessuar (kind bilan).
//  Joylashuv: 2 ustun — chap (mijoz/usta/tovarlar) + o'ng (sticky hisob).
//  Tovar kartochkalari accordion (yopiladigan). Pastda sticky harakat paneli.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Save, ShoppingCart, User, Hammer, Wallet, Package, ChevronRight, ChevronDown,
  Loader2, Check, X, AlertCircle, MapPin, Copy, CopyPlus, Truck, Pencil,
} from 'lucide-react';
import { Card, SectionTitle, SegmentedControl, KanyokImg, TeskariBadge, CountUp, rangChipStyle } from '../../components/ui.jsx';
import { fmt, genId, metrliVariantlar, barchaRanglar, aksRangKerak, rangHex, rangMatn, isKanyokAny, reducedMotion } from '../../lib/helpers.js';
import { STANOK_OPTIONS } from '../../lib/constants.js';
import { matchCombo } from '../../lib/keybind.js';

// Enter bosilganda keyingi maydonga o'tish ("keyingi maydon/tovar")
function focusNextNav(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const navs = Array.from(document.querySelectorAll('.js-nav'));
  const i = navs.indexOf(e.currentTarget);
  if (i >= 0 && i < navs.length - 1) navs[i + 1].focus();
  else e.currentTarget.blur();
}

// Raqamli maydon — inline tekshiruv (qizil chegara + silkinish + izoh)
function NumField({ label, value, onChange, placeholder = '0', hint = "0 dan katta son kiriting", optional = false }) {
  const num = parseFloat(value);
  // optional maydon (masalan Zapas) — bo'sh ham, 0 ham, xohlagan son ham bo'laveradi.
  const invalid = !optional && value !== '' && (Number.isNaN(num) || num <= 0);
  const [shake, setShake] = useState(false);
  const prev = useRef(false);
  useEffect(() => {
    if (invalid && !prev.current && !reducedMotion()) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 360);
      prev.current = invalid;
      return () => clearTimeout(t);
    }
    prev.current = invalid;
    return undefined;
  }, [invalid]);
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type="text" inputMode="decimal" value={value}
        onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()} onKeyDown={focusNextNav}
        onChange={(e) => { const v = e.target.value; if (/^-?\d*\.?\d*$/.test(v) || v === '') onChange(v); }}
        placeholder={placeholder}
        className={`js-nav w-full px-3 py-2 border-2 rounded-lg bg-white tabular-nums text-sm outline-none transition ${
          invalid ? `input-error ${shake ? 'anim-shake' : ''}` : 'border-slate-200 focus:border-slate-900'
        }`} />
      {invalid && <p className="text-[11px] text-red-500 mt-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {hint}</p>}
    </div>
  );
}
import { DynamicPaymentsSection } from './Tolovlar.jsx';
import { ChizmaCard } from './Chizma.jsx';
import { KazirokSavdo } from './KazirokSavdo.jsx';
import { readChizmaLatokMeters, readChizmaQozon } from './chizmaEngine.js';

// O'lchov ustuni: latok(metrli) → faqat metr; list/profnastil → metr × dona; aksessuar → dona/kg
export function olchovDisp(it) {
  if (it.kind === 'aksessuar' || it.kind === 'kazirok') return `${it.soni} ${it.birlik || 'dona'}`;
  if (it.kind === 'metrli') {
    const total = it.jamiMeyor != null
      ? it.jamiMeyor
      : (parseFloat(it.uzunlik) || 0) + (parseFloat(it.zapas) || 0);
    return `${total} metr`;
  }
  return `${it.uzunlik || 0} metr × ${it.soni} dona`;
}

export function NewOrderTab({ draft, setDraft, draftCalc, tunikaBaza, metrlilar, products, ranglar = [],
                              kazData, kazNarx = {}, onKazPrice,
                              onOpenProductPicker, onOpenClientPicker, onOpenMasterPicker, onSave, usdRate, usdOlish,
                              onCopyLast, canCopyLast = false, editing = false, onCancelEdit, editNumber = null,
                              saqlashKey = 'Ctrl+S' }) {
  const colorOptions = barchaRanglar(tunikaBaza, ranglar);
  const hasItems = draft.items.length > 0;
  const kazRows = draftCalc.kazRows || [];
  const hasKaz = kazRows.length > 0;   // chizmadan kazirok bor — hisob-kitobda ham ko'rinadi
  const [saveState, setSaveState] = useState('idle');   // idle | saving | saved
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [confirmClearAll, setConfirmClearAll] = useState(false); // "Hammasini o'chirish" tasdig'i

  function clearAllItems() {
    setDraft({ ...draft, items: [] });
    setConfirmClearAll(false);
  }

  // Chizmadagi "Qosh (Latok) umumiy" (metr) — latok uzunligini avtomatik to'ldiradi.
  const [latokM, setLatokM] = useState(() => readChizmaLatokMeters());
  useEffect(() => {
    const onLatok = (e) => setLatokM(e?.detail?.meters || 0);
    window.addEventListener('chizma:latok', onLatok);
    setLatokM(readChizmaLatokMeters()); // mount paytida joriy qiymat
    return () => window.removeEventListener('chizma:latok', onLatok);
  }, []);

  // Chizmadagi qozon soni { inner, outer } — Varyonka (Ichki/Tashqi) sonini to'ldiradi.
  const [qozon, setQozon] = useState(() => readChizmaQozon());
  useEffect(() => {
    const onQozon = (e) => setQozon({ inner: e?.detail?.inner || 0, outer: e?.detail?.outer || 0 });
    window.addEventListener('chizma:qozon', onQozon);
    setQozon(readChizmaQozon());
    return () => window.removeEventListener('chizma:qozon', onQozon);
  }, []);

  // Chizmaga bog'liq avtomatik to'ldirish — BITTA effekt (aks holda latok va
  // varyonka effektlari bir-birini bekor qiladi: ikkalasi eski draft'dan setDraft qiladi).
  //  • Latok (metrli, KANYOK EMAS) uzunligi = Qosh (Latok) umumiy (tepaga yaxlitlangan).
  //    Tahrirlanadi; Qosh umumiy o'zgarsa qo'lda kiritilgan bo'lsa ham qayta o'zgaradi.
  //  • Varyonka (aksessuar) soni: Ichki → ichki qozon, Tashqi → oddiy (tashqi) qozon.
  //  • KANYOKLARGA tegilmaydi. Zapasga hech qachon tegilmaydi.
  const autoUzunlik = latokM > 0 ? String(Math.ceil(latokM)) : null;
  const prevAutoRef = useRef(autoUzunlik);
  const prevQozonRef = useRef(qozon);
  useEffect(() => {
    const latokChanged = autoUzunlik !== prevAutoRef.current;
    const qozonChanged = prevQozonRef.current.inner !== qozon.inner || prevQozonRef.current.outer !== qozon.outer;
    prevAutoRef.current = autoUzunlik;
    prevQozonRef.current = qozon;
    let changed = false;
    const items = draft.items.map((it) => {
      // --- Latok (metrli, kanyok emas) uzunligi ---
      if (it.kind === 'metrli') {
        const m = metrlilar.find((x) => x.id === it.metrliId);
        if (m && isKanyokAny({ nomi: m.nomi })) return it; // kanyokka tegmaymiz
        if (autoUzunlik == null) return it;
        const cur = String(it.uzunlik ?? '');
        if ((latokChanged || cur === '') && cur !== autoUzunlik) {
          changed = true;
          return { ...it, uzunlik: autoUzunlik };
        }
        return it;
      }
      // --- Varyonka (aksessuar) soni = qozon ---
      if (it.kind === 'aksessuar') {
        const calc = draftCalc.items.find((c) => c.id === it.id);
        const nom = (calc?.nomi || '').toLowerCase();
        if (!/varyonka/.test(nom)) return it;
        const target = /ichki/.test(nom) ? qozon.inner : (/tashqi/.test(nom) ? qozon.outer : null);
        if (target == null) return it;
        const cur = String(it.soni ?? '');
        const tStr = String(target);
        if ((qozonChanged || cur === '' || cur === '0') && cur !== tStr) {
          changed = true;
          return { ...it, soni: tStr };
        }
        return it;
      }
      return it;
    });
    if (changed) setDraft({ ...draft, items });
  }, [autoUzunlik, qozon, draft.items, draftCalc.items, metrlilar]);

  function updateItem(idx, patch) {
    setDraft({ ...draft, items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  }
  // Tovarni takrorlash — qatorni darhol pastiga nusxalaydi (yangi id bilan)
  function duplicateItem(idx) {
    const it = draft.items[idx];
    if (!it) return;
    const copy = { ...it, id: genId() };
    setDraft({ ...draft, items: [...draft.items.slice(0, idx + 1), copy, ...draft.items.slice(idx + 1)] });
  }
  function removeItem(idx) {
    const it = draft.items[idx];
    if (!it) return;
    if (reducedMotion()) { setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) })); return; }
    setRemovingIds((s) => new Set(s).add(it.id));
    setTimeout(() => {
      setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) }));
      setRemovingIds((s) => { const n = new Set(s); n.delete(it.id); return n; });
    }, 240);
  }
  // Saqlash: spinner -> yashil "Saqlandi" -> asl holat
  function handleSave() {
    if (saveState !== 'idle') return;
    const finish = (ok) => {
      if (ok) { setSaveState('saved'); setTimeout(() => setSaveState('idle'), 1300); }
      else setSaveState('idle');
    };
    setSaveState('saving');
    if (reducedMotion()) { finish(onSave()); return; }
    setTimeout(() => finish(onSave()), 450);
  }
  // Klaviatura: saqlash yorlig'i (sozlanadigan, standart Ctrl/Cmd+S)
  useEffect(() => {
    function onKey(e) {
      if (matchCombo(e, saqlashKey)) {
        e.preventDefault();
        if (hasItems) handleSave();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // har renderda yangilanadi — handleSave/hasItems/saqlashKey eng so'nggi qiymat bilan

  return (
    <>
      {editing && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5">
          <span className="text-sm font-semibold text-amber-800 flex items-center gap-2">
            <Pencil className="w-4 h-4 flex-shrink-0" /> Zakas №{editNumber} tahrirlanmoqda
          </span>
          <button type="button" onClick={onCancelEdit}
            className="px-3 py-1.5 rounded-lg border-2 border-amber-300 bg-white text-amber-800 text-xs font-semibold hover:bg-amber-100 flex-shrink-0">Bekor qilish</button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(460px,640px)] gap-4 items-start pb-24 lg:pb-4">
        {/* ===================== CHAP USTUN ===================== */}
        <div className="space-y-4 min-w-0">
          {/* MIJOZ */}
          <Card>
            <SectionTitle icon={User}>Mijoz</SectionTitle>
            <button onClick={onOpenClientPicker}
              className="w-full text-left px-3 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-900 transition flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold flex-shrink-0">
                {draft.customer.name ? draft.customer.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
              </span>
              <div className="flex-1 min-w-0">
                {draft.customer.name ? (
                  <>
                    <div className="font-bold text-slate-900 truncate">{draft.customer.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {draft.customer.phones?.filter(Boolean).length > 0 && (
                        <span>{draft.customer.phones.filter(Boolean).join(', ')}</span>
                      )}
                      {draft.customer.address && <span> · {draft.customer.address}</span>}
                      {draft.customer.orientir && <span className="inline-flex items-center gap-0.5"> · <MapPin className="w-3 h-3" />{draft.customer.orientir}</span>}
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400">Mijoz tanlang yoki yangisini qo'shing</div>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </button>
          </Card>

          {/* USTA */}
          <Card>
            <SectionTitle icon={Hammer}>Usta</SectionTitle>
            <button onClick={onOpenMasterPicker}
              className="w-full text-left px-3 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-900 transition flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0"><Hammer className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">{draft.masterName}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </button>
          </Card>

          {/* CHIZMA — xona konturi (zakas olishda hisob-kitob yordamchisi) */}
          <ChizmaCard tunikaBaza={tunikaBaza} />

          {/* TOVARLAR */}
          <Card>
            <div className="flex items-start justify-between gap-2">
              <SectionTitle icon={ShoppingCart}>Tovarlar ({draft.items.length})</SectionTitle>
              {hasItems && (
                confirmClearAll ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">Haqiqatdan ham hammasini o'chirmoqchimisiz?</span>
                    <span className="text-[11px] text-slate-500 sm:hidden">O'chirilsinmi?</span>
                    <button onClick={clearAllItems} aria-label="Hammasini o'chirishni tasdiqlash"
                      className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700">Ha</button>
                    <button onClick={() => setConfirmClearAll(false)} aria-label="Bekor qilish"
                      className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 text-[11px] font-semibold hover:bg-slate-50">Yo'q</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmClearAll(true)}
                    className="flex items-center gap-1 flex-shrink-0 text-[11px] font-semibold text-slate-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Hammasini o'chirish
                  </button>
                )
              )}
            </div>

            {/* KAZIROK — chizmadan avtomatik (read-only); doim eng tepada */}
            <KazirokSavdo data={kazData} rows={draftCalc.kazRows || []} tunikaBaza={tunikaBaza} narx={kazNarx} onPrice={onKazPrice} />

            {!hasItems ? (
              <div className="text-center py-7 border-2 border-dashed border-slate-200 rounded-lg">
                <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400 mb-3">Hali tovar qo'shilmagan</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {canCopyLast && (
                    <div className="inline-flex rounded-lg border-2 border-slate-300 overflow-hidden">
                      <button onClick={() => onCopyLast('joriy')} title="Tovarlar joriy katalog narxida"
                        className="inline-flex items-center gap-2 px-4 py-2 text-slate-700 text-sm font-semibold hover:bg-slate-50">
                        <Copy className="w-4 h-4" /> Oxirgi zakasdan nusxa
                        <span className="text-[11px] font-normal text-slate-400">(joriy narx)</span>
                      </button>
                      <button onClick={() => onCopyLast('eski')} title="Eski zakasdagi narxlar saqlanadi (qotiriladi)"
                        className="px-3 py-2 text-[11px] font-semibold text-slate-500 border-l-2 border-slate-300 hover:bg-slate-50 whitespace-nowrap">
                        eski narx
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {draftCalc.items.map((item, idx) => (
                  <ItemRow key={item.id} idx={idx} item={item} removing={removingIds.has(item.id)}
                    tunikaBaza={tunikaBaza} metrlilar={metrlilar} colorOptions={colorOptions}
                    onUpdate={(patch) => updateItem(idx, patch)}
                    onDuplicate={() => duplicateItem(idx)}
                    onRemove={() => removeItem(idx)} />
                ))}
              </div>
            )}
            <button onClick={onOpenProductPicker}
              className="mt-3 w-full py-2.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Tovar qo'shish
            </button>
          </Card>
        </div>

        {/* ===================== O'NG USTUN (sticky) ===================== */}
        <aside className="lg:sticky lg:top-36 space-y-4 min-w-0">
          {!hasItems && !hasKaz ? (
            <Card>
              <SectionTitle icon={Wallet}>Hisob-kitob</SectionTitle>
              <div className="text-center py-8 text-slate-400 text-sm">
                <Wallet className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                Tovar qo'shilgach, hisob-kitob va to'lov shu yerda chiqadi.
              </div>
            </Card>
          ) : (
            <Card highlight>
              <SectionTitle icon={Wallet}>Hisob-kitob va To'lov</SectionTitle>

              {/* Tovarlar ro'yxati — ustunlar bilan */}
              <div className="overflow-x-auto -mx-5 px-5 mb-3">
                <table className="w-full min-w-[460px] text-xs">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-500 border-b border-slate-200">
                      <th className="py-1.5 pr-2 font-semibold">Nomi</th>
                      <th className="py-1.5 px-1 font-semibold text-center">Razmeri</th>
                      <th className="py-1.5 px-1 font-semibold">Rang</th>
                      <th className="py-1.5 px-1 font-semibold text-right">O'lchov</th>
                      <th className="py-1.5 px-1 font-semibold text-right">Narx</th>
                      <th className="py-1.5 pl-1 font-semibold text-right">Jami (so'm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* KAZIROK — chizmadan avtomatik, eng tepada (List → razmer, list rangi → rang, metr → o'lchov, narx+25% → narx, jami = +25%) */}
                    {kazRows.map((r) => (
                      <tr key={'kaz-' + (r.id || 'x')} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">
                          <div className="font-medium text-slate-800">Kazirok</div>
                        </td>
                        <td className="py-1.5 px-1 text-center text-[11px] text-slate-600">
                          <div>{r.listNom}</div>
                          {r.sizeLabel && <div className="text-[10px] text-slate-400 leading-tight">{r.sizeLabel}</div>}
                        </td>
                        <td className="py-1.5 px-1">
                          {r.rang
                            ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-black/10 whitespace-nowrap" style={rangChipStyle(r.rang)}>{r.rang}</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">{r.metr.toFixed(2)} m</td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">{fmt(r.price)}+25%</td>
                        <td className="py-1.5 pl-1 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">{fmt(r.jami)}</td>
                      </tr>
                    ))}
                    {draftCalc.items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-100">
                        <td className="py-1.5 pr-2">
                          <div className="font-medium text-slate-800 flex items-center gap-1">{it.nomi}<TeskariBadge item={it} /></div>
                          <div className="text-[11px] text-slate-500">{it.tafsilot}</div>
                        </td>
                        <td className="py-1.5 px-1 text-center"><KanyokImg item={it} size="w-14 h-9" /></td>
                        <td className="py-1.5 px-1">
                          {it.rang
                            ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold border border-black/10 whitespace-nowrap" style={rangChipStyle(it.rang)}>{it.rang}</span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">{olchovDisp(it)}</td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-slate-700 whitespace-nowrap">{fmt(it.birBirlikNarxi)}</td>
                        <td className="py-1.5 pl-1 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">{fmt(it.jamiSumma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Dastafka (yetkazib berish) xizmati */}
              <div className="bg-slate-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><Truck className="w-4 h-4" /> Dastafka xizmati</span>
                  <button type="button"
                    onClick={() => setDraft({ ...draft, dastafka: { ...draft.dastafka, ichida: !draft.dastafka?.ichida } })}
                    className={`px-3 py-1 rounded-md text-xs font-semibold border transition ${
                      draft.dastafka?.ichida ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                    }`}>
                    Ichida
                  </button>
                </div>
                {draft.dastafka?.ichida ? (
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> Narxga kiritilgan — qo'shimcha summa olinmaydi
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="number" inputMode="numeric" value={draft.dastafka?.summa ?? ''}
                      onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                      onChange={(e) => setDraft({ ...draft, dastafka: { ...draft.dastafka, summa: e.target.value } })}
                      placeholder="Dastafka summasi"
                      className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg bg-white tabular-nums text-sm focus:border-slate-900 outline-none" />
                    <span className="text-xs text-slate-500 flex-shrink-0">so'm</span>
                  </div>
                )}
              </div>

              {/* Umumiy summa — real vaqtda yangilanadi */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                {(draftCalc.dastafkaSumma > 0 || draftCalc.kazTotalJami > 0) && (
                  <>
                    {draftCalc.tovarSum > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Tovarlar</span>
                        <span className="tabular-nums text-slate-700">{fmt(draftCalc.tovarSum)} so'm</span>
                      </div>
                    )}
                    {draftCalc.kazTotalJami > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Kazirok (material + 25%)</span>
                        <span className="tabular-nums text-slate-700">+ {fmt(draftCalc.kazTotalJami)} so'm</span>
                      </div>
                    )}
                    {draftCalc.dastafkaSumma > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1"><Truck className="w-3 h-3" /> Dastafka</span>
                        <span className="tabular-nums text-slate-700">+ {fmt(draftCalc.dastafkaSumma)} so'm</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Umumiy summa</span>
                  <span className="text-lg font-bold text-slate-900 tabular-nums">
                    <CountUp value={draftCalc.totalSum} /> so'm
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Kiritilgan jami to'lov</span>
                  <span className="font-medium text-emerald-800 tabular-nums">{fmt(draftCalc.totalPaid)} so'm</span>
                </div>
              </div>

              {/* To'lovlar */}
              <div className="mt-4 pt-2 border-t border-slate-100">
                <DynamicPaymentsSection payments={draft.payments} onChange={(pList) => setDraft({ ...draft, payments: pList })} usdRate={usdRate} qoldiq={draftCalc.debt} />
              </div>

              {/* Qoldiq qarz */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Qoldiq qarz summasi</label>
                <div className={`px-3 py-2.5 rounded-lg border-2 font-bold text-lg tabular-nums ${
                  draftCalc.debt > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}>
                  {fmt(draftCalc.debt)} so'm
                  {draftCalc.debt > 0 && (usdOlish > 0 || usdRate > 0) && (
                    <div className="text-xs font-medium text-slate-500 mt-0.5">
                      {usdOlish > 0 && <>≈ {(draftCalc.debt / usdOlish).toFixed(1)} $ (olish)</>}
                      {usdRate > 0 && <> · {(draftCalc.debt / usdRate).toFixed(1)} $ (sotish)</>}
                    </div>
                  )}
                </div>
              </div>

              {/* Izoh */}
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Izoh</label>
                <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Zakas uchun qo'shimcha eslatma..." rows={2}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none resize-none text-sm" />
              </div>

              <button onClick={handleSave} disabled={saveState !== 'idle'}
                className={`mt-4 w-full py-3.5 rounded-lg font-bold text-base flex items-center justify-center gap-2 shadow-lg transition ${
                  saveState === 'saved' ? 'bg-emerald-600 text-white shadow-emerald-600/30' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                }`}>
                {saveState === 'saving' ? (<><Loader2 className="w-5 h-5 anim-spin" /> Saqlanmoqda...</>)
                  : saveState === 'saved' ? (<><Check className="w-5 h-5" /> {editing ? 'Yangilandi' : 'Saqlandi'}</>)
                  : editing ? (<><Pencil className="w-5 h-5" /> Zakasni yangilash</>)
                  : (<><Save className="w-5 h-5" /> Zakasni saqlash</>)}
              </button>
            </Card>
          )}
        </aside>
      </div>

      {/* ===================== PASTKI STICKY PANEL (mobil/planshet) ===================== */}
      {(hasItems || hasKaz) && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 no-print bg-white border-t-2 border-slate-900 px-4 py-2.5 flex items-center gap-3"
          style={{ boxShadow: '0 -4px 18px rgba(15, 23, 42, .14)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-500 leading-none mb-0.5">Umumiy summa</div>
            <div className="font-bold text-slate-900 tabular-nums truncate leading-tight">
              <CountUp value={draftCalc.totalSum} /> so'm
            </div>
          </div>
          <button onClick={handleSave} disabled={saveState !== 'idle'}
            className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg flex-shrink-0 transition ${
              saveState === 'saved' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white shadow-slate-900/20'
            }`}>
            {saveState === 'saving' ? <Loader2 className="w-4 h-4 anim-spin" /> : saveState === 'saved' ? <Check className="w-4 h-4" /> : editing ? <Pencil className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveState === 'saving' ? '...' : saveState === 'saved' ? (editing ? 'Yangilandi' : 'Saqlandi') : (editing ? 'Yangilash' : 'Saqlash')}
          </button>
        </div>
      )}
    </>
  );
}

// ----- Bitta zakas qatori (kind bo'yicha) — accordion (yopiladigan) -----
function ItemRow({ idx, item, removing = false, tunikaBaza, metrlilar, colorOptions = [], onUpdate, onDuplicate, onRemove }) {
  const rangOpts = item.rang && !colorOptions.includes(item.rang) ? [item.rang, ...colorOptions] : colorOptions;
  const isFilled = item.jamiSumma > 0;
  const [open, setOpen] = useState(false); // har doim yopiq qo'shiladi — faqat foydalanuvchi ochsa ochiladi
  const [confirmDel, setConfirmDel] = useState(false); // o'chirishdan oldin kichik tasdiq

  // Metrli (latok/kanyok) uchun "necha bo'lak" — yopiq turganda ham ko'rinadi.
  const metDef = item.kind === 'metrli' ? metrlilar.find((x) => x.id === item.metrliId) : null;
  const metVariants = metDef ? metrliVariantlar(metDef) : [];
  const metVar = metVariants[item.variantIndex || 0] || metVariants[0];
  const bolakLabel = metVar ? `${metVar.son} bo'lak` : '—';

  return (
    <div className={`border rounded-xl bg-slate-50/50 overflow-hidden transition-colors ${removing ? 'anim-item-out' : 'anim-item-in'} ${open ? 'border-slate-900' : 'border-slate-200'}`}>
      {/* ----- SARLAVHA (bosilganda ochiladi/yopiladi) ----- */}
      <div className="flex items-center gap-2 p-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{idx + 1}</span>
          <KanyokImg item={item} size="w-12 h-7" className="flex-shrink-0" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold text-sm text-slate-800 leading-tight">
              <span className="truncate">{item.nomi}</span>
              <TeskariBadge item={item} />
            </span>
            <span className="block text-[11px] text-slate-500 truncate">
              {olchovDisp(item)}{item.rang ? ` · ${item.rang}` : ''}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isFilled && (
            <span className="text-sm font-bold text-slate-900 tabular-nums mr-1 hidden sm:inline">{fmt(item.jamiSumma)}</span>
          )}
          {confirmDel ? (
            <span className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 hidden sm:inline">O'chirilsinmi?</span>
              <button onClick={onRemove} aria-label="Tovarni o'chirishni tasdiqlash" title="Ha, o'chir"
                className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700">Ha</button>
              <button onClick={() => setConfirmDel(false)} aria-label="O'chirishni bekor qilish" title="Bekor"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </span>
          ) : (
            <>
              {onDuplicate && (
                <button onClick={onDuplicate} aria-label="Tovarni takrorlash" title="Tovarni takrorlash"
                  className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100">
                  <CopyPlus className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setConfirmDel(true)} aria-label="Tovarni o'chirish" title="O'chirish"
                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Tovarni yopish' : 'Tovarni ochish'} aria-expanded={open}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ----- YOPIQ STRIP (metrli) — bo'lak ko'rinadi, metri va zapas tahrirlanadi ----- */}
      {!open && item.kind === 'metrli' && (
        <div className="flex items-end gap-2 px-2.5 pb-2.5 -mt-1">
          <div className="flex-shrink-0">
            <label className="block text-[11px] text-slate-500 mb-1">Bo'lak</label>
            <div className="px-2.5 py-2 rounded-lg bg-slate-100 border-2 border-slate-200 text-xs font-semibold text-slate-600 whitespace-nowrap">{bolakLabel}</div>
          </div>
          <div className="flex-1 min-w-0">
            <NumField label="Uzunlik (m)" value={item.uzunlik} onChange={(v) => onUpdate({ uzunlik: v })} placeholder="0.00" />
          </div>
          <div className="flex-1 min-w-0">
            <NumField label="Zapas (m)" value={item.zapas} onChange={(v) => onUpdate({ zapas: v })} placeholder="0.00" optional />
          </div>
        </div>
      )}

      {/* ----- YOPIQ STRIP (aksessuar / kazirok) — dona/kg/metr sonini yopiq turganda ham tahrirlash ----- */}
      {!open && (item.kind === 'aksessuar' || item.kind === 'kazirok') && (
        <div className="px-2.5 pb-2.5 -mt-1">
          <NumField label={`Soni (${item.birlik || 'dona'})`} value={item.soni} onChange={(v) => onUpdate({ soni: v })} placeholder="0" />
        </div>
      )}

      {/* ----- TANA (tahrirlash maydonlari) ----- */}
      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-200/70 pt-2.5">
          {/* Teskari quloq */}
          {isKanyokAny(item) && (
            <button type="button" onClick={() => onUpdate({ teskariQuloq: !item.teskariQuloq })}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                item.teskariQuloq ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
              }`}>
              Teskari quloq
            </button>
          )}

          {/* Tunika / Profnastil / Metrli: material + narx turi */}
          {item.kind !== 'aksessuar' && item.kind !== 'kazirok' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">List / Material</label>
                  <select value={item.tunikaId} onChange={(e) => onUpdate({ tunikaId: e.target.value })}
                    className="w-full px-2 py-1.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none bg-white text-xs">
                    {tunikaBaza.map((t) => <option key={t.id} value={t.id}>{t.nomi} ({t.qalinlik} mm)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Narx turi</label>
                  <SegmentedControl value={item.priceType || 'chakana'} onChange={(v) => onUpdate({ priceType: v })}
                    options={[{ value: 'chakana', label: 'Chakana' }, { value: 'optom', label: 'Optom' }]} />
                </div>
              </div>
              {item.kind === 'profnastil' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Stanok turi</label>
                  <SegmentedControl value={item.stanok} onChange={(v) => onUpdate({ stanok: v })} options={STANOK_OPTIONS.map((s) => ({ value: s, label: s }))} />
                </div>
              )}
              {item.kind === 'metrli' && (() => {
                const m = metrlilar.find((x) => x.id === item.metrliId);
                const vs = m ? metrliVariantlar(m) : [];
                return (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Variant (bo'lish)</label>
                    <SegmentedControl value={item.variantIndex || 0} onChange={(v) => onUpdate({ variantIndex: v })}
                      options={vs.map((vv, i) => ({ value: i, label: `${vv.son} bo'lak (${vv.razmer})` }))} />
                  </div>
                );
              })()}
            </>
          )}

          {/* O'lchov inputlari */}
          {(item.kind === 'aksessuar' || item.kind === 'kazirok') ? (
            <div className="grid grid-cols-2 gap-2">
              <NumField label={`Soni (${item.birlik})`} value={item.soni} onChange={(v) => onUpdate({ soni: v })} />
              {aksRangKerak(item.nomi) && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Rang</label>
                  <div className="flex items-center gap-2">
                    <select value={item.rang || ''} onChange={(e) => onUpdate({ rang: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm">
                      <option value="">— tanlang —</option>
                      {rangOpts.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {item.rang && (
                      <span className="px-2 py-1 rounded-full text-[11px] font-semibold border border-black/10 whitespace-nowrap flex-shrink-0"
                        style={rangChipStyle(item.rang)}>{item.rang}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : item.kind === 'metrli' ? (
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Uzunlik (m)" value={item.uzunlik} onChange={(v) => onUpdate({ uzunlik: v })} placeholder="0.00" />
              <NumField label="Zapas (m)" value={item.zapas} onChange={(v) => onUpdate({ zapas: v })} placeholder="0.00" optional />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Uzunlik (m)" value={item.uzunlik} onChange={(v) => onUpdate({ uzunlik: v })} placeholder="0.00" />
              <NumField label="Soni" value={item.soni} onChange={(v) => onUpdate({ soni: v })} placeholder="1" />
            </div>
          )}

          {item.jamiSumma > 0 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <span className="text-slate-500 flex items-center gap-1.5 flex-wrap">
                Narxi: {fmt(item.birBirlikNarxi)} so'm / {item.birlik}
                {item.narxOverride > 0 && (
                  <button type="button" onClick={() => onUpdate({ narxOverride: '' })}
                    title="Joriy katalog narxiga qaytarish"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200 hover:bg-amber-200">
                    Eski narx <X className="w-3 h-3" />
                  </button>
                )}
              </span>
              <span className="font-bold text-slate-900 tabular-nums">{fmt(item.jamiSumma)} so'm</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
