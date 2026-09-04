// ============================================================
//  OMBOR → RULONLAR
// ------------------------------------------------------------
//  Ombordagi rulonlar RO'YXATI + har bir rulonni ALOHIDA FORMADA
//  kiritish / tahrirlash (modal oyna). Rulon ro'yxatga faqat
//  formada "Saqlash" bosilgandan keyin tushadi — bo'sh qator yo'q.
//
//  Ro'yxatda avval ASOSIY ma'lumot ko'rinadi: kimdan (zavod), tur,
//  rang, qalinlik va SOTUV NARXLARI (5% / 10%), keyin xarid
//  tafsilotlari (og'irlik, uzunlik, narx $/t, kurs, rulon so'm).
//  Excel eksporti esa daftar tartibida — to'liq hisob zanjiri bilan.
//
//  Barcha hisob-kitob src/lib/omborHisob.js dagi sof funksiyalarda;
//  bu faylda birorta narx / kurs / koeffitsient QATTIQ YOZILMAGAN.
//
//  MAVZU (tema): faqat index.css da qayta bo'yaladigan Tailwind
//  klasslari ishlatiladi — bg-white, bg-slate-50/100, text-slate-400..900,
//  border-slate-100/200/300, bg-slate-900, amber/emerald/red 50/100/200 va
//  *-700/800 matnlar. text-slate-300, orange-*, bg-slate-100/70 kabi
//  qayta bo'yalmaydigan klasslar qorong'i mavzuda o'qilmaydi — ISHLATILMAYDI.
//
//  Ma'lumot:
//    rulonlar — { [id]: Rulon } obyekt-xarita
//    setRulon(id, rulon)  — bitta rulonni yozadi (null = o'chiradi)
// ============================================================
import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, ChevronUp, ChevronDown, AlertTriangle, AlertCircle,
  Search, X, FileSpreadsheet, Layers, Check, Calculator,
} from 'lucide-react';
import { Card, SectionTitle, StatBox, FullModal, rangChipStyle } from '../../components/ui.jsx';
import { fmt, genId, sonMatn, toDateInput } from '../../lib/helpers.js';
import { hisobla, rulonHisob, jamiHisob, turTaxmin, son, norm, OGOH } from '../../lib/omborHisob.js';
import { sozlamaRoyxat } from '../../lib/omborSeed.js';
import { downloadXLSX } from '../../lib/xlsx.js';

// ----- Kichik yordamchilar -----

// O'lchov (metr / tonna) — PUL emas, shuning uchun fmt emas: kasr xonasi qoladi.
// Pul qiymatlari esa har doim fmt() bilan butunga yaxlitlanadi.
function olchovKor(n, kasr = 1) {
  const v = Number(n);
  if (n == null || !Number.isFinite(v)) return '';
  const k = 10 ** kasr;
  return String(Math.round(v * k) / k);
}

// Xom (saqlangan) qiymatni matn sifatida
const xomKor = (v) => (v == null || v === '' ? '' : String(v));

// 'YYYY-MM-DD' → 'DD.MM.YY' (ro'yxatda qisqa ko'rinsin); boshqa matn — o'zi
function sanaKor(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : xomKor(s);
}

// Bo'sh qiymat belgisi (och rangda)
const Bosh = () => <span className="text-slate-400">—</span>;

// Ro'yxatlarni birlashtirish: sozlamadagi ro'yxat + mavjud yozuvlardagi noyob
// qiymatlar (ro'yxatdan o'chirilgan nom eski yozuvda ko'rinishda qolaveradi).
function birlashtir(asos, manbalar, kalit) {
  const out = [];
  const korilgan = new Set();
  const qosh = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (!s) return;
    const k = norm(s);
    if (korilgan.has(k)) return;
    korilgan.add(k);
    out.push(s);
  };
  (asos || []).forEach(qosh);
  for (const m of manbalar) {
    const xom = Array.isArray(m) ? m : Object.values(m || {});
    for (const x of xom) if (x && typeof x === 'object' && !x.ochirilgan) qosh(x[kalit]);
  }
  return out;
}

// Qalinliklar ro'yxati (filtr uchun) — son sifatida taqqoslanadi
function qalinlikRoyxat(manbalar) {
  const set = new Set();
  for (const m of manbalar) {
    const xom = Array.isArray(m) ? m : Object.values(m || {});
    for (const x of xom) {
      if (!x || typeof x !== 'object' || x.ochirilgan) continue;
      const q = son(x.qalinlik);
      if (q != null && q > 0) set.add(String(q));
    }
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

// Ogohlantirish darajasi → qator foni (faqat qayta bo'yaladigan klasslar)
const FON = { qizil: 'bg-red-50', toq: 'bg-amber-100', sariq: 'bg-amber-50' };
// Ogohlantirish darajasi → yig'ma ro'yxat / xabar uslubi
const OGOH_USLUB = {
  qizil: 'bg-red-50 border-red-200 text-red-700',
  toq: 'bg-amber-100 border-amber-200 text-amber-800',
  sariq: 'bg-amber-50 border-amber-200 text-amber-700',
};
// Ogohlantirish kodi → qisqa sarlavha (yig'ma ro'yxatda)
const OGOH_NOM = {
  [OGOH.NARX_YOQ]: 'Narx yoki kurs kiritilmagan',
  [OGOH.UZUNLIK_YOQ]: 'Uzunlik kiritilmagan',
  [OGOH.QALINLIK]: 'Qalinlik / uzunlik mos emas',
  [OGOH.TASDIQSIZ]: 'Tasdiqlanmagan',
};
const DARAJA_OGIRLIK = { qizil: 0, toq: 1, sariq: 2 };

// Saralashda hisob natijasidan (h) olinadigan ustunlar. narxTonna / kurs ham
// shu yerda: h da eski maydon nomlari hisobga olingan "haqiqiy" qiymat turadi.
const HISOB_USTUN = new Set([
  'uzunlik', 'qoldiq', 'narxTonna', 'kurs', 'yolkiraTonna',
  'rulonDollar', 'rulonSom', 'yolkiraDollar', 'yolkiraSom',
  'metrTannarx', 'sotuv1', 'sotuv2',
]);
const MATN_USTUN = new Set(['sana', 'rang', 'zavod', 'tur', 'izoh']);

// Saralash uchun katak qiymati
function saraQiymat(q, k) {
  if (HISOB_USTUN.has(k)) return q.h[k];
  if (MATN_USTUN.has(k)) return norm(q[k]);
  return son(q[k]); // nomer, qalinlik, ogirlik
}

// Taqqoslash — bo'sh qiymatlar DOIM oxirida qoladi
function solish(a, b, yon) {
  const bosh = (v) => v == null || v === '';
  if (bosh(a) && bosh(b)) return 0;
  if (bosh(a)) return 1;
  if (bosh(b)) return -1;
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).localeCompare(String(b), 'uz') * yon;
  }
  return (a - b) * yon;
}

