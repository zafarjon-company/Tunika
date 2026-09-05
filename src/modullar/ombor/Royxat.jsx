// ============================================================
//  OMBOR → RO'YXAT — sotuv uchun qisqa narx ro'yxati
// ------------------------------------------------------------
//  Barcha rulonlar FAQAT eng kerakli ma'lumoti bilan:
//    Kimdan (zavod) · Tur · Rang · Qalinlik · 1-narx (5%) · 2-narx (10%) · kg/m
//  Narxlar — Rulonlar formasida foydalanuvchi KIRITGAN (yaxlitlangan)
//  sotuv narxlari; kiritilmagan bo'lsa hisoblangani (och rangda).
//  kg/m — 1 m og'irligi = jami og'irlik ÷ jami uzunlik (omborHisob.kgMetr).
//  Faqat ko'rish — tahrirlash Rulonlar bo'limida.
//
//  Hisob src/lib/omborHisob.js da; bu faylda narx yo'q. Faqat mavzu
//  qayta bo'yaydigan Tailwind klasslari ishlatiladi (qorong'i mavzu uchun).
// ============================================================
import React, { useState, useMemo } from 'react';
import { ClipboardList, Search, X } from 'lucide-react';
import { Card, SectionTitle, rangChipStyle } from '../../components/ui.jsx';
import { fmt } from '../../lib/helpers.js';
import { hisobla, qalKor, son, norm } from '../../lib/omborHisob.js';
import { sozlamaRoyxat } from '../../lib/omborSeed.js';

