// ============================================================
//  OMBOR → SOZLAMA (3.2-bo'lim)
// ------------------------------------------------------------
//  Rulonlar hisobiga kiradigan BARCHA kirish qiymatlari shu
//  panelda tahrirlanadi: kurs, ustama, sotuv bo'luvchilari,
//  qalinlik → kg/m jadvali, koeffitsientlar va rang → tur
//  qoidalari. Bu faylda birorta narx / kurs / koeffitsient
//  QATTIQ YOZILMAGAN — hammasi proplardan keladi va yana
//  proplar orqali (updateSozlama / updateRangTur) yoziladi.
//
//  Forma LOKAL state da turadi: "Saqlash" bosilmaguncha
//  Firestore'ga hech narsa yozilmaydi. Tashqaridan (boshqa
//  qurilmadan) ma'lumot o'zgarsa — forma qayta yuklanadi, LEKIN
//  faqat lokal tahrir bo'lmasa. Tahrir bor bo'lsa forma tegilmaydi
//  va sariq ogoh + "Yangilash" tugmasi ko'rsatiladi.
//
//  Panel tagida BOSHLANG'ICH MA'LUMOT (seed) bloki: seed
//  to'plamini Firestore'ga yozadi. DIQQAT: narx/rulon ro'yxatlari
//  merge bilan (id lar ustiga), sozlama va rang→tur hujjatlari esa
//  TO'LIQ almashtiriladi — bu foydalanuvchiga ochiq aytiladi.
// ============================================================
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Settings, ChevronDown, ChevronUp, Plus, Trash2, Save, RotateCcw,
  Database, Loader2, AlertTriangle, Check, List,
} from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { fmt, genId, sonMatn } from '../../lib/helpers.js';
import { turTaxmin, son, norm } from '../../lib/omborHisob.js';
import { sozlamaRoyxat } from '../../lib/omborSeed.js';

// ----- Kichik yordamchilar -----

// Bugungi kun 'YYYY-MM-DD' (kurs sanasi uchun)
const bugun = () => new Date().toISOString().slice(0, 10);

// Saqlangan qiymatni maydon matniga aylantirish
const xom = (v) => (v == null || v === '' ? '' : String(v));

// O'lchov (kg/m, koef) — pul emas, shuning uchun fmt emas
function olchovKor(n, kasr = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const k = 10 ** kasr;
  return String(Math.round(v * k) / k);
}

// Qalinlik kaliti: "0,40" → "0.4" (jadval kaliti MATN bo'lib saqlanadi)
function qalKalit(x) {
  const n = son(x);
  return n != null && n > 0 ? String(n) : '';
}

// kg/m jadvali (obyekt) → tahrirlanadigan qatorlar massivi
function kgQatorlar(jadval) {
  const obj = (jadval && typeof jadval === 'object') ? jadval : {};
  return Object.keys(obj)
    .map((k) => ({ id: genId(), q: k, v: xom(obj[k]) }))
    .sort((a, b) => (son(a.q) ?? 0) - (son(b.q) ?? 0));
}

// Qatorlar → kg/m jadvali (bo'sh va yaroqsiz qatorlar tushib qoladi)
// ----- Tanlov ro'yxatlari (zavod / tur / rang) -----
//  Tahrirlash paytida matn o'zgargani uchun har qatorga barqaror id kerak
//  (indeks key ishlatilsa, qator o'chirilganda inputlar aralashib ketadi).
function royxatQatorlar(arr) {
  // `asl` — bazada saqlangan nom. Saqlashda `v` bilan solishtirib, nom
  // o'zgarganini (va uni yozuvlarda ham almashtirish kerakligini) bilamiz.
  return (arr || []).map((v) => {
    const t = String(v == null ? '' : v);
    return { id: genId(), v: t, asl: t };
  });
}
//  Saqlashda: bo'sh qatorlar tashlanadi, takrorlar (registr farqisiz) olib
//  tashlanadi, tartib esa foydalanuvchi qo'ygan holicha qoladi.
function royxatMassiv(qatorlar) {
  const out = [];
  const korilgan = new Set();
  for (const r of (qatorlar || [])) {
    const v = String(r.v == null ? '' : r.v).trim();
    if (!v) continue;
    const k = norm(v);
    if (korilgan.has(k)) continue;
    korilgan.add(k);
    out.push(v);
  }
  return out;
}

function kgObyekt(qatorlar) {
  const out = {};
  for (const r of qatorlar) {
    const k = qalKalit(r.q);
    const v = son(r.v);
    if (!k || v == null || !(v > 0)) continue;
    out[k] = v;
  }
  return out;
}

// Qator butunlay bo'shmi? (ikkala katak ham yozilmagan — jim tashlab yuboriladi)
const bosQator = (r) => String(r.q || '').trim() === '' && String(r.v || '').trim() === '';

// Yarim to'ldirilgan / nol qatorlarning id lari.
//  kgObyekt() bunday qatorlarni JIMGINA tashlab yuboradi — foydalanuvchi esa
//  "saqlandi" xabarini ko'rib, qator jadvalga tushdi deb o'ylaydi. Shuning
//  uchun saqlashdan OLDIN ogohlantiramiz (dublikat kabi).
function notoliqlar(qatorlar) {
  const out = new Set();
  for (const r of qatorlar) {
    if (bosQator(r)) continue;              // bo'm-bo'sh qator — xato emas
    const v = son(r.v);
    if (!qalKalit(r.q) || v == null || !(v > 0)) out.add(r.id);
  }
  return out;
}

// Qatordagi qaysi katak yaroqsiz (qizil chegara aynan shu katakka qo'yiladi)
const qalXato = (r) => !qalKalit(r.q);
const kgXato = (r) => { const v = son(r.v); return v == null || !(v > 0); };

