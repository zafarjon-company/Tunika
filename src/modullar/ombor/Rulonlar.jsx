// ============================================================
//  OMBOR → RULONLAR
// ------------------------------------------------------------
//  Ombordagi rulonlarning ASOSIY jadvali. Barcha hisob-kitob
//  src/lib/omborHisob.js dagi sof funksiyalarda — bu faylda
//  birorta narx / kurs / ustama / koeffitsient QATTIQ YOZILMAGAN,
//  hammasi `sozlama` va `narxlar` proplaridan keladi.
//
//  Tahrirlash INLINE: katakka bosilganda o'sha yerda tahrirlanadi,
//  blur yoki Enter da darhol setRulon orqali yoziladi (optimistik),
//  Escape — bekor qiladi.
//
//  Ma'lumot:
//    rulonlar — { [id]: Rulon } obyekt-xarita
//    narxlar  — { [id]: Narx } obyekt-xarita
//    setRulon(id, rulon)  — bitta rulonni yozadi (null = o'chiradi)
// ============================================================
import React, { useState, useMemo, useRef } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, AlertCircle,
  Search, X, FileSpreadsheet, Layers, Check,
} from 'lucide-react';
import { Card, SectionTitle, StatBox, rangChipStyle } from '../../components/ui.jsx';
import { fmt, genId, sonMatn, sonQiymat } from '../../lib/helpers.js';
import { hisobla, jamiHisob, turTaxmin, son, OGOH } from '../../lib/omborHisob.js';
import { ZAVODLAR, TURLAR, RANGLAR } from '../../lib/omborSeed.js';
import { downloadXLSX } from '../../lib/xlsx.js';

// ----- Kichik yordamchilar -----

