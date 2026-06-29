// ============================================================
//  NARXLAR → KAZIROKLAR
// ------------------------------------------------------------
//  Ikki qism:
//   1) KAZIROK TURLARI (fasonlar) — masalan "Qosh 90 gradus". Turga
//      kirilganda Patalok va Paloska detallari har biri JONLI CHIZMASI,
//      chizilish/hisoblash mantig'i va list metridan hisoblangan narxi
//      bilan ko'rinadi. Foyda foizi (%) — o'zgartirsa bo'ladigan parametr.
//   2) Oddiy KAZIROKLAR narx ro'yxati (nomi/narx/birlik/rang) — eski xulq.
//  Geometriya/hisob: src/lib/kazirokGeom.js (savdo Chizma engine bilan bir xil).
// ============================================================
import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Triangle, Edit3, Copy, ChevronRight, ArrowLeft, Ruler } from 'lucide-react';
import { Card, SectionTitle, RangTanla, RangBadge } from '../../components/ui.jsx';
import { genId, fmt, rangGuruhlari } from '../../lib/helpers.js';
import { KAZ_DETS, kazSvg, kazItemCalc, cornerSvg, cornerItemCalc, QOZ_RAZ0, QOZ_PESH0 } from '../../lib/kazirokGeom.js';

// Detal turi sarlavhasi (KAZ_DETS faqat pat/pal; qoz alohida).
const KIND_TITLE = { pat: 'Patalok', pal: 'Paloska', qoz: 'Qozon (burchak)' };

