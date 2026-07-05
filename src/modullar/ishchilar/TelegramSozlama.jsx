// ============================================================
//  TELEGRAM XABAR SOZLAMASI
//  Ishchi kamerada ko'ringanda uning Telegramiga yuboriladigan xabar matni.
//  Firebase 'telegram_config' hujjatiga yoziladi; kompyuterdagi dastur o'qiydi.
//  O'rin egallar:  {ism} {vaqt} {sana} {kamera}
// ============================================================
import React, { useState, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { storage } from '../../lib/storage.js';

const DEFAULT_TG_TEMPLATE =
  '✅ Assalomu alaykum, {ism}! Siz {vaqt} da ishga keldingiz. Xush kelibsiz! 😊';

export function TelegramSozlama() {
  const [cfg, setCfg] = useState(null);
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [inited, setInited] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => storage.subscribe('telegram_config', (v) => setCfg(v || {})), []);
  useEffect(() => {
    if (cfg && !inited) {
      setTemplate(cfg.arrival_template || DEFAULT_TG_TEMPLATE);
      setEnabled(cfg.enabled !== false);
      setInited(true);
    }
  }, [cfg, inited]);

  function save() {
    storage.saveField('telegram_config', {
      arrival_template: (template || '').trim() || DEFAULT_TG_TEMPLATE,
      enabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const preview = (template || DEFAULT_TG_TEMPLATE)
    .replace('{ism}', 'Zafarjon')
    .replace('{vaqt}', '08:57')
    .replace('{sana}', new Date().toISOString().slice(0, 10))
    .replace('{kamera}', 'TAROZI');

  const botUsername = cfg?.bot_username || '';

  return (
    <div className="mb-3 rounded-xl border-2 border-sky-100 bg-sky-50/40">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <Send className="w-4 h-4 text-sky-600 flex-shrink-0" />
        <span className="font-semibold text-slate-800 text-sm flex-1">Telegram xabar sozlamasi</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
          {enabled ? 'Yoqilgan' : "O'chiq"}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-slate-700">Ishchi kelganda uning Telegramiga xabar yuborilsin</span>
          </label>

          <div>
            <label className="block text-xs text-slate-600 mb-1 font-medium">Xabar matni</label>
            <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3}
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm" />
            <p className="text-[11px] text-slate-400 mt-1">
              O'rin egallar: <b>{'{ism}'}</b> · <b>{'{vaqt}'}</b> · <b>{'{sana}'}</b> · <b>{'{kamera}'}</b>
            </p>
          </div>

          <div className="text-[12px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <span className="text-slate-400">Namuna: </span>{preview}
          </div>

          <button onClick={save} className="w-full py-2 rounded-lg bg-sky-600 text-white font-medium text-sm hover:bg-sky-700">
            {saved ? '✓ Saqlandi' : 'Saqlash'}
          </button>

          <p className="text-[11px] text-slate-400">
            {botUsername
              ? <>Bot: <b>@{botUsername}</b>. Har ishchini uning kartochkasidagi «Telegramga ulash» tugmasi orqali ulang.</>
              : <>Bot hali ulanmagan. Kompyuterda <b>Telegram_bot.bat</b> ni bir marta ishga tushiring — shundan so'ng ulash havolalari paydo bo'ladi.</>}
          </p>
        </div>
      )}
    </div>
  );
}
