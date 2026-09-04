// ============================================================
//  OMBOR → RULONLAR
// ------------------------------------------------------------
//  Ombordagi rulonlarning ASOSIY jadvali — foydalanuvchining
//  daftaridagi ustunlar tartibida. Barcha hisob-kitob
//  src/lib/omborHisob.js dagi sof funksiyalarda; bu faylda
//  birorta narx / kurs / koeffitsient QATTIQ YOZILMAGAN.
//
//  KIRITILADI (oq katak):
//    sana, kimdan (zavod), tur, rang, qalinlik, og'irlik (kg),
//    narx ($/t), kurs, uzunlik (m), yo'lkira ($/t), qoldiq, izoh
//  HISOBLANADI (kulrang katak):
//    rulon $, rulon so'm, yo'lkira $, 1 m tannarx, sotuv 1, sotuv 2
//
//  Tahrirlash INLINE: katakka bosilganda o'sha yerda tahrirlanadi,
//  blur yoki Enter da darhol setRulon orqali yoziladi (optimistik),
//  Escape — bekor qiladi.
//
//  Ma'lumot:
//    rulonlar — { [id]: Rulon } obyekt-xarita
//    setRulon(id, rulon)  — bitta rulonni yozadi (null = o'chiradi)
// ============================================================
import React, { useState, useMemo, useRef } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, AlertCircle,
  Search, X, FileSpreadsheet, Layers, Check,
} from 'lucide-react';
import { Card, SectionTitle, StatBox, rangChipStyle } from '../../components/ui.jsx';
import { fmt, genId, sonMatn, sonQiymat, toDateInput } from '../../lib/helpers.js';
import { hisobla, jamiHisob, turTaxmin, son, norm, OGOH } from '../../lib/omborHisob.js';
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

// Xom (saqlangan) qiymatni katakda ko'rsatish uchun matn
const xomKor = (v) => (v == null || v === '' ? '' : String(v));

// 'YYYY-MM-DD' → 'DD.MM.YY' (jadvalda qisqa ko'rinsin); boshqa matn — o'zi
function sanaKor(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : xomKor(s);
}

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
  [OGOH.NARX_YOQ]: 'Narx yoki kurs kiritilmagan',
  [OGOH.UZUNLIK_YOQ]: 'Uzunlik kiritilmagan',
  [OGOH.QALINLIK]: 'Qalinlik / uzunlik mos emas',
  [OGOH.TASDIQSIZ]: 'Tasdiqlanmagan',
};
const DARAJA_OGIRLIK = { qizil: 0, toq: 1, sariq: 2 };

// Saralashda hisob natijasidan (h) olinadigan ustunlar. narxTonna / kurs /
// yolkiraTonna ham shu yerda: h da eski maydon nomlari va standart qiymat
// hisobga olingan "haqiqiy" qiymat turadi.
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

