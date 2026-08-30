// ============================================================
//  OMBOR → MATERIALLAR
// ------------------------------------------------------------
//  Material qo'shish/tahrirlash, kirim-chiqim va qoldiqni yuritish.
//  Element: { id, nomi, birlik, qoldiq, minQoldiq, tanNarx,
//             bogla: null|{kind,id}, rang, izoh, ochirilgan? }
//  Har bir kirim/chiqim 'ombor-harakat' ga yozuv qoldiradi.
// ============================================================
import React, { useState, useMemo } from 'react';
import { Plus, Minus, Trash2, Edit3, Boxes, Link2, AlertTriangle } from 'lucide-react';
import { Card, SectionTitle, RangTanla, RangBadge, SmallModal, SegmentedControl } from '../../components/ui.jsx';
import { fmt, genId, rangGuruhlari } from '../../lib/helpers.js';
import { OMBOR_BIRLIKLAR, omborRoyxat, omborBogliq, birlikBelgisi } from '../../lib/ombor.js';

const BLANK = {
  nomi: '', birlik: 'metr', qoldiq: '', minQoldiq: '', tanNarx: '',
  rang: '', izoh: '', boglaKind: '', boglaId: '',
};

// Loyiha qoidasi: vergul ham, nuqta ham qabul qilinadi.
// Faqat son ko'rinishidagi matn kiritilishiga ruxsat beramiz ('' ham mumkin).
const sonMatn = (v) => {
  const s = String(v == null ? '' : v).replace(/,/g, '.');
  return /^\d*\.?\d*$/.test(s) ? s : null;
};
const son = (v) => parseFloat(String(v == null ? '' : v).replace(/,/g, '.')) || 0;
// Kasrli qoldiqni jurnal izohida ko'rsatish uchun (fmt butunga yaxlitlaydi)
const sonKor = (n) => String(Math.round((Number(n) || 0) * 1000) / 1000);

// Birlik tanlash uchun SegmentedControl variantlari
const BIRLIK_OPT = OMBOR_BIRLIKLAR.map((b) => ({ value: b, label: b }));

// Katalogga bog'lash uchun guruh nomlari
const BOGLA_GURUH = [
  { kind: 'tunika',    label: 'List (tunika)' },
  { kind: 'metrli',    label: 'Metrli tovar' },
  { kind: 'aksessuar', label: 'Aksessuar' },
  { kind: 'kazirok',   label: 'Kazirok' },
];

// ----- Katalogga bog'lash bloki (qo'shish va tahrirlashda bir xil) -----
//  ozId — tahrirlanayotgan materialning o'z id si (o'zini "band" deb sanamaslik uchun).
function BoglaBlok({ f, set, ctx, ozId = '' }) {
  const royxat = f.boglaKind === 'tunika' ? ctx.tunikaBaza
    : f.boglaKind === 'metrli' ? ctx.metrlilar
    : f.boglaKind === 'aksessuar' ? ctx.aksessuarlar
    : f.boglaKind === 'kazirok' ? ctx.kaziroklar
    : [];
  // Bitta katalog elementiga ikki material bog'lansa — zakas saqlanganda
  // IKKALASIDAN ham yechiladi (ikki barobar chiqim). Shuning uchun ogohlantiramiz.
  const band = (f.boglaKind && f.boglaId)
    ? omborRoyxat(ctx.ombor).find((m) => m.id !== ozId && m.bogla
        && m.bogla.kind === f.boglaKind && m.bogla.id === f.boglaId)
    : null;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-slate-500 mb-1">Katalogga bog'lash</label>
          <select value={f.boglaKind} onChange={(e) => set({ ...f, boglaKind: e.target.value, boglaId: '' })}
            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white">
            <option value="">Bog'lanmagan</option>
            {BOGLA_GURUH.map((g) => <option key={g.kind} value={g.kind}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-500 mb-1">Element</label>
          <select value={f.boglaId} disabled={!f.boglaKind} onChange={(e) => set({ ...f, boglaId: e.target.value })}
            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white disabled:bg-slate-100 disabled:text-slate-400">
            <option value="">— tanlang —</option>
            {royxat.map((x) => <option key={x.id} value={x.id}>{x.nomi}</option>)}
          </select>
        </div>
      </div>
      {band && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] bg-amber-50 border border-amber-300 text-amber-800 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          <span>Bu element <b>{band.nomi}</b> materialiga ham bog'langan — zakasda ikkalasidan ham chiqim bo'ladi.</span>
        </div>
      )}
    </div>
  );
}

