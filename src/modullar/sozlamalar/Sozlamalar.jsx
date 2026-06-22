// ============================================================
//  SOZLAMALAR TABI
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  Download, Upload, LogOut, Users, Plus, Trash2,
  Sun, Moon, MoonStar, Leaf, Sparkles, Coffee, Waves,
  Zap, Radio, Terminal, Ghost, Snowflake, Crown, Flame, Rocket, Flower2, Gem,
  Cpu, Sunset, Shell, Heart, Aperture, Contrast, Star,
  Store, Database, Palette, Type, RotateCw,
  TreePine, Diamond, Hexagon, Sprout, Award, Anchor, Mountain, MountainSnow,
  TreePalm, Sunrise, Grape, Compass, Disc3, Citrus, Fish, Cherry, Wind,
  Skull, Wand2, Bot, Orbit, FolderOpen,
  Pyramid, Flower, Bird, Trees, Droplet, CloudSnow, Croissant, Brush, Shirt,
  Cookie, Sailboat, Atom, TreeDeciduous, Rabbit, IceCream, Telescope,
  FlaskConical, Castle, PartyPopper, Ship, Feather, Carrot,
} from 'lucide-react';
import { Card, SectionTitle, SegmentedControl, rangChipStyle } from '../../components/ui.jsx';
import { DEFAULT_USD_RATE, RANG_PALETTE, RANG_GROUPS } from '../../lib/constants.js';
import { eksportZaxira, importZaxira } from '../../lib/zaxira.js';
import { genId, rangTozala } from '../../lib/helpers.js';
import { fetchKurslar } from '../../lib/kurs.js';
import { ROLLAR, rolNomi } from '../../lib/ruxsat.js';
import { TILLAR } from '../../lib/til.js';
import { Languages, Keyboard } from 'lucide-react';
import { KEY_ACTIONS, comboFromEvent, comboValid } from '../../lib/keybind.js';
import { NazoratBot } from './NazoratBot.jsx';

