// ============================================================
//  ASOSIY ILOVA KOMPONENTI
// ------------------------------------------------------------
//  Holat (state), saqlash, bo'limlar orasida o'tish (routing)
//  va modallarni boshqaradi. Har bir bo'lim alohida modulda.
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Settings, FileText, Check, AlertCircle, Loader2, Users,
  CalendarCheck, HardHat, ClipboardList, Tags, Dices, Pin, History, Languages, WifiOff, Search,
} from 'lucide-react';
// Header effekt belgilari — mavzu-detallari uchun professional ikonalar (emoji emas)
import {
  Crown, Gem, Star, Sparkles, Snowflake, Leaf, Flame, Droplet, Flower, Flower2,
  Wine, WandSparkles, Bot, Fish, Bird, Ghost, Cherry, Citrus, Grape, Apple,
  Hexagon, Biohazard, TreePalm, Coins, Sprout,
  Sun, Moon, Contrast, Waves, MoonStar, Binary, Coffee, Sunset, Zap, Cpu,
  Atom, Wrench, CloudLightning, Shirt, Candy, Orbit, Cloud, Anchor, Hammer, Shell,
} from 'lucide-react';

// Sprite kaliti -> lucide komponenti (header'da suzuvchi mavzu-belgilari)
const FX_ICON = {
  crown: Crown, gem: Gem, star: Star, sparkles: Sparkles, snowflake: Snowflake,
  leaf: Leaf, flame: Flame, droplet: Droplet, flower: Flower, flower2: Flower2,
  wine: Wine, wand: WandSparkles, bot: Bot, fish: Fish, bird: Bird, ghost: Ghost,
  cherry: Cherry, citrus: Citrus, grape: Grape, apple: Apple, hexagon: Hexagon,
  biohazard: Biohazard, palm: TreePalm, coins: Coins, sprout: Sprout,
  sun: Sun, moon: Moon, contrast: Contrast, waves: Waves, moonstar: MoonStar,
  binary: Binary, coffee: Coffee, sunset: Sunset, zap: Zap, cpu: Cpu, atom: Atom,
  wrench: Wrench, cloudbolt: CloudLightning, shirt: Shirt, candy: Candy,
  orbit: Orbit, cloud: Cloud, anchor: Anchor, hammer: Hammer, shell: Shell,
};

// HERO mavzular — premium photoreal ornament (Higgs nano_banana, shaffof PNG).
// Bularda ikona o'rniga haqiqiy 3D-render charm suzadi. /ornaments/<fayl>.png
// MUHIM: public/brand/** vite.config watch.ignored ichida (OneDrive EBUSY) — dev'da
// berilmaydi; shu sabab ornamentlar public/ornaments/ da (brand'dan tashqari).
const TEMA_ORN = {
  royal: 'crown', ruby: 'ruby',
  ice: 'snow', arctic: 'snow', glacier: 'snow',
  rose: 'rose', blush: 'rose',
  gold: 'coin', pirate: 'coin', bronze: 'coin',
  dracula: 'bat',
};

import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase.js';
import { storage, O_CHIR } from './lib/storage.js';
import { fetchKurslar } from './lib/kurs.js';
import { LoginScreen } from './components/LoginScreen.jsx';
import {
  DEFAULT_TUNIKA_BAZA, DEFAULT_LATOK, DEFAULT_SHOP_NAME,
  DEFAULT_PRODUCTS, DEFAULT_USD_RATE, DEFAULT_AKSESSUARLAR, DEFAULT_KAZIROKLAR, DEFAULT_KAZ_TURLARI,
} from './lib/constants.js';
import {
  fmt, genId, calcItem, makeBlankItem, makeBlankPayment, makeBlankDraft,
  rangTozala, aksRangKerak, orderItemToDraft,
} from './lib/helpers.js';

import { SmallModal } from './components/ui.jsx';
import { GlobalSearch } from './components/GlobalSearch.jsx';
import { LiveClock } from './components/LiveClock.jsx';
import { NewOrderTab } from './modullar/sotuv/YangiZakaz.jsx';
import { computeKazRows, readKazNarx, saveKazNarx } from './modullar/sotuv/KazirokSavdo.jsx';
import { readChizmaKazirok } from './modullar/sotuv/chizmaEngine.js';
import { fsSupported, pickLibrary, getLibrary, clearLibrary } from './lib/fsLibrary.js';
import { OrdersTab } from './modullar/sotuv/Zakazlar.jsx';
import { MijozlarTab } from './modullar/sotuv/Mijozlar.jsx';
import { ProductPickerModal, ClientPickerModal, MasterPickerModal } from './modullar/sotuv/pickers.jsx';
import { ReceiptModal } from './modullar/sotuv/Chek.jsx';
import { DynamicPaymentsSection } from './modullar/sotuv/Tolovlar.jsx';
import { SettingsTab } from './modullar/sozlamalar/Sozlamalar.jsx';
import { IshchilarModule } from './modullar/ishchilar/index.jsx';
import { YoqlamaModule } from './modullar/yoqlama/index.jsx';
import { HisobotModule } from './modullar/hisobot/index.jsx';
import { NarxlarModule } from './modullar/narxlar/index.jsx';
import { JurnalTab } from './modullar/jurnal/index.jsx';
import { tabKoradi, ruxsat } from './lib/ruxsat.js';
import { applyTil, getTil, TILLAR } from './lib/til.js';
import { getKeys, saveKeys, matchCombo } from './lib/keybind.js';

const FOUNDER = { id: 'founder', login: 'Brutal', parol: '4252600ZZ', role: 'founder' };

