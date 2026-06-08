// ============================================================
//  NARXLAR MODULI — sub-tab boshqaruvi (Listlar / Aksessuarlar)
// ============================================================
import React, { useState } from 'react';
import { Layers, Package, Ruler } from 'lucide-react';
import { ListlarTab } from './Listlar.jsx';
import { MetrliTab } from './Metrli.jsx';
import { AksessuarlarTab } from './Aksessuarlar.jsx';

export function NarxlarModule({ tunikaBaza, updateTunikaBaza, metrlilar, updateMetrlilar, aksessuarlar, updateAksessuarlar, showToast }) {
  const [sub, setSub] = useState('listlar');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { k: 'listlar',      label: 'Listlar',      icon: Layers },
          { k: 'metrli',       label: 'Metrli',       icon: Ruler },
          { k: 'aksessuarlar', label: 'Aksessuarlar', icon: Package },
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

      {sub === 'listlar' && <ListlarTab tunikaBaza={tunikaBaza} updateTunikaBaza={updateTunikaBaza} showToast={showToast} />}
      {sub === 'metrli' && <MetrliTab metrlilar={metrlilar} updateMetrlilar={updateMetrlilar} showToast={showToast} />}
      {sub === 'aksessuarlar' && <AksessuarlarTab aksessuarlar={aksessuarlar} updateAksessuarlar={updateAksessuarlar} showToast={showToast} />}
    </div>
  );
}