const MAVZULAR = [
  { id: 'light',     nom: "Yorug'",     icon: Sun,       rang: '#0f172a' },
  { id: 'dark',      nom: "Qorong'i",   icon: Moon,      rang: '#334155' },
  { id: 'midnight',  nom: "Tungi ko'k", icon: MoonStar,  rang: '#3b4ea0' },
  { id: 'forest',    nom: "O'rmon",     icon: Leaf,      rang: '#1f6b43' },
  { id: 'plum',      nom: 'Siyohrang',  icon: Sparkles,  rang: '#6d3bd0' },
  { id: 'coffee',    nom: 'Qahva',      icon: Coffee,    rang: '#8a5a33' },
  { id: 'ocean',     nom: 'Dengiz',     icon: Waves,     rang: '#1f7a8a' },
  { id: 'neon',      nom: 'Neon',       icon: Zap,       rang: '#ff2d95' },
  { id: 'synthwave', nom: 'Synthwave',  icon: Radio,     rang: '#ff4ecd' },
  { id: 'matrix',    nom: 'Matrix',     icon: Terminal,  rang: '#00b341' },
  { id: 'dracula',   nom: 'Dracula',    icon: Ghost,     rang: '#bd93f9' },
  { id: 'nord',      nom: 'Nord',       icon: Snowflake, rang: '#88c0d0' },
  { id: 'gold',      nom: 'Oltin',      icon: Crown,     rang: '#d4af37' },
  { id: 'volcano',   nom: 'Vulqon',     icon: Flame,     rang: '#ff5722' },
  { id: 'galaxy',    nom: 'Galaktika',  icon: Rocket,    rang: '#7c5cff' },
  { id: 'rose',      nom: 'Atirgul',    icon: Flower2,   rang: '#ff4d8d' },
  { id: 'amethyst',  nom: 'Ametist',    icon: Gem,       rang: '#9d5bff' },
  { id: 'cyber',     nom: 'Cyberpunk',  icon: Cpu,       rang: '#00bcd4' },
  { id: 'sunset',    nom: 'Shafaq',     icon: Sunset,    rang: '#ff6a3d' },
  { id: 'coral',     nom: 'Marjon',     icon: Shell,     rang: '#ff7a6b' },
  { id: 'crimson',   nom: 'Qirmizi',    icon: Heart,     rang: '#e11d48' },
  { id: 'aurora',    nom: 'Aurora',     icon: Aperture,  rang: '#22d3a6' },
  { id: 'mono',      nom: 'Qora-oq',    icon: Contrast,  rang: '#71717a' },
  { id: 'indigo',    nom: 'Indigo',     icon: Star,      rang: '#4f46e5' },
  // ----- yangi 21 mavzu -----
  { id: 'emerald',   nom: 'Zumrad',     icon: TreePine,     rang: '#10b981' },
  { id: 'ruby',      nom: 'Yoqut',      icon: Diamond,      rang: '#fb2c5a' },
  { id: 'sapphire',  nom: 'Safir',      icon: Hexagon,      rang: '#3b82f6' },
  { id: 'jade',      nom: 'Nefrit',     icon: Sprout,       rang: '#2dd4bf' },
  { id: 'bronze',    nom: 'Bronza',     icon: Award,        rang: '#cd7f32' },
  { id: 'steel',     nom: "Po'lat",     icon: Anchor,       rang: '#94a3b8' },
  { id: 'magma',     nom: 'Magma',      icon: Mountain,     rang: '#ff6a00' },
  { id: 'arctic',    nom: 'Arktika',    icon: MountainSnow, rang: '#38bdf8' },
  { id: 'jungle',    nom: 'Tropik',     icon: TreePalm,     rang: '#84cc16' },
  { id: 'desert',    nom: 'Sahro',      icon: Sunrise,      rang: '#e0a458' },
  { id: 'wine',      nom: 'Vino',       icon: Grape,        rang: '#d6336c' },
  { id: 'cobalt',    nom: 'Kobalt',     icon: Compass,      rang: '#2563eb' },
  { id: 'magenta',   nom: 'Fuksiya',    icon: Disc3,        rang: '#ec4899' },
  { id: 'lime',      nom: 'Limon',      icon: Citrus,       rang: '#c5e836' },
  { id: 'turquoise', nom: 'Turkuaz',    icon: Fish,         rang: '#06b6d4' },
  { id: 'sakura',    nom: 'Sakura',     icon: Cherry,       rang: '#fb7faf' },
  { id: 'storm',     nom: "Bo'ron",     icon: Wind,         rang: '#64b5f6' },
  { id: 'pirate',    nom: 'Qaroqchi',   icon: Skull,        rang: '#d4a017' },
  { id: 'wizard',    nom: 'Sehrgar',    icon: Wand2,        rang: '#a855f7' },
  { id: 'robot',     nom: 'Robot',      icon: Bot,          rang: '#22d3ee' },
  { id: 'comet',     nom: 'Kometa',     icon: Orbit,        rang: '#a5b4fc' },
  // ----- yana 20 mavzu -----
  { id: 'obsidian',  nom: 'Obsidiyan',  icon: Pyramid,       rang: '#a78bfa' },
  { id: 'sunflower', nom: 'Kungaboqar', icon: Flower,        rang: '#f5b800' },
  { id: 'flamingo',  nom: 'Flamingo',   icon: Bird,          rang: '#fb6f92' },
  { id: 'mint',      nom: 'Yalpiz',     icon: Trees,         rang: '#34e0a1' },
  { id: 'blood',     nom: 'Qon',        icon: Droplet,       rang: '#c81e3a' },
  { id: 'ice',       nom: 'Muz',        icon: CloudSnow,     rang: '#5cc8f5' },
  { id: 'honey',     nom: 'Asal',       icon: Croissant,     rang: '#f0a500' },
  { id: 'orchid',    nom: 'Orkide',     icon: Brush,         rang: '#c026d3' },
  { id: 'denim',     nom: 'Jinsi',      icon: Shirt,         rang: '#4f7bbf' },
  { id: 'caramel',   nom: 'Karamel',    icon: Cookie,        rang: '#c08038' },
  { id: 'seafoam',   nom: "Ko'pik",     icon: Sailboat,      rang: '#2ee6c0' },
  { id: 'plasma',    nom: 'Plazma',     icon: Atom,          rang: '#e23bff' },
  { id: 'autumn',    nom: 'Kuz',        icon: TreeDeciduous, rang: '#e8702e' },
  { id: 'spring',    nom: 'Bahor',      icon: Rabbit,        rang: '#57d98e' },
  { id: 'mocha',     nom: 'Mokko',      icon: IceCream,      rang: '#8a6240' },
  { id: 'nebula',    nom: 'Tumanlik',   icon: Telescope,     rang: '#8b7dff' },
  { id: 'toxic',     nom: 'Zaharli',    icon: FlaskConical,  rang: '#aef205' },
  { id: 'royal',     nom: 'Shohona',    icon: Castle,        rang: '#7c3aed' },
  { id: 'peach',     nom: 'Shaftoli',   icon: PartyPopper,   rang: '#ff9e7a' },
  { id: 'lagoon',    nom: 'Laguna',     icon: Ship,          rang: '#1fb6c4' },
  // ----- yana 20 mavzu -----
  { id: 'lavender',  nom: 'Lavanda',    icon: Feather,       rang: '#b39ddb' },
  { id: 'tangerine', nom: 'Mandarin',   icon: Carrot,        rang: '#ff7518' },
  { id: 'moss',      nom: 'Moh',        icon: Sprout,        rang: '#6b8e23' },
  { id: 'berry',     nom: 'Rezavor',    icon: Grape,         rang: '#b5179e' },
  { id: 'slate',     nom: 'Shifer',     icon: Mountain,      rang: '#64748b' },
  { id: 'raspberry', nom: 'Malina',     icon: Cherry,        rang: '#e0218a' },
  { id: 'olive',     nom: 'Zaytun',     icon: Leaf,          rang: '#808000' },
  { id: 'cinnamon',  nom: 'Dolchin',    icon: Cookie,        rang: '#b5651d' },
  { id: 'azure',     nom: 'Azur',       icon: Droplet,       rang: '#1e90ff' },
  { id: 'grape',     nom: 'Uzum',       icon: Gem,           rang: '#7b2cbf' },
  { id: 'pistachio', nom: 'Pista',      icon: TreePine,      rang: '#93c572' },
  { id: 'cherryred', nom: 'Gilos',      icon: Heart,         rang: '#d2042d' },
  { id: 'marina',    nom: 'Marina',     icon: Anchor,        rang: '#1f6f8b' },
  { id: 'blush',     nom: 'Pushti',     icon: Flower2,       rang: '#ff8fab' },
  { id: 'charcoal',  nom: "Ko'mir",     icon: Hexagon,       rang: '#6b7280' },
  { id: 'starlight', nom: 'Yulduz',     icon: Star,          rang: '#fce570' },
  { id: 'mango',     nom: 'Mango',      icon: Citrus,        rang: '#ffb627' },
  { id: 'lilac',     nom: 'Lilas',      icon: Flower,        rang: '#c8a2c8' },
  { id: 'carbon',    nom: 'Uglerod',    icon: Cpu,           rang: '#5c7c9e' },
  { id: 'glacier',   nom: 'Muzlik',     icon: MountainSnow,  rang: '#7fdbff' },
];

