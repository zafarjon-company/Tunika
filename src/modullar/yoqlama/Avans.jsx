// ============================================================
//  AVANS — har bir ishchiga berilgan avanslar
// ------------------------------------------------------------
//  Avans yozuvi zakasdagi to'lov kabi: to'lov usuli + summa
//  (dollar uchun kurs) + sana + izoh. Zakasdagi
//  DynamicPaymentsSection qayta ishlatiladi.
//  Model: avanslar = { 'YYYY-MM': { ishchiId: [ {id,method,amount,rate,createdAt,notes} ] } }
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, Check, Wallet } from 'lucide-react';
import { Card, SectionTitle, SmallModal } from '../../components/ui.jsx';
import { DynamicPaymentsSection } from '../sotuv/Tolovlar.jsx';
import { fmt, toMonthInput, formatDate, makeBlankPayment } from '../../lib/helpers.js';
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
    const amt = parseFloat(p.amount) || 0;
    return s + (p.method === 'Dollorda' ? amt * (p.rate || 0) : amt);
  }, 0);
}

export function AvansTab({ ishchilar, avanslar, updateAvanslar, usdRate, showToast }) {
  const [oy, setOy] = useState(toMonthInput());
  const [modal, setModal] = useState(null); // { ishchiId, payments: [...] }

  const oyAvanslar = avanslar[oy] || {};
  const jami = ishchilar.reduce((s, i) => s + avansSumma(oyAvanslar[i.id]), 0);

  function openAdd(ishchiId) {
    setModal({ ishchiId, payments: [makeBlankPayment(usdRate)] });
  }

  function saveModal() {
    if (!modal) return;
    const valid = modal.payments
      .filter((p) => (parseFloat(p.amount) || 0) > 0)
      .map((p) => ({ ...p, amount: parseFloat(p.amount) || 0 }));
    if (valid.length === 0) { showToast('Summani kiriting'); return; }

    const oldList = normEntries(oyAvanslar[modal.ishchiId]);
    const next = { ...avanslar, [oy]: { ...oyAvanslar, [modal.ishchiId]: [...oldList, ...valid] } };
    updateAvanslar(next);
    setModal(null);
    showToast('Avans qo\'shildi');
  }

  function deleteEntry(ishchiId, entryId) {
    const list = normEntries(oyAvanslar[ishchiId]).filter((e) => e.id !== entryId);
    const next = { ...avanslar, [oy]: { ...oyAvanslar, [ishchiId]: list } };
    updateAvanslar(next);
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
      </Card>

      {ishchilar.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Avval "Ishchilar → Ro'yxat" bo'limidan ishchi qo'shing</p></Card>
      ) : (
        ishchilar.map((i) => {
          const entries = normEntries(oyAvanslar[i.id]);
          const summa = avansSumma(oyAvanslar[i.id]);
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
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Avans</div>
                  <div className="font-bold tabular-nums text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">{fmt(summa)} so'm</div>
                </div>
              </div>

              {entries.length > 0 && (
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
                            ? `${fmt(p.amount)} $ (${fmt((parseFloat(p.amount) || 0) * (p.rate || 0))} so'm)`
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
