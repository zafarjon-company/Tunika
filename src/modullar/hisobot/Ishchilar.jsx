// ============================================================
//  HISOBOT → ISHCHILAR
// ------------------------------------------------------------
//  Ishchilar ro'yxati. Ishchi ustiga bosilsa — uning barcha
//  amallari (yo'qlama + avans) ko'rinadi.
//  Ustunlar: Nom · Sana · Qiymat. Saralash: Sana / Qiymat / Nom.
//  Yuqori-o'ngda hozirgi haqqi, past-o'ngda Chek tugmasi —
//  faqat ishchiga kirilganda.
// ------------------------------------------------------------
//  Qiymat:  ishga keldi  = +kunlik haq (oylik ÷ oydagi kunlar)
//           yarim kun    = +kunlik haq / 2
//           kelmadi      = 0
//           avans        = −olingan summa (so'mda)
// ============================================================
import React, { useState, useMemo } from 'react';
import { ChevronRight, Printer, HardHat } from 'lucide-react';
import { Card, SectionTitle, SegmentedControl, StatBox } from '../../components/ui.jsx';
import { fmt, formatDay, daysInMonth } from '../../lib/helpers.js';
import { IshchiChek } from './IshchiChek.jsx';

// Eski (sonli) yoki yangi (massiv) avans formatini massivga keltirish
function normEntries(v, oy) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'number' && v > 0) return [{ id: 'eski', method: "So'mda", amount: v, createdAt: `${oy}-01`, notes: '' }];
  return [];
}

// Bitta ishchining barcha amallarini yig'ish
function buildAmallar(ishchi, yoqlama, avanslar) {
  const ops = [];
  const oylik = Number(ishchi.oylikHaqq) || 0;

  // Yo'qlama amallari
  for (const sana in yoqlama) {
    const holat = yoqlama[sana]?.[ishchi.id];
    if (!holat) continue;
    const kun = daysInMonth(sana.slice(0, 7));
    const kunlikHaq = kun ? oylik / kun : 0;
    let qiymat = 0;
    let nom = 'Kelmadi';
    if (holat === 'keldi') { qiymat = kunlikHaq; nom = 'Ishga keldi'; }
    else if (holat === 'yarim') { qiymat = kunlikHaq / 2; nom = 'Yarim kun'; }
    ops.push({ id: `y-${sana}`, turi: 'yoqlama', nom, sana, qiymat });
  }

  // Avans amallari
  for (const oy in avanslar) {
    normEntries(avanslar[oy]?.[ishchi.id], oy).forEach((p) => {
      const amt = parseFloat(p.amount) || 0;
      const som = p.method === 'Dollorda' ? amt * (p.rate || 0) : amt;
      const sana = p.createdAt ? p.createdAt.slice(0, 10) : `${oy}-01`;
      ops.push({ id: `a-${p.id}`, turi: 'avans', nom: `Avans${p.notes ? ` · ${p.notes}` : ''}`, sana, qiymat: -som });
    });
  }

  return ops;
}

