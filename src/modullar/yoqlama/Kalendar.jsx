// ============================================================
//  YO'QLAMA — DAVOMAT KALENDARI (oylik ko'rinish)
// ------------------------------------------------------------
//  Ishchi × kun matritsasi: kim qaysi kuni ishlagani bir qarashda.
//  Katakni bosib belgilash: bo'sh → Keldi → Yarim → Kelmadi → bo'sh.
//  O'ngda — har ishchi uchun oylik jami ish kunlari.
//  yoqlama tuzilishi: { 'YYYY-MM-DD': { ishchiId: 'keldi'|'yarim'|'kelmadi' } }
// ============================================================
import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { toMonthInput, toDateInput, daysInMonth, oylikYoqlama } from '../../lib/helpers.js';
import { OY_NOMLARI } from '../../lib/constants.js';

// Bosilganda holatlar shu tartibda almashinadi (oxiridan keyin — bo'sh)
const CYCLE = ['keldi', 'yarim', 'kelmadi'];
const CELL = {
  keldi:   { bg: 'bg-emerald-500 text-white', label: 'K' },
  yarim:   { bg: 'bg-amber-400 text-white',   label: 'Y' },
  kelmadi: { bg: 'bg-red-500 text-white',     label: '×' },
};
const HOLAT_NOMI = { keldi: 'Keldi', yarim: 'Yarim kun', kelmadi: 'Kelmadi' };

function oyLabel(oy) {
  const [y, m] = (oy || '').split('-').map(Number);
  if (!y || !m) return '';
  return `${OY_NOMLARI[m - 1]} ${y}`;
}

export function YoqlamaKalendar({ ishchilar = [], yoqlama = {}, updateYoqlama }) {
  const [oy, setOy] = useState(toMonthInput());
  const bugun = toDateInput();
  const pad = (n) => String(n).padStart(2, '0');
  const kunSoni = daysInMonth(oy);
  const kunlar = Array.from({ length: kunSoni }, (_, i) => i + 1);
  const sanaOf = (kun) => `${oy}-${pad(kun)}`;
  // 0 = Yakshanba (dam olish kuni — yengil ajratiladi)
  const isYakshanba = (kun) => new Date(`${oy}-${pad(kun)}T00:00:00`).getDay() === 0;

  function cycle(ishchiId, kun) {
    const sana = sanaOf(kun);
    const cur = yoqlama[sana]?.[ishchiId];
    const idx = CYCLE.indexOf(cur);
    const next = idx === -1 ? 'keldi' : (idx >= CYCLE.length - 1 ? null : CYCLE[idx + 1]);
    const day = { ...(yoqlama[sana] || {}) };
    if (next === null) delete day[ishchiId]; else day[ishchiId] = next;
    updateYoqlama({ ...yoqlama, [sana]: day });
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={CalendarDays}>Davomat kalendari — {oyLabel(oy)}</SectionTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Oyni tanlang</label>
            <input type="month" value={oy} onChange={(e) => setOy(e.target.value || toMonthInput())}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> Keldi</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Yarim</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Kelmadi</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Katakni bosib belgilang: bo'sh → Keldi → Yarim → Kelmadi → bo'sh.</p>
      </Card>

      {ishchilar.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Avval "Ishchilar → Ro'yxat" bo'limidan ishchi qo'shing</p></Card>
      ) : (
        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-white text-left px-3 py-2 font-semibold text-slate-500">Ishchi</th>
                  {kunlar.map((k) => (
                    <th key={k} className={`py-1.5 text-center font-semibold w-8 ${isYakshanba(k) ? 'text-red-500' : 'text-slate-400'}`}>{k}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold text-slate-500 whitespace-nowrap">Jami</th>
                </tr>
              </thead>
              <tbody>
                {ishchilar.map((i) => {
                  const sum = oylikYoqlama(yoqlama, oy, i.id);
                  return (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap max-w-[150px] truncate">{i.name}</td>
                      {kunlar.map((k) => {
                        const st = yoqlama[sanaOf(k)]?.[i.id];
                        const c = CELL[st];
                        const today = sanaOf(k) === bugun;
                        return (
                          <td key={k} className="p-0.5 text-center">
                            <button type="button" onClick={() => cycle(i.id, k)}
                              aria-label={`${i.name}, ${k}-kun: ${HOLAT_NOMI[st] || 'belgilanmagan'}`}
                              className={`w-7 h-7 rounded-md text-[11px] font-bold flex items-center justify-center mx-auto transition ${c ? c.bg : 'bg-slate-50 text-slate-300 hover:bg-slate-100'} ${today ? 'ring-2 ring-slate-900' : ''}`}>
                              {c ? c.label : ''}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold text-slate-700 whitespace-nowrap">{sum.jamiKun} kun</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
