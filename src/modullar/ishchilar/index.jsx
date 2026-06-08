// ============================================================
//  ISHCHILAR MODULI — Ro'yxat + (o'ng burchakda) Qobiliyatlar, Lavozimlar
// ============================================================
import React, { useState } from 'react';
import { Briefcase, Award, AlertTriangle, ChevronLeft } from 'lucide-react';
import { IshchilarRoyxat } from './Royxat.jsx';
import { LavozimlarTab } from './Lavozimlar.jsx';
import { QobiliyatlarTab } from './Qobiliyatlar.jsx';
import { KamchiliklarTab } from './Kamchiliklar.jsx';

const TITLES = { royxat: 'Ishchilar', lavozimlar: 'Lavozimlar', qobiliyatlar: 'Qobiliyatlar', kamchiliklar: 'Kamchiliklar' };

export function IshchilarModule({
  ishchilar, updateIshchilar, lavozimlar, updateLavozimlar,
  qobiliyatlar, updateQobiliyatlar, kamchiliklar, updateKamchiliklar, showToast,
}) {
  const [view, setView] = useState('royxat');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-800">{TITLES[view]}</h2>
        {view === 'royxat' ? (
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => setView('kamchiliklar')}
              className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Kamchiliklar
            </button>
            <button onClick={() => setView('qobiliyatlar')}
              className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5">
              <Award className="w-4 h-4" /> Qobiliyatlar
            </button>
            <button onClick={() => setView('lavozimlar')}
              className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" /> Lavozimlar
            </button>
          </div>
        ) : (
          <button onClick={() => setView('royxat')}
            className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Ishchilar
          </button>
        )}
      </div>

      {view === 'royxat' && (
        <IshchilarRoyxat ishchilar={ishchilar} updateIshchilar={updateIshchilar}
          lavozimlar={lavozimlar} qobiliyatRoyxati={qobiliyatlar} kamchilikRoyxati={kamchiliklar} showToast={showToast} />
      )}
      {view === 'lavozimlar' && (
        <LavozimlarTab lavozimlar={lavozimlar} updateLavozimlar={updateLavozimlar} showToast={showToast} />
      )}
      {view === 'qobiliyatlar' && (
        <QobiliyatlarTab qobiliyatlar={qobiliyatlar} updateQobiliyatlar={updateQobiliyatlar} showToast={showToast} />
      )}
      {view === 'kamchiliklar' && (
        <KamchiliklarTab kamchiliklar={kamchiliklar} updateKamchiliklar={updateKamchiliklar} showToast={showToast} />
      )}
    </div>
  );
}