export function HisobotIshchilar({ ishchilar = [], yoqlama = {}, avanslar = {}, shopName }) {
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState('sana');
  const [chekOchiq, setChekOchiq] = useState(false);

  const ishchi = ishchilar.find((i) => i.id === selectedId) || null;

  const amallar = useMemo(() => {
    if (!ishchi) return [];
    const ops = buildAmallar(ishchi, yoqlama, avanslar);
    if (sort === 'sana') ops.sort((a, b) => (a.sana < b.sana ? 1 : a.sana > b.sana ? -1 : 0)); // yangilari tepada
    else if (sort === 'qiymat') ops.sort((a, b) => b.qiymat - a.qiymat);
    else if (sort === 'nom') ops.sort((a, b) => a.nom.localeCompare(b.nom));
    return ops;
  }, [ishchi, yoqlama, avanslar, sort]);

  const jamiIshlangan = amallar.filter((o) => o.qiymat > 0).reduce((s, o) => s + o.qiymat, 0);
  const jamiAvans = amallar.filter((o) => o.turi === 'avans').reduce((s, o) => s + Math.abs(o.qiymat), 0);
  const haqqi = jamiIshlangan - jamiAvans;

  // ----- 2 USTUN: chap (sticky ro'yxat) + o'ng (tanlangan ishchi tafsiloti) -----
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-4 items-start">
      {/* CHAP: sticky ishchilar ro'yxati */}
      <aside className="lg:sticky lg:top-36">
        <Card>
          <SectionTitle icon={HardHat}>Ishchilar</SectionTitle>
          {ishchilar.length === 0 ? (
            <div className="text-center py-8 text-slate-400"><HardHat className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Ishchilar mavjud emas</p></div>
          ) : (
            <div className="space-y-1.5">
              {ishchilar.map((i) => {
                const sel = i.id === selectedId;
                return (
                  <button key={i.id} onClick={() => { setSelectedId(i.id); setChekOchiq(false); setSort('sana'); }}
                    className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 text-sm transition ${sel ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}>
                    <span className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base flex-shrink-0">{(i.name || '?').charAt(0).toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{i.name}</div>
                      {i.lavozim && <div className="text-xs text-slate-400 truncate">{i.lavozim}</div>}
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${sel ? 'text-slate-900' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </aside>

      {/* O'NG: tanlangan ishchi tafsiloti */}
      <div className="space-y-4 min-w-0">
        {!ishchi ? (
          <Card>
            <div className="text-center py-12 text-slate-400">
              <HardHat className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Ishchini tanlang — uning yo'qlama va avans amallari, hozirgi haqqi shu yerda ko'rinadi.</p>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">{(ishchi.name || '?').charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-lg leading-tight truncate">{ishchi.name}</div>
                  {ishchi.lavozim && <div className="text-xs text-slate-400">{ishchi.lavozim}</div>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <StatBox label="Ishlangan" value={jamiIshlangan} suffix="so'm" color="emerald" />
                <StatBox label="Avans" value={jamiAvans} suffix="so'm" color="amber" />
                <StatBox label="Hozirgi haqqi" value={haqqi} suffix="so'm" color={haqqi >= 0 ? 'emerald' : 'slate'} />
              </div>
            </Card>

            <Card padding="p-0">
              <div className="p-3 border-b border-slate-100">
                <label className="block text-xs text-slate-500 mb-1">Saralash</label>
                <SegmentedControl value={sort} onChange={setSort}
                  options={[
                    { value: 'sana', label: 'Sana' },
                    { value: 'qiymat', label: 'Qiymat' },
                    { value: 'nom', label: 'Nom' },
                  ]} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold">Nom</th>
                      <th className="py-2.5 px-2 font-semibold text-center">Sana</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Qiymat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amallar.map((o) => (
                      <tr key={o.id} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-800">{o.nom}</td>
                        <td className="py-2 px-2 text-center tabular-nums text-slate-600">{formatDay(o.sana)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-semibold ${o.qiymat > 0 ? 'text-emerald-700' : o.qiymat < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {o.qiymat > 0 ? '+' : ''}{fmt(o.qiymat)} so'm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {amallar.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">Hali amallar yo'q (yo'qlama yoki avans)</p>
                )}
              </div>
            </Card>

            {/* Past-o'ng: Chek tugmasi */}
            <div className="flex justify-end">
              <button onClick={() => setChekOchiq(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                <Printer className="w-4 h-4" /> Chek
              </button>
            </div>
          </>
        )}
      </div>

      {chekOchiq && ishchi && (
        <IshchiChek
          ishchi={ishchi} amallar={amallar}
          jamiIshlangan={jamiIshlangan} jamiAvans={jamiAvans} haqqi={haqqi}
          shopName={shopName} onClose={() => setChekOchiq(false)}
        />
      )}
    </div>
  );
}
