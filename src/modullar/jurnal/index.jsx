// ============================================================
//  AMALLAR JURNALI — kim nima qildi (audit log)
// ------------------------------------------------------------
//  Yozuv: { id, ts(ISO), userId, userLogin, role, amal, detail }
//  Faqat founder/admin ko'radi (App.jsx tabKoradi orqali).
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  History, Search, Trash2, LogIn, LogOut, Plus, Wallet, RefreshCw, UserPlus, UserMinus,
} from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { ROLLAR } from '../../lib/ruxsat.js';

// Amal turlari — nomi, ikonka, rang
export const AMAL = {
  kirdi:             { nom: 'Tizimga kirdi',          icon: LogIn,      cls: 'text-slate-600' },
  chiqdi:            { nom: 'Tizimdan chiqdi',         icon: LogOut,     cls: 'text-slate-500' },
  zakas_yaratdi:     { nom: 'Zakas yaratdi',           icon: Plus,       cls: 'text-emerald-700' },
  zakas_ochirdi:     { nom: "Zakasni o'chirdi",        icon: Trash2,     cls: 'text-red-600' },
  tolov_qoshdi:      { nom: "To'lov qo'shdi",          icon: Wallet,     cls: 'text-emerald-700' },
  holat_ozgartirdi:  { nom: "Holatni o'zgartirdi",     icon: RefreshCw,  cls: 'text-blue-700' },
  user_qoshdi:       { nom: 'Foydalanuvchi qo’shdi', icon: UserPlus, cls: 'text-emerald-700' },
  user_ochirdi:      { nom: 'Foydalanuvchini o’chirdi', icon: UserMinus, cls: 'text-red-600' },
};

// ISO -> 'DD.MM.YYYY HH:MM'
function vaqt(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function JurnalTab({ jurnal = [], onClear, canClear = false }) {
  const [query, setQuery] = useState('');
  const [kim, setKim] = useState('all');

  const userlar = useMemo(() => {
    const s = new Map();
    jurnal.forEach((e) => { if (e.userLogin) s.set(e.userLogin, true); });
    return [...s.keys()];
  }, [jurnal]);

  const filtered = jurnal.filter((e) => {
    if (kim !== 'all' && e.userLogin !== kim) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const amalNom = (AMAL[e.amal]?.nom || e.amal || '').toLowerCase();
      return (e.userLogin || '').toLowerCase().includes(q)
        || (e.detail || '').toLowerCase().includes(q)
        || amalNom.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={History}>Amallar jurnali</SectionTitle>
        <p className="text-xs text-slate-500 mb-3">Kim nima qilgani — yangi amallar tepada. Oxirgi 500 ta amal saqlanadi.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Foydalanuvchi, amal yoki tafsilot..."
              className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <select value={kim} onChange={(e) => setKim(e.target.value)}
            className="px-3 py-2.5 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm bg-white">
            <option value="all">Hamma foydalanuvchi</option>
            {userlar.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {canClear && jurnal.length > 0 && (
            <button onClick={onClear} title="Jurnalni tozalash"
              className="px-3 py-2.5 rounded-lg border-2 border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" /> Tozalash
            </button>
          )}
        </div>
      </Card>

      <Card padding="p-0">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400"><History className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Amallar topilmadi</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((e) => {
              const a = AMAL[e.amal] || { nom: e.amal, icon: History, cls: 'text-slate-600' };
              const A = a.icon;
              const rol = ROLLAR[e.role];
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-0.5 flex-shrink-0 ${a.cls}`}><A className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <b className="text-slate-900">{e.userLogin}</b>
                      {rol && <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${rol.cls}`}>{rol.nom}</span>}
                      <span className="text-slate-600"> — {a.nom}</span>
                    </div>
                    {e.detail && <div className="text-xs text-slate-500 truncate">{e.detail}</div>}
                  </div>
                  <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0">{vaqt(e.ts)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
