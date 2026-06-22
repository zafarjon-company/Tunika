// ============================================================
//  UMUMIY UI KOMPONENTLARI
// ------------------------------------------------------------
//  Bular asl faylda ishlatilgan, lekin yaratilmagan edi.
//  Mavjud Tailwind uslubiga mos qilib qayta tiklandi:
//  Card, SectionTitle, Row, SegmentedControl, StatBox,
//  SmallModal, FullModal.
// ============================================================
import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Cylinder, Spline, Triangle, Fence, Layers, Ruler, Package } from 'lucide-react';
import { formatPhone, fmt, isKanyokTashqi, isKanyokIchki, isLatokFigurali, isLatokOddiy, isEskiNov, rangHex, rangMatn, rangFon, isMetall, rangTozala } from '../lib/helpers.js';
import { RANG_GROUPS } from '../lib/constants.js';

// Metall jilo uchun yengil ichki soya (3D his)
const METALL_SHADOW = 'inset 0 1px 1px rgba(255,255,255,.7), inset 0 -2px 3px rgba(0,0,0,.25)';

// ----- Tovar turiga mos ikonka (butun ilovada BITTA Lucide oilasi) -----
// Avval nom bo'yicha (truba/armatura/burchak/profnastil/latok/list), keyin kind bo'yicha.
const TOVAR_IKONLAR = [
  [/truba|quvur|pipe/i, Cylinder],
  [/armatura|armatur/i, Spline],
  [/burchak|ugolok|уголок|angle/i, Triangle],
  [/profnastil|proflist|profil/i, Fence],
  [/latok|lotok|kanyok|konyok|no'?v|нов/i, Ruler],
  [/list|tunika|smz|rangli|otsink|po'lat/i, Layers],
];
export function tovarIkonKomp(nomi = '', kind = '') {
  for (const [re, Icon] of TOVAR_IKONLAR) if (re.test(nomi || '')) return Icon;
  if (kind === 'profnastil') return Fence;
  if (kind === 'metrli') return Ruler;
  if (kind === 'aksessuar') return Package;
  return Layers; // list / tunika / standart
}
export function TovarIcon({ nomi = '', kind = '', className = 'w-4 h-4' }) {
  const Icon = tovarIkonKomp(nomi, kind);
  return <Icon className={className} />;
}

// ----- Rang tanlash (Narxlar modullarida ishlatiladi) -----
// Qiymat = rang nomi ('' = avto/nomdan). Ranglar GURUHLAB ko'rsatiladi (ko'p
// tanlov, lekin chalkashmaslik uchun tartibli). Bu yerda faqat NAMUNALAR
// ko'rinadi (nomlar emas — nom ustiga olib borilsa tooltip chiqadi).
//  groups — guruhlangan palitra [{guruh, nomlar:[...]}] (Sozlamalardagi to'liq
//  ro'yxat). Berilmasa — standart guruhlar. Joriy qiymat (value) palitrada
//  bo'lmasa ham "Tanlangan" guruhida ko'rsatiladi — eski list rangi yo'qolmaydi.
const normRangNom = (s) => (s || '').toLowerCase().replace(/['`’]/g, '').trim();
export function RangTanla({ value, onPick, avto = true, groups }) {
  const gs = (groups && groups.length)
    ? groups
    : RANG_GROUPS.map((g) => ({ guruh: g.guruh, nomlar: g.ranglar.map((r) => r.nom) }));
  const nv = normRangNom(value);
  const bor = !!value && gs.some((g) => g.nomlar.some((n) => normRangNom(n) === nv));
  const showGroups = (value && !bor) ? [{ guruh: 'Tanlangan', nomlar: [value] }, ...gs] : gs;
  return (
    <div>
      <label className="block text-slate-500 mb-1">Rang</label>
      {avto && (
        <button type="button" onClick={() => onPick('')}
          className={`mb-2 px-2 py-1 rounded-md border-2 text-[11px] ${!value ? 'border-slate-900 text-slate-900 font-semibold' : 'border-slate-200 text-slate-500'}`}>Avto (nomdan)</button>
      )}
      <div className="space-y-2">
        {showGroups.map((g) => (
          <div key={g.guruh}>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{g.guruh}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.nomlar.map((nm) => (
                <button key={nm} type="button" onClick={() => onPick(nm)} title={nm}
                  className={`w-6 h-6 rounded-full border-2 transition ${value && normRangNom(nm) === nv ? 'border-slate-900 ring-2 ring-slate-300' : 'border-black/10 hover:scale-110'}`}
                  style={{ background: rangFon(nm), boxShadow: METALL_SHADOW }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- Rang "chip" (pill) uchun uslub — metall ranglarda jilo bilan -----
// Chiplar har xil class/o'lchamda bo'lgani uchun faqat style obyekti qaytaramiz.
export function rangChipStyle(rang) {
  const metall = isMetall(rang);
  return {
    background: rangFon(rang),
    color: metall ? '#1f2937' : rangMatn(rang),
    boxShadow: METALL_SHADOW, // hamma ranglar metall — har doim jilo soyasi
  };
}

// ----- Rangli ikonka-badge (Narxlar ro'yxatlarida) — metall ranglarda jilo bilan -----
// rang bo'sh bo'lsa — oddiy qora badge.
export function RangBadge({ rang = '', nomi = '', kind = '', size = 'w-9 h-9' }) {
  if (!rang) {
    return (
      <span className={`${size} rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0`}>
        <TovarIcon nomi={nomi} kind={kind} />
      </span>
    );
  }
  const metall = isMetall(rang);
  return (
    <span className={`${size} rounded-lg flex items-center justify-center flex-shrink-0 border border-black/10`}
      title={rang}
      style={{ background: rangFon(rang), color: metall ? '#1f2937' : rangMatn(rang), boxShadow: METALL_SHADOW }}>
      <TovarIcon nomi={nomi} kind={kind} />
    </span>
  );
}

// ----- "Teskari quloq" belgisi — ro'yxat/chekda holatni ko'rsatadi -----
export function TeskariBadge({ item, className = '' }) {
  if (!item || !item.teskariQuloq) return null;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 whitespace-nowrap ${className}`}>
      Teskari quloq
    </span>
  );
}

// ----- Kanyok / Latok tovari uchun rasm — fonsiz (shaffof) -----
// Qora chiziqning TASHQI tomonida, butun kontur bo'ylab, qora bilan BIR XIL
// qalinlikda, YOPISHIB turgan rangli chiziq (material rangida). Qoplama shakli
// (*-coat.png) oldindan hisoblangan (offset), CSS uni rangga bo'yaydi.
export function KanyokImg({ item, size = 'w-14 h-9', className = '' }) {
  const ichki = isKanyokIchki(item);
  const tashqi = isKanyokTashqi(item);
  const latokFig = isLatokFigurali(item);
  const latokOdd = isLatokOddiy(item);
  const eskiNov = isEskiNov(item);
  if (!ichki && !tashqi && !latokFig && !latokOdd && !eskiNov) return null;
  const tq = !!item.teskariQuloq;
  const src = eskiNov ? '/eski-nov.png'
    : latokFig ? '/latok-figurali.png'
    : latokOdd ? '/latok-oddiy.png'
    : ichki ? (tq ? '/kanyok-ichki-tq.png' : '/kanyok-ichki.png')
    : (tq ? '/kanyok-tq.png' : '/kanyok.png');
  const coat = src.replace(/\.png$/, '-coat.png');
  const color = item.rang ? rangHex(item.rang) : '';
  const maskStyle = {
    backgroundColor: color,
    WebkitMaskImage: `url(${coat})`, maskImage: `url(${coat})`,
    WebkitMaskSize: 'contain', maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center', maskPosition: 'center',
  };
  return (
    <span className={`relative inline-block ${size} align-middle flex-shrink-0 ${className}`}>
      {/* tashqi tomondagi rangli offset chiziq (material rangi) */}
      {color && <span aria-hidden className="absolute inset-0" style={maskStyle} />}
      {/* asosiy qora chiziq — ustida */}
      <img src={src} alt="Profil" className="absolute inset-0 w-full h-full object-contain" />
    </span>
  );
}

// ----- Raqamni "sanab chiqadigan" (count-up) + o'zgarganda puls -----
export function CountUp({ value, className }) {
  const to = Number(value) || 0;
  const [disp, setDisp] = useState(0);
  const [pulse, setPulse] = useState(false);
  const fromRef = useRef(0);
  const firstRef = useRef(true);
  useEffect(() => {
    const from = fromRef.current;
    // birinchi marta puls bo'lmasin
    if (firstRef.current) { firstRef.current = false; } else if (from !== to) {
      setPulse(true);
      const pt = setTimeout(() => setPulse(false), 340);
      // tozalashni quyidagi return bilan birga emas — alohida
      setTimeout(() => clearTimeout(pt), 360);
    }
    if (from === to) { setDisp(to); return undefined; }
    const dur = 650;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisp(from + (to - from) * e);
      if (p < 1) { raf = requestAnimationFrame(tick); } else { fromRef.current = to; setDisp(to); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className={`${pulse ? 'anim-num-pulse inline-block' : ''} ${className || ''}`}>{fmt(Math.round(disp))}</span>;
}

// ----- Oq karta (bo'lim konteyneri) -----
export function Card({ children, highlight = false, padding = 'p-4 sm:p-5' }) {
  return (
    <div
      className={`bg-white rounded-xl border ${padding} ${
        highlight
          ? 'border-slate-900 shadow-lg shadow-slate-900/5'
          : 'border-slate-200'
      }`}
    >
      {children}
    </div>
  );
}

// ----- Bo'lim sarlavhasi (ixtiyoriy ikonka bilan) -----
export function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      {Icon && (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 text-white flex-shrink-0">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
        {children}
      </h2>
    </div>
  );
}

// ----- Label / qiymat qatori (hisob-kitobda) -----
export function Row({ label, value, big = false }) {
  return (
    <div className="flex justify-between items-center">
      <span className={big ? 'text-sm font-semibold text-slate-700' : 'text-xs text-slate-500'}>
        {label}
      </span>
      <span className={`tabular-nums ${big ? 'text-lg font-bold text-slate-900' : 'text-sm text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}

// ----- Segmentli tugmalar — tanlanganda "sakrash" + tasdiq belgisi -----
export function SegmentedControl({ value, onChange, options }) {
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState(null);
  function handle(v) { onChange(v); setPicked(v); setTick((t) => t + 1); }
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
      {options.map((opt) => {
        const sel = value === opt.value;
        const justPicked = sel && picked === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handle(opt.value)}
            className={`relative flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition ${
              sel ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span key={tick} className={justPicked ? 'inline-block anim-pop' : 'inline-block'}>{opt.label}</span>
            {justPicked && (
              <span key={`c${tick}`} className="anim-check absolute -top-1.5 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center pointer-events-none">
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ----- Statistika qutisi (Zakaslar tabida) -----
export function StatBox({ label, value, suffix, color = 'slate' }) {
  const colors = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className={`font-bold tabular-nums leading-tight ${colors[color] || colors.slate}`}>
        {typeof value === 'number' ? <CountUp value={value} /> : value}
        {suffix && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

// ----- Kichik markaziy modal (tasdiq, qarz to'lash) -----
export function SmallModal({ onClose, title, children }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 no-print"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Yopish" title="Yopish" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ----- Telefon maskasi: +998 (DD) DDD-DD-DD -----
// To'liq shablon va undagi raqam o'rinlari (indekslari).
const PHONE_TEMPLATE = '+998 (__) ___-__-__';
const PHONE_SLOTS = [6, 7, 10, 11, 12, 14, 15, 17, 18]; // 9 ta o'rin

function maskPhone(digits) {
  const chars = PHONE_TEMPLATE.split('');
  for (let i = 0; i < digits.length && i < PHONE_SLOTS.length; i++) {
    chars[PHONE_SLOTS[i]] = digits[i];
  }
  return chars.join('');
}

// Saqlangan qiymatdan foydalanuvchi raqamlarini ajratib olish (998 davlat kodisiz, maks 9 ta).
export function phoneDigits(value) {
  let d = (value || '').replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  return d.slice(0, 9);
}

// Telefon kiritish maydoni — maska sifatida ishlaydi:
//  - shablon doim ko'rinadi, raqamlar chapdan o'ngga _ larni to'ldiradi
//  - faqat raqam qabul qilinadi (harf/belgi e'tiborga olinmaydi), maks 9 ta
//  - fokuslanganda kursor birinchi bo'sh o'ringa tushadi
//  - backspace faqat raqamni o'chiradi, shablon buzilmaydi
export function PhoneInput({ value, onChange, className }) {
  const ref = useRef(null);
  const digits = phoneDigits(value);

  function caretPos(len) {
    return len < PHONE_SLOTS.length ? PHONE_SLOTS[len] : PHONE_SLOTS[PHONE_SLOTS.length - 1] + 1;
  }

  function handleChange(e) {
    const all = e.target.value.replace(/\D/g, '');
    let ud = all.startsWith('998') ? all.slice(3) : all;
    ud = ud.slice(0, 9);

    // DOMni darhol shablonga moslaymiz (ortiqcha belgi/harf tushib qoladi).
    const el = ref.current;
    if (el) {
      el.value = maskPhone(ud);
      const p = caretPos(ud.length);
      try { el.setSelectionRange(p, p); } catch (err) { /* noop */ }
    }

    const formatted = ud.length ? formatPhone(ud) : '';
    if (formatted !== value) onChange(formatted);
  }

  function handleFocus() {
    const p = caretPos(digits.length);
    requestAnimationFrame(() => {
      try { ref.current?.setSelectionRange(p, p); } catch (err) { /* noop */ }
    });
  }

  return (
    <input
      ref={ref}
      type="tel"
      inputMode="numeric"
      value={maskPhone(digits)}
      onChange={handleChange}
      onFocus={handleFocus}
      className={className}
    />
  );
}

// ----- To'liq (sheet) modal — pickerlar uchun -----
export function FullModal({ onClose, title, children }) {
  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 flex items-end sm:items-center justify-center no-print"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Yopish" title="Yopish" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
