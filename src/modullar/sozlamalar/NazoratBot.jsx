// ============================================================
//  NAZORAT BOTI — kamera davomati Telegram integratsiyasi
// ------------------------------------------------------------
//  - Menejerlar guruhi chat ID (botdan /id orqali olinadi)
//  - "Xush kelibsiz" matni
//  - Begona yuz ogohlantirishi (yoqish/o'chirish)
//  - Kamera bog'lash: kamera taniган, lekin ishchi topilmagan
//    odamlarni qo'lda ishchiga bog'lash.
//  Ma'lumot: shop/telegram-settings, shop/camera-unlinked, shop/camera-links
// ============================================================
import React, { useState, useEffect } from 'react';
import { Bot, Send, Camera, Link2, UserCheck } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { storage, O_CHIR } from '../../lib/storage.js';

const DEFAULT_WELCOME = 'Ishga xush kelibsiz, charchamang! 💪';

export function NazoratBot({ ishchilar = [], currentUser, showToast }) {
  const [sozlama, setSozlama] = useState({});
  const [unlinked, setUnlinked] = useState({});
  const [links, setLinks] = useState({});
  const [chatDraft, setChatDraft] = useState('');
  const [welcomeDraft, setWelcomeDraft] = useState('');
  const [tanlov, setTanlov] = useState({}); // person_id -> tanlangan ishchiId

  useEffect(() => {
    const u1 = storage.subscribe('telegram-settings', (v) => setSozlama(v || {}));
    const u2 = storage.subscribe('camera-unlinked', (v) => setUnlinked(v || {}));
    const u3 = storage.subscribe('camera-links', (v) => setLinks(v || {}));
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => { setChatDraft(sozlama.managersChatId || ''); }, [sozlama.managersChatId]);
  useEffect(() => { setWelcomeDraft(sozlama.welcomeText || ''); }, [sozlama.welcomeText]);

  function saveChat() {
    storage.saveField('telegram-settings', { managersChatId: chatDraft.trim() });
    showToast('Guruh ID saqlandi');
  }
  function saveWelcome() {
    storage.saveField('telegram-settings', { welcomeText: welcomeDraft.trim() || DEFAULT_WELCOME });
    showToast('Matn saqlandi');
  }
  function toggleUnknown() {
    const v = sozlama.unknownAlerts === false; // false bo'lsa yoqamiz
    storage.saveField('telegram-settings', { unknownAlerts: v });
  }

  function bogla(personId) {
    const ishchiId = tanlov[personId];
    if (!ishchiId) { showToast('Avval ishchini tanlang'); return; }
    const ish = ishchilar.find((i) => i.id === ishchiId);
    storage.saveField('camera-links', {
      [personId]: { ishchiId, label: (unlinked[personId] && unlinked[personId].name) || '', linkedAt: new Date().toISOString(), linkedBy: currentUser?.id || 'qo\'lda' },
    });
    storage.saveField('camera-unlinked', { [personId]: O_CHIR });
    showToast(`${ish ? ish.name : 'Ishchi'} bog'landi ✅`);
  }

  const unlinkedList = Object.entries(unlinked)
    .filter(([, v]) => v) // o'chirilganlar (null) chiqib ketsin
    .sort((a, b) => String(b[1].lastSeen || '').localeCompare(String(a[1].lastSeen || '')));
  const linkedCount = Object.values(links).filter(Boolean).length;
  const sozlangan = !!(sozlama.managersChatId);

  return (
    <Card>
      <SectionTitle icon={Bot}>Nazorat boti (kamera davomati)</SectionTitle>
      <p className="text-xs text-slate-500 mb-3 -mt-1">
        Kamera ishchini taniganда yo'qlama avtomatik to'ladi, ishchiga botdan "xush kelibsiz"
        xabari va menejerlar guruhiga foto + tuzatish tugmalari keladi.
      </p>

      {/* Menejerlar guruhi */}
      <div className="mb-4">
        <label className="block text-xs text-slate-500 mb-1">Menejerlar guruhi — Chat ID</label>
        <div className="flex gap-2">
          <input value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder="-1001234567890"
            autoComplete="off" spellCheck={false}
            className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none font-mono text-xs tabular-nums" />
          <button onClick={saveChat} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 flex-shrink-0">Saqlash</button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Guruh ID ni olish: botni guruhga qo'shing → guruhda <b>/id</b> yozing → chiqgan raqamni shu yerga qo'ying.
        </p>
      </div>

      {/* Xush kelibsiz matni */}
      <div className="mb-4">
        <label className="block text-xs text-slate-500 mb-1">"Xush kelibsiz" xabari (ishchiga)</label>
        <div className="flex gap-2">
          <input value={welcomeDraft} onChange={(e) => setWelcomeDraft(e.target.value)} placeholder={DEFAULT_WELCOME}
            className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          <button onClick={saveWelcome} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 flex-shrink-0">Saqlash</button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1"><code>{'{ism}'}</code> — ishchi ismi bilan almashtiriladi.</p>
      </div>

      {/* Begona yuz ogohlantirishi */}
      <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 mb-4 cursor-pointer select-none">
        <span className="text-sm text-slate-700">⚠️ Begona (notanish) yuz ogohlantirishi</span>
        <input type="checkbox" checked={sozlama.unknownAlerts !== false} onChange={toggleUnknown} className="w-4 h-4 accent-emerald-700" />
      </label>

      <div className="text-[11px] mb-4">
        {sozlangan
          ? <span className="text-emerald-600 font-semibold">✓ Bot sozlangan · {linkedCount} ta ishchi kameraga bog'langan</span>
          : <span className="text-amber-600">Guruh ID kiritilmagan — menejer xabarlari yuborilmaydi.</span>}
      </div>

      {/* Kamera bog'lash */}
      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
          <Camera className="w-4 h-4" /> Kamera bog'lash
          {unlinkedList.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">{unlinkedList.length}</span>}
        </div>
        {unlinkedList.length === 0 ? (
          <p className="text-xs text-slate-400 py-2 flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-emerald-500" /> Bog'lanmagan odam yo'q — hammasi joyida.</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-400 mb-2">Kamera taniган, lekin Tunika ishchisiga to'g'ri kelmagan odamlar. Har birини to'g'ri ishchiga bog'lang:</p>
            <div className="space-y-2">
              {unlinkedList.map(([pid, info]) => (
                <div key={pid} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-semibold text-slate-800">{info.name || `Kamera #${pid}`}</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">({info.cam || 'kamera'})</span>
                  </div>
                  <div className="flex gap-2">
                    <select value={tanlov[pid] || ''} onChange={(e) => setTanlov((t) => ({ ...t, [pid]: e.target.value }))}
                      className="flex-1 min-w-0 px-2 py-1.5 border-2 border-slate-200 rounded-lg bg-white text-sm">
                      <option value="">— ishchini tanlang —</option>
                      {ishchilar.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <button onClick={() => bogla(pid)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-1 flex-shrink-0">
                      <Link2 className="w-3.5 h-3.5" /> Bog'lash
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
