// ============================================================
//  MAOSH — oylik maosh hisobi va to'lovi
// ------------------------------------------------------------
//  BIZNES QOIDASI: maosh har oyning 5-sanasida O'TGAN OY uchun
//  beriladi. Yangi oyning 1–5-kunlarida olingan AVANSLAR ham o'tgan oy
//  maoshidan ushlanadi (maosh hali berilmagan); yangi oy kunlarining
//  ishlagani / kelmagani esa bu hisobga KIRMAYDI.
//  Shuning uchun standart tanlangan oy = O'TGAN OY, va yozuvlar
//  'maoshlar[oy]' ga (qaysi oy UCHUN) yoziladi, createdAt esa
//  haqiqiy to'lov vaqti bo'lib qoladi (oyga majburlanmaydi).
//  Model: maoshlar = { 'YYYY-MM': { ishchiId: [ {id,method,amount,rate,createdAt,notes} ] } }
//  Hisob yadrosi: oylikBalans (src/lib/helpers.js) — Avans/Hisobot bilan bir mantiq.
// ============================================================
import React, { useState } from 'react';
import { Banknote, Check, ChevronDown, Trash2 } from 'lucide-react';
import { Card, SectionTitle, SmallModal } from '../../components/ui.jsx';
import { DynamicPaymentsSection } from '../sotuv/Tolovlar.jsx';
import {
  fmt, sonQiymat, toMonthInput, formatDate, formatDay, makeBlankPayment,
  avansYozuvlari, oylikBalans, oyFaolmi, daysInMonth, oylikYoqlama, MAOSH_KUNI,
} from '../../lib/helpers.js';
import { OY_NOMLARI, DEFAULT_USD_RATE } from '../../lib/constants.js';

function oyLabel(oy) {
  const [y, m] = oy.split('-');
  return `${OY_NOMLARI[parseInt(m, 10) - 1] || m} ${y}`;
}

