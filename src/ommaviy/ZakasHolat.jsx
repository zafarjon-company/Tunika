// ============================================================
//  OMMAVIY "ZAKAS HOLATI" SAHIFASI — /z/<token>
// ------------------------------------------------------------
//  Mijoz chekdagi QR ni skanerlab kiradi. Loginsiz, ilovaning
//  holatiga bog'liq emas — faqat /api/zakas dan o'qiydi.
//  Narxlar qator darajasida ko'rsatilmaydi: faqat umumiy summa,
//  to'langan va qoldiq qarz.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Hourglass, CheckCircle2, PackageCheck, Phone, RefreshCw, AlertTriangle, SearchX, Package, CalendarClock, User, Hammer } from 'lucide-react';
import { fmt, formatDate, formatDay } from '../lib/helpers.js';

// Holat nishonlari
const HOLAT = {
  jarayon: {
    matn: 'Tayyorlanmoqda',
    Icon: Hourglass,
    klass: 'bg-blue-50 border-blue-300 text-blue-700',
  },
  tayyor: {
    matn: 'Tayyor — olib ketishingiz mumkin',
    Icon: CheckCircle2,
    klass: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  },
  yopilgan: {
    matn: 'Topshirildi',
    Icon: PackageCheck,
    klass: 'bg-slate-100 border-slate-300 text-slate-700',
  },
};

// Yaratilgan vaqt — noto'g'ri/bo'sh qiymatda "NaN.NaN.NaN" chiqmasin
function vaqtMatn(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return formatDate(iso);
}

// Muddat 'YYYY-MM-DD' yoki to'liq ISO bo'lishi mumkin — ikkalasini ham qo'llab-quvvatlaymiz
function muddatMatn(m) {
  if (!m) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return formatDay(m);
  const d = new Date(m);
  if (isNaN(d.getTime())) return String(m);
  return formatDate(m).split(' ')[0];
}

// Bugundan muddatgacha necha kun qolgani (manfiy = o'tib ketgan)
function qolganKun(m) {
  if (!m) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(m) ? new Date(`${m}T00:00:00`) : new Date(m);
  if (isNaN(d.getTime())) return null;
  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - bugun) / 86400000);
}

// Bitta "nom — qiymat" qatori
function Qator({ Icon, nom, qiymat }) {
  if (!qiymat) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      {Icon ? <Icon size={16} className="mt-0.5 text-slate-400 shrink-0" /> : null}
      <span className="text-slate-500 shrink-0">{nom}:</span>
      <span className="font-semibold text-slate-800 break-words">{qiymat}</span>
    </div>
  );
}