// Bir xil qalinlik ikki marta kiritilgan qatorlarning id lari
function dublikatlar(qatorlar) {
  const korilgan = new Map();
  const dubl = new Set();
  for (const r of qatorlar) {
    const k = qalKalit(r.q);
    if (!k) continue;
    if (korilgan.has(k)) { dubl.add(korilgan.get(k)); dubl.add(r.id); } else korilgan.set(k, r.id);
  }
  return dubl;
}

// Sozlama propidan forma holatini yasash (hamma raqam MATN sifatida turadi —
// vergul bilan yozishga xalaqit bermasin)
function formaYasa(s) {
  const o = s || {};
  const kg = (o.kgPerM && typeof o.kgPerM === 'object') ? o.kgPerM : {};
  return {
    kurs: xom(o.kurs),
    ustama: xom(o.ustama),
    bolizvchi1: xom(o.bolizvchi1),
    bolizvchi2: xom(o.bolizvchi2),
    nom1: o.nom1 || '',
    nom2: o.nom2 || '',
    koefSMZ: xom(o.koefSMZ),
    koefBoshqa: xom(o.koefBoshqa),
    kg: { SMZ: kgQatorlar(kg.SMZ), BOSHQA: kgQatorlar(kg.BOSHQA) },
    royxat: {
      zavodlar: royxatQatorlar(sozlamaRoyxat(o, 'zavodlar')),
      turlar: royxatQatorlar(sozlamaRoyxat(o, 'turlar')),
      ranglar: royxatQatorlar(sozlamaRoyxat(o, 'ranglar')),
    },
  };
}

// Rang → tur propidan forma holatini yasash
function rtYasa(rt) {
  const o = rt || {};
  const qoidalar = Array.isArray(o.qoidalar) ? o.qoidalar : [];
  return {
    qoidalar: qoidalar.map((q) => ({ id: genId(), naqsh: (q && q.naqsh) || '', tur: (q && q.tur) || '' })),
    standart: o.standart || '',
  };
}

// Ikki formani solishtirish uchun kanonik matn (id lar hisobga olinmaydi)
function solish(f, r) {
  return JSON.stringify({
    kurs: f.kurs, ustama: f.ustama, b1: f.bolizvchi1, b2: f.bolizvchi2,
    n1: f.nom1, n2: f.nom2, kS: f.koefSMZ, kB: f.koefBoshqa,
    kg: { SMZ: f.kg.SMZ.map((x) => [x.q, x.v]), BOSHQA: f.kg.BOSHQA.map((x) => [x.q, x.v]) },
    ry: {
      z: f.royxat.zavodlar.map((x) => x.v),
      t: f.royxat.turlar.map((x) => x.v),
      c: f.royxat.ranglar.map((x) => x.v),
    },
    q: r.qoidalar.map((x) => [x.naqsh, x.tur]),
    st: r.standart,
  });
}

// ----- Raqamli maydon (label + izoh + xato) -----
function SonMaydon({ label, value, onChange, disabled, hint, xato, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        inputMode="decimal" value={value} disabled={disabled} placeholder={placeholder || '0'}
        onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) onChange(s); }}
        onFocus={(e) => e.target.select()} onWheel={(e) => e.target.blur()}
        className={`w-full px-2 py-1.5 border rounded bg-white tabular-nums disabled:bg-slate-100 disabled:text-slate-400 ${xato ? 'border-red-400' : 'border-slate-300'}`} />
      {xato
        ? <div className="mt-1 flex items-start gap-1 text-[11px] text-red-700"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" /><span>{xato}</span></div>
        : hint ? <div className="mt-1 text-[11px] text-slate-500 tabular-nums">{hint}</div> : null}
    </div>
  );
}

// ----- Matnli maydon (ustun sarlavhalari) -----
function MatnMaydon({ label, value, onChange, disabled, hint, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input value={value} disabled={disabled} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white disabled:bg-slate-100 disabled:text-slate-400" />
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

// ----- kg/m jadvalining bitta guruhi (SMZ yoki BOSHQA) -----
function KgGuruh({ nom, izoh, qatorlar, dubl, notoliq, canEdit, onQator, onQosh, onOchir }) {
  return (
    <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{nom}</span>
        <span className="text-[10px] text-slate-400 truncate ml-2">{izoh}</span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center mb-1">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Qalinlik</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">kg / m</span>
        <span className="w-7" />
      </div>

      {qatorlar.length === 0 && (
        <p className="text-[11px] text-slate-400 py-2 text-center">Jadval bo'sh — faqat koeffitsient ishlatiladi</p>
      )}

      {qatorlar.map((r) => {
        // Qizil chegara AYNAN yaroqsiz katakka qo'yiladi
        const yarim = notoliq.has(r.id);
        const qQizil = dubl.has(r.id) || (yarim && qalXato(r));
        const vQizil = yarim && kgXato(r);
        return (
          <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center mb-1.5">
            <input inputMode="decimal" value={r.q} disabled={!canEdit} placeholder="0.40"
              onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) onQator(r.id, { q: s }); }}
              onFocus={(e) => e.target.select()} onWheel={(e) => e.target.blur()}
              className={`w-full px-2 py-1.5 border rounded bg-white tabular-nums disabled:bg-slate-100 disabled:text-slate-400 ${qQizil ? 'border-red-400' : 'border-slate-300'}`} />
            <input inputMode="decimal" value={r.v} disabled={!canEdit} placeholder="0"
              onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) onQator(r.id, { v: s }); }}
              onFocus={(e) => e.target.select()} onWheel={(e) => e.target.blur()}
              className={`w-full px-2 py-1.5 border rounded bg-white tabular-nums disabled:bg-slate-100 disabled:text-slate-400 ${vQizil ? 'border-red-400' : 'border-slate-300'}`} />
            <button type="button" onClick={() => onOchir(r.id)} disabled={!canEdit} title="Qatorni o'chirish"
              className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 disabled:opacity-30">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <button type="button" onClick={onQosh} disabled={!canEdit}
        className="mt-1 w-full py-1.5 rounded border border-dashed border-slate-300 text-[11px] text-slate-500 bg-white flex items-center justify-center gap-1 disabled:opacity-40">
        <Plus className="w-3.5 h-3.5" /> Qalinlik qo'shish
      </button>
    </div>
  );
}