export function KazirokTab({ kaziroklar, updateKaziroklar, kazTurlari = [], updateKazTurlari, ranglar = [], showToast }) {
  const [openTuriId, setOpenTuriId] = useState(null);
  const openTuri = kazTurlari.find((t) => t.id === openTuriId) || null;

  // Tur ichidagi o'zgarishni (foyda / pataloklar / paloskalar) saqlaydi.
  function patchTuri(id, patch) {
    if (!updateKazTurlari) return;
    updateKazTurlari(kazTurlari.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  if (openTuri) {
    return <TuriDetail turi={openTuri} onBack={() => setOpenTuriId(null)} onPatch={(p) => patchTuri(openTuri.id, p)} />;
  }

  return (
    <div className="space-y-4">
      <TurlarSection kazTurlari={kazTurlari} onOpen={setOpenTuriId} />
      <FlatKazirokList kaziroklar={kaziroklar} updateKaziroklar={updateKaziroklar} ranglar={ranglar} showToast={showToast} />
    </div>
  );
}

/* ============================================================
   1-QISM: Kazirok turlari ro'yxati (fasonlar)
   ============================================================ */
function TurlarSection({ kazTurlari, onOpen }) {
  return (
    <Card>
      <SectionTitle icon={Triangle}>Kazirok turlari ({kazTurlari.length})</SectionTitle>
      {kazTurlari.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">Tur mavjud emas</p>
      ) : (
        <div className="space-y-1.5">
          {kazTurlari.map((t) => {
            const np = (t.pataloklar || []).length, nl = (t.paloskalar || []).length, nq = (t.qozonlar || []).length;
            return (
              <button key={t.id} onClick={() => onOpen(t.id)}
                className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-white hover:border-slate-900 transition text-left">
                <span className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                  <Ruler className="w-4.5 h-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm text-slate-800 truncate">{t.nomi}</span>
                  <span className="block text-[11px] text-slate-500">
                    {np} patalok · {nl} paloska · {nq} qozon · foyda {Number(t.foyda) || 0}%
                  </span>
                </span>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-3">
        Turga bosing — pataloklar va paloskalar chizmasi, hisobi va narxi ochiladi.
        Hozircha bitta tur ("Qosh 90 gradus"); kelajakda boshqa fasonlar qo'shiladi.
      </p>
    </Card>
  );
}

/* ============================================================
   2-QISM: Tur batafsil — pataloklar + paloskalar + foyda %
   ============================================================ */
function TuriDetail({ turi, onBack, onPatch }) {
  const foyda = Number(turi.foyda) || 0;
  const KEY = { pat: 'pataloklar', pal: 'paloskalar', qoz: 'qozonlar' };
  const items = (kind) => turi[KEY[kind]] || [];

  const setItems = (kind, arr) => onPatch({ [KEY[kind]]: arr });
  const patchItem = (kind, id, p) => setItems(kind, items(kind).map((it) => (it.id === id ? { ...it, ...p } : it)));
  const removeItem = (kind, id) => setItems(kind, items(kind).filter((it) => it.id !== id));
  const dupItem = (kind, it) => {
    const arr = items(kind);
    const i = arr.findIndex((x) => x.id === it.id);
    const next = [...arr];
    next.splice(i + 1, 0, { ...it, id: genId() });
    setItems(kind, next);
  };
  function addItem(kind) {
    let base;
    if (kind === 'qoz') {
      base = { id: genId(), razX: QOZ_RAZ0, peshX: QOZ_PESH0, razY: QOZ_RAZ0, peshY: QOZ_PESH0, metrNarx: 0 };
    } else {
      const d = KAZ_DETS[kind].def;
      base = { id: genId(), eni: d.eni, peshona: d.peshona, razmeri: d.razmeri, metrNarx: 0 };
      if (kind === 'pat') base.fold = false;
    }
    setItems(kind, [...items(kind), base]);
  }

  return (
    <Card>
      {/* Sarlavha + orqaga */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex-1 min-w-0 truncate">{turi.nomi}</h2>
      </div>

      {/* Foyda foizi — umumiy parametr */}
      <div className="mb-4 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/50">
        <label className="block text-[11px] font-semibold text-emerald-800 mb-1.5">Foyda foizi (%)</label>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" value={turi.foyda ?? ''} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
            onChange={(e) => onPatch({ foyda: e.target.value })}
            className="w-28 px-2.5 py-2 border-2 border-emerald-200 rounded-lg bg-white tabular-nums text-sm outline-none focus:border-emerald-600 transition" />
          <span className="text-[11px] text-slate-500">
            Sotuv narxi = material × (1 + foyda%). Har detalga shu foiz qo'llanadi.
          </span>
        </div>
      </div>

      <KazDetGroup kind="pat" items={items('pat')} foyda={foyda}
        onAdd={() => addItem('pat')} onPatch={(id, p) => patchItem('pat', id, p)}
        onRemove={(id) => removeItem('pat', id)} onDup={(it) => dupItem('pat', it)} />
      <div className="h-4" />
      <KazDetGroup kind="pal" items={items('pal')} foyda={foyda}
        onAdd={() => addItem('pal')} onPatch={(id, p) => patchItem('pal', id, p)}
        onRemove={(id) => removeItem('pal', id)} onDup={(it) => dupItem('pal', it)} />
      <div className="h-4" />
      <KazDetGroup kind="qoz" items={items('qoz')} foyda={foyda}
        onAdd={() => addItem('qoz')} onPatch={(id, p) => patchItem('qoz', id, p)}
        onRemove={(id) => removeItem('qoz', id)} onDup={(it) => dupItem('qoz', it)} />
    </Card>
  );
}

// Patalok / Paloska / Qozon guruhi — har detal kartasi chizma + hisob + narx bilan.
function KazDetGroup({ kind, items, foyda, onAdd, onPatch, onRemove, onDup }) {
  const title = KIND_TITLE[kind];
  const titlePl = kind === 'qoz' ? 'Qozonlar (burchak)' : title + 'lar';
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{titlePl} ({items.length})</h3>
        <button onClick={onAdd} className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg px-2 py-1">
          <Plus className="w-3.5 h-3.5" /> Qo'shish
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-xl">Hali {title.toLowerCase()} qo'shilmagan</p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            kind === 'qoz'
              ? <KazQozCard key={it.id} it={it} foyda={foyda}
                  onPatch={(p) => onPatch(it.id, p)} onRemove={() => onRemove(it.id)} onDup={() => onDup(it)} />
              : <KazDetCard key={it.id} kind={kind} it={it} foyda={foyda}
                  onPatch={(p) => onPatch(it.id, p)} onRemove={() => onRemove(it.id)} onDup={() => onDup(it)} />
          ))}
        </div>
      )}
    </div>
  );
}

// Tahrirlanadigan o'lcham (sm) maydoni.
function NumField({ label, value, onChange, unit = 'sm' }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-slate-400 mb-0.5">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" inputMode="decimal" step="0.5" value={value ?? ''} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums text-xs outline-none focus:border-slate-900" />
        <span className="text-[10px] text-slate-400">{unit}</span>
      </div>
    </label>
  );
}

// Hisoblash mantig'i (bo'lak / 1 bo'lak / list metri) — uchala detalga umumiy.
// Qozon uchun qo'shimcha "Kontur" o'lchami (kraska konturi W×H) ham ko'rsatiladi.
function CalcFacts({ c, kind }) {
  return (
    <div className={`grid ${kind === 'qoz' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 text-[11px]`}>
      {kind === 'qoz' && <Fact label="Kontur (sm)" val={c.W.toFixed(1) + '×' + c.H.toFixed(1)} />}
      <Fact label="Bo'lak" val={c.bolak + ' ta'} />
      <Fact label="1 bo'lak" val={c.pieceM.toFixed(2) + ' m'} />
      <Fact label="List metri (1 dona)" val={c.listMetri.toFixed(3) + ' m'} />
    </div>
  );
}

// Hisoblash MANTIG'I (formulasi) ochiq matn bilan — detal turiga qarab.
function LogicNote({ kind, c }) {
  if (kind === 'qoz') {
    return (
      <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
        <b className="text-slate-600">Hisob:</b> Burchak qozon — kraska konturi{' '}
        <b className="tabular-nums">{c.W.toFixed(1)}×{c.H.toFixed(1)} sm</b> (razmeri + peshona + jiya, har tomon alohida).
        List eni 1.25 m bo'ylab {c.H.toFixed(1)} sm-dan <b>{c.bolak}</b> bo'lak chiqadi;
        bir bo'lak uzunligi {c.W.toFixed(1)} sm = {c.pieceM.toFixed(2)} m.
        1 dona uchun list metri = {c.pieceM.toFixed(2)} ÷ {c.bolak} ={' '}
        <b className="tabular-nums">{c.listMetri.toFixed(3)} m</b>. Material = list metri × 1 metr narxi; sotuv = material × (1 + foyda%).
      </p>
    );
  }
  return (
    <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
      <b className="text-slate-600">Hisob:</b> Bir bo'lak uzunligi (peshona + razmeri + jiya) ={' '}
      <b className="tabular-nums">{c.pieceLenCm.toFixed(1)} sm</b> = {c.pieceM.toFixed(2)} m.
      List eni 1.25 m-ga {c.eni != null ? (+c.eni).toFixed(2) + ' sm enli ' : ''}bo'lak sig'adi → <b>{c.bolak}</b> bo'lak.
      1 dona uchun list metri = {c.pieceM.toFixed(2)} ÷ {c.bolak} ={' '}
      <b className="tabular-nums">{c.listMetri.toFixed(3)} m</b>. Material = list metri × 1 metr narxi; sotuv = material × (1 + foyda%).
    </p>
  );
}

// Narx bloki: 1 metr narxi → material → sotuv (foyda bilan) — uchala detalga umumiy.
function PriceBlock({ metrNarx, onMetrNarx, material, foyda, sotuv }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-slate-100">
        <span className="text-[11px] text-slate-500 whitespace-nowrap">1 metr narxi</span>
        <input type="number" inputMode="decimal" value={metrNarx ?? ''} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
          onChange={(e) => onMetrNarx(e.target.value)}
          className="w-28 px-2 py-1.5 border-2 border-slate-200 rounded-lg bg-white tabular-nums text-xs outline-none focus:border-slate-900" />
        <span className="text-[11px] text-slate-400">so'm / m</span>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 bg-slate-50">
        <span className="text-[11px] text-slate-500">
          Material: <span className="tabular-nums font-medium text-slate-600">{fmt(material)}</span> so'm
          <span className="text-slate-400"> · +{foyda}%</span>
        </span>
        <span className="text-sm font-extrabold text-emerald-700 tabular-nums">{fmt(sotuv)} so'm</span>
      </div>
    </div>
  );
}