// Har mavzu — o'ziga xos effekt {t: harakat turi, c: rang, s: ikon-belgi (lucide)}
const TEMA_FX = {
  light:     { t: 'mote', c: '#c9a865', s: 'sun' },
  dark:      { t: 'snow', c: '#ffffff', s: 'moon' },
  nord:      { t: 'snow', c: '#dbeafe', s: 'snowflake' },
  mono:      { t: 'bokeh', c: '#e5e5e5', s: 'contrast' },
  dracula:   { t: 'floaty', c: '#bd93f9', s: 'ghost' },
  ocean:     { t: 'drift', c: '#7dd3fc', s: 'waves' },
  midnight:  { t: 'meteor', c: '#cdd6ff', s: 'moonstar' },
  matrix:    { t: 'rain', c: '#86efac', s: 'binary' },
  aurora:    { t: 'firefly', c: '#34d399', s: 'sparkles' },
  forest:    { t: 'leaf', c: '#86efac', s: 'leaf' },
  coral:     { t: 'floaty', c: '#ff9e8a', s: 'fish' },
  coffee:    { t: 'steam', c: '#e4d6be', s: 'coffee' },
  volcano:   { t: 'fire', c: '#ff5a1f', s: 'flame' },
  sunset:    { t: 'ember', c: '#ff9e6b', s: 'sunset' },
  crimson:   { t: 'ember', c: '#ff7a8a', s: 'flame' },
  rose:      { t: 'petal', c: '#ff8ac0', s: 'flower2' },
  gold:      { t: 'glint', c: '#ffd770', s: 'coins' },
  neon:      { t: 'confetti', c: '#ff2d95', s: 'zap' },
  synthwave: { t: 'glint', c: '#ff4ecd', s: 'sunset' },
  cyber:     { t: 'meteor', c: '#22d3ee', s: 'cpu' },
  galaxy:    { t: 'twinkle2', c: '#c4b5ff', s: 'sparkles' },
  amethyst:  { t: 'floaty', c: '#b07bff', s: 'gem' },
  plum:      { t: 'bokeh', c: '#9b6bff', s: 'gem' },
  indigo:    { t: 'meteor', c: '#8b93ff', s: 'star' },
  // ----- yangi 21 mavzu -----
  emerald:   { t: 'firefly', c: '#34d399', s: 'gem' },
  ruby:      { t: 'glint', c: '#fb2c5a', s: 'gem' },
  sapphire:  { t: 'drift', c: '#60a5fa', s: 'gem' },
  jade:      { t: 'firefly', c: '#5eead4', s: 'gem' },
  bronze:    { t: 'glint', c: '#e0954a', s: 'coins' },
  steel:     { t: 'rain', c: '#cbd5e1', s: 'wrench' },
  magma:     { t: 'fire', c: '#ff6a00', s: 'flame' },
  arctic:    { t: 'spinfall', c: '#bae6fd', s: 'snowflake' },
  jungle:    { t: 'leaf', c: '#a3e635', s: 'sprout' },
  desert:    { t: 'floaty', c: '#eab676', s: 'palm' },
  wine:      { t: 'floaty', c: '#e64980', s: 'wine' },
  cobalt:    { t: 'meteor', c: '#60a5fa', s: 'atom' },
  magenta:   { t: 'confetti', c: '#f472b6', s: 'flower' },
  lime:      { t: 'confetti', c: '#d6f04f', s: 'citrus' },
  turquoise: { t: 'drift', c: '#22d3ee', s: 'gem' },
  sakura:    { t: 'petal', c: '#fda4c4', s: 'flower' },
  storm:     { t: 'rain', c: '#90caf9', s: 'cloudbolt' },
  pirate:    { t: 'twinkle2', c: '#e8b923', s: 'coins' },
  wizard:    { t: 'floaty', c: '#c084fc', s: 'wand' },
  robot:     { t: 'floaty', c: '#67e8f9', s: 'bot' },
  comet:     { t: 'meteor', c: '#c7d2fe', s: 'star' },
  // ----- yana 20 mavzu -----
  obsidian:  { t: 'bokeh', c: '#a78bfa', s: 'gem' },
  sunflower: { t: 'leaf', c: '#ffd23f', s: 'flower' },
  flamingo:  { t: 'floaty', c: '#fb6f92', s: 'bird' },
  mint:      { t: 'firefly', c: '#6eedbb', s: 'leaf' },
  blood:     { t: 'spinfall', c: '#e63950', s: 'droplet' },
  ice:       { t: 'spinfall', c: '#9bdcfb', s: 'snowflake' },
  honey:     { t: 'floaty', c: '#ffbe2e', s: 'hexagon' },
  orchid:    { t: 'petal', c: '#d946ef', s: 'flower' },
  denim:     { t: 'rain', c: '#6f9bd8', s: 'shirt' },
  caramel:   { t: 'ember', c: '#d49a52', s: 'candy' },
  seafoam:   { t: 'firefly', c: '#5cf0d2', s: 'shell' },
  plasma:    { t: 'confetti', c: '#ec70ff', s: 'atom' },
  autumn:    { t: 'leaf', c: '#e8702e', s: 'leaf' },
  spring:    { t: 'leaf', c: '#86e8af', s: 'flower2' },
  mocha:     { t: 'steam', c: '#a67d57', s: 'coffee' },
  nebula:    { t: 'meteor', c: '#aa9eff', s: 'orbit' },
  toxic:     { t: 'twinkle2', c: '#c6f63f', s: 'biohazard' },
  royal:     { t: 'floaty', c: '#9333ea', s: 'crown' },
  peach:     { t: 'floaty', c: '#ffb89a', s: 'apple' },
  lagoon:    { t: 'drift', c: '#34d0de', s: 'waves' },
  // ----- yana 20 mavzu -----
  lavender:  { t: 'drift', c: '#c9b8e8', s: 'flower2' },
  tangerine: { t: 'floaty', c: '#ff944d', s: 'citrus' },
  moss:      { t: 'leaf', c: '#8aab3e', s: 'leaf' },
  berry:     { t: 'confetti', c: '#d63bbf', s: 'grape' },
  slate:     { t: 'rain', c: '#94a3b8', s: 'hammer' },
  raspberry: { t: 'floaty', c: '#f24aa6', s: 'cherry' },
  olive:     { t: 'leaf', c: '#a0a020', s: 'leaf' },
  cinnamon:  { t: 'ember', c: '#cd7f33', s: 'flame' },
  azure:     { t: 'drift', c: '#4da6ff', s: 'cloud' },
  grape:     { t: 'floaty', c: '#9b4ddb', s: 'grape' },
  pistachio: { t: 'leaf', c: '#acd492', s: 'leaf' },
  cherryred: { t: 'floaty', c: '#f0223f', s: 'cherry' },
  marina:    { t: 'drift', c: '#2f8fad', s: 'anchor' },
  blush:     { t: 'petal', c: '#ffb3c6', s: 'flower' },
  charcoal:  { t: 'rain', c: '#9ca3af', s: 'hexagon' },
  starlight: { t: 'twinkle2', c: '#fff0a0', s: 'sparkles' },
  mango:     { t: 'floaty', c: '#ffc94d', s: 'citrus' },
  lilac:     { t: 'drift', c: '#d9b9d9', s: 'flower' },
  carbon:    { t: 'meteor', c: '#7d9bc0', s: 'hexagon' },
  glacier:   { t: 'spinfall', c: '#b3ecff', s: 'snowflake' },
};
// Tasodifiy tanlash uchun mavzu kalitlari — 'light' (oddiy oq) chiqmaydi
const TEMA_KEYS = Object.keys(TEMA_FX).filter((k) => k !== 'light');
// Harakat sozlamalari: zarracha soni, tezligi, o'lchami
const FX_CFG = {
  mote:    { n: 10, durMin: 6,   durMax: 10,  size: [2, 4], scatter: true },
  snow:    { n: 34, durMin: 6,   durMax: 11,  size: [3, 7] },
  rain:    { n: 24, durMin: 3.5, durMax: 7,   size: [2, 3] },
  sparkle: { n: 16, durMin: 1.6, durMax: 3.4, size: [3, 6], scatter: true },
  stars:   { n: 20, durMin: 2.5, durMax: 5,   size: [2, 4], scatter: true },
  ember:   { n: 18, durMin: 3,   durMax: 5.5, size: [3, 6] },
  steam:   { n: 14, durMin: 4,   durMax: 7,   size: [7, 14] },
  bubble:  { n: 18, durMin: 3.5, durMax: 7,   size: [5, 12] },
  fire:    { n: 26, durMin: 1.4, durMax: 3,   size: [13, 24], glow: true },
  leaf:    { n: 14, durMin: 5,   durMax: 10,  size: [13, 19] },
  // ----- yangi, boyitilgan turlar -----
  firefly: { n: 18, durMin: 4,   durMax: 8,   size: [3, 6],  scatter: true },
  confetti:{ n: 22, durMin: 3,   durMax: 6,   size: [4, 8] },
  drift:   { n: 18, durMin: 5,   durMax: 9,   size: [4, 8] },
  glint:   { n: 18, durMin: 1.8, durMax: 3.6, size: [4, 9],  scatter: true },
  meteor:  { n: 18, durMin: 2,   durMax: 4.5, size: [2, 3],  scatter: true },
  bokeh:   { n: 12, durMin: 6,   durMax: 11,  size: [10, 22] },
  petal:   { n: 14, durMin: 5,   durMax: 9,   size: [12, 18] },
  // ----- emoji-ornament harakatlari (har mavzuga xos belgi) -----
  floaty:  { n: 12, durMin: 5,   durMax: 9,   size: [13, 20] },
  spinfall:{ n: 15, durMin: 4,   durMax: 8,   size: [13, 19] },
  twinkle2:{ n: 13, durMin: 2,   durMax: 4,   size: [13, 20], scatter: true },
};

function HeaderFx({ tema }) {
  const conf = TEMA_FX[tema];
  const cfg = conf ? FX_CFG[conf.t] : null;
  const parts = useMemo(() => {
    if (!cfg) return [];
    return Array.from({ length: cfg.n }, (_, i) => ({
      left: Math.round((i / cfg.n) * 100 + (Math.random() * 8 - 4)),
      top: Math.round(Math.random() * 58),
      delay: (Math.random() * 6).toFixed(2),
      dur: (cfg.durMin + Math.random() * (cfg.durMax - cfg.durMin)).toFixed(2),
      size: Math.round(cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0])),
    }));
  }, [tema]); // eslint-disable-line
  if (!cfg) return null;
  const orn = TEMA_ORN[tema];
  return (
    <div className="hdr-fx" aria-hidden="true">
      {cfg.glow && <div className="hdr-glow-fire" />}
      {parts.map((p, i) => {
        // HERO mavzu — premium photoreal ornament (shaffof PNG, suzuvchi charm)
        if (orn) {
          if (i >= 9) return null; // 9 ta nafis charm — ortig'i yo'q
          const osz = 24 + ((i * 7) % 16); // 24..38px, xilma-xil
          const odur = (6 + (i % 5)).toFixed(2); // 6..10s, sokin suzish
          const ornMotion = conf.t === 'spinfall' || conf.t === 'petal' ? conf.t : 'floaty';
          const est = {
            left: `${p.left}%`, width: `${osz}px`, height: `${osz}px`,
            animationDelay: `${p.delay}s`, animationDuration: `${odur}s`,
            filter: `drop-shadow(0 0 6px ${conf.c})`,
          };
          return <img key={i} src={`/ornaments/${orn}.png`} alt="" className={`fx fx-orn fx-${ornMotion}`} style={est} />;
        }
        const Ico = conf.s ? FX_ICON[conf.s] : null;
        if (Ico) {
          if (i >= 14) return null; // ko'pi bilan 14 ikona — tartibli
          const sz = Math.max(p.size, 13);
          const est = { left: `${p.left}%`, color: conf.c, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` };
          if (cfg.scatter) est.top = `${p.top}px`;
          return (
            <span key={i} className={`fx fx-ico fx-${conf.t}`} style={est}>
              <Ico size={sz} strokeWidth={2.1} absoluteStrokeWidth />
            </span>
          );
        }
        if (conf.g) {
          const est = { left: `${p.left}%`, fontSize: `${p.size}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` };
          if (cfg.scatter) est.top = `${p.top}px`;
          return <span key={i} className={`fx fx-${conf.t}`} style={est}>{conf.g}</span>;
        }
        const st = { left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` };
        if (conf.t === 'bubble') { st.borderColor = conf.c; } else { st.background = conf.c; st.boxShadow = `0 0 6px ${conf.c}`; }
        if (cfg.scatter) st.top = `${p.top}px`;
        return <span key={i} className={`fx fx-${conf.t}`} style={st} />;
      })}
    </div>
  );
}

