// ============================================================
//  ISHCHILAR BOTI — sozlama paneli (Sozlamalar → Nazorat boti ostida)
// ------------------------------------------------------------
//  Har ishchi Telegram botda faqat O'ZINING davomati, avansi, maoshi
//  va hozirgi haqqini ko'radi. Avans/maosh berilganda va yo'qlama
//  belgilanganda unga xabar boradi (api/ishchi-bot.js, api/telegram.js).
//  Bu yerda: bot holati + "Botni ulash", xabar turlari, kim ulangan.
//  Ma'lumot: shop/telegram-settings (ishchiXabar, botUsername),
//            shop/telegram-links (tid → ishchiId, phone)
// ============================================================
import React, { useState, useEffect } from 'react';
import { Users, Plug, RefreshCw, Copy, Send, Check } from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { storage } from '../../lib/storage.js';
import { ishchiFaolmi, toDateInput } from '../../lib/helpers.js';
import { botHolati, botniUlash, hisobYubor } from '../../lib/ishchiXabar.js';

// api/_match.js normPhone bilan bir xil: faqat raqamlar, 998 tashlanadi, oxirgi 9 ta
function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('998') && d.length > 9) d = d.slice(-9);
  return d.slice(-9);
}

const XABAR_TURLARI = [
  { k: 'yoqlama', label: "Yo'qlama — keldi / kelmadi" },
  { k: 'avans', label: 'Avans berilganda' },
  { k: 'maosh', label: 'Maosh berilganda' },
];

const XATO_MATN = {
  ulanmagan: 'Ishchi botga ulanmagan',
  tez: 'Hozirgina yuborildi — 1 daqiqadan keyin',
  token: 'Bot tokeni topilmadi',
  yuborilmadi: 'Telegram qabul qilmadi',
};