// Qidiruv uchun normallashtirish (registr va apostroflar farq qilmasin)
const past = (s) => String(s == null ? '' : s).toLowerCase().replace(/['`’ʼ]/g, '').trim();

// O'lchov (metr / tonna) — PUL emas, shuning uchun fmt emas: kasr xonasi qoladi.
// Pul qiymatlari esa har doim fmt() bilan butunga yaxlitlanadi.
function olchovKor(n, kasr = 1) {
  const v = Number(n);
  if (n == null || !Number.isFinite(v)) return '';
  const k = 10 ** kasr;
  return String(Math.round(v * k) / k);
}

// Xom (saqlangan) qiymatni katakda ko'rsatish uchun matn
const xomKor = (v) => (v == null || v === '' ? '' : String(v));

// Ro'yxatlarni birlashtirish: standart ro'yxat + mavjud yozuvlardagi noyob
// qiymatlar (foydalanuvchi kiritgani ham dropdownda ko'rinsin).
function birlashtir(asos, manbalar, kalit) {
  const out = [];
  const korilgan = new Set();
  const qosh = (v) => {
    const s = String(v == null ? '' : v).trim();
    if (!s) return;
    const k = past(s);
    if (korilgan.has(k)) return;
    korilgan.add(k);
    out.push(s);
  };
  (asos || []).forEach(qosh);
  for (const m of manbalar) {
    const xom = Array.isArray(m) ? m : Object.values(m || {});
    for (const x of xom) if (x && typeof x === 'object') qosh(x[kalit]);
  }
  return out;
}

// Qalinliklar ro'yxati (filtr uchun) — son sifatida taqqoslanadi
function qalinlikRoyxat(manbalar) {
  const set = new Set();
  for (const m of manbalar) {
    const xom = Array.isArray(m) ? m : Object.values(m || {});
    for (const x of xom) {
      if (!x || typeof x !== 'object') continue;
      const q = son(x.qalinlik);
      if (q != null && q > 0) set.add(String(q));
    }
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

// Ogohlantirish darajasi → qator foni
const FON = { qizil: 'bg-red-50', toq: 'bg-orange-50', sariq: 'bg-amber-50' };
// Ogohlantirish darajasi → yig'ma ro'yxat uslubi
const OGOH_USLUB = {
  qizil: 'bg-red-50 border-red-300 text-red-800',
  toq: 'bg-orange-50 border-orange-300 text-orange-800',
  sariq: 'bg-amber-50 border-amber-300 text-amber-800',
};
// Ogohlantirish kodi → qisqa sarlavha (yig'ma ro'yxatda)
const OGOH_NOM = {
  [OGOH.NARX_YOQ]: "Narx ro'yxatida yo'q",
  [OGOH.ARZONLADI]: 'Yangi narx xarid narxidan past',
  [OGOH.QALINLIK]: 'Qalinlik mos emas',
  [OGOH.TASDIQSIZ]: 'Zavod / tur / qalinlik tasdiqlanmagan',
};
const DARAJA_OGIRLIK = { qizil: 0, toq: 1, sariq: 2 };

// Hisoblangan (tahrirlanmaydigan) ustunlar — saralashda h dan olinadi
const HISOB_USTUN = new Set([
  'uzunlik', 'qoldiq', 'yangiNarx', 'rulonDollar', 'rulonSom',
  'metrTannarx', 'sotuv1', 'sotuv2',
]);
const MATN_USTUN = new Set(['rang', 'zavod', 'tur', 'izoh']);

// Saralash uchun katak qiymati
function saraQiymat(q, k) {
  if (HISOB_USTUN.has(k)) return q.h[k];
  if (MATN_USTUN.has(k)) return past(q[k]);
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

// ============================================================
//  TAHRIR KATAK — joyida (inline) tahrirlanadigan katak
// ------------------------------------------------------------
//  value    — saqlangan XOM qiymat (matn yoki son)
//  onSave   — (xomMatn) => void; blur yoki Enter da chaqiriladi
//  tur      — 'matn' | 'son' | 'select'
//  korinish — tahrir qilinmayotgan paytdagi maxsus ko'rinish (ixtiyoriy)
// ============================================================
function TahrirKatak({
  value, onSave, canEdit = true, tur = 'matn', variantlar = [],
  hizala = 'left', korinish = null, title = '', klass = '',
}) {
  const [tahrir, setTahrir] = useState(false);
  const [xom, setXom] = useState('');
  // Escape bosilganda blur ham ishga tushadi — shu bayroq saqlashni to'xtatadi
  const bekorRef = useRef(false);

  const matn = xomKor(value);
  const hiz = hizala === 'right' ? 'text-right' : hizala === 'center' ? 'text-center' : 'text-left';

  function boshla() {
    if (!canEdit || tahrir) return;
    bekorRef.current = false;
    setXom(matn);
    setTahrir(true);
  }

  // Tahrirni yakunlash: bekor qilinmagan va qiymat o'zgargan bo'lsa — yozamiz
  function yakunla() {
    setTahrir(false);
    if (bekorRef.current) { bekorRef.current = false; return; }
    if (xom !== matn) onSave(xom);
  }

  function klav(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); bekorRef.current = true; e.currentTarget.blur(); }
  }

  if (tahrir && tur === 'select') {
    return (
      <select
        autoFocus value={matn}
        onChange={(e) => { setTahrir(false); if (e.target.value !== matn) onSave(e.target.value); }}
        onBlur={() => setTahrir(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setTahrir(false); }}
        className={`w-full px-2 py-1.5 border border-slate-300 rounded bg-white ${klass}`}
      >
        <option value="">—</option>
        {variantlar.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }

  if (tahrir) {
    return (
      <input
        autoFocus
        inputMode={tur === 'son' ? 'decimal' : undefined}
        value={xom}
        onChange={(e) => {
          if (tur === 'son') { const s = sonMatn(e.target.value); if (s !== null) setXom(s); }
          else setXom(e.target.value);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={yakunla}
        onKeyDown={klav}
        className={`w-full px-2 py-1.5 border border-slate-300 rounded bg-white ${tur === 'son' ? 'tabular-nums text-right' : ''} ${klass}`}
      />
    );
  }

  return (
    <div
      onClick={boshla} title={title}
      className={`px-2 py-1.5 rounded ${hiz} ${tur === 'son' ? 'tabular-nums' : ''} ${
        canEdit ? 'cursor-text hover:bg-slate-100' : 'cursor-default'
      } ${klass}`}
    >
      {korinish != null ? korinish : (matn || <span className="text-slate-300">—</span>)}
    </div>
  );
}

// ----- Hisoblangan (tahrirlanmaydigan) katak -----
//  narx=true bo'lsa qiymat yo'qligi "YO'Q" (qizil) bo'lib ko'rinadi.
function HisobKatak({ qiymat, narx = false, matn = null }) {
  return (
    <td className="px-2 py-1.5 text-right tabular-nums bg-slate-50 cursor-default text-slate-700 border-b border-slate-100">
      {qiymat == null
        ? <span className={narx ? 'text-red-600 font-semibold' : 'text-slate-300'}>{narx ? "YO'Q" : '—'}</span>
        : (matn != null ? matn : fmt(qiymat))}
    </td>
  );
}

// ----- Jadval sarlavhasi (saralash tugmasi bilan) -----
function Th({ k, nom, sort, onSort, hizala = 'left' }) {
  const faol = sort.ustun === k;
  const hiz = hizala === 'right' ? 'text-right' : hizala === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`py-2 px-2 font-semibold whitespace-nowrap ${hiz}`}>
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-0.5 hover:text-slate-900 ${faol ? 'text-slate-900' : ''}`}>
        <span>{nom}</span>
        {faol && (sort.yon > 0 ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>
    </th>
  );
}

// ----- Ogohlantirish belgisi (qator boshida) -----
function OgohBelgi({ h }) {
  if (!h.daraja) return null;
  const matn = h.ogohlar.map((o) => o.matn).join(' · ');
  const Ikon = h.daraja === 'sariq' ? AlertCircle : AlertTriangle;
  const rang = h.daraja === 'qizil' ? 'text-red-600' : h.daraja === 'toq' ? 'text-orange-600' : 'text-amber-600';
  return <Ikon className={`w-3.5 h-3.5 inline-block flex-shrink-0 ${rang}`} title={matn} />;
}

// ----- Rang namunasi -----
function RangNamuna({ rang, size = 'w-4 h-4' }) {
  if (!rang) return <span className={`${size} rounded border border-slate-200 bg-slate-100 inline-block flex-shrink-0`} />;
  return (
    <span className={`${size} rounded border border-black/10 inline-block flex-shrink-0`}
      title={rang} style={rangChipStyle(rang)} />
  );
}

// ============================================================
//  FILTR / QIDIRUV PANELI
// ============================================================
function FiltrPanel({ filtr, setFiltr, zavodlar, turlar, qalinliklar }) {
  const tozaBor = filtr.zavod || filtr.tur || filtr.qalinlik || filtr.q;
  const sel = 'px-2 py-1.5 border border-slate-300 rounded bg-white text-xs';
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={filtr.q} onChange={(e) => setFiltr({ ...filtr, q: e.target.value })}
          placeholder="Rang yoki izoh bo'yicha qidirish"
          className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded bg-white text-xs" />
      </div>
      <select value={filtr.zavod} onChange={(e) => setFiltr({ ...filtr, zavod: e.target.value })} className={sel}>
        <option value="">Barcha zavodlar</option>
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
        <button type="button" onClick={() => setFiltr({ zavod: '', tur: '', qalinlik: '', q: '' })}
          className="px-2.5 py-1.5 rounded border-2 border-slate-200 bg-white text-slate-600 text-xs flex items-center gap-1 hover:bg-slate-50">
          <X className="w-3.5 h-3.5" /> Tozalash
        </button>
      )}
    </div>
  );
}

// ============================================================
//  MOBIL KARTOCHKA (768px dan kichik ekranda)
// ============================================================
function RulonKarta({
  q, canEdit, zavodlar, turlar, ranglar, nom1, nom2,
  matnYoz, sonYoz, rangYoz, onOchir, onTasdiq,
}) {
  const h = q.h;
  const fon = FON[h.daraja] || 'bg-white';
  const maydon = 'border border-slate-200 rounded bg-white';

  // Uzunlik: hisoblangan bo'lsa "≈" bilan ko'rsatiladi
  const uzunlikKor = h.uzunlik == null
    ? <span className="text-slate-300">—</span>
    : (
      <span className="tabular-nums" title={h.uzunlikHisoblangan ? "og'irlikdan hisoblandi" : ''}>
        {h.uzunlikHisoblangan && <span className="text-slate-400">≈ </span>}{olchovKor(h.uzunlik)}
      </span>
    );
  const qoldiqKor = h.qoldiq == null
    ? <span className="text-slate-300">—</span>
    : <span className={`tabular-nums ${xomKor(q.qoldiq) ? '' : 'text-slate-400'}`}>{olchovKor(h.qoldiq)}</span>;

  const narxQuti = (nom, qiymat) => (
    <div className="bg-slate-50 rounded-lg py-1.5 px-1 text-center">
      <div className="text-[10px] text-slate-500 truncate">{nom}</div>
      <div className="text-sm font-bold tabular-nums text-slate-900">
        {qiymat == null ? <span className="text-red-600">YO'Q</span> : fmt(qiymat)}
      </div>
    </div>
  );

  return (
    <div className={`rounded-xl border border-slate-200 p-3 ${fon}`}>
      <div className="flex items-center gap-2">
        <RangNamuna rang={q.rang} size="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <b className="text-sm text-slate-900 truncate">{q.rang || "rang yo'q"}</b>
            <span className="text-xs text-slate-500 tabular-nums flex-shrink-0">
              {xomKor(q.qalinlik) ? `${xomKor(q.qalinlik)} mm` : '— mm'}
            </span>
            <OgohBelgi h={h} />
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {q.zavod || "zavod yo'q"} · {q.tur || "tur yo'q"}
          </div>
        </div>
        <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">№{xomKor(q.nomer) || '—'}</span>
      </div>

      {h.ogohlar.length > 0 && (
        <div className="mt-2 space-y-1">
          {h.ogohlar.map((o) => (
            <div key={o.kod} className={`text-[11px] rounded px-2 py-1 border ${OGOH_USLUB[o.daraja] || OGOH_USLUB.sariq}`}>
              {o.matn}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 mt-2">
        {narxQuti('1 m tannarx', h.metrTannarx)}
        {narxQuti(nom1, h.sotuv1)}
        {narxQuti(nom2, h.sotuv2)}
      </div>

      <div className="grid grid-cols-3 gap-1.5 mt-2 text-xs">
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Og'irlik (kg)</div>
          <TahrirKatak value={q.ogirlik} onSave={sonYoz(q, 'ogirlik')} canEdit={canEdit}
            tur="son" hizala="right" klass={maydon} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Uzunlik (m)</div>
          <TahrirKatak value={q.uzunlik} onSave={sonYoz(q, 'uzunlik')} canEdit={canEdit}
            tur="son" hizala="right" korinish={uzunlikKor} klass={maydon} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Qoldiq (m)</div>
          <TahrirKatak value={q.qoldiq} onSave={sonYoz(q, 'qoldiq')} canEdit={canEdit}
            tur="son" hizala="right" korinish={qoldiqKor} klass={maydon} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mt-2 text-xs">
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Rang</div>
          <TahrirKatak value={q.rang} onSave={rangYoz(q)} canEdit={canEdit}
            tur="select" variantlar={ranglar} klass={maydon} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Qalinlik (mm)</div>
          <TahrirKatak value={q.qalinlik} onSave={sonYoz(q, 'qalinlik')} canEdit={canEdit}
            tur="son" hizala="right" klass={maydon} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Zavod</div>
          <TahrirKatak value={q.zavod} onSave={matnYoz(q, 'zavod')} canEdit={canEdit}
            tur="select" variantlar={zavodlar} klass={maydon} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">Tur</div>
          <TahrirKatak value={q.tur} onSave={matnYoz(q, 'tur')} canEdit={canEdit}
            tur="select" variantlar={turlar} klass={maydon} />
        </div>
      </div>

      <div className="mt-2 text-xs">
        <div className="text-[10px] text-slate-500 mb-0.5">Izoh</div>
        <TahrirKatak value={q.izoh} onSave={matnYoz(q, 'izoh')} canEdit={canEdit} klass={maydon} />
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 text-[11px] text-slate-500">
        <span className="tabular-nums">
          Rulon: {h.rulonSom == null ? "narx yo'q" : `${fmt(h.rulonSom)} so'm`}
          {h.rulonDollar != null && ` · ${fmt(h.rulonDollar)} $`}
        </span>
        {canEdit && (
          <span className="flex gap-1.5">
            {q.tasdiqlanmagan && (
              <button type="button" onClick={() => onTasdiq(q)} title="Tasdiqlash"
                className="px-2 py-1 rounded border-2 border-emerald-200 text-emerald-700 bg-white">
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" onClick={() => onOchir(q)} title="O'chirish"
              className="px-2 py-1 rounded border-2 border-red-200 text-red-600 bg-white">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  ASOSIY KOMPONENT
// ============================================================
export function Rulonlar({
  rulonlar = {}, narxlar = {}, sozlama = {}, rangTur = {},
  setRulon, canEdit = true, showToast,
}) {
  const [filtr, setFiltr] = useState({ zavod: '', tur: '', qalinlik: '', q: '' });
  const [sort, setSort] = useState({ ustun: 'nomer', yon: 1 });

  const toast = (t) => { if (showToast) showToast(t); };

  // Sotuv ustunlari sarlavhalari — SOZLAMADAN (kodda yozilmagan)
  const nom1 = sozlama.nom1 || '1-narx';
  const nom2 = sozlama.nom2 || '2-narx';

  // ----- Hisoblash (yadro) -----
  const qatorlar = useMemo(
    () => hisobla(rulonlar, { sozlama, narxlar }),
    [rulonlar, sozlama, narxlar],
  );

  // ----- Dropdown ro'yxatlari: standart + mavjud qiymatlar -----
  const zavodlar = useMemo(() => birlashtir(ZAVODLAR, [rulonlar, narxlar], 'zavod'), [rulonlar, narxlar]);
  const turlar = useMemo(() => birlashtir(TURLAR, [rulonlar, narxlar], 'tur'), [rulonlar, narxlar]);
  const ranglar = useMemo(() => birlashtir(RANGLAR, [rulonlar], 'rang'), [rulonlar]);
  const qalinliklar = useMemo(() => qalinlikRoyxat([rulonlar, narxlar]), [rulonlar, narxlar]);

  // ----- Filtr + saralash -----
  const korinadigan = useMemo(() => {
    const qq = past(filtr.q);
    const fz = past(filtr.zavod);
    const ft = past(filtr.tur);
    const res = qatorlar.filter((q) => {
      if (fz && past(q.zavod) !== fz) return false;
      if (ft && past(q.tur) !== ft) return false;
      if (filtr.qalinlik) {
        const qal = son(q.qalinlik);
        if (qal == null || String(qal) !== filtr.qalinlik) return false;
      }
      if (qq && !past(q.rang).includes(qq) && !past(q.izoh).includes(qq)) return false;
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

  // ----- Yozish (optimistik) -----
  //  q — jadval qatori ({...rulon, h}); hisob natijasi `h` saqlanmaydi.
  function yangila(q, patch) {
    if (!canEdit || !setRulon) return;
    const yangi = { ...q, ...patch };
    delete yangi.h;
    setRulon(q.id, yangi);
  }
  // Matn maydonlari
  const matnYoz = (q, kalit) => (xom) => yangila(q, { [kalit]: xom });
  // Raqamli maydonlar: bo'sh bo'lsa '' (kiritilmagan), aks holda son
  const sonYoz = (q, kalit) => (xom) => yangila(q, { [kalit]: xom === '' ? '' : sonQiymat(xom) });
  // Rang o'zgarganda tur BO'SH bo'lsa — rangdan taxmin qilinadi
  const rangYoz = (q) => (rang) => {
    const patch = { rang };
    if (!String(q.tur || '').trim()) {
      const t = turTaxmin(rangTur, rang);
      if (t) patch.tur = t;
    }
    yangila(q, patch);
  };

  function qoshish() {
    if (!canEdit || !setRulon) return;
    let maks = 0;
    for (const q of qatorlar) maks = Math.max(maks, son(q.nomer) || 0);
    const id = genId();
    setRulon(id, {
      id, nomer: maks + 1, rang: '', zavod: '', tur: '', qalinlik: '',
      ogirlik: '', uzunlik: '', qoldiq: '',
      xaridNarx: null, xaridKurs: null, xaridSana: null,
      izoh: '', tasdiqlanmagan: false,
    });
    toast("Yangi rulon qo'shildi");
  }

  function ochirish(q) {
    if (!canEdit || !setRulon) return;
    const nomi = [q.rang, xomKor(q.qalinlik) && `${xomKor(q.qalinlik)} mm`, q.zavod].filter(Boolean).join(' ');
    if (!window.confirm(`№${xomKor(q.nomer)} ${nomi || 'rulon'} o'chirilsinmi?`)) return;
    setRulon(q.id, null);
    toast("O'chirildi");
  }

  function tasdiqla(q) {
    yangila(q, { tasdiqlanmagan: false });
    toast('Tasdiqlandi');
  }

  function saral(ustun) {
    setSort((s) => (s.ustun === ustun ? { ustun, yon: -s.yon } : { ustun, yon: 1 }));
  }

  // ----- Excel eksport: JORIY filtrlangan + saralangan jadval -----
  //  Qalinlik "matn" sifatida chiqadi (0.45 ni butunlashtirib bo'lmaydi),
  //  qolgan raqamlar SON bo'lib boradi (Math.round bilan).
  const XLS_USTUN = useMemo(() => ([
    { nom: '№', kenglik: 5, tur: 'son', ol: (q) => son(q.nomer) },
    { nom: 'Rang', kenglik: 18, tur: 'matn', ol: (q) => q.rang || '' },
    { nom: 'Zavod', kenglik: 20, tur: 'matn', ol: (q) => q.zavod || '' },
    { nom: 'Tur', kenglik: 18, tur: 'matn', ol: (q) => q.tur || '' },
    { nom: 'Qalinlik', kenglik: 9, tur: 'matn', ol: (q) => xomKor(q.qalinlik) },
    { nom: "Og'irlik", kenglik: 10, tur: 'son', ol: (q) => son(q.ogirlik) },
    { nom: 'Uzunlik', kenglik: 10, tur: 'son', ol: (q) => q.h.uzunlik },
    { nom: 'Qoldiq', kenglik: 10, tur: 'son', ol: (q) => q.h.qoldiq },
    { nom: 'Yangi narx $/t', kenglik: 13, tur: 'dollar', ol: (q) => q.h.yangiNarx },
    { nom: 'Rulon $', kenglik: 11, tur: 'dollar', ol: (q) => q.h.rulonDollar },
    { nom: "Rulon so'm", kenglik: 15, tur: 'pul', ol: (q) => q.h.rulonSom },
    { nom: '1 m tannarx', kenglik: 13, tur: 'pul', ol: (q) => q.h.metrTannarx },
    { nom: nom1, kenglik: 13, tur: 'pul', ol: (q) => q.h.sotuv1 },
    { nom: nom2, kenglik: 13, tur: 'pul', ol: (q) => q.h.sotuv2 },
    { nom: 'Izoh', kenglik: 26, tur: 'matn', ol: (q) => q.izoh || '' },
  ]), [nom1, nom2]);

  function eksport() {
    if (!korinadigan.length) { toast('Eksport uchun qator yo\'q'); return; }
    const ustunlar = XLS_USTUN.map((u) => ({ nom: u.nom, kenglik: u.kenglik, tur: u.tur }));
    const qatorlarXls = korinadigan.map((q) => ({
      katak: XLS_USTUN.map((u) => {
        const v = u.ol(q);
        if (u.tur === 'matn') return v == null ? '' : String(v);
        return v == null ? '' : Math.round(Number(v));
      }),
      fon: q.h.daraja || '',
    }));
    // Jami qatori — ustun turlariga mos: matn ustunda matn, son ustunda son
    const jamiKatak = XLS_USTUN.map((u) => {
      if (u.nom === 'Rang') return `Jami: ${jami.soni} ta rulon`;
      if (u.nom === "Og'irlik") return Math.round(jami.ogirlik);
      if (u.nom === 'Uzunlik') return Math.round(jami.uzunlik);
      if (u.nom === 'Qoldiq') return Math.round(jami.qoldiq);
      if (u.nom === "Rulon so'm") return Math.round(jami.qiymat);
      return '';
    });
    downloadXLSX('ombor-rulonlar.xlsx', {
      nom: 'Ombor', ustunlar, qatorlar: qatorlarXls, jami: { katak: jamiKatak },
    });
    toast('Excel yuklandi');
  }

  // ----- Bitta qator uchun umumiy ko'rinishlar -----
  function uzunlikKorinish(h) {
    if (h.uzunlik == null) return <span className="text-slate-300">—</span>;
    return (
      <span title={h.uzunlikHisoblangan ? "og'irlikdan hisoblandi" : ''}>
        {h.uzunlikHisoblangan && <span className="text-slate-400">≈ </span>}
        {olchovKor(h.uzunlik)}
      </span>
    );
  }
  function qoldiqKorinish(q) {
    if (q.h.qoldiq == null) return <span className="text-slate-300">—</span>;
    // Qo'lda kiritilmagan bo'lsa (uzunlikka teng) — och rangda
    return <span className={xomKor(q.qoldiq) ? '' : 'text-slate-400'}>{olchovKor(q.h.qoldiq)}</span>;
  }

  const tonna = jami.ogirlik / 1000;

  return (
    <div className="space-y-4">
      {/* ----- Yuqoridagi umumiy raqamlar ----- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Rulonlar" value={jami.soni} suffix="ta" />
        <StatBox label="Umumiy og'irlik" value={olchovKor(tonna, 2)} suffix="t" />
        <StatBox label="Umumiy qoldiq" value={olchovKor(jami.qoldiq)} suffix="m" />
        <StatBox label="Ombor qiymati" value={Math.round(jami.qiymat)} suffix="so'm" color="emerald" />
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
        <div className="flex items-center justify-between gap-2 mb-3">
          <SectionTitle icon={Layers}>Ombordagi rulonlar ({korinadigan.length})</SectionTitle>
          <div className="flex gap-2 flex-shrink-0 -mt-3">
            <button type="button" onClick={eksport} title="Excelga yuklash"
              className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-700 text-xs font-medium flex items-center gap-1.5 hover:bg-slate-50">
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
            </button>
            {canEdit && (
              <button type="button" onClick={qoshish}
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
            <p className="text-sm">Rulon topilmadi</p>
          </div>
        ) : (
          <>
            {/* ================= JADVAL (md dan katta ekran) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs min-w-[1180px]">
                <thead>
                  <tr className="text-xs text-slate-500 border-b-2 border-slate-200">
                    <Th k="nomer" nom="№" sort={sort} onSort={saral} />
                    <Th k="rang" nom="Rang" sort={sort} onSort={saral} />
                    <Th k="zavod" nom="Zavod" sort={sort} onSort={saral} />
                    <Th k="tur" nom="Tur" sort={sort} onSort={saral} />
                    <Th k="qalinlik" nom="Qalinlik" sort={sort} onSort={saral} hizala="right" />
                    <Th k="ogirlik" nom="Og'irlik" sort={sort} onSort={saral} hizala="right" />
                    <Th k="uzunlik" nom="Uzunlik" sort={sort} onSort={saral} hizala="right" />
                    <Th k="qoldiq" nom="Qoldiq" sort={sort} onSort={saral} hizala="right" />
                    <Th k="yangiNarx" nom="Yangi narx $/t" sort={sort} onSort={saral} hizala="right" />
                    <Th k="rulonDollar" nom="Rulon $" sort={sort} onSort={saral} hizala="right" />
                    <Th k="rulonSom" nom="Rulon so'm" sort={sort} onSort={saral} hizala="right" />
                    <Th k="metrTannarx" nom="1 m tannarx" sort={sort} onSort={saral} hizala="right" />
                    <Th k="sotuv1" nom={nom1} sort={sort} onSort={saral} hizala="right" />
                    <Th k="sotuv2" nom={nom2} sort={sort} onSort={saral} hizala="right" />
                    <Th k="izoh" nom="Izoh" sort={sort} onSort={saral} />
                    <th className="py-2 px-2 font-semibold text-center whitespace-nowrap">Amallar</th>
                  </tr>
                </thead>

                <tbody>
                  {korinadigan.map((q) => {
                    const h = q.h;
                    return (
                      <tr key={q.id} className={`border-b border-slate-100 align-middle ${FON[h.daraja] || ''}`}>
                        {/* № + ogohlantirish belgisi */}
                        <td className="px-2 py-1.5 whitespace-nowrap border-b border-slate-100">
                          <span className="inline-flex items-center gap-1 tabular-nums text-slate-500">
                            <OgohBelgi h={h} />
                            {xomKor(q.nomer) || '—'}
                          </span>
                        </td>

                        {/* Rang (namuna + select) */}
                        <td className="p-0 border-b border-slate-100">
                          <div className="flex items-center gap-1.5 pl-2">
                            <RangNamuna rang={q.rang} />
                            <div className="flex-1 min-w-0">
                              <TahrirKatak value={q.rang} onSave={rangYoz(q)} canEdit={canEdit}
                                tur="select" variantlar={ranglar} />
                            </div>
                          </div>
                        </td>

                        <td className="p-0 border-b border-slate-100">
                          <TahrirKatak value={q.zavod} onSave={matnYoz(q, 'zavod')} canEdit={canEdit}
                            tur="select" variantlar={zavodlar} />
                        </td>
                        <td className="p-0 border-b border-slate-100">
                          <TahrirKatak value={q.tur} onSave={matnYoz(q, 'tur')} canEdit={canEdit}
                            tur="select" variantlar={turlar} />
                        </td>
                        <td className="p-0 border-b border-slate-100">
                          <TahrirKatak value={q.qalinlik} onSave={sonYoz(q, 'qalinlik')} canEdit={canEdit}
                            tur="son" hizala="right" />
                        </td>
                        <td className="p-0 border-b border-slate-100">
                          <TahrirKatak value={q.ogirlik} onSave={sonYoz(q, 'ogirlik')} canEdit={canEdit}
                            tur="son" hizala="right" />
                        </td>
                        <td className="p-0 border-b border-slate-100">
                          <TahrirKatak value={q.uzunlik} onSave={sonYoz(q, 'uzunlik')} canEdit={canEdit}
                            tur="son" hizala="right" korinish={uzunlikKorinish(h)}
                            title={h.uzunlikHisoblangan ? "og'irlikdan hisoblandi" : ''} />
                        </td>
                        <td className="p-0 border-b border-slate-100">
                          <TahrirKatak value={q.qoldiq} onSave={sonYoz(q, 'qoldiq')} canEdit={canEdit}
                            tur="son" hizala="right" korinish={qoldiqKorinish(q)} />
                        </td>

                        {/* Hisoblangan ustunlar — tahrirlanmaydi */}
                        <HisobKatak qiymat={h.yangiNarx} narx />
                        <HisobKatak qiymat={h.rulonDollar} narx />
                        <HisobKatak qiymat={h.rulonSom} narx />
                        <HisobKatak qiymat={h.metrTannarx} narx />
                        <HisobKatak qiymat={h.sotuv1} narx />
                        <HisobKatak qiymat={h.sotuv2} narx />

                        <td className="p-0 border-b border-slate-100 max-w-[220px]">
                          <TahrirKatak value={q.izoh} onSave={matnYoz(q, 'izoh')} canEdit={canEdit} />
                        </td>

                        <td className="px-2 py-1.5 text-center whitespace-nowrap border-b border-slate-100">
                          {canEdit ? (
                            <span className="inline-flex gap-1">
                              {q.tasdiqlanmagan && (
                                <button type="button" onClick={() => tasdiqla(q)} title="Tasdiqlash"
                                  className="p-1 rounded border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button type="button" onClick={() => ochirish(q)} title="O'chirish"
                                className="p-1 rounded border border-red-200 text-red-600 bg-white hover:bg-red-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* ----- JAMI qatori ----- */}
                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-800 border-t-2 border-slate-300">
                    <td className="px-2 py-2 whitespace-nowrap" colSpan={5}>
                      Jami — <span className="tabular-nums">{jami.soni}</span> ta rulon
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums" title="Umumiy og'irlik (tonna)">
                      {olchovKor(tonna, 2)} t
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums" title="Rulonlarning umumiy uzunligi">
                      {olchovKor(jami.uzunlik)} m
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums" title="Ombordagi umumiy qoldiq">
                      {olchovKor(jami.qoldiq)} m
                    </td>
                    <td className="px-2 py-2" colSpan={2} />
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap" title="Ombordagi mahsulotning umumiy qiymati">
                      {fmt(jami.qiymat)} so'm
                    </td>
                    <td className="px-2 py-2" colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ================= KARTOCHKALAR (mobil) ================= */}
            <div className="md:hidden space-y-2">
              {korinadigan.map((q) => (
                <RulonKarta key={q.id} q={q} canEdit={canEdit}
                  zavodlar={zavodlar} turlar={turlar} ranglar={ranglar}
                  nom1={nom1} nom2={nom2}
                  matnYoz={matnYoz} sonYoz={sonYoz} rangYoz={rangYoz}
                  onOchir={ochirish} onTasdiq={tasdiqla} />
              ))}

              <div className="rounded-xl bg-slate-100 border border-slate-300 p-3 text-xs text-slate-800">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Rulonlar</span>
                  <b className="tabular-nums">{jami.soni} ta</b>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Umumiy og'irlik</span>
                  <b className="tabular-nums">{olchovKor(tonna, 2)} t</b>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Umumiy qoldiq</span>
                  <b className="tabular-nums">{olchovKor(jami.qoldiq)} m</b>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Ombordagi mahsulot qiymati</span>
                  <b className="tabular-nums">{fmt(jami.qiymat)} so'm</b>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
