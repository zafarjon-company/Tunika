// ============================================================
//  SOZLAMALAR → SOTUVCHILAR (chekda chiqadi)
// ------------------------------------------------------------
//  Istalgancha sotuvchi: ism + istalgancha telefon raqam, ▲▼ bilan
//  tartib (chekda shu tartibda). Format va eski (bitta satr) qiymatni
//  o'qish: lib/sotuvchi.js. "Saqlash" bosilgandagina yoziladi.
// ============================================================
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Phone, X } from 'lucide-react';
import { PhoneInput } from '../../components/ui.jsx';
import { genId, formatPhone } from '../../lib/helpers.js';
import { sotuvchilarOl, sotuvchiQatori } from '../../lib/sotuvchi.js';

const bosh = () => ({ id: genId(), ism: '', tel: [''] });

// Eski qo'lda yozilgan raqam ("+998 90 123 45 67") — PhoneInput formatiga
// ("+998 (90) 123-45-67"), chekda hamma raqam bir xil ko'rinsin. O'zbek raqami
// bo'lmasa (9 ta raqam emas) — o'zgarmaydi.
function telFormat(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('998') && d.length > 9) d = d.slice(3);
  return d.length === 9 ? formatPhone(d) : t;
}

// Tahrir qoralamasi: har sotuvchida kamida bitta (bo'sh) raqam maydoni bo'ladi
function qoralama(v) {
  const l = sotuvchilarOl(v).map((s) => ({
    id: s.id === 'eski' ? genId() : s.id,
    ism: s.ism,
    tel: s.tel.length ? s.tel.map(telFormat) : [''],
  }));
  return l.length ? l : [bosh()];
}

export function SotuvchilarSozlama({ qiymat, onSaqla, showToast = () => {} }) {
  const [list, setList] = useState(() => qoralama(qiymat));
  const [ozgargan, setOzgargan] = useState(false);
  // Masofadan kelgan yangilanish (o'z saqlovimiz aks-sadosi yoki boshqa qurilma)
  // yozilmagan o'zgarishlarni o'chirib yubormasin (faqat qiymat o'zgarganda ishlaydi)
  useEffect(() => { if (!ozgargan) setList(qoralama(qiymat)); }, [qiymat]);

  const yangila = (next) => { setList(next); setOzgargan(true); };
  const sotuvchi = (i, patch) => yangila(list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const tel = (i, j, v) => sotuvchi(i, { tel: list[i].tel.map((t, k) => (k === j ? v : t)) });
  function kochir(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    yangila(next);
  }
  function ochir(i) {
    const next = list.filter((_, k) => k !== i);
    yangila(next.length ? next : [bosh()]);
  }
  function saqla() {
    onSaqla(sotuvchilarOl(list));
    setOzgargan(false);
    showToast('Saqlandi');
  }

  const korinish = sotuvchilarOl(list).map(sotuvchiQatori);

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">Sotuvchilar — ism va telefon raqamlari (chekda chiqadi)</label>
      <div className="space-y-2">
        {list.map((s, i) => (
          <div key={s.id} className="p-2.5 rounded-lg border-2 border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col -my-1 flex-shrink-0">
                <button type="button" onClick={() => kochir(i, -1)} disabled={i === 0}
                  aria-label="Sotuvchini yuqoriga" title="Yuqoriga"
                  className="p-0.5 rounded text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => kochir(i, 1)} disabled={i === list.length - 1}
                  aria-label="Sotuvchini pastga" title="Pastga"
                  className="p-0.5 rounded text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <input value={s.ism} onChange={(e) => sotuvchi(i, { ism: e.target.value })}
                placeholder="Sotuvchi ismi (masalan: Zafar aka)"
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg bg-white focus:border-slate-900 outline-none text-sm" />
              <button type="button" onClick={() => ochir(i)} aria-label="Sotuvchini o'chirish" title="Sotuvchini o'chirish"
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="mt-1.5 pl-6 space-y-1">
              {s.tel.map((t, j) => (
                <div key={j} className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <PhoneInput value={t} onChange={(v) => tel(i, j, v)}
                    className="flex-1 min-w-0 px-3 py-1.5 border-2 border-slate-200 rounded-lg bg-white text-sm tabular-nums" />
                  {s.tel.length > 1 && (
                    <button type="button" onClick={() => sotuvchi(i, { tel: s.tel.filter((_, k) => k !== j) })}
                      aria-label="Raqamni o'chirish" title="Raqamni o'chirish"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => sotuvchi(i, { tel: [...s.tel, ''] })}
                className="text-xs text-slate-900 font-bold pl-5">+ Raqam qo'shish</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        <button type="button" onClick={() => yangila([...list, bosh()])}
          className="flex-1 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 inline-flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Sotuvchi qo'shish
        </button>
        <button type="button" onClick={saqla}
          className={`px-4 py-2 rounded-lg font-medium text-white ${ozgargan ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
          Saqlash
        </button>
      </div>
      {ozgargan && <div className="text-[11px] text-amber-700 mt-1">Saqlanmagan o'zgarishlar bor</div>}

      {/* Chekda qanday chiqishi */}
      {korinish.length > 0 && (
        <div className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Chekda shunday chiqadi</div>
          {korinish.map((q, k) => (
            <div key={k} className="text-sm font-bold text-slate-700 inline-flex items-center justify-center gap-1.5 w-full">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" /><span className="break-words">{q}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
