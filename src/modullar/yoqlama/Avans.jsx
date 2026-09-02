// ============================================================
//  AVANS — har bir ishchiga berilgan avanslar
// ------------------------------------------------------------
//  Avans yozuvi zakasdagi to'lov kabi: to'lov usuli + summa
//  (dollar uchun kurs) + sana + izoh. Zakasdagi
//  DynamicPaymentsSection qayta ishlatiladi.
//  Model: avanslar = { 'YYYY-MM': { ishchiId: [ {id,method,amount,rate,createdAt,notes} ] } }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, Check, Wallet, ChevronDown } from 'lucide-react';
import { Card, SectionTitle, SmallModal } from '../../components/ui.jsx';
import { DynamicPaymentsSection } from '../sotuv/Tolovlar.jsx';
import { fmt, toMonthInput, formatDate, formatDay, daysInMonth, makeBlankPayment, ishchiHisobi, sonQiymat, oyFaolmi } from '../../lib/helpers.js';
import { OY_NOMLARI } from '../../lib/constants.js';

function oyLabel(oy) {
  const [y, m] = oy.split('-');
  return `${OY_NOMLARI[parseInt(m, 10) - 1] || m} ${y}`;
}

// Eski (sonli) yoki yangi (massiv) formatni bir xil massivga keltirish
function normEntries(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'number' && v > 0) return [{ id: 'eski', method: "So'mda", amount: v, createdAt: null, notes: 'eski format' }];
  return [];
}

// Yozuvlar yig'indisi (dollar → so'mga kursda)
export function avansSumma(entries) {
  return normEntries(entries).reduce((s, p) => {
    const amt = sonQiymat(p.amount);
    return s + (p.method === 'Dollorda' ? amt * (p.rate || 0) : amt);
  }, 0);
}

