// ============================================================
//  YO'QLAMA BELGILASH (kunlik)
// ------------------------------------------------------------
//  Sana tanlanadi, har bir ishchi uchun holat belgilanadi.
//  yoqlama tuzilishi: { 'YYYY-MM-DD': { ishchiId: 'keldi'|'yarim'|'kelmadi' } }
// ============================================================
import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Card, SectionTitle, SegmentedControl, StatBox } from '../../components/ui.jsx';
import { toDateInput, formatDay } from '../../lib/helpers.js';
import { YOQLAMA_HOLATLAR } from '../../lib/constants.js';

const OPTIONS = YOQLAMA_HOLATLAR.map((h) => ({ value: h.value, label: h.label }));

export function YoqlamaBelgilash({ ishchilar, yoqlama, updateYoqlama, showToast }) {
  const [sana, setSana] = useState(toDateInput());

  const kunlik = yoqlama[sana] || {};

  function belgila(ishchiId, holat) {
    const next = { ...yoqlama, [sana]: { ...kunlik, [ishchiId]: holat } };
    updateYoqlama(next);
  }

  function hammasiKeldi() {
    const next = { ...kunlik };
    ishchilar.forEach((i) => { next[i.id] = 'keldi'; });
    updateYoqlama({ ...yoqlama, [sana]: next });
    showToast('Hammasi "Keldi" deb belgilandi');
  }

  const belgilangan = ishchilar.filter((i) => kunlik[i.id]).length;
  const keldiN = ishchilar.filter((i) => kunlik[i.id] === 'keldi').length;
  const yarimN = ishchilar.filter((i) => kunlik[i.id] === 'yarim').length;
  const kelmadiN = ishchilar.filter((i) => kunlik[i.id] === 'kelmadi').length;

  const tint = (st) => (
    st === 'keldi' ? 'bg-emerald-50 border-emerald-200'
      : st === 'yarim' ? 'bg-amber-50 border-amber-200'
        : st === 'kelmadi' ? 'bg-red-50 border-red-200'
          : 'bg-white border-slate-200'
  );

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={CalendarCheck}>Yo'qlama — {formatDay(sana)}</SectionTitle>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sanani tanlang</label>
            <input type="date" value={sana} onChange={(e) => setSana(e.target.value || toDateInput())}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          {ishchilar.length > 0 && (
            <button onClick={hammasiKeldi} className="px-3 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50">
              Hammasi keldi
            </button>
          )}
          <div className="ml-auto text-xs text-slate-500 self-center">
            {belgilangan}/{ishchilar.length} belgilandi
          </div>
        </div>
        {ishchilar.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <StatBox label="Keldi" value={keldiN} color="emerald" />
            <StatBox label="Yarim kun" value={yarimN} color="amber" />
            <StatBox label="Kelmadi" value={kelmadiN} />
          </div>
        )}
      </Card>

      {ishchilar.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Avval "Ishchilar → Ro'yxat" bo'limidan ishchi qo'shing</p></Card>
      ) : (
        <Card>
          <div className="space-y-2">
            {ishchilar.map((i) => (
              <div key={i.id} className={`flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl border ${tint(kunlik[i.id])}`}>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{(i.name || '?').charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{i.name}</div>
                    {i.lavozim && <div className="text-xs text-slate-400">{i.lavozim}</div>}
                  </div>
                </div>
                <div className="sm:w-72">
                  <SegmentedControl value={kunlik[i.id] || ''} onChange={(v) => belgila(i.id, v)} options={OPTIONS} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