// ----- Kirim / Chiqim oynasi -----
function AmalModal({ mat, turi, onClose, onSave }) {
  const [miqdor, setMiqdor] = useState('');
  const [narx, setNarx] = useState(turi === 'kirim' ? String(Math.round(Number(mat.tanNarx) || 0) || '') : '');
  const [izoh, setIzoh] = useState('');

  const m = son(miqdor);
  const p = son(narx);
  const eski = Number(mat.qoldiq) || 0;
  const yangiQoldiq = turi === 'kirim' ? eski + m : Math.max(0, eski - m);
  const yetmaydi = turi === 'chiqim' && m > eski;
  const birlik = birlikBelgisi(mat.birlik);

  // Kirimda tan narx o'rtacha og'irlikli yangilanadi (faqat narx berilgan bo'lsa)
  const yangiTanNarx = (turi === 'kirim' && p > 0 && (eski + m) > 0)
    ? Math.round((eski * (Number(mat.tanNarx) || 0) + m * p) / (eski + m))
    : (Number(mat.tanNarx) || 0);

  return (
    <SmallModal onClose={onClose} title={`${turi === 'kirim' ? 'Kirim' : 'Chiqim'} — ${mat.nomi}`}>
      <div className="space-y-3 text-sm">
        <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex justify-between">
          <span className="text-slate-500">Hozirgi qoldiq</span>
          <b className="tabular-nums text-slate-900">{fmt(eski)} {birlik}</b>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Miqdor ({birlik}) *</label>
          <input inputMode="decimal" value={miqdor} autoFocus
            onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setMiqdor(s); }}
            onFocus={(e) => e.target.select()} placeholder="0"
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white tabular-nums focus:border-slate-900 outline-none" />
        </div>

        {turi === 'kirim' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">1 {birlik} tan narxi (so'm)</label>
            <input inputMode="decimal" value={narx}
              onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setNarx(s); }}
              onFocus={(e) => e.target.select()} placeholder="0"
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white tabular-nums focus:border-slate-900 outline-none" />
            {m > 0 && p > 0 && (
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                O'rtacha tan narx: {fmt(mat.tanNarx)} → <b className="text-slate-900">{fmt(yangiTanNarx)}</b> so'm
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-500 mb-1">Izoh</label>
          <input value={izoh} onChange={(e) => setIzoh(e.target.value)}
            placeholder={turi === 'kirim' ? 'Kimdan olindi, hujjat...' : 'Nimaga sarflandi...'}
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg bg-white focus:border-slate-900 outline-none" />
        </div>

        {yetmaydi && (
          <div className="flex items-start gap-2 text-xs bg-red-50 border-2 border-red-200 text-red-700 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Omborda yetarli qoldiq yo'q: bor-yo'g'i <b className="tabular-nums">{fmt(eski)} {birlik}</b>. Qoldiq 0 ga tushadi.</span>
          </div>
        )}

        {m > 0 && (
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex justify-between">
            <span className="text-slate-500">Yangi qoldiq</span>
            <b className="tabular-nums text-slate-900">{fmt(yangiQoldiq)} {birlik}</b>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 rounded-lg bg-white font-medium">Bekor</button>
          <button onClick={() => { if (m > 0) onSave({ miqdor: m, narx: p, izoh: izoh.trim(), yangiQoldiq, yangiTanNarx }); }}
            disabled={!(m > 0)}
            className={`flex-1 py-2.5 rounded-lg font-medium text-white disabled:opacity-40 ${turi === 'kirim' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
            {turi === 'kirim' ? 'Kirim qilish' : 'Chiqim qilish'}
          </button>
        </div>
      </div>
    </SmallModal>
  );
}

export function Materiallar({
  ombor = {}, setOmborItem, setHarakat,
  tunikaBaza = [], metrlilar = [], aksessuarlar = [], kaziroklar = [],
  ranglar = [], currentUser, canEdit = true, showToast,
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [amal, setAmal] = useState(null); // { mat, turi }

  const toast = (t) => { if (showToast) showToast(t); };
  const rangGuruh = useMemo(() => rangGuruhlari(ranglar), [ranglar]);
  const royxat = useMemo(() => omborRoyxat(ombor), [ombor]);
  // ombor ham ctx ichida — BoglaBlok takroriy bog'lanishni shu orqali topadi
  const ctx = { tunikaBaza, metrlilar, aksessuarlar, kaziroklar, ombor };

  // Formadagi qiymatlardan material obyektini yig'ish
  function formdanMaterial(f, id) {
    return {
      id,
      nomi: f.nomi.trim(),
      birlik: f.birlik || 'metr',
      qoldiq: son(f.qoldiq),
      minQoldiq: son(f.minQoldiq),
      tanNarx: Math.round(son(f.tanNarx)),
      bogla: (f.boglaKind && f.boglaId) ? { kind: f.boglaKind, id: f.boglaId } : null,
      rang: f.rang || '',
      izoh: (f.izoh || '').trim(),
    };
  }

  function addNew() {
    if (!form.nomi.trim()) { toast('Nom kiriting'); return; }
    const id = genId();
    const mat = formdanMaterial(form, id);
    setOmborItem(id, mat);
    // Boshlang'ich qoldiq bo'lsa — tarixga "tuzatish" yozuvi qoldiramiz
    if (mat.qoldiq > 0) {
      const hid = genId();
      setHarakat(hid, {
        id: hid, ts: new Date().toISOString(), turi: 'tuzatish', omborId: id,
        miqdor: mat.qoldiq, narx: mat.tanNarx, izoh: "Boshlang'ich qoldiq",
        userLogin: (currentUser && currentUser.login) || '—',
      });
    }
    setForm(BLANK); setAdding(false);
    toast("Material qo'shildi");
  }

  function startEdit(m) {
    setEditForm({
      nomi: m.nomi || '', birlik: m.birlik || 'metr',
      qoldiq: String(m.qoldiq ?? ''), minQoldiq: String(m.minQoldiq ?? ''),
      tanNarx: String(m.tanNarx ?? ''), rang: m.rang || '', izoh: m.izoh || '',
      boglaKind: (m.bogla && m.bogla.kind) || '', boglaId: (m.bogla && m.bogla.id) || '',
    });
    setEditingId(m.id);
    setAdding(false);
  }

  function saveEdit(m) {
    if (!editForm.nomi.trim()) { toast('Nom kiriting'); return; }
    const yangi = formdanMaterial(editForm, m.id);
    setOmborItem(m.id, { ...m, ...yangi });
    // Qoldiq qo'lda o'zgartirilgan bo'lsa — jurnalda iz qolsin (kim, qachon, qancha).
    const eski = Number(m.qoldiq) || 0;
    const fark = Math.round((yangi.qoldiq - eski) * 1000) / 1000;
    if (fark !== 0) {
      const hid = genId();
      setHarakat(hid, {
        id: hid, ts: new Date().toISOString(), turi: 'tuzatish', omborId: m.id,
        miqdor: Math.abs(fark), narx: yangi.tanNarx,
        izoh: `Qo'lda tuzatish: ${sonKor(eski)} → ${sonKor(yangi.qoldiq)}`,
        userLogin: (currentUser && currentUser.login) || '—',
      });
    }
    setEditingId(null); setEditForm(null);
    toast('Saqlandi');
  }

  function remove(m) {
    if (!window.confirm(`"${m.nomi}" ombordan o'chirilsinmi?`)) return;
    setOmborItem(m.id, null);
    setEditingId(null); setEditForm(null);
    toast("O'chirildi");
  }

  // Kirim/Chiqim saqlash: harakat yozuvi + materialning yangi qoldig'i
  function amalSaqla({ miqdor, narx, izoh, yangiQoldiq, yangiTanNarx }) {
    const turi = amal.turi;
    // Oyna ochiq turganda boshqa qurilma materialni yangilagan bo'lishi mumkin —
    // eng so'nggi nusxaga yozamiz (izoh/bog'lanish yo'qolib ketmasin).
    const mat = ombor[amal.mat.id] || amal.mat;
    const hid = genId();
    setHarakat(hid, {
      id: hid, ts: new Date().toISOString(), turi, omborId: mat.id,
      miqdor,
      // Chiqimda narx so'ralmaydi — jurnalda qiymat ko'rinishi uchun tan narxni
      // yozamiz (zakas bo'yicha avtomatik chiqim ham shunday qiladi).
      narx: turi === 'kirim' ? (Math.round(narx) || 0) : (Math.round(Number(mat.tanNarx) || 0) || 0),
      izoh: izoh || '',
      userLogin: (currentUser && currentUser.login) || '—',
    });
    setOmborItem(mat.id, { ...mat, qoldiq: yangiQoldiq, tanNarx: yangiTanNarx });
    setAmal(null);
    toast(turi === 'kirim' ? 'Kirim qilindi' : 'Chiqim qilindi');
  }

  return (
    <Card>
      <SectionTitle icon={Boxes}>Ombor materiallari ({royxat.length})</SectionTitle>

      {canEdit && (adding ? (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">Nomi *</label>
            <input value={form.nomi} onChange={(e) => setForm({ ...form, nomi: e.target.value })}
              placeholder="masalan: Ko'k SMZ 0.45" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">Birlik</label>
            <SegmentedControl value={form.birlik} onChange={(v) => setForm({ ...form, birlik: v })} options={BIRLIK_OPT} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Qoldiq</label>
              <input inputMode="decimal" value={form.qoldiq}
                onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setForm({ ...form, qoldiq: s }); }}
                onFocus={(e) => e.target.select()}
                placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Min. qoldiq</label>
              <input inputMode="decimal" value={form.minQoldiq}
                onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setForm({ ...form, minQoldiq: s }); }}
                onFocus={(e) => e.target.select()}
                placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Tan narx</label>
              <input inputMode="decimal" value={form.tanNarx}
                onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setForm({ ...form, tanNarx: s }); }}
                onFocus={(e) => e.target.select()}
                placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
          </div>
          <BoglaBlok f={form} set={setForm} ctx={ctx} />
          <div>
            <label className="block text-slate-500 mb-1">Izoh</label>
            <input value={form.izoh} onChange={(e) => setForm({ ...form, izoh: e.target.value })}
              placeholder="ixtiyoriy" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
          </div>
          <RangTanla value={form.rang} onPick={(r) => setForm({ ...form, rang: r })} groups={rangGuruh} />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm(BLANK); }} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
            <button onClick={addNew} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setForm(BLANK); setAdding(true); setEditingId(null); }}
          className="w-full mb-3 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Yangi material qo'shish
        </button>
      ))}

      <div className="space-y-2">
        {royxat.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Omborda material yo'q</p>
          </div>
        ) : royxat.map((m) => {
          const min = Number(m.minQoldiq) || 0;
          const kam = min > 0 && (Number(m.qoldiq) || 0) <= min;
          const bogliqNom = omborBogliq(m, ctx);
          const birlik = birlikBelgisi(m.birlik);
          return (
            <div key={m.id} className={`rounded-xl overflow-hidden text-xs bg-white border-2 ${kam ? 'border-amber-400' : 'border-slate-200'}`}>
              {editingId === m.id && editForm ? (
                <div className="p-3 bg-slate-50 space-y-2">
                  <input value={editForm.nomi} onChange={(e) => setEditForm({ ...editForm, nomi: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
                  <SegmentedControl value={editForm.birlik} onChange={(v) => setEditForm({ ...editForm, birlik: v })} options={BIRLIK_OPT} />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-500 mb-1">Qoldiq</label>
                      <input inputMode="decimal" value={editForm.qoldiq}
                        onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setEditForm({ ...editForm, qoldiq: s }); }}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Min. qoldiq</label>
                      <input inputMode="decimal" value={editForm.minQoldiq}
                        onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setEditForm({ ...editForm, minQoldiq: s }); }}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1">Tan narx</label>
                      <input inputMode="decimal" value={editForm.tanNarx}
                        onChange={(e) => { const s = sonMatn(e.target.value); if (s !== null) setEditForm({ ...editForm, tanNarx: s }); }}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
                    </div>
                  </div>
                  <BoglaBlok f={editForm} set={setEditForm} ctx={ctx} ozId={m.id} />
                  <div>
                    <label className="block text-slate-500 mb-1">Izoh</label>
                    <input value={editForm.izoh} onChange={(e) => setEditForm({ ...editForm, izoh: e.target.value })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
                  </div>
                  <RangTanla value={editForm.rang} onPick={(r) => setEditForm({ ...editForm, rang: r })} groups={rangGuruh} />
                  <div className="flex gap-2">
                    <button onClick={() => remove(m)} className="py-1.5 px-3 border-2 border-red-200 text-red-700 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { setEditingId(null); setEditForm(null); }} className="py-1.5 px-3 border-2 border-slate-200 rounded bg-white">Bekor</button>
                    <button onClick={() => saveEdit(m)} className="flex-1 py-1.5 bg-slate-900 text-white rounded">Tayyor</button>
                  </div>
                </div>
              ) : (
                <div className={`p-3 ${kam ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <RangBadge rang={m.rang} nomi={m.nomi} kind="tunika" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <b className="text-sm text-slate-900 truncate">{m.nomi}</b>
                        {kam && <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">Kam qoldi</span>}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        {min > 0 ? `Min: ${fmt(min)} ${birlik}` : 'Min belgilanmagan'}
                        {' · '}Tan narx: <span className="tabular-nums">{fmt(m.tanNarx)}</span> so'm
                      </div>
                      {bogliqNom && (
                        <div className="text-slate-400 text-[10px] flex items-center gap-1 mt-0.5">
                          <Link2 className="w-3 h-3" /> {bogliqNom}
                        </div>
                      )}
                      {m.izoh && <div className="text-slate-400 text-[10px] truncate mt-0.5">{m.izoh}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-lg font-bold tabular-nums leading-tight ${kam ? 'text-amber-700' : 'text-slate-900'}`}>{fmt(m.qoldiq)}</div>
                      <div className="text-[10px] text-slate-400">{birlik}</div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex gap-1.5 mt-2.5">
                      <button onClick={() => setAmal({ mat: m, turi: 'kirim' })}
                        className="flex-1 py-1.5 rounded-lg border-2 border-emerald-200 text-emerald-700 bg-white font-medium flex items-center justify-center gap-1 hover:bg-emerald-50">
                        <Plus className="w-3.5 h-3.5" /> Kirim
                      </button>
                      <button onClick={() => setAmal({ mat: m, turi: 'chiqim' })}
                        className="flex-1 py-1.5 rounded-lg border-2 border-amber-200 text-amber-700 bg-white font-medium flex items-center justify-center gap-1 hover:bg-amber-50">
                        <Minus className="w-3.5 h-3.5" /> Chiqim
                      </button>
                      <button onClick={() => startEdit(m)} title="Tahrirlash"
                        className="px-2.5 py-1.5 rounded-lg border-2 border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(m)} title="O'chirish"
                        className="px-2.5 py-1.5 rounded-lg border-2 border-red-200 text-red-600 bg-white hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {amal && (
        <AmalModal mat={ombor[amal.mat.id] || amal.mat} turi={amal.turi}
          onClose={() => setAmal(null)} onSave={amalSaqla} />
      )}
    </Card>
  );
}
