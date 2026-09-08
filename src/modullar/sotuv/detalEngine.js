// ============================================================
//  DETAL CHIZISH DVIGATELI (engine) — Chizma oynasining 2-rejimi
// ------------------------------------------------------------
//  Alohida detalni (patalok, qosh/latok profili, paloska, burchak va h.k.)
//  AutoCAD uslubida chizish: har segment UZUNLIK (sm) + BURCHAK (gradus)
//  bilan kiritiladi (yoki sichqoncha bilan bosiladi). Har chiziqda uzunligi,
//  har uchda (qayirmada) gradusi yozilib turadi. Segmentlar yon paneldagi
//  jadvaldan ham tahrirlanadi — o'zgartirsangiz butun kontur qayta quriladi.
//  - Koordinatalar ICHKARIDA millimetrda (x o'ngga, y pastga — ekran kabi).
//  - Burchak AutoCAD'dek: 0° = o'ng, 90° = TEPA, soat miliga qarshi musbat.
//  - Ikki burchak rejimi: MUTLAQ (AutoCAD polar) yoki NISBIY (oldingi
//    chiziqdan burilish: + chapga, − o'ngga).
//  - Joriy chizma localStorage'da saqlanadi; nomlangan detallar kutubxonasi ham.
//  - DXF import/eksport (mm), PNG rasm.
//  mountDetal(root) — DOM quradi, { destroy, centerView } qaytaradi.
// ============================================================

import { sonMatn, sonQiymat } from '../../lib/helpers.js';
import { computePalette } from './chizmaEngine.js';
import { safeFileName, downloadDxf } from '../../lib/dxfExport.js';
import { loadSnap, saveSnap, buildGeom, resolveSnap, updateAcquire, gridStepFor, snapMarkerShapes } from '../../lib/osnap.js';
import { mountStatusBar } from '../../lib/cadStatusBar.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const UNITS = { mm: 1, cm: 10 };
const UNIT_LABEL = { mm: 'mm', cm: 'sm' };
const STORAGE_KEY = 'detal-chizma-v1';
const LIB_KEY = 'detal-chizma-lib-v1';
const SNAP_PX = 12;          // nuqtaga yopishish chegarasi (px)
const GRIP_PX = 4;           // grip kvadratining yarim tomoni (px)
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
// DXF $INSUNITS kodi -> 1 birlik necha mm
const INSUNITS_MM = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };
const TOOLS = ['select', 'pline', 'rect', 'circle', 'dim', 'move', 'copy', 'rotate', 'mirror', 'scale', 'offset', 'erase'];
// Eksport (PNG) uchun mavzudan mustaqil OCH palitra — oq fonda doim o'qiladi.
const EXPORT_P = {
  devor: '#0f172a', accent: '#0f172a', edit: '#0f172a', text: '#1e293b',
  offset: '#6d28d9', kazirok: '#0369a1', labelBg: 'rgba(255,255,255,.92)', ref: '#cbd5e1',
  fs: 1.8,   // eksportda yozuv/chiziq o'lchami ko'paytmasi (1600 px kenglik uchun)
};

