// ============================================================
//  OMBOR → ZAVOD NARX RO'YXATI (3.3-bo'lim)
// ------------------------------------------------------------
//  Zavodlarning narx ro'yxatini to'liq boshqaradi: qo'shish,
//  tahrirlash, o'chirish, filtr, saralash, zavod+tur bo'yicha
//  guruhlash va "yangi narx ro'yxati" (eski yozuvlarni ARXIVLAB,
//  yangi sana bilan yangi yozuvlar qo'shish).
//
//  Yozuv: { id, zavod, tur, qalinlik, narx, sana, faol }
//    narx  — zavod ro'yxatidagi TOZA narx, $/tonna (ustama qo'shilmagan)
//    sana  — 'YYYY-MM-DD' (narx ro'yxati sanasi)
//    faol  — false = TARIX: hisobda ishlatilmaydi, lekin O'CHIRILMAYDI
//
//  QAT'IY QOIDA: bu faylda birorta narx/kurs/koeffitsient qattiq
//  yozilmagan — hamma qiymat props orqali (Firestore'dan) keladi.
// ============================================================
import React, { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit3, Tags, ChevronDown, ChevronUp,
  AlertTriangle, Check, History, Save, X,
} from 'lucide-react';
import { Card, SectionTitle, StatBox, SmallModal, SegmentedControl } from '../../components/ui.jsx';
import { fmt, genId, sonMatn, sonQiymat, toDateInput, formatDay } from '../../lib/helpers.js';
import { sozlamaRoyxat } from '../../lib/omborSeed.js';
import { son, norm, narxRoyxat } from '../../lib/omborHisob.js';

// ----- Kichik yordamchilar -----

// Qalinlikni ko'rsatish: 0.4 → "0.40", bo'sh → "—"
const qalinlikMatn = (q) => {
  const v = son(q);
  return v == null ? '—' : v.toFixed(2);
};

// Dublikat (va guruh) kaliti — registr/apostrof farqisiz
const dubKalit = (n) => `${norm(n.zavod)}|${norm(n.tur)}|${son(n.qalinlik)}`;
const guruhKalit = (n) => `${norm(n.zavod)}|${norm(n.tur)}`;

// Standart tartib: zavod → tur → qalinlik
function standartCmp(a, b) {
  return String(a.zavod || '').localeCompare(String(b.zavod || ''))
    || String(a.tur || '').localeCompare(String(b.tur || ''))
    || ((son(a.qalinlik) || 0) - (son(b.qalinlik) || 0));
}

// Bitta ustun bo'yicha taqqoslash
function ustunCmp(a, b, k) {
  if (k === 'qalinlik' || k === 'narx') return (son(a[k]) || 0) - (son(b[k]) || 0);
  if (k === 'sana') return String(a.sana || '').localeCompare(String(b.sana || ''));
  return String(a[k] || '').localeCompare(String(b[k] || ''));
}

// Ro'yxatdagi noyob qiymatlar (bo'shlari tashlanadi) + standart ro'yxat
function birlashtir(standart, royxat, maydon) {
  const bor = new Set(standart.map((x) => norm(x)));
  const qoshimcha = [];
  for (const n of royxat) {
    const v = (n[maydon] || '').trim();
    if (!v || bor.has(norm(v))) continue;
    bor.add(norm(v));
    qoshimcha.push(v);
  }
  qoshimcha.sort((a, b) => a.localeCompare(b));
  return [...standart, ...qoshimcha];
}

// Bo'sh forma (narx/qalinlik — matn, chunki vergul ham qabul qilinadi)
const BLANK = { zavod: '', tur: '', qalinlik: '', narx: '', sana: '', faol: true };

// Umumiy input uslublari (loyihadagi mavjud uslub)
const INP = 'w-full px-2 py-1.5 border border-slate-300 rounded bg-white';
const INP_NUM = `${INP} tabular-nums`;