// ============================================================
//  TAHRIR KATAK — joyida (inline) tahrirlanadigan katak
// ------------------------------------------------------------
//  value    — saqlangan XOM qiymat (matn yoki son)
//  onSave   — (xomMatn) => void; blur yoki Enter da chaqiriladi
//  tur      — 'matn' | 'son' | 'select' | 'sana'
//  korinish — tahrir qilinmayotgan paytdagi maxsus ko'rinish (ixtiyoriy)
// ============================================================
function TahrirKatak({
  value, onSave, canEdit = true, tur = 'matn', variantlar = [],
  hizala = 'left', korinish = null, title = '', klass = '', placeholder = '',
}) {
  const [tahrir, setTahrir] = useState(false);
  const [xom, setXom] = useState('');
  // Escape bosilganda blur ham ishga tushadi — shu bayroq saqlashni to'xtatadi
  const bekorRef = useRef(false);
  // Tahrir BOSHLANGANIDAGI qiymat: saqlash kerakmi-yo'qmi shu bilan solishtiriladi
  // (joriy `value` bilan emas — u tahrir paytida boshqa qurilmadan kelgan
  // yangilanish tufayli o'zgargan bo'lishi mumkin).
  const boshRef = useRef('');

  const matn = xomKor(value);
  const hiz = hizala === 'right' ? 'text-right' : hizala === 'center' ? 'text-center' : 'text-left';

  function boshla() {
    if (!canEdit || tahrir) return;
    bekorRef.current = false;
    boshRef.current = matn;
    setXom(matn);
    setTahrir(true);
  }

  // Tahrirni yakunlash: bekor qilinmagan va foydalanuvchi HAQIQATAN o'zgartirgan
  // bo'lsa — yozamiz. Tegilmagan katak hech narsa yozmaydi: aks holda tahrir
  // paytida boshqa qurilmada qilingan o'zgarish jimgina bosib yozilardi.
  function yakunla() {
    setTahrir(false);
    if (bekorRef.current) { bekorRef.current = false; return; }
    if (xom !== boshRef.current) onSave(xom);
  }

  function klav(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); bekorRef.current = true; e.currentTarget.blur(); }
  }

  // ----- Ro'yxatli (select) katak — DOIM ochiq (bir bosishda ro'yxat chiqadi) -----
  if (tur === 'select' && canEdit) {
    // Saqlangan qiymat ro'yxatdagi variantdan faqat registr/bo'shliq bilan farq
    // qilishi mumkin ("smz" ↔ "SMZ"); <select> AYNAN mos kelishni talab qiladi.
    const mos = matn ? variantlar.find((v) => norm(v) === norm(matn)) : '';
    const qiymat = mos || matn;
    return (
      <select
        value={qiymat} title={title}
        onChange={(e) => { if (e.target.value !== qiymat) onSave(e.target.value); }}
        className={klass
          ? `w-full px-2 py-1.5 rounded cursor-pointer ${klass}`
          : 'w-full px-2 py-1.5 rounded appearance-none bg-transparent border border-transparent'
            + ' cursor-pointer hover:bg-slate-100 focus:bg-white focus:border-slate-300'}
      >
        <option value="">—</option>
        {!mos && matn ? <option value={matn}>{matn}</option> : null}
        {variantlar.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }

  // ----- Sana — brauzerning o'z sana tanlagichi -----
  if (tur === 'sana' && canEdit) {
    return (
      <input
        type="date" value={matn} title={title}
        onChange={(e) => { if (e.target.value !== matn) onSave(e.target.value); }}
        className={klass
          ? `w-full px-2 py-1.5 rounded ${klass}`
          : 'w-full px-2 py-1.5 rounded bg-transparent border border-transparent tabular-nums'
            + ' hover:bg-slate-100 focus:bg-white focus:border-slate-300'}
      />
    );
  }

  if (tahrir) {
    return (
      <input
        autoFocus
        inputMode={tur === 'son' ? 'decimal' : undefined}
        value={xom} placeholder={placeholder}
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
      {korinish != null ? korinish : (matn || <span className="text-slate-300">{placeholder || '—'}</span>)}
    </div>
  );
}

// ----- Hisoblangan (tahrirlanmaydigan) katak -----
//  pul=true bo'lsa qiymat yo'qligi "—" o'rniga kulrang chiziqcha bilan chiqadi,
//  qalin=true — 1 m tannarx kabi asosiy natija.
function HisobKatak({ qiymat, matn = null, qalin = false, title = '' }) {
  return (
    <td className={`px-2 py-1.5 text-right tabular-nums bg-slate-50 cursor-default ${qalin ? 'font-semibold text-slate-900' : 'text-slate-700'}`} title={title}>
      {qiymat == null
        ? <span className="text-slate-300">—</span>
        : (matn != null ? matn : fmt(qiymat))}
    </td>
  );
}

// ----- Jadval sarlavhasi (saralash tugmasi bilan) -----
//  hisob=true — hisoblanadigan ustun (kulrang fon bilan ajratiladi)
function Th({ k, nom, sort, onSort, hizala = 'left', hisob = false, title = '' }) {
  const faol = sort.ustun === k;
  const hiz = hizala === 'right' ? 'text-right' : hizala === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`py-2 px-2 font-semibold whitespace-nowrap ${hiz} ${hisob ? 'bg-slate-100/70' : ''}`} title={title}>
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
  // title SVG ustida ishlamaydi — shuning uchun o'rovchi span da beriladi
  return (
    <span title={matn} className="inline-flex flex-shrink-0">
      <Ikon className={`w-3.5 h-3.5 ${rang}`} />
    </span>
  );
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
//  MOBIL KARTOCHKA (768px dan kichik ekranda)
// ============================================================
function RulonKarta({
  q, canEdit, zavodlar, turlar, ranglar, nom1, nom2, yolkiraStd,
  matnYoz, sonYoz, rangYoz, onOchir, onTasdiq,
}) {
  const h = q.h;
  const fon = FON[h.daraja] || 'bg-white';
  const maydon = 'border border-slate-200 rounded bg-white';

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
  const yolkiraKor = (
    <span className={`tabular-nums ${h.yolkiraStandart ? 'text-slate-400' : ''}`}
      title={h.yolkiraStandart ? 'Sozlamadagi standart' : ''}>
      {olchovKor(h.yolkiraTonna, 2)}{h.yolkiraStandart ? ' (std)' : ''}
    </span>
  );

  const narxQuti = (nom, qiymat, qalin = false) => (
    <div className="bg-slate-50 rounded-lg py-1.5 px-1 text-center">
      <div className="text-[10px] text-slate-500 truncate">{nom}</div>
      <div className={`text-sm tabular-nums ${qalin ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
        {qiymat == null ? <span className="text-slate-300">—</span> : fmt(qiymat)}
      </div>
    </div>
  );
  const maydonQuti = (nom, el) => (
    <div>
      <div className="text-[10px] text-slate-500 mb-0.5">{nom}</div>
      {el}
    </div>
  );

  return (
    <div className={`rounded-xl border border-slate-200 p-3 ${fon}`}>
      {/* Sarlavha: rang · qalinlik · kimdan · tur */}
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
            {q.zavod || "kimdan — yo'q"} · {q.tur || "tur yo'q"}
            {q.sana ? ` · ${sanaKor(q.sana)}` : ''}
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

      {/* Asosiy natija */}
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        {narxQuti('1 m tannarx', h.metrTannarx, true)}
        {narxQuti(nom1, h.sotuv1)}
        {narxQuti(nom2, h.sotuv2)}
      </div>

      {/* Kiritiladigan maydonlar */}
      <div className="grid grid-cols-2 gap-1.5 mt-2 text-xs">
        {maydonQuti('Sana', <TahrirKatak value={q.sana} onSave={matnYoz(q, 'sana')} canEdit={canEdit} tur="sana" klass={maydon} />)}
        {maydonQuti('Kimdan (zavod)', <TahrirKatak value={q.zavod} onSave={matnYoz(q, 'zavod')} canEdit={canEdit} tur="select" variantlar={zavodlar} klass={maydon} />)}
        {maydonQuti('Tur', <TahrirKatak value={q.tur} onSave={matnYoz(q, 'tur')} canEdit={canEdit} tur="select" variantlar={turlar} klass={maydon} />)}
        {maydonQuti('Rang', <TahrirKatak value={q.rang} onSave={rangYoz(q)} canEdit={canEdit} tur="select" variantlar={ranglar} klass={maydon} />)}
        {maydonQuti('Qalinlik (mm)', <TahrirKatak value={q.qalinlik} onSave={sonYoz(q, 'qalinlik')} canEdit={canEdit} tur="son" hizala="right" klass={maydon} />)}
        {maydonQuti("Og'irlik (kg)", <TahrirKatak value={q.ogirlik} onSave={sonYoz(q, 'ogirlik')} canEdit={canEdit} tur="son" hizala="right" klass={maydon} />)}
        {maydonQuti('Narx ($/t)', <TahrirKatak value={q.narxTonna ?? q.xaridNarx} onSave={sonYoz(q, 'narxTonna')} canEdit={canEdit} tur="son" hizala="right" klass={maydon} />)}
        {maydonQuti("Kurs (so'm/$)", <TahrirKatak value={q.kurs ?? q.xaridKurs} onSave={sonYoz(q, 'kurs')} canEdit={canEdit} tur="son" hizala="right" klass={maydon} />)}
        {maydonQuti('Uzunlik (m)', <TahrirKatak value={q.uzunlik} onSave={sonYoz(q, 'uzunlik')} canEdit={canEdit} tur="son" hizala="right" korinish={uzunlikKor} klass={maydon} />)}
        {maydonQuti(`Yo'lkira ($/t, std ${olchovKor(yolkiraStd, 2)})`, <TahrirKatak value={q.yolkiraTonna} onSave={sonYoz(q, 'yolkiraTonna')} canEdit={canEdit} tur="son" hizala="right" korinish={yolkiraKor} klass={maydon} />)}
        {maydonQuti('Qoldiq (m)', <TahrirKatak value={q.qoldiq} onSave={sonYoz(q, 'qoldiq')} canEdit={canEdit} tur="son" hizala="right" korinish={qoldiqKor} klass={maydon} />)}
        {maydonQuti('Izoh', <TahrirKatak value={q.izoh} onSave={matnYoz(q, 'izoh')} canEdit={canEdit} klass={maydon} />)}
      </div>

      {/* Hisoblangan pul qatorlari */}
      <div className="mt-2 text-[11px] text-slate-600 tabular-nums space-y-0.5">
        <div className="flex justify-between"><span>Rulon</span><span>{h.rulonDollar == null ? '—' : `${fmt(h.rulonDollar)} $ · ${fmt(h.rulonSom)} so'm`}</span></div>
        <div className="flex justify-between"><span>Yo'lkira</span><span>{h.yolkiraDollar == null ? '—' : `${fmt(h.yolkiraDollar)} $ · ${fmt(h.yolkiraSom)} so'm`}</span></div>
        <div className="flex justify-between font-semibold text-slate-800"><span>Jami</span><span>{h.jamiSom == null ? '—' : `${fmt(h.jamiSom)} so'm`}</span></div>
      </div>

      {canEdit && (
        <div className="flex justify-end gap-1.5 mt-2">
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

  const toast = (t) => { if (showToast) showToast(t); };

  // Sotuv ustunlari sarlavhalari va standart yo'lkira — SOZLAMADAN
  const nom1 = sozlama.nom1 || '1-narx';
  const nom2 = sozlama.nom2 || '2-narx';
  const yolkiraStd = son(sozlama.yolkiraTonna) ?? 0;

  // ----- Hisoblash (yadro) -----
  const qatorlar = useMemo(() => hisobla(rulonlar, { sozlama }), [rulonlar, sozlama]);

  // ----- Dropdown ro'yxatlari: sozlama + mavjud qiymatlar -----
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

  // ----- Yozish (optimistik) -----
  //  q — jadval qatori ({...rulon, h}); hisob natijasi `h` saqlanmaydi.
  function yangila(q, patch) {
    if (!canEdit || !setRulon) return;
    const yangi = { ...q, ...patch };
    delete yangi.h;
    setRulon(q.id, yangi);
  }
  const matnYoz = (q, kalit) => (xom) => yangila(q, { [kalit]: xom });
  // Raqamli maydonlar: bo'sh bo'lsa '' (kiritilmagan), aks holda son
  const sonYoz = (q, kalit) => (xom) => yangila(q, { [kalit]: xom === '' ? '' : sonQiymat(xom) });
  // Rang o'zgarganda tur BO'SH bo'lsa — rangdan taxmin qilinadi (faqat rang haqiqatan tanlanganda)
  const rangYoz = (q) => (rang) => {
    const patch = { rang };
    if (String(rang || '').trim() && !String(q.tur || '').trim()) {
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
      id, nomer: maks + 1,
      sana: toDateInput(),                 // bugun — keyin o'zgartirsa bo'ladi
      zavod: '', tur: '', rang: '', qalinlik: '',
      ogirlik: '', narxTonna: '',
      kurs: son(sozlama.kurs) ?? '',       // sozlamadagi kurs TAKLIF sifatida to'ldiriladi
      uzunlik: '', yolkiraTonna: '',       // bo'sh = sozlamadagi standart yo'lkira
      qoldiq: '', izoh: '', tasdiqlanmagan: false,
    });
    // Yangi rulon bo'sh: filtr yoqilgan bo'lsa ro'yxatga tushmasdi — tozalaymiz
    const filtrBor = Boolean(filtr.zavod || filtr.tur || filtr.qalinlik || filtr.q);
    if (filtrBor) setFiltr(FILTR_BOSH);
    toast(filtrBor ? "Yangi rulon qo'shildi — filtr tozalandi" : "Yangi rulon qo'shildi");
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

  // ----- Excel eksport: JORIY filtrlangan + saralangan jadval, daftar tartibida -----
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

  // ----- Bitta qator uchun umumiy ko'rinishlar -----
  function uzunlikKorinish(h) {
    if (h.uzunlik == null) return <span className="text-slate-300">—</span>;
    return (
      <span title={h.uzunlikHisoblangan ? "og'irlikdan hisoblandi (rulon qog'ozidagi uzunlikni yozing)" : ''}>
        {h.uzunlikHisoblangan && <span className="text-slate-400">≈ </span>}
        {olchovKor(h.uzunlik)}
      </span>
    );
  }
  function qoldiqKorinish(q) {
    if (q.h.qoldiq == null) return <span className="text-slate-300">—</span>;
    return <span className={xomKor(q.qoldiq) ? '' : 'text-slate-400'}>{olchovKor(q.h.qoldiq)}</span>;
  }
  // Yo'lkira $/t: rulonda yozilmagan bo'lsa sozlamadagi standart och rangda
  function yolkiraKorinish(h) {
    return (
      <span className={h.yolkiraStandart ? 'text-slate-400' : ''}
        title={h.yolkiraStandart ? "Sozlamadagi standart — o'zgartirish uchun bosing" : ''}>
        {olchovKor(h.yolkiraTonna, 2)}
      </span>
    );
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
            {qatorlar.length === 0 ? (
              <>
                <p className="text-sm text-slate-500">Omborda hali rulon yo'q</p>
                <p className="text-xs mt-1">
                  {canEdit
                    ? "Yuqoridagi «Rulon qo'shish» tugmasi bilan boshlang."
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
            {/* Oq katak — kiritiladi, kulrang — hisoblanadi */}
            <p className="text-[11px] text-slate-400 mb-1.5">
              Oq kataklarni bosib to'ldirasiz; <span className="bg-slate-100 px-1 rounded">kulrang</span> ustunlar o'zi hisoblanadi.
              Uzunlik — rulon ichidagi qog'ozdan; yozilmasa og'irlikdan taxminan (≈) chiqadi.
            </p>

            {/* ================= JADVAL (md dan katta ekran) ================= */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs min-w-[1720px]">
                <thead>
                  <tr className="text-xs text-slate-500 border-b-2 border-slate-200">
                    <Th k="nomer" nom="№" sort={sort} onSort={saral} />
                    <Th k="sana" nom="Sana" sort={sort} onSort={saral} />
                    <Th k="zavod" nom="Kimdan" sort={sort} onSort={saral} title="Zavod yoki yetkazib beruvchi" />
                    <Th k="tur" nom="Tur" sort={sort} onSort={saral} />
                    <Th k="rang" nom="Rang" sort={sort} onSort={saral} />
                    <Th k="qalinlik" nom="Qal." sort={sort} onSort={saral} hizala="right" title="Qalinlik, mm" />
                    <Th k="ogirlik" nom="Og'irlik" sort={sort} onSort={saral} hizala="right" title="kg" />
                    <Th k="narxTonna" nom="Narx $/t" sort={sort} onSort={saral} hizala="right" />
                    <Th k="rulonDollar" nom="Rulon $" sort={sort} onSort={saral} hizala="right" hisob title="Og'irlik (t) × narx" />
                    <Th k="kurs" nom="Kurs" sort={sort} onSort={saral} hizala="right" title="Olingan kungi kurs" />
                    <Th k="rulonSom" nom="Rulon so'm" sort={sort} onSort={saral} hizala="right" hisob title="Rulon $ × kurs" />
                    <Th k="uzunlik" nom="Uzunlik" sort={sort} onSort={saral} hizala="right" title="m — rulon qog'ozidan" />
                    <Th k="yolkiraTonna" nom="Yo'lkira $/t" sort={sort} onSort={saral} hizala="right" />
                    <Th k="yolkiraDollar" nom="Yo'lkira $" sort={sort} onSort={saral} hizala="right" hisob title="Og'irlik (t) × yo'lkira" />
                    <Th k="metrTannarx" nom="1 m tannarx" sort={sort} onSort={saral} hizala="right" hisob title="(rulon + yo'lkira) so'm ÷ uzunlik" />
                    <Th k="sotuv1" nom={nom1} sort={sort} onSort={saral} hizala="right" hisob />
                    <Th k="sotuv2" nom={nom2} sort={sort} onSort={saral} hizala="right" hisob />
                    <Th k="qoldiq" nom="Qoldiq" sort={sort} onSort={saral} hizala="right" title="Omborda qolgan metr" />
                    <Th k="izoh" nom="Izoh" sort={sort} onSort={saral} />
                    <th className="py-2 px-2 font-semibold text-center whitespace-nowrap">Amallar</th>
                  </tr>
                </thead>

                <tbody>
                  {korinadigan.map((q) => {
                    const h = q.h;
                    return (
                      <tr key={q.id} className={`border-b border-slate-100 align-middle ${FON[h.daraja] || ''}`}>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 tabular-nums text-slate-500">
                            <OgohBelgi h={h} />
                            {xomKor(q.nomer) || '—'}
                          </span>
                        </td>
                        <td className="p-0 min-w-[120px]">
                          <TahrirKatak value={q.sana} onSave={matnYoz(q, 'sana')} canEdit={canEdit} tur="sana"
                            korinish={<span className="tabular-nums">{sanaKor(q.sana) || <span className="text-slate-300">—</span>}</span>} />
                        </td>
                        <td className="p-0 min-w-[110px]">
                          <TahrirKatak value={q.zavod} onSave={matnYoz(q, 'zavod')} canEdit={canEdit}
                            tur="select" variantlar={zavodlar} />
                        </td>
                        <td className="p-0 min-w-[100px]">
                          <TahrirKatak value={q.tur} onSave={matnYoz(q, 'tur')} canEdit={canEdit}
                            tur="select" variantlar={turlar} />
                        </td>
                        <td className="p-0 min-w-[110px]">
                          <div className="flex items-center gap-1.5 pl-2">
                            <RangNamuna rang={q.rang} />
                            <div className="flex-1 min-w-0">
                              <TahrirKatak value={q.rang} onSave={rangYoz(q)} canEdit={canEdit}
                                tur="select" variantlar={ranglar} />
                            </div>
                          </div>
                        </td>
                        <td className="p-0 w-16">
                          <TahrirKatak value={q.qalinlik} onSave={sonYoz(q, 'qalinlik')} canEdit={canEdit} tur="son" hizala="right" placeholder="0,40" />
                        </td>
                        <td className="p-0 w-20">
                          <TahrirKatak value={q.ogirlik} onSave={sonYoz(q, 'ogirlik')} canEdit={canEdit} tur="son" hizala="right" placeholder="kg" />
                        </td>
                        <td className="p-0 w-20">
                          <TahrirKatak value={q.narxTonna ?? q.xaridNarx} onSave={sonYoz(q, 'narxTonna')} canEdit={canEdit} tur="son" hizala="right" placeholder="$/t" />
                        </td>
                        <HisobKatak qiymat={h.rulonDollar} />
                        <td className="p-0 w-20">
                          <TahrirKatak value={q.kurs ?? q.xaridKurs} onSave={sonYoz(q, 'kurs')} canEdit={canEdit} tur="son" hizala="right" placeholder="kurs" />
                        </td>
                        <HisobKatak qiymat={h.rulonSom} />
                        <td className="p-0 w-20">
                          <TahrirKatak value={q.uzunlik} onSave={sonYoz(q, 'uzunlik')} canEdit={canEdit}
                            tur="son" hizala="right" korinish={uzunlikKorinish(h)} placeholder="m" />
                        </td>
                        <td className="p-0 w-20">
                          <TahrirKatak value={q.yolkiraTonna} onSave={sonYoz(q, 'yolkiraTonna')} canEdit={canEdit}
                            tur="son" hizala="right" korinish={yolkiraKorinish(h)} placeholder={olchovKor(yolkiraStd, 2)} />
                        </td>
                        <HisobKatak qiymat={h.yolkiraDollar} />
                        <HisobKatak qiymat={h.metrTannarx} qalin />
                        <HisobKatak qiymat={h.sotuv1} />
                        <HisobKatak qiymat={h.sotuv2} />
                        <td className="p-0 w-20">
                          <TahrirKatak value={q.qoldiq} onSave={sonYoz(q, 'qoldiq')} canEdit={canEdit}
                            tur="son" hizala="right" korinish={qoldiqKorinish(q)} />
                        </td>
                        <td className="p-0 max-w-[200px]">
                          <TahrirKatak value={q.izoh} onSave={matnYoz(q, 'izoh')} canEdit={canEdit} />
                        </td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
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

                {/* ----- JAMI qatori — ustunlar ostida aynan o'sha ustun yig'indisi ----- */}
                <tfoot>
                  <tr className="bg-slate-100 font-semibold text-slate-800 border-t-2 border-slate-300 tabular-nums">
                    <td className="px-2 py-2 whitespace-nowrap" colSpan={6}>
                      Jami — {jami.soni} ta rulon
                    </td>
                    <td className="px-2 py-2 text-right" title="Umumiy og'irlik (tonna)">{olchovKor(tonna, 2)} t</td>
                    <td />
                    <td className="px-2 py-2 text-right" title="Rulonlar $ yig'indisi (yo'lkirasiz)">{fmt(jami.rulonDollar)}</td>
                    <td />
                    <td className="px-2 py-2 text-right" title="Rulon so'm yig'indisi (yo'lkirasiz)">{fmt(jami.rulonSom)}</td>
                    <td className="px-2 py-2 text-right" title="Umumiy uzunlik">{olchovKor(jami.uzunlik)} m</td>
                    <td />
                    <td className="px-2 py-2 text-right" title={`Yo'lkira $ yig'indisi (so'mda: ${fmt(jami.yolkiraSom)})`}>{fmt(jami.yolkiraDollar)}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap" colSpan={3} title={`Barcha rulonlarga to'langan jami, yo'lkira bilan (${fmt(jami.jamiDollar)} $)`}>
                      Jami: {fmt(jami.jamiSom)} so'm
                    </td>
                    <td className="px-2 py-2 text-right" title="Ombordagi umumiy qoldiq">{olchovKor(jami.qoldiq)} m</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap" colSpan={2} title="Qoldiq × 1 m tannarx">
                      Qoldiq qiymati: {fmt(jami.qiymat)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ================= KARTOCHKALAR (mobil) ================= */}
            <div className="md:hidden space-y-2">
              {korinadigan.map((q) => (
                <RulonKarta key={q.id} q={q} canEdit={canEdit}
                  zavodlar={zavodlar} turlar={turlar} ranglar={ranglar}
                  nom1={nom1} nom2={nom2} yolkiraStd={yolkiraStd}
                  matnYoz={matnYoz} sonYoz={sonYoz} rangYoz={rangYoz}
                  onOchir={ochirish} onTasdiq={tasdiqla} />
              ))}

              <div className="rounded-xl bg-slate-100 border border-slate-300 p-3 text-xs text-slate-800 tabular-nums">
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
    </div>
  );
}