// Karta sarlavhasi (badge + nom + nusxa/o'chir) — uchala detalga umumiy.
function CardHead({ badge, badgeBg, title, sub, onDup, onRemove }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${badgeBg}`}>{badge}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-800">{title}</span>
        <span className="block text-[10px] text-slate-400 tabular-nums">{sub}</span>
      </span>
      <button title="Nusxalash" onClick={onDup} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
      <button title="O'chirish" onClick={onRemove} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

function Drawing({ svg }) {
  return (
    <div className="bg-slate-50/70 border-b border-slate-100 p-2 flex justify-center text-slate-700 max-h-[280px] overflow-auto"
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// Patalok / Paloska kartasi — jonli chizma, eni/peshona/razmeri, hisob, narx.
function KazDetCard({ kind, it, foyda, onPatch, onRemove, onDup }) {
  const c = kazItemCalc(kind, it);                 // bolak / pieceLenCm / listMetri (clamp qilingan)
  const metrNarx = Number(it.metrNarx) || 0;
  const material = c.listMetri * metrNarx;         // 1 dona material qiymati
  const sotuv = material * (1 + foyda / 100);      // 1 dona sotuv narxi (foyda bilan)
  const svg = kazSvg(kind, c.eni, c.peshona, c.razmeri, c.fold);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <CardHead badge={c.bolak} badgeBg={kind === 'pat' ? 'bg-emerald-600' : 'bg-sky-600'}
        title={KIND_TITLE[kind]} sub={`${c.bolak} bo'lak · eni ${(+c.eni).toFixed(2)} sm`}
        onDup={onDup} onRemove={onRemove} />
      <Drawing svg={svg} />
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Eni" value={it.eni} onChange={(v) => onPatch({ eni: v })} />
          <NumField label="Peshona" value={it.peshona} onChange={(v) => onPatch({ peshona: v })} />
          <NumField label="Razmeri" value={it.razmeri} onChange={(v) => onPatch({ razmeri: v })} />
        </div>
        {KAZ_DETS[kind].foldable && (
          <button type="button" onClick={() => onPatch({ fold: !it.fold })}
            className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${it.fold ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            <span className={`w-3.5 h-3.5 rounded-sm border ${it.fold ? 'bg-white border-white' : 'border-slate-400'}`} />
            Orqasi qayrilgan
          </button>
        )}
        <CalcFacts c={c} kind={kind} />
        <LogicNote kind={kind} c={c} />
        <PriceBlock metrNarx={it.metrNarx} onMetrNarx={(v) => onPatch({ metrNarx: v })} material={material} foyda={foyda} sotuv={sotuv} />
      </div>
    </div>
  );
}

