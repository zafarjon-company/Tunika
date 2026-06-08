// ============================================================
//  HISOBOT MODULI — sub-tab boshqaruvi (Ishchilar / Zakaslar)
// ============================================================
import React, { useState } from 'react';
import { HardHat, FileText, LayoutDashboard, Banknote } from 'lucide-react';
import { HisobotIshchilar } from './Ishchilar.jsx';
import { HisobotZakaslar } from './Zakaslar.jsx';
import { HisobotDashboard } from './Dashboard.jsx';
import { HisobotKassa } from './Kassa.jsx';

export function HisobotModule({ ishchilar, orders, yoqlama, avanslar, shopName }) {
  const [sub, setSub] = useState('dashboard');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { k: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { k: 'kassa',     label: 'Kassa',     icon: Banknote },
          { k: 'ishchilar', label: 'Ishchilar', icon: HardHat },
          { k: 'zakaslar',  label: 'Zakaslar',  icon: FileText },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-3 rounded-lg font-medium border-2 transition ${
              sub === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {sub === 'dashboard' && <HisobotDashboard orders={orders} />}
      {sub === 'kassa' && <HisobotKassa orders={orders} />}
      {sub === 'ishchilar' && <HisobotIshchilar ishchilar={ishchilar} yoqlama={yoqlama} avanslar={avanslar} shopName={shopName} />}
      {sub === 'zakaslar' && <HisobotZakaslar orders={orders} />}
    </div>
  );
}