export function IshchiBot({ ishchilar = [], showToast }) {
  const [sozlama, setSozlama] = useState({});
  const [links, setLinks] = useState({});
  const [holat, setHolat] = useState(undefined); // undefined — tekshirilmoqda, null — server javob bermadi
  const [band, setBand] = useState(false);
  const [yuborilmoqda, setYuborilmoqda] = useState({}); // { ishchiId: true }

  useEffect(() => {
    const u1 = storage.subscribe('telegram-settings', (v) => setSozlama(v || {}));
    const u2 = storage.subscribe('telegram-links', (v) => setLinks(v || {}));
    return () => { u1(); u2(); };
  }, []);

  async function tekshir() {
    setHolat(undefined);
    setHolat(await botHolati());
  }
  useEffect(() => { tekshir(); }, []);

  async function ulash() {
    setBand(true);
    const r = await botniUlash();
    setBand(false);
    if (r && r.ok) { setHolat(r); showToast('Bot serverga ulandi ✅'); }
    else showToast(`Ulanmadi: ${(r && r.error) || 'server javob bermadi'}`);
  }

  async function hisob(i) {
    setYuborilmoqda((s) => ({ ...s, [i.id]: true }));
    const r = await hisobYubor(i.id);
    setYuborilmoqda((s) => ({ ...s, [i.id]: false }));
    if (r && r.ok) showToast(`${i.name}ga hisobi yuborildi ✅`);
    else showToast(XATO_MATN[r && r.error] || 'Yuborilmadi');
  }

  const xabar = sozlama.ishchiXabar || {};
  function toggle(k) {
    storage.saveField('telegram-settings', { ishchiXabar: { [k]: xabar[k] === false } });
  }

  const username = (holat && holat.bot && holat.bot.username) || sozlama.botUsername || '';
  const havola = username ? `https://t.me/${username}` : '';

  // Server qoidasi bilan bir xil: ulangan raqam hali ham kartochkada bo'lishi kerak
  const ulanganlar = {};
  Object.values(links).forEach((l) => {
    if (!l || !l.ishchiId) return;
    const i = ishchilar.find((x) => x.id === l.ishchiId);
    if (!i) return;
    if (l.phone && !(i.phones || []).some((p) => normPhone(p) === normPhone(l.phone))) return;
    ulanganlar[i.id] = l;
  });
  const bugun = toDateInput();
  const faollar = ishchilar.filter((i) => ishchiFaolmi(i, bugun));
  const ulanganSoni = faollar.filter((i) => ulanganlar[i.id]).length;

  const wh = holat && holat.webhook;
  let holatBlok;
  if (holat === undefined) {
    holatBlok = <div className="text-xs text-slate-400">Tekshirilmoqda…</div>;
  } else if (!holat) {
    holatBlok = <div className="text-xs text-amber-700">Server javob bermadi (kompyuterdagi sinov rejimida bot ishlamaydi).</div>;
  } else if (!holat.token) {
    holatBlok = (
      <div className="text-xs text-amber-700">
        Bot tokeni topilmadi — yuqoridagi <b>«Telegram bot»</b> bo'limiga @BotFather bergan tokenni kiriting.
      </div>
    );
  } else if (holat.tokenXato) {
    holatBlok = <div className="text-xs text-red-700">Token noto'g'ri: {holat.tokenXato}</div>;
  } else {
    holatBlok = (
      <div className="space-y-1.5">
        {wh && wh.ulangan ? (
          <div className="text-sm text-emerald-700 font-semibold flex items-center gap-1.5">
            <Check className="w-4 h-4" /> @{username} ishlayapti
          </div>
        ) : (
          <div className="text-sm text-amber-700 font-semibold">
            @{username} hali serverga ulanmagan — ishchilar yozsa bot javob bermaydi.
          </div>
        )}
        {wh && wh.xato && (
          <div className="text-[11px] text-red-600">
            Oxirgi xato{wh.xatoVaqt ? ` (${new Date(wh.xatoVaqt).toLocaleString('uz-UZ')})` : ''}: {wh.xato}
          </div>
        )}
        {wh && wh.kutayotgan > 0 && <div className="text-[11px] text-slate-500">Navbatda {wh.kutayotgan} ta xabar</div>}
      </div>
    );
  }

  return (
    <Card>
      <SectionTitle icon={Users}>Ishchilar boti (shaxsiy hisob)</SectionTitle>
      <p className="text-xs text-slate-500 mb-3 -mt-1">
        Har bir ishchi botda <b>faqat o'zining</b> davomati, avansi, maoshi va hozirgi haqqini ko'radi —
        boshqa ishchilar, savdo va narxlar ko'rinmaydi. Avans yoki maosh berilganda, yo'qlama belgilanganda
        ishchiga avtomatik xabar boradi.
      </p>

      {/* Bot holati */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3">
        {holatBlok}
        {holat && holat.token && !holat.tokenXato && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button onClick={ulash} disabled={band}
              className={`px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-60 ${
                wh && wh.ulangan ? 'border-2 border-slate-200 text-slate-700 hover:bg-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}>
              <Plug className="w-4 h-4" /> {band ? 'Ulanmoqda…' : wh && wh.ulangan ? 'Qayta ulash' : 'Botni ulash'}
            </button>
            <button onClick={tekshir}
              className="px-3 py-2 rounded-lg border-2 border-slate-200 text-slate-700 text-sm font-medium hover:bg-white inline-flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4" /> Tekshirish
            </button>
          </div>
        )}
        {holat && holat.token && !holat.tokenXato && !(wh && wh.ulangan) && (
          <p className="text-[11px] text-slate-400 mt-2">
            «Botni ulash» Telegramga xabarlarni shu saytga yuborishni aytadi. Agar shu bot boshqa dasturda
            (masalan kompyuterdagi eski Telegram dasturida) ishlayotgan bo'lsa, o'sha yerda to'xtaydi.
          </p>
        )}
      </div>

      {/* Ishchiga beriladigan havola */}
      {havola && (
        <div className="mb-3">
          <label className="block text-xs text-slate-500 mb-1">Ishchilarga shu havolani yuboring</label>
          <div className="flex gap-2">
            <a href={havola} target="_blank" rel="noreferrer"
              className="flex-1 min-w-0 truncate px-3 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-sky-700">
              <Send className="w-4 h-4 flex-shrink-0" /> t.me/{username}
            </a>
            <button type="button" title="Nusxalash"
              onClick={() => { navigator.clipboard?.writeText(havola); showToast('Havola nusxalandi'); }}
              className="px-3 py-2 rounded-lg border-2 border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Ishchi havolani ochib <b>START</b> ni, keyin <b>«📱 Telefonni ulashish»</b> ni bosadi. Raqami uning
            kartochkasidagi (Ishchilar → Ro'yxat) raqamlardan biri bo'lishi kerak. Kartochkadan raqam olib
            tashlansa — botdagi kirish ham yopiladi.
          </p>
        </div>
      )}

      {/* Xabar turlari */}
      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">Ishchiga xabar yuborilsin</div>
        <div className="space-y-1.5">
          {XABAR_TURLARI.map(({ k, label }) => (
            <label key={k} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 cursor-pointer select-none">
              <span className="text-sm text-slate-700">{label}</span>
              <input type="checkbox" checked={xabar[k] !== false} onChange={() => toggle(k)} className="w-4 h-4 accent-emerald-700" />
            </label>
          ))}
        </div>
      </div>

      {/* Kim ulangan */}
      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-semibold text-slate-700">Ulangan ishchilar</span>
          <span className="text-xs text-slate-500 tabular-nums">{ulanganSoni} / {faollar.length}</span>
        </div>
        {faollar.length === 0 ? (
          <p className="text-xs text-slate-400">Faol ishchi yo'q.</p>
        ) : (
          <div className="space-y-1.5">
            {faollar.map((i) => {
              const l = ulanganlar[i.id];
              const raqamBor = (i.phones || []).some((p) => normPhone(p).length >= 7);
              return (
                <div key={i.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-200">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{i.name}</div>
                    <div className={`text-[11px] ${l ? 'text-emerald-700' : raqamBor ? 'text-slate-400' : 'text-amber-700'}`}>
                      {l ? `✓ Ulangan${l.phone ? ` · +998 ${l.phone}` : ''}`
                        : raqamBor ? 'Hali ulanmagan' : 'Kartochkada telefon raqami yo\'q'}
                    </div>
                  </div>
                  {l && (
                    <button onClick={() => hisob(i)} disabled={!!yuborilmoqda[i.id]}
                      title="Ishchiga hozirgi hisobini botga yuborish"
                      className="flex-shrink-0 px-2.5 py-1.5 rounded-lg border-2 border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-1">
                      <Send className="w-3.5 h-3.5" /> {yuborilmoqda[i.id] ? '…' : 'Hisobini yuborish'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
