// ============================================================
//  YO'QLAMA / AVANS MODULI — sub-tab boshqaruvi (Belgilash / Avans)
// ============================================================
import React, { useState } from 'react';
import { CalendarCheck, CalendarDays, Wallet } from 'lucide-react';
import { YoqlamaBelgilash } from './Belgilash.jsx';
import { YoqlamaKalendar } from './Kalendar.jsx';
import { AvansTab } from './Avans.jsx';

export function YoqlamaModule({ ishchilar, yoqlama, updateYoqlama, avanslar, updateAvanslar, usdRate, showToast }) {
  const [sub, setSub] = useState('belgilash');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { k: 'belgilash', label: 'Belgilash', icon: CalendarCheck },
          { k: 'kalendar',  label: 'Kalendar',  icon: CalendarDays },
          { k: 'avans',     label: 'Avans',     icon: Wallet },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-medium border-2 transition ${
              sub === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {sub === 'belgilash' && <YoqlamaBelgilash ishchilar={ishchilar} yoqlama={yoqlama} updateYoqlama={updateYoqlama} showToast={showToast} />}
      {sub === 'avans' && <AvansTab ishchilar={ishchilar} avanslar={avanslar} updateAvanslar={updateAvanslar} usdRate={usdRate} showToast={showToast} />}
    </div>
  );
}