// Rulonning qisqa nomi (tasdiq / xabarlar uchun): "Mokriy 0.45 mm · SMZ"
function rulonNomi(r) {
  return [r.rang, xomKor(r.qalinlik) && `${xomKor(r.qalinlik)} mm`, r.zavod].filter(Boolean).join(' · ');
}

// ============================================================
//  KICHIK KO'RINISH KOMPONENTLARI
// ============================================================

// Jadval sarlavhasi (saralash tugmasi bilan)
function Th({ k, nom, sort, onSort, hizala = 'left', qalin = false, title = '' }) {
  const faol = sort.ustun === k;
  const hiz = hizala === 'right' ? 'text-right' : hizala === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`py-2 px-2 font-semibold whitespace-nowrap ${hiz} ${qalin ? 'text-slate-900' : ''}`} title={title}>
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-0.5 hover:text-slate-900 ${faol ? 'text-slate-900' : ''}`}>
        <span>{nom}</span>
        {faol && (sort.yon > 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  );
}

// Ogohlantirish belgisi (qator boshida)
function OgohBelgi({ h }) {
  if (!h.daraja) return null;
  const matn = h.ogohlar.map((o) => o.matn).join(' · ');
  const Ikon = h.daraja === 'sariq' ? AlertCircle : AlertTriangle;
  const rang = h.daraja === 'qizil' ? 'text-red-600' : 'text-amber-700';
  // title SVG ustida ishlamaydi — shuning uchun o'rovchi span da beriladi
  return (
    <span title={matn} className="inline-flex flex-shrink-0">
      <Ikon className={`w-3.5 h-3.5 ${rang}`} />
    </span>
  );
}

// Rang namunasi (kvadratcha)
function RangNamuna({ rang, size = 'w-4 h-4' }) {
  if (!rang) return <span className={`${size} rounded border border-slate-300 bg-slate-100 inline-block flex-shrink-0`} />;
  return (
    <span className={`${size} rounded border border-black/10 inline-block flex-shrink-0`}
      title={rang} style={rangChipStyle(rang)} />
  );
}

// Pul katagi (ro'yxatda)
function PulKatak({ qiymat, qalin = false, title = '' }) {
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${qalin ? 'font-semibold text-slate-900' : 'text-slate-700'}`} title={title}>
      {qiymat == null ? <Bosh /> : fmt(qiymat)}
    </td>
  );
}

// Uzunlik ko'rinishi: kiritilmagan bo'lsa og'irlikdan taxminan (≈)
function UzunlikKor({ h }) {
  if (h.uzunlik == null) return <Bosh />;
  return (
    <span className="tabular-nums" title={h.uzunlikHisoblangan ? "Og'irlikdan taxminan hisoblandi — rulon qog'ozidagi uzunlikni yozing" : ''}>
      {h.uzunlikHisoblangan && <span className="text-slate-400">≈ </span>}
      {olchovKor(h.uzunlik)}
    </span>
  );
}

// Qoldiq ko'rinishi: yozilmagan bo'lsa (= uzunlik) och rangda
function QoldiqKor({ q }) {
  if (q.h.qoldiq == null) return <Bosh />;
  return <span className={`tabular-nums ${xomKor(q.qoldiq) ? '' : 'text-slate-400'}`}>{olchovKor(q.h.qoldiq)}</span>;
}

// ============================================================
//  FILTR / QIDIRUV PANELI
// ============================================================
const FILTR_BOSH = { zavod: '', tur: '', qalinlik: '', q: '' };
function FiltrPanel({ filtr, setFiltr, zavodlar, turlar, qalinliklar }) {
  const tozaBor = filtr.zavod || filtr.tur || filtr.qalinlik || filtr.q;
  const sel = 'px-2 py-1.5 border border-slate-300 rounded bg-white text-xs';
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={filtr.q} onChange={(e) => setFiltr({ ...filtr, q: e.target.value })}
          placeholder="Rang, kimdan yoki izoh bo'yicha qidirish"
          className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded bg-white text-xs" />
      </div>
      <select value={filtr.zavod} onChange={(e) => setFiltr({ ...filtr, zavod: e.target.value })} className={sel}>
        <option value="">Hammasi (kimdan)</option>
        {zavodlar.map((z) => <option key={z} value={z}>{z}</option>)}
      </select>
      <select value={filtr.tur} onChange={(e) => setFiltr({ ...filtr, tur: e.target.value })} className={sel}>
        <option value="">Barcha turlar</option>
        {turlar.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={filtr.qalinlik} onChange={(e) => setFiltr({ ...filtr, qalinlik: e.target.value })} className={sel}>
        <option value="">Barcha qalinlik</option>
        {qalinliklar.map((q) => <option key={q} value={q}>{q} mm</option>)}
      </select>
      {tozaBor && (
        <button type="button" onClick={() => setFiltr(FILTR_BOSH)}
          className="px-2.5 py-1.5 rounded border-2 border-slate-200 bg-white text-slate-600 text-xs flex items-center gap-1 hover:bg-slate-50">
          <X className="w-3.5 h-3.5" /> Tozalash
        </button>
      )}
    </div>
  );
}

// ============================================================
//  RULON FORMASI (modal) — qo'shish va tahrirlash
// ------------------------------------------------------------
//  Forma LOKAL state da: "Saqlash" bosilmaguncha hech narsa yozilmaydi.
//  Hisob natijasi (rulon $, so'm, 1 m tannarx, sotuv narxlari) yozayotganda
//  JONLI ko'rsatib turiladi — foydalanuvchi natijani ko'rib saqlaydi.
// ============================================================
const FORMA_BOSH = {
  nomer: '', sana: '', zavod: '', tur: '', rang: '', qalinlik: '',
  ogirlik: '', narxTonna: '', kurs: '', uzunlik: '', yolkiraTonna: '',
  qoldiq: '', izoh: '',
};