// ----- Til tanlagich (header'da, istalgan paytda) — ixcham dropdown -----
const TIL_SHORT = { uz: 'UZ', kr: 'КИР', ru: 'РУ' };
function TilSwitcher({ til, setTil }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const cur = TILLAR.find((t) => t.id === til) || TILLAR[0];
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} title="Til / Тил / Язык"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition">
        <Languages className="w-3.5 h-3.5" />
        <span>{TIL_SHORT[cur.id] || cur.nom}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden z-50">
          {TILLAR.map((t) => (
            <button key={t.id} onClick={() => { setTil(t.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition ${
                til === t.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}>
              {t.nom}
              {til === t.id && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [authReady, setAuthReady]     = useState(false);
  const [usersReady, setUsersReady]   = useState(false);
  const [users, setUsers]             = useState([]);
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem('current-user'));
  const [loading, setLoading]         = useState(true);
  const [online, setOnline]           = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [searchOpen, setSearchOpen]   = useState(false);
  const [keys, setKeys]               = useState(getKeys);
  const [tema, setTema]               = useState(() => localStorage.getItem('tema') || 'light');
  // Mavzu rejimi: 'random' — har bo'lim almashganda tasodifiy mavzu; 'fixed' — doimiy
  const [temaMode, setTemaMode]       = useState(() => localStorage.getItem('tema-mode') || 'fixed');
  const [diceTick, setDiceTick]       = useState(0);
  const [shrift, setShrift]           = useState(() => localStorage.getItem('shrift') || 'oddiy');
  const [til, setTil]                 = useState(getTil);
  const [tab, setTab]               = useState('new');
  const [tunikaBaza, setTunikaBaza] = useState(DEFAULT_TUNIKA_BAZA);
  const [latokData, setLatokData]   = useState(DEFAULT_LATOK);
  const [shopName, setShopName]     = useState(DEFAULT_SHOP_NAME);
  const [shopPhone, setShopPhone]   = useState('');
  const [tgToken, setTgToken]       = useState('');   // Telegram bot token (Kazirok DXF yuborish)
  const [tgChatId, setTgChatId]     = useState('');   // Telegram chat/kanal IDsi (eski — zaxira)
  const [tgChats, setTgChats]       = useState([]);   // Ko'p manzil: [{id, nom, chatId}] (guruh/kanal/shaxsiy)
  const [libHandle, setLibHandle]   = useState(null); // Mijozlar kutubxonasi root papka (File System Access)
  const [usdRate, setUsdRate]       = useState(DEFAULT_USD_RATE);
  const [usdOlish, setUsdOlish]     = useState(DEFAULT_USD_RATE);
  const [products, setProducts]     = useState(DEFAULT_PRODUCTS);
  const [aksessuarlar, setAksessuarlar] = useState(DEFAULT_AKSESSUARLAR);
  const [kaziroklar, setKaziroklar]   = useState(DEFAULT_KAZIROKLAR);
  const [kazTurlari, setKazTurlari]   = useState(DEFAULT_KAZ_TURLARI); // narxlar > Kazirok turlari (fasonlar)
  const [metrlilar, setMetrlilar]   = useState([]);
  const [ranglar, setRanglar]       = useState([]);
  const [klentlar, setKlentlar]     = useState([]);
  const [ustalar, setUstalar]       = useState([]);
  const [orders, setOrders]         = useState([]);
  const [ishchilar, setIshchilar]   = useState([]);
  const [lavozimlar, setLavozimlar] = useState([]);
  const [qobiliyatlar, setQobiliyatlar] = useState([]);
  const [kamchiliklar, setKamchiliklar] = useState([]);
  const [yoqlama, setYoqlama]       = useState({});
  const [avanslar, setAvanslar]     = useState({});
  const [jurnal, setJurnal]         = useState([]); // amallar jurnali (audit log)
  const [draft, setDraft]           = useState(() => {
    try {
      const raw = localStorage.getItem('tunika-draft');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* noop */ }
    return makeBlankDraft(DEFAULT_USD_RATE);
  });
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [editingId, setEditingId]   = useState(null); // tahrirlanayotgan zakas id (null = yangi)
  const [toast, setToast]           = useState('');
  const [savedAnim, setSavedAnim]   = useState(false);
  const [payModal, setPayModal]     = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [productPicker, setProductPicker] = useState(false);
  const [clientPicker, setClientPicker]   = useState(false);
  const [masterPicker, setMasterPicker]   = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId) || null;
  const role = currentUser?.role || 'ishchi';

  // Ruxsat etilmagan bo'limga tushib qolsa — Savdoga qaytariladi
  useEffect(() => {
    if (currentUser && !tabKoradi(role, tab)) setTab('new');
  }, [currentUser, role, tab]);

  // ----- Anonim kirish (Firestore qoidalari uchun) -----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setAuthReady(true);
      else signInAnonymously(auth).catch((e) => console.error('Anon auth xatosi:', e));
    });
    return () => unsub();
  }, []);

  // ----- Real-vaqt obuna (Firestore onSnapshot) — anon kirilgach -----
  useEffect(() => {
    if (!authReady) return undefined;
    const subs = [
      ['tunika-baza', setTunikaBaza],
      ['latok-data', setLatokData],
      ['orders', setOrders],
      ['shop-name', setShopName],
      ['shop-phone', setShopPhone],
      ['telegram-bot-token', setTgToken],
      ['telegram-chat-id', setTgChatId],
      ['telegram-dxf-chats', (v) => setTgChats(Array.isArray(v) ? v : [])],
      ['ustalar', setUstalar],
      ['klentlar', setKlentlar],
      ['usd-rate', (v) => setUsdRate(Number(v) || DEFAULT_USD_RATE)],
      ['usd-olish', (v) => setUsdOlish(Number(v) || DEFAULT_USD_RATE)],
      ['dynamic-products', setProducts],
      ['ishchilar', setIshchilar],
      ['yoqlama', setYoqlama],
      ['avanslar', setAvanslar],
      ['aksessuarlar', (v) => setAksessuarlar((v || []).map((a) => ({
        ...a, birlik: a.birlik || (/semichka|tom samarez/i.test(a.nomi) ? 'kg' : 'dona'),
      })))],
      ['kaziroklar', (v) => setKaziroklar(v || [])],
      ['kazirok-turlari', (v) => setKazTurlari(Array.isArray(v) ? v : DEFAULT_KAZ_TURLARI)],
      ['metrlilar', setMetrlilar],
      ['ranglar', setRanglar],
      ['lavozimlar', setLavozimlar],
      ['qobiliyatlar', setQobiliyatlar],
      ['kamchiliklar', setKamchiliklar],
      ['jurnal', setJurnal],
    ];
    let pending = subs.length;
    const unsubs = subs.map(([key, set]) => storage.subscribe(key, (value) => {
      if (value != null) set(value);
      if (pending > 0) { pending -= 1; if (pending === 0) setLoading(false); }
    }));
    // Foydalanuvchilar (login/adminlar) — alohida; bo'sh bo'lsa asoschi seed qilinadi
    const unsubUsers = storage.subscribe('users', (value) => {
      if (value && value.length) setUsers(value);
      else { setUsers([FOUNDER]); storage.save('users', [FOUNDER]); }
      setUsersReady(true);
    });
    return () => { unsubs.forEach((u) => u()); unsubUsers(); };
  }, [authReady]);

  // Yozilayotgan zakasni avtomatik saqlash (sahifa yangilansa yo'qolmasin)
  useEffect(() => {
    try { localStorage.setItem('tunika-draft', JSON.stringify(draft)); } catch (e) { /* noop */ }
  }, [draft]);

  // Mavzu qo'llash + saqlash
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-theme', tema);
    el.classList.toggle('themed', tema !== 'light');
    try { localStorage.setItem('tema', tema); } catch (e) { /* noop */ }
  }, [tema]);

  // Mavzu rejimini saqlash
  useEffect(() => {
    try { localStorage.setItem('tema-mode', temaMode); } catch (e) { /* noop */ }
  }, [temaMode]);

  // Hozirgidan boshqa tasodifiy mavzuga sakrash (light ham kiradi)
  function jumpRandomTema() {
    setDiceTick((t) => t + 1);
    setTema((prev) => {
      const pool = TEMA_KEYS.filter((k) => k !== prev);
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }

  // "Random" tugmasi — rejimni yoqadi va darhol sakraydi (xohlagancha bosish mumkin)
  function pickRandomTema() { setTemaMode('random'); jumpRandomTema(); }

  // Katta bo'lim almashganda — random rejimda tasodifiy mavzuga o'tadi
  function handleTab(k) {
    if (k === tab) return;
    setTab(k);
    if (temaMode === 'random') jumpRandomTema();
  }

  // Umumiy shrift o'lchami — ildiz font-size'iga qo'llanadi (hamma yozuv mutanosib o'zgaradi)
  useEffect(() => {
    const olcham = { kichik: '14px', oddiy: '16px', katta: '18px', juda: '20px' }[shrift] || '16px';
    document.documentElement.style.fontSize = olcham;
    try { localStorage.setItem('shrift', shrift); } catch (e) { /* noop */ }
  }, [shrift]);

  // Til (uz lotin / kiril / rus) — butun ilova matnini global o'giradi
  useEffect(() => { applyTil(til); }, [til]);

  // Dollar kursini avtomatik yangilash (olish + sotish) — ochilganda va kun davomida (har 3 soatda)
  useEffect(() => {
    if (!authReady) return undefined;
    if (localStorage.getItem('usd-auto') !== '1') return undefined;
    const yangila = () => fetchKurslar()
      .then(({ olish, sotish }) => { updateUsdRate(sotish); updateUsdOlish(olish); })
      .catch(() => { /* noop */ });
    yangila();
    const id = setInterval(yangila, 3 * 60 * 60 * 1000); // har 3 soatda
    return () => clearInterval(id);
  }, [authReady]);

  // Sichqoncha O'RTA tugmasi — brauzerning avto-aylantirish (autoscroll)
  // belgisi chiqmasin (chizmada pan uchun ishlatiladi, boshqa joyda ham kerak emas)
  useEffect(() => {
    function onMid(e) { if (e.button === 1) e.preventDefault(); }
    document.addEventListener('mousedown', onMid);
    return () => document.removeEventListener('mousedown', onMid);
  }, []);

  // Tugmalar bosilganda yengil "ripple" to'lqini — global, layoutni buzmaydi
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    function onDown(e) {
      const btn = e.target.closest?.('button, label.bg-slate-900, [role="button"]');
      if (!btn || btn.disabled) return;
      const rect = btn.getBoundingClientRect();
      const x = e.clientX || rect.left + rect.width / 2;
      const y = e.clientY || rect.top + rect.height / 2;
      // bosilgan nuqtadan eng uzoq burchakgacha (tabiiy tarqalish), 240px gacha cheklangan
      const dx = Math.max(x - rect.left, rect.right - x);
      const dy = Math.max(y - rect.top, rect.bottom - y);
      const d = Math.min(2 * Math.hypot(dx, dy), 240);
      const blob = document.createElement('span');
      blob.className = 'ripple-blob';
      blob.style.left = `${x}px`;
      blob.style.top = `${y}px`;
      blob.style.width = `${d}px`;
      blob.style.height = `${d}px`;
      // to'q (accent) tugmalarda oq, ochiqlarda accent rangli to'lqin
      const dark = btn.classList.contains('bg-slate-900') || btn.classList.contains('text-white');
      blob.style.background = dark
        ? 'rgba(255,255,255,.45)'
        : 'color-mix(in srgb, var(--c-btn) 32%, transparent)';
      document.body.appendChild(blob);
      const kill = () => blob.remove();
      blob.addEventListener('animationend', kill);
      setTimeout(kill, 700);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  }

  // Internet holati — offline'da tepada belgi chiqadi
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Global qidiruv — sozlanadigan yorliq (standart Ctrl/Cmd+K)
  useEffect(() => {
    function onKey(e) {
      if (matchCombo(e, keys.qidiruv)) { e.preventDefault(); setSearchOpen(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys.qidiruv]);

  function updateKeys(next) { setKeys(next); saveKeys(next); }

  // Zaxira eslatmasi — 7 kundan beri (yoki hech qachon) olinmagan bo'lsa, sessiyada bir marta
  useEffect(() => {
    if (loading) return;
    try {
      if (sessionStorage.getItem('zaxira-eslatma')) return;
      const last = localStorage.getItem('oxirgi-zaxira');
      const kun = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
      if (kun >= 7) {
        sessionStorage.setItem('zaxira-eslatma', '1');
        setTimeout(() => showToast(
          last ? `Zaxira ${Math.floor(kun)} kun oldin olingan — Sozlamalar → Zaxira` : 'Hali zaxira olinmagan — Sozlamalar → Zaxira',
        ), 1800);
      }
    } catch (e) { /* noop */ }
  }, [loading]);

  async function persist(key, value) {
    try { await storage.save(key, value); }
    catch (e) { console.error('Saqlashda xatolik:', e); showToast('Saqlashda xatolik'); }
  }

  // Faqat o'zgargan katakni yozadi (merge) — kamera/bot bilan to'qnashmaydi.
  async function persistField(key, partial) {
    try { await storage.saveField(key, partial); }
    catch (e) { console.error('Saqlashda xatolik:', e); showToast('Saqlashda xatolik'); }
  }

  // ----- Amallar jurnali (audit log): kim nima qildi -----
  const jurnalRef = useRef(jurnal);
  useEffect(() => { jurnalRef.current = jurnal; }, [jurnal]);
  function pushLog(user, amal, detail = '') {
    const entry = {
      id: genId(),
      ts: new Date().toISOString(),
      userId: user?.id || '',
      userLogin: user?.login || '—',
      role: user?.role || '',
      amal,
      detail,
    };
    const next = [entry, ...jurnalRef.current].slice(0, 500); // oxirgi 500 ta
    jurnalRef.current = next;
    setJurnal(next);
    persist('jurnal', next);
  }
  function logAction(amal, detail = '') { pushLog(currentUser, amal, detail); }
  function updateJurnal(v) { jurnalRef.current = v; setJurnal(v); persist('jurnal', v); }

  function doLogin(login, parol) {
    const l = (login || '').trim().toLowerCase();
    const u = users.find((x) => x.login.toLowerCase() === l && x.parol === parol);
    if (!u) return false;
    localStorage.setItem('current-user', u.id);
    setCurrentUserId(u.id);
    pushLog(u, 'kirdi');
    return true;
  }
  function doLogout() {
    if (currentUser) pushLog(currentUser, 'chiqdi');
    localStorage.removeItem('current-user');
    setCurrentUserId(null);
  }
  function updateUsers(v) { setUsers(v); persist('users', v); }

  function updateTunikaBaza(v) { setTunikaBaza(v); persist('tunika-baza', v); }
  function updateLatokData(v)  { setLatokData(v);  persist('latok-data', v); }
  function updateShopName(v)   { setShopName(v);   persist('shop-name', v); }
  function updateShopPhone(v)  { setShopPhone(v);  persist('shop-phone', v); }
  function updateTgToken(v)    { setTgToken(v);    persist('telegram-bot-token', v); }
  function updateTgChatId(v)   { setTgChatId(v);   persist('telegram-chat-id', v); }
  function updateTgChats(v)    { setTgChats(v);    persist('telegram-dxf-chats', v); }
  // Guruh superguruhga aylansa — Telegram yangi chat ID beradi; uni saqlaymiz
  function onTgChatMigrated(oldId, newId) {
    const o = String(oldId), n = String(newId);
    setTgChats((prev) => {
      const next = (prev || []).map((c) => (String(c.chatId) === o ? { ...c, chatId: n } : c));
      persist('telegram-dxf-chats', next);
      return next;
    });
    // Eski yagona maydon — closure'siz (eng so'nggi qiymatga qarab) yangilanadi
    setTgChatId((prev) => {
      if (String(prev) !== o) return prev;
      persist('telegram-chat-id', n);
      return n;
    });
    showToast('Guruh superguruhga aylandi — yangi ID saqlandi');
  }
  // Mijozlar kutubxonasi (File System Access) — handle IndexedDB'da (Firestore emas, qurilmada)
  async function pickLibraryFolder() {
    try {
      const h = await pickLibrary();
      if (h) { setLibHandle(h); showToast('Kutubxona papkasi tanlandi: ' + h.name); }
      else showToast('Papka tanlanmadi');
    } catch (e) {
      if (e && e.name !== 'AbortError') showToast('Papka tanlanmadi: ' + (e.message || e.name || 'xato'));
    }
  }
  async function clearLibraryFolder() { await clearLibrary(); setLibHandle(null); showToast('Kutubxona bog\'lanishi o\'chirildi'); }
  useEffect(() => { getLibrary().then((h) => { if (h) setLibHandle(h); }).catch(() => {}); }, []);
  function updateUsdRate(v)    { setUsdRate(v);    persist('usd-rate', v); }
  function updateUsdOlish(v)   { setUsdOlish(v);   persist('usd-olish', v); }
  function updateProducts(v)   { setProducts(v);   persist('dynamic-products', v); }
  function updateAksessuarlar(v) { setAksessuarlar(v); persist('aksessuarlar', v); }
  function updateKaziroklar(v)   { setKaziroklar(v);   persist('kaziroklar', v); }
  function updateKazTurlari(v)    { setKazTurlari(v);   persist('kazirok-turlari', v); }
  function updateMetrlilar(v)  { setMetrlilar(v);  persist('metrlilar', v); }
  function updateRanglar(v)    { setRanglar(v);    persist('ranglar', v); }
  function updateUstalar(v)    { setUstalar(v);    persist('ustalar', v); }
  function updateKlentlar(v)   { setKlentlar(v);   persist('klentlar', v); }
  function updateOrders(v)     { setOrders(v);     persist('orders', v); }
  function updateIshchilar(v)  { setIshchilar(v);  persist('ishchilar', v); }
  function updateLavozimlar(v) { setLavozimlar(v); persist('lavozimlar', v); }
  function updateQobiliyatlar(v) { setQobiliyatlar(v); persist('qobiliyatlar', v); }
  function updateKamchiliklar(v) { setKamchiliklar(v); persist('kamchiliklar', v); }
  function updateYoqlama(v)    { setYoqlama(v);    persist('yoqlama', v); }
  // Yo'qlama — bitta ishchining bitta kunini yozadi (merge). Butun hujjatni
  // qayta yozmaydi, shu sabab kamera avto-yozuvi bilan to'qnashmaydi.
  function setYoqlamaKun(sana, ishchiId, holat) {
    setYoqlama((prev) => {
      const kun = { ...(prev[sana] || {}) };
      if (holat == null) delete kun[ishchiId]; else kun[ishchiId] = holat;
      return { ...prev, [sana]: kun };
    });
    persistField('yoqlama', { [sana]: { [ishchiId]: holat == null ? O_CHIR : holat } });
  }
  // Bir kunda bir nechta ishchini birdaniga belgilash ("Hammasi keldi").
  function setYoqlamaBulk(sana, map) {
    setYoqlama((prev) => ({ ...prev, [sana]: { ...(prev[sana] || {}), ...map } }));
    persistField('yoqlama', { [sana]: map });
  }
  function updateAvanslar(v)   { setAvanslar(v);   persist('avanslar', v); }

  // ----- Kazirok (chizmadan, avtomatik) — savdo hisobiga ulanadi -----
  // Chizma `chizma:kazirok` hodisasidan kelgan ma'lumot + qo'lda tahrirlangan
  // 1 metr narxi. Hisob-kitob (umumiy summa/qarz) shu yerdan ham oziqlanadi.
  const [kazData, setKazData] = useState(() => readChizmaKazirok());
  const [kazNarx, setKazNarx] = useState(() => readKazNarx());
  useEffect(() => {
    const on = (e) => setKazData(e?.detail?.groups ? e.detail : readChizmaKazirok());
    window.addEventListener('chizma:kazirok', on);
    setKazData(readChizmaKazirok());
    return () => window.removeEventListener('chizma:kazirok', on);
  }, []);
  function setKazPrice(id, v) { const next = { ...kazNarx, [id]: v }; setKazNarx(next); saveKazNarx(next); }

  // ----- Draft buyurtma hisob-kitoblari -----
  const draftCalc = useMemo(() => {
    const ctx = { tunikaBaza, metrlilar, aksessuarlar, kaziroklar, products };
    const items = draft.items.map((it) => ({ ...it, ...calcItem(it, ctx) }));

    // Semichka 3.1 — har doim "xomid"da turgan rang bilan bir xil
    const xomid = items.find((x) => /xomid/i.test(x.nomi || ''));
    if (xomid && xomid.rang) {
      items.forEach((x) => {
        if (/semich/i.test(x.nomi || '') && /3\s*[.,]\s*1/.test(x.nomi || '')) x.rang = xomid.rang;
      });
    }

    const tovarSum = items.reduce((s, x) => s + x.jamiSumma, 0);
    // Hisob-kitob "ochiq" bo'lishi uchun tovarlarni aksessuardan ajratamiz
    // (chek va savdo paneli har bir bo'lakni alohida ko'rsatadi — summa qayerdan kelganini mijoz ko'radi).
    const mahsulotSum = items.reduce((s, x) => s + (x.kind === 'aksessuar' ? 0 : x.jamiSumma), 0);
    const aksessuarSum = items.reduce((s, x) => s + (x.kind === 'aksessuar' ? x.jamiSumma : 0), 0);
    // Kazirok (chizmadan, avtomatik) — har List bo'yicha material + 25% xizmat.
    // jami (= material × 1.25) umumiy summaga qo'shiladi.
    const kaz = computeKazRows(kazData, tunikaBaza, kazNarx);
    // Dastafka: "ichida" bo'lsa narxga kiritilgan (qo'shilmaydi), aks holda summa qo'shiladi
    const dastafkaIchida = !!draft.dastafka?.ichida;
    const dastafkaSumma = dastafkaIchida ? 0 : (parseFloat(draft.dastafka?.summa) || 0);
    const totalSum = tovarSum + kaz.totalJami + dastafkaSumma;
    const totalPaid = draft.payments.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      return sum + (p.method === 'Dollorda' ? amt * p.rate : amt);
    }, 0);

    const debt = Math.max(0, totalSum - totalPaid);
    return {
      items, tovarSum, mahsulotSum, aksessuarSum, dastafkaIchida, dastafkaSumma, totalSum, totalPaid, debt,
      kazRows: kaz.rows, kazTotalJami: kaz.totalJami, kazTotalMaterial: kaz.totalMaterial, kazTotalXizmat: kaz.totalXizmat,
    };
  }, [draft, tunikaBaza, metrlilar, aksessuarlar, kaziroklar, products, kazData, kazNarx]);

  // ----- Zakas saqlash -----
  function saveOrder() {
    if (!draft.customer.name.trim()) { showToast('Mijozni tanlang'); return false; }
    if (draft.items.length === 0)    { showToast('Kamida 1 ta tovar qo\'shing'); return false; }
    if (draftCalc.totalSum <= 0)     { showToast('Uzunlik yoki sonini kiriting'); return false; }

    const status = draftCalc.debt === 0 ? 'paid' : draftCalc.totalPaid > 0 ? 'partial' : 'unpaid';

    // Kazirok payloadini zakas bilan saqlash uchun ixchamlash (svg matnini olib
    // tashlaymiz — chek/DXF uchun faqat segs va o'lchamlar kerak).
    const kazSlim = (kd) => {
      const drop = (it) => { if (!it) return it; const { svg, ...rest } = it; return rest; };
      return {
        groups: ((kd && kd.groups) || []).map((g) => ({ offCm: g.offCm, pat: drop(g.pat), pal: drop(g.pal) })),
        qoz: ((kd && kd.qoz) || []).map(drop),   // tashqi burchak qozonlar (svg'siz — chek/DXF uchun)
      };
    };

    // Yangi va tahrirlangan zakasga umumiy maydonlar (raqam/sana/holat alohida)
    const common = {
      customer: { ...draft.customer },
      masterId: draft.masterId,
      masterName: draft.masterName,
      items: draftCalc.items.map((it) => ({
        id: it.id,
        kind: it.kind,
        nomi: it.nomi,
        tafsilot: it.tafsilot,
        birlik: it.birlik,
        bolishLabel: it.bolishLabel,
        uzunlik: parseFloat(it.uzunlik) || 0,
        soni: parseFloat(it.soni) || 0,
        birBirlikNarxi: it.birBirlikNarxi,
        jamiSumma: it.jamiSumma,
        tanNarx: Math.round((it.tanNarxBirlik || 0) * (it.jamiMeyor || 0)), // foyda hisobi uchun tan narx
        rang: it.rang || '',
        teskariQuloq: !!it.teskariQuloq,
      })),
      payments: draft.payments.filter((p) => (parseFloat(p.amount) || 0) > 0).map((p) => ({
        ...p, amount: parseFloat(p.amount) || 0
      })),
      dastafka: { ichida: draftCalc.dastafkaIchida, summa: draftCalc.dastafkaSumma },
      totalSum: draftCalc.totalSum,
      totalPaid: draftCalc.totalPaid,
      debt: draftCalc.debt,
      // Kazirok (chizmadan) — zakas bilan saqlanadi; chek/Zakaslarda DXF (4m/6m) shu yerdan
      kazData: kazSlim(kazData),
      kazRows: draftCalc.kazRows || [],
      notes: draft.notes,
      status,
      // Tahrirlash/nusxa uchun — xom qatorlar (katalog id, narx turi, variant saqlanadi)
      srcItems: draft.items.map((it) => ({ ...it })),
    };

    // ----- TAHRIRLASH: mavjud zakasni yangilaymiz (raqam/sana/holat/vaqtlar saqlanadi) -----
    if (editingId) {
      let upd = null;
      const list = orders.map((o) => (o.id === editingId ? (upd = { ...o, ...common }) : o));
      if (!upd) { setEditingId(null); showToast('Tahrirlanayotgan zakas topilmadi'); return false; }
      updateOrders(list);
      logAction('zakas_tahrirladi', `№${upd.number} · ${upd.customer.name} · ${fmt(upd.totalSum)} so'm`);
      setDraft(makeBlankDraft(usdRate));
      setEditingId(null);
      setSavedAnim(true);
      setTimeout(() => setSavedAnim(false), 1500);
      showToast(`Zakas №${upd.number} yangilandi`);
      setReceiptOrder(upd);
      return true;
    }

    // ----- YANGI ZAKAS -----
    const newOrder = {
      id: genId(),
      number: (orders[0]?.number || 0) + 1,
      createdAt: new Date().toISOString(),
      ...common,
      holat: 'jarayon', // ishlab chiqarish holati: jarayon → tayyor → yopilgan
    };

    updateOrders([newOrder, ...orders]);
    logAction('zakas_yaratdi', `№${newOrder.number} · ${newOrder.customer.name} · ${fmt(newOrder.totalSum)} so'm`);
    setDraft(makeBlankDraft(usdRate));
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 1500);
    showToast(`Zakas saqlandi, tartib raqami: ${newOrder.number}`);
    setReceiptOrder(newOrder);
    return true;
  }

  // ----- Saqlangan zakasni tahrirlashga yuklash -----
  function editOrder(order) {
    const ctx = { tunikaBaza, metrlilar, aksessuarlar, kaziroklar };
    let items;
    if (order.srcItems?.length) {
      items = order.srcItems.map((it) => ({ ...it, id: genId() }));
    } else {
      items = [];
      (order.items || []).forEach((it) => { const d = orderItemToDraft(it, ctx); if (d) items.push(d); });
      if (!items.length) { showToast('Bu zakasni tahrirlab bo\'lmaydi (tovarlar katalogda yo\'q)'); return; }
    }
    setDraft({
      ...makeBlankDraft(usdRate),
      customer: { ...order.customer },
      masterId: order.masterId, masterName: order.masterName,
      items,
      payments: (order.payments && order.payments.length) ? order.payments.map((p) => ({ ...p })) : [makeBlankPayment(usdRate)],
      notes: order.notes || '',
      dastafka: order.dastafka ? { ...order.dastafka } : { ichida: false, summa: '' },
    });
    setEditingId(order.id);
    setTab('new');
    showToast(`Zakas №${order.number} tahrirlanmoqda`);
  }

  // Tahrirlashni bekor qilish — bo'sh holatga qaytaramiz
  function cancelEdit() {
    setEditingId(null);
    setDraft(makeBlankDraft(usdRate));
    showToast('Tahrirlash bekor qilindi');
  }

  // ----- Oxirgi zakasdan nusxa olish (doimiy mijozlar uchun) -----
  // Mijoz tanlangan bo'lsa — o'sha mijozning oxirgi zakasi, aks holda umuman oxirgisi.
  // srcItems bo'lsa (yangi zakas) — to'g'ridan-to'g'ri; aks holda (eski zakas)
  // items katalogdan nom bo'yicha qaytadan tiklanadi.
  // mode: 'joriy' — joriy katalog narxi (default) | 'eski' — eski narxni qotirib saqlash
  function copyLastOrder(mode = 'joriy') {
    const src = draft.customer.clientId
      ? orders.find((o) => o.customer?.clientId === draft.customer.clientId)
      : orders[0];
    if (!src) { showToast('Nusxa olish uchun saqlangan zakas topilmadi'); return; }
    const eskiNarx = mode === 'eski';

    let items;
    let skipped = 0;
    if (src.srcItems?.length) {
      // Eski narxni qotirish uchun saqlangan items dagi bir birlik narxini id bo'yicha olamiz
      const narxById = {};
      (src.items || []).forEach((it) => { narxById[it.id] = it.birBirlikNarxi; });
      items = src.srcItems.map((it) => {
        const yangi = { ...it, id: genId() };
        if (eskiNarx && narxById[it.id] > 0) yangi.narxOverride = narxById[it.id];
        return yangi;
      });
    } else {
      const ctx = { tunikaBaza, metrlilar, aksessuarlar, kaziroklar };
      items = [];
      (src.items || []).forEach((it) => {
        const d = orderItemToDraft(it, ctx);
        if (!d) { skipped += 1; return; }
        if (eskiNarx && it.birBirlikNarxi > 0) d.narxOverride = it.birBirlikNarxi;
        items.push(d);
      });
    }

    if (!items.length) { showToast('Bu zakas tovarlarini nusxalab bo\'lmadi (katalogda topilmadi)'); return; }
    setDraft({
      ...makeBlankDraft(usdRate),
      customer: { ...src.customer },
      masterId: src.masterId, masterName: src.masterName,
      items,
    });
    const narxTxt = eskiNarx ? 'eski narx bilan' : 'joriy narx bilan';
    showToast(skipped
      ? `Zakas №${src.number} dan ${narxTxt} nusxa olindi (${skipped} ta tovar o'tkazildi)`
      : `Zakas №${src.number} dan ${narxTxt} nusxa olindi`);
  }

  function openAddPaymentModal(order) {
    setPayModal({ orderId: order.id, payments: [makeBlankPayment(usdRate)] });
  }

  function applyLaterPayment() {
    if (!payModal) return;
    const addedSum = payModal.payments.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      return sum + (p.method === 'Dollorda' ? amt * p.rate : amt);
    }, 0);

    if (addedSum <= 0) { showToast('To\'lov summasini kiriting'); return; }

    const updated = orders.map((o) => {
      if (o.id !== payModal.orderId) return o;
      const validNewPayments = payModal.payments.filter((p) => (parseFloat(p.amount) || 0) > 0).map((p) => ({
        ...p, amount: parseFloat(p.amount) || 0
      }));
      const newPaid = o.totalPaid + addedSum;
      const newDebt = Math.max(0, o.totalSum - newPaid);
      return {
        ...o,
        payments: [...(o.payments || []), ...validNewPayments],
        totalPaid: newPaid,
        debt: newDebt,
        status: newDebt === 0 ? 'paid' : 'partial'
      };
    });

    updateOrders(updated);
    const o = orders.find((x) => x.id === payModal.orderId);
    logAction('tolov_qoshdi', `${o ? `№${o.number} · ` : ''}${fmt(Math.round(addedSum))} so'm`);
    setPayModal(null);
    showToast('To\'lov qabul qilindi');
  }

  function deleteOrder(id) {
    const o = orders.find((x) => x.id === id);
    updateOrders(orders.filter((x) => x.id !== id));
    setConfirmDel(null);
    logAction('zakas_ochirdi', o ? `№${o.number} · ${o.customer?.name || ''}` : id);
    showToast('Zakas o\'chirildi');
  }

  function setOrderHolat(order, holat) {
    const now = new Date().toISOString();
    updateOrders(orders.map((o) => {
      if (o.id !== order.id) return o;
      const next = { ...o, holat };
      // Vaqt belgilari: tayyorAt (jarayon→tayyor), yopilganAt (tayyor→chiqib ketti)
      if (holat === 'tayyor') { next.tayyorAt = now; next.yopilganAt = null; }
      else if (holat === 'yopilgan') { if (!next.tayyorAt) next.tayyorAt = now; next.yopilganAt = now; }
      else if (holat === 'jarayon') { next.tayyorAt = null; next.yopilganAt = null; }
      return next;
    }));
    const holatNomi = { jarayon: 'Jarayonda', tayyor: 'Tayyor', yopilgan: 'Yopilgan (chiqib ketdi)' }[holat] || holat;
    logAction('holat_ozgartirdi', `№${order.number} → ${holatNomi}`);
    const msg = { jarayon: 'Zakas qayta ochildi (jarayonda)', tayyor: 'Zakas tayyor bo\'ldi', yopilgan: 'Zakas yopildi (chiqib ketdi)' }[holat];
    showToast(msg || 'Holat o\'zgartirildi');
  }

  function onProductSelected(descs) {
    // Picker bir nechta tovarni belgilab "Saqlash" qiladi — massiv keladi.
    // (Eski bitta-tovar chaqiruvlari ham ishlashi uchun yagona obyektni ham qabul qilamiz.)
    const list = Array.isArray(descs) ? descs : [descs];
    if (!list.length) { setProductPicker(false); return; }
    // Oxirgi tanlangan List/tunikani eslab qolamiz — keyingi tovarda ham o'sha tursin
    let lastTunikaId = [...draft.items].reverse().find((it) => it.tunikaId)?.tunikaId || '';
    const newItems = [];
    for (const desc of list) {
      const item = makeBlankItem(desc, tunikaBaza, lastTunikaId);
      // Aksessuarga rang: qoziq lenta/germetika — rangsiz; semichka 3,1 — "xomid"; aks holda — List rangi
      if (item.kind === 'aksessuar') {
        const a = aksessuarlar.find((x) => x.id === item.aksId);
        const nom = (a?.nomi || '');
        if (!aksRangKerak(nom)) item.rang = '';
        else { const t = tunikaBaza.find((x) => x.id === lastTunikaId); item.rang = t ? rangTozala(t.nomi) : ''; }
        // Tirsak: joriy zakasda nechta varyonka bo'lsa, shuncha tirsak qo'yilsin
        if (nom.toLowerCase().startsWith('tirsak')) {
          const totalVaryonka = draft.items.reduce((sum, it) => {
            if (it.kind !== 'aksessuar') return sum;
            const aks = aksessuarlar.find((x) => x.id === it.aksId);
            return aks && aks.nomi.toLowerCase().startsWith('varyonka') ? sum + (parseInt(it.soni) || 0) : sum;
          }, 0);
          if (totalVaryonka > 0) item.soni = String(totalVaryonka);
        }
      }
      // Kazirokga rang: qoziq lenta/germetika — rangsiz; aks holda — List rangi
      if (item.kind === 'kazirok') {
        const k = kaziroklar.find((x) => x.id === item.kazId);
        const nom = (k?.nomi || '');
        if (!aksRangKerak(nom)) item.rang = '';
        else { const t = tunikaBaza.find((x) => x.id === lastTunikaId); item.rang = t ? rangTozala(t.nomi) : ''; }
      }
      if (item.tunikaId) lastTunikaId = item.tunikaId; // keyingi tovarlar shu Listni meros olsin
      newItems.push(item);
    }
    setDraft({ ...draft, items: [...draft.items, ...newItems] });
    setProductPicker(false);
  }

  function onClientSelected(client) {
    setDraft({
      ...draft,
      customer: {
        clientId: client.id, name: client.name,
        phones: client.phones || [''], address: client.address || '', orientir: client.orientir || '',
      },
    });
    setClientPicker(false);
  }
  function onMasterSelected(usta) {
    setDraft({ ...draft, masterId: usta.id, masterName: usta.name });
    setMasterPicker(false);
  }

  if (!authReady || !usersReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="flex items-center gap-3 text-slate-700">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">Ulanmoqda...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={doLogin} shopName={shopName} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen pb-10 bg-app">
        <header className="bg-white border-b-2 border-slate-900 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 pt-3 flex justify-end">
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="max-w-7xl mx-auto px-4 pb-3 pt-1.5">
            <div className="skeleton h-7 w-48 mb-2" />
            <div className="skeleton h-3 w-36" />
          </div>
          <nav className="max-w-7xl mx-auto px-2 pt-2 pb-2.5 flex gap-1 border-t border-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton flex-1 min-w-[66px] h-9 rounded-xl" />
            ))}
          </nav>
        </header>
        <main className="max-w-7xl mx-auto px-4 pt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="skeleton w-7 h-7 rounded-lg" />
                <div className="skeleton h-4 w-40" />
              </div>
              <div className="space-y-2.5">
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-5/6" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10 bg-app">
      <header className="bg-white border-b-2 border-slate-900 sticky top-0 z-20 no-print">
        <div className="max-w-7xl mx-auto px-4 pt-2 flex justify-end items-center gap-2 sm:gap-3">
          {/* Internet yo'q — offline belgisi */}
          {!online && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold mr-auto" title="Internet yo'q — ulanish tiklanganda saqlanadi">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
          {/* Global qidiruv */}
          <button onClick={() => setSearchOpen(true)} title="Qidirish (Ctrl+K)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Qidiruv</span>
          </button>
          {/* Til — istalgan paytda almashtirish uchun tepada */}
          <TilSwitcher til={til} setTil={setTil} />
          {/* Mavzu rejimi — Random / Doimiy kombo tugmasi */}
          <div className="flex items-center rounded-full border border-slate-200 overflow-hidden text-xs font-semibold select-none">
            <button
              type="button"
              onClick={pickRandomTema}
              title="Har bo'lim almashganda tasodifiy mavzu — bosaversangiz ham sakraydi"
              className={`flex items-center gap-1 px-2.5 py-1 transition ${
                temaMode === 'random' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Dices key={diceTick} className="anim-dice w-3.5 h-3.5" />
              <span className="hidden sm:inline">Random</span>
            </button>
            <button
              type="button"
              onClick={() => setTemaMode('fixed')}
              title="Mavzu doimiy — bo'lim almashganda o'zgarmaydi"
              className={`flex items-center gap-1 px-2.5 py-1 border-l border-slate-200 transition ${
                temaMode === 'fixed' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Doimiy</span>
            </button>
          </div>
          <LiveClock />
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 relative overflow-hidden">
          <div className="hdr-aura" aria-hidden="true" />
          <HeaderFx tema={tema} />
          <div className="relative z-[1] flex items-center gap-3">
            <img src="/icon-192.png" alt="Logo"
              className="brand-logo w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex-shrink-0" />
            <div>
              <h1 className="firma-nomi text-xl sm:text-2xl font-extrabold tracking-tight inline-block text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
                {shopName}
              </h1>
              <p className="text-xs text-slate-500">Savdo boshqaruv bazasi</p>
            </div>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-2 pt-2 pb-2.5 flex gap-1 border-t border-slate-100 overflow-x-auto">
          {[
            { k: 'new',       label: 'Savdo',        icon: Plus },
            { k: 'orders',    label: 'Zakaslar',     icon: FileText },
            { k: 'mijozlar',  label: 'Mijoz / Usta',  icon: Users },
            { k: 'yoqlama',   label: "Yo'qlama / Avans", icon: CalendarCheck },
            { k: 'hisobot',   label: 'Hisobot',       icon: ClipboardList },
            { k: 'ishchilar', label: 'Ishchilar',     icon: HardHat },
            { k: 'narxlar',   label: 'Narxlar',       icon: Tags },
            { k: 'jurnal',    label: 'Jurnal',        icon: History },
            { k: 'settings',  label: 'Sozlamalar',    icon: Settings },
          ].filter(({ k }) => tabKoradi(role, k)).map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => handleTab(k)}
              className={`flex-1 min-w-[66px] flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                tab === k ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className={`mx-auto px-4 pt-5 no-print ${tab === 'new' || tab === 'orders' || tab === 'mijozlar' || tab === 'yoqlama' ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {tab === 'new' && (
          <NewOrderTab
            draft={draft} setDraft={setDraft} draftCalc={draftCalc}
            kazData={kazData} kazNarx={kazNarx} onKazPrice={setKazPrice}
            tunikaBaza={tunikaBaza} metrlilar={metrlilar} products={products} ranglar={ranglar}
            onOpenProductPicker={() => setProductPicker(true)}
            onOpenClientPicker={() => setClientPicker(true)}
            onOpenMasterPicker={() => setMasterPicker(true)}
            onSave={saveOrder} usdRate={usdRate} usdOlish={usdOlish}
            onCopyLast={copyLastOrder} canCopyLast={orders.length > 0}
            editing={!!editingId} onCancelEdit={cancelEdit}
            editNumber={editingId ? orders.find((o) => o.id === editingId)?.number : null}
            saqlashKey={keys.saqlash}
          />
        )}
        {tab === 'orders' && (
          <OrdersTab
            orders={orders} usdRate={usdRate} usdOlish={usdOlish} onPay={openAddPaymentModal}
            onDelete={(o) => setConfirmDel({ id: o.id, msg: `Zakas (Mijoz: ${o.customer.name}) o'chirilsinmi?` })}
            onReceipt={(o) => setReceiptOrder(o)}
            onHolat={setOrderHolat}
            onEdit={editOrder}
            canDelete={ruxsat(role, 'zakasOchirish')}
            shopName={shopName}
          />
        )}
        {tab === 'mijozlar' && (
          <MijozlarTab
            klentlar={klentlar}   updateKlentlar={updateKlentlar}
            ustalar={ustalar}     updateUstalar={updateUstalar}
            orders={orders}       shopName={shopName}
            showToast={showToast}
          />
        )}
        {tab === 'yoqlama' && (
          <YoqlamaModule
            ishchilar={ishchilar} yoqlama={yoqlama}
            setYoqlamaKun={setYoqlamaKun} setYoqlamaBulk={setYoqlamaBulk}
            avanslar={avanslar} updateAvanslar={updateAvanslar}
            usdRate={usdRate} showToast={showToast}
          />
        )}
        {tab === 'hisobot' && (
          <HisobotModule
            ishchilar={ishchilar} orders={orders}
            yoqlama={yoqlama} avanslar={avanslar} shopName={shopName}
          />
        )}
        {tab === 'ishchilar' && (
          <IshchilarModule
            ishchilar={ishchilar} updateIshchilar={updateIshchilar}
            lavozimlar={lavozimlar} updateLavozimlar={updateLavozimlar}
            qobiliyatlar={qobiliyatlar} updateQobiliyatlar={updateQobiliyatlar}
            kamchiliklar={kamchiliklar} updateKamchiliklar={updateKamchiliklar}
            showToast={showToast}
          />
        )}
        {tab === 'narxlar' && (
          <NarxlarModule
            tunikaBaza={tunikaBaza} updateTunikaBaza={updateTunikaBaza}
            metrlilar={metrlilar} updateMetrlilar={updateMetrlilar}
            aksessuarlar={aksessuarlar} updateAksessuarlar={updateAksessuarlar}
            kaziroklar={kaziroklar} updateKaziroklar={updateKaziroklar}
            kazTurlari={kazTurlari} updateKazTurlari={updateKazTurlari}
            ranglar={ranglar}
            showToast={showToast}
          />
        )}
        {tab === 'jurnal' && (
          <JurnalTab jurnal={jurnal} canClear={role === 'founder'}
            onClear={() => { if (window.confirm('Butun amallar jurnali tozalansinmi?')) updateJurnal([]); }} />
        )}
        {tab === 'settings' && (
          <SettingsTab
            shopName={shopName}     updateShopName={updateShopName}
            shopPhone={shopPhone}   updateShopPhone={updateShopPhone}
            usdRate={usdRate}       updateUsdRate={updateUsdRate}
            usdOlish={usdOlish}     updateUsdOlish={updateUsdOlish}
            tunikaBaza={tunikaBaza} ranglar={ranglar} updateRanglar={updateRanglar}
            ishchilar={ishchilar}
            currentUser={currentUser} users={users} updateUsers={updateUsers}
            tema={tema} setTema={(t) => { setTema(t); setTemaMode('fixed'); }}
            shrift={shrift} setShrift={setShrift}
            til={til} setTil={setTil}
            keys={keys} updateKeys={updateKeys}
            tgToken={tgToken} updateTgToken={updateTgToken}
            tgChatId={tgChatId} updateTgChatId={updateTgChatId}
            tgChats={tgChats} updateTgChats={updateTgChats}
            libName={libHandle ? libHandle.name : null} libSupported={fsSupported()}
            onPickLib={pickLibraryFolder} onClearLib={clearLibraryFolder}
            onLogout={doLogout}
            logAction={logAction}
            showToast={showToast}
          />
        )}
      </main>

      {/* Modallar */}
      {productPicker && (
        <ProductPickerModal
          tunikaBaza={tunikaBaza} metrlilar={metrlilar} aksessuarlar={aksessuarlar} kaziroklar={kaziroklar}
          onSelect={onProductSelected} onClose={() => setProductPicker(false)}
        />
      )}
      {clientPicker && (
        <ClientPickerModal
          klentlar={klentlar} updateKlentlar={updateKlentlar}
          onSelect={onClientSelected} onClose={() => setClientPicker(false)}
        />
      )}
      {masterPicker && (
        <MasterPickerModal
          ustalar={ustalar} updateUstalar={updateUstalar}
          onSelect={onMasterSelected} onClose={() => setMasterPicker(false)}
        />
      )}

      {receiptOrder && (
        <ReceiptModal order={receiptOrder} shopName={shopName} shopPhone={shopPhone} usdRate={usdRate} usdOlish={usdOlish}
          kazData={kazData} kazRows={draftCalc.kazRows || []} tunikaBaza={tunikaBaza}
          ustalar={ustalar}
          telegram={{ token: tgToken, chatId: tgChatId, chats: tgChats }} libRoot={libHandle}
          onChatMigrated={onTgChatMigrated}
          onClose={() => setReceiptOrder(null)} />
      )}

      {searchOpen && (
        <GlobalSearch orders={orders} klentlar={klentlar}
          onOrder={(o) => { setSearchOpen(false); setReceiptOrder(o); }}
          onCustomer={() => { setSearchOpen(false); setTab('mijozlar'); }}
          onClose={() => setSearchOpen(false)} />
      )}

      {payModal && (
        <SmallModal onClose={() => setPayModal(null)} title="Qarz to'lash">
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <p className="text-sm text-slate-600">
              Qolgan qarz: <b className="text-amber-700">{fmt(orders.find((o) => o.id === payModal.orderId)?.debt || 0)} so'm</b>
            </p>

            <DynamicPaymentsSection
              payments={payModal.payments}
              onChange={(pList) => setPayModal({ ...payModal, payments: pList })}
              usdRate={usdRate}
              qoldiq={orders.find((o) => o.id === payModal.orderId)?.debt || 0}
            />

            <div className="flex gap-2 pt-2">
              <button onClick={() => setPayModal(null)}
                className="flex-1 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-700 hover:bg-slate-50">Bekor</button>
              <button onClick={applyLaterPayment}
                className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Qabul qilish
              </button>
            </div>
          </div>
        </SmallModal>
      )}

      {confirmDel && (
        <SmallModal onClose={() => setConfirmDel(null)} title="Tasdiqlash">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-slate-700">{confirmDel.msg}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)}
                className="flex-1 py-3 rounded-lg border-2 border-slate-200 font-medium text-slate-700 hover:bg-slate-50">Bekor</button>
              <button onClick={() => deleteOrder(confirmDel.id)}
                className="flex-1 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">Ha, o'chirish</button>
            </div>
          </div>
        </SmallModal>
      )}

      {toast && (
        <div className="anim-toast fixed bottom-6 right-6 max-w-[calc(100vw-3rem)] bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl text-sm z-50 no-print">
          {toast}
        </div>
      )}

      {savedAnim && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none no-print">
          <div className="suc-box bg-white rounded-3xl shadow-2xl px-10 py-8 flex flex-col items-center gap-3">
            <svg viewBox="0 0 52 52" className="w-20 h-20">
              <circle className="suc-circle" cx="26" cy="26" r="24" fill="none" stroke="#16a34a" strokeWidth="3" />
              <path className="suc-check" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14 27 l8 8 l16 -18" />
            </svg>
            <span className="font-bold text-slate-800 text-lg">Saqlandi!</span>
          </div>
        </div>
      )}
    </div>
  );
}
