// ============================================================
//  DINAMIK MULTI-VALYUTALI TO'LOV BO'LIMI
// ============================================================
import React from 'react';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { fmt, makeBlankPayment, sonMatn, sonQiymat, sonAjrat, kursorOrni } from '../../lib/helpers.js';
import { PAYMENT_METHODS, DEFAULT_USD_RATE } from '../../lib/constants.js';

// ISO vaqtni <input type="datetime-local"> uchun LOKAL formatga o'girish.
// (toISOString UTC beradi — slice(0,16) ko'rsatilsa vaqt 5 soat orqaga surilardi.)
function toLocalDT(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

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

  // Kursorni belgilangan o'ringa qo'yish (maydon fokusda bo'lmasa — e'tiborsiz).
  const kursorQoy = (el, p) => { try { el.setSelectionRange(p, p); } catch (err) { /* noop */ } };

  // 3 talab ajratiladigan raqam maydoni uchun onChange.
  // Holatda BO'SHLIQSIZ xom satr saqlanadi, maydonda esa sonAjrat bilan ajratib
  // ko'rsatiladi. Ko'rinish o'zgargani uchun KURSORNI qo'lda tiklaymiz — aks holda
  // React DOM ni qayta yozganda kursor oxiriga sakrab ketadi.
  // eski — maydonning o'zgarishdan OLDINGI qiymati.
  function ajratibYoz(e, pId, maydon, eski) {
    const el = e.target;
    const eskiKorinish = sonAjrat(eski);
    let xom = el.value;
    let kursor = el.selectionStart == null ? xom.length : el.selectionStart;
    const amal = e.nativeEvent && e.nativeEvent.inputType;

    // AJRATUVCHI BO'SHLIQ o'chirilgan holat ("1 500" dan bo'shliq): raqamlar
    // o'zgarmagani uchun bo'shliq darhol qaytib qo'yiladi va "o'chmayotgandek"
    // tuyuladi. Shuning uchun bo'shliq o'rniga yonidagi RAQAMNI o'chiramiz.
    if (xom.length === eskiKorinish.length - 1 && sonMatn(xom) !== null && sonMatn(xom) === sonMatn(eski)) {
      if (amal === 'deleteContentBackward' && kursor > 0) {
        xom = xom.slice(0, kursor - 1) + xom.slice(kursor);
        kursor -= 1;
      } else if (amal === 'deleteContentForward' && kursor < xom.length) {
        xom = xom.slice(0, kursor) + xom.slice(kursor + 1);
      }
    }

    const v = sonMatn(xom);
    if (v === null) {
      // Yaroqsiz belgi — maydonni eski qiymatga qaytaramiz va kursorni o'sha yerda qoldiramiz
      // (React o'zi tiklaganda kursor oxiriga sakrab ketardi).
      const qaytar = Math.max(0, Math.min(eskiKorinish.length, kursor - (xom.length - eskiKorinish.length)));
      el.value = eskiKorinish;
      kursorQoy(el, qaytar);
      return;
    }

    // Kursordan OLDINGI raqamlar soni bo'yicha yangi ko'rinishdagi o'rinni topamiz.
    const oldingi = xom.slice(0, kursor);
    const raqamOldin = oldingi.replace(/\D/g, '').length;
    const yangi = sonAjrat(v);
    // Kasr ajratgichi ("," yoki ".") aynan kursordan oldin bo'lsa — undan keyin turamiz
    let orin = kursorOrni(yangi, raqamOldin) + (/[.,]\s*$/.test(oldingi) ? 1 : 0);
    orin = Math.max(0, Math.min(orin, yangi.length));

    // DOM ni darhol yangi ko'rinishga keltiramiz (PhoneInput bilan bir xil usul):
    // React qayta chizganda qiymat aynan mos tushadi va kursor joyida qoladi.
    el.value = yangi;
    kursorQoy(el, orin);
    updatePaymentItem(pId, { [maydon]: v });
    requestAnimationFrame(() => kursorQoy(el, orin)); // qayta chizilgandan keyin ham
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">To'lovlar</div>
      {payments.map((p, index) => {
        const localAmount = sonQiymat(p.amount);
        // Kurs yozilayotganda vaqtincha satr (yoki bo'sh) bo'lishi mumkin — sonQiymat bilan
        // o'qiymiz. Kurs ham, usdRate ham bo'sh bo'lsa — nolga bo'lib yubormaslik uchun standart kurs.
        const kurs = sonQiymat(p.rate) || sonQiymat(usdRate) || DEFAULT_USD_RATE;
        const convertedSum = p.method === 'Dollorda' ? localAmount * kurs : localAmount;

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
                      onClick={() => updatePaymentItem(p.id, { amount: String(p.method === 'Dollorda' ? Math.ceil((qoldiq / kurs) * 100) / 100 : Math.round(qoldiq)) })}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline">
                      Qoldiq: {fmt(qoldiq)}
                    </button>
                  )}
                </div>
                {/* Yozayotgan paytda 3 talab ajratib ko'rsatiladi ("1500000" -> "1 500 000"),
                    holatda esa bo'shliqsiz xom satr turadi. */}
                <input type="text" inputMode="decimal" value={sonAjrat(p.amount)} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                  onChange={(e) => ajratibYoz(e, p.id, 'amount', p.amount)}
                  placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs tabular-nums" />
              </div>
            </div>

            {p.method === 'Dollorda' && (
              <div className="grid grid-cols-2 gap-2 bg-white p-2 border border-slate-200 rounded text-xs">
                <div>
                  <span className="text-slate-500 block">Kurs:</span>
                  {/* Yozayotganda satr (masalan "12500," yoki "12500.") bo'lishi mumkin,
                      maydondan chiqilganda esa albatta SONga aylantiramiz.
                      Ko'rsatishda 3 talab ajratiladi; sonQiymat bo'shliqlarni tushunadi. */}
                  <input type="text" inputMode="decimal" value={sonAjrat(p.rate)} onWheel={(e) => e.target.blur()}
                    onChange={(e) => ajratibYoz(e, p.id, 'rate', p.rate)}
                    onBlur={(e) => updatePaymentItem(p.id, { rate: sonQiymat(e.target.value) || kurs })}
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
                <input type="datetime-local" value={toLocalDT(p.createdAt)}
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