// Saqlangan ruldan (yoki bo'shdan) forma holati — hamma raqam MATN sifatida
function formaYasa(r, sozlama, keyingiNomer) {
  if (!r) {
    return {
      ...FORMA_BOSH,
      nomer: String(keyingiNomer),
      sana: toDateInput(),                  // bugun — o'zgartirsa bo'ladi
      kurs: xomKor(son(sozlama.kurs)),      // sozlamadagi standart kurs TAKLIF
    };
  }
  return {
    nomer: xomKor(r.nomer), sana: xomKor(r.sana),
    zavod: r.zavod || '', tur: r.tur || '', rang: r.rang || '',
    qalinlik: xomKor(r.qalinlik), ogirlik: xomKor(r.ogirlik),
    // eski maydon nomlari (xaridNarx / xaridKurs) ham o'qiladi
    narxTonna: xomKor(r.narxTonna ?? r.xaridNarx), kurs: xomKor(r.kurs ?? r.xaridKurs),
    uzunlik: xomKor(r.uzunlik), yolkiraTonna: xomKor(r.yolkiraTonna),
    qoldiq: xomKor(r.qoldiq), izoh: r.izoh || '',
  };
}

// Formadan rulon yozuvi: raqamlar son, bo'sh — '' (kiritilmagan)
function formadanRulon(f, asl) {
  const s = (v) => (v === '' || v == null ? '' : (son(v) ?? ''));
  const rulon = {
    ...(asl || {}),
    nomer: s(f.nomer), sana: f.sana || '',
    zavod: f.zavod.trim(), tur: f.tur.trim(), rang: f.rang.trim(),
    qalinlik: s(f.qalinlik), ogirlik: s(f.ogirlik),
    narxTonna: s(f.narxTonna), kurs: s(f.kurs),
    uzunlik: s(f.uzunlik), yolkiraTonna: s(f.yolkiraTonna),
    qoldiq: s(f.qoldiq), izoh: f.izoh.trim(),
    tasdiqlanmagan: false, // formada ko'rib saqlandi — tasdiqlangan hisoblanadi
  };
  delete rulon.h;
  return rulon;
}

// Majburiy maydonlar va mantiqiy xatolar. Bo'sh obyekt = xato yo'q.
function formaXato(f, h) {
  const x = {};
  const musbat = (v) => son(v) != null && son(v) > 0;
  if (!f.zavod.trim()) x.zavod = 'Tanlang';
  if (!f.rang.trim()) x.rang = 'Tanlang';
  if (!musbat(f.qalinlik)) x.qalinlik = "0 dan katta bo'lsin";
  if (!musbat(f.ogirlik)) x.ogirlik = "0 dan katta bo'lsin";
  if (!musbat(f.narxTonna)) x.narxTonna = "0 dan katta bo'lsin";
  if (!musbat(f.kurs)) x.kurs = "0 dan katta bo'lsin";
  if (f.uzunlik !== '' && !musbat(f.uzunlik)) x.uzunlik = "0 dan katta bo'lsin";
  if (f.yolkiraTonna !== '' && (son(f.yolkiraTonna) == null || son(f.yolkiraTonna) < 0)) x.yolkiraTonna = "Manfiy bo'lmasin";
  if (f.qoldiq !== '') {
    const q = son(f.qoldiq);
    if (q == null || q < 0) x.qoldiq = "Manfiy bo'lmasin";
    else if (h && h.uzunlik != null && q > h.uzunlik + 1e-9) x.qoldiq = 'Uzunlikdan katta';
  }
  return x;
}

const MAYDON = 'w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white focus:border-slate-900 outline-none text-sm';
const MAYDON_XATO = 'w-full px-3 py-2 border-2 border-red-200 rounded-lg bg-white focus:border-red-200 outline-none text-sm';

function Maydon({ label, xato, korsat, hint, children }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
      {korsat && xato
        ? <div className="text-[11px] text-red-600 mt-0.5">{xato}</div>
        : (hint ? <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div> : null)}
    </div>
  );
}

// Hisob qatori (formadagi jonli hisobda, o'ng tomonda qiymat)
function Qator({ nom, qiymat, izoh, qalin = false }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-slate-500 text-xs">{nom}</span>
      <span className={`tabular-nums text-right ${qalin ? 'font-bold text-slate-900' : 'text-slate-800'}`}>
        {qiymat}{izoh ? <span className="text-[11px] text-slate-400 font-normal"> {izoh}</span> : null}
      </span>
    </div>
  );
}

