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
//  qurilmadan) ma'lumot o'zgarsa — forma qayta yuklanadi.
//
//  Panel tagida BOSHLANG'ICH MA'LUMOT (seed) bloki: seed
//  to'plamini Firestore'ga yozadi (mavjud id lar ustiga).
// ============================================================
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Settings, ChevronDown, ChevronUp, Plus, Trash2, Save, RotateCcw,
  Database, Loader2, AlertTriangle, Check,
} from 'lucide-react';
import { Card, SectionTitle } from '../../components/ui.jsx';
import { fmt, genId, sonMatn } from '../../lib/helpers.js';
import { turTaxmin, son } from '../../lib/omborHisob.js';
import { seedToplam, ZAVODLAR, TURLAR } from '../../lib/omborSeed.js';

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
function KgGuruh({ nom, izoh, qatorlar, dubl, canEdit, onQator, onQosh, onOchir }) {
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

      {qatorlar.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center mb-1.5">
          <input inputMode="decimal" value={r.q} disabled={!canEdit} placeholder="0.40"
            onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) onQator(r.id, { q: s }); }}
            onFocus={(e) => e.target.select()} onWheel={(e) => e.target.blur()}
            className={`w-full px-2 py-1.5 border rounded bg-white tabular-nums disabled:bg-slate-100 disabled:text-slate-400 ${dubl.has(r.id) ? 'border-red-400' : 'border-slate-300'}`} />
          <input inputMode="decimal" value={r.v} disabled={!canEdit} placeholder="0"
            onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) onQator(r.id, { v: s }); }}
            onFocus={(e) => e.target.select()} onWheel={(e) => e.target.blur()}
            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums disabled:bg-slate-100 disabled:text-slate-400" />
          <button type="button" onClick={() => onOchir(r.id)} disabled={!canEdit} title="Qatorni o'chirish"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 disabled:opacity-30">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

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
export function OmborSozlama({
  sozlama = {}, updateSozlama, rangTur = {}, updateRangTur,
  canEdit = true, showToast, onSeed,
}) {
  const [ochiq, setOchiq] = useState(false);            // standart holat — YOPIQ
  const [sinov, setSinov] = useState('');               // rang → tur jonli sinovi
  const [seedIsh, setSeedIsh] = useState('');           // qaysi seed tugmasi ishlayapti
  const [seedNatija, setSeedNatija] = useState('');
  const [seedXato, setSeedXato] = useState('');

  // Proplardan yasalgan "asl" holat (saqlanganiga teng)
  const asl = useMemo(() => formaYasa(sozlama), [sozlama]);
  const aslRT = useMemo(() => rtYasa(rangTur), [rangTur]);

  const [forma, setForma] = useState(asl);
  const [rt, setRt] = useState(aslRT);

  // Tashqaridan (Firestore'dan) ma'lumot o'zgarsa — formani qayta yuklaymiz.
  // Taqqoslash MATN bo'yicha: prop obyekti har renderda yangi bo'lsa ham
  // mazmuni o'zgarmagan bo'lsa forma qayta yuklanmaydi.
  const aslMatn = solish(asl, aslRT);
  const oldingiRef = useRef(aslMatn);
  useEffect(() => {
    if (oldingiRef.current === aslMatn) return;
    oldingiRef.current = aslMatn;
    setForma(asl);
    setRt(aslRT);
  }, [aslMatn]); // eslint-disable-line react-hooks/exhaustive-deps

  const ozgargan = solish(forma, rt) !== aslMatn;

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

  // ----- Rang → tur qoidalari -----
  const qoidaTahrir = (id, patch) => setRt((r) => ({
    ...r, qoidalar: r.qoidalar.map((q) => (q.id === id ? { ...q, ...patch } : q)),
  }));
  const qoidaQosh = () => setRt((r) => ({
    ...r, qoidalar: [...r.qoidalar, { id: genId(), naqsh: '', tur: r.standart || TURLAR[0] || '' }],
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
    TURLAR.forEach(qosh);
    rt.qoidalar.forEach((q) => qosh(q.tur));
    qosh(rt.standart);
    return out;
  }, [rt]);

  // ----- Tekshiruvlar -----
  const b1 = son(forma.bolizvchi1);
  const b2 = son(forma.bolizvchi2);
  const b1Xato = !(b1 != null && b1 > 0) ? "0 dan katta bo'lishi kerak" : '';
  const b2Xato = !(b2 != null && b2 > 0) ? "0 dan katta bo'lishi kerak" : '';
  const dublSMZ = useMemo(() => dublikatlar(forma.kg.SMZ), [forma.kg.SMZ]);
  const dublBoshqa = useMemo(() => dublikatlar(forma.kg.BOSHQA), [forma.kg.BOSHQA]);
  const dublBor = dublSMZ.size > 0 || dublBoshqa.size > 0;
  const xatoBor = !!b1Xato || !!b2Xato || dublBor;

  // Ustama foizi: 1 m tannarx ÷ b → +X %
  const foizMatn = (b) => (b != null && b > 0
    ? `1 m tannarx ÷ ${b} → ${((1 / b - 1) * 100) >= 0 ? '+' : ''}${((1 / b - 1) * 100).toFixed(1)} %`
    : '');

  // Kurs o'zgarganda kursSana bugungi kunga yangilanadi
  const kursOzgardi = son(forma.kurs) !== son(sozlama.kurs);

  // ----- Saqlash / bekor qilish -----
  function saqla() {
    if (!canEdit || xatoBor || !ozgargan) return;
    const yangi = {
      ...sozlama, // notanish maydonlar yo'qolmasin
      kurs: son(forma.kurs) ?? 0,
      ustama: son(forma.ustama) ?? 0,
      bolizvchi1: b1,
      bolizvchi2: b2,
      nom1: forma.nom1.trim(),
      nom2: forma.nom2.trim(),
      koefSMZ: son(forma.koefSMZ) ?? 0,
      koefBoshqa: son(forma.koefBoshqa) ?? 0,
      kgPerM: { SMZ: kgObyekt(forma.kg.SMZ), BOSHQA: kgObyekt(forma.kg.BOSHQA) },
      kursSana: kursOzgardi ? bugun() : (sozlama.kursSana || ''),
    };
    if (updateSozlama) updateSozlama(yangi);
    if (updateRangTur) {
      updateRangTur({
        qoidalar: rt.qoidalar
          .map((q) => ({ naqsh: (q.naqsh || '').trim(), tur: q.tur || '' }))
          .filter((q) => q.naqsh),
        standart: rt.standart || '',
      });
    }
    if (showToast) showToast('Sozlama saqlandi');
  }

  function bekor() {
    setForma(asl);
    setRt(aslRT);
  }

  // ----- Boshlang'ich ma'lumot (seed) -----
  // Seed to'plami faqat NECHTA hujjat yozilishini ko'rsatish uchun o'qiladi —
  // undagi raqamlar hisob-kitobda ishlatilmaydi.
  const toplam = useMemo(() => seedToplam(), []);
  const xujjatSoni = useMemo(() => ({
    'ombor-narxlar': Object.keys(toplam['ombor-narxlar'] || {}).length,
    'ombor-rulonlar': Object.keys(toplam['ombor-rulonlar'] || {}).length,
    'ombor-sozlama': 1,
    'ombor-rang-tur': 1,
  }), [toplam]);

  const SEED_TUGMALAR = [
    { k: 'hammasi', label: 'Hammasi', kalitlar: ['ombor-sozlama', 'ombor-rang-tur', 'ombor-narxlar', 'ombor-rulonlar'] },
    { k: 'narxlar', label: "Narx ro'yxati", kalitlar: ['ombor-narxlar'] },
    { k: 'rulonlar', label: 'Rulonlar', kalitlar: ['ombor-rulonlar'] },
    { k: 'sozlama', label: 'Sozlama', kalitlar: ['ombor-sozlama', 'ombor-rang-tur'] },
  ];

  async function seedBos(t) {
    if (!canEdit || !onSeed || seedIsh) return;
    const royxat = t.kalitlar.map((k) => `  • ${k} — ${xujjatSoni[k] || 0} ta`).join('\n');
    const savol = `Boshlang'ich ma'lumot yoziladi:\n${royxat}\n\n`
      + "DIQQAT: bir xil id li MAVJUD yozuvlar USTIGA yoziladi (o'zgartirganlaringiz yo'qoladi).\nDavom etamizmi?";
    if (!window.confirm(savol)) return;
    setSeedIsh(t.k); setSeedNatija(''); setSeedXato('');
    try {
      const natija = await onSeed(t.k);
      const qatorlar = Object.entries(natija || {}).map(([k, v]) => `${k} ${v} ta`);
      const matn = qatorlar.length ? `Yozildi: ${qatorlar.join(', ')}` : 'Yozildi';
      // Prompt talabi: konsolda nechta hujjat yozilgani ko'rinsin
      console.log(`[ombor seed] ${t.k} → ${matn}`, natija);
      setSeedNatija(matn);
      if (showToast) showToast(matn);
    } catch (e) {
      console.error('[ombor seed] xato:', e);
      setSeedXato(`Xato: ${(e && e.message) || e}`);
    } finally {
      setSeedIsh('');
    }
  }

  // BOSHQA guruhga kiradigan zavodlar (SMZ dan qolganlari) — eslatma uchun
  const boshqaZavodlar = ZAVODLAR.filter((z) => !/smz/i.test(z)).join(', ');

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
        {ozgargan && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold whitespace-nowrap">
            Saqlanmagan o'zgarishlar
          </span>
        )}
        <span className="text-slate-400 flex-shrink-0">
          {ochiq ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </span>
      </button>

      {ochiq && (
        <div className="space-y-4">
          {/* ----- 1) Asosiy qiymatlar ----- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SonMaydon
              label="Dollar kursi (so'm)" value={forma.kurs} disabled={!canEdit}
              onChange={(v) => tahrir({ kurs: v })}
              hint={`Oxirgi o'zgartirilgan: ${sozlama.kursSana || '—'}${kursOzgardi ? ` → ${bugun()}` : ''}`} />

            <SonMaydon
              label="Ustama ($/tonna)" value={forma.ustama} disabled={!canEdit}
              onChange={(v) => tahrir({ ustama: v })}
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
              onChange={(v) => tahrir({ koefSMZ: v })}
              hint="Jadvalda yo'q qalinlik uchun" />

            <SonMaydon
              label="BOSHQA koeffitsienti" value={forma.koefBoshqa} disabled={!canEdit}
              onChange={(v) => tahrir({ koefBoshqa: v })}
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
                nom="SMZ" izoh="faqat SMZ zavodi" qatorlar={forma.kg.SMZ} dubl={dublSMZ} canEdit={canEdit}
                onQator={(id, p) => kgTahrir('SMZ', id, p)}
                onQosh={() => kgQosh('SMZ')} onOchir={(id) => kgOchir('SMZ', id)} />
              <KgGuruh
                nom="BOSHQA" izoh={boshqaZavodlar} qatorlar={forma.kg.BOSHQA} dubl={dublBoshqa} canEdit={canEdit}
                onQator={(id, p) => kgTahrir('BOSHQA', id, p)}
                onQosh={() => kgQosh('BOSHQA')} onOchir={(id) => kgOchir('BOSHQA', id)} />
            </div>

            {dublBor && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] bg-red-50 border border-red-300 text-red-700 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>Bir xil qalinlik takrorlangan — qizil kataklarni tuzating (aks holda saqlab bo'lmaydi).</span>
              </div>
            )}
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
              <button type="button" onClick={saqla} disabled={!ozgargan || xatoBor}
                className="bg-slate-900 text-white rounded-lg px-3 py-2 font-medium text-sm flex items-center gap-1.5 disabled:opacity-40">
                <Save className="w-4 h-4" /> Saqlash
              </button>
            </div>
          )}

          {/* ----- 5) Boshlang'ich ma'lumot (seed) ----- */}
          {canEdit && (
            <div className="pt-2 border-t border-slate-100">
              <SectionTitle icon={Database}>Boshlang'ich ma'lumot</SectionTitle>
              <p className="text-[11px] text-slate-500 -mt-2 mb-2">
                Tayyor ro'yxatlarni Firestore'ga yozadi. Bir xil id li mavjud yozuvlar
                ustiga yoziladi, qo'lda kiritilgan boshqa yozuvlarga tegmaydi.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEED_TUGMALAR.map((t) => (
                  <button key={t.k} type="button" onClick={() => seedBos(t)} disabled={!!seedIsh || !onSeed}
                    className="py-2 px-2 rounded-lg border-2 border-slate-200 bg-white text-slate-700 font-medium text-xs flex items-center justify-center gap-1.5 disabled:opacity-40">
                    {seedIsh === t.k
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Database className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </div>

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
