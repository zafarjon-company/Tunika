// ============================================================
//  YOLO KAMERA NAZORATI — yoqish/o'chirish + kamera tanlash
//  'yolo_control'  : ishlatish/to'xtatish bayrog'i (kompyuter kuzatadi)
//  'yolo_cameras'  : { "Kamera nomi": true/false } — belgilanganlari hisoblanadi.
//  Ro'yxatni kompyuterdagi xizmat o'zi e'lon qiladi; tanlov Firebase'da
//  saqlanadi (sahifa yangilansa ham, kompyuter o'chib-yonsa ham yo'qolmaydi).
// ============================================================
import React, { useEffect, useState } from 'react';
import { Video, Power, Camera } from 'lucide-react';
import { storage } from '../../lib/storage.js';

export function YoloControl() {
  const [state, setState] = useState(null); // { running, updated } | null
  const [cams, setCams] = useState(null);   // { nom: bool } | null

  useEffect(
    () => storage.subscribe('yolo_control', (v) => setState(v || { running: false })),
    [],
  );
  useEffect(() => storage.subscribe('yolo_cameras', (v) => setCams(v || null)), []);

  const running = !!(state && state.running);
  const names = cams ? Object.keys(cams).sort((a, b) => a.localeCompare(b)) : [];
  const checked = names.filter((n) => cams[n]).length;

  function toggle() {
    storage.save('yolo_control', { running: !running, updated: new Date().toISOString() });
  }
  function toggleCam(n) {
    storage.saveField('yolo_cameras', { [n]: !cams[n] }); // faqat shu katak (merge)
  }

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
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

      {names.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <Camera className="w-4 h-4" />
            Hisoblanadigan kameralar
            <span className="ml-auto font-normal text-slate-400">{checked} ta belgilangan</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {names.map((n) => (
              <label key={n}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition ${
                  cams[n] ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                <span className={cams[n] ? 'text-slate-800 font-medium' : 'text-slate-400'}>{n}</span>
                <input type="checkbox" checked={!!cams[n]} onChange={() => toggleCam(n)}
                  className="w-4 h-4 accent-emerald-600 flex-shrink-0" />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Faqat belgilangan kameralar hisoblanadi. O'zgartirsangiz tizim o'zi qayta yuklaydi (~yarim daqiqa).
          </p>
        </div>
      )}
    </div>
  );
}