// ============================================================
//  ASOSIY KOMPONENT
// ============================================================
// ----- Bitta tanlov ro'yxatini tahrirlash bloki -----
//  sanoq — Map(norm(nom) → nechta yozuvda ishlatilgan). O'chirishdan oldin
//  foydalanuvchi nimaga tegayotganini ko'rib tursin.
function RoyxatTahrir({ sarlavha, izoh, qatorlar, sanoq, canEdit, onSet, onQosh, onOchir, onKochir }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-600">{sarlavha}</span>
        {canEdit && (
          <button type="button" onClick={onQosh}
            className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-600 text-[11px] inline-flex items-center gap-1 hover:bg-slate-50">
            <Plus className="w-3 h-3" /> Qo'shish
          </button>
        )}
      </div>
      {izoh && <p className="text-[11px] text-slate-400 mb-1.5">{izoh}</p>}
      <div className="space-y-1">
        {qatorlar.length === 0 && (
          <p className="text-[11px] text-slate-400 py-1">Ro'yxat bo'sh — «Qo'shish» bilan boshlang.</p>
        )}
        {qatorlar.map((r, i) => {
          const ishlatilgan = sanoq.get(norm(r.v)) || 0;
          return (
            <div key={r.id} className="flex items-center gap-1">
              <input value={r.v} disabled={!canEdit}
                onChange={(e) => onSet(r.id, e.target.value)}
                placeholder="nomi"
                className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded bg-white disabled:bg-slate-100" />
              <span className={`text-[10px] tabular-nums w-14 text-right flex-shrink-0 ${
                ishlatilgan > 0 ? 'text-slate-500' : 'text-slate-300'}`}
                title={ishlatilgan > 0 ? `${ishlatilgan} ta yozuvda ishlatilyapti` : 'Hech qayerda ishlatilmagan'}>
                {ishlatilgan > 0 ? `${ishlatilgan} ta` : '—'}
              </span>
              {canEdit && (
                <>
                  <button type="button" onClick={() => onKochir(r.id, -1)} disabled={i === 0}
                    title="Yuqoriga" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => onKochir(r.id, 1)} disabled={i === qatorlar.length - 1}
                    title="Pastga" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => onOchir(r)}
                    title="O'chirish" className="p-1 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OmborSozlama({
  sozlama = {}, updateSozlama, rangTur = {}, updateRangTur,
  rulonlar = {}, narxlar = {},
  canEdit = true, showToast, onSeed, onQaytaNomla,
}) {
  const [ochiq, setOchiq] = useState(false);            // standart holat — YOPIQ
  const [sinov, setSinov] = useState('');               // rang → tur jonli sinovi
  const [seedIsh, setSeedIsh] = useState('');           // sozlama tiklash ishlayaptimi
  const [saqlanmoqda, setSaqlanmoqda] = useState(false); // qayta nomlash + saqlash davom etyapti
  const [seedNatija, setSeedNatija] = useState('');
  const [seedXato, setSeedXato] = useState('');

  // Proplardan yasalgan "asl" holat (saqlanganiga teng)
  const asl = useMemo(() => formaYasa(sozlama), [sozlama]);
  const aslRT = useMemo(() => rtYasa(rangTur), [rangTur]);

  const [forma, setForma] = useState(asl);
  const [rt, setRt] = useState(aslRT);

  // Taqqoslash MATN bo'yicha: prop obyekti har renderda yangi bo'lsa ham
  // mazmuni o'zgarmagan bo'lsa forma qayta yuklanmaydi.
  const aslMatn = solish(asl, aslRT);
  const joriyMatn = solish(forma, rt);
  const ozgargan = joriyMatn !== aslMatn;

  // Boshqa qurilmada o'zgargani haqida ogoh (lokal tahrir bosib ketilmasin)
  const [tashqiYangi, setTashqiYangi] = useState(false);

  // oldingiRef — oxirgi YUKLANGAN (yoki saqlangan) holat matni. Lokal tahrir
  // bor-yo'qligi shu bilan aniqlanadi: joriy forma shu matndan farq qilsa —
  // demak foydalanuvchi biror narsa yozgan.
  const oldingiRef = useRef(aslMatn);
  const joriyRef = useRef(joriyMatn);
  joriyRef.current = joriyMatn;

  // Tashqaridan (Firestore'dan) ma'lumot o'zgarsa:
  //  • lokal tahrir YO'Q bo'lsa — jimgina qayta yuklaymiz;
  //  • lokal tahrir BOR bo'lsa — TEGMAYMIZ, faqat ogoh ko'rsatamiz. Aks holda
  //    yozayotgan katak o'rtada eski qiymatga qaytib, fokus uchib ketardi.
  useEffect(() => {
    const oldingi = oldingiRef.current;
    if (oldingi === aslMatn) return;
    oldingiRef.current = aslMatn;
    if (joriyRef.current !== oldingi) { setTashqiYangi(true); return; }
    setForma(asl);
    setRt(aslRT);
    setTashqiYangi(false);
  }, [aslMatn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Formani tahrirlash -----
  const tahrir = (patch) => setForma((f) => ({ ...f, ...patch }));
  const kgTahrir = (guruh, id, patch) => setForma((f) => ({
    ...f,
    kg: { ...f.kg, [guruh]: f.kg[guruh].map((r) => (r.id === id ? { ...r, ...patch } : r)) },
  }));
  const kgQosh = (guruh) => setForma((f) => ({
    ...f, kg: { ...f.kg, [guruh]: [...f.kg[guruh], { id: genId(), q: '', v: '' }] },
  }));
  const kgOchir = (guruh, id) => setForma((f) => ({
    ...f, kg: { ...f.kg, [guruh]: f.kg[guruh].filter((r) => r.id !== id) },
  }));

  // ----- Tanlov ro'yxatlari (zavod / tur / rang) -----
  const royxatSet = (nom, id, v) => setForma((f) => ({
    ...f, royxat: { ...f.royxat, [nom]: f.royxat[nom].map((r) => (r.id === id ? { ...r, v } : r)) },
  }));
  const royxatQosh = (nom) => setForma((f) => ({
    ...f, royxat: { ...f.royxat, [nom]: [...f.royxat[nom], { id: genId(), v: '', asl: '' }] },
  }));
  const royxatKochir = (nom, id, yon) => setForma((f) => {
    const arr = [...f.royxat[nom]];
    const i2 = arr.findIndex((r) => r.id === id);
    const j = i2 + yon;
    if (i2 < 0 || j < 0 || j >= arr.length) return f;
    [arr[i2], arr[j]] = [arr[j], arr[i2]];
    return { ...f, royxat: { ...f.royxat, [nom]: arr } };
  });

  // Har bir nom nechta yozuvda ishlatilgan — o'chirishdan oldin ogohlantirish
  // uchun. Zavod va tur rulon ham, narx yozuvida ham uchraydi; rang faqat rulonda.
  const sanoq = useMemo(() => {
    const rul = Object.values(rulonlar || {}).filter((x) => x && !x.ochirilgan);
    const nrx = Object.values(narxlar || {}).filter((x) => x && !x.ochirilgan);
    const hisobla = (manbalar, maydon) => {
      const m = new Map();
      for (const src of manbalar) {
        for (const x of src) {
          const k = norm(x[maydon]);
          if (k) m.set(k, (m.get(k) || 0) + 1);
        }
      }
      return m;
    };
    return {
      zavodlar: hisobla([rul, nrx], 'zavod'),
      turlar: hisobla([rul, nrx], 'tur'),
      ranglar: hisobla([rul], 'rang'),
    };
  }, [rulonlar, narxlar]);

  // O'chirish: ishlatilayotgan nom bo'lsa nima bo'lishini aniq aytamiz.
  // Eski yozuvlar O'ZGARMAYDI — ro'yxat faqat tanlov variantlari ro'yxati.
  function royxatOchir(nom, r) {
    const n = sanoq[nom].get(norm(r.v)) || 0;
    if (n > 0) {
      const ok = window.confirm(
        `"${r.v}" hozir ${n} ta yozuvda ishlatilyapti.\n\n`
        + "Ro'yxatdan o'chirsangiz o'sha yozuvlar O'ZGARMAYDI va bu nom ularda\n"
        + "ko'rinib turaveradi — faqat tanlov ro'yxatidan chiqadi.\n\nO'chirilsinmi?",
      );
      if (!ok) return;
    }
    setForma((f) => ({
      ...f, royxat: { ...f.royxat, [nom]: f.royxat[nom].filter((x) => x.id !== r.id) },
    }));
  }

  // ----- Rang → tur qoidalari -----
  const qoidaTahrir = (id, patch) => setRt((r) => ({
    ...r, qoidalar: r.qoidalar.map((q) => (q.id === id ? { ...q, ...patch } : q)),
  }));
  const qoidaQosh = () => setRt((r) => ({
    ...r, qoidalar: [...r.qoidalar, { id: genId(), naqsh: '', tur: r.standart || '' }],
  }));
  const qoidaOchir = (id) => setRt((r) => ({ ...r, qoidalar: r.qoidalar.filter((q) => q.id !== id) }));
  const qoidaKochir = (index, yonalish) => setRt((r) => {
    const j = index + yonalish;
    if (j < 0 || j >= r.qoidalar.length) return r;
    const next = [...r.qoidalar];
    [next[index], next[j]] = [next[j], next[index]];
    return { ...r, qoidalar: next };
  });

  // Tur ro'yxati: standart ro'yxat + mavjud qoidalarda uchragan turlar
  const turlar = useMemo(() => {
    const out = [];
    const korilgan = new Set();
    const qosh = (v) => {
      const s = String(v == null ? '' : v).trim();
      if (!s || korilgan.has(s.toLowerCase())) return;
      korilgan.add(s.toLowerCase()); out.push(s);
    };
    // Foydalanuvchi tahrirlayotgan tur ro'yxati (hali saqlanmagan bo'lsa ham)
    forma.royxat.turlar.forEach((r) => qosh(r.v));
    rt.qoidalar.forEach((q) => qosh(q.tur));
    qosh(rt.standart);
    return out;
  }, [rt, forma.royxat.turlar]);

  // ----- Tekshiruvlar -----
  //  Bu qiymatlar butun rulonlar jadvalini boshqaradi: kurs 0 bo'lsa rulon
  //  so'mi, 1 m tannarxi va ikkala sotuv narxi ham "—" ga aylanadi; koef 0
  //  bo'lsa jadvalda yo'q qalinlik uchun kg/m umuman hisoblanmaydi. Shuning
  //  uchun bo'sh / nol qiymat bilan SAQLASHGA yo'l qo'ymaymiz.
  const musbatXato = (n) => (!(n != null && n > 0) ? "0 dan katta bo'lishi kerak" : '');
  const kurs = son(forma.kurs);
  const ustama = son(forma.ustama);
  const b1 = son(forma.bolizvchi1);
  const b2 = son(forma.bolizvchi2);
  const kSMZ = son(forma.koefSMZ);
  const kBoshqa = son(forma.koefBoshqa);
  const kursXato = musbatXato(kurs);
  // Ustama 0 bo'lishi mumkin (ustamasiz), lekin BO'SH qolishi mumkin emas
  const ustamaXato = ustama == null ? "Bo'sh qoldirib bo'lmaydi (ustama yo'q bo'lsa 0 yozing)" : '';
  const b1Xato = musbatXato(b1);
  const b2Xato = musbatXato(b2);
  const kSMZXato = musbatXato(kSMZ);
  const kBoshqaXato = musbatXato(kBoshqa);
  const maydonXato = !!(kursXato || ustamaXato || b1Xato || b2Xato || kSMZXato || kBoshqaXato);

  const dublSMZ = useMemo(() => dublikatlar(forma.kg.SMZ), [forma.kg.SMZ]);
  const dublBoshqa = useMemo(() => dublikatlar(forma.kg.BOSHQA), [forma.kg.BOSHQA]);
  const dublBor = dublSMZ.size > 0 || dublBoshqa.size > 0;
  const notoliqSMZ = useMemo(() => notoliqlar(forma.kg.SMZ), [forma.kg.SMZ]);
  const notoliqBoshqa = useMemo(() => notoliqlar(forma.kg.BOSHQA), [forma.kg.BOSHQA]);
  const notoliqBor = notoliqSMZ.size > 0 || notoliqBoshqa.size > 0;

  const xatoBor = maydonXato || dublBor || notoliqBor;

  // Ustama foizi: 1 m tannarx ÷ b → +X %
  const foizMatn = (b) => (b != null && b > 0
    ? `1 m tannarx ÷ ${b} → ${((1 / b - 1) * 100) >= 0 ? '+' : ''}${((1 / b - 1) * 100).toFixed(1)} %`
    : '');

  // Kurs o'zgarganda kursSana bugungi kunga yangilanadi
  const kursOzgardi = kurs !== son(sozlama.kurs);

  // ----- Saqlash / bekor qilish -----
  // Nomi o'zgargan VA yozuvlarda ishlatilayotgan qatorlar — ularni
  // yozuvlarda ham almashtirish kerak (aks holda narx topilmay qoladi:
  // narx ro'yxatida "SMZ", rulonda "SMZ zavodi" bo'lib ketardi).
  const qaytaNomlar = useMemo(() => {
    const out = [];
    for (const [nom, maydon] of [['zavodlar', 'zavod'], ['turlar', 'tur'], ['ranglar', 'rang']]) {
      for (const r of forma.royxat[nom]) {
        const eski = String(r.asl || '').trim();
        const yangi = String(r.v || '').trim();
        if (!eski || !yangi || norm(eski) === norm(yangi)) continue;
        const soni = sanoq[nom].get(norm(eski)) || 0;
        if (soni > 0) out.push({ nom, maydon, eski, yangi, soni });
      }
    }
    return out;
  }, [forma.royxat, sanoq]);

  async function saqla() {
    if (!canEdit || xatoBor || !ozgargan || saqlanmoqda) return;

    // Nom o'zgargan bo'lsa — nima bo'lishini aniq ko'rsatib tasdiq so'raymiz.
    // Bekor qilinsa HECH NARSA saqlanmaydi (yarim holat qolmasin).
    if (qaytaNomlar.length && onQaytaNomla) {
      const royxat = qaytaNomlar
        .map((x) => `  • "${x.eski}" → "${x.yangi}"   (${x.soni} ta yozuv)`)
        .join('\n');
      const ok = window.confirm(
        `Nom o'zgardi:\n${royxat}\n\n`
        + "Mavjud yozuvlarda ham almashtirilsinmi?\n\n"
        + "OK — hamma joyda yangi nom bo'ladi.\n"
        + "Bekor — hech narsa saqlanmaydi (nomni qaytarib qo'ying).",
      );
      if (!ok) return;
    }

    const yangi = {
      ...sozlama, // notanish maydonlar yo'qolmasin
      kurs: kurs ?? 0,
      ustama: ustama ?? 0,
      bolizvchi1: b1,
      bolizvchi2: b2,
      nom1: forma.nom1.trim(),
      nom2: forma.nom2.trim(),
      koefSMZ: kSMZ ?? 0,
      koefBoshqa: kBoshqa ?? 0,
      kgPerM: { SMZ: kgObyekt(forma.kg.SMZ), BOSHQA: kgObyekt(forma.kg.BOSHQA) },
      zavodlar: royxatMassiv(forma.royxat.zavodlar),
      turlar: royxatMassiv(forma.royxat.turlar),
      ranglar: royxatMassiv(forma.royxat.ranglar),
      kursSana: kursOzgardi ? bugun() : (sozlama.kursSana || ''),
    };
    const yangiRT = {
      qoidalar: rt.qoidalar
        .map((q) => ({ naqsh: (q.naqsh || '').trim(), tur: q.tur || '' }))
        .filter((q) => q.naqsh),
      standart: rt.standart || '',
    };
    // AVVAL yozuvlarni qayta nomlaymiz — xato bo'lsa sozlama ham yozilmaydi,
    // shunda ro'yxat yangi nomda, yozuvlar eski nomda qolib ketmaydi.
    let qnMatn = '';
    if (qaytaNomlar.length && onQaytaNomla) {
      setSaqlanmoqda(true);
      try {
        let rul = 0;
        let nrx = 0;
        for (const x of qaytaNomlar) {
          const n = await onQaytaNomla(x.maydon, x.eski, x.yangi);
          rul += (n && n.rulonlar) || 0;
          nrx += (n && n.narxlar) || 0;
        }
        const qismlar = [];
        if (rul) qismlar.push(`${rul} ta rulon`);
        if (nrx) qismlar.push(`${nrx} ta narx`);
        qnMatn = qismlar.length ? ` · ${qismlar.join(', ')} yangilandi` : '';
      } catch (e) {
        console.error('[ombor qayta nomlash] xato:', e);
        setSaqlanmoqda(false);
        if (showToast) showToast('Qayta nomlashda xatolik — hech narsa saqlanmadi');
        return;
      }
      setSaqlanmoqda(false);
    }

    if (updateSozlama) updateSozlama(yangi);
    if (updateRangTur) updateRangTur(yangiRT);

    // Formani HAQIQATAN yozilgan qiymatlardan qayta yasaymiz. Aks holda
    // normallashtirishda yo'qoladigan o'zgarishlardan (bo'sh qator, naqshsiz
    // qoida, ortiqcha bo'shliq, "0,95" ↔ "0.95") keyin yozilgan obyekt
    // aslidagiga aynan teng chiqadi — proplar o'zgarmaydi, yuqoridagi effekt
    // ishlamaydi va forma abadiy "saqlanmagan" holatida qolib ketardi.
    const yAsl = formaYasa(yangi);
    const yRT = rtYasa(yangiRT);
    const yMatn = solish(yAsl, yRT);
    oldingiRef.current = yMatn;
    // Mazmun aynan bir xil bo'lsa tegmaymiz — inputlar remount bo'lib
    // kursor/fokus sakramasin.
    if (yMatn !== joriyMatn) { setForma(yAsl); setRt(yRT); }
    setTashqiYangi(false);
    if (showToast) showToast(`Sozlama saqlandi${qnMatn}`);
  }

  // Bekor qilish = eng so'nggi saqlangan (proplardagi) holatga qaytish.
  // Tashqi o'zgarish ogohi ham shu bilan yopiladi.
  function bekor() {
    oldingiRef.current = aslMatn;
    setForma(asl);
    setRt(aslRT);
    setTashqiYangi(false);
  }

  // ----- Sozlamani boshlang'ich holatga tiklash -----
  //  DIQQAT: bu FAQAT sozlama va rang → tur qoidalarini yozadi.
  //  Narx ro'yxati va rulonlarga TEGMAYDI — ularni foydalanuvchi o'zi kiritadi.
  async function tiklaBos() {
    if (!canEdit || !onSeed || seedIsh) return;
    const savol = "Sozlama boshlang'ich holatga qaytariladi:\n"
      + "  • kurs, ustama, bo'luvchilar, ustun nomlari\n"
      + "  • kg/m jadvali va koeffitsientlar\n"
      + "  • rang → tur qoidalari\n\n"
      + "DIQQAT: bular TO'LIQ ALMASHTIRILADI — qo'shgan qalinliklaringiz,\n"
      + "qoidalaringiz va joriy kurs o'chadi.\n\n"
      + "Narx ro'yxati va rulonlarga TEGILMAYDI.\n\nDavom etamizmi?";
    if (!window.confirm(savol)) return;
    setSeedIsh('tikla'); setSeedNatija(''); setSeedXato('');
    try {
      const natija = await onSeed();
      const qatorlar = Object.entries(natija || {}).map(([k, v]) => `${k} ${v} ta`);
      const matn = qatorlar.length ? `Tiklandi: ${qatorlar.join(', ')}` : 'Tiklandi';
      console.log(`[ombor sozlama] ${matn}`, natija);
      setSeedNatija(matn);
      if (showToast) showToast('Sozlama tiklandi');
    } catch (e) {
      console.error('[ombor sozlama] xato:', e);
      setSeedXato(`Xato: ${(e && e.message) || e}`);
    } finally {
      setSeedIsh('');
    }
  }

  // BOSHQA guruhga kiradigan zavodlar (SMZ dan qolganlari) — eslatma uchun
  const boshqaZavodlar = forma.royxat.zavodlar.map((r) => r.v)
    .filter((z) => z && !/smz/i.test(z)).join(', ');

  // Yopiq holatdagi qisqacha ma'lumot
  const qisqacha = `Kurs ${fmt(sozlama.kurs)} so'm · Ustama ${olchovKor(sozlama.ustama, 2)} $/t`
    + ` · ${sozlama.nom1 || '—'} / ${sozlama.nom2 || '—'}`;

  const sinovNatija = turTaxmin({ qoidalar: rt.qoidalar, standart: rt.standart }, sinov);

  return (
    <Card>
      {/* ----- Sarlavha: ochib-yopadigan tugma ----- */}
      <button type="button" onClick={() => setOchiq((v) => !v)}
        className={`w-full flex items-center gap-2.5 text-left ${ochiq ? 'mb-3' : ''}`}>
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 text-white flex-shrink-0">
          <Settings className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-800 uppercase tracking-wide">Ombor sozlamalari</span>
          {!ochiq && <span className="block text-xs text-slate-500 tabular-nums truncate">{qisqacha}</span>}
        </span>
        {(ozgargan || tashqiYangi) && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
            tashqiYangi ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800'}`}>
            {tashqiYangi ? "Tashqi o'zgarish" : "Saqlanmagan o'zgarishlar"}
          </span>
        )}
        <span className="text-slate-400 flex-shrink-0">
          {ochiq ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </span>
      </button>

      {ochiq && (
        <div className="space-y-4">
          {/* ----- 0) Boshqa qurilmada o'zgardi ----- */}
          {tashqiYangi && (
            <div className="flex items-start gap-1.5 text-[11px] bg-amber-50 border border-amber-300 text-amber-800 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              <span className="flex-1">
                Ma'lumot boshqa qurilmada o'zgardi. Sizning tahrirlaringiz saqlanmagani uchun
                forma o'zgartirilmadi — "Saqlash" bossangiz o'sha o'zgarish bosib ketiladi,
                "Yangilash" bossangiz esa tahrirlaringiz o'chib, yangi ma'lumot yuklanadi.
              </span>
              <button type="button" onClick={bekor}
                className="px-2 py-1 rounded border border-amber-300 bg-white text-amber-800 font-medium whitespace-nowrap flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" /> Yangilash
              </button>
            </div>
          )}

          {/* ----- 1) Asosiy qiymatlar ----- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SonMaydon
              label="Dollar kursi (so'm)" value={forma.kurs} disabled={!canEdit}
              onChange={(v) => tahrir({ kurs: v })} xato={kursXato}
              hint={`Oxirgi o'zgartirilgan: ${sozlama.kursSana || '—'}${kursOzgardi ? ` → ${bugun()}` : ''}`} />

            <SonMaydon
              label="Ustama ($/tonna)" value={forma.ustama} disabled={!canEdit}
              onChange={(v) => tahrir({ ustama: v })} xato={ustamaXato}
              hint="Zavod ro'yxatidagi narxga qo'shiladi" />

            <SonMaydon
              label="1-sotuv bo'luvchisi" value={forma.bolizvchi1} disabled={!canEdit}
              onChange={(v) => tahrir({ bolizvchi1: v })}
              xato={b1Xato} hint={foizMatn(b1)} />

            <SonMaydon
              label="2-sotuv bo'luvchisi" value={forma.bolizvchi2} disabled={!canEdit}
              onChange={(v) => tahrir({ bolizvchi2: v })}
              xato={b2Xato} hint={foizMatn(b2)} />

            <MatnMaydon
              label="1-ustun sarlavhasi" value={forma.nom1} disabled={!canEdit}
              onChange={(v) => tahrir({ nom1: v })} placeholder="5%"
              hint="Jadvaldagi 1-sotuv ustuni nomi" />

            <MatnMaydon
              label="2-ustun sarlavhasi" value={forma.nom2} disabled={!canEdit}
              onChange={(v) => tahrir({ nom2: v })} placeholder="10%"
              hint="Jadvaldagi 2-sotuv ustuni nomi" />

            <SonMaydon
              label="SMZ koeffitsienti" value={forma.koefSMZ} disabled={!canEdit}
              onChange={(v) => tahrir({ koefSMZ: v })} xato={kSMZXato}
              hint="Jadvalda yo'q qalinlik uchun" />

            <SonMaydon
              label="BOSHQA koeffitsienti" value={forma.koefBoshqa} disabled={!canEdit}
              onChange={(v) => tahrir({ koefBoshqa: v })} xato={kBoshqaXato}
              hint="Jadvalda yo'q qalinlik uchun" />
          </div>

          {/* ----- 2) Qalinlik → kg/m jadvali ----- */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Qalinlik → 1 m og'irligi (kg)
              </span>
              <span className="text-[11px] text-slate-500">
                Jadvalda yo'q qalinlik uchun: kg/m = qalinlik × koef
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KgGuruh
                nom="SMZ" izoh="faqat SMZ zavodi" qatorlar={forma.kg.SMZ}
                dubl={dublSMZ} notoliq={notoliqSMZ} canEdit={canEdit}
                onQator={(id, p) => kgTahrir('SMZ', id, p)}
                onQosh={() => kgQosh('SMZ')} onOchir={(id) => kgOchir('SMZ', id)} />
              <KgGuruh
                nom="BOSHQA" izoh={boshqaZavodlar} qatorlar={forma.kg.BOSHQA}
                dubl={dublBoshqa} notoliq={notoliqBoshqa} canEdit={canEdit}
                onQator={(id, p) => kgTahrir('BOSHQA', id, p)}
                onQosh={() => kgQosh('BOSHQA')} onOchir={(id) => kgOchir('BOSHQA', id)} />
            </div>

            {dublBor && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] bg-red-50 border border-red-300 text-red-700 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>Bir xil qalinlik takrorlangan — qizil kataklarni tuzating (aks holda saqlab bo'lmaydi).</span>
              </div>
            )}

            {notoliqBor && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] bg-red-50 border border-red-300 text-red-700 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>
                  Qalinlik yoki kg/m to'ldirilmagan (yoki 0) — bunday qator jadvalga
                  TUSHMAYDI. Qizil kataklarni to'ldiring yoki qatorni o'chiring.
                </span>
              </div>
            )}
          </div>

          {/* ----- 2b) Tanlov ro'yxatlari (zavod / tur / rang) ----- */}
          <div className="pt-2 border-t border-slate-100">
            <SectionTitle icon={List}>Tanlov ro'yxatlari</SectionTitle>
            <p className="text-[11px] text-slate-500 -mt-2 mb-3">
              Rulonlar va Narx ro'yxati jadvallaridagi <b>Zavod</b>, <b>Tur</b> va <b>Rang</b>
              {' '}tanlovlarida shu nomlar chiqadi. O'ng tomondagi son — nom nechta yozuvda
              ishlatilayotgani. Nomni <b>o'zgartirsangiz</b> — saqlashda u
              <b> mavjud yozuvlarda ham almashtiriladi</b> (tasdiq so'raladi).
              O'chirsangiz esa yozuvlar o'zgarmaydi: eski nom ularda qolib,
              tanlovda ham ko'rinib turaveradi.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <RoyxatTahrir
                sarlavha="Zavodlar" izoh="Narx ro'yxati shu zavodlar bo'yicha yuritiladi."
                qatorlar={forma.royxat.zavodlar} sanoq={sanoq.zavodlar} canEdit={canEdit}
                onSet={(id, v) => royxatSet('zavodlar', id, v)}
                onQosh={() => royxatQosh('zavodlar')}
                onOchir={(r) => royxatOchir('zavodlar', r)}
                onKochir={(id, yon) => royxatKochir('zavodlar', id, yon)} />

              <RoyxatTahrir
                sarlavha="Turlar" izoh="Qoplama turi — narx aynan shu bo'yicha topiladi."
                qatorlar={forma.royxat.turlar} sanoq={sanoq.turlar} canEdit={canEdit}
                onSet={(id, v) => royxatSet('turlar', id, v)}
                onQosh={() => royxatQosh('turlar')}
                onOchir={(r) => royxatOchir('turlar', r)}
                onKochir={(id, yon) => royxatKochir('turlar', id, yon)} />

              <RoyxatTahrir
                sarlavha="Ranglar" izoh="Narxga ta'sir qilmaydi — faqat rulonni tanib olish uchun."
                qatorlar={forma.royxat.ranglar} sanoq={sanoq.ranglar} canEdit={canEdit}
                onSet={(id, v) => royxatSet('ranglar', id, v)}
                onQosh={() => royxatQosh('ranglar')}
                onOchir={(r) => royxatOchir('ranglar', r)}
                onKochir={(id, yon) => royxatKochir('ranglar', id, yon)} />
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Bo'sh qatorlar va takror nomlar saqlashda o'zi tashlab yuboriladi.
              Qalinlik alohida ro'yxat emas — u har qatorda qo'lda yoziladi.
            </p>
          </div>

          {/* ----- 3) Rang → tur qoidalari ----- */}
          <div className="pt-1">
            <SectionTitle icon={Check}>Rang → tur qoidalari</SectionTitle>
            <p className="text-[11px] text-slate-500 -mt-2 mb-2">
              Qoidalar yuqoridan pastga tekshiriladi — rang nomida naqsh uchrasa, o'sha tur olinadi.
              Hech biri mos kelmasa "standart tur" ishlatiladi.
            </p>

            <div className="space-y-1.5">
              {rt.qoidalar.length === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-2">Qoida yo'q — hamma rang standart turga tushadi</p>
              )}
              {rt.qoidalar.map((q, idx) => (
                <div key={q.id} className="flex items-center gap-1.5">
                  <div className="flex flex-col">
                    <button type="button" onClick={() => qoidaKochir(idx, -1)} disabled={!canEdit || idx === 0}
                      title="Yuqoriga" className="text-slate-400 hover:text-slate-900 disabled:opacity-20">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => qoidaKochir(idx, 1)} disabled={!canEdit || idx === rt.qoidalar.length - 1}
                      title="Pastga" className="text-slate-400 hover:text-slate-900 disabled:opacity-20">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <input value={q.naqsh} disabled={!canEdit} placeholder="naqsh (masalan: plyonka)"
                    onChange={(e) => qoidaTahrir(q.id, { naqsh: e.target.value })}
                    className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400" />
                  <select value={q.tur} disabled={!canEdit}
                    onChange={(e) => qoidaTahrir(q.id, { tur: e.target.value })}
                    className="w-28 sm:w-44 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400">
                    <option value="">— tur yo'q —</option>
                    {turlar.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" onClick={() => qoidaOchir(q.id)} disabled={!canEdit} title="Qoidani o'chirish"
                    className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={qoidaQosh} disabled={!canEdit}
              className="mt-2 w-full py-1.5 rounded border border-dashed border-slate-300 text-[11px] text-slate-500 bg-white flex items-center justify-center gap-1 disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Qoida qo'shish
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Standart tur (qoida topilmasa)</label>
                <select value={rt.standart} disabled={!canEdit}
                  onChange={(e) => setRt((r) => ({ ...r, standart: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs disabled:bg-slate-100 disabled:text-slate-400">
                  <option value="">— tanlanmagan —</option>
                  {turlar.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sinov: rang nomini yozing</label>
                <div className="flex items-center gap-1.5">
                  <input value={sinov} onChange={(e) => setSinov(e.target.value)} placeholder="Oq (yaltiroq)"
                    className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded bg-white text-xs" />
                  <span className="px-2 py-1.5 rounded bg-slate-100 border border-slate-200 text-xs flex items-center gap-1 whitespace-nowrap max-w-[55%] truncate">
                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    {sinov.trim()
                      ? <b className="text-slate-800 truncate">{sinovNatija || "tur yo'q"}</b>
                      : <span className="text-slate-400">tur shu yerda</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ----- 4) Saqlash / bekor ----- */}
          {canEdit && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              {ozgargan && (
                <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Saqlanmagan o'zgarishlar
                </span>
              )}
              <div className="flex-1" />
              <button type="button" onClick={bekor} disabled={!ozgargan}
                className="px-3 py-2 border-2 border-slate-200 text-slate-700 rounded-lg bg-white font-medium text-sm flex items-center gap-1.5 disabled:opacity-40">
                <RotateCcw className="w-4 h-4" /> Bekor qilish
              </button>
              <button type="button" onClick={saqla} disabled={!ozgargan || xatoBor || saqlanmoqda}
                className="bg-slate-900 text-white rounded-lg px-3 py-2 font-medium text-sm flex items-center gap-1.5 disabled:opacity-40">
                {saqlanmoqda
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Yangilanmoqda…</>
                  : <><Save className="w-4 h-4" /> Saqlash</>}
              </button>
            </div>
          )}

          {/* ----- 5) Sozlamani tiklash ----- */}
          {canEdit && (
            <div className="pt-2 border-t border-slate-100">
              <SectionTitle icon={Database}>Sozlamani tiklash</SectionTitle>
              <p className="text-[11px] text-slate-500 -mt-2 mb-2">
                Yuqoridagi sozlamalarni boshlang'ich holatga qaytaradi.
                <b> Narx ro'yxati</b> va <b>rulonlar</b>ga tegmaydi — ular faqat
                siz kiritgan ma'lumotdan iborat.
              </p>
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2 mb-2">
                Sozlama va rang → tur qoidalari <b>TO'LIQ ALMASHTIRILADI</b> —
                qo'shgan qalinliklaringiz, qoidalaringiz va joriy kurs o'chadi.
              </p>

              <button type="button" onClick={tiklaBos} disabled={!!seedIsh || !onSeed}
                className="py-2 px-3 rounded-lg border-2 border-slate-200 bg-white text-slate-700 font-medium text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
                {seedIsh
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
                <span>Boshlang'ich sozlamaga qaytarish</span>
              </button>

              {seedNatija && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] bg-emerald-50 border border-emerald-300 text-emerald-800 rounded p-2 tabular-nums">
                  <Check className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span>{seedNatija}</span>
                </div>
              )}
              {seedXato && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] bg-red-50 border border-red-300 text-red-700 rounded p-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span>{seedXato}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