export function ZakasHolat({ token }) {
  const [holat, setHolat] = useState('yuklanmoqda'); // yuklanmoqda | topilmadi | xato | tayyor
  const [data, setData] = useState(null);

  const yukla = useCallback(async () => {
    if (!token) { setHolat('topilmadi'); return; }
    setHolat('yuklanmoqda');
    try {
      const r = await fetch(`/api/zakas?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
      // 404 = bunday zakas yo'q, 400 = token noto'g'ri — ikkalasi ham "topilmadi"
      if (r.status === 404 || r.status === 400) { setHolat('topilmadi'); return; }
      if (!r.ok) { setHolat('xato'); return; }
      const j = await r.json();
      if (!j || !j.ok || !j.zakas) { setHolat('topilmadi'); return; }
      setData(j);
      setHolat('tayyor');
    } catch (e) {
      console.error('zakas yuklashda xato:', e);
      setHolat('xato');
    }
  }, [token]);

  useEffect(() => { yukla(); }, [yukla]);

  const z = data && data.zakas;
  const dokon = (data && data.dokon) || {};
  const nishon = HOLAT[(z && z.holat) || 'jarayon'] || HOLAT.jarayon;
  const NishonIcon = nishon.Icon;

  const kun = z ? qolganKun(z.muddat) : null;
  const muddatKlass = (kun === null || z?.holat === 'yopilgan')
    ? 'bg-slate-50 border-slate-200 text-slate-600'
    : kun < 0
      ? 'bg-rose-50 border-rose-300 text-rose-700'
      : kun <= 3   // loyihada "yaqin" = 3 kun va undan kam (muddatHolati bilan bir xil)
        ? 'bg-amber-50 border-amber-300 text-amber-700'
        : 'bg-slate-50 border-slate-200 text-slate-600';

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex justify-center">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Sarlavha tasmasi */}
          <div className="bg-slate-800 text-white px-4 py-3">
            <div className="text-base font-bold truncate">{dokon.nomi || 'Tunika sex'}</div>
            <div className="text-xs text-slate-300">Zakas holati</div>
          </div>

          {/* Yuklanmoqda */}
          {holat === 'yuklanmoqda' && (
            <div className="p-8 text-center text-slate-500 text-sm">
              <RefreshCw size={28} className="mx-auto mb-3 animate-spin text-slate-400" />
              Yuklanmoqda…
            </div>
          )}

          {/* Topilmadi */}
          {holat === 'topilmadi' && (
            <div className="p-8 text-center">
              <SearchX size={36} className="mx-auto mb-3 text-slate-300" />
              <div className="font-bold text-slate-700">Zakas topilmadi</div>
              <div className="text-sm text-slate-500 mt-1">
                Havola eskirgan yoki noto'g'ri bo'lishi mumkin. Do'konga murojaat qiling.
              </div>
            </div>
          )}

          {/* Xato */}
          {holat === 'xato' && (
            <div className="p-8 text-center">
              <AlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
              <div className="font-bold text-slate-700">Ma'lumot olinmadi</div>
              <div className="text-sm text-slate-500 mt-1">Internetni tekshirib, qayta urinib ko'ring.</div>
              <button
                type="button"
                onClick={yukla}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm"
              >
                <RefreshCw size={16} /> Yangilash
              </button>
            </div>
          )}

          {/* Tayyor */}
          {holat === 'tayyor' && z && (
            <div className="p-4 space-y-4">

              {/* Katta holat nishoni */}
              <div className={`border-2 rounded-xl p-4 flex items-center gap-3 ${nishon.klass}`}>
                <NishonIcon size={28} className="shrink-0" />
                <div className="font-bold text-base leading-tight">{nishon.matn}</div>
              </div>

              {/* Asosiy ma'lumotlar */}
              <div className="border-2 border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-extrabold text-slate-800">№ {z.number}</span>
                  <span className="text-xs text-slate-500">{vaqtMatn(z.createdAt)}</span>
                </div>
                <Qator Icon={User} nom="Mijoz" qiymat={z.mijoz} />
                <Qator Icon={Hammer} nom="Usta" qiymat={z.usta} />
              </div>

              {/* Muddat */}
              {z.muddat && (
                <div className={`border-2 rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 ${muddatKlass}`}>
                  <CalendarClock size={16} className="shrink-0" />
                  <span>Topshirish muddati: {muddatMatn(z.muddat)}</span>
                </div>
              )}

              {/* Tovarlar (narxsiz) */}
              {Array.isArray(z.qatorlar) && z.qatorlar.length > 0 && (
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b-2 border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2">
                    <Package size={14} /> Tovarlar
                  </div>
                  <div className="divide-y divide-slate-100">
                    {z.qatorlar.map((q, i) => (
                      <div key={i} className="px-3 py-2 flex items-start justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-800 break-words">{q.nomi}</span>
                        <span className="text-slate-500 whitespace-nowrap shrink-0">{q.olchov}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summa bloki */}
              <div className="border-2 border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Umumiy summa</span>
                  <span className="font-bold text-slate-800">{fmt(z.totalSum)} so'm</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">To'langan</span>
                  <span className="font-bold text-emerald-600">{fmt(z.totalPaid)} so'm</span>
                </div>
                <div className={`flex items-center justify-between rounded-lg px-2 py-2 ${(z.debt || 0) > 0 ? 'bg-amber-50 border-2 border-amber-300' : ''}`}>
                  <span className={(z.debt || 0) > 0 ? 'text-amber-700 font-semibold text-sm' : 'text-slate-500 text-sm'}>Qoldiq qarz</span>
                  <span className={(z.debt || 0) > 0 ? 'text-amber-700 font-extrabold text-lg' : 'font-bold text-slate-800'}>
                    {fmt(z.debt)} so'm
                  </span>
                </div>
              </div>

              {/* Pastki qism: telefon + yangilash */}
              <div className="flex items-center gap-2 pt-1">
                {dokon.telefon ? (
                  <a
                    href={`tel:${String(dokon.telefon).replace(/\s/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-slate-800 bg-slate-800 text-white font-semibold text-sm"
                  >
                    <Phone size={16} /> {dokon.telefon}
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={yukla}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm"
                >
                  <RefreshCw size={16} /> Yangilash
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[11px] text-slate-400 mt-3">
          {dokon.nomi || 'Tunika sex'}
        </div>
      </div>
    </div>
  );
}

export default ZakasHolat;