// Standart oy — O'TGAN OY (joriy emas!): maosh o'tgan oy uchun beriladi.
function otganOy() {
  const d = new Date();
  return toMonthInput(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

export function MaoshTab({ ishchilar = [], yoqlama = {}, avanslar = {}, maoshlar = {},
                           setMaoshYozuv, usdRate, showToast }) {
  const [oy, setOy] = useState(otganOy());
  const [modal, setModal] = useState(null); // { ishchiId, payments: [...] }
  // Har bir ishchining to'lov yozuvlari ro'yxati alohida ochiladi. Sukut — yopiq.
  const [ochiq, setOchiq] = useState({}); // { [ishchiId]: true }
  const toggle = (id) => setOchiq((o) => ({ ...o, [id]: !o[id] }));

  const oyMaoshlar = maoshlar[oy] || {};
  // Oy tafsiloti — foydalanuvchi qaysi oy va necha kun haqida gap ketayotganini
  // bir qarashda ko'rsin (kunlik haq ham aynan shu kun soniga bo'linadi)
  const kunSoni = daysInMonth(oy);
  const oyOxiri = `${oy}-${String(kunSoni).padStart(2, '0')}`;

  // Shu oyda ishchi necha kun "kelmadi" deb belgilangan (yo'qlama xulosasi uchun)
  function kelmadiSoni(ishchiId) {
    let n = 0;
    for (const sana in yoqlama) {
      if (sana.startsWith(oy) && yoqlama[sana]?.[ishchiId] === 'kelmadi') n += 1;
    }
    return n;
  }

  // KO'RINADIGANLAR: tanlangan oyda faol bo'lganlar + KETGAN bo'lsa ham qoldig'i
  // noldan farqli qolganlar (hisob-kitobi hali yopilmagan bo'lishi mumkin!).
  // Har biriga oy balansi (b) birga hisoblab qo'yiladi — pastda qayta hisoblanmaydi.
  const korinadigan = ishchilar
    .map((i) => ({ i, b: oylikBalans(i, yoqlama, avanslar, maoshlar, oy) }))
    .filter(({ i, b }) => oyFaolmi(i, oy) || Math.round(b.qoldiq) !== 0);

  // Tepadagi jami — ko'rinayotgan ishchilar bo'yicha hali to'lanishi kerak bo'lgan summa
  // (manfiy qoldiq boshqa ishchinikini yashirmasin — faqat musbatlari qo'shiladi)
  const jamiQoldiq = korinadigan.reduce((s, { b }) => s + (b.qoldiq > 0 ? b.qoldiq : 0), 0);

  function openModal(ishchiId, qoldiq) {
    // Birinchi to'lov summasi oldindan qoldiq bilan to'ldiriladi
    // (qoldiq bo'lmasa — "0" emas, bo'sh maydon: yozishga xalaqit bermasin)
    setModal({
      ishchiId,
      payments: [{ ...makeBlankPayment(usdRate), amount: qoldiq > 0 ? String(Math.round(qoldiq)) : '' }],
    });
  }

  function saveModal() {
    if (!modal) return;
    const valid = modal.payments
      .filter((p) => sonQiymat(p.amount) > 0)
      // Kurs bo'sh qolsa — usdRate, u ham bo'lmasa standart kurs (Firestore'ga
      // undefined ketmasin; ko'rsatishdagi zanjir bilan bir xil).
      .map((p) => ({
        ...p,
        amount: sonQiymat(p.amount),
        rate: sonQiymat(p.rate) || sonQiymat(usdRate) || DEFAULT_USD_RATE,
      }));
    // createdAt HOZIRGI vaqt bo'lib qoladi — maosh keyingi oyda beriladi,
    // shuning uchun sanani (Avans'dagi kabi) oyga majburlash KERAK EMAS.
    if (valid.length === 0) { showToast('Summani kiriting'); return; }

    const oldList = avansYozuvlari(oyMaoshlar[modal.ishchiId], oy);
    setMaoshYozuv(oy, modal.ishchiId, [...oldList, ...valid]);
    // Yangi yozuv darhol ko'rinsin — shu ishchining ro'yxatini ochamiz
    setOchiq((o) => ({ ...o, [modal.ishchiId]: true }));
    setModal(null);
    showToast('Maosh yozildi');
  }

  function deleteEntry(ishchiId, entryId) {
    if (!window.confirm("Bu maosh yozuvi o'chirilsinmi?")) return;
    const list = avansYozuvlari(oyMaoshlar[ishchiId], oy).filter((e) => e.id !== entryId);
    setMaoshYozuv(oy, ishchiId, list);
    showToast("Maosh yozuvi o'chirildi");
  }

  const modalIshchi = modal ? ishchilar.find((i) => i.id === modal.ishchiId) : null;
  // Modal ochiq ishchining qoldig'i — DynamicPaymentsSection'dagi "to'liq" tugmasi
  // uchun (Dollorda tanlansa summani kursda o'zi hisoblab beradi).
  const modalQoldiq = modalIshchi
    ? oylikBalans(modalIshchi, yoqlama, avanslar, maoshlar, oy).qoldiq
    : 0;

  // Hisob jadvalining bitta qatori
  const Qator = ({ label, value, sign = '', klass = 'text-slate-700' }) => (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1">
      <span className="text-slate-500">{sign && <span className="mr-1">{sign}</span>}{label}</span>
      <span className={`font-semibold tabular-nums ${klass}`}>{fmt(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Banknote}>Maosh — {oyLabel(oy)}</SectionTitle>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Qaysi oy uchun</label>
            <input type="month" value={oy} onChange={(e) => setOy(e.target.value || otganOy())}
              className="px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">To'lanishi kerak (jami)</div>
            <div className="font-bold tabular-nums text-emerald-700">{fmt(jamiQoldiq)} so'm</div>
          </div>
        </div>
        {/* Oy tafsiloti — qaysi oy, necha kun, qaysi oraliq */}
        <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{oyLabel(oy)}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold tabular-nums">{kunSoni} kun</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums">{formatDay(`${oy}-01`)} — {formatDay(oyOxiri)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Maosh {MAOSH_KUNI}-sanada O'TGAN OY uchun beriladi. Keyingi oyning 1–{MAOSH_KUNI}-kunlarida
          olingan avanslar ham shu oydan ushlanadi; keyingi oy kunlari (ishlagani / kelmagani) hisobga kirmaydi.
          Kunlik haq = oylik ÷ {kunSoni} kun.
        </p>
      </Card>

      {ishchilar.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Avval "Ishchilar → Ro'yxat" bo'limidan ishchi qo'shing</p></Card>
      ) : korinadigan.length === 0 ? (
        <Card><p className="text-sm text-slate-400 text-center py-6">Bu oyda faol yoki qoldig'i bor ishchi yo'q</p></Card>
      ) : (
        korinadigan.map(({ i, b }) => {
          const entries = avansYozuvlari(oyMaoshlar[i.id], oy);
          const tolangan = b.qoldiq <= 0;
          // Yo'qlama xulosasi va kunlik haq — "ishlangan" raqami qayerdan
          // kelganini ko'rsatish uchun (oylik ÷ oydagi kunlar × ishlangan kunlar)
          const y = oylikYoqlama(yoqlama, oy, i.id);
          const kelmadi = kelmadiSoni(i.id);
          const kunlik = kunSoni ? (Number(i.oylikHaqq) || 0) / kunSoni : 0;
          return (
            <Card key={i.id}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0">{(i.name || '?').charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{i.name}</div>
                    {i.lavozim && <div className="text-xs text-slate-400">{i.lavozim}</div>}
                    {i.ishdanKetgan && (
                      <span className="inline-flex items-center text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 mt-0.5">
                        Ishdan ketgan · {formatDay(i.ishdanKetgan)}
                      </span>
                    )}
                  </div>
                </div>
                {tolangan && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                    <Check className="w-3.5 h-3.5" /> To'langan
                  </span>
                )}
              </div>

              {/* OY XULOSASI — oylik/kunlik haq va yo'qlama (ishlangan qayerdan kelgani) */}
              <div className="flex flex-wrap gap-1.5 mb-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
                  Oylik {fmt(i.oylikHaqq)} · kunlik {fmt(kunlik)} so'm
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
                  Keldi {y.toliq} · kelmadi {kelmadi}
                </span>
              </div>

              {/* HISOB JADVALI — oy bo'yicha to'liq hisob */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 text-xs divide-y divide-slate-100 mb-2">
                <Qator label="Oy boshida qoldiq" value={b.boshida}
                  klass={b.boshida >= 0 ? 'text-emerald-700' : 'text-red-600'} />
                <Qator label={`Shu oyda ishlangan (${y.jamiKun} kun)`} value={b.ishlangan} sign="+" />
                <Qator label={`Avans (shu oy + keyingi oy 1–${MAOSH_KUNI}-kun)`} value={b.avans} sign="−" klass="text-amber-700" />
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-100">
                  <span className="font-bold text-slate-700">= Oy yakuni (jami haq)</span>
                  <span className="font-bold tabular-nums text-slate-900">{fmt(b.yakun)}</span>
                </div>
                {b.maosh > 0 && <Qator label="Maosh to'langan" value={b.maosh} sign="−" klass="text-sky-700" />}
                <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="font-bold uppercase tracking-wide text-slate-500 text-[11px]">Qoldiq (to'lash kerak)</span>
                  <span className={`text-base font-bold tabular-nums ${b.qoldiq > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>
                    {fmt(b.qoldiq)} so'm
                  </span>
                </div>
              </div>

              {/* Shu oy uchun to'langan maosh yozuvlari — sukut bo'yicha yopiq */}
              {entries.length > 0 && (
                <button type="button" onClick={() => toggle(i.id)} aria-expanded={!!ochiq[i.id]}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-slate-600 mb-2">
                  <span>{entries.length} ta to'lov · {ochiq[i.id] ? 'yashirish' : "ko'rish"}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${ochiq[i.id] ? 'rotate-180' : ''}`} />
                </button>
              )}

              {entries.length > 0 && ochiq[i.id] && (
                <div className="space-y-1 mb-2 text-xs">
                  {entries.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 border border-slate-100 bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="text-slate-700">
                          <span className="font-medium">{p.method}</span>
                          {p.notes ? <span className="text-slate-400"> · {p.notes}</span> : ''}
                        </div>
                        {p.createdAt && <div className="text-[11px] text-slate-400">{formatDate(p.createdAt)}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-semibold tabular-nums text-slate-800">
                          {p.method === 'Dollorda'
                            ? `${fmt(p.amount)} $ (${fmt(sonQiymat(p.amount) * sonQiymat(p.rate))} so'm)`
                            : `${fmt(p.amount)} so'm`}
                        </span>
                        <button onClick={() => deleteEntry(i.id, p.id)} className="text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => openModal(i.id, b.qoldiq)}
                className={`w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${
                  b.qoldiq > 0
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50'
                }`}>
                <Banknote className="w-4 h-4" /> Maosh berish
              </button>
            </Card>
          );
        })
      )}

      {modal && (
        <SmallModal onClose={() => setModal(null)} title={`Maosh — ${modalIshchi?.name || ''} (${oyLabel(oy)})`}>
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <DynamicPaymentsSection
              payments={modal.payments}
              onChange={(pList) => setModal({ ...modal, payments: pList })}
              usdRate={usdRate}
              qoldiq={modalQoldiq > 0 ? modalQoldiq : 0}
            />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-700 hover:bg-slate-50">Bekor</button>
              <button onClick={saveModal}
                className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Maosh berish
              </button>
            </div>
          </div>
        </SmallModal>
      )}
    </div>
  );
}
