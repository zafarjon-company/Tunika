// ============================================================
//  DINAMIK MULTI-VALYUTALI TO'LOV BO'LIMI
// ============================================================
import React from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { fmt, makeBlankPayment } from '../../lib/helpers.js';
import { PAYMENT_METHODS } from '../../lib/constants.js';

export function DynamicPaymentsSection({ payments, onChange, usdRate, qoldiq = 0 }) {
  function updatePaymentItem(pId, patch) {
    onChange(payments.map((p) => (p.id === pId ? { ...p, ...patch } : p)));
  }
  function addPaymentField() {
    onChange([...payments, makeBlankPayment(usdRate)]);
  }
  function removePaymentField(pId) {
    if (payments.length === 1) return;
    onChange(payments.filter((p) => p.id !== pId));
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">To'lovlar</div>
      {payments.map((p, index) => {
        const localAmount = parseFloat(p.amount) || 0;
        const convertedSum = p.method === 'Dollorda' ? localAmount * p.rate : localAmount;

        return (
          <div key={p.id} className="p-3 border border-slate-200 bg-slate-50 rounded-lg space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">To'lov uslubi {index + 1}</span>
              {payments.length > 1 && (
                <button type="button" onClick={() => removePaymentField(p.id)} className="text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">To'lov turi</label>
                <select value={p.method} onChange={(e) => updatePaymentItem(p.id, { method: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-500">
                    Summa ({p.method === 'Dollorda' ? 'dollar' : 'so\'m'})
                  </label>
                  {qoldiq > 0 && (
                    <button type="button"
                      onClick={() => updatePaymentItem(p.id, { amount: String(p.method === 'Dollorda' ? Math.round((qoldiq / (parseFloat(p.rate) || usdRate)) * 100) / 100 : Math.round(qoldiq)) })}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline">
                      Qoldiq: {fmt(qoldiq)}
                    </button>
                  )}
                </div>
                <input type="number" value={p.amount} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                  onChange={(e) => updatePaymentItem(p.id, { amount: e.target.value })}
                  placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs tabular-nums" />
              </div>
            </div>

            {p.method === 'Dollorda' && (
              <div className="grid grid-cols-2 gap-2 bg-white p-2 border border-slate-200 rounded text-xs">
                <div>
                  <span className="text-slate-500 block">Kurs:</span>
                  <input type="number" value={p.rate} onWheel={(e) => e.target.blur()}
                    onChange={(e) => updatePaymentItem(p.id, { rate: parseFloat(e.target.value) || usdRate })}
                    className="w-full border-b border-slate-200 focus:border-slate-900 outline-none p-0.5 text-xs font-bold tabular-nums" />
                </div>
                <div className="text-right flex flex-col justify-end">
                  <span className="text-slate-500 block">So'mdagi qiymati:</span>
                  <span className="font-bold text-emerald-800 tabular-nums">{fmt(convertedSum)} so'm</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2">
              <div className="flex gap-2 items-center">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input type="datetime-local" value={p.createdAt.slice(0, 16)}
                  onChange={(e) => updatePaymentItem(p.id, { createdAt: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() })}
                  className="px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 bg-white" />
              </div>
              <input type="text" value={p.notes || ''} onChange={(e) => updatePaymentItem(p.id, { notes: e.target.value })}
                placeholder="To'lov izohi..." className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white" />
            </div>
          </div>
        );
      })}

      <button type="button" onClick={addPaymentField}
        className="w-full py-2 border border-dashed border-slate-300 text-slate-600 font-medium rounded-lg text-xs hover:bg-slate-50 flex items-center justify-center gap-1">
        <Plus className="w-3.5 h-3.5" /> To'lov qo'shish
      </button>
    </div>
  );
}