// Qozon (burchak) kartasi — har tomon alohida razmeri/peshona (tepa = X, chap = Y).
function KazQozCard({ it, foyda, onPatch, onRemove, onDup }) {
  const c = cornerItemCalc(it);
  const metrNarx = Number(it.metrNarx) || 0;
  const material = c.listMetri * metrNarx;
  const sotuv = material * (1 + foyda / 100);
  const svg = cornerSvg(c.razX, c.peshX, c.razY, c.peshY);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <CardHead badge={c.bolak} badgeBg="bg-amber-600"
        title="Qozon (burchak)" sub={`razmeri ${(+c.razX).toFixed(1)} × ${(+c.razY).toFixed(1)} sm`}
        onDup={onDup} onRemove={onRemove} />
      <Drawing svg={svg} />
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <NumField label="Razmeri (tepa)" value={it.razX} onChange={(v) => onPatch({ razX: v })} />
          <NumField label="Peshona (tepa)" value={it.peshX} onChange={(v) => onPatch({ peshX: v })} />
          <NumField label="Razmeri (chap)" value={it.razY} onChange={(v) => onPatch({ razY: v })} />
          <NumField label="Peshona (chap)" value={it.peshY} onChange={(v) => onPatch({ peshY: v })} />
        </div>
        <CalcFacts c={c} kind="qoz" />
        <LogicNote kind="qoz" c={c} />
        <PriceBlock metrNarx={it.metrNarx} onMetrNarx={(v) => onPatch({ metrNarx: v })} material={material} foyda={foyda} sotuv={sotuv} />
      </div>
    </div>
  );
}

function Fact({ label, val }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
      <div className="text-[10px] text-slate-400 leading-tight">{label}</div>
      <div className="text-xs font-semibold text-slate-700 tabular-nums leading-tight">{val}</div>
    </div>
  );
}

/* ============================================================
   3-QISM: Oddiy kaziroklar narx ro'yxati (eski xulq, o'zgarmagan)
   ============================================================ */