// "Oq" har doim eng tepada turadigan tartiblash
function oqTepada(a, b) {
  const ao = /oq/i.test(a) ? 0 : 1;
  const bo = /oq/i.test(b) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  return a.localeCompare(b);
}

// Bitta yorliq qatori — "O'zgartirish" bosilsa keyingi kombinatsiyani tutadi
function KeybindRow({ action, combo, onSet }) {
  const [listening, setListening] = useState(false);
  useEffect(() => {
    if (!listening) return undefined;
    function onKey(e) {
      e.preventDefault();
      if (e.key === 'Escape') { setListening(false); return; }
      const c = comboFromEvent(e);
      if (!c) return;            // faqat modifikator bosildi — kutamiz
      if (!comboValid(c)) return; // modifikatorsiz oddiy klavisha qabul qilinmaydi
      onSet(c);
      setListening(false);
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [listening]); // eslint-disable-line
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200">
      <span className="text-sm text-slate-700">{action.label}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <kbd className="px-2 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">{listening ? 'Bosing…' : (combo || '—')}</kbd>
        <button onClick={() => setListening((v) => !v)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition ${listening ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          {listening ? 'Bekor' : "O'zgartirish"}
        </button>
      </div>
    </div>
  );
}

export function SettingsTab({ shopName, updateShopName, shopPhone = '', updateShopPhone, usdRate, updateUsdRate, usdOlish, updateUsdOlish, tunikaBaza = [], ranglar = [], updateRanglar, ishchilar = [], currentUser, users = [], updateUsers, tema, setTema, shrift = 'oddiy', setShrift, til = 'uz', setTil = () => {}, keys = {}, updateKeys = () => {}, tgToken = '', updateTgToken = () => {}, tgChatId = '', updateTgChatId = () => {}, libName = null, libSupported = false, onPickLib = () => {}, onClearLib = () => {}, onLogout, logAction = () => {}, showToast }) {
  const [shopDraft, setShopDraft] = useState(shopName);
  const [phoneDraft, setPhoneDraft] = useState(shopPhone);
  const [tgTokenDraft, setTgTokenDraft] = useState(tgToken);
  const [tgChatDraft, setTgChatDraft] = useState(tgChatId);
  const [olishDraft, setOlishDraft] = useState(usdOlish);
  const [sotishDraft, setSotishDraft] = useState(usdRate);
  const [nLogin, setNLogin] = useState('');
  const [nParol, setNParol] = useState('');
  const [nRole, setNRole] = useState('admin'); // yangi foydalanuvchi roli: admin | ishchi
  const [nRang, setNRang] = useState('');
  const [kursAuto, setKursAuto] = useState(() => { try { return localStorage.getItem('usd-auto') === '1'; } catch (e) { return false; } });
  const [kursYuk, setKursYuk] = useState(false);
  const [baza, setBaza] = useState(() => { try { return parseInt(localStorage.getItem('usd-baza') || '0', 10) || 0; } catch (e) { return 0; } });
  const [koris, setKoris] = useState('sotish'); // qaysi kurs ko'rsatilmoqda: olish | sotish

  useEffect(() => { setShopDraft(shopName); }, [shopName]);
  useEffect(() => { setPhoneDraft(shopPhone); }, [shopPhone]);
  useEffect(() => { setTgTokenDraft(tgToken); }, [tgToken]);
  useEffect(() => { setTgChatDraft(tgChatId); }, [tgChatId]);
  useEffect(() => { setOlishDraft(usdOlish); }, [usdOlish]);
  useEffect(() => { setSotishDraft(usdRate); }, [usdRate]);

  function hozirgiKurs() {
    setKursYuk(true);
    fetchKurslar()
      .then(({ base, olish, sotish }) => {
        setBaza(base);
        updateUsdOlish(olish);
        updateUsdRate(sotish);
        showToast(`Olish ${olish.toLocaleString('ru-RU')} · Sotish ${sotish.toLocaleString('ru-RU')}`);
      })
      .catch(() => showToast('Kursni olishda xatolik — internetni tekshiring'))
      .finally(() => setKursYuk(false));
  }
  function toggleAuto() {
    const v = !kursAuto;
    setKursAuto(v);
    try { localStorage.setItem('usd-auto', v ? '1' : '0'); } catch (e) { /* noop */ }
    if (v) hozirgiKurs();
  }
  // Tanlangan kursni saqlash (olish yoki sotish). Bazadan farqi "ustama"
  // sifatida yashirin saqlanadi — avtomatik yangilanганда farq saqlanib qoladi.
  function saveKurs() {
    if (koris === 'olish') {
      const v = Number(olishDraft) || DEFAULT_USD_RATE;
      updateUsdOlish(v);
      if (baza > 0) { try { localStorage.setItem('usd-ust-olish', String(v - baza)); } catch (e) { /* noop */ } }
    } else {
      const v = Number(sotishDraft) || DEFAULT_USD_RATE;
      updateUsdRate(v);
      if (baza > 0) { try { localStorage.setItem('usd-ust-sotish', String(v - baza)); } catch (e) { /* noop */ } }
    }
    showToast('Kurs saqlandi');
  }

  // Standart palitrada bormi? (katta-kichik harf farqi e'tiborga olinmaydi)
  const standartda = (nom) => RANG_PALETTE.some((r) => r.nom.toLowerCase() === (nom || '').toLowerCase());
  // Listlardan avtomatik ranglar — faqat standart palitrada YO'Q bo'lganlari (takrorni oldini olish)
  const listRanglar = [...new Set(tunikaBaza.map((t) => rangTozala(t.nomi)).filter(Boolean))]
    .filter((n) => !standartda(n)).sort(oqTepada);

  function addRang() {
    const v = nRang.trim();
    if (!v) { showToast('Rang nomini kiriting'); return; }
    const bor = standartda(v)
      || listRanglar.some((n) => n.toLowerCase() === v.toLowerCase())
      || ranglar.some((r) => (r.nom || '').toLowerCase() === v.toLowerCase());
    if (bor) { showToast('Bu rang allaqachon bor'); return; }
    updateRanglar([...ranglar, { id: genId(), nom: v }]);
    setNRang('');
    showToast('Rang qo\'shildi');
  }
  function removeRang(id) { updateRanglar(ranglar.filter((r) => r.id !== id)); showToast('O\'chirildi'); }

  const founder = currentUser?.role === 'founder';

  function addAdmin() {
    const l = nLogin.trim();
    if (!l || !nParol) { showToast('Login va parol kiriting'); return; }
    if (users.some((u) => u.login.toLowerCase() === l.toLowerCase())) { showToast('Bunday login bor'); return; }
    const role = nRole === 'ishchi' ? 'ishchi' : 'admin';
    updateUsers([...users, { id: genId(), login: l, parol: nParol, role }]);
    logAction('user_qoshdi', `${l} (${rolNomi(role)})`);
    setNLogin(''); setNParol(''); setNRole('admin');
    showToast('Foydalanuvchi qo\'shildi');
  }
  function setParol(id, parol) { updateUsers(users.map((u) => (u.id === id ? { ...u, parol } : u))); }
  function removeUser(id) {
    const u = users.find((x) => x.id === id);
    updateUsers(users.filter((x) => x.id !== id));
    if (u) logAction('user_ochirdi', `${u.login} (${rolNomi(u.role)})`);
    showToast('O\'chirildi');
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!file) return;
    if (!window.confirm("Diqqat! Mavjud barcha ma'lumot fayldagi bilan almashtiriladi. Davom etilsinmi?")) return;
    importZaxira(file)
      .then((n) => showToast(`${n} ta bo'lim yuklandi`))
      .catch((err) => { console.error('Zaxira import xatosi:', err); showToast('Xatolik: fayl noto\'g\'ri'); });
  }

  return (
    <div className="space-y-4 text-sm">
      <Card>
        <SectionTitle icon={FolderOpen}>Mijozlar kutubxonasi joylashuvi</SectionTitle>
        <p className="text-xs text-slate-500 mb-3 -mt-1">
          Kazirok DXF va chek fayllari shu papkaga saqlanadi. Har mijoz zakasiga papka ichida
          <b> alohida papka</b> (Ism Familiya + sana-soat) avtomatik ochiladi.
        </p>
        {!libSupported ? (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Bu brauzer papkaga to'g'ridan-to'g'ri yozishni qo'llamaydi (Chrome yoki Edge kerak).
            Hozircha fayllar oddiy "yuklab olish" orqali saqlanadi.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`flex-1 min-w-0 px-3 py-2 rounded-lg border-2 text-xs truncate ${libName ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                {libName ? `📁 ${libName}` : 'Papka tanlanmagan'}
              </div>
              <button onClick={onPickLib}
                className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 flex-shrink-0 whitespace-nowrap">
                {libName ? "O'zgartirish" : 'Papka tanlash'}
              </button>
              {libName && (
                <button onClick={onClearLib} title="Bog'lanishni o'chirish"
                  className="px-2.5 py-2 rounded-lg border-2 border-slate-200 text-slate-500 hover:bg-slate-50 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {libName
                ? "✓ Tanlangan. Chekdan DXF bosilganda fayllar shu papkaga avtomatik yoziladi."
                : "Papka tanlanmasa, fayllar oddiy yuklab olish orqali saqlanadi."}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={Bot}>Telegram bot (Kazirok DXF)</SectionTitle>
        <p className="text-xs text-slate-500 mb-3 -mt-1">
          Chekdan "Botga DXF (4m/6m)" bosilganda sartirovka qilingan DXF fayllar shu botga yuboriladi.
          Token <b>@BotFather</b>dan; Chat ID — bot yuboradigan guruh/kanal yoki shaxsiy chat IDsi
          (botni o'sha chatga qo'shing, admin qiling).
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Bot token</label>
            <div className="flex gap-2">
              <input value={tgTokenDraft} onChange={(e) => setTgTokenDraft(e.target.value)} placeholder="123456789:AAH..."
                autoComplete="off" spellCheck={false}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none font-mono text-xs" />
              <button onClick={() => { updateTgToken(tgTokenDraft.trim()); showToast('Token saqlandi'); }}
                className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 flex-shrink-0">Saqlash</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Chat ID (guruh/kanal/shaxsiy)</label>
            <div className="flex gap-2">
              <input value={tgChatDraft} onChange={(e) => setTgChatDraft(e.target.value)} placeholder="-1001234567890"
                autoComplete="off" spellCheck={false}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none font-mono text-xs tabular-nums" />
              <button onClick={() => { updateTgChatId(tgChatDraft.trim()); showToast('Chat ID saqlandi'); }}
                className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 flex-shrink-0">Saqlash</button>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            {tgToken && tgChatId
              ? <span className="text-emerald-600 font-semibold">✓ Telegram sozlangan — chekdan DXF yuborish mumkin</span>
              : <span>Token va Chat ID to'ldirilsa, chekdan DXF avtomatik botga ketadi.</span>}
          </div>
        </div>
      </Card>

      {currentUser?.role !== 'ishchi' && (
        <NazoratBot ishchilar={ishchilar} currentUser={currentUser} showToast={showToast} />
      )}

      <Card>
        <SectionTitle icon={Store}>Asosiy Sozlamalar</SectionTitle>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Do'kon nomi</label>
            <div className="flex gap-2"><input value={shopDraft} onChange={(e) => setShopDraft(e.target.value)} className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none" /><button onClick={() => { updateShopName(shopDraft); showToast('Saqlandi'); }} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800">Saqlash</button></div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Do'kon telefoni (chekda chiqadi)</label>
            <div className="flex gap-2"><input value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)} placeholder="+998 90 123 45 67" className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none" /><button onClick={() => { updateShopPhone(phoneDraft); showToast('Saqlandi'); }} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800">Saqlash</button></div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dollar kursi (1 USD)</label>
            <SegmentedControl value={koris} onChange={setKoris}
              options={[{ value: 'olish', label: 'Olish' }, { value: 'sotish', label: 'Sotish' }]} />
            <div className="flex gap-2 mt-2">
              <input type="number" value={koris === 'olish' ? olishDraft : sotishDraft} onWheel={(e) => e.target.blur()} onFocus={(e) => e.target.select()}
                onChange={(e) => (koris === 'olish' ? setOlishDraft(parseFloat(e.target.value) || '') : setSotishDraft(parseFloat(e.target.value) || ''))}
                className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none tabular-nums" />
              <button onClick={saveKurs} className="px-4 py-2 bg-emerald-700 text-white font-medium rounded-lg hover:bg-emerald-800">Saqlash</button>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <button onClick={hozirgiKurs} disabled={kursYuk}
                className="px-3 py-1.5 rounded-lg border-2 border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-1.5">
                {kursYuk ? 'Olinmoqda…' : <><RotateCw className="w-3.5 h-3.5" /> Internetdan joriy kursni olish</>}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={kursAuto} onChange={toggleAuto} className="w-4 h-4 accent-emerald-700" />
                Avtomatik
              </label>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Hozir: Olish <b className="text-slate-600">{Number(usdOlish).toLocaleString('ru-RU')}</b> · Sotish <b className="text-slate-600">{Number(usdRate).toLocaleString('ru-RU')}</b> so'm.
              "Avtomatik" yoqilsa — ilova ochilganda kurslar internetdan o'zi yangilanadi.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={(MAVZULAR.find((m) => m.id === tema) || MAVZULAR[0]).icon}>Mavzu</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MAVZULAR.map((m) => (
            <button key={m.id} onClick={() => setTema(m.id)}
              className={`py-2.5 rounded-lg border-2 font-medium text-sm flex items-center justify-center gap-2 ${tema === m.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <m.icon className="w-4 h-4 flex-shrink-0" style={tema === m.id ? undefined : { color: m.rang }} /> {m.nom}
            </button>
          ))}
        </div>
      </Card>


      <Card>
        <SectionTitle icon={Type}>Yozuv o'lchami (shrift)</SectionTitle>
        <p className="text-xs text-slate-500 mb-3">
          Butun ilovadagi yozuvlarni kattaroq yoki kichikroq qiling. Tanlov shu qurilmada saqlanadi.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'kichik', nom: 'Kichik', px: 'text-xs' },
            { id: 'oddiy',  nom: 'Oddiy',  px: 'text-sm' },
            { id: 'katta',  nom: 'Katta',  px: 'text-base' },
            { id: 'juda',   nom: 'Juda katta', px: 'text-lg' },
          ].map((s) => (
            <button key={s.id} onClick={() => { setShrift(s.id); showToast('Shrift o\'lchami o\'zgardi'); }}
              className={`py-2.5 rounded-lg border-2 font-medium flex flex-col items-center justify-center gap-0.5 ${shrift === s.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <span className={`${s.px} font-bold leading-none`}>A</span>
              <span className="text-[11px] leading-none">{s.nom}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Keyboard}>Klaviatura yorliqlari</SectionTitle>
        <p className="text-xs text-slate-500 mb-3">
          "O'zgartirish"ni bosing va yangi kombinatsiyani bosing (masalan Ctrl+J). Esc — bekor. Ctrl va ⌘ (Mac) teng hisoblanadi.
        </p>
        <div className="space-y-2">
          {KEY_ACTIONS.map((a) => (
            <KeybindRow key={a.id} action={a} combo={keys[a.id]}
              onSet={(c) => { updateKeys({ ...keys, [a.id]: c }); showToast('Yorliq o\'zgartirildi'); }} />
          ))}
        </div>
        <button onClick={() => { updateKeys(Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.def]))); showToast('Standart yorliqlar tiklandi'); }}
          className="mt-3 text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
          <RotateCw className="w-3.5 h-3.5" /> Standartga qaytarish
        </button>
      </Card>

      {currentUser?.role !== 'ishchi' && (
      <Card>
        <SectionTitle icon={Database}>Zaxira (Backup)</SectionTitle>
        <p className="text-xs text-slate-500 mb-3">
          Barcha ma'lumot faqat shu brauzerda saqlanadi. Yo'qotmaslik uchun
          vaqti-vaqti bilan zaxira faylini yuklab oling. Boshqa qurilmada
          yoki brauzer tozalangach — shu fayldan qaytarib yuklang.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => eksportZaxira().then(() => { try { localStorage.setItem('oxirgi-zaxira', new Date().toISOString()); } catch (e) { /* noop */ } showToast('Zaxira yuklab olindi'); }).catch(() => showToast('Xatolik'))}
            className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Zaxira yuklab olish
          </button>
          <label className="flex-1 py-2.5 rounded-lg border-2 border-slate-200 text-slate-700 font-medium hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> Fayldan yuklash
            <input type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
          </label>
        </div>
        <p className="text-[11px] text-amber-700 mt-2">
          Diqqat: "Fayldan yuklash" mavjud ma'lumot ustiga yozadi.
        </p>
      </Card>
      )}

      {founder && (
        <Card>
          <SectionTitle icon={Users}>Foydalanuvchilar</SectionTitle>
          <p className="text-xs text-slate-500 mb-3">Faqat siz (asoschi) ko'rasiz. Yangi foydalanuvchi qo'shing — ular shu login/parol bilan kiradi. <b>Administrator</b> deyarli hamma narsani ko'radi; <b>Ishchi</b> faqat Savdo, Zakaslar, Mijoz va Yo'qlamani ko'radi (o'chirish/narx/jurnal yo'q).</p>

          <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg space-y-2 mb-3">
            <div className="grid grid-cols-2 gap-2">
              <input value={nLogin} onChange={(e) => setNLogin(e.target.value)} placeholder="Login" className="px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm" />
              <input value={nParol} onChange={(e) => setNParol(e.target.value)} placeholder="Parol" className="px-3 py-2 border-2 border-slate-200 rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Rol</label>
              <SegmentedControl value={nRole} onChange={setNRole}
                options={[{ value: 'admin', label: 'Administrator' }, { value: 'ishchi', label: 'Ishchi' }]} />
            </div>
            <button onClick={addAdmin} className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> Foydalanuvchi qo'shish
            </button>
          </div>

          <div className="space-y-1">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 p-2.5 border border-slate-200 rounded-xl text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold flex-shrink-0">{(u.login || '?').charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <b className="text-slate-900 truncate block">{u.login}</b>
                    {(() => {
                      const rol = ROLLAR[u.role] || ROLLAR.ishchi;
                      const RIcon = rol.icon;
                      return (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${rol.cls}`}>
                          <RIcon className="w-3 h-3" />{rol.nom}{u.role === 'founder' ? ' — siz' : ''}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {u.role !== 'founder' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input value={u.parol} onChange={(e) => setParol(u.id, e.target.value)} title="Parol"
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-xs bg-white" />
                    <button onClick={() => removeUser(u.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={Palette}>Ranglar</SectionTitle>
        <p className="text-xs text-slate-500 mb-3">
          List, aksessuar, kazirok va savdoda ranglar shu yerdagi ro'yxatdan tanlanadi.
          Hammasi <b>metall list</b> ranglari — namunalar metalldek jilo bilan ko'rsatiladi.
          Quyidagi <b>standart ranglar</b> har doim mavjud. O'zingizniki bo'lsa (masalan "xrom")
          pastdan qo'shing — u ham hamma joyda tanlovga chiqadi.
        </p>

        <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-2">Standart ranglar ({RANG_PALETTE.length}) — guruhlab</label>
        <div className="space-y-2.5 mb-4">
          {RANG_GROUPS.map((g) => (
            <div key={g.guruh}>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{g.guruh}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.ranglar.map((r) => (
                  <span key={r.nom} className="px-3 py-1 rounded-full text-xs font-semibold border border-black/10 shadow-sm"
                    style={rangChipStyle(r.nom)}>
                    {r.nom}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {listRanglar.length > 0 && (
          <>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Listlardan (avtomatik)</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {listRanglar.map((nom) => (
                <span key={nom} className="px-3 py-1 rounded-full text-xs font-semibold border border-black/10 shadow-sm"
                  style={rangChipStyle(nom)}>
                  {nom}
                </span>
              ))}
            </div>
          </>
        )}

        <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">Qo'shimcha ranglar</label>
        <div className="flex gap-2 mb-2">
          <input value={nRang} onChange={(e) => setNRang(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addRang(); }}
            placeholder="masalan: xrom" className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-slate-900 outline-none text-sm" />
          <button onClick={addRang} className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 flex items-center gap-1"><Plus className="w-4 h-4" /> Qo'shish</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ranglar.length === 0 ? (
            <span className="text-xs text-slate-400">Qo'shimcha rang yo'q</span>
          ) : [...ranglar].sort((a, b) => oqTepada(a.nom || '', b.nom || '')).map((r) => (
            <span key={r.id} className="pl-3 pr-2 py-1 rounded-full text-xs font-semibold border border-black/10 shadow-sm flex items-center gap-1.5"
              style={rangChipStyle(r.nom)}>
              {r.nom}
              <button onClick={() => removeRang(r.id)} className="opacity-70 hover:opacity-100" style={{ color: 'inherit' }}><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      </Card>

      <button onClick={onLogout}
        className="w-full py-2.5 rounded-lg border-2 border-red-200 text-red-700 font-medium hover:bg-red-50 flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4" /> Chiqish
      </button>
    </div>
  );
}
