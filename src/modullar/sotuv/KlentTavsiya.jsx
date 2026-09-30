// ============================================================
//  YANGI MIJOZ — TAKROR VA CHALKASHLIKNING OLDINI OLISH
// ------------------------------------------------------------
//  Maqsad: bir mijozni adashib qayta kiritmaslik, uni tez topish va
//  ismi yoki familiyasi bir xil mijozlarni chalkashtirmaslik.
//   - KlentTavsiya  — ism yozilishi bilan shu ismdagi / ismdosh /
//                     familiyadosh mijozlar (mos so'zlar belgilanadi)
//   - TelefonTakror — yozilgan raqam allaqachon boshqa mijozda bo'lsa
//  Har kartada mijozning BARCHA ma'lumoti: telefonlar, manzil, mo'ljal,
//  zakaslar, jami, qarz, oxirgi zakas. Moslik qoidasi: lib/mijoz.js.
//  Ishlatiladi: Mijozlar bo'limi va zakasdagi "Mijoz tanlash".
// ============================================================
import React, { useMemo, useState } from 'react';
import { Users, AlertTriangle, Phone, Home, MapPin, FileText, X } from 'lucide-react';
import { fmt, formatDate } from '../../lib/helpers.js';
import {
  klentKalit, klentTavsiyalar, klentBolaklar, telKalit, telefonTakrorlar, mijozZakaslari, jamla,
} from '../../lib/mijoz.js';

const BOSHIDA = 3; // dastlab nechta karta ko'rinadi (qolgani "Yana N ta" bilan)

// Karta ustidagi kichik yorliq — nima uchun tavsiya qilindi
const SABAB = {
  0: { t: 'Aynan shu ism', c: 'bg-amber-100 text-amber-800' },
  4: { t: 'Ismi yoki familiyasi bir xil', c: 'bg-sky-50 text-sky-700' },
};

export function KlentTavsiya({ klentlar, ism, orders, amal, onTanla }) {
  const [hammasi, setHammasi] = useState(false);
  const [yopilgan, setYopilgan] = useState(null); // shu kalitda yopilgan — ism o'zgarsa qayta chiqadi

  const kalit = klentKalit(ism);
  const topildi = useMemo(() => klentTavsiyalar(klentlar, ism), [klentlar, ism]);
  if (!topildi.length || yopilgan === kalit) return null;

  const aynan = topildi.some((x) => x.daraja === 0);
  const korinadi = hammasi ? topildi : topildi.slice(0, BOSHIDA);
  const qolgan = topildi.length - korinadi.length;

  return (
    <OgohQuti ogoh={aynan} Icon={aynan ? AlertTriangle : Users}
      sarlavha={aynan ? 'Bu ism bilan mijoz allaqachon bor' : "O'xshash ismli mijozlar"}
      son={topildi.length} izoh="Yangisini ochishdan oldin tekshiring — balki shu mijozdir."
      onYop={() => setYopilgan(kalit)}>
      {korinadi.map(({ c, daraja }) => (
        <TavsiyaKarta key={c.id} c={c} ism={ism} sabab={SABAB[daraja]} orders={orders} amal={amal} onTanla={onTanla} />
      ))}
      {qolgan > 0 && (
        <button type="button" onClick={() => setHammasi(true)}
          className="w-full py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:bg-black/5">
          Yana {qolgan} tasini ko'rsatish
        </button>
      )}
    </OgohQuti>
  );
}

// Yozilgan telefon(lar) allaqachon boshqa mijozda bo'lsa — eng ishonchli takror belgisi
// (ism boshqacha yozilgan bo'lsa ham: "Alijon" / "Ali aka").
export function TelefonTakror({ klentlar, phones, orders, amal, onTanla }) {
  const [yopilgan, setYopilgan] = useState(null);
  const kalitlar = (phones || []).map(telKalit).filter(Boolean);
  const kalit = kalitlar.join(',');
  // kalit — to'liq raqamlar; chala raqam yozilayotganda qayta hisoblanmaydi
  const topildi = useMemo(() => telefonTakrorlar(klentlar, kalitlar), [klentlar, kalit]);
  if (!topildi.length || yopilgan === kalit) return null;
  return (
    <OgohQuti ogoh Icon={AlertTriangle} sarlavha="Bu raqam allaqachon bor" son={topildi.length}
      izoh="Shu raqamli mijoz — ehtimol aynan shu odam." onYop={() => setYopilgan(kalit)}>
      {topildi.map((c) => (
        <TavsiyaKarta key={c.id} c={c} telKalitlar={kalitlar} orders={orders} amal={amal} onTanla={onTanla} />
      ))}
    </OgohQuti>
  );
}