// Rang namunasi — rang nomidan asos rang (Rulonlar.jsx dagi bilan bir xil qoida)
function rangAsos(rang) {
  const s = norm(rang);
  if (!s) return '';
  if (/atsenk|atsink|otsink|aksink|sinkov/.test(s)) return 'Aksinkofka';
  const asos = s.replace(/\b(yaltiroq|salafan|plyonka|mebel|mat)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return asos || rang;
}
function RangNamuna({ rang }) {
  if (!rang) return <span className="w-4 h-4 rounded border border-slate-300 bg-slate-100 inline-block flex-shrink-0" />;
  return <span className="w-4 h-4 rounded border border-black/10 inline-block flex-shrink-0" title={rang} style={rangChipStyle(rangAsos(rang))} />;
}

// 1 m og'irligi — o'lchov (pul emas): ikki xona bilan, yo'q bo'lsa "—"
function kgMetrKor(v) {
  return v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(2);
}

// Narx katagi: kiritilgani — qalin; hisoblangani — och, title bilan
function NarxKatak({ qiymat, qolda, hisob }) {
  if (qiymat == null) return <td className="px-2 py-1.5 text-right text-slate-400">—</td>;
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${qolda ? 'font-bold text-slate-900' : 'text-slate-500'}`}
      title={qolda ? `Kiritilgan (hisob: ${fmt(hisob)})` : "Hisoblangan — Rulonlar bo'limida yaxlitlab kiritsa bo'ladi"}>
      {fmt(qiymat)}
    </td>
  );
}

// Zavod → tur → rang → qalinlik tartibi
function solish(a, b) {
  const k = ['zavod', 'tur', 'rang'];
  for (const x of k) {
    const c = norm(a[x]).localeCompare(norm(b[x]), 'uz');
    if (c) return c;
  }
  return (son(a.qalinlik) ?? 0) - (son(b.qalinlik) ?? 0) || (son(a.nomer) ?? 0) - (son(b.nomer) ?? 0);
}

export function Royxat({ rulonlar = {}, sozlama = {} }) {
  const [q, setQ] = useState('');
  const [zavod, setZavod] = useState('');
  const [tur, setTur] = useState('');

  const nom1 = sozlama.nom1 || '1-narx';
  const nom2 = sozlama.nom2 || '2-narx';

  const qatorlar = useMemo(() => hisobla(rulonlar, { sozlama }), [rulonlar, sozlama]);

  // Filtr ro'yxatlari: sozlamadagi + mavjud rulonlardagi noyob nomlar
  const zavodlar = useMemo(() => {
    const out = [...sozlamaRoyxat(sozlama, 'zavodlar')];
    for (const r of qatorlar) if (r.zavod && !out.some((z) => norm(z) === norm(r.zavod))) out.push(r.zavod);
    return out;
  }, [sozlama, qatorlar]);
  const turlar = useMemo(() => {
    const out = [...sozlamaRoyxat(sozlama, 'turlar')];
    for (const r of qatorlar) if (r.tur && !out.some((t) => norm(t) === norm(r.tur))) out.push(r.tur);
    return out;
  }, [sozlama, qatorlar]);

  const korinadigan = useMemo(() => {
    const qq = norm(q);
    return qatorlar
      .filter((r) => (!zavod || norm(r.zavod) === norm(zavod))
        && (!tur || norm(r.tur) === norm(tur))
        && (!qq || norm(r.rang).includes(qq) || norm(r.zavod).includes(qq) || norm(r.tur).includes(qq) || qalKor(r.qalinlik).includes(qq)))
      .sort(solish);
  }, [qatorlar, q, zavod, tur]);

  const filtrBor = q || zavod || tur;
  const sel = 'px-2 py-1.5 border border-slate-300 rounded bg-white text-xs';

  return (
    <Card>
      <SectionTitle icon={ClipboardList}>Narx ro'yxati ({korinadigan.length})</SectionTitle>
      <p className="text-[11px] text-slate-500 -mt-2 mb-3">
        Rulonlar bo'limida kiritilgan yaxlitlangan sotuv narxlari. Och rangdagi narx — hali qo'lda
        kiritilmagan, hisoblangani ko'rsatilyapti. kg/m — 1 metr og'irligi (og'irlik ÷ uzunlik).
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Rang, kimdan, tur yoki qalinlik"
            className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded bg-white text-xs" />
        </div>
        <select value={zavod} onChange={(e) => setZavod(e.target.value)} className={sel}>
          <option value="">Hammasi (kimdan)</option>
          {zavodlar.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select value={tur} onChange={(e) => setTur(e.target.value)} className={sel}>
          <option value="">Barcha turlar</option>
          {turlar.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {filtrBor && (
          <button type="button" onClick={() => { setQ(''); setZavod(''); setTur(''); }}
            className="px-2.5 py-1.5 rounded border-2 border-slate-200 bg-white text-slate-600 text-xs flex items-center gap-1 hover:bg-slate-50">
            <X className="w-3.5 h-3.5" /> Tozalash
          </button>
        )}
      </div>

      {korinadigan.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm text-slate-500">{qatorlar.length === 0 ? "Rulonlar bo'limida hali rulon yo'q" : 'Filtrga mos rulon topilmadi'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[620px]">
            <thead>
              <tr className="text-xs text-slate-500 border-b-2 border-slate-200">
                <th className="py-2 px-2 text-left font-semibold">№</th>
                <th className="py-2 px-2 text-left font-semibold">Kimdan</th>
                <th className="py-2 px-2 text-left font-semibold">Tur</th>
                <th className="py-2 px-2 text-left font-semibold">Rang</th>
                <th className="py-2 px-2 text-right font-semibold" title="Qalinlik, mm">Qal.</th>
                <th className="py-2 px-2 text-right font-semibold text-slate-900" title="Sotuv narxi, 1 m (so'm)">{nom1}</th>
                <th className="py-2 px-2 text-right font-semibold text-slate-900" title="Sotuv narxi, 1 m (so'm)">{nom2}</th>
                <th className="py-2 px-2 text-right font-semibold" title="1 m og'irligi = jami og'irlik ÷ jami uzunlik">kg/m</th>
              </tr>
            </thead>
            <tbody>
              {korinadigan.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-2 py-1.5 tabular-nums text-slate-500">{r.nomer == null || r.nomer === '' ? '—' : r.nomer}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-900">{r.zavod || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-700">{r.tur || '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-slate-900"><RangNamuna rang={r.rang} />{r.rang || '—'}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">{qalKor(r.qalinlik) || '—'}</td>
                  <NarxKatak qiymat={r.h.sotuv1} qolda={r.h.sotuv1Qolda} hisob={r.h.sotuv1Hisob} />
                  <NarxKatak qiymat={r.h.sotuv2} qolda={r.h.sotuv2Qolda} hisob={r.h.sotuv2Hisob} />
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-700"
                    title={r.h.kgMetr == null ? "Uzunlik kiritilmagan" : `${r.ogirlik} kg ÷ ${r.h.uzunlik} m`}>
                    {kgMetrKor(r.h.kgMetr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