function FlatKazirokList({ kaziroklar, updateKaziroklar, ranglar = [], showToast }) {
  const rangGuruh = rangGuruhlari(ranglar);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nomi: '', narx: '', birlik: 'dona', rang: '' });

  function setNarx(id, val) {
    updateKaziroklar(kaziroklar.map((k) => (k.id === id ? { ...k, narx: parseFloat(val) || 0 } : k)));
  }
  function patch(id, p) {
    updateKaziroklar(kaziroklar.map((k) => (k.id === id ? { ...k, ...p } : k)));
  }

  function move(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= kaziroklar.length) return;
    const next = [...kaziroklar];
    [next[index], next[j]] = [next[j], next[index]];
    updateKaziroklar(next);
  }

  function addNew() {
    if (!form.nomi.trim()) { showToast('Nom kiriting'); return; }
    updateKaziroklar([...kaziroklar, { id: genId(), nomi: form.nomi.trim(), narx: parseFloat(form.narx) || 0, birlik: form.birlik, rang: form.rang || '' }]);
    setForm({ nomi: '', narx: '', birlik: 'dona', rang: '' });
    setAdding(false);
    showToast("Kazirok qo'shildi");
  }

  function remove(id) {
    updateKaziroklar(kaziroklar.filter((k) => k.id !== id));
    showToast("O'chirildi");
  }

  function nusxa(k) {
    const idx = kaziroklar.findIndex((x) => x.id === k.id);
    const yangi = { ...k, id: genId(), nomi: `${k.nomi} (nusxa)` };
    const next = [...kaziroklar];
    next.splice(idx + 1, 0, yangi);
    updateKaziroklar(next);
    showToast('Nusxalandi');
  }

  return (
    <Card>
      <SectionTitle icon={Triangle}>Kaziroklar narxi ({kaziroklar.length})</SectionTitle>

      {adding ? (
        <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Nomi *</label>
              <input value={form.nomi} onChange={(e) => setForm({ ...form, nomi: e.target.value })} placeholder="Kazirok nomi" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Narx (so'm)</label>
              <input type="number" value={form.narx} onWheel={(e) => e.target.blur()} onChange={(e) => setForm({ ...form, narx: e.target.value })} placeholder="0" className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Birlik</label>
              <select value={form.birlik} onChange={(e) => setForm({ ...form, birlik: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white">
                <option value="dona">dona</option>
                <option value="kg">kg</option>
                <option value="metr">metr</option>
              </select>
            </div>
          </div>
          <RangTanla value={form.rang} onPick={(r) => setForm({ ...form, rang: r })} groups={rangGuruh} />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setForm({ nomi: '', narx: '', birlik: 'dona', rang: '' }); }} className="flex-1 py-2 border-2 border-slate-200 rounded-lg bg-white">Bekor</button>
            <button onClick={addNew} className="flex-1 py-2 bg-slate-900 text-white rounded-lg">Saqlash</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full mb-3 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Yangi kazirok qo'shish
        </button>
      )}

      <div className="space-y-1.5">
        {kaziroklar.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Kaziroklar mavjud emas</p>
        ) : kaziroklar.map((k, idx) => (
          <div key={k.id} className="p-2.5 border border-slate-200 rounded-xl bg-white text-sm">
            {editingId === k.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Nomi</label>
                    <input value={k.nomi} onChange={(e) => patch(k.id, { nomi: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Narx (so'm)</label>
                    <input type="number" value={k.narx} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                      onChange={(e) => setNarx(k.id, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white tabular-nums" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Birlik</label>
                    <select value={k.birlik || 'dona'} onChange={(e) => patch(k.id, { birlik: e.target.value })} className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white">
                      <option value="dona">dona</option>
                      <option value="kg">kg</option>
                      <option value="metr">metr</option>
                    </select>
                  </div>
                </div>
                <RangTanla value={k.rang || ''} onPick={(r) => patch(k.id, { rang: r })} groups={rangGuruh} />
                <div className="flex gap-2">
                  <button onClick={() => remove(k.id)} className="py-1.5 px-3 border-2 border-red-200 text-red-700 rounded bg-white"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (!k.nomi.trim()) { showToast('Nom kiriting'); return; } setEditingId(null); showToast('Saqlandi'); }} className="flex-1 py-1.5 bg-slate-900 text-white rounded font-medium">Tayyor</button>
                </div>
              </div>
            ) : (
              <div className="group flex items-center gap-2">
                <div className="flex flex-col">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === kaziroklar.length - 1} className="text-slate-400 hover:text-slate-900 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                </div>
                <RangBadge rang={k.rang || ''} nomi={k.nomi} kind="aksessuar" />
                <button onClick={() => { setEditingId(k.id); setAdding(false); }} className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-slate-800 truncate">{k.nomi}</div>
                  <div className="text-[11px] text-slate-400 tabular-nums">{fmt(k.narx)} so'm / {k.birlik || 'dona'}</div>
                </button>
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button title="Tahrirlash" onClick={() => { setEditingId(k.id); setAdding(false); }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Edit3 className="w-4 h-4" /></button>
                  <button title="Nusxalash" onClick={() => nusxa(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"><Copy className="w-4 h-4" /></button>
                  <button title="O'chirish" onClick={() => remove(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        Tartibni ▲▼ bilan o'zgartirasiz — savdoda ham aynan shu tartibda ko'rinadi.
        Narx faqat shu yerda o'zgartiriladi (savdoda emas).
      </p>
    </Card>
  );
}