function OgohQuti({ ogoh, Icon, sarlavha, son, izoh, onYop, children }) {
  return (
    <div className={`mt-2 rounded-lg border p-2 space-y-1.5 ${ogoh ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-1.5">
        <Icon className={`w-4 h-4 flex-shrink-0 mt-px ${ogoh ? 'text-amber-600' : 'text-slate-500'}`} />
        <div className="flex-1 min-w-0 text-xs leading-snug" aria-live="polite">
          <div className={`font-bold ${ogoh ? 'text-amber-800' : 'text-slate-700'}`}>
            <span>{sarlavha}</span>
            <span className="font-semibold opacity-70"> · {son} ta</span>
          </div>
          <div className={ogoh ? 'text-amber-700' : 'text-slate-500'}>{izoh}</div>
        </div>
        <button type="button" onClick={onYop} title="Yashirish" aria-label="Yashirish"
          className="p-1 -m-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-black/5 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>
      {children}
    </div>
  );
}

function TavsiyaKarta({ c, ism, sabab, telKalitlar, orders, amal, onTanla }) {
  const phones = (c.phones || []).filter(Boolean);
  const s = orders ? jamla(mijozZakaslari(orders, c)) : null;
  const bolaklar = ism ? klentBolaklar(c.name, ism) : [{ matn: c.name || '', mos: false }];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          {(c.name || '?').charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0 space-y-0.5">
          {sabab && <span className={`inline-block px-1.5 py-px rounded-full text-[10px] font-semibold ${sabab.c}`}>{sabab.t}</span>}
          {/* Mos so'zlar belgilanadi — nima uchun chiqqani darhol ko'rinsin */}
          <div className="font-bold text-slate-900 text-sm break-words">
            {bolaklar.map((b, i) => (b.mos
              ? <mark key={i} className="bg-amber-200/70 text-slate-900 rounded px-0.5">{b.matn}</mark>
              : <React.Fragment key={i}>{b.matn}</React.Fragment>))}
          </div>
          {phones.length > 0 ? phones.map((p, i) => {
            const mos = telKalitlar && telKalitlar.includes(telKalit(p));
            return (
              <div key={i} className={`flex items-center gap-1 tabular-nums ${mos ? 'text-amber-800 font-bold' : 'text-slate-700'}`}>
                <Phone className={`w-3 h-3 flex-shrink-0 ${mos ? 'text-amber-600' : 'text-slate-400'}`} />{p}
              </div>
            );
          }) : (
            <div className="flex items-center gap-1 text-slate-400"><Phone className="w-3 h-3 flex-shrink-0" />Telefon kiritilmagan</div>
          )}
          {c.address && (
            <div className="flex items-start gap-1 text-slate-600 break-words">
              <Home className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" /><span className="min-w-0">{c.address}</span>
            </div>
          )}
          {c.orientir && (
            <div className="flex items-start gap-1 text-slate-600 break-words">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" /><span className="min-w-0">{c.orientir}</span>
            </div>
          )}
          {s && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {s.n > 0 ? (
                <>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold tabular-nums inline-flex items-center gap-0.5">
                    <FileText className="w-3 h-3" />{s.n} ta zakas
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold tabular-nums">Jami {fmt(s.jami)} so'm</span>
                  {s.qarz > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold tabular-nums">Qarz {fmt(s.qarz)} so'm</span>}
                  {s.oxirgi && <span className="text-[11px] text-slate-400 tabular-nums">oxirgi: {formatDate(s.oxirgi)}</span>}
                </>
              ) : (
                <span className="text-[11px] text-slate-400">Hali zakas yo'q</span>
              )}
            </div>
          )}
        </div>
        {onTanla && (
          <button type="button" onClick={() => onTanla(c)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 flex-shrink-0">
            {amal}
          </button>
        )}
      </div>
    </div>
  );
}
