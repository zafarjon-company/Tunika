// ============================================================
//  NARXLAR MODULI — sub-tab boshqaruvi (Listlar / Aksessuarlar)
// ============================================================
import React, { useState } from 'react';
import { Layers, Package, Ruler, Triangle } from 'lucide-react';
import { ListlarTab } from './Listlar.jsx';
import { MetrliTab } from './Metrli.jsx';
import { AksessuarlarTab } from './Aksessuarlar.jsx';
import { KazirokTab } from './Kaziroklar.jsx';

export function NarxlarModule({ tunikaBaza, updateTunikaBaza, metrlilar, updateMetrlilar, aksessuarlar, updateAksessuarlar, kaziroklar, updateKaziroklar, kazTurlari = [], updateKazTurlari, ranglar = [], showToast }) {
  const [sub, setSub] = useState('listlar');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { k: 'listlar',      label: 'Listlar',      icon: Layers },
          { k: 'metrli',       label: 'Metrli',       icon: Ruler },
          { k: 'aksessuarlar', label: 'Aksessuarlar', icon: Package },
          { k: 'kaziroklar',   label: 'Kaziroklar',   icon: Triangle },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-medium border-2 transition ${
              sub === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {sub === 'listlar' && <ListlarTab tunikaBaza={tunikaBaza} updateTunikaBaza={updateTunikaBaza} ranglar={ranglar} showToast={showToast} />}
      {sub === 'metrli' && <MetrliTab metrlilar={metrlilar} updateMetrlilar={updateMetrlilar} ranglar={ranglar} showToast={showToast} />}
      {sub === 'aksessuarlar' && <AksessuarlarTab aksessuarlar={aksessuarlar} updateAksessuarlar={updateAksessuarlar} ranglar={ranglar} showToast={showToast} />}
      {sub === 'kaziroklar' && <KazirokTab kaziroklar={kaziroklar} updateKaziroklar={updateKaziroklar} kazTurlari={kazTurlari} updateKazTurlari={updateKazTurlari} ranglar={ranglar} showToast={showToast} />}
    </div>
  );
}