// ----- Zavod / tur tanlash (mavjud qiymatlar ham ro'yxatga qo'shiladi) -----
function Tanla({ label, value, onChange, options, bosh = '— tanlang —' }) {
  return (
    <div>
      {label && <label className="block text-slate-500 mb-1">{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INP}>
        <option value="">{bosh}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ----- Bitta hujayra qiymati (ustun kalitiga qarab) -----
function hujayra(n, k) {
  if (k === 'zavod') return n.zavod || '—';
  if (k === 'tur') return n.tur || '—';
  if (k === 'qalinlik') return qalinlikMatn(n.qalinlik);
  if (k === 'narx') return fmt(n.narx);
  return formatDay(n.sana) || '—';
}

// ----- Jadvalning bitta qatori -----
//  nofaol (faol:false) — kulrang va chizilgan; dub — dublikat ogohi (sariq fon).
function Qator({ n, ustunlar, canEdit, dub, onFaol, onTahrir, onOchir }) {
  const nofaol = n.faol === false;
  return (
    <tr className={`border-t border-slate-100 ${dub ? 'bg-amber-50' : ''} ${nofaol ? 'text-slate-400' : 'text-slate-700'}`}>
      {ustunlar.map((u) => (
        <td key={u.k}
          className={`px-2 py-1.5 ${u.right ? 'text-right tabular-nums' : ''} ${nofaol ? 'line-through' : ''} ${
            u.k === 'narx' && !nofaol ? 'font-semibold text-slate-900' : ''}`}>
          {u.k === 'qalinlik' && dub && (
            <AlertTriangle className="w-3 h-3 inline-block mr-1 text-amber-600 align-[-1px]" />
          )}
          {hujayra(n, u.k)}
        </td>
      ))}

      {/* Faol / tarix o'tkazgichi */}
      <td className="px-2 py-1.5 text-center">
        {canEdit ? (
          <button onClick={() => onFaol(n)} title={nofaol ? 'Faollashtirish' : 'Arxivlash'}
            className={`w-6 h-6 rounded-md border flex items-center justify-center mx-auto ${
              nofaol ? 'border-slate-200 text-slate-300 bg-white' : 'border-emerald-200 text-emerald-600 bg-emerald-50'}`}>
            {nofaol ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </button>
        ) : (
          <span className={`text-[10px] ${nofaol ? 'text-slate-400' : 'text-emerald-600'}`}>
            {nofaol ? 'tarix' : 'faol'}
          </span>
        )}
      </td>

      {canEdit && (
        <td className="px-2 py-1.5">
          <div className="flex gap-1 justify-end">
            <button onClick={() => onTahrir(n)} title="Tahrirlash"
              className="w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-500 flex items-center justify-center">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onOchir(n)} title="O'chirish"
              className="w-6 h-6 rounded-md border border-red-200 bg-white text-red-600 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ----- Saralanadigan jadval sarlavhasi -----
function BoshUstun({ ustun, sort, onSort }) {
  const faol = sort.ustun === ustun.k;
  return (
    <th
      onClick={() => onSort(ustun.k)}
      title="Saralash uchun bosing"
      className={`px-2 py-2 font-semibold whitespace-nowrap cursor-pointer select-none ${
        ustun.right ? 'text-right' : 'text-left'} ${faol ? 'text-slate-900' : 'text-slate-500'}`}
    >
      <span className={`inline-flex items-center gap-0.5 ${ustun.right ? 'flex-row-reverse' : ''}`}>
        {ustun.label}
        {faol && (sort.yon === 'asc'
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />)}
      </span>
    </th>
  );
}

// ============================================================
//  YANGI NARX RO'YXATI OYNASI
// ------------------------------------------------------------
//  Zavod (yoki hammasi) + tur (yoki hammasi) + YANGI SANA tanlanadi,
//  mavjud FAOL yozuvlar qalinliklari bilan chiqadi, har biriga yangi
//  narx yoziladi. Saqlanganda: narx kiritilgan ESKI yozuv faol:false
//  ga o'tadi (o'chirilmaydi — tarix), o'rniga yangi sana bilan YANGI
//  yozuv qo'shiladi.
//
//  Narx kiritilmagan qatorlar standart holatda TEGILMAYDI (eski sana
//  bilan faol qoladi) — chunki ularni ham arxivlash o'sha qalinlikni
//  FAOL narxsiz qoldiradi. Kimga to'liq almashtirish kerak bo'lsa —
//  "narx kiritilmagan eski qatorlarni ham arxivlash" belgisi bor.
//  Tasdiq panelida uchala son (qo'shiladi / arxivlanadi / tegilmaydi)
//  alohida ko'rsatiladi.
// ============================================================
function YangiRoyxatModal({ royxat, zavodlar, turlar, band, onClose, onSaqla }) {
  const [zavod, setZavod] = useState('');
  const [tur, setTur] = useState('');
  const [sana, setSana] = useState(toDateInput());
  const [kiritilgan, setKiritilgan] = useState({}); // { [eskiId]: 'matn' }
  const [hammasiniArxivla, setHammasiniArxivla] = useState(false);

  // Tanlovga mos FAOL yozuvlar (zavod/tur bo'sh = hammasi)
  const moslar = useMemo(() => royxat
    .filter((n) => n.faol !== false)
    .filter((n) => !zavod || norm(n.zavod) === norm(zavod))
    .filter((n) => !tur || norm(n.tur) === norm(tur))
    .slice()
    .sort(standartCmp), [royxat, zavod, tur]);

  // Narxi kiritilgan (musbat) qatorlar — YANGI yozuv aynan shular uchun qo'shiladi
  const qoshiladi = moslar
    .map((n) => ({ eski: n, yangiNarx: sonQiymat(kiritilgan[n.id]) }))
    .filter((x) => x.yangiNarx > 0);

  // Arxivlanadigan ESKI yozuvlar — qo'shish ro'yxatidan ALOHIDA hisoblanadi:
  //  standart — faqat o'rniga yangisi yoziladiganlar;
  //  belgi yoqilsa — tanlovdagi barcha mos yozuvlar (to'liq almashtirish).
  const yangiliklar = new Set(qoshiladi.map((x) => x.eski.id));
  const arxivlanadi = hammasiniArxivla ? moslar : moslar.filter((n) => yangiliklar.has(n.id));
  const tegilmaydi = moslar.length - arxivlanadi.length;
  // Yangi narxsiz arxivlanadiganlar — ular uchun FAOL narx qolmaydi (ogohlantiriladi)
  const narxsizQoladi = arxivlanadi.filter((n) => !yangiliklar.has(n.id)).length;

  const tayyor = qoshiladi.length > 0 && !!sana;

  function eskilarBilanToldir() {
    const next = { ...kiritilgan };
    for (const n of moslar) next[n.id] = String(son(n.narx) || '');
    setKiritilgan(next);
  }

  return (
    <SmallModal onClose={onClose} title="Yangi narx ro'yxati">
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <Tanla label="Zavod" value={zavod} onChange={setZavod} options={zavodlar} bosh="Hammasi" />
          <Tanla label="Tur" value={tur} onChange={setTur} options={turlar} bosh="Hammasi" />
        </div>

        <div>
          <label className="block text-slate-500 mb-1">Yangi ro'yxat sanasi *</label>
          <input type="date" value={sana} onChange={(e) => setSana(e.target.value)} className={INP} />
        </div>

        {moslar.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-slate-500">{moslar.length} ta faol qalinlik topildi</div>
            <button type="button" onClick={eskilarBilanToldir}
              className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-600">
              Eski narxlar bilan to'ldirish
            </button>
          </div>
        )}

        {moslar.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <Tags className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Bu tanlovda faol narx yo'q</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Zavod / tur</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Qalinlik</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Eski $/t</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Yangi $/t</th>
                </tr>
              </thead>
              <tbody>
                {moslar.map((n) => {
                  const yangi = sonQiymat(kiritilgan[n.id]);
                  const eski = son(n.narx) || 0;
                  return (
                    <tr key={n.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <div className="font-semibold text-slate-800 truncate">{n.zavod || '—'}</div>
                        <div className="text-[10px] text-slate-400 truncate">{n.tur || '—'}</div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{qalinlikMatn(n.qalinlik)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmt(n.narx)}</td>
                      <td className="px-2 py-1.5 text-right w-24">
                        <input inputMode="decimal" value={kiritilgan[n.id] ?? ''}
                          onChange={(e) => {
                            const s = sonMatn(e.target.value);
                            if (s !== null) setKiritilgan({ ...kiritilgan, [n.id]: s });
                          }}
                          onFocus={(e) => e.target.select()} placeholder="—"
                          className={`${INP_NUM} text-right ${yangi > 0 && yangi !== eski ? 'border-slate-900' : ''}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Narx kiritilmagan qatorlarni ham arxivlash (to'liq almashtirish) */}
        {moslar.length > 0 && (
          <label className="flex items-start gap-2 text-slate-600">
            <input type="checkbox" checked={hammasiniArxivla} className="mt-0.5"
              onChange={(e) => setHammasiniArxivla(e.target.checked)} />
            <span>
              Narx kiritilmagan eski qatorlarni ham arxivlash
              <span className="block text-[10px] text-slate-400">
                Yoqilsa, bu tanlovdagi barcha eski yozuvlar tarixga o'tadi — ro'yxatda ikki xil sana aralashmaydi.
              </span>
            </span>
          </label>
        )}

        {/* Tasdiqlashdan oldingi hisobot — uchala son ALOHIDA */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Yangi narx kiritildi (yozuv qo'shiladi)</span>
            <b className="tabular-nums text-slate-900">{qoshiladi.length} ta</b>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Arxivlanadi (faol emas bo'ladi)</span>
            <b className="tabular-nums text-slate-900">{arxivlanadi.length} ta</b>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tegilmaydi (eski sana bilan faol qoladi)</span>
            <b className="tabular-nums text-slate-900">{tegilmaydi} ta</b>
          </div>
          <div className="text-[10px] text-slate-400">
            Eski yozuvlar o'chirilmaydi — tarix sifatida saqlanadi.
          </div>
        </div>

        {/* Tegilmagan qatorlar — ro'yxatda ikki xil sana qoladi */}
        {tegilmaydi > 0 && (
          <div className="text-[10px] text-slate-500">
            <b className="tabular-nums">{tegilmaydi}</b> ta qalinlik eski sanasi bilan faol qoladi —
            "Oxirgi sana" butun ro'yxatni ifodalamaydi.
          </div>
        )}

        {/* Yangi narxsiz arxivlash — o'sha qalinlik FAOL narxsiz qoladi */}
        {narxsizQoladi > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <b className="tabular-nums">{narxsizQoladi}</b> ta qalinlik yangi narxsiz arxivlanadi —
              ular uchun faol narx qolmaydi va rulonlarda "narx yo'q" ogohi chiqadi.
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={band}
            className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white disabled:opacity-40">Bekor</button>
          <button onClick={() => onSaqla({ qoshiladi, arxivlanadi }, sana)} disabled={!tayyor || band}
            className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-medium disabled:opacity-40 flex items-center justify-center gap-1.5">
            <Save className="w-4 h-4" /> {band ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>
    </SmallModal>
  );
}

// ============================================================
//  ASOSIY KOMPONENT
// ============================================================
export function NarxRoyxati({ narxlar = {}, sozlama = {}, setNarx, canEdit = true, showToast }) {
  const toast = (t) => { if (showToast) showToast(t); };

  // ----- Holat -----
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [tahrir, setTahrir] = useState(null);          // tahrirlanayotgan yozuv nusxasi
  const [yangiRoyxat, setYangiRoyxat] = useState(false); // "Yangi narx ro'yxati" oynasi
  const [saqlanmoqda, setSaqlanmoqda] = useState(false); // ro'yxat ketma-ket yozilmoqda

  const [fZavod, setFZavod] = useState('');
  const [fTur, setFTur] = useState('');
  const [qidiruv, setQidiruv] = useState('');
  const [faqatFaol, setFaqatFaol] = useState(false);
  const [tarixKor, setTarixKor] = useState(false);     // faol emas yozuvlarni ko'rsatish
  const [guruhli, setGuruhli] = useState('guruh');     // 'guruh' | 'royxat'
  const [yopiqlar, setYopiqlar] = useState([]);        // yig'ilgan guruh kalitlari
  const [sort, setSort] = useState({ ustun: '', yon: 'asc' }); // '' = standart tartib

  // ----- Xom ro'yxat (obyekt-xarita → massiv) -----
  const royxat = useMemo(() => narxRoyxat(narxlar), [narxlar]);

  // Ro'yxatlar sozlamadan (Sozlama panelida tahrirlanadi) + mavjud yozuvlardagi
  // noyob qiymatlar — ro'yxatdan o'chirilgani eski yozuvda ko'rinib turaveradi.
  const zavodlar = useMemo(() => birlashtir(sozlamaRoyxat(sozlama, 'zavodlar'), royxat, 'zavod'), [sozlama, royxat]);
  const turlar = useMemo(() => birlashtir(sozlamaRoyxat(sozlama, 'turlar'), royxat, 'tur'), [sozlama, royxat]);

  // ----- Jami (faol yozuvlar bo'yicha) -----
  const jami = useMemo(() => {
    const faollar = royxat.filter((n) => n.faol !== false);
    const zSet = new Set(); const tSet = new Set();
    let oxirgi = '';
    for (const n of faollar) {
      if (n.zavod) zSet.add(norm(n.zavod));
      if (n.tur) tSet.add(norm(n.tur));
      if (String(n.sana || '') > oxirgi) oxirgi = String(n.sana || '');
    }
    return {
      faol: faollar.length, zavod: zSet.size, tur: tSet.size, oxirgi,
      tarix: royxat.length - faollar.length, // arxivdagi (faol emas) yozuvlar
    };
  }, [royxat]);

  // ----- Dublikat ogohi: bir xil zavod+tur+qalinlik uchun bir nechta FAOL yozuv -----
  const dublikatlar = useMemo(() => {
    const hisob = new Map();
    for (const n of royxat) {
      if (n.faol === false) continue;
      const q = son(n.qalinlik);
      if (!n.zavod || !n.tur || q == null) continue;
      const k = dubKalit(n);
      const bor = hisob.get(k);
      if (bor) bor.soni += 1;
      else hisob.set(k, { zavod: n.zavod, tur: n.tur, qalinlik: q, soni: 1 });
    }
    for (const [k, v] of hisob) if (v.soni < 2) hisob.delete(k);
    return hisob;
  }, [royxat]);

  // ----- Filtr + saralash -----
  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().replace(/,/g, '.').toLowerCase();
    const out = royxat.filter((n) => {
      const nofaol = n.faol === false;
      // Faol emas yozuvlar standart holatda YASHIRILADI ("Tarixni ko'rsatish" ochadi)
      if (nofaol && (!tarixKor || faqatFaol)) return false;
      if (fZavod && norm(n.zavod) !== norm(fZavod)) return false;
      if (fTur && norm(n.tur) !== norm(fTur)) return false;
      if (q) {
        // Qidiruv — qalinlik va narx bo'yicha (matn sifatida)
        const matn = `${qalinlikMatn(n.qalinlik)} ${son(n.qalinlik) ?? ''} ${son(n.narx) ?? ''}`.toLowerCase();
        if (!matn.includes(q)) return false;
      }
      return true;
    });
    const yon = sort.yon === 'desc' ? -1 : 1;
    out.sort((a, b) => (sort.ustun
      ? (ustunCmp(a, b, sort.ustun) * yon) || standartCmp(a, b)
      : standartCmp(a, b)));
    return out;
  }, [royxat, fZavod, fTur, qidiruv, faqatFaol, tarixKor, sort]);

  // ----- Guruhlash (zavod + tur) -----
  const guruhlar = useMemo(() => {
    const map = new Map();
    for (const n of korinadigan) {
      const k = guruhKalit(n);
      if (!map.has(k)) map.set(k, { kalit: k, zavod: n.zavod || '—', tur: n.tur || '—', satrlar: [] });
      map.get(k).satrlar.push(n);
    }
    // Sarlavhadagi hisoblagich — QATORLAR emas, NOYOB QALINLIKLAR soni.
    // (Tarix ko'rsatilganda yoki dublikat bo'lsa bir qalinlik bir nechta
    // qatorda uchraydi; ular bitta qalinlik deb sanaladi.)
    const out = [...map.values()].map((g) => ({
      ...g,
      qalinlikSoni: new Set(g.satrlar.map((n) => son(n.qalinlik))).size,
    }));
    out.sort((a, b) => a.zavod.localeCompare(b.zavod) || a.tur.localeCompare(b.tur));
    return out;
  }, [korinadigan]);

  // ----- Jadval ustunlari (guruhli ko'rinishda zavod/tur sarlavhada turadi) -----
  const ustunlar = guruhli === 'guruh'
    ? [
      { k: 'qalinlik', label: 'Qalinlik', right: true },
      { k: 'narx', label: '$/t', right: true },
      { k: 'sana', label: 'Sana' },
    ]
    : [
      { k: 'zavod', label: 'Zavod' },
      { k: 'tur', label: 'Tur' },
      { k: 'qalinlik', label: 'Qalinlik', right: true },
      { k: 'narx', label: '$/t', right: true },
      { k: 'sana', label: 'Sana' },
    ];
  const ustunSoni = ustunlar.length + 1 + (canEdit ? 1 : 0); // + "Faol" (+ amallar)

  // ----- Amallar -----
  function sortBos(k) {
    // asc → desc → standart tartib
    setSort((s) => {
      if (s.ustun !== k) return { ustun: k, yon: 'asc' };
      if (s.yon === 'asc') return { ustun: k, yon: 'desc' };
      return { ustun: '', yon: 'asc' };
    });
  }

  function guruhAlmash(k) {
    setYopiqlar((y) => (y.includes(k) ? y.filter((x) => x !== k) : [...y, k]));
  }

  // Formadan yozuv yig'ish (narx/qalinlik oraliq yaxlitlanmaydi)
  function formdanYozuv(f, id) {
    return {
      id,
      zavod: (f.zavod || '').trim(),
      tur: (f.tur || '').trim(),
      qalinlik: sonQiymat(f.qalinlik),
      narx: sonQiymat(f.narx),
      sana: f.sana || toDateInput(),
      faol: f.faol !== false,
    };
  }

  // Forma tekshiruvi — xato matni yoki null
  function xato(f) {
    if (!(f.zavod || '').trim()) return 'Zavodni tanlang';
    if (!(f.tur || '').trim()) return 'Turini tanlang';
    if (!(sonQiymat(f.qalinlik) > 0)) return 'Qalinlikni kiriting';
    if (!(sonQiymat(f.narx) > 0)) return 'Narxni kiriting';
    return null;
  }

  function qoshish() {
    const x = xato(form);
    if (x) { toast(x); return; }
    const id = genId();
    setNarx(id, formdanYozuv(form, id));
    setForm({ ...BLANK, zavod: form.zavod, tur: form.tur, sana: form.sana }); // ketma-ket kiritish qulay bo'lsin
    toast("Narx qo'shildi");
  }

  function tahrirSaqla() {
    const x = xato(tahrir);
    if (x) { toast(x); return; }
    setNarx(tahrir.id, formdanYozuv(tahrir, tahrir.id));
    setTahrir(null);
    toast('Saqlandi');
  }

  function ochirish(n) {
    if (!window.confirm(`${n.zavod || '—'} · ${n.tur || '—'} · ${qalinlikMatn(n.qalinlik)} mm narxi o'chirilsinmi?`)) return;
    setNarx(n.id, null);
    setTahrir(null);
    toast("O'chirildi");
  }

  // Faol / faol emas o'tkazgichi (yozuv o'chirilmaydi — tarix saqlanadi)
  function faolAlmash(n) {
    const yangi = n.faol === false;
    setNarx(n.id, { ...n, faol: yangi });
    toast(yangi ? 'Faollashtirildi' : 'Arxivlandi');
  }

  // Yangi narx ro'yxati: yangi yozuv qo'shiladi, eskisi arxivlanadi.
  //
  //  IKKI QOIDA (ikkalasi ham ma'lumot yo'qotmaslik uchun):
  //   1) TARTIB: har juftlikda AVVAL yangi yozuv yoziladi, KEYIN eskisi
  //      arxivlanadi. setNarx (App.jsx → xaritaYoz) har chaqiruvda alohida
  //      yozuv qiladi va xatoda faqat O'SHA yozuvni orqaga qaytaradi, ya'ni
  //      qisman muvaffaqiyatsizlik mumkin. Teskari tartibda o'sha
  //      zavod+tur+qalinlik butunlay FAOL narxsiz qolib ketardi (narxTop null
  //      → rulonlarda "narx yo'q"). Bu tartibda eng yomon holat — vaqtincha
  //      DUBLIKAT: u yuqoridagi sariq ogohda ko'rinadi va qo'lda tuzatiladi.
  //   2) KETMA-KET: har yozuv `await` qilinadi. Barcha narxlar BITTA Firestore
  //      hujjatida (shop/ombor-narxlar) — o'nlab parallel yozuv hujjat bo'yicha
  //      yozuv chegarasiga urilib, bir qismi xato bilan qaytardi.
  //  Toast ham faqat hamma yozuv tugagach chiqadi (oldin "muvaffaqiyatli" deb
  //  chiqib, keyin xato toasti kelib qolardi).
  async function yangiRoyxatSaqla({ qoshiladi = [], arxivlanadi = [] }, sana) {
    const arxivIdlar = new Set(arxivlanadi.map((n) => n.id));
    const yozilgan = new Set();
    setSaqlanmoqda(true);
    try {
      for (const { eski, yangiNarx } of qoshiladi) {
        const id = genId();
        await setNarx(id, {
          id,
          zavod: eski.zavod || '',
          tur: eski.tur || '',
          qalinlik: son(eski.qalinlik) || 0,
          narx: yangiNarx,
          sana,
          faol: true,
        });
        yozilgan.add(eski.id);
        if (arxivIdlar.has(eski.id)) await setNarx(eski.id, { ...eski, faol: false });
      }
      // Narx kiritilmagan, lekin arxivlash tanlangan qolgan eski yozuvlar
      for (const eski of arxivlanadi) {
        if (yozilgan.has(eski.id)) continue;
        await setNarx(eski.id, { ...eski, faol: false });
      }
    } finally {
      setSaqlanmoqda(false);
    }
    setYangiRoyxat(false);
    toast(`${qoshiladi.length} ta narx yangilandi · ${arxivlanadi.length} ta arxivlandi`);
  }

  // Tahrirlashni boshlash — raqamlar formada MATN sifatida turadi (vergul ham mumkin)
  function tahrirBoshla(n) {
    setTahrir({
      ...n,
      qalinlik: String(son(n.qalinlik) ?? ''),
      narx: String(son(n.narx) ?? ''),
    });
  }

  // Qatorga beriladigan umumiy proplar (guruhli va ro'yxat ko'rinishi uchun bir xil)
  const qatorProps = {
    ustunlar, canEdit, onFaol: faolAlmash, onTahrir: tahrirBoshla, onOchir: ochirish,
  };

  return (
    <Card>
      <SectionTitle icon={Tags}>Narx ro'yxati ({jami.faol})</SectionTitle>

      {/* ----- Jami ----- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StatBox label="Faol narx" value={jami.faol} />
        <StatBox label="Zavod" value={jami.zavod} />
        <StatBox label="Tur" value={jami.tur} />
        <StatBox label="Oxirgi sana" value={jami.oxirgi ? formatDay(jami.oxirgi) : '—'} />
      </div>

      {/* ----- Dublikat ogohi ----- */}
      {dublikatlar.size > 0 && (
        <div className="mb-3 flex items-start gap-2 text-xs bg-amber-50 border-2 border-amber-300 text-amber-800 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <b>Dublikat narx:</b> bir xil zavod + tur + qalinlik uchun bir nechta faol yozuv bor.
            Hisoblashda eng yangi sanalisi olinadi — keraksizini arxivlang.
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...dublikatlar.entries()].map(([k, d]) => (
                <span key={k} className="px-1.5 py-0.5 rounded bg-white border border-amber-300 whitespace-nowrap">
                  {d.zavod} · {d.tur} · <span className="tabular-nums">{qalinlikMatn(d.qalinlik)}</span> mm — {d.soni} ta
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----- Qo'shish formasi + yangi ro'yxat tugmasi ----- */}
      {canEdit && (adding ? (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <Tanla label="Zavod *" value={form.zavod} onChange={(v) => setForm({ ...form, zavod: v })} options={zavodlar} />
            <Tanla label="Tur *" value={form.tur} onChange={(v) => setForm({ ...form, tur: v })} options={turlar} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Qalinlik (mm) *</label>
              <input inputMode="decimal" value={form.qalinlik}
                onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setForm({ ...form, qalinlik: s }); }}
                onFocus={(e) => e.target.select()} placeholder="0.40" className={INP_NUM} />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Narx ($/t) *</label>
              <input inputMode="decimal" value={form.narx}
                onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setForm({ ...form, narx: s }); }}
                onFocus={(e) => e.target.select()} placeholder="0" className={INP_NUM} />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Sana</label>
              <input type="date" value={form.sana} onChange={(e) => setForm({ ...form, sana: e.target.value })} className={INP} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={form.faol !== false} onChange={(e) => setForm({ ...form, faol: e.target.checked })} />
            Faol (hisobda ishlatilsin)
          </label>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm(BLANK); }}
              className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Yopish</button>
            <button onClick={qoshish}
              className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Qo'shish
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setForm({ ...BLANK, sana: toDateInput() }); setAdding(true); }}
            className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Narx qo'shish
          </button>
          <button onClick={() => setYangiRoyxat(true)}
            className="flex-1 py-2.5 rounded-lg border-2 border-slate-900 text-slate-900 bg-white font-medium text-sm flex items-center justify-center gap-2">
            <History className="w-4 h-4" /> Yangi narx ro'yxati
          </button>
        </div>
      ))}

      {/* ----- Filtr ----- */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 mb-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <Tanla label="Zavod" value={fZavod} onChange={setFZavod} options={zavodlar} bosh="Barcha zavod" />
          <Tanla label="Tur" value={fTur} onChange={setFTur} options={turlar} bosh="Barcha tur" />
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Qidiruv (qalinlik yoki narx)</label>
          <input value={qidiruv} onChange={(e) => setQidiruv(e.target.value)}
            placeholder="masalan: 0.40 yoki 1240" className={INP_NUM} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-600">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={faqatFaol} onChange={(e) => setFaqatFaol(e.target.checked)} />
            Faqat faol
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={tarixKor} onChange={(e) => setTarixKor(e.target.checked)} />
            <History className="w-3.5 h-3.5 text-slate-400" /> Tarixni ko'rsatish
          </label>
          {(fZavod || fTur || qidiruv || faqatFaol || tarixKor || sort.ustun) && (
            <button onClick={() => {
              setFZavod(''); setFTur(''); setQidiruv(''); setFaqatFaol(false);
              setTarixKor(false); setSort({ ustun: '', yon: 'asc' });
            }} className="ml-auto px-2 py-1 rounded border border-slate-300 bg-white text-slate-600">
              Tozalash
            </button>
          )}
        </div>
      </div>

      {/* ----- Ko'rinish tanlash ----- */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-48">
          <SegmentedControl value={guruhli} onChange={setGuruhli}
            options={[{ value: 'guruh', label: 'Guruhlangan' }, { value: 'royxat', label: "Ro'yxat" }]} />
        </div>
        {guruhli === 'guruh' && guruhlar.length > 0 && (
          <button
            onClick={() => setYopiqlar(yopiqlar.length ? [] : guruhlar.map((g) => g.kalit))}
            className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-600 whitespace-nowrap">
            {yopiqlar.length ? 'Hammasini ochish' : "Hammasini yig'ish"}
          </button>
        )}
        <div className="ml-auto text-xs text-slate-500 tabular-nums">{korinadigan.length} ta yozuv</div>
      </div>

      {/* ----- Jadval ----- */}
      {korinadigan.length === 0 ? (
        /* Narx ro'yxati BUTUNLAY bo'sh (hali yozuv kiritilmagan) va filtr hech
           narsa topmagani — ikki xil holat, matni ham har xil bo'lsin. */
        <div className="text-center py-8 text-slate-400">
          <Tags className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {royxat.length === 0 ? (
            <>
              <p className="text-sm text-slate-500">Narx ro'yxati hali bo'sh</p>
              <p className="text-xs mt-1 max-w-sm mx-auto">
                {canEdit
                  ? "Zavod narxlarini yuqoridagi forma orqali kiriting — narx kiritilmaguncha rulonlar jadvalida narx ustunlari \u00abYO'Q\u00bb bo'lib turadi."
                  : "Narx kiritish uchun ruxsat yo'q."}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">Filtrga mos narx topilmadi</p>
              <p className="text-xs mt-1">Jami {royxat.length} ta yozuv bor — filtrni tozalab ko'ring.</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {ustunlar.map((u) => <BoshUstun key={u.k} ustun={u} sort={sort} onSort={sortBos} />)}
                <th className="px-2 py-2 font-semibold text-slate-500 text-center whitespace-nowrap">Faol</th>
                {canEdit && <th className="px-2 py-2 font-semibold text-slate-500 text-right whitespace-nowrap">Amal</th>}
              </tr>
            </thead>
            <tbody>
              {guruhli === 'guruh'
                ? guruhlar.map((g) => {
                  const yopiq = yopiqlar.includes(g.kalit);
                  return (
                    <React.Fragment key={g.kalit}>
                      <tr className="bg-slate-100/70 border-t border-slate-200 cursor-pointer"
                        onClick={() => guruhAlmash(g.kalit)}>
                        <td colSpan={ustunSoni} className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            {yopiq ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                              : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
                            <b className="text-slate-900">{g.zavod}</b>
                            <span className="text-slate-300">·</span>
                            <span className="font-semibold text-slate-600">{g.tur}</span>
                            <span className="ml-auto text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                              {g.qalinlikSoni} ta qalinlik
                              {g.satrlar.length !== g.qalinlikSoni && ` · ${g.satrlar.length} yozuv`}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!yopiq && g.satrlar.map((n) => (
                        <Qator key={n.id} n={n} dub={n.faol !== false && dublikatlar.has(dubKalit(n))} {...qatorProps} />
                      ))}
                    </React.Fragment>
                  );
                })
                : korinadigan.map((n) => (
                  <Qator key={n.id} n={n} dub={n.faol !== false && dublikatlar.has(dubKalit(n))} {...qatorProps} />
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!tarixKor && jami.tarix > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          <span className="tabular-nums">{jami.tarix}</span> ta faol emas (tarix) yozuv yashirilgan —
          ko'rish uchun "Tarixni ko'rsatish" belgisini yoqing.
        </div>
      )}

      {/* ----- Tahrirlash oynasi ----- */}
      {tahrir && (
        <SmallModal onClose={() => setTahrir(null)} title="Narxni tahrirlash">
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <Tanla label="Zavod *" value={tahrir.zavod} onChange={(v) => setTahrir({ ...tahrir, zavod: v })} options={zavodlar} />
              <Tanla label="Tur *" value={tahrir.tur} onChange={(v) => setTahrir({ ...tahrir, tur: v })} options={turlar} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">Qalinlik (mm) *</label>
                <input inputMode="decimal" value={tahrir.qalinlik}
                  onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setTahrir({ ...tahrir, qalinlik: s }); }}
                  onFocus={(e) => e.target.select()} className={INP_NUM} />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Narx ($/t) *</label>
                <input inputMode="decimal" value={tahrir.narx}
                  onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setTahrir({ ...tahrir, narx: s }); }}
                  onFocus={(e) => e.target.select()} className={INP_NUM} />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Sana</label>
                <input type="date" value={tahrir.sana || ''} onChange={(e) => setTahrir({ ...tahrir, sana: e.target.value })} className={INP} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={tahrir.faol !== false} onChange={(e) => setTahrir({ ...tahrir, faol: e.target.checked })} />
              Faol (hisobda ishlatilsin)
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={() => ochirish(tahrir)}
                className="py-2 px-3 border-2 border-red-200 text-red-700 rounded-lg bg-white">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setTahrir(null)} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
              <button onClick={tahrirSaqla}
                className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-medium flex items-center justify-center gap-1.5">
                <Save className="w-4 h-4" /> Saqlash
              </button>
            </div>
          </div>
        </SmallModal>
      )}

      {/* ----- Yangi narx ro'yxati oynasi ----- */}
      {yangiRoyxat && (
        <YangiRoyxatModal
          royxat={royxat} zavodlar={zavodlar} turlar={turlar} band={saqlanmoqda}
          onClose={() => { if (!saqlanmoqda) setYangiRoyxat(false); }}
          onSaqla={yangiRoyxatSaqla} />
      )}
    </Card>
  );
}
