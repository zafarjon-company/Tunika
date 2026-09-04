// ============================================================
//  OMBOR (SKLAD) MODULI — sub-tab boshqaruvi
//  Materiallar / Harakat / Rulonlar
// ------------------------------------------------------------
//  MATERIALLAR (eski qism): ombor = { [id]: Material },
//  omborHarakat = { [id]: Harakat }. Yozish props orqali:
//    setOmborItem(id, material|null)  — bitta material (null = o'chirish)
//    setHarakat(id, harakat)          — bitta harakat yozuvi
//
//  RULONLAR (yangi qism): ombordagi rulonlar va ularning 1 metr uchun
//  tannarxi/sotuv narxi — daftar jadvali tartibida. Har rulon o'z narxi
//  ($/t), kursi va yo'lkirasi bilan yoziladi; standart qiymatlar
//  (kurs, yo'lkira, bo'luvchilar, kg/m) FIRESTORE'dan keladi — kodda narx yo'q.
//    omborRulonlar = { [id]: Rulon },  setRulon(id, rulon|null)
//    omborSozlama  = { kurs, yolkiraTonna, bolizvchi1, bolizvchi2, nom1, nom2,
//                      kgPerM, koefSMZ, koefBoshqa, kursSana, zavodlar, turlar, ranglar }
//    omborRangTur  = { qoidalar: [{ naqsh, tur }], standart }
// ============================================================
import React, { useState, useMemo } from 'react';
import { Boxes, History, Layers, AlertTriangle } from 'lucide-react';
import { StatBox } from '../../components/ui.jsx';
import { fmt } from '../../lib/helpers.js';
import { omborRoyxat, kamQoldiqlar, birlikBelgisi } from '../../lib/ombor.js';
import { Materiallar } from './Materiallar.jsx';
import { Harakat } from './Harakat.jsx';
import { Rulonlar } from './Rulonlar.jsx';
import { OmborSozlama } from './OmborSozlama.jsx';

const SUB_TABLAR = [
  { k: 'materiallar', label: 'Materiallar',    icon: Boxes },
  { k: 'harakat',     label: 'Harakat',        icon: History },
  { k: 'rulonlar',    label: 'Rulonlar',       icon: Layers },
];

export function OmborModule({
  ombor = {}, omborHarakat = {}, setOmborItem, setHarakat,
  tunikaBaza = [], metrlilar = [], aksessuarlar = [], kaziroklar = [],
  ranglar = [], currentUser, canEdit = true, showToast,
  // ----- Rulonlar qismi -----
  omborRulonlar = {}, omborSozlama = {}, omborRangTur = {},
  setRulon, updateOmborSozlama, updateOmborRangTur, seedOmbor, omborQaytaNomla,
}) {
  const [sub, setSub] = useState('materiallar');

  const royxat = useMemo(() => omborRoyxat(ombor), [ombor]);
  const kamlar = useMemo(() => kamQoldiqlar(ombor), [ombor]);
  const qiymat = useMemo(
    () => royxat.reduce((s, m) => s + (Number(m.qoldiq) || 0) * (Number(m.tanNarx) || 0), 0),
    [royxat],
  );

  // Material statistikasi faqat material bo'limlarida ko'rinadi — Rulonlar
  // bo'limi o'zining statistikasini ko'rsatadi (chalkashmasin).
  const materialBolimi = sub === 'materiallar' || sub === 'harakat';

  return (
    <div className="space-y-4">
      {materialBolimi && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Materiallar" value={royxat.length} />
            <StatBox label="Kam qoldiq" value={kamlar.length} color="amber" />
            <StatBox label="Ombor qiymati" value={Math.round(qiymat)} suffix="so'm" />
          </div>

          {kamlar.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 text-white flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                  Kam qolgan materiallar ({kamlar.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kamlar.map((m) => (
                  <span key={m.id} className="px-2 py-1 rounded-lg bg-white border border-amber-300 text-xs text-amber-900">
                    <b>{m.nomi}</b>
                    <span className="tabular-nums"> — {fmt(m.qoldiq)} {birlikBelgisi(m.birlik)}</span>
                    <span className="text-amber-600"> (min {fmt(m.minQoldiq)})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {SUB_TABLAR.map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-3 px-3 rounded-lg font-medium border-2 transition whitespace-nowrap ${
              sub === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {sub === 'materiallar' && (
        <Materiallar
          ombor={ombor} setOmborItem={setOmborItem} setHarakat={setHarakat}
          tunikaBaza={tunikaBaza} metrlilar={metrlilar} aksessuarlar={aksessuarlar} kaziroklar={kaziroklar}
          ranglar={ranglar} currentUser={currentUser} canEdit={canEdit} showToast={showToast} />
      )}
      {sub === 'harakat' && <Harakat omborHarakat={omborHarakat} ombor={ombor} />}

      {/* Rulonlar: sozlamalar paneli sahifa yuqorisida (3.2-bo'lim), tagida jadval */}
      {sub === 'rulonlar' && (
        <>
          <OmborSozlama
            sozlama={omborSozlama} updateSozlama={updateOmborSozlama}
            rangTur={omborRangTur} updateRangTur={updateOmborRangTur}
            rulonlar={omborRulonlar}
            canEdit={canEdit} showToast={showToast} onSeed={seedOmbor}
            onQaytaNomla={omborQaytaNomla} />
          <Rulonlar
            rulonlar={omborRulonlar}
            sozlama={omborSozlama} rangTur={omborRangTur}
            setRulon={setRulon} canEdit={canEdit} showToast={showToast} />
        </>
      )}

    </div>
  );
}
