// ============================================================
//  ISHCHI HISOBOT CHEKI (RECEIPT)
// ------------------------------------------------------------
//  Faqat ishchi hisobotini ko'rayotganda "Chek" tugmasi orqali
//  ochiladi. ReceiptModal uslubida — chop etishda faqat
//  .receipt-print ko'rinadi (index.css qoidalari).
// ============================================================
import React from 'react';
import { Printer } from 'lucide-react';
import { fmt, formatDay, formatDate } from '../../lib/helpers.js';

export function IshchiChek({ ishchi, amallar, jamiIshlangan, jamiAvans, haqqi, shopName, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== CHOP ETILADIGAN QISM ===== */}
        <div className="receipt-print p-6 text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
          <div className="text-center border-b-2 border-slate-900 pb-3 mb-3">
            <h1 className="text-2xl font-bold tracking-tight">{shopName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">Ishchi hisoboti</p>
          </div>

          <div className="flex justify-between text-xs mb-3">
            <div className="font-bold text-sm">{ishchi.name}{ishchi.lavozim ? ` · ${ishchi.lavozim}` : ''}</div>
            <div><span className="text-slate-500">Sana:</span> {formatDate(new Date().toISOString())}</div>
          </div>

          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="text-left border-b border-slate-400">
                <th className="py-1 font-semibold">Nom</th>
                <th className="py-1 font-semibold text-center">Sana</th>
                <th className="py-1 font-semibold text-right">Qiymat</th>
              </tr>
            </thead>
            <tbody>
              {amallar.map((o) => (
                <tr key={o.id} className="border-b border-slate-200">
                  <td className="py-1 pr-1">{o.nom}</td>
                  <td className="py-1 text-center tabular-nums">{formatDay(o.sana)}</td>
                  <td className={`py-1 text-right tabular-nums ${o.qiymat > 0 ? 'text-emerald-800' : o.qiymat < 0 ? 'text-red-700' : 'text-slate-500'}`}>
                    {o.qiymat > 0 ? '+' : ''}{fmt(o.qiymat)}
                  </td>
                </tr>
              ))}
              {amallar.length === 0 && (
                <tr><td colSpan={3} className="py-2 text-center text-slate-400">Amallar yo'q</td></tr>
              )}
            </tbody>
          </table>

          <div className="border-t-2 border-slate-900 pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span>Jami ishlangan:</span><b className="tabular-nums text-emerald-800">{fmt(jamiIshlangan)} so'm</b></div>
            <div className="flex justify-between"><span>Jami avans:</span><b className="tabular-nums text-red-700">− {fmt(jamiAvans)} so'm</b></div>
          </div>

          <div className="border-2 border-slate-900 rounded-lg bg-slate-50 px-4 py-3 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-base">Haqqi (qoldiq):</span>
              <b className={`text-xl tabular-nums ${haqqi >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{fmt(haqqi)} so'm</b>
            </div>
          </div>

          <div className="mt-6 flex justify-between text-[11px] text-slate-500">
            <span>Topshirdi: ______________</span>
            <span>Oldi (imzo): ______________</span>
          </div>
        </div>

        {/* ===== TUGMALAR (chop etishda ko'rinmaydi) ===== */}
        <div className="no-print flex gap-2 p-4 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-700 hover:bg-slate-50">
            Yopish
          </button>
          <button onClick={() => window.print()}
            className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Chop etish
          </button>
        </div>
      </div>
    </div>
  );
}