// Sotuv narxi qutisi (formada va mobil kartada) — asosiy = yashil ajratilgan
function SotuvQuti({ nom, qiymat, asosiy = false, kichik = false }) {
  return (
    <div className={`rounded-lg text-center border ${kichik ? 'py-1.5 px-1' : 'p-2'} ${asosiy ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`${kichik ? 'text-[10px]' : 'text-[11px]'} text-slate-500 truncate`}>{nom}</div>
      <div className={`${kichik ? 'text-sm' : 'text-lg'} font-bold tabular-nums ${asosiy ? 'text-emerald-700' : 'text-slate-900'}`}>
        {qiymat == null ? <Bosh /> : fmt(qiymat)}
      </div>
    </div>
  );
}

function RulonForma({
  asl, sozlama, rangTur, zavodlar, turlar, ranglar, nom1, nom2, keyingiNomer,
  onClose, onSave,
}) {
  const [f, setF] = useState(() => formaYasa(asl, sozlama, keyingiNomer));
  const [urinildi, setUrinildi] = useState(false); // "Saqlash" bosilganmi — xatolar shundan keyin ko'rinadi
  const yangi = !asl;

  // Escape — yopish
  useEffect(() => {
    const klav = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', klav);
    return () => window.removeEventListener('keydown', klav);
  }, [onClose]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const sonSet = (kalit) => (e) => { const s = sonMatn(e.target.value); if (s !== null) set({ [kalit]: s }); };
  const matnSet = (kalit) => (e) => set({ [kalit]: e.target.value });
  // Rang tanlanganda tur BO'SH bo'lsa — rangdan taxmin qilinadi
  const rangSet = (e) => {
    const rang = e.target.value;
    const patch = { rang };
    if (rang && !f.tur.trim()) {
      const t = turTaxmin(rangTur, rang);
      if (t) patch.tur = t;
    }
    set(patch);
  };

  // Jonli hisob — yadro bilan (bu yerda formula yo'q)
  const h = useMemo(() => rulonHisob(formadanRulon(f, asl), { sozlama }), [f, asl, sozlama]);
  const xato = useMemo(() => formaXato(f, h), [f, h]);
  const xatoBor = Object.keys(xato).length > 0;
  const yolkiraStd = son(sozlama.yolkiraTonna) ?? 0;

  function yubor(e) {
    e.preventDefault();
    setUrinildi(true);
    if (xatoBor) return;
    onSave(formadanRulon(f, asl));
  }

  const k = (nom) => (urinildi && xato[nom] ? MAYDON_XATO : MAYDON);
  const tonna = son(f.ogirlik) != null ? son(f.ogirlik) / 1000 : null;

  return (
    <FullModal onClose={onClose} title={yangi ? 'Yangi rulon' : `Rulon №${xomKor(f.nomer) || '—'} — tahrirlash`}>
      <form onSubmit={yubor} className="p-4 space-y-4" noValidate>
        {/* ----- 1) Rulon ----- */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Rulon</div>
          <div className="grid grid-cols-2 gap-3">
            <Maydon label="№ (tartib raqam)">
              <input inputMode="numeric" value={f.nomer} onChange={sonSet('nomer')} className={MAYDON} />
            </Maydon>
            <Maydon label="Sana">
              <input type="date" value={f.sana} onChange={matnSet('sana')} className={MAYDON} />
            </Maydon>
            <Maydon label="Kimdan (zavod) *" xato={xato.zavod} korsat={urinildi}>
              <select value={f.zavod} onChange={matnSet('zavod')} className={k('zavod')} autoFocus>
                <option value="">— tanlang —</option>
                {f.zavod && !zavodlar.some((z) => norm(z) === norm(f.zavod)) && <option value={f.zavod}>{f.zavod}</option>}
                {zavodlar.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </Maydon>
            <Maydon label="Tur" hint="Bo'sh qolsa rangdan o'zi taxmin qilinadi">
              <select value={f.tur} onChange={matnSet('tur')} className={MAYDON}>
                <option value="">—</option>
                {f.tur && !turlar.some((t) => norm(t) === norm(f.tur)) && <option value={f.tur}>{f.tur}</option>}
                {turlar.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Maydon>
            <Maydon label="Rang *" xato={xato.rang} korsat={urinildi}>
              <div className="flex items-center gap-2">
                <RangNamuna rang={f.rang} size="w-8 h-8" />
                <select value={f.rang} onChange={rangSet} className={k('rang')}>
                  <option value="">— tanlang —</option>
                  {f.rang && !ranglar.some((r) => norm(r) === norm(f.rang)) && <option value={f.rang}>{f.rang}</option>}
                  {ranglar.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </Maydon>
            <Maydon label="Qalinlik (mm) *" xato={xato.qalinlik} korsat={urinildi}>
              <input inputMode="decimal" value={f.qalinlik} onChange={sonSet('qalinlik')} placeholder="0,45"
                className={`${k('qalinlik')} tabular-nums`} />
            </Maydon>
          </div>
        </div>

        {/* ----- 2) Xarid ----- */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Xarid</div>
          <div className="grid grid-cols-2 gap-3">
            <Maydon label="Og'irlik (kg) *" xato={xato.ogirlik} korsat={urinildi}
              hint={tonna != null && tonna > 0 ? `${olchovKor(tonna, 3)} tonna` : ''}>
              <input inputMode="decimal" value={f.ogirlik} onChange={sonSet('ogirlik')} placeholder="5150"
                className={`${k('ogirlik')} tabular-nums`} />
            </Maydon>
            <Maydon label="Narx, 1 tonna ($) *" xato={xato.narxTonna} korsat={urinildi}>
              <input inputMode="decimal" value={f.narxTonna} onChange={sonSet('narxTonna')} placeholder="1130"
                className={`${k('narxTonna')} tabular-nums`} />
            </Maydon>
            <Maydon label="Dollar kursi (so'm) *" xato={xato.kurs} korsat={urinildi} hint="Olingan kungi kurs">
              <input inputMode="decimal" value={f.kurs} onChange={sonSet('kurs')} placeholder="12100"
                className={`${k('kurs')} tabular-nums`} />
            </Maydon>
            <Maydon label="Uzunlik (m)" xato={xato.uzunlik} korsat={urinildi}
              hint={f.uzunlik === '' ? "Rulon qog'ozidan; bo'sh bo'lsa og'irlikdan taxminan" : ''}>
              <input inputMode="decimal" value={f.uzunlik} onChange={sonSet('uzunlik')} placeholder="1436"
                className={`${k('uzunlik')} tabular-nums`} />
            </Maydon>
            <Maydon label="Yo'lkira, 1 tonna ($)" xato={xato.yolkiraTonna} korsat={urinildi}
              hint={f.yolkiraTonna === '' ? `Bo'sh — standart ${olchovKor(yolkiraStd, 2)} $/t (sozlamada)` : ''}>
              <input inputMode="decimal" value={f.yolkiraTonna} onChange={sonSet('yolkiraTonna')}
                placeholder={olchovKor(yolkiraStd, 2)} className={`${k('yolkiraTonna')} tabular-nums`} />
            </Maydon>
            <Maydon label="Qoldiq (m)" xato={xato.qoldiq} korsat={urinildi}
              hint={f.qoldiq === '' ? "Bo'sh — to'liq rulon (= uzunlik)" : ''}>
              <input inputMode="decimal" value={f.qoldiq} onChange={sonSet('qoldiq')} placeholder="to'liq"
                className={`${k('qoldiq')} tabular-nums`} />
            </Maydon>
            <div className="col-span-2">
              <Maydon label="Izoh">
                <input value={f.izoh} onChange={matnSet('izoh')} placeholder="Ixtiyoriy" className={MAYDON} />
              </Maydon>
            </div>
          </div>
        </div>

        {/* ----- 3) Hisob (jonli) ----- */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            <Calculator className="w-3.5 h-3.5" /> Hisob — o'zi chiqadi
          </div>
          <div className="text-sm">
            <Qator nom="Rulon narxi ($)" qiymat={h.rulonDollar == null ? <Bosh /> : fmt(h.rulonDollar)}
              izoh={h.rulonDollar != null ? `${olchovKor(tonna, 3)} t × ${fmt(h.narxTonna)}` : ''} />
            <Qator nom="Rulon narxi (so'm)" qiymat={h.rulonSom == null ? <Bosh /> : fmt(h.rulonSom)}
              izoh={h.rulonSom != null ? `× ${fmt(h.kurs)}` : ''} />
            <Qator nom="Yo'lkira" qiymat={h.yolkiraDollar == null ? <Bosh /> : `${fmt(h.yolkiraDollar)} $`}
              izoh={h.yolkiraSom != null ? `= ${fmt(h.yolkiraSom)} so'm${h.yolkiraStandart ? ' (standart)' : ''}` : ''} />
            <Qator nom="Jami (so'm)" qiymat={h.jamiSom == null ? <Bosh /> : fmt(h.jamiSom)} qalin />
            <Qator nom="Uzunlik (m)" qiymat={<UzunlikKor h={h} />}
              izoh={h.uzunlikHisoblangan ? "og'irlikdan taxminan" : ''} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <SotuvQuti nom="1 m tannarx" qiymat={h.metrTannarx} />
            <SotuvQuti nom={nom1} qiymat={h.sotuv1} asosiy />
            <SotuvQuti nom={nom2} qiymat={h.sotuv2} asosiy />
          </div>
          {h.ogohlar.filter((o) => o.kod !== OGOH.TASDIQSIZ).length > 0 && (
            <div className="mt-2 space-y-1">
              {h.ogohlar.filter((o) => o.kod !== OGOH.TASDIQSIZ).map((o) => (
                <div key={o.kod} className={`text-[11px] rounded px-2 py-1 border ${OGOH_USLUB[o.daraja] || OGOH_USLUB.sariq}`}>
                  {o.matn}
                </div>
              ))}
            </div>
          )}
        </div>

        {urinildi && xatoBor && (
          <div className="flex items-start gap-2 text-xs bg-red-50 border-2 border-red-200 text-red-700 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Yulduzcha (*) bilan belgilangan maydonlarni to'ldiring — qizil bilan ajratilgan.</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 rounded-lg bg-white font-medium">
            Bekor
          </button>
          <button type="submit"
            className="flex-1 py-2.5 rounded-lg font-medium text-white bg-slate-900 flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" /> {yangi ? "Saqlash va ro'yxatga qo'shish" : 'Saqlash'}
          </button>
        </div>
      </form>
    </FullModal>
  );
}

// ============================================================
//  MOBIL KARTOCHKA (768px dan kichik ekranda) — faqat ko'rish
// ============================================================
function RulonKarta({ q, canEdit, nom1, nom2, onTahrir, onOchir, onTasdiq }) {
  const h = q.h;
  const fon = FON[h.daraja] || 'bg-white';

  const juft = (nom, el) => (
    <span className="whitespace-nowrap"><span className="text-slate-400">{nom} </span>{el}</span>
  );

  return (
    <div className={`rounded-xl border border-slate-200 p-3 ${fon}`}
      onClick={canEdit ? () => onTahrir(q) : undefined} role={canEdit ? 'button' : undefined}>
      {/* Sarlavha: rang · qalinlik · kimdan · tur · sana */}
      <div className="flex items-center gap-2">
        <RangNamuna rang={q.rang} size="w-9 h-9" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <b className="text-sm text-slate-900 truncate">{q.rang || "rang yo'q"}</b>
            <span className="text-xs text-slate-600 tabular-nums flex-shrink-0">
              {xomKor(q.qalinlik) ? `${xomKor(q.qalinlik)} mm` : '— mm'}
            </span>
            <OgohBelgi h={h} />
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {q.zavod || "kimdan — yo'q"} · {q.tur || "tur yo'q"}
            {q.sana ? ` · ${sanaKor(q.sana)}` : ''}
          </div>
        </div>
        <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">№{xomKor(q.nomer) || '—'}</span>
      </div>

      {/* Sotuv narxlari — birinchi o'rinda */}
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        <SotuvQuti nom={nom1} qiymat={h.sotuv1} asosiy kichik />
        <SotuvQuti nom={nom2} qiymat={h.sotuv2} asosiy kichik />
        <SotuvQuti nom="1 m tannarx" qiymat={h.metrTannarx} kichik />
      </div>

      {/* Xarid tafsilotlari */}
      <div className="mt-2 text-[11px] text-slate-700 tabular-nums flex flex-wrap gap-x-3 gap-y-0.5">
        {juft("Og'irlik", `${olchovKor(q.ogirlik) || '—'} kg`)}
        {juft('Uzunlik', <><UzunlikKor h={h} /> m</>)}
        {juft('Qoldiq', <><QoldiqKor q={q} /> m</>)}
        {juft('Narx', `${h.narxTonna != null ? fmt(h.narxTonna) : '—'} $/t`)}
        {juft('Kurs', h.kurs != null ? fmt(h.kurs) : '—')}
        {juft('Rulon', `${h.rulonSom != null ? fmt(h.rulonSom) : '—'} so'm`)}
      </div>
      {q.izoh && <div className="mt-1 text-[11px] text-slate-500 italic">{q.izoh}</div>}

      {h.ogohlar.length > 0 && (
        <div className="mt-2 space-y-1">
          {h.ogohlar.map((o) => (
            <div key={o.kod} className={`text-[11px] rounded px-2 py-1 border ${OGOH_USLUB[o.daraja] || OGOH_USLUB.sariq}`}>
              {o.matn}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
          {q.tasdiqlanmagan && (
            <button type="button" onClick={() => onTasdiq(q)}
              className="px-2.5 py-1.5 rounded-lg border-2 border-emerald-200 text-emerald-700 bg-white text-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Tasdiqlash
            </button>
          )}
          <button type="button" onClick={() => onTahrir(q)}
            className="px-2.5 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 bg-white text-xs flex items-center gap-1">
            <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
          </button>
          <button type="button" onClick={() => onOchir(q)}
            className="px-2.5 py-1.5 rounded-lg border-2 border-red-200 text-red-600 bg-white text-xs flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  ASOSIY KOMPONENT
// ============================================================
export function Rulonlar({
  rulonlar = {}, sozlama = {}, rangTur = {},
  setRulon, canEdit = true, showToast,
}) {
  const [filtr, setFiltr] = useState(FILTR_BOSH);
  const [sort, setSort] = useState({ ustun: 'nomer', yon: 1 });
  // Forma holati: null — yopiq; { asl: null } — yangi; { asl: rulon } — tahrir
  const [forma, setForma] = useState(null);

  const toast = (t) => { if (showToast) showToast(t); };

  // Sotuv ustunlari sarlavhalari — SOZLAMADAN
  const nom1 = sozlama.nom1 || '1-narx';
  const nom2 = sozlama.nom2 || '2-narx';

  // ----- Hisoblash (yadro) -----
  const qatorlar = useMemo(() => hisobla(rulonlar, { sozlama }), [rulonlar, sozlama]);

  // ----- Tanlov ro'yxatlari: sozlama + mavjud qiymatlar -----
  const zavodlar = useMemo(() => birlashtir(sozlamaRoyxat(sozlama, 'zavodlar'), [rulonlar], 'zavod'), [sozlama, rulonlar]);
  const turlar = useMemo(() => birlashtir(sozlamaRoyxat(sozlama, 'turlar'), [rulonlar], 'tur'), [sozlama, rulonlar]);
  const ranglar = useMemo(() => birlashtir(sozlamaRoyxat(sozlama, 'ranglar'), [rulonlar], 'rang'), [sozlama, rulonlar]);
  const qalinliklar = useMemo(() => qalinlikRoyxat([rulonlar]), [rulonlar]);

  // ----- Filtr + saralash -----
  const korinadigan = useMemo(() => {
    const qq = norm(filtr.q);
    const fz = norm(filtr.zavod);
    const ft = norm(filtr.tur);
    const res = qatorlar.filter((q) => {
      if (fz && norm(q.zavod) !== fz) return false;
      if (ft && norm(q.tur) !== ft) return false;
      if (filtr.qalinlik) {
        const qal = son(q.qalinlik);
        if (qal == null || String(qal) !== filtr.qalinlik) return false;
      }
      if (qq && !norm(q.rang).includes(qq) && !norm(q.izoh).includes(qq) && !norm(q.zavod).includes(qq)) return false;
      return true;
    });
    return res.sort((a, b) => solish(saraQiymat(a, sort.ustun), saraQiymat(b, sort.ustun), sort.yon));
  }, [qatorlar, filtr, sort]);

  const jami = useMemo(() => jamiHisob(korinadigan), [korinadigan]);

  // ----- Ogohlantirishlar yig'masi -----
  const ogohXulosa = useMemo(() => {
    const xarita = new Map();
    for (const q of korinadigan) {
      for (const o of q.h.ogohlar) {
        const bor = xarita.get(o.kod);
        if (bor) bor.soni += 1;
        else xarita.set(o.kod, { kod: o.kod, daraja: o.daraja, soni: 1 });
      }
    }
    return [...xarita.values()].sort(
      (a, b) => (DARAJA_OGIRLIK[a.daraja] ?? 9) - (DARAJA_OGIRLIK[b.daraja] ?? 9),
    );
  }, [korinadigan]);

  // Keyingi tartib raqam — mavjudlarning eng kattasi + 1
  const keyingiNomer = useMemo(() => {
    let maks = 0;
    for (const q of qatorlar) maks = Math.max(maks, son(q.nomer) || 0);
    return maks + 1;
  }, [qatorlar]);

  // ----- Forma ochish / saqlash -----
  function yangiOch() {
    if (!canEdit) return;
    setForma({ asl: null });
  }
  function tahrirOch(q) {
    if (!canEdit) return;
    const asl = { ...q };
    delete asl.h;
    setForma({ asl });
  }
  // Formadan kelgan rulon: yangi bo'lsa id beriladi, keyin BITTA yozuv
  function saqla(rulon) {
    if (!canEdit || !setRulon) return;
    const yangi = !forma || !forma.asl;
    const id = yangi ? genId() : forma.asl.id;
    setRulon(id, { ...rulon, id });
    setForma(null);
    if (yangi) {
      // Filtr yoqilgan bo'lsa yangi rulon ko'rinmay qolishi mumkin — tozalaymiz
      const filtrBor = Boolean(filtr.zavod || filtr.tur || filtr.qalinlik || filtr.q);
      if (filtrBor) setFiltr(FILTR_BOSH);
      toast(filtrBor ? "Rulon ro'yxatga qo'shildi — filtr tozalandi" : "Rulon ro'yxatga qo'shildi");
    } else {
      toast('Saqlandi');
    }
  }

  function ochirish(q) {
    if (!canEdit || !setRulon) return;
    if (!window.confirm(`№${xomKor(q.nomer)} ${rulonNomi(q) || 'rulon'} o'chirilsinmi?`)) return;
    setRulon(q.id, null);
    toast("O'chirildi");
  }

  function tasdiqla(q) {
    if (!canEdit || !setRulon) return;
    const yangi = { ...q, tasdiqlanmagan: false };
    delete yangi.h;
    setRulon(q.id, yangi);
    toast('Tasdiqlandi');
  }

  function saral(ustun) {
    setSort((s) => (s.ustun === ustun ? { ustun, yon: -s.yon } : { ustun, yon: 1 }));
  }

  // ----- Excel eksport: JORIY filtrlangan + saralangan ro'yxat, DAFTAR tartibida -----
  const XLS_USTUN = useMemo(() => ([
    { nom: '№', kenglik: 5, tur: 'son', ol: (q) => son(q.nomer) },
    { nom: 'Sana', kenglik: 11, tur: 'matn', ol: (q) => sanaKor(q.sana) },
    { nom: 'Kimdan', kenglik: 16, tur: 'matn', ol: (q) => q.zavod || '' },
    { nom: 'Tur', kenglik: 12, tur: 'matn', ol: (q) => q.tur || '' },
    { nom: 'Rang', kenglik: 14, tur: 'matn', ol: (q) => q.rang || '' },
    { nom: 'Qalinlik', kenglik: 9, tur: 'matn', ol: (q) => xomKor(q.qalinlik) },
    { nom: "Og'irlik kg", kenglik: 11, tur: 'son', ol: (q) => son(q.ogirlik) },
    { nom: 'Narx $/t', kenglik: 10, tur: 'dollar', ol: (q) => q.h.narxTonna },
    { nom: 'Rulon $', kenglik: 11, tur: 'dollar', ol: (q) => q.h.rulonDollar },
    { nom: 'Kurs', kenglik: 9, tur: 'son', ol: (q) => q.h.kurs },
    { nom: "Rulon so'm", kenglik: 15, tur: 'pul', ol: (q) => q.h.rulonSom },
    { nom: 'Uzunlik m', kenglik: 10, tur: 'son', ol: (q) => q.h.uzunlik },
    { nom: "Yo'lkira $/t", kenglik: 11, tur: 'dollar', ol: (q) => q.h.yolkiraTonna },
    { nom: "Yo'lkira $", kenglik: 11, tur: 'dollar', ol: (q) => q.h.yolkiraDollar },
    { nom: '1 m tannarx', kenglik: 13, tur: 'pul', ol: (q) => q.h.metrTannarx },
    { nom: nom1, kenglik: 13, tur: 'pul', ol: (q) => q.h.sotuv1 },
    { nom: nom2, kenglik: 13, tur: 'pul', ol: (q) => q.h.sotuv2 },
    { nom: 'Qoldiq m', kenglik: 10, tur: 'son', ol: (q) => q.h.qoldiq },
    { nom: 'Izoh', kenglik: 24, tur: 'matn', ol: (q) => q.izoh || '' },
  ]), [nom1, nom2]);

  function eksport() {
    if (!korinadigan.length) { toast("Eksport uchun qator yo'q"); return; }
    const ustunlar = XLS_USTUN.map((u) => ({ nom: u.nom, kenglik: u.kenglik, tur: u.tur }));
    const qatorlarXls = korinadigan.map((q) => ({
      katak: XLS_USTUN.map((u) => {
        const v = u.ol(q);
        if (u.tur === 'matn') return v == null ? '' : String(v);
        return v == null ? '' : Math.round(Number(v));
      }),
      fon: q.h.daraja || '',
    }));
    const jamiKatak = XLS_USTUN.map((u) => {
      if (u.nom === 'Kimdan') return `Jami: ${jami.soni} ta rulon`;
      if (u.nom === "Og'irlik kg") return Math.round(jami.ogirlik);
      if (u.nom === 'Rulon $') return Math.round(jami.rulonDollar);
      if (u.nom === "Rulon so'm") return Math.round(jami.rulonSom);
      if (u.nom === 'Uzunlik m') return Math.round(jami.uzunlik);
      if (u.nom === "Yo'lkira $") return Math.round(jami.yolkiraDollar);
      if (u.nom === 'Qoldiq m') return Math.round(jami.qoldiq);
      if (u.nom === 'Izoh') return `Jami so'm: ${fmt(jami.jamiSom)} · Ombor qiymati: ${fmt(jami.qiymat)}`;
      return '';
    });
    downloadXLSX('ombor-rulonlar.xlsx', {
      nom: 'Ombor', ustunlar, qatorlar: qatorlarXls, jami: { katak: jamiKatak },
    });
    toast('Excel yuklandi');
  }

  const tonna = jami.ogirlik / 1000;

  return (
    <div className="space-y-4">
      {/* ----- Yuqoridagi umumiy raqamlar ----- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Rulonlar" value={jami.soni} suffix="ta" />
        <StatBox label="Umumiy og'irlik" value={olchovKor(tonna, 2)} suffix="t" />
        <StatBox label="Jami xarajat (yo'lkira bilan)" value={Math.round(jami.jamiSom)} suffix="so'm" />
        <StatBox label="Ombordagi qoldiq qiymati" value={Math.round(jami.qiymat)} suffix="so'm" color="emerald" />
      </div>

      {/* ----- Ogohlantirishlar yig'masi ----- */}
      {ogohXulosa.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ogohXulosa.map((o) => (
            <span key={o.kod}
              className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${OGOH_USLUB[o.daraja] || OGOH_USLUB.sariq}`}>
              {o.daraja === 'sariq' ? <AlertCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <b className="tabular-nums">{o.soni} ta</b>
              <span>{OGOH_NOM[o.kod] || o.kod}</span>
            </span>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-start justify-between gap-2">
          <SectionTitle icon={Layers}>Ombordagi rulonlar ({korinadigan.length})</SectionTitle>
          <div className="flex gap-2 flex-shrink-0">
            <button type="button" onClick={eksport} title="Excelga yuklash (daftar tartibida, to'liq hisob bilan)"
              className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50">
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
            </button>
            {canEdit && (
              <button type="button" onClick={yangiOch}
                className="bg-slate-900 text-white rounded-lg px-3 py-2 font-medium text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Rulon qo'shish</span>
              </button>
            )}
          </div>
        </div>

        <FiltrPanel filtr={filtr} setFiltr={setFiltr}
          zavodlar={zavodlar} turlar={turlar} qalinliklar={qalinliklar} />

        {korinadigan.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Layers className="w-10 h-10 mx-auto mb-2 opacity-40" />
            {qatorlar.length === 0 ? (
              <>
                <p className="text-sm text-slate-500">Omborda hali rulon yo'q</p>
                <p className="text-xs mt-1">
                  {canEdit
                    ? "«Rulon qo'shish» tugmasini bosing — har bir rulon alohida formada kiritiladi."
                    : "Rulon qo'shish uchun ruxsat yo'q."}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm">Filtrga mos rulon topilmadi</p>
                <p className="text-xs mt-1">Jami {qatorlar.length} ta rulon bor — filtrni tozalab ko'ring.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {canEdit && (
              <p className="text-[11px] text-slate-400 mb-1.5">
                Qatorni bosib tahrirlash oynasini ochasiz. Excel — daftar tartibida, to'liq hisob bilan.
              </p>
            )}

            {/* ================= JADVAL (md dan katta ekran) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs min-w-[1380px]">
                <thead>
                  <tr className="text-xs text-slate-500 border-b-2 border-slate-200">
                    <Th k="nomer" nom="№" sort={sort} onSort={saral} />
                    <Th k="sana" nom="Sana" sort={sort} onSort={saral} />
                    <Th k="zavod" nom="Kimdan" sort={sort} onSort={saral} title="Zavod yoki yetkazib beruvchi" />
                    <Th k="tur" nom="Tur" sort={sort} onSort={saral} />
                    <Th k="rang" nom="Rang" sort={sort} onSort={saral} />
                    <Th k="qalinlik" nom="Qal." sort={sort} onSort={saral} hizala="right" title="Qalinlik, mm" />
                    <Th k="sotuv1" nom={nom1} sort={sort} onSort={saral} hizala="right" qalin title="Sotuv narxi, 1 m (so'm)" />
                    <Th k="sotuv2" nom={nom2} sort={sort} onSort={saral} hizala="right" qalin title="Sotuv narxi, 1 m (so'm)" />
                    <Th k="metrTannarx" nom="Tannarx" sort={sort} onSort={saral} hizala="right" title="1 m tannarx, yo'lkira bilan (so'm)" />
                    <Th k="qoldiq" nom="Qoldiq" sort={sort} onSort={saral} hizala="right" title="Omborda qolgan metr" />
                    <Th k="ogirlik" nom="Og'irlik" sort={sort} onSort={saral} hizala="right" title="kg" />
                    <Th k="uzunlik" nom="Uzunlik" sort={sort} onSort={saral} hizala="right" title="m" />
                    <Th k="narxTonna" nom="Narx $/t" sort={sort} onSort={saral} hizala="right" />
                    <Th k="kurs" nom="Kurs" sort={sort} onSort={saral} hizala="right" title="Olingan kungi kurs" />
                    <Th k="rulonSom" nom="Rulon so'm" sort={sort} onSort={saral} hizala="right" title="Rulon narxi so'mda (yo'lkirasiz)" />
                    <Th k="izoh" nom="Izoh" sort={sort} onSort={saral} />
                    {canEdit && <th className="py-2 px-2 font-semibold text-center whitespace-nowrap">Amallar</th>}
                  </tr>
                </thead>

                <tbody>
                  {korinadigan.map((q) => {
                    const h = q.h;
                    return (
                      <tr key={q.id}
                        className={`border-b border-slate-100 align-middle ${FON[h.daraja] || ''} ${canEdit ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                        onClick={canEdit ? () => tahrirOch(q) : undefined}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 tabular-nums text-slate-500">
                            <OgohBelgi h={h} />
                            {xomKor(q.nomer) || <Bosh />}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap tabular-nums text-slate-700">{sanaKor(q.sana) || <Bosh />}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-slate-900">{q.zavod || <Bosh />}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-slate-700">{q.tur || <Bosh />}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-slate-900">
                            <RangNamuna rang={q.rang} />{q.rang || <Bosh />}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-900">{xomKor(q.qalinlik) || <Bosh />}</td>
                        <PulKatak qiymat={h.sotuv1} qalin />
                        <PulKatak qiymat={h.sotuv2} qalin />
                        <PulKatak qiymat={h.metrTannarx} />
                        <td className="px-2 py-1.5 text-right"><QoldiqKor q={q} /></td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{olchovKor(q.ogirlik) || <Bosh />}</td>
                        <td className="px-2 py-1.5 text-right"><UzunlikKor h={h} /></td>
                        <PulKatak qiymat={h.narxTonna} />
                        <PulKatak qiymat={h.kurs} />
                        <PulKatak qiymat={h.rulonSom} title={h.jamiSom != null ? `Yo'lkira bilan: ${fmt(h.jamiSom)} so'm` : ''} />
                        <td className="px-2 py-1.5 text-slate-500 max-w-[180px] truncate" title={q.izoh || ''}>{q.izoh || <Bosh />}</td>
                        {canEdit && (
                          <td className="px-2 py-1 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex gap-1">
                              {q.tasdiqlanmagan && (
                                <button type="button" onClick={() => tasdiqla(q)} title="Tasdiqlash"
                                  className="p-1.5 rounded border border-emerald-200 text-emerald-700 bg-white">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button type="button" onClick={() => tahrirOch(q)} title="Tahrirlash"
                                className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => ochirish(q)} title="O'chirish"
                                className="p-1.5 rounded border border-red-200 text-red-600 bg-white">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-800 border-t-2 border-slate-300 tabular-nums">
                    <td className="px-2 py-2 whitespace-nowrap" colSpan={6}>Jami — {jami.soni} ta rulon</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap" colSpan={3} title="Qoldiq × 1 m tannarx">
                      Qoldiq qiymati: {fmt(jami.qiymat)}
                    </td>
                    <td className="px-2 py-2 text-right" title="Ombordagi umumiy qoldiq">{olchovKor(jami.qoldiq)} m</td>
                    <td className="px-2 py-2 text-right" title="Umumiy og'irlik (tonna)">{olchovKor(tonna, 2)} t</td>
                    <td className="px-2 py-2 text-right" title="Umumiy uzunlik">{olchovKor(jami.uzunlik)} m</td>
                    <td colSpan={2} />
                    <td className="px-2 py-2 text-right" title="Rulon so'm yig'indisi (yo'lkirasiz)">{fmt(jami.rulonSom)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap" colSpan={canEdit ? 2 : 1}
                      title={`Barcha rulonlarga to'langan jami, yo'lkira bilan (${fmt(jami.jamiDollar)} $)`}>
                      Jami: {fmt(jami.jamiSom)} so'm
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ================= KARTOCHKALAR (mobil) ================= */}
            <div className="md:hidden space-y-2">
              {korinadigan.map((q) => (
                <RulonKarta key={q.id} q={q} canEdit={canEdit} nom1={nom1} nom2={nom2}
                  onTahrir={tahrirOch} onOchir={ochirish} onTasdiq={tasdiqla} />
              ))}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs tabular-nums">
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Rulonlar</span><b>{jami.soni} ta</b></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Umumiy og'irlik</span><b>{olchovKor(tonna, 2)} t</b></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Umumiy uzunlik</span><b>{olchovKor(jami.uzunlik)} m</b></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Yo'lkira</span><b>{fmt(jami.yolkiraSom)} so'm</b></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Jami xarajat</span><b>{fmt(jami.jamiSom)} so'm</b></div>
                <div className="flex justify-between py-0.5"><span className="text-slate-500">Qoldiq qiymati</span><b>{fmt(jami.qiymat)} so'm</b></div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ----- Rulon formasi (modal) ----- */}
      {forma && (
        <RulonForma
          asl={forma.asl} sozlama={sozlama} rangTur={rangTur}
          zavodlar={zavodlar} turlar={turlar} ranglar={ranglar}
          nom1={nom1} nom2={nom2} keyingiNomer={keyingiNomer}
          onClose={() => setForma(null)} onSave={saqla} />
      )}
    </div>
  );
}