export function AvansTab({ ishchilar, avanslar, updateAvanslar, setAvansYozuv, yoqlama = {}, maoshlar = {}, usdRate, showToast }) {
  const [oy, setOy] = useState(toMonthInput());
  const [modal, setModal] = useState(null); // { ishchiId, payments: [...] }
  // Har bir ishchining yozuvlar ro'yxati alohida ochiladi. Sukut — yopiq.
  const [ochiq, setOchiq] = useState({}); // { [ishchiId]: true }
  const toggle = (id) => setOchiq((o) => ({ ...o, [id]: !o[id] }));

  const oyAvanslar = avanslar[oy] || {};
  // Tanlangan oyda faol bo'lganlar (kirmagan/ketganlar ko'rinmaydi;
  // maydonlari yo'q eski ishchilar doim faol)
  const faollar = ishchilar.filter((i) => oyFaolmi(i, oy));
  const jami = faollar.reduce((s, i) => s + avansSumma(oyAvanslar[i.id]), 0);

  function openAdd(ishchiId) {
    setModal({ ishchiId, payments: [makeBlankPayment(usdRate)] });
  }

  // Faqat o'zgargan ishchi/oy katagini yozadi (merge) — butun hujjatni emas.
  // Eski updateAvanslar (to'liq qayta yozish) zaxira sifatida qoladi.
  function yozKatak(ishchiId, list) {
    if (setAvansYozuv) setAvansYozuv(oy, ishchiId, list);
    else updateAvanslar({ ...avanslar, [oy]: { ...oyAvanslar, [ishchiId]: list } });
  }

  function saveModal() {
    if (!modal) return;
    const valid = modal.payments
      .filter((p) => sonQiymat(p.amount) > 0)
      .map((p) => {
        const y = { ...p, amount: sonQiymat(p.amount), rate: sonQiymat(p.rate) || usdRate };
        // Sana tanlangan oyga mos bo'lsin: o'tgan oyga avans kiritilayotganda
        // sukut "bugun" bo'lib qolsa, hisobot uni boshqa oyga qo'yib yuborardi.
        if ((y.createdAt || '').slice(0, 7) !== oy) {
          y.createdAt = new Date(`${oy}-01T12:00:00`).toISOString();
        }
        return y;
      });
    if (valid.length === 0) { showToast('Summani kiriting'); return; }

    const oldList = normEntries(oyAvanslar[modal.ishchiId]);
    yozKatak(modal.ishchiId, [...oldList, ...valid]);
    // Yangi qo'shilgan yozuv darhol ko'rinsin — shu ishchining ro'yxatini ochamiz
    setOchiq((o) => ({ ...o, [modal.ishchiId]: true }));
    setModal(null);
    showToast('Avans qo\'shildi');
  }

  function deleteEntry(ishchiId, entryId) {
    const list = normEntries(oyAvanslar[ishchiId]).filter((e) => e.id !== entryId);
    yozKatak(ishchiId, list);
    showToast('Avans o\'chirildi');
  }

  const modalIshchi = modal ? ishchilar.find((i) => i.id === modal.ishchiId) : null;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Wallet}>Avans — {oyLabel(oy)}</SectionTitle>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Oyni tanlang</label>
            <input type="month" value={oy} onChange={(e) => setOy(e.target.value || toMonthInput())}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Jami avans</div>
            <div className="font-bold tabular-nums text-amber-700">{fmt(jami)} so'm</div>
          </div>
        </div>
        {/* Oy tafsiloti — qaysi oy, necha kun, qaysi oraliq */}
        <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{oyLabel(oy)}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold tabular-nums">{daysInMonth(oy)} kun</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums">
            {formatDay(`${oy}-01`)} — {formatDay(`${oy}-${String(daysInMonth(oy)).padStart(2, '0')}`)}
          </span>
        </div>
      </Card>

      {ishchilar.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Avval "Ishchilar → Ro'yxat" bo'limidan ishchi qo'shing</p></Card>
      ) : faollar.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Bu oyda faol ishchi yo'q</p></Card>
      ) : (
        faollar.map((i) => {
          const entries = normEntries(oyAvanslar[i.id]);
          const summa = avansSumma(oyAvanslar[i.id]);
          // Butun davr bo'yicha hisob (Hisobot > Ishchilar bilan bir xil) — avans
          // berishdan oldin ishchining haqiqiy qoldig'i ko'rinib tursin.
          // "Hozirgi haqqi" to'langan maoshlarni ham ayiradi.
          const h = ishchiHisobi(i, yoqlama, avanslar, maoshlar);
          return (
            <Card key={i.id}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0">{(i.name || '?').charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{i.name}</div>
                    {i.lavozim && <div className="text-xs text-slate-400">{i.lavozim}</div>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Avans ({oyLabel(oy)})</div>
                  <div className="font-bold tabular-nums text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">{fmt(summa)} so'm</div>
                </div>
              </div>

              {/* Umumiy hisob — Ishlangan · Avans · Hozirgi haqqi (butun davr) */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-tight">Ishlangan</div>
                  <div className="text-xs font-bold tabular-nums text-slate-700 leading-tight">{fmt(h.ishlangan)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-tight">Avans (jami)</div>
                  <div className="text-xs font-bold tabular-nums text-amber-700 leading-tight">{fmt(h.avans)}</div>
                </div>
                <div className={`rounded-lg border px-2 py-1.5 text-center ${
                  h.haqqi >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                }`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-tight">Hozirgi haqqi</div>
                  <div className={`text-xs font-bold tabular-nums leading-tight ${h.haqqi >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(h.haqqi)}</div>
                </div>
              </div>

              {/* Yozuvlar ro'yxati — sukut bo'yicha yopiq, bosib ochiladi */}
              {entries.length > 0 && (
                <button type="button" onClick={() => toggle(i.id)} aria-expanded={!!ochiq[i.id]}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-600 mb-2">
                  <span>{entries.length} ta yozuv · {ochiq[i.id] ? 'yashirish' : "ko'rish"}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${ochiq[i.id] ? 'rotate-180' : ''}`} />
                </button>
              )}

              {entries.length > 0 && ochiq[i.id] && (
                <div className="space-y-1 mb-2 text-xs">
                  {entries.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 border border-slate-100 bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="text-slate-700">
                          <span className="font-medium">{p.method}</span>
                          {p.notes ? <span className="text-slate-400"> · {p.notes}</span> : ''}
                        </div>
                        {p.createdAt && <div className="text-[11px] text-slate-400">{formatDate(p.createdAt)}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold tabular-nums text-slate-800">
                          {p.method === 'Dollorda'
                            ? `${fmt(p.amount)} $ (${fmt(sonQiymat(p.amount) * sonQiymat(p.rate))} so'm)`
                            : `${fmt(p.amount)} so'm`}
                        </span>
                        <button onClick={() => deleteEntry(i.id, p.id)} className="text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => openAdd(i.id)}
                className="w-full py-2 border border-dashed border-slate-300 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Avans qo'shish
              </button>
            </Card>
          );
        })
      )}

      {modal && (
        <SmallModal onClose={() => setModal(null)} title={`Avans — ${modalIshchi?.name || ''}`}>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <DynamicPaymentsSection
              payments={modal.payments}
              onChange={(pList) => setModal({ ...modal, payments: pList })}
              usdRate={usdRate}
            />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-700 hover:bg-slate-50">Bekor</button>
              <button onClick={saveModal}
                className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Qabul qilish
              </button>
            </div>
          </div>
        </SmallModal>
      )}
    </div>
  );
}