/* ---------------- SOF YORDAMCHILAR ---------------- */
function norm360(a) { a = a % 360; if (a < 0) a += 360; return (Math.abs(a) < 1e-9 || Math.abs(a - 360) < 1e-9) ? 0 : a; }
// (-180, 180] oralig'iga keltirish — burilish (nisbiy) burchagi uchun
function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
// Burchak -> yo'nalish vektori (ekran koordinatalarida: 90° = TEPA)
function dirVec(deg) { const r = deg * D2R; return { dx: Math.cos(r), dy: -Math.sin(r) }; }
// Vektor -> burchak (gradus, 0..360)
function vecAng(dx, dy) { return norm360(Math.atan2(-dy, dx) * R2D); }
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function rnd(v, d) { const m = Math.pow(10, d); return Math.round(v * m) / m; }
function fmtNum(v, d = 2) { const r = rnd(v, d); return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(d))); }
function fmtAng(deg) { return fmtNum(deg, 1) + '°'; }
// Uchdagi ichki burchak (A–B–C), gradus [0..180]
function interiorAngle(A, B, C) {
  const ux = A.x - B.x, uy = A.y - B.y, vx = C.x - B.x, vy = C.y - B.y;
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (lu < 1e-9 || lv < 1e-9) return 180;
  let c = (ux * vx + uy * vy) / (lu * lv);
  c = Math.max(-1, Math.min(1, c));
  return Math.acos(c) * R2D;
}
// Nuqtani c atrofida deg ga burish — ekranda SOAT MILIGA QARSHI musbat (y pastga bo'lgani uchun formula teskari)
function rotPt(p, c, deg) {
  const r = deg * D2R, cos = Math.cos(r), sin = Math.sin(r), x = p.x - c.x, y = p.y - c.y;
  return { x: c.x + x * cos + y * sin, y: c.y - x * sin + y * cos };
}
function reflPt(p, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y, d = dx * dx + dy * dy || 1;
  const t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / d;
  const jx = A.x + t * dx, jy = A.y + t * dy;
  return { x: 2 * jx - p.x, y: 2 * jy - p.y };
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Cheksiz to'g'ri chiziqlar kesishishi (p1->p2, p3->p4); parallel bo'lsa null
function lineInt(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}
function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function svgEl(tag, attrs) { const el = document.createElementNS(SVG_NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }
function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Polyline segmentlari: [{a, b, i}] — yopiq bo'lsa oxirgi->birinchi ham
function plineSegs(e) {
  const s = [], p = e.pts;
  for (let i = 0; i + 1 < p.length; i++) s.push({ a: p[i], b: p[i + 1], i });
  if (e.closed && p.length > 2) s.push({ a: p[p.length - 1], b: p[0], i: p.length - 1 });
  return s;
}

/* ---------------- DOM SHABLONI ---------------- */
const TEMPLATE = `
  <div class="chz-toolbar">
    <span class="chz-tglbl">Asbob:</span>
    <button type="button" class="tool etool" data-tool="select" title="Tanlash — bosing yoki ramka torting; uchlarini (grip) sudrab o'zgartiring; chiziqqa 2 marta bosing — uzunlik/burchak tahriri">&#10530; Tanlash</button>
    <button type="button" class="tool etool" data-tool="pline" title="Chiziq — boshlang'ich nuqtani bosing, so'ng uzunlik (sm) va burchak (°) yozib Enter bosing. Esc — tugatish, C — konturni yopish">&#9998; Chiziq</button>
    <button type="button" class="tool etool" data-tool="rect" title="To'rtburchak — burchakni bosing; eni/bo'yini yozing yoki qarama-qarshi burchakni bosing">&#9645; To'rtburchak</button>
    <button type="button" class="tool etool" data-tool="circle" title="Aylana — markazni bosing; radiusni yozing yoki bosing">&#9711; Aylana</button>
    <button type="button" class="tool etool" data-tool="dim" title="O'lcham chizig'i — 1-nuqta, 2-nuqta, so'ng o'lcham chizig'i turadigan joyni bosing">&#8596; O'lcham</button>
    <span class="sep"></span>
    <button type="button" class="tool etool" data-tool="move" title="Ko'chirish — tanlanganlarni: tayanch nuqta → yangi joy (yoki masofa + burchak yozing)">Ko'chirish</button>
    <button type="button" class="tool etool" data-tool="copy" title="Nusxa — tayanch nuqta → nusxa joyi (yoki masofa + burchak yozing)">Nusxa</button>
    <button type="button" class="tool etool" data-tool="rotate" title="Burish — tayanch nuqta → burchak (gradus yozing yoki bosing)">Burish</button>
    <button type="button" class="tool etool" data-tool="mirror" title="Aks ettirish — o'qning 2 nuqtasini bosing (asl nusxa qoladi; kerak bo'lmasa Delete)">Aks</button>
    <button type="button" class="tool etool" data-tool="scale" title="Masshtab — tayanch nuqta → koeffitsient (yozing yoki bosing)">Masshtab</button>
    <button type="button" class="tool etool" data-tool="offset" title="Offset — parallel nusxa (list qalinligi uchun qulay): elementni bosing, masofani yozing, tomonni bosing">Offset</button>
    <button type="button" class="tool etool erase" data-tool="erase" title="O'chirish — element ustiga bosing">O'chirish</button>
    <span class="sep"></span>
    <button type="button" class="tool" data-dtl="btnUndo" title="Ctrl+Z">&#8630; Orqaga</button>
    <button type="button" class="tool" data-dtl="btnRedo" title="Ctrl+Y">&#8631; Oldinga</button>
    <button type="button" class="tool" data-dtl="btnClear" title="Butun chizmani tozalash (Orqaga bilan qaytariladi)">&#10005; Tozalash</button>
    <button type="button" class="tool" data-dtl="btnFit" title="Chizma chegarasigacha avtozoom — Ctrl+E">&#10530; Markazga</button>
    <span class="chz-scale" data-dtl="scaleInfo"></span>
  </div>
  <div class="chz-edittoolbar dtl-optbar">
    <span class="chz-tglbl">Birlik:</span>
    <select class="rowUnit" data-dtl="unitSel" title="Uzunlik birligi (kiritish va yozuvlar)"><option value="cm">sm</option><option value="mm">mm</option></select>
    <span class="chz-tglbl">Burchak:</span>
    <select class="rowUnit" data-dtl="angMode" title="Burchak qanday kiritiladi: mutlaq — AutoCAD'dek (0° o'ng, 90° tepa); nisbiy — oldingi chiziqdan necha gradus burilish (+ chapga, − o'ngga)">
      <option value="abs">mutlaq (0° o'ng, 90° tepa)</option>
      <option value="rel">nisbiy (oldingi chiziqdan burilish)</option>
    </select>
    <span class="sep"></span>
    <button type="button" class="tool tg" data-dtl="tgLen" title="Chiziqlardagi uzunlik yozuvlari">Uzunliklar</button>
    <button type="button" class="tool tg" data-dtl="tgAng" title="Uchlardagi gradus yozuvlari">Burchaklar</button>
    <span class="sep"></span>
    <button type="button" class="tool addpoint" data-dtl="btnStart0" title="Chiziqni koordinata boshidan (0,0) boshlash — sichqonchasiz, faqat klaviatura bilan chizish uchun">&#8982; 0,0 dan boshlash</button>
    <button type="button" class="tool import" data-dtl="btnImport" title="AutoCAD DXF faylni import qilish (maydonga sudrab tashlasa ham bo'ladi)">&#128193; Import DXF</button>
    <input type="file" accept=".dxf,.DXF" data-dtl="fileInput" style="display:none" />
    <button type="button" class="tool" data-dtl="btnDxf" title="Chizmani DXF (mm) qilib yuklab olish — lazer / AutoCAD uchun">&#11015; DXF</button>
    <button type="button" class="tool" data-dtl="btnPng" title="Chizmani rasm (PNG) qilib yuklab olish — Telegram / chop etish uchun">&#11015; Rasm</button>
    <span class="chz-refinfo" data-dtl="info"></span>
  </div>
  <div class="chz-main">
    <div class="chz-canvas" data-dtl="canvasWrap">
      <svg data-dtl="svg" xmlns="${SVG_NS}"></svg>
      <div class="chz-selbox" data-dtl="selBox"></div>
      <div class="chz-inputbox dtl-box" data-dtl="inputBox">
        <label data-dtl="f1Wrap"><span data-dtl="f1Label">Uzunlik</span><input data-dtl="f1" type="text" inputmode="decimal" data-num="pos" autocomplete="off" /><i data-dtl="f1Unit">sm</i></label>
        <label data-dtl="f2Wrap"><span data-dtl="f2Label">Burchak</span><input data-dtl="f2" type="text" inputmode="decimal" data-num="neg" autocomplete="off" /><i data-dtl="f2Unit">&deg;</i></label>
        <button type="button" class="ok" data-dtl="btnOk" title="Kiritish (Enter)">&#10003;</button>
        <button type="button" data-dtl="btnCloseP" title="Konturni yopish — oxirgi nuqtani boshlang'ich nuqtaga ulash (C)">Yopish</button>
        <button type="button" data-dtl="btnEnd" title="Tugatish (Esc)">&#10005;</button>
      </div>
    </div>
    <div class="chz-panel">
      <h3>Detal</h3>
      <div class="dtl-name">
        <input data-dtl="nameInput" type="text" placeholder="Detal nomi (masalan: Qosh 12 sm)" maxlength="60" />
      </div>
      <div class="dtl-libbtns">
        <button type="button" class="dtl-btn on" data-dtl="btnSave" title="Joriy chizmani shu nom bilan kutubxonaga saqlash">&#128190; Saqlash</button>
        <button type="button" class="dtl-btn" data-dtl="btnNew" title="Yangi bo'sh chizma (joriysi Orqaga bilan qaytariladi)">&#10010; Yangi</button>
      </div>
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn" data-dtl="tgLib" title="Saqlangan detallar ro'yxatini ko'rsatish / yashirish">
          <span class="chev">&#9656;</span> Saqlangan detallar <span class="dtl-cnt" data-dtl="libCnt"></span>
        </button>
      </div>
      <div class="dtl-lib" data-dtl="libList" style="display:none"></div>
      <h3 class="dtl-h3">Hisob</h3>
      <div class="chz-stat lines"><span class="lbl">Yoyilma (umumiy uzunlik):</span><span class="val" data-dtl="stTotal">&mdash;</span></div>
      <div class="chz-stat kazirok"><span class="lbl">Gabarit (eni &times; bo'yi):</span><span class="val" data-dtl="stBox">&mdash;</span></div>
      <div class="chz-stat qozon"><span class="lbl">Qayirmalar (burchaklar):</span><span class="val" data-dtl="stBends">0</span></div>
      <div class="chz-stat devor"><span class="lbl">Segmentlar:</span><span class="val" data-dtl="stSegs">0</span></div>
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn open" data-dtl="tgTable" title="Segmentlar jadvalini ko'rsatish / yashirish">
          <span class="chev">&#9656;</span> Segmentlar jadvali
        </button>
      </div>
      <div class="dtl-table" data-dtl="segTable"></div>
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn" data-dtl="tgHint" title="Qo'llanma / yordamni ko'rsatish / yashirish">
          <span class="chev">&#9656;</span> Qo'llanma
        </button>
      </div>
      <div class="chz-hint" data-dtl="hintBox" style="display:none">
        &bull; <b>Chiziq</b> asbobi: maydonni bosib boshlang (yoki <b>0,0 dan boshlash</b>). Chiqqan qutiga <b>uzunlik</b> (sm) va <b>burchak</b> (°) yozib <b>Enter</b> — keyingi segment shu nuqtadan davom etadi. <b>Tab</b> — maydonlar orasida o'tish.<br>
        &bull; Burchak yozilmasa — yo'nalish <b>kursordan</b> olinadi (uzunlik yozilgan bo'lsa ham). Ikkalasi bo'sh bo'lsa Enter — tugatish.<br>
        &bull; <b>Mutlaq</b> burchak: 0° o'ng, 90° tepa, 180° chap, 270° past. <b>Nisbiy</b>: oldingi chiziqdan burilish (+ chapga, − o'ngga); masalan 90 — chapga qayirma.<br>
        &bull; <b>C</b> — konturni yopish; <b>Esc</b> — tugatish (chizilganlar qoladi); <b>Backspace</b> (bo'sh maydonda) — oxirgi nuqtani qaytarish.<br>
        &bull; <b>Tanlash</b>: chiziqqa <b>2 marta bosing</b> — uzunlik/burchakni o'zgartirish (keyingi nuqtalar birga suriladi). Uchlarni (kvadratcha) sudrab ham o'zgartirsa bo'ladi. <b>Delete</b> — o'chirish.<br>
        &bull; <b>Segmentlar jadvali</b>da har segmentning uzunligi/burchagini yozib Enter bosing — kontur qayta quriladi. <b>Nisbiy</b> rejimda burchak o'zgarsa keyingi qism birga buriladi (qayirma burchagi o'zgargandek).<br>
        &bull; <b>Holat paneli</b> (pastda, AutoCAD'dek): <b>SNAP</b> (F9) — to'r tugunlariga; <b>GRID</b> (F7, qadam ▾); <b>ORTHO</b> (F8); <b>POLAR</b> (F10, burchak qadami ▾); <b>OSNAP</b> (F3, magnit rejimlari ▾: uch nuqta, o'rta, markaz, kvadrant, kesishma, perpendikulyar, tangens, eng yaqin, davomi — belgi shakli AutoCAD'dek); <b>OTRACK</b> (F11) — nuqta ustida biroz turing, undan gorizontal/vertikal/polar kuzatish chiziqlari chiqadi, ikki chiziq kesishmasiga ham yopishadi; <b>DYN</b> (F12) — kiritish qutisi.<br>
        &bull; <b>Yoyilma</b> — barcha segmentlar yig'indisi (profil uchun list eni). <b>Surish</b>: o'rta/o'ng tugma; g'ildirak — zoom; <b>Ctrl+E</b> — markazga.<br>
        &bull; <b>Saqlash</b> — nomlab kutubxonaga (patalok, qosh...); ro'yxatdan bosib qayta ochasiz. <b>DXF</b> — lazer/AutoCAD (mm); <b>Rasm</b> — PNG.
      </div>
    </div>
  </div>
`;

export function mountDetal(root) {
  root.classList.add('chz', 'dtl');
  root.innerHTML = TEMPLATE;
  const q = (name) => root.querySelector(`[data-dtl="${name}"]`);

  /* ---------------- PALITRA (mavzudan) ---------------- */
  let P = computePalette();
  function applyPaletteVars() {
    root.style.setProperty('--chz-devor', P.devor);
    root.style.setProperty('--chz-qosh', P.qosh);
    root.style.setProperty('--chz-darvoza', P.darvoza);
    root.style.setProperty('--chz-accent', P.accent);
    root.style.setProperty('--chz-qozon', P.qozon);
    root.style.setProperty('--chz-kazirok', P.kazirok);
    root.style.setProperty('--chz-offset', P.offset);
    root.style.setProperty('--chz-edit', P.edit);
  }
  applyPaletteVars();

  /* ---------------- HOLAT (STATE) ----------------
     Koordinatalar world mm (x o'ngga, y pastga). Ekran = world*scale + pan. */
  const state = {
    ents: [],              // {id,type:'pline',pts:[{x,y}],closed} | {type:'circle',cx,cy,r} | {type:'dim',x1,y1,x2,y2,off}
    nextId: 1,
    unit: 'cm',            // kiritish/yozuv birligi
    angMode: 'abs',        // 'abs' — mutlaq (AutoCAD), 'rel' — oldingi chiziqdan burilish
    tool: 'pline',
    draft: null,           // amaldagi asbob jarayoni (rubber-band)
    sel: new Set(),        // tanlangan element id'lari
    scale: 4,              // px / mm  (1 sm = 40 px)
    panX: 0, panY: 0,
    showLen: true, showAng: true,
    snapSet: loadSnap(),              // AutoCAD OSNAP/ORTHO/POLAR/OTRACK/GRID/DYN sozlamalari (Xona konturi bilan umumiy)
    track: { hover: null, acq: [] },  // OTRACK: nuqta ustida turib "olingan" nuqtalar
    snapRes: null,                    // oxirgi resolveSnap natijasi (belgi, kuzatish chiziqlari, maslahat)
    name: '',
    lib: [],               // saqlangan detallar [{id,name,ents,t}]
    cursor: { x: 0, y: 0 },   // world (snap/cheklov qo'llangan)
    cursorS: null,            // ekran {sx,sy}
    snapHit: null,            // {x,y,kind} — yopishgan nuqta (belgi uchun)
    box: null,                // dinamik kiritish qutisi konfiguratsiyasi
    grip: null,               // sudralayotgan grip {ent, kind, idx}
    hist: [], redo: [],
  };

  const svg = q('svg');
  const canvasWrap = q('canvasWrap');
  const inputBox = q('inputBox');
  const in1 = q('f1'), in2 = q('f2');
  const selBoxEl = q('selBox');

  // AutoCAD holat paneli (chizma maydoni pastida): SNAP/GRID/ORTHO/POLAR/OSNAP/OTRACK/DYN + koordinata
  function onSnapChange(key) {
    saveSnap(state.snapSet);
    if (key === 'dyn' && state.box) { if (state.snapSet.dyn) { inputBox.classList.add('show'); positionBox(); } else inputBox.classList.remove('show'); }
    syncButtons(); render();
  }
  const statusBar = mountStatusBar(canvasWrap, { settings: state.snapSet, onChange: onSnapChange });

  function U() { return UNITS[state.unit]; }
  function fmtLen(mm) { return fmtNum(mm / U(), 2) + ' ' + UNIT_LABEL[state.unit]; }
  function worldToScreen(x, y) { return { x: x * state.scale + state.panX, y: y * state.scale + state.panY }; }
  function screenToWorld(sx, sy) { return { x: (sx - state.panX) / state.scale, y: (sy - state.panY) / state.scale }; }
  function evScreen(e) { const r = svg.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }
  function setInfo(msg) { const el = q('info'); if (el) el.textContent = msg || ''; }

  /* ---------------- TARIX (undo/redo) ---------------- */
  function snapshot() { return JSON.stringify({ ents: state.ents, nextId: state.nextId, name: state.name }); }
  function restore(s) {
    const o = JSON.parse(s);
    state.ents = o.ents || []; state.nextId = o.nextId || 1; state.name = o.name || '';
    q('nameInput').value = state.name;
    state.sel.clear();
  }
  function pushHistory() { state.hist.push(snapshot()); if (state.hist.length > 120) state.hist.shift(); state.redo.length = 0; }
  function undo() { if (!state.hist.length) return; cancelDraft(false); state.redo.push(snapshot()); restore(state.hist.pop()); afterChange(); }
  function redo() { if (!state.redo.length) return; cancelDraft(false); state.hist.push(snapshot()); restore(state.redo.pop()); afterChange(); }

  /* ---------------- ELEMENTLAR ---------------- */
  function newEnt(type, props) { return Object.assign({ id: state.nextId++, type }, props); }
  function getEnt(id) { return state.ents.find((e) => e.id === id); }
  function cloneEnt(e) { const c = JSON.parse(JSON.stringify(e)); c.id = state.nextId++; return c; }
  function entVerts(e) {
    if (e.type === 'pline') return e.pts;
    if (e.type === 'circle') return [{ x: e.cx - e.r, y: e.cy }, { x: e.cx + e.r, y: e.cy }, { x: e.cx, y: e.cy - e.r }, { x: e.cx, y: e.cy + e.r }];
    if (e.type === 'dim') return [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
    return [];
  }
  function mapEnt(e, fn, rFactor) {
    if (e.type === 'pline') e.pts = e.pts.map(fn);
    else if (e.type === 'circle') { const c = fn({ x: e.cx, y: e.cy }); e.cx = c.x; e.cy = c.y; if (rFactor != null) e.r = Math.abs(e.r * rFactor); }
    else if (e.type === 'dim') {
      const a = fn({ x: e.x1, y: e.y1 }), b = fn({ x: e.x2, y: e.y2 });
      e.x1 = a.x; e.y1 = a.y; e.x2 = b.x; e.y2 = b.y;
      if (rFactor != null) e.off *= Math.abs(rFactor);
    }
  }
  function selectedEnts() { return state.ents.filter((e) => state.sel.has(e.id)); }
  // Element bilan (wx,wy) orasidagi masofa (world mm) + pline uchun segment indeksi
  function distToEnt(e, wx, wy) {
    if (e.type === 'pline') {
      let best = Infinity, seg = -1;
      for (const s of plineSegs(e)) { const d = distToSeg(wx, wy, s.a.x, s.a.y, s.b.x, s.b.y); if (d < best) { best = d; seg = s.i; } }
      return { d: best, seg };
    }
    if (e.type === 'circle') return { d: Math.abs(Math.hypot(wx - e.cx, wy - e.cy) - e.r), seg: -1 };
    if (e.type === 'dim') {
      const n = dimNormal(e);
      const a = { x: e.x1 + n.x * e.off, y: e.y1 + n.y * e.off }, b = { x: e.x2 + n.x * e.off, y: e.y2 + n.y * e.off };
      return { d: Math.min(distToSeg(wx, wy, a.x, a.y, b.x, b.y), distToSeg(wx, wy, e.x1, e.y1, e.x2, e.y2)), seg: -1 };
    }
    return { d: Infinity, seg: -1 };
  }
  function entAt(sx, sy) {
    const thr = 7 / state.scale;
    const w = screenToWorld(sx, sy);
    let best = null, bd = thr, bseg = -1;
    for (const e of state.ents) { const r = distToEnt(e, w.x, w.y); if (r.d <= bd) { bd = r.d; best = e; bseg = r.seg; } }
    return best ? { ent: best, seg: bseg } : null;
  }
  // O'lcham chizig'ining chap normali (world): o'ngga yo'nalgan chiziq uchun TEPA
  function dimNormal(e) {
    let dx = e.x2 - e.x1, dy = e.y2 - e.y1; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    return { x: dy, y: -dx };
  }
  // Barcha elementlar (+ chizilayotgan) chegarasi
  function bounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); };
    for (const e of state.ents) {
      for (const p of entVerts(e)) add(p);
      if (e.type === 'dim') { const n = dimNormal(e); add({ x: e.x1 + n.x * e.off, y: e.y1 + n.y * e.off }); add({ x: e.x2 + n.x * e.off, y: e.y2 + n.y * e.off }); }
    }
    if (state.draft && state.draft.pts) for (const p of state.draft.pts) add(p);
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  /* ---------------- YOPISHISH (AutoCAD OSNAP) va KUZATISH — osnap.js ----------------
     Magnit nuqtalari: elementlarning uchlari, o'rtalari, markaz/kvadrantlar, kesishmalar,
     perpendikulyar/tangens (tayanch nuqtadan), eng yaqin, (0,0) va chizilayotgan chiziq.
     from berilsa — ORTHO/POLAR nurlari va OTRACK (olingan nuqtalardan) kuzatish chiziqlari. */
  function gridStep() { return gridStepFor(state.snapSet, state.scale); }
  function snapGeom(skipEid) {
    const nodes = [{ x: 0, y: 0, eid: 0 }], segs = [];
    const d = state.draft;
    if (d && d.tool === 'pline') {
      for (const p of d.pts) nodes.push({ x: p.x, y: p.y, eid: -1 });
      for (let i = 0; i + 1 < d.pts.length; i++) segs.push({ a: d.pts[i], b: d.pts[i + 1], eid: -1 });
    }
    return buildGeom(state.ents, { skip: (e) => skipEid != null && e.id === skipEid, nodes, segs });
  }
  // Ekran nuqtasini world nuqtaga: OSNAP > kuzatish kesishmasi > polar/orto > kuzatish > to'r > xom
  function resolveCursor(sx, sy, from, skipEid) {
    const geom = snapGeom(skipEid);
    const res = resolveSnap({ geom, cur: screenToWorld(sx, sy), scale: state.scale, settings: state.snapSet, from, skipEid, acquired: state.track.acq, gridStep: gridStep() });
    state.snapRes = res;
    state.snapHit = res.snap ? { x: res.snap.x, y: res.snap.y, kind: res.snap.kind } : null;
    updateAcquire(state.track, res, Date.now(), geom, state.snapSet);
    return { x: res.x, y: res.y };
  }
  // Nuqta belgilangach olingan (OTRACK) nuqtalar tozalanadi — AutoCAD'dek
  function clearAcq() { state.track.acq = []; state.track.hover = null; }
  // Joriy asbob uchun cheklov tayanch nuqtasi (rubber-band boshi)
  function anchorPoint() {
    const d = state.draft;
    if (!d) return null;
    if (d.tool === 'pline') return d.pts[d.pts.length - 1];
    if (d.tool === 'dim') return d.p2 ? null : (d.p1 || null);
    if (['move', 'copy', 'rotate', 'mirror', 'scale'].includes(d.tool)) return d.base || null;
    return null;
  }

  /* ---------------- SEGMENT PARAMETRIK TAHRIRI ----------------
     i-segment (pts[i] -> pts[i+1]) uzunligi/burchagi o'zgarsa uchi ko'chadi,
     KEYINGI nuqtalar birga suriladi (zanjir buzilmaydi). Nisbiy rejimda burchak
     o'zgarsa keyingi qism pts[i] atrofida BURILADI (qayirma burchagi o'zgargandek). */
  function setSegment(ent, i, lenMm, absAng) {
    const p = ent.pts, n = p.length;
    if (i < 0 || i + 1 >= n) return;
    const a = p[i], b = p[i + 1];
    const oldAng = vecAng(b.x - a.x, b.y - a.y);
    const newAng = absAng == null ? oldAng : norm360(absAng);
    if (state.angMode === 'rel' && absAng != null && Math.abs(norm180(newAng - oldAng)) > 1e-9) {
      const dA = norm180(newAng - oldAng);
      for (let k = i + 1; k < n; k++) p[k] = rotPt(p[k], a, dA);
    }
    const v = dirVec(newAng);
    const L = lenMm == null ? dist(a, p[i + 1]) : Math.max(0.01, lenMm);
    const nb = { x: a.x + v.dx * L, y: a.y + v.dy * L };
    const dx = nb.x - p[i + 1].x, dy = nb.y - p[i + 1].y;
    for (let k = i + 1; k < n; k++) p[k] = { x: p[k].x + dx, y: p[k].y + dy };
  }
  // i-segment burchagi: mutlaq yoki (nisbiy rejimda, i>0) oldingi segmentdan burilish
  function segShownAng(pts, i) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const abs = vecAng(b.x - a.x, b.y - a.y);
    if (state.angMode === 'rel' && i > 0) {
      const p = pts[i - 1];
      return norm180(abs - vecAng(a.x - p.x, a.y - p.y));
    }
    return abs;
  }
  // Ko'rsatilayotgan burchak -> mutlaq (nisbiy rejimda oldingi segmentga qo'shiladi)
  function shownToAbs(pts, i, val) {
    if (state.angMode === 'rel' && i > 0) {
      const p = pts[i - 1], a = pts[i];
      return norm360(vecAng(a.x - p.x, a.y - p.y) + val);
    }
    return norm360(val);
  }

  /* ---------------- DINAMIK KIRITISH QUTISI (AutoCAD uslubi) ----------------
     cfg = { anchor:{x,y}, f1:{label,unit:'len'|'ang'|'num',val}|null,
             f2:{...}|null, pline:bool, onCommit(v1,v2) }
     Quti langar nuqtasi yonida turadi (pan/zoom'da birga yuradi). */
  function openBox(cfg) {
    state.box = cfg;
    syncBoxLabels();
    if (!state.snapSet.dyn) { inputBox.classList.remove('show'); return; }   // DYN o'chiq — faqat sichqoncha bilan
    inputBox.classList.add('show');
    in1.value = (cfg.f1 && cfg.f1.val != null) ? String(cfg.f1.val) : '';
    in2.value = (cfg.f2 && cfg.f2.val != null) ? String(cfg.f2.val) : '';
    positionBox();
    const first = cfg.f1 ? in1 : in2;
    first.focus(); first.select();
  }
  function syncBoxLabels() {
    const b = state.box; if (!b) return;
    q('f1Wrap').style.display = b.f1 ? '' : 'none';
    q('f2Wrap').style.display = b.f2 ? '' : 'none';
    const unitTxt = (f) => (f.unit === 'len' ? UNIT_LABEL[state.unit] : (f.unit === 'ang' ? '°' : '×'));
    if (b.f1) { q('f1Label').textContent = b.f1.label; q('f1Unit').textContent = unitTxt(b.f1); in1.dataset.num = b.f1.unit === 'ang' ? 'neg' : 'pos'; }
    if (b.f2) { q('f2Label').textContent = b.f2.label; q('f2Unit').textContent = unitTxt(b.f2); in2.dataset.num = b.f2.unit === 'ang' ? 'neg' : 'pos'; }
    q('btnCloseP').style.display = b.pline ? '' : 'none';
  }
  function positionBox() {
    const b = state.box; if (!b) return;
    const r = svg.getBoundingClientRect();
    const s = worldToScreen(b.anchor.x, b.anchor.y);
    const bw = inputBox.offsetWidth || 330, bh = inputBox.offsetHeight || 38;
    let x = s.x + 18, y = s.y + 18;
    x = Math.max(4, Math.min(x, r.width - bw - 4));
    y = Math.max(4, Math.min(y, r.height - bh - 4));
    inputBox.style.left = x + 'px'; inputBox.style.top = y + 'px';
  }
  function closeBox() { state.box = null; inputBox.classList.remove('show'); }
  // [v1, v2] — bo'sh maydon null (0 dan farqli!)
  function boxVals() {
    const b = state.box; if (!b) return [null, null];
    const v = (inp, f) => { if (!f) return null; const s = inp.value.trim(); return s === '' ? null : sonQiymat(s); };
    return [v(in1, b.f1), v(in2, b.f2)];
  }
  function clearBoxFields() { in1.value = ''; in2.value = ''; refocusBox(true); }
  function commitBox() { const b = state.box; if (!b) return; const [v1, v2] = boxVals(); b.onCommit(v1, v2); clearAcq(); }
  function refocusBox(force) {
    if (!state.box) return;
    const first = state.box.f1 ? in1 : in2;
    if (force || (document.activeElement !== in1 && document.activeElement !== in2)) first.focus();
  }

  /* ---------------- ASBOBLAR ---------------- */
  function toolHint(t) {
    const m = {
      select: "Tanlash: element ustiga bosing yoki ramka torting (Shift — qo'shish); chiziqqa 2 marta bosing — uzunlik/burchak tahriri",
      pline: "Chiziq: boshlang'ich nuqtani bosing (yoki «0,0 dan boshlash»), so'ng uzunlik + burchak yozib Enter",
      rect: "To'rtburchak: birinchi burchakni bosing",
      circle: 'Aylana: markazni bosing',
      dim: "O'lcham: 1-nuqtani bosing",
      move: "Ko'chirish: tayanch nuqtani bosing",
      copy: 'Nusxa: tayanch nuqtani bosing',
      rotate: 'Burish: tayanch nuqtani bosing',
      mirror: "Aks: o'qning 1-nuqtasini bosing",
      scale: 'Masshtab: tayanch nuqtani bosing',
      offset: 'Offset: chiziq yoki aylanani bosing',
      erase: "O'chirish: element ustiga bosing",
    };
    return m[t] || '';
  }
  const MODIFY = ['move', 'copy', 'rotate', 'mirror', 'scale'];
  function setTool(t) {
    if (!TOOLS.includes(t)) return;
    cancelDraft(true);
    state.tool = t;
    if (MODIFY.includes(t) && !state.sel.size) setInfo("Avval element(lar)ni «Tanlash» asbobi bilan belgilang, so'ng tayanch nuqtani bosing");
    else setInfo(toolHint(t));
    syncButtons(); render();
  }
  // Amaldagi jarayonni to'xtatish. finish=true — chizilayotgan chiziq saqlanib qoladi.
  function cancelDraft(finish) {
    const d = state.draft;
    if (d && d.tool === 'pline' && finish) { finishPline(false); return; }
    state.draft = null; closeBox(); state.snapHit = null;
  }
  function cancelCurrent() {
    if (state.draft && state.draft.tool === 'pline') { finishPline(false); return; }
    state.draft = null; closeBox(); state.snapHit = null;
    setInfo(toolHint(state.tool)); render();
  }

  /* ---- Chiziq (polyline) — asosiy asbob ---- */
  function lastAbs(d) {
    const n = d.pts.length;
    if (n >= 2) { const a = d.pts[n - 2], b = d.pts[n - 1]; return vecAng(b.x - a.x, b.y - a.y); }
    return 0;
  }
  // Kiritilgan burchak -> mutlaq (nisbiy rejimda oldingi segmentga qo'shiladi)
  function plineAbs(d, ang) {
    if (state.angMode === 'rel' && d.pts.length >= 2) return norm360(lastAbs(d) + ang);
    return norm360(ang);
  }
  // Kursor + yozilgan qiymatlardan KEYINGI nuqta (jonli ko'rinish va commit uchun bir xil)
  function previewTarget() {
    const d = state.draft;
    const from = d.pts[d.pts.length - 1], c = state.cursor;
    const [len, ang] = boxVals();
    if (len == null && ang == null) return c;
    let absAng;
    if (ang == null) absAng = dist(from, c) > 1e-6 ? vecAng(c.x - from.x, c.y - from.y) : lastAbs(d);
    else absAng = plineAbs(d, ang);
    const L = len == null ? dist(from, c) : len * U();
    const v = dirVec(absAng);
    return { x: from.x + v.dx * L, y: from.y + v.dy * L };
  }
  function startPline(w) {
    state.draft = { tool: 'pline', pts: [{ x: w.x, y: w.y }] };
    openBox({ anchor: w, f1: { label: 'Uzunlik', unit: 'len' }, f2: { label: 'Burchak', unit: 'ang' }, pline: true, onCommit: plineCommit });
    setInfo('Uzunlik va burchak yozib Enter (yoki keyingi nuqtani bosing). Esc — tugatish, C — yopish, Backspace — oxirgi nuqtani qaytarish');
    render(); updatePanel();
  }
  function plineAdd(t) {
    const d = state.draft;
    const last = d.pts[d.pts.length - 1];
    if (dist(last, t) < 1e-6) return;
    d.pts.push({ x: t.x, y: t.y });
    state.box.anchor = d.pts[d.pts.length - 1];
    state.box.f2.label = state.angMode === 'rel' ? 'Burilish' : 'Burchak';
    syncBoxLabels(); clearBoxFields(); positionBox();
    render(); updatePanel();
  }
  function plineCommit(len, ang) {
    const d = state.draft; if (!d) return;
    if (len == null && ang == null) {
      if (d.pts.length >= 2) finishPline(false);
      else setInfo('Uzunlik yozing yoki keyingi nuqtani bosing');
      return;
    }
    if (len != null && !(len > 0)) { setInfo("Uzunlik 0 dan katta bo'lsin"); return; }
    plineAdd(previewTarget());
  }
  function plineClick(w) {
    const d = state.draft;
    if (!d) { startPline(w); return; }
    const sw = worldToScreen(w.x, w.y);
    if (d.pts.length >= 3) {
      const s0 = worldToScreen(d.pts[0].x, d.pts[0].y);
      if (Math.hypot(sw.x - s0.x, sw.y - s0.y) < 8) { finishPline(true); return; }   // boshlang'ich nuqta — yopamiz
    }
    const last = d.pts[d.pts.length - 1], sl = worldToScreen(last.x, last.y);
    if (Math.hypot(sw.x - sl.x, sw.y - sl.y) < 6) { finishPline(false); return; }   // ikki marta bosish — tugatish
    plineAdd(previewTarget());
  }
  function finishPline(close) {
    const d = state.draft; if (!d || d.tool !== 'pline') return;
    const pts = d.pts.slice();
    state.draft = null; closeBox(); state.snapHit = null;
    if (pts.length >= 2) {
      pushHistory();
      const e = newEnt('pline', { pts, closed: !!close && pts.length >= 3 });
      state.ents.push(e); state.sel.clear();
      afterChange();
    } else { render(); updatePanel(); }
    setInfo(toolHint('pline'));
  }
  function plineBackspace() {
    const d = state.draft; if (!d || d.pts.length < 2) return;
    d.pts.pop();
    state.box.anchor = d.pts[d.pts.length - 1];
    state.box.f2.label = (state.angMode === 'rel' && d.pts.length >= 2) ? 'Burilish' : 'Burchak';
    syncBoxLabels(); positionBox(); render(); updatePanel();
  }
  function start0() {
    if (state.tool !== 'pline') setTool('pline');
    if (state.draft) return;
    const r = svg.getBoundingClientRect(), s = worldToScreen(0, 0);
    if (s.x < 40 || s.y < 40 || s.x > r.width - 40 || s.y > r.height - 40) { state.panX = r.width * 0.3; state.panY = r.height * 0.6; }
    startPline({ x: 0, y: 0 });
  }

  /* ---- To'rtburchak ---- */
  function rectTarget() {
    const d = state.draft, [a, b] = boxVals(), c = state.cursor;
    return { x: a > 0 ? d.p1.x + a * U() : c.x, y: b > 0 ? d.p1.y - b * U() : c.y };
  }
  function rectClick(w) {
    const d = state.draft;
    if (!d) {
      state.draft = { tool: 'rect', p1: { x: w.x, y: w.y } };
      openBox({ anchor: w, f1: { label: 'Eni', unit: 'len' }, f2: { label: "Bo'yi", unit: 'len' },
        onCommit: (a, b) => { if (a > 0 && b > 0) makeRect(state.draft.p1, { x: w.x + a * U(), y: w.y - b * U() }); else setInfo("Eni va bo'yini yozing yoki qarama-qarshi burchakni bosing"); } });
      setInfo("Eni va bo'yini yozib Enter yoki qarama-qarshi burchakni bosing"); render(); return;
    }
    makeRect(d.p1, rectTarget());
  }
  function makeRect(a, b) {
    state.draft = null; closeBox();
    if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) { render(); return; }
    pushHistory();
    state.ents.push(newEnt('pline', { pts: [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }], closed: true }));
    afterChange(); setInfo(toolHint('rect'));
  }

  /* ---- Aylana ---- */
  function circleR() { const d = state.draft, [r] = boxVals(); return r > 0 ? r * U() : dist(d.c, state.cursor); }
  function circleClick(w) {
    const d = state.draft;
    if (!d) {
      state.draft = { tool: 'circle', c: { x: w.x, y: w.y } };
      openBox({ anchor: w, f1: { label: 'Radius', unit: 'len' }, f2: null,
        onCommit: (r) => { if (r > 0) makeCircle(state.draft.c, r * U()); else setInfo('Radius yozing yoki aylana ustidagi nuqtani bosing'); } });
      setInfo('Radius yozib Enter yoki aylana ustidagi nuqtani bosing'); render(); return;
    }
    makeCircle(d.c, circleR());
  }
  function makeCircle(c, r) {
    state.draft = null; closeBox();
    if (!(r > 0)) { render(); return; }
    pushHistory();
    state.ents.push(newEnt('circle', { cx: c.x, cy: c.y, r }));
    afterChange(); setInfo(toolHint('circle'));
  }

  /* ---- O'lcham (aligned dimension) — 3 bosish: 1-nuqta, 2-nuqta, joy ---- */
  function dimOff(p1, p2, w) {
    const n = dimNormal({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    const o = (w.x - p1.x) * n.x + (w.y - p1.y) * n.y;
    return Math.abs(o) < 1e-6 ? 24 / state.scale : o;
  }
  function dimClick(w) {
    const d = state.draft;
    if (!d) { state.draft = { tool: 'dim', p1: { x: w.x, y: w.y } }; setInfo("O'lcham: 2-nuqtani bosing"); render(); return; }
    if (!d.p2) { if (dist(d.p1, w) < 1e-6) return; d.p2 = { x: w.x, y: w.y }; setInfo("O'lcham chizig'i turadigan joyni bosing"); render(); return; }
    const off = dimOff(d.p1, d.p2, state.cursor);
    state.draft = null;
    pushHistory();
    state.ents.push(newEnt('dim', { x1: d.p1.x, y1: d.p1.y, x2: d.p2.x, y2: d.p2.y, off }));
    afterChange(); setInfo(toolHint('dim'));
  }

  /* ---- Ko'chirish / Nusxa / Burish / Aks / Masshtab (tanlanganlarga) ---- */
  function openModifyBox(t, w) {
    if (t === 'move' || t === 'copy') {
      openBox({ anchor: w, f1: { label: 'Masofa', unit: 'len' }, f2: { label: 'Burchak', unit: 'ang' },
        onCommit: (L, a) => { if (L > 0) { const v = dirVec(norm360(a || 0)); applyModify(t, { x: w.x + v.dx * L * U(), y: w.y + v.dy * L * U() }); } else setInfo('Masofa (+ burchak) yozing yoki yangi joyni bosing'); } });
      setInfo('Masofa + burchak yozib Enter yoki yangi joyni bosing');
    } else if (t === 'rotate') {
      openBox({ anchor: w, f1: null, f2: { label: 'Burchak', unit: 'ang' },
        onCommit: (_, a) => { if (a != null) applyModify(t, null, a); else setInfo("Burchak yozing yoki yo'nalishni bosing"); } });
      setInfo("Burchakni (gradus) yozib Enter yoki yo'nalishni bosing");
    } else if (t === 'scale') {
      openBox({ anchor: w, f1: { label: 'Koeffitsient', unit: 'num' }, f2: null,
        onCommit: (f) => { if (f > 0) applyModify(t, null, f); else setInfo('Koeffitsient yozing (masalan 2 yoki 0.5)'); } });
      setInfo('Koeffitsientni yozib Enter yoki masofani bosing');
    } else setInfo("O'qning 2-nuqtasini bosing");
  }
  function modifyClick(t, w) {
    if (!state.sel.size) { setInfo("Avval element(lar)ni «Tanlash» asbobi bilan belgilang"); return; }
    const d = state.draft;
    if (!d) {
      const draft = { tool: t, base: { x: w.x, y: w.y } };
      if (t === 'scale') { let m = 0; for (const e of selectedEnts()) for (const p of entVerts(e)) m = Math.max(m, dist(p, w)); draft.d0 = m > 1e-6 ? m : 1; }
      state.draft = draft;
      openModifyBox(t, draft.base);
      render(); return;
    }
    if (t === 'rotate') applyModify(t, null, vecAng(w.x - d.base.x, w.y - d.base.y));
    else if (t === 'scale') applyModify(t, null, d.d0 ? dist(d.base, w) / d.d0 : 1);
    else applyModify(t, w);
  }
  function applyModify(t, target, val) {
    const d = state.draft; if (!d) return;
    const base = d.base;
    pushHistory();
    if (t === 'move') for (const e of selectedEnts()) mapEnt(e, (p) => ({ x: p.x + target.x - base.x, y: p.y + target.y - base.y }));
    else if (t === 'copy') {
      const cl = selectedEnts().map(cloneEnt);
      for (const c of cl) mapEnt(c, (p) => ({ x: p.x + target.x - base.x, y: p.y + target.y - base.y }));
      state.ents.push(...cl);
    } else if (t === 'rotate') for (const e of selectedEnts()) mapEnt(e, (p) => rotPt(p, base, val));
    else if (t === 'scale') { if (val > 0) for (const e of selectedEnts()) mapEnt(e, (p) => ({ x: base.x + (p.x - base.x) * val, y: base.y + (p.y - base.y) * val }), val); }
    else if (t === 'mirror') {
      const cl = selectedEnts().map(cloneEnt);
      for (const c of cl) { mapEnt(c, (p) => reflPt(p, base, target)); if (c.type === 'dim') c.off = -c.off; }
      state.ents.push(...cl);
    }
    state.draft = null; closeBox();
    if (t === 'copy') { state.draft = { tool: 'copy', base: { x: target.x, y: target.y } }; openModifyBox('copy', state.draft.base); setInfo('Yana nusxa: joyni bosing yoki masofa + burchak; Esc — tugatish'); }
    afterChange();
  }

  /* ---- Offset — parallel nusxa (polyline: segmentlar surilib, burchaklarda tutashadi) ---- */
  function offsetPline(e, w, distMm) {
    const segs = plineSegs(e); if (!segs.length) return null;
    let near = segs[0], nd = Infinity;
    for (const s of segs) { const dd = distToSeg(w.x, w.y, s.a.x, s.a.y, s.b.x, s.b.y); if (dd < nd) { nd = dd; near = s; } }
    const ndx = near.b.x - near.a.x, ndy = near.b.y - near.a.y;
    const side = Math.sign((w.x - near.a.x) * (-ndy) + (w.y - near.a.y) * ndx) || 1;
    const D = (distMm != null ? distMm : nd) * side;
    const off = segs.map((s) => {
      let nx = -(s.b.y - s.a.y), ny = s.b.x - s.a.x; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      return { a: { x: s.a.x + nx * D, y: s.a.y + ny * D }, b: { x: s.b.x + nx * D, y: s.b.y + ny * D } };
    });
    const out = [];
    if (e.closed && e.pts.length > 2) {
      for (let i = 0; i < off.length; i++) { const prev = off[(i - 1 + off.length) % off.length], cur = off[i]; out.push(lineInt(prev.a, prev.b, cur.a, cur.b) || cur.a); }
    } else {
      out.push(off[0].a);
      for (let i = 1; i < off.length; i++) out.push(lineInt(off[i - 1].a, off[i - 1].b, off[i].a, off[i].b) || off[i].a);
      out.push(off[off.length - 1].b);
    }
    return out;
  }
  function offsetClick(sx, sy, w) {
    const d = state.draft;
    if (!d) {
      const hit = entAt(sx, sy);
      if (!hit || hit.ent.type === 'dim') { setInfo('Offset uchun chiziq yoki aylanani bosing'); return; }
      state.draft = { tool: 'offset', ent: hit.ent, dist: null };
      openBox({ anchor: w, f1: { label: 'Masofa', unit: 'len' }, f2: null,
        onCommit: (v) => { if (v > 0) { state.draft.dist = v * U(); setInfo("Qaysi tomonga — o'sha tomonni bosing"); } else setInfo("Masofani yozing, so'ng tomonni bosing"); } });
      setInfo("Masofani yozing (Enter), so'ng tomonni bosing — yoki to'g'ridan-to'g'ri tomonni bosing"); render(); return;
    }
    const e = d.ent, raw = screenToWorld(sx, sy);
    const [typed] = boxVals();
    const D = typed > 0 ? typed * U() : d.dist;
    pushHistory();
    if (e.type === 'circle') {
      const dr = dist(raw, { x: e.cx, y: e.cy }) - e.r;
      const nr = e.r + (D != null ? Math.sign(dr || 1) * D : dr);
      if (nr > 0) state.ents.push(newEnt('circle', { cx: e.cx, cy: e.cy, r: nr }));
    } else {
      const res = offsetPline(e, raw, D);
      if (res) state.ents.push(newEnt('pline', { pts: res, closed: e.closed }));
    }
    state.draft = null; closeBox();
    afterChange(); setInfo(toolHint('offset'));
  }

  function toolClick(sx, sy, w) {
    const t = state.tool;
    if (t === 'pline') return plineClick(w);
    if (t === 'rect') return rectClick(w);
    if (t === 'circle') return circleClick(w);
    if (t === 'dim') return dimClick(w);
    if (t === 'offset') return offsetClick(sx, sy, w);
    if (t === 'erase') {
      const hit = entAt(sx, sy);
      if (hit) { pushHistory(); state.ents = state.ents.filter((x) => x !== hit.ent); state.sel.delete(hit.ent.id); afterChange(); }
      return;
    }
    if (MODIFY.includes(t)) return modifyClick(t, w);
  }
  function eraseSelected() {
    if (!state.sel.size) return;
    pushHistory();
    state.ents = state.ents.filter((e) => !state.sel.has(e.id));
    state.sel.clear();
    afterChange();
  }

  /* ---- Segment tahriri (Tanlash asbobida chiziqqa 2 marta bosilganda) ---- */
  function openSegEdit(ent, i) {
    const pts = ent.pts;
    if (i < 0 || i + 1 >= pts.length) { setInfo("Yopuvchi segment tahrirlanmaydi — boshqa segmentni o'zgartiring"); return; }
    const a = pts[i], b = pts[i + 1];
    state.sel.clear(); state.sel.add(ent.id);
    openBox({
      anchor: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      f1: { label: 'Uzunlik', unit: 'len', val: fmtNum(dist(a, b) / U(), 2) },
      f2: { label: (state.angMode === 'rel' && i > 0) ? 'Burilish' : 'Burchak', unit: 'ang', val: fmtNum(segShownAng(pts, i), 1) },
      onCommit: (L, ang) => {
        if (L != null && !(L > 0)) { setInfo("Uzunlik 0 dan katta bo'lsin"); return; }
        pushHistory();
        setSegment(ent, i, L == null ? null : L * U(), ang == null ? null : shownToAbs(pts, i, ang));
        closeBox(); afterChange();
      },
    });
    setInfo("Uzunlik / burchakni o'zgartirib Enter (Esc — bekor)"); render(); renderTable();
  }
  function openCircleEdit(ent) {
    openBox({ anchor: { x: ent.cx, y: ent.cy }, f1: { label: 'Radius', unit: 'len', val: fmtNum(ent.r / U(), 2) }, f2: null,
      onCommit: (r) => { if (r > 0) { pushHistory(); ent.r = r * U(); closeBox(); afterChange(); } } });
    render();
  }

  /* ---- Griplar (tanlangan elementning uchlari) ---- */
  function gripsOf(e) {
    if (e.type === 'pline') return e.pts.map((p, i) => ({ x: p.x, y: p.y, kind: 'v', idx: i }));
    if (e.type === 'circle') return [{ x: e.cx, y: e.cy, kind: 'c' }, { x: e.cx + e.r, y: e.cy, kind: 'r' }];
    if (e.type === 'dim') { const n = dimNormal(e); return [{ x: e.x1, y: e.y1, kind: 'p1' }, { x: e.x2, y: e.y2, kind: 'p2' }, { x: (e.x1 + e.x2) / 2 + n.x * e.off, y: (e.y1 + e.y2) / 2 + n.y * e.off, kind: 'off' }]; }
    return [];
  }
  function gripAt(sx, sy) {
    for (const e of selectedEnts()) for (const g of gripsOf(e)) {
      const s = worldToScreen(g.x, g.y);
      if (Math.abs(s.x - sx) <= GRIP_PX + 3 && Math.abs(s.y - sy) <= GRIP_PX + 3) return { ent: e, kind: g.kind, idx: g.idx, pushed: false };
    }
    return null;
  }
  function applyGrip(w) {
    const g = state.grip, e = g.ent;
    if (g.kind === 'v') e.pts[g.idx] = { x: w.x, y: w.y };
    else if (g.kind === 'c') { e.cx = w.x; e.cy = w.y; }
    else if (g.kind === 'r') e.r = Math.max(0.1, dist(w, { x: e.cx, y: e.cy }));
    else if (g.kind === 'p1') { e.x1 = w.x; e.y1 = w.y; }
    else if (g.kind === 'p2') { e.x2 = w.x; e.y2 = w.y; }
    else if (g.kind === 'off') { const n = dimNormal(e); e.off = (w.x - e.x1) * n.x + (w.y - e.y1) * n.y; }
  }

  /* ---- Ramka bilan tanlash yordamchilari ---- */
  function pointInRect(x, y, r) { return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2; }
  function turn(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segSeg(a, b, c, d) { return (turn(a, b, c) * turn(a, b, d) < 0) && (turn(c, d, a) * turn(c, d, b) < 0); }
  function segIntersectsRect(p1, p2, r) {
    const c = [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y1 }, { x: r.x2, y: r.y2 }, { x: r.x1, y: r.y2 }];
    for (let i = 0; i < 4; i++) if (segSeg(p1, p2, c[i], c[(i + 1) % 4])) return true;
    return false;
  }

  /* ---------------- CHIZISH (render) ----------------
     paint(target, view, W, H, exportMode) — istalgan SVG'ga chizadi:
     jonli maydon (view = state) yoki PNG eksport (alohida view + och palitra). */
  function label(target, x, y, text, col, fs, PP, bold) {
    fs = fs * (PP.fs || 1);
    const w = text.length * fs * 0.6 + 8;
    target.appendChild(svgEl('rect', { x: x - w / 2, y: y - fs * 0.72 - 2, width: w, height: fs + 5, rx: 3, fill: PP.labelBg, 'pointer-events': 'none' }));
    const t = svgEl('text', { x, y: y + fs * 0.36, fill: col, 'font-size': fs, 'font-weight': bold ? 700 : 600, 'text-anchor': 'middle', 'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'pointer-events': 'none' });
    t.textContent = text;
    target.appendChild(t);
  }
  function ptsAttr(pts, w2s) { return pts.map((p) => { const s = w2s(p.x, p.y); return s.x + ',' + s.y; }).join(' '); }
  function paintGrid(target, view, W, H) {
    const g = gridStep();
    const wx0 = (0 - view.panX) / view.scale, wx1 = (W - view.panX) / view.scale;
    const wy0 = (0 - view.panY) / view.scale, wy1 = (H - view.panY) / view.scale;
    const x0 = Math.floor(wx0 / g) * g, x1 = Math.ceil(wx1 / g) * g, y0 = Math.floor(wy0 / g) * g, y1 = Math.ceil(wy1 / g) * g;
    if ((x1 - x0) / g + (y1 - y0) / g > 900) return;
    const grp = svgEl('g', { 'pointer-events': 'none' });
    for (let x = x0; x <= x1 + 1e-9; x += g) {
      const k = Math.round(x / g), sx = x * view.scale + view.panX;
      grp.appendChild(svgEl('line', { x1: sx, y1: 0, x2: sx, y2: H, stroke: P.ref, 'stroke-width': k === 0 ? 1.3 : 1, opacity: k === 0 ? 0.8 : (k % 5 === 0 ? 0.42 : 0.17) }));
    }
    for (let y = y0; y <= y1 + 1e-9; y += g) {
      const k = Math.round(y / g), sy = y * view.scale + view.panY;
      grp.appendChild(svgEl('line', { x1: 0, y1: sy, x2: W, y2: sy, stroke: P.ref, 'stroke-width': k === 0 ? 1.3 : 1, opacity: k === 0 ? 0.8 : (k % 5 === 0 ? 0.42 : 0.17) }));
    }
    target.appendChild(grp);
  }
  // Uchdagi ichki burchak: yoy + gradus yozuvi (bissektrisa bo'ylab ichkarida)
  function paintAngle(target, w2s, A, B, C, PP) {
    const th = interiorAngle(A, B, C);
    if (th > 179.6 || th < 0.4) return;
    const sA = w2s(A.x, A.y), sB = w2s(B.x, B.y), sC = w2s(C.x, C.y);
    let ux = sA.x - sB.x, uy = sA.y - sB.y; const lu = Math.hypot(ux, uy) || 1; ux /= lu; uy /= lu;
    let vx = sC.x - sB.x, vy = sC.y - sB.y; const lv = Math.hypot(vx, vy) || 1; vx /= lv; vy /= lv;
    const m = PP.fs || 1;
    const r = Math.min(17 * m, lu * 0.45, lv * 0.45);
    const col = PP.offset;
    if (r >= 5) {
      const p1 = { x: sB.x + ux * r, y: sB.y + uy * r }, p2 = { x: sB.x + vx * r, y: sB.y + vy * r };
      const sweep = (ux * vy - uy * vx) > 0 ? 1 : 0;
      target.appendChild(svgEl('path', { d: `M${p1.x} ${p1.y} A${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y}`, stroke: col, 'stroke-width': 1 * m, fill: 'none', 'pointer-events': 'none' }));
    }
    let bx = ux + vx, by = uy + vy; const bl = Math.hypot(bx, by);
    if (bl < 1e-6) return;
    bx /= bl; by /= bl;
    const tr = Math.max(r, 5) + 13 * m;
    label(target, sB.x + bx * tr, sB.y + by * tr, fmtAng(th), col, 10.5, PP);
  }
  // Polyline yozuvlari: har segment uzunligi (tashqi tomonda) + har uchda burchak
  function paintPlineLabels(target, pts, closed, w2s, PP, sel) {
    const n = pts.length;
    if (n < 2) return;
    let cx = 0, cy = 0; for (const p of pts) { cx += p.x; cy += p.y; } cx /= n; cy /= n;
    const sc = w2s(cx, cy);
    const m = PP.fs || 1;
    if (state.showLen) for (const s of plineSegs({ pts, closed })) {
      const L = dist(s.a, s.b); if (L < 1e-6) continue;
      const sa = w2s(s.a.x, s.a.y), sb = w2s(s.b.x, s.b.y);
      let nx = -(sb.y - sa.y), ny = sb.x - sa.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2;
      const d = (mx - sc.x) * nx + (my - sc.y) * ny;
      if (d < -1e-6 || (Math.abs(d) <= 1e-6 && ny > 0)) { nx = -nx; ny = -ny; }
      label(target, mx + nx * 14 * m, my + ny * 14 * m, fmtLen(L), sel ? PP.accent : PP.text, 11, PP);
    }
    if (state.showAng) for (let k = 0; k < n; k++) {
      const cyc = closed && n > 2;
      if (!(k > 0 || cyc) || !(k < n - 1 || cyc)) continue;
      paintAngle(target, w2s, pts[(k - 1 + n) % n], pts[k], pts[(k + 1) % n], PP);
    }
  }
  function paintDim(target, e, sel, w2s, view, PP) {
    const p1 = w2s(e.x1, e.y1), p2 = w2s(e.x2, e.y2);
    let dx = p2.x - p1.x, dy = p2.y - p1.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = dy, ny = -dx;
    const m = PP.fs || 1;
    const o = e.off * view.scale, sgn = o >= 0 ? 1 : -1, ext = 7 * m * sgn;
    const a = { x: p1.x + nx * o, y: p1.y + ny * o }, b = { x: p2.x + nx * o, y: p2.y + ny * o };
    const col = sel ? PP.accent : PP.kazirok;
    const g = svgEl('g', { 'pointer-events': 'none' });
    g.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: a.x + nx * ext, y2: a.y + ny * ext, stroke: col, 'stroke-width': 0.9 * m, opacity: 0.8 }));
    g.appendChild(svgEl('line', { x1: p2.x, y1: p2.y, x2: b.x + nx * ext, y2: b.y + ny * ext, stroke: col, 'stroke-width': 0.9 * m, opacity: 0.8 }));
    g.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': (sel ? 1.8 : 1.1) * m }));
    const ah = 9 * m, aw = 2.8 * m;
    g.appendChild(svgEl('polygon', { points: `${a.x},${a.y} ${a.x + dx * ah + nx * aw},${a.y + dy * ah + ny * aw} ${a.x + dx * ah - nx * aw},${a.y + dy * ah - ny * aw}`, fill: col }));
    g.appendChild(svgEl('polygon', { points: `${b.x},${b.y} ${b.x - dx * ah + nx * aw},${b.y - dy * ah + ny * aw} ${b.x - dx * ah - nx * aw},${b.y - dy * ah - ny * aw}`, fill: col }));
    target.appendChild(g);
    label(target, (a.x + b.x) / 2 + nx * 10 * m * sgn, (a.y + b.y) / 2 + ny * 10 * m * sgn, fmtLen(dist({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 })), col, 11, PP, true);
  }
  function paintDraft(target, w2s, view, PP) {
    const d = state.draft, cur = state.cursor;
    const dash = { stroke: PP.edit, 'stroke-width': 1.6, 'stroke-dasharray': '6 4', fill: 'none', 'pointer-events': 'none' };
    if (d.tool === 'pline') {
      const t = previewTarget();
      if (d.pts.length >= 2) target.appendChild(svgEl('polyline', { points: ptsAttr(d.pts, w2s), stroke: PP.edit, 'stroke-width': 2, fill: 'none', 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
      const last = d.pts[d.pts.length - 1], sl = w2s(last.x, last.y), st = w2s(t.x, t.y);
      target.appendChild(svgEl('line', Object.assign({ x1: sl.x, y1: sl.y, x2: st.x, y2: st.y }, dash)));
      const s0 = w2s(d.pts[0].x, d.pts[0].y);
      target.appendChild(svgEl('circle', { cx: s0.x, cy: s0.y, r: 4, fill: 'none', stroke: PP.edit, 'stroke-width': 1.5, 'pointer-events': 'none' }));
      paintPlineLabels(target, d.pts.concat([t]), false, w2s, PP, false);
      const L = dist(last, t);
      if (L > 1e-6) {
        const abs = vecAng(t.x - last.x, t.y - last.y);
        const shown = (state.angMode === 'rel' && d.pts.length >= 2) ? norm180(abs - lastAbs(d)) : abs;
        label(target, st.x + 30, st.y - 22, fmtLen(L) + '   ∠ ' + fmtAng(shown), PP.edit, 11, PP, true);
      }
    } else if (d.tool === 'rect') {
      const a = d.p1, b = rectTarget();
      target.appendChild(svgEl('polygon', Object.assign({ points: ptsAttr([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], w2s) }, dash)));
      const s = w2s(b.x, b.y);
      label(target, s.x + 34, s.y - 20, fmtLen(Math.abs(b.x - a.x)) + ' × ' + fmtLen(Math.abs(b.y - a.y)), PP.edit, 11, PP, true);
    } else if (d.tool === 'circle') {
      const r = circleR(), c = w2s(d.c.x, d.c.y);
      target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: r * view.scale }, dash)));
      label(target, c.x, c.y - r * view.scale - 12, 'R ' + fmtLen(r), PP.edit, 11, PP, true);
    } else if (d.tool === 'dim') {
      if (!d.p2) { const s1 = w2s(d.p1.x, d.p1.y), s2 = w2s(cur.x, cur.y); target.appendChild(svgEl('line', Object.assign({ x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }, dash))); }
      else paintDim(target, { x1: d.p1.x, y1: d.p1.y, x2: d.p2.x, y2: d.p2.y, off: dimOff(d.p1, d.p2, cur) }, true, w2s, view, PP);
    } else if (MODIFY.includes(d.tool)) {
      const base = d.base, [v1, v2] = boxVals();
      let fn = null, rf = null;
      if (d.tool === 'move' || d.tool === 'copy') {
        let tgt = cur;
        if (v1 > 0) { const v = dirVec(norm360(v2 || 0)); tgt = { x: base.x + v.dx * v1 * U(), y: base.y + v.dy * v1 * U() }; }
        fn = (p) => ({ x: p.x + tgt.x - base.x, y: p.y + tgt.y - base.y });
      } else if (d.tool === 'rotate') { const ang = v2 != null ? v2 : vecAng(cur.x - base.x, cur.y - base.y); fn = (p) => rotPt(p, base, ang); }
      else if (d.tool === 'scale') { const f = v1 > 0 ? v1 : (d.d0 ? dist(base, cur) / d.d0 : 1); rf = f; fn = (p) => ({ x: base.x + (p.x - base.x) * f, y: base.y + (p.y - base.y) * f }); }
      else fn = (p) => reflPt(p, base, cur);
      for (const e of selectedEnts()) {
        const g = JSON.parse(JSON.stringify(e)); mapEnt(g, fn, rf);
        if (g.type === 'dim') { if (d.tool === 'mirror') g.off = -g.off; paintDim(target, g, true, w2s, view, PP); }
        else if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, dash, { stroke: PP.accent })));
        else if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, dash, { stroke: PP.accent }))); }
      }
      if (d.tool === 'mirror') { const s1 = w2s(base.x, base.y), s2 = w2s(cur.x, cur.y); target.appendChild(svgEl('line', { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: PP.accent, 'stroke-width': 1, 'stroke-dasharray': '2 3', 'pointer-events': 'none' })); }
      const sb = w2s(base.x, base.y);
      target.appendChild(svgEl('circle', { cx: sb.x, cy: sb.y, r: 3.5, fill: PP.accent, 'pointer-events': 'none' }));
    } else if (d.tool === 'offset' && d.ent) {
      const e = d.ent, hi = { stroke: PP.accent, 'stroke-width': 3.5, fill: 'none', opacity: 0.55, 'pointer-events': 'none' };
      if (e.type === 'circle') { const c = w2s(e.cx, e.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: e.r * view.scale }, hi))); }
      else target.appendChild(svgEl(e.closed && e.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(e.pts, w2s) }, hi)));
    }
  }
  // Yopishish belgisi (rejimga qarab shakl), OTRACK/polar kuzatish chiziqlari, olingan nuqtalar, maslahat
  function paintSnapOverlay(target, w2s, res, W, H, PP) {
    const ext = Math.max(W, H) * 2;
    for (const t of res.tracks || []) {
      const a = w2s(t.from.x, t.from.y), b = w2s(t.to.x, t.to.y);
      let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const p1 = t.polar ? a : { x: a.x - dx * ext, y: a.y - dy * ext };   // polar nur faqat oldinga, kuzatish chizig'i ikki tomonga
      const p2 = { x: a.x + dx * ext, y: a.y + dy * ext };
      target.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: PP.accent, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0.75, 'pointer-events': 'none' }));
    }
    for (const A of state.track.acq) {
      const s = w2s(A.x, A.y);
      target.appendChild(svgEl('line', { x1: s.x - 5, y1: s.y, x2: s.x + 5, y2: s.y, stroke: PP.accent, 'stroke-width': 1.2, 'pointer-events': 'none' }));
      target.appendChild(svgEl('line', { x1: s.x, y1: s.y - 5, x2: s.x, y2: s.y + 5, stroke: PP.accent, 'stroke-width': 1.2, 'pointer-events': 'none' }));
    }
    if (res.snap) { const s = w2s(res.snap.x, res.snap.y); for (const sh of snapMarkerShapes(res.snap.kind, s.x, s.y, PP.accent, 6)) target.appendChild(svgEl(sh.tag, sh.attrs)); }
    else if (res.kind !== 'raw' && res.kind !== 'grid') { const s = w2s(res.x, res.y); for (const sh of snapMarkerShapes(res.kind, s.x, s.y, PP.accent, 5)) target.appendChild(svgEl(sh.tag, sh.attrs)); }
    if (res.tip && state.cursorS) label(target, state.cursorS.sx + 16 + res.tip.length * 3.2, state.cursorS.sy + 24, res.tip, PP.accent, 10.5, PP);
  }
  function paint(target, view, W, H, exportMode) {
    const PP = exportMode ? EXPORT_P : P;
    const m = PP.fs || 1;
    const w2s = (x, y) => ({ x: x * view.scale + view.panX, y: y * view.scale + view.panY });
    while (target.firstChild) target.removeChild(target.firstChild);
    if (exportMode) target.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));
    else if (state.snapSet.grid) paintGrid(target, view, W, H);
    // 1) elementlar
    for (const e of state.ents) {
      const sel = !exportMode && state.sel.has(e.id);
      if (e.type === 'dim') { paintDim(target, e, sel, w2s, view, PP); continue; }
      const col = sel ? PP.accent : PP.devor;
      const attrs = { stroke: col, 'stroke-width': (sel ? 2.6 : 1.9) * m, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none' };
      if (sel) attrs['stroke-dasharray'] = '7 4';
      if (e.type === 'pline') {
        if (e.pts.length < 2) { const s = w2s(e.pts[0].x, e.pts[0].y); target.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 2.5, fill: col })); continue; }
        target.appendChild(svgEl(e.closed && e.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(e.pts, w2s) }, attrs)));
      } else if (e.type === 'circle') {
        const c = w2s(e.cx, e.cy);
        target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: e.r * view.scale }, attrs)));
      }
    }
    // 2) yozuvlar (uzunlik + burchak)
    for (const e of state.ents) {
      if (e.type === 'pline') paintPlineLabels(target, e.pts, e.closed, w2s, PP, !exportMode && state.sel.has(e.id));
      else if (e.type === 'circle' && state.showLen) { const c = w2s(e.cx, e.cy); label(target, c.x, c.y - e.r * view.scale - 12 * m, 'R ' + fmtLen(e.r), PP.text, 11, PP); }
    }
    if (exportMode) return;
    // 3) chizilayotgan (jonli)
    if (state.draft) paintDraft(target, w2s, view, PP);
    // 4) griplar (Tanlash asbobida, tanlanganlarga)
    if (state.tool === 'select') for (const e of selectedEnts()) for (const g of gripsOf(e)) {
      const s = w2s(g.x, g.y);
      target.appendChild(svgEl('rect', { x: s.x - GRIP_PX, y: s.y - GRIP_PX, width: GRIP_PX * 2, height: GRIP_PX * 2, fill: PP.accentSoft || '#fff', stroke: PP.accent, 'stroke-width': 1.4, 'pointer-events': 'none' }));
    }
    // 5) AutoCAD yopishish belgisi + kuzatish chiziqlari + maslahat
    if (state.snapRes) paintSnapOverlay(target, w2s, state.snapRes, W, H, PP);
    // 6) koordinata boshi (0,0)
    const o = w2s(0, 0);
    target.appendChild(svgEl('circle', { cx: o.x, cy: o.y, r: 3, fill: 'none', stroke: PP.ref, 'stroke-width': 1.2, 'pointer-events': 'none' }));
  }
  function render() {
    const r = svg.getBoundingClientRect();
    paint(svg, { scale: state.scale, panX: state.panX, panY: state.panY }, r.width, r.height, false);
    positionBox(); updateScaleInfo(); saveLS();
  }
  function afterChange() { render(); updatePanel(); }

  /* ---------------- YON PANEL: hisob, segmentlar jadvali, kutubxona ---------------- */
  function activePline() {
    if (state.draft && state.draft.tool === 'pline') return { pts: state.draft.pts, closed: false, draft: true };
    const sel = selectedEnts().filter((e) => e.type === 'pline');
    if (sel.length === 1) return sel[0];
    for (let i = state.ents.length - 1; i >= 0; i--) if (state.ents[i].type === 'pline') return state.ents[i];
    return null;
  }
  function updatePanel() {
    let total = 0, segs = 0, bends = 0;
    for (const e of state.ents) if (e.type === 'pline') {
      for (const s of plineSegs(e)) { total += dist(s.a, s.b); segs++; }
      const n = e.pts.length, cyc = e.closed && n > 2;
      for (let k = 0; k < n; k++) {
        if (!(k > 0 || cyc) || !(k < n - 1 || cyc)) continue;
        if (interiorAngle(e.pts[(k - 1 + n) % n], e.pts[k], e.pts[(k + 1) % n]) < 179.5) bends++;
      }
    }
    q('stTotal').textContent = segs ? fmtLen(total) : '—';
    const b = bounds();
    q('stBox').textContent = b ? fmtNum((b.maxX - b.minX) / U(), 2) + ' × ' + fmtNum((b.maxY - b.minY) / U(), 2) + ' ' + UNIT_LABEL[state.unit] : '—';
    q('stBends').textContent = String(bends);
    q('stSegs').textContent = String(segs);
    renderTable(); renderLib(); syncButtons();
  }
  function renderTable() {
    const el = q('segTable'), ap = activePline();
    if (!ap || ap.pts.length < 2) { el.innerHTML = '<div class="dtl-empty">Chiziq yo\'q — «Chiziq» asbobi bilan chizing</div>'; return; }
    const pts = ap.pts, n = pts.length, closed = !!ap.closed && n > 2, dis = ap.draft ? ' disabled' : '';
    let h = `<div class="dtl-thead"><span>№</span><span>Uzunlik, ${UNIT_LABEL[state.unit]}</span><span>${state.angMode === 'rel' ? 'Burilish°' : 'Burchak°'}</span><span title="Segment oxiridagi ichki burchak">&ang;</span></div>`;
    for (const s of plineSegs({ pts, closed })) {
      const i = s.i, wrap = closed && i === n - 1, j = (i + 1) % n;
      const L = fmtNum(dist(s.a, s.b) / U(), 2), ang = fmtNum(segShownAng(pts, i), 1);
      let vert = '';
      if (closed || j + 1 < n) vert = fmtAng(interiorAngle(pts[i], pts[j], pts[(j + 1) % n]));
      const off = dis || (wrap ? ' disabled' : '');
      h += `<div class="dtl-trow${wrap ? ' wrap' : ''}"><span>${i + 1}</span>`
        + `<input type="text" inputmode="decimal" data-num="pos" data-seg="${i}" data-f="len" value="${L}"${off} />`
        + `<input type="text" inputmode="decimal" data-num="neg" data-seg="${i}" data-f="ang" value="${ang}"${off} />`
        + `<span class="dtl-vang">${vert}</span></div>`;
    }
    if (ap.draft) h += '<div class="dtl-empty">Chizish tugagach (Esc) tahrirlash mumkin</div>';
    else if (n >= 3) h += `<label class="dtl-closed"><input type="checkbox" data-f="closed"${closed ? ' checked' : ''} /> Yopiq kontur (oxiri boshiga ulanadi)</label>`;
    el.innerHTML = h;
  }
  function loadLib() { try { const a = JSON.parse(localStorage.getItem(LIB_KEY)); state.lib = Array.isArray(a) ? a : []; } catch (e) { state.lib = []; } }
  function saveLib() { try { localStorage.setItem(LIB_KEY, JSON.stringify(state.lib)); } catch (e) { /* noop */ } }
  function libMeta(it) {
    let total = 0, segs = 0;
    for (const e of it.ents || []) if (e.type === 'pline') for (const s of plineSegs(e)) { total += dist(s.a, s.b); segs++; }
    return segs ? segs + ' seg · ' + fmtLen(total) : (it.ents || []).length + ' element';
  }
  function renderLib() {
    const el = q('libList');
    q('libCnt').textContent = state.lib.length ? '(' + state.lib.length + ')' : '';
    if (!state.lib.length) { el.innerHTML = '<div class="dtl-empty">Hali saqlangan detal yo\'q</div>'; return; }
    el.innerHTML = state.lib.map((it) =>
      `<div class="dtl-libitem${it.name === state.name ? ' cur' : ''}">`
      + `<button type="button" class="dtl-libopen" data-act="open" data-id="${it.id}" title="Ochish"><b>${escHtml(it.name)}</b><span>${escHtml(libMeta(it))}</span></button>`
      + `<button type="button" class="dtl-libdel" data-act="del" data-id="${it.id}" title="Kutubxonadan o'chirish">&#10005;</button></div>`).join('');
  }
  function saveToLib() {
    let name = (q('nameInput').value || '').trim();
    if (!state.ents.length) { setInfo("Chizma bo'sh — saqlash uchun avval chizing"); return; }
    if (!name) { name = 'Detal ' + (state.lib.length + 1); q('nameInput').value = name; }
    state.name = name;
    const item = { id: Date.now(), name, ents: JSON.parse(JSON.stringify(state.ents)), t: Date.now() };
    const idx = state.lib.findIndex((x) => String(x.name).toLowerCase() === name.toLowerCase());
    if (idx >= 0) { item.id = state.lib[idx].id; state.lib[idx] = item; } else state.lib.unshift(item);
    saveLib(); renderLib(); saveLS();
    setInfo(`«${name}» kutubxonaga saqlandi`);
  }
  function loadFromLib(id) {
    const it = state.lib.find((x) => x.id === id); if (!it) return;
    cancelDraft(false); pushHistory();
    state.ents = JSON.parse(JSON.stringify(it.ents || []));
    state.nextId = Math.max(0, ...state.ents.map((e) => e.id || 0)) + 1;
    state.name = it.name; q('nameInput').value = it.name;
    state.sel.clear();
    afterChange(); centerView();
    setInfo(`«${it.name}» ochildi`);
  }
  function newDrawing() {
    cancelDraft(false);
    if (state.ents.length || state.name) pushHistory();
    state.ents = []; state.sel.clear(); state.name = ''; q('nameInput').value = '';
    afterChange(); centerView();
    setInfo("Yangi chizma (avvalgisi Orqaga bilan qaytariladi)");
  }

  /* ---------------- EKSPORT: DXF / PNG ---------------- */
  function buildDxf() {
    const num = (v) => (Math.round(v * 1000) / 1000).toString();
    let out = '';
    const L = (x1, y1, x2, y2) => { out += '0\nLINE\n8\nDETAL\n10\n' + num(x1) + '\n20\n' + num(-y1) + '\n30\n0\n11\n' + num(x2) + '\n21\n' + num(-y2) + '\n31\n0\n'; };
    for (const e of state.ents) {
      if (e.type === 'pline') { for (const s of plineSegs(e)) if (dist(s.a, s.b) > 1e-6) L(s.a.x, s.a.y, s.b.x, s.b.y); }
      else if (e.type === 'circle') out += '0\nCIRCLE\n8\nDETAL\n10\n' + num(e.cx) + '\n20\n' + num(-e.cy) + '\n30\n0\n40\n' + num(e.r) + '\n';
    }
    return '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n' + out + '0\nENDSEC\n0\nEOF\n';
  }
  function exportDxf() {
    if (!state.ents.some((e) => e.type !== 'dim')) { setInfo("Chizma bo'sh — eksport qilinmaydi"); return; }
    downloadDxf('detal_' + safeFileName(state.name || 'chizma') + '.dxf', buildDxf());
    setInfo('DXF yuklab olindi (mm, Y yuqoriga)');
  }
  async function exportPng() {
    const b = bounds(); if (!b) { setInfo("Chizma bo'sh"); return; }
    const pad = 70, top = 60, W = 1600;
    const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
    let sc = (W - 2 * pad) / w; if (h * sc > 2400) sc = 2400 / h;
    const H = Math.round(h * sc + top + 2 * pad);
    const view = { scale: sc, panX: pad - b.minX * sc, panY: top + pad - b.minY * sc };
    const ex = svgEl('svg', { xmlns: SVG_NS, width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    paint(ex, view, W, H, true);
    const title = svgEl('text', { x: pad, y: 40, 'font-size': 22, 'font-weight': 700, fill: '#0f172a', 'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
    title.textContent = state.name || 'Detal';
    ex.appendChild(title);
    const sub = svgEl('text', { x: pad, y: 64, 'font-size': 14, fill: '#475569', 'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
    sub.textContent = 'Yoyilma: ' + q('stTotal').textContent + '   ·   Gabarit: ' + q('stBox').textContent + '   ·   Qayirmalar: ' + q('stBends').textContent;
    ex.appendChild(sub);
    const xml = new XMLSerializer().serializeToString(ex);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0);
      await new Promise((res) => cv.toBlob((png) => { if (png) downloadBlob('detal_' + safeFileName(state.name || 'chizma') + '.png', png); res(); }, 'image/png'));
      setInfo('Rasm (PNG) yuklab olindi');
    } catch (err) { setInfo("Rasm yaratib bo'lmadi"); }
    finally { URL.revokeObjectURL(url); }
  }

  /* ---------------- IMPORT: DXF ---------------- */
  async function importDxfText(text, fileName) {
    setInfo("DXF o'qilmoqda…");
    let Helper;
    try { const mod = await import('dxf'); Helper = mod.Helper || (mod.default && mod.default.Helper); } catch (e) { setInfo('DXF kutubxonasi yuklanmadi'); return; }
    if (!Helper) { setInfo('DXF kutubxonasi yuklanmadi'); return; }
    let parsed, polylines;
    try { const helper = new Helper(text); parsed = helper.parsed; polylines = helper.toPolylines().polylines || []; }
    catch (e) { setInfo("DXF o'qib bo'lmadi (fayl buzuq?)"); return; }
    const code = parsed && parsed.header ? parsed.header.insUnits : undefined;
    const f = INSUNITS_MM[code] || 1;
    const news = [];
    for (const pl of polylines) {
      const vs = (pl.vertices || []).filter((v) => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1])).map((v) => ({ x: v[0] * f, y: -v[1] * f }));
      if (vs.length < 2) continue;
      let closed = false;
      if (vs.length > 2 && dist(vs[0], vs[vs.length - 1]) < 1e-6) { vs.pop(); closed = true; }
      news.push({ pts: vs, closed });
    }
    if (!news.length) { setInfo('DXF da chiziq topilmadi'); return; }
    cancelDraft(false); pushHistory();
    for (const n of news) state.ents.push(newEnt('pline', n));
    state.sel.clear();
    if (!state.name && fileName) { state.name = String(fileName).replace(/\.dxf$/i, ''); q('nameInput').value = state.name; }
    afterChange(); centerView();
    setInfo(`${fileName || 'DXF'}: ${news.length} ta chiziq import qilindi${INSUNITS_MM[code] ? '' : " (birlik noma'lum — mm deb olindi)"}`);
  }
  async function handleFile(file) {
    if (!file) return;
    const name = file.name || 'DXF';
    if (!/\.dxf$/i.test(name)) { setInfo("Faqat .dxf fayl bo'lishi kerak"); return; }
    let text;
    try { text = await file.text(); } catch (e) { setInfo("Faylni o'qib bo'lmadi"); return; }
    await importDxfText(text, name);
  }

  /* ---------------- SAQLASH (localStorage) ---------------- */
  let _saveT = null;
  function saveStateNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ents: state.ents, nextId: state.nextId, unit: state.unit, angMode: state.angMode, tool: state.tool,
        showLen: state.showLen, showAng: state.showAng,
        scale: state.scale, panX: state.panX, panY: state.panY, name: state.name,
      }));
    } catch (e) { /* noop */ }
  }
  function saveLS() { if (_saveT) return; _saveT = setTimeout(() => { _saveT = null; saveStateNow(); }, 250); }
  function flushSaveLS() { if (!_saveT) return; clearTimeout(_saveT); _saveT = null; saveStateNow(); }
  function loadStateLS() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false;
      const o = JSON.parse(raw); if (!o || !Array.isArray(o.ents)) return false;
      state.ents = o.ents.filter((e) => e && (e.type === 'pline' ? Array.isArray(e.pts) : true));
      state.nextId = o.nextId || (Math.max(0, ...state.ents.map((e) => e.id || 0)) + 1);
      if (UNITS[o.unit]) state.unit = o.unit;
      state.angMode = o.angMode === 'rel' ? 'rel' : 'abs';
      if (TOOLS.includes(o.tool)) state.tool = o.tool;
      state.showLen = o.showLen !== false; state.showAng = o.showAng !== false;
      if (o.scale > 0) state.scale = o.scale;
      if (typeof o.panX === 'number') state.panX = o.panX;
      if (typeof o.panY === 'number') state.panY = o.panY;
      state.name = o.name || '';
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- UI SINXRON ---------------- */
  function syncButtons() {
    root.querySelectorAll('.etool').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tool') === state.tool));
    const tg = (n, onv) => { const b = q(n); if (b) b.classList.toggle('off', !onv); };
    tg('tgLen', state.showLen); tg('tgAng', state.showAng);
    q('btnUndo').disabled = !state.hist.length;
    q('btnRedo').disabled = !state.redo.length;
    q('btnStart0').style.display = (state.draft && state.draft.tool === 'pline') ? 'none' : '';
    q('unitSel').value = state.unit;
    q('angMode').value = state.angMode;
  }
  function updateScaleInfo() { const el = q('scaleInfo'); if (el) el.textContent = '1 sm = ' + fmtNum(10 * state.scale, 1) + ' px'; }
  function centerView() {
    const r = svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const b = bounds();
    if (!b) { state.scale = 4; state.panX = r.width * 0.3; state.panY = r.height * 0.62; render(); return; }
    const w = b.maxX - b.minX, h = b.maxY - b.minY, pad = 70;
    let s = Math.min((r.width - 2 * pad) / Math.max(w, 1), (r.height - 2 * pad) / Math.max(h, 1));
    if (!isFinite(s) || s <= 0 || (w < 1 && h < 1)) s = 4;
    s = Math.min(s, 40);
    state.scale = s;
    state.panX = r.width / 2 - (b.minX + b.maxX) / 2 * s;
    state.panY = r.height / 2 - (b.minY + b.maxY) / 2 * s;
    render();
  }

  /* ---------------- HODISALAR (hammasi destroy'da olib tashlanadi) ---------------- */
  const cleanups = [];
  function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); }

  // Raqamli maydonlar: vergul -> nuqta, begona belgilar rad (data-num="neg" — minus mumkin)
  const tozala = (s, neg) => {
    s = String(s).replace(/,/g, '.').replace(neg ? /[^\d.-]/g : /[^\d.]/g, '');
    if (neg) s = s.replace(/(?!^)-/g, '');
    const i = s.indexOf('.');
    return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
  };
  on(root, 'input', (e) => {
    const t = e.target;
    if (!t || t.tagName !== 'INPUT' || !t.dataset.num) return;
    const neg = t.dataset.num === 'neg', xom = t.value;
    const v = sonMatn(xom, { manfiy: neg });
    const yangi = (v === null) ? tozala(xom, neg) : v;
    if (yangi !== xom) {
      const p = t.selectionStart, farq = xom.length - yangi.length;
      t.value = yangi;
      try { t.setSelectionRange(Math.max(0, p - farq), Math.max(0, p - farq)); } catch (err) { /* noop */ }
    }
    if (state.draft && (t === in1 || t === in2)) render();   // yozilgan uzunlik jonli ko'rinsin
  });

  // Kiritish qutisi klaviaturasi
  function boxKey(e) {
    const b = state.box; if (!b) return;
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitBox(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelCurrent(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const other = e.target === in1 ? in2 : in1;
      if (other.parentElement.style.display !== 'none') { other.focus(); other.select(); }
      return;
    }
    if (b.pline && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); finishPline(true); return; }
    if (b.pline && e.key === 'Backspace' && e.target === in1 && in1.value === '') { e.preventDefault(); plineBackspace(); }
  }
  on(in1, 'keydown', boxKey);
  on(in2, 'keydown', boxKey);
  on(q('btnOk'), 'click', () => { commitBox(); refocusBox(); });
  on(q('btnCloseP'), 'click', () => finishPline(true));
  on(q('btnEnd'), 'click', () => cancelCurrent());

  // Zoom (g'ildirak) — kursor atrofida
  on(canvasWrap, 'wheel', (e) => {
    e.preventDefault();
    const { sx, sy } = evScreen(e);
    const w = screenToWorld(sx, sy);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    state.scale = Math.max(0.02, Math.min(200, state.scale * factor));
    state.panX = sx - w.x * state.scale;
    state.panY = sy - w.y * state.scale;
    render();
  }, { passive: false });

  let panning = false, panStart = null, boxSel = null;
  on(canvasWrap, 'contextmenu', (e) => e.preventDefault());
  on(canvasWrap, 'mousedown', (e) => {
    if (inputBox.contains(e.target)) return;
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      panning = true; panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();   // fokus kiritish qutisidan ketmasin
    const { sx, sy } = evScreen(e);
    if (state.tool === 'select') {
      const g = gripAt(sx, sy);
      if (g) { state.grip = g; state.snapHit = null; return; }
      boxSel = { sx, sy, moved: false, additive: e.shiftKey, candidate: entAt(sx, sy) };
      return;
    }
    const w = resolveCursor(sx, sy, anchorPoint());
    state.cursor = w; state.cursorS = { sx, sy };
    toolClick(sx, sy, w);
    clearAcq();
    refocusBox();
  });
  on(window, 'mousemove', (e) => {
    if (panning) {
      state.panX = panStart.panX + (e.clientX - panStart.x);
      state.panY = panStart.panY + (e.clientY - panStart.y);
      render(); return;
    }
    const { sx, sy } = evScreen(e);
    if (state.grip) {
      const g = state.grip;
      if (!g.pushed) { pushHistory(); g.pushed = true; }
      applyGrip(resolveCursor(sx, sy, null, g.ent.id));
      render(); return;
    }
    if (boxSel) {
      if (Math.abs(sx - boxSel.sx) > 3 || Math.abs(sy - boxSel.sy) > 3) boxSel.moved = true;
      if (boxSel.moved) {
        const x1 = Math.min(boxSel.sx, sx), y1 = Math.min(boxSel.sy, sy);
        const crossing = sx < boxSel.sx;
        selBoxEl.style.display = 'block';
        selBoxEl.style.left = x1 + 'px'; selBoxEl.style.top = y1 + 'px';
        selBoxEl.style.width = Math.abs(sx - boxSel.sx) + 'px'; selBoxEl.style.height = Math.abs(sy - boxSel.sy) + 'px';
        selBoxEl.style.border = `1.5px ${crossing ? 'dashed' : 'solid'} ${crossing ? P.accent : P.qozon}`;
        selBoxEl.style.background = `color-mix(in srgb, ${crossing ? P.accent : P.qozon} 12%, transparent)`;
      }
      return;
    }
    state.cursor = resolveCursor(sx, sy, anchorPoint());
    state.cursorS = { sx, sy };
    if (state.tool === 'select' || state.tool === 'erase') { state.snapHit = null; state.snapRes = null; }
    statusBar.setCoords('X ' + fmtNum(state.cursor.x / U(), 2) + '   Y ' + fmtNum(-state.cursor.y / U(), 2) + '  ' + UNIT_LABEL[state.unit]);
    if (state.draft || ['pline', 'rect', 'circle', 'dim', 'offset'].includes(state.tool) || MODIFY.includes(state.tool)) render();
  });
  on(window, 'mouseup', (e) => {
    if (panning) { panning = false; return; }
    if (state.grip) { const pushed = state.grip.pushed; state.grip = null; state.snapHit = null; if (pushed) afterChange(); else render(); return; }
    if (!boxSel) return;
    const { sx, sy } = evScreen(e);
    const bs = boxSel; boxSel = null; selBoxEl.style.display = 'none';
    if (!bs.moved) {
      if (!bs.additive) state.sel.clear();
      if (bs.candidate) {
        const id = bs.candidate.ent.id;
        if (bs.additive && state.sel.has(id)) state.sel.delete(id); else state.sel.add(id);
      }
    } else {
      const r = { x1: Math.min(bs.sx, sx), y1: Math.min(bs.sy, sy), x2: Math.max(bs.sx, sx), y2: Math.max(bs.sy, sy) };
      const crossing = sx < bs.sx;
      if (!bs.additive) state.sel.clear();
      for (const ent of state.ents) {
        const vs = entVerts(ent).map((p) => worldToScreen(p.x, p.y));
        let hit = vs.length > 0 && vs.every((s) => pointInRect(s.x, s.y, r));
        if (!hit && crossing) {
          hit = vs.some((s) => pointInRect(s.x, s.y, r));
          for (let i = 0; !hit && i < vs.length - 1; i++) hit = segIntersectsRect(vs[i], vs[i + 1], r);
          if (!hit && ent.type === 'pline' && ent.closed && vs.length > 2) hit = segIntersectsRect(vs[vs.length - 1], vs[0], r);
        }
        if (hit) state.sel.add(ent.id);
      }
    }
    render(); renderTable();
  });
  on(canvasWrap, 'dblclick', (e) => {
    if (inputBox.contains(e.target) || state.tool !== 'select') return;
    e.preventDefault();
    const { sx, sy } = evScreen(e);
    const hit = entAt(sx, sy); if (!hit) return;
    if (hit.ent.type === 'pline') openSegEdit(hit.ent, hit.seg);
    else if (hit.ent.type === 'circle') { state.sel.clear(); state.sel.add(hit.ent.id); openCircleEdit(hit.ent); }
  });

  // Klaviatura
  on(window, 'keydown', (e) => {
    if (statusBar.handleKey(e)) { e.preventDefault(); onSnapChange(e.key); return; }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'Escape') {
      if (state.draft || state.box) { e.preventDefault(); cancelCurrent(); }
      else if (state.sel.size) { e.preventDefault(); state.sel.clear(); render(); renderTable(); }
      return;
    }
    if (e.key === 'Enter' && state.draft && state.draft.tool === 'pline') { e.preventDefault(); finishPline(false); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel.size && !state.draft) { e.preventDefault(); eraseSelected(); return; }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'e') { e.preventDefault(); centerView(); }
  });

  // Asboblar paneli
  root.querySelectorAll('.etool').forEach((b) => on(b, 'click', () => setTool(b.getAttribute('data-tool'))));
  on(q('btnUndo'), 'click', undo);
  on(q('btnRedo'), 'click', redo);
  on(q('btnFit'), 'click', centerView);
  on(q('btnClear'), 'click', () => {
    if (!state.ents.length && !state.draft) return;
    cancelDraft(false); pushHistory();
    state.ents = []; state.sel.clear();
    afterChange(); setInfo('Tozalandi — Orqaga (Ctrl+Z) bilan qaytariladi');
  });
  on(q('btnStart0'), 'click', start0);
  on(q('unitSel'), 'change', (e) => { state.unit = UNITS[e.target.value] ? e.target.value : 'cm'; syncBoxLabels(); afterChange(); });
  on(q('angMode'), 'change', (e) => {
    state.angMode = e.target.value === 'rel' ? 'rel' : 'abs';
    if (state.box && state.box.pline) { state.box.f2.label = (state.angMode === 'rel' && state.draft && state.draft.pts.length >= 2) ? 'Burilish' : 'Burchak'; syncBoxLabels(); }
    afterChange();
  });
  const toggle = (name, key) => on(q(name), 'click', () => { state[key] = !state[key]; syncButtons(); render(); });
  toggle('tgLen', 'showLen'); toggle('tgAng', 'showAng');
  on(q('btnImport'), 'click', () => q('fileInput').click());
  on(q('fileInput'), 'change', (e) => { const f = e.target.files && e.target.files[0]; handleFile(f); e.target.value = ''; });
  on(canvasWrap, 'dragover', (e) => { e.preventDefault(); canvasWrap.classList.add('chz-dragover'); });
  on(canvasWrap, 'dragleave', () => canvasWrap.classList.remove('chz-dragover'));
  on(canvasWrap, 'drop', (e) => { e.preventDefault(); canvasWrap.classList.remove('chz-dragover'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; handleFile(f); });
  on(q('btnDxf'), 'click', exportDxf);
  on(q('btnPng'), 'click', exportPng);

  // Yon panel
  on(q('nameInput'), 'input', (e) => { state.name = e.target.value; saveLS(); });
  on(q('nameInput'), 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveToLib(); } });
  on(q('btnSave'), 'click', saveToLib);
  on(q('btnNew'), 'click', newDrawing);
  on(q('libList'), 'click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = +b.dataset.id;
    if (b.dataset.act === 'open') { loadFromLib(id); return; }
    if (b.dataset.arm === '1') { state.lib = state.lib.filter((x) => x.id !== id); saveLib(); renderLib(); setInfo("Detal kutubxonadan o'chirildi"); return; }
    b.dataset.arm = '1'; b.textContent = 'Tasdiq?'; b.classList.add('arm');
    setTimeout(() => { if (b.isConnected) { b.dataset.arm = ''; b.innerHTML = '&#10005;'; b.classList.remove('arm'); } }, 3000);
  });
  on(q('segTable'), 'change', (e) => {
    const t = e.target; if (!t || t.tagName !== 'INPUT') return;
    const ap = activePline(); if (!ap || ap.draft) return;
    if (t.dataset.f === 'closed') { pushHistory(); ap.closed = t.checked; afterChange(); return; }
    const i = +t.dataset.seg;
    if (t.dataset.f === 'len') {
      const v = sonQiymat(t.value);
      if (!(v > 0)) { renderTable(); return; }
      pushHistory(); setSegment(ap, i, v * U(), null); afterChange();
    } else if (t.dataset.f === 'ang') {
      const s = t.value.trim();
      if (s === '') { renderTable(); return; }
      pushHistory(); setSegment(ap, i, null, shownToAbs(ap.pts, i, sonQiymat(s))); afterChange();
    }
  });
  on(q('segTable'), 'keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); } });
  const listToggle = (btn, panel) => { let show = panel.style.display !== 'none'; on(btn, 'click', () => { show = !show; panel.style.display = show ? '' : 'none'; btn.classList.toggle('open', show); }); };
  listToggle(q('tgLib'), q('libList'));
  listToggle(q('tgTable'), q('segTable'));
  listToggle(q('tgHint'), q('hintBox'));

  // Sahifa yopilsa/yashirilsa — kutilayotgan saqlashni darhol yozamiz.
  on(window, 'pagehide', flushSaveLS);

  // Mavzu o'zgarsa — palitra qayta; o'lcham o'zgarsa — qayta chizish.
  const themeObs = new MutationObserver(() => { P = computePalette(); applyPaletteVars(); render(); });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const resizeObs = new ResizeObserver(() => render());
  resizeObs.observe(canvasWrap);

  /* ---------------- ISHGA TUSHIRISH ---------------- */
  loadLib();
  loadStateLS();
  q('nameInput').value = state.name;
  setInfo(toolHint(state.tool));
  updatePanel();
  render();
  requestAnimationFrame(() => centerView());

  return {
    centerView,
    destroy() {
      flushSaveLS();
      themeObs.disconnect();
      resizeObs.disconnect();
      statusBar.destroy();
      cleanups.forEach((fn) => fn());
      root.innerHTML = '';
      root.classList.remove('chz', 'dtl');
    },
  };
}
