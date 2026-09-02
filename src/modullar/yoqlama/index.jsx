// ============================================================
//  YO'QLAMA / AVANS MODULI — sub-tab boshqaruvi (Belgilash / Avans / Maosh)
// ============================================================
import React, { useState } from 'react';
import { CalendarCheck, CalendarDays, Wallet, Banknote } from 'lucide-react';
import { YoqlamaBelgilash } from './Belgilash.jsx';
import { YoqlamaKalendar } from './Kalendar.jsx';
import { AvansTab } from './Avans.jsx';
import { MaoshTab } from './Maosh.jsx';
import { YoloControl } from './YoloControl.jsx';

export function YoqlamaModule({ ishchilar, yoqlama, setYoqlamaKun, setYoqlamaBulk, avanslar, updateAvanslar, setAvansYozuv, maoshlar, setMaoshYozuv, canMaosh, usdRate, showToast }) {
  const [sub, setSub] = useState('belgilash');

  // Maosh tugmasi faqat ruxsati borlarga (founder/admin) ko'rinadi —
  // ishchi boshqalarning maoshini ochib ko'rmasin.
  const tabs = [
    { k: 'belgilash', label: 'Belgilash', icon: CalendarCheck },
    { k: 'kalendar',  label: 'Kalendar',  icon: CalendarDays },
    { k: 'avans',     label: 'Avans',     icon: Wallet },
    ...(canMaosh ? [{ k: 'maosh', label: 'Maosh', icon: Banknote }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tabs.map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-medium border-2 transition ${
              sub === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {sub === 'belgilash' && <YoqlamaBelgilash ishchilar={ishchilar} yoqlama={yoqlama} setYoqlamaKun={setYoqlamaKun} setYoqlamaBulk={setYoqlamaBulk} showToast={showToast} />}
      {sub === 'kalendar' && <YoqlamaKalendar ishchilar={ishchilar} yoqlama={yoqlama} setYoqlamaKun={setYoqlamaKun} />}
      {sub === 'avans' && <AvansTab ishchilar={ishchilar} avanslar={avanslar} updateAvanslar={updateAvanslar} setAvansYozuv={setAvansYozuv} yoqlama={yoqlama} maoshlar={maoshlar} usdRate={usdRate} showToast={showToast} />}
      {sub === 'maosh' && canMaosh && (
        <MaoshTab ishchilar={ishchilar} yoqlama={yoqlama} avanslar={avanslar}
          maoshlar={maoshlar} setMaoshYozuv={setMaoshYozuv} usdRate={usdRate} showToast={showToast} />
      )}

      {/* Kamera nazorati (YOLO) — kundalik ish emas, shuning uchun eng pastda */}
      <YoloControl />
    </div>
  );
}
