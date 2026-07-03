// ============================================================
//  YOLO KAMERA NAZORATI — yoqish / o'chirish tugmasi
//  Firebase 'yolo_control' bayrog'ini almashtiradi. Kompyuterdagi dastur
//  (control_panel.py) shu bayroqni kuzatib ishlaydi yoki to'xtaydi.
//  Ishlab tursa -> "To'xtatish", ishlamayotgan bo'lsa -> "Ishlatish".
// ============================================================
import React, { useEffect, useState } from 'react';
import { Video, Power } from 'lucide-react';
import { storage } from '../../lib/storage.js';

export function YoloControl() {
  const [state, setState] = useState(null); // { running, updated } | null

  useEffect(
    () => storage.subscribe('yolo_control', (v) => setState(v || { running: false })),
    [],
  );

  const running = !!(state && state.running);

  function toggle() {
    storage.save('yolo_control', { running: !running, updated: new Date().toISOString() });
  }

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${running ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        <Video className={`w-6 h-6 ${running ? 'text-emerald-600' : 'text-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-800">Kamera nazorati (YOLO)</div>
        <div className="text-xs text-slate-400 truncate">
          {state === null
            ? 'ulanmoqda…'
            : running
              ? 'Ishlab turibdi — yuzdan davomat olinyapti'
              : "To'xtatilgan (videokartaga yuk yo'q)"}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={state === null}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white transition disabled:opacity-50 ${
          running ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
        }`}
      >
        <Power className="w-4 h-4" />
        {running ? "To'xtatish" : 'Ishlatish'}
      </button>
    </div>
  );
}
