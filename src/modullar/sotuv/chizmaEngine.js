// ============================================================
//  XONA KONTURI CHIZMA VOSITASI (engine)
// ------------------------------------------------------------
//  Savdo bo'limidagi "Chizma" oynasining butun mantig'i.
//  - Faqat gorizontal/vertikal (90°) chiziqlar.
//  - Devor = ichki kontur, Qosh (Latok) = tashqi kontur.
//  - Barcha uzunliklar ICHKARIDA millimetrda saqlanadi (kanonik).
//  - RANGLAR mavzuga (data-theme) qarab avtomatik hosil qilinadi:
//    mavzuning asosiy rangi (--c-btn) tusidan boshlab Devor / Qosh /
//    Qozon / Kazirok / belgilar rang doirasida 55-60° oraliq bilan
//    olinadi — shu sababli HAR mavzuda ham bir-biridan ajralib turadi.
//  mountChizma(root) — DOM quradi, { destroy } qaytaradi.
// ============================================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const PLUS_OFFSET = 26;   // yashil "+" (chizish) nuqtadan necha piksel narida
const OFFSET_BTN  = 30;   // offset "+" chiziq o'rtasidan necha piksel narida
const SNAP_PX     = 14;   // yopishish (snap) chegarasi, pikselda

/* Kazirok bo'laklari (devor↔qosh orasidagi yo'lak) — chiziq bo'ylab enlari (mm).
   Bo'yi har doim offset masofasiga teng. Juft-juft (asosiy + paloska) teriladi. */
const KAZ_MAIN_MM  = 356;  // asosiy bo'lak eni — 35.6 sm
const KAZ_STRIP_MM = 60;   // paloska eni — 6 sm

/* O'lcham birliklari — 1 birlik necha millimetrga teng */
const UNITS = { mm: 1, cm: 10, m: 1000 };
const LATOK_M_KEY = 'xona-chizma-latok-m'; // Qosh (Latok) umumiy (metr) — React shu yerdan o'qiydi
const QOZON_KEY = 'xona-chizma-qozon';     // { inner, outer } — qozon (ichki/tashqi) soni

// Chizma "Qosh (Latok) umumiy" qiymatini (metrda) o'qish. Latok uzunligini
// avtomatik to'ldirish uchun (chizma yopiq bo'lsa ham localStorage'dan).
export function readChizmaLatokMeters() {
  try { return parseFloat(localStorage.getItem(LATOK_M_KEY)) || 0; }
  catch (e) { return 0; }
}

// Qozon soni: { inner, outer } — ichki (botiq) va oddiy (tashqi) qozonlar.
// Varyonka (Ichki/Tashqi) sonini avtomatik to'ldirish uchun.
export function readChizmaQozon() {
  try { const o = JSON.parse(localStorage.getItem(QOZON_KEY)); return { inner: o?.inner || 0, outer: o?.outer || 0 }; }
  catch (e) { return { inner: 0, outer: 0 }; }
}

const STORAGE_KEY = 'xona-chizma-v1';
const REF_KEY = 'xona-chizma-ref-v1';   // DXF fon namuna alohida saqlanadi (asosiy chizmaga xalaqit bermasin)

/* DXF fon namuna birliklari — 1 birlik necha millimetr.
   Faqat fon (ko'rinish) uchun; hech qaysi hisobga qo'shilmaydi. */
const REF_UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
// DXF $INSUNITS kodi -> bizdagi birlik kaliti (0/noma'lum -> null, default mm).
const INSUNITS_MAP = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };

/* ---------------- MAVZUGA MOS RANG PALITRASI ----------------
   --c-btn (mavzu asosiy rangi) tusidan boshlab, rang doirasida
   teng oraliqlar bilan 6 ta vazifaviy rang hosil qilinadi.
   Och mavzuda — to'qroq (L=44%), to'q mavzularda — ochroq (L=62%). */
function parseColor(str) {
  str = (str || '').trim();
  let m = str.match(/^#([0-9a-f]{3})$/i);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
  m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  m = str.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  m = str.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  return { r: 15, g: 23, b: 42 }; // standart (slate-900)
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

export function computePalette() {
  const el = document.documentElement;
  const themed = el.classList.contains('themed');
  const btnRaw = getComputedStyle(el).getPropertyValue('--c-btn').trim() || '#0f172a';
  let { h, s } = rgbToHsl(parseColor(btnRaw));
  if (s < 0.18) s = 0.72;                 // rangsiz (mono/steel) mavzularda baza to'yinganlik
  const S = Math.round(Math.min(0.92, Math.max(0.58, s)) * 100);
  const L = themed ? 62 : 44;             // to'q fonda ochroq, och fonda to'qroq
  const mk = (dh, dl = 0) => `hsl(${Math.round(((h + dh) % 360 + 360) % 360)} ${S}% ${Math.max(24, Math.min(78, L + dl))}%)`;
  const aH = Math.round(((h + 120) % 360 + 360) % 360);
  return {
    themed,
    devor:   mk(0),         // asosiy (ichki kontur) — mavzu rangining o'zi
    qosh:    mk(55, 6),     // tashqi kontur (latok)
    accent:  mk(120),       // chizish "+", snap, tanlov
    qozon:   mk(185),       // burchak bo'laklari
    kazirok: mk(250),       // kazirok (karniz) ko'rsatkichi
    offset:  mk(305),       // offset "+" va masofa o'lchovi
    accentSoft: `hsla(${aH}, ${S}%, ${themed ? 16 : 95}%, .92)`, // "+" doira ichi
    text:    themed ? '#e2e8f0' : '#1e293b',
    labelBg: themed ? 'rgba(6,8,12,.78)' : 'rgba(255,255,255,.88)',
    point:   themed ? '#e8e8e8' : '#334155',
    pointStroke: themed ? '#888' : '#94a3b8',
    ref:     themed ? '#7e8a9c' : '#9aa6b6',   // DXF fon namuna (kulrang) rangi
    edit:    themed ? '#34d399' : '#0d9488',   // Tahrir qatlami (erkin geometriya) rangi
  };
}

/* ---------------- DOM SHABLONI ---------------- */
const TEMPLATE = `
  <div class="chz-toolbar">
    <button type="button" class="tool addpoint" data-chz="btnAddPoint" title="Yoqilsa — maydonni bosib yangi nuqta qo'shiladi (Esc — bekor)">&#10010; Nuqta qo'shish</button>
    <span class="sep"></span>
    <button type="button" class="tool import" data-chz="btnImport" title="AutoCAD DXF faylni fon namuna sifatida yuklash (faylni maydonga sudrab tashlasangiz ham bo'ladi)">&#128193; DXF namuna</button>
    <select class="rowUnit chz-refunit" data-chz="unitRef" title="DXF fayl o'lcham birligi (razmer shunga qarab o'giriladi)" style="display:none">
      <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
      <option value="in">dyuym</option><option value="ft">fut</option>
    </select>
    <button type="button" class="tool" data-chz="btnRefClear" title="Fon namunasini o'chirish" style="display:none">&#10005; Namuna</button>
    <span class="chz-refinfo" data-chz="refInfo"></span>
    <input type="file" accept=".dxf,.DXF" data-chz="fileInput" style="display:none" />
    <button type="button" class="tool editbtn" data-chz="btnEdit" title="Tahrir rejimi — AutoCAD uslubidagi chizish va tahrir (Line/Move/Rotate...)">&#9998; Tahrir</button>
    <span class="sep"></span>
    <button type="button" class="tool color-devor active" data-chz="btnRed">&#9679; Devor</button>
    <button type="button" class="tool color-qosh" data-chz="btnYellow">&#9679; Qosh (Latok)</button>
    <span class="sep"></span>
    <button type="button" class="tool" data-chz="btnUndo" title="Ctrl+Z">&#8630; Orqaga</button>
    <button type="button" class="tool" data-chz="btnRedo" title="Ctrl+Y">&#8631; Oldinga</button>
    <button type="button" class="tool" data-chz="btnDelete" title="Delete">&#128465; O'chirish</button>
    <button type="button" class="tool" data-chz="btnClear">&#10005; Tozalash</button>
    <span class="sep"></span>
    <button type="button" class="tool" data-chz="btnFit" title="Chiziqlar chegarasigacha avtozoom — Ctrl+E">&#10530; Markazga (Ctrl+E)</button>
    <span class="chz-scale" data-chz="scaleInfo"></span>
    <span class="chz-tglbl">Belgilar (+):</span>
    <button type="button" class="tool tg" data-chz="tgDevor" title="Devor + belgilari — razmer ko'rinaveradi">Devor +</button>
    <button type="button" class="tool tg" data-chz="tgQosh" title="Qosh + belgilari — razmer ko'rinaveradi">Qosh +</button>
    <button type="button" class="tool tg" data-chz="tgQozon" title="Qozonlar ko'rinishi — hisobga ta'sir qilmaydi">Qozon</button>
    <button type="button" class="tool tg" data-chz="tgKaz" title="Devor↔qosh orasidagi kazirok bo'laklari (35.6 + 6 sm juft-juft) — ko'rinish">Kaz.bo'lak</button>
    <button type="button" class="tool tg" data-chz="tgRazmer" title="Chiziq ustidagi razmer yozuvlari (raqam + o'lchov birligi)">Razmerlar</button>
    <button type="button" class="tool tg" data-chz="tgRef" title="DXF fon namunasini ko'rsatish / yashirish" style="display:none">Namuna</button>
  </div>
  <div class="chz-edittoolbar" data-chz="editToolbar" style="display:none">
    <span class="chz-tglbl">Tahrir:</span>
    <button type="button" class="tool etool" data-chz="etSelect" data-tool="select" title="Tanlash — bosing yoki ramka torting">&#10530; Select</button>
    <span class="sep"></span>
    <button type="button" class="tool etool" data-chz="etLine" data-tool="line" title="Line — 1→2 nuqta (zanjir), Esc to'xtatadi">Line</button>
    <button type="button" class="tool etool" data-chz="etPline" data-tool="pline" title="Polyline — nuqtalar, Enter tugatadi">Polyline</button>
    <button type="button" class="tool etool" data-chz="etRect" data-tool="rect" title="Rectangle — 2 burchak">Rectangle</button>
    <button type="button" class="tool etool" data-chz="etCircle" data-tool="circle" title="Circle — markaz + radius">Circle</button>
    <button type="button" class="tool etool" data-chz="etDim" data-tool="dim" title="O'lcham — ikki nuqta orasini o'lchaydi">O'lcham</button>
    <span class="sep"></span>
    <button type="button" class="tool etool" data-chz="etMove" data-tool="move" title="Move — tanlangan(lar)ni ko'chirish">Move</button>
    <button type="button" class="tool etool" data-chz="etCopy" data-tool="copy" title="Copy — nusxa (Esc to'xtatadi)">Copy</button>
    <button type="button" class="tool etool" data-chz="etRotate" data-tool="rotate" title="Rotate — burish">Rotate</button>
    <button type="button" class="tool etool" data-chz="etMirror" data-tool="mirror" title="Mirror — o'qqa nisbatan aks ettirish">Mirror</button>
    <button type="button" class="tool etool" data-chz="etScale" data-tool="scale" title="Scale — masshtab">Scale</button>
    <button type="button" class="tool etool" data-chz="etOffset" data-tool="offset" title="Offset — parallel (line/circle)">Offset</button>
    <button type="button" class="tool etool" data-chz="etTrim" data-tool="trim" title="Trim — chiziqning ortiqcha qismini kesish (kesishishgacha)">Trim</button>
    <button type="button" class="tool etool" data-chz="etExtend" data-tool="extend" title="Extend — chiziq uchini eng yaqin chegaragacha cho'zish">Extend</button>
    <button type="button" class="tool etool" data-chz="etFillet" data-tool="fillet" title="Fillet — ikki chiziqni burchakda tutashtirish (kesishgacha trim/extend)">Fillet</button>
    <button type="button" class="tool etool" data-chz="etErase" data-tool="erase" title="Erase — o'chirish">Erase</button>
    <span class="sep"></span>
    <span class="chz-tglbl">Rang/qalinlik:</span>
    <input type="color" class="chz-colorin" data-chz="entColor" value="#0d9488" title="Rang — tanlangan element(lar)ga va yangi chiziladiganlarga" />
    <select class="rowUnit" data-chz="entWidth" title="Chiziq qalinligi">
      <option value="1">ingichka</option><option value="1.6" selected>o'rta</option><option value="3">qalin</option>
    </select>
    <span class="sep"></span>
    <span class="chz-tglbl">Qatlam:</span>
    <select class="rowUnit" data-chz="layerSel" title="Joriy qatlam (yangi elementlar shunga tushadi)"></select>
    <button type="button" class="tool" data-chz="btnLayerAdd" title="Yangi qatlam qo'shish">+</button>
    <button type="button" class="tool" data-chz="btnLayerVis" title="Joriy qatlamni ko'rsatish/yashirish">&#128065;</button>
    <span class="sep"></span>
    <button type="button" class="tool" data-chz="btnRefEdit" title="Import qilingan DXF namunani tahrirlanadigan elementlarga aylantirish">&#8631; Namunani tahrirlash</button>
    <span class="chz-refinfo" data-chz="editInfo"></span>
  </div>
  <div class="chz-main">
    <div class="chz-canvas" data-chz="canvasWrap">
      <svg data-chz="svg" xmlns="${SVG_NS}"></svg>
      <div class="chz-selbox" data-chz="selBox"></div>
      <div class="chz-inputbox" data-chz="inputBox">
        <input data-chz="lengthInput" type="number" min="0" step="any" placeholder="Uzunlik" />
        <select data-chz="unitSelect">
          <option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
        </select>
      </div>
    </div>
    <div class="chz-panel">
      <h3>Hisoblash</h3>
      <div class="chz-stat qosh">
        <span class="lbl">Qosh (Latok) umumiy:</span>
        <span class="val" data-chz="totalYellow">0</span>
        <select class="rowUnit" data-chz="unitQosh"><option>mm</option><option>cm</option><option selected>m</option></select>
      </div>
      <div class="chz-stat kazirok">
        <span class="lbl">Kazirok yuzasi:</span>
        <span class="val" data-chz="kazirokArea">&mdash;</span>
        <select class="rowUnit" data-chz="unitKazirokArea"><option value="mm">mm&sup2;</option><option value="cm">cm&sup2;</option><option value="m" selected>m&sup2;</option></select>
      </div>
      <div class="chz-stat devor">
        <span class="lbl">Devor umumiy:</span>
        <span class="val" data-chz="totalRed">0</span>
        <select class="rowUnit" data-chz="unitDevor"><option>mm</option><option>cm</option><option selected>m</option></select>
      </div>
      <div class="chz-stat kazirok">
        <span class="lbl">Kazirok umumiy:</span>
        <span class="val" data-chz="kazirokLen">&mdash;</span>
        <select class="rowUnit" data-chz="unitKazirok"><option>mm</option><option>cm</option><option selected>m</option></select>
      </div>
      <div class="chz-stat qozon">
        <span class="lbl">Qozon:</span>
        <span class="val" data-chz="qozonCount">0 dona</span>
      </div>
      <div class="chz-stat lines">
        <span class="lbl">Tomonlar soni:</span>
        <span class="val" data-chz="lineCount">0</span>
      </div>
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn" data-chz="tgList" title="Chiziqlar ro'yxatini ko'rsatish / yashirish">
          <span class="chev">&#9656;</span> Chiziqlar ro'yxati
        </button>
        <label>Qozon birligi:
          <select class="rowUnit" data-chz="unitCorner"><option>mm</option><option selected>cm</option><option>m</option></select>
        </label>
      </div>
      <div class="chz-list" data-chz="lineList" style="display:none"></div>
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn" data-chz="tgHint" title="Qo'llanma / yordamni ko'rsatish / yashirish">
          <span class="chev">&#9656;</span> Qo'llanma
        </button>
      </div>
      <div class="chz-hint" data-chz="hintBox" style="display:none">
        &bull; <span style="color:var(--chz-accent)"><b>DXF namuna</b></span> &rarr; AutoCAD <b>DXF</b> faylni tugma orqali yoki maydonga <b>sudrab tashlab</b> yuklang — chizma kulrang fon namuna bo'lib chiqadi (razmerlari aynan), ustidan Devor/Qosh chizib olasiz. Birlik noto'g'ri chiqsa — yondagi birlik ro'yxatidan to'g'rilang. Hisobga qo'shilmaydi.<br>
        &bull; <span style="color:var(--chz-accent)"><b>Nuqta qo'shish</b></span> &rarr; tugmani yoqib, maydonni bossangiz yangi (erkin) nuqta ekiladi; so'ng o'sha nuqtaning <b>+</b> belgisidan chizishni boshlang. Bekor &rarr; <b>Esc</b>.<br>
        &bull; <span style="color:var(--chz-accent)"><b>+</b></span> &rarr; yangi chiziq (uzunlik &rarr; Enter).<br>
        &bull; <span style="color:var(--chz-offset)"><b>Offset +</b></span> &rarr; <b>faqat o'sha chiziq</b> shu tomonga offset bo'ladi (masofa kiriting).
          Yonidagi chiziq ham offset qilinsa — burchak avtomatik tutashadi (fillet).<br>
        &bull; <span style="color:var(--chz-qozon)"><b>Qozon bo'laklari</b></span> — har burchakda devor&harr;qoshni bog'lab <b>avtomatik</b> chiziladi (eni&times;bo'yi).<br>
        &bull; Chizishda (+ bosgach): razmer yozing <b>yoki</b> kursorni surib bosing; <b>boshqa nuqtaga tekislab</b> ham bosib chizsa bo'ladi. Bekor qilish — faqat <b>Esc</b>.<br>
        &bull; Chiziqqa <b>2 marta bosing</b> — razmerni tahrirlash.<br>
        &bull; Chiziqni bosib <b>belgilang</b> (Shift — bir nechta), so'ng <b>Delete</b> / "O'chirish".<br>
        &bull; <b>Ramka bilan belgilash</b>: bo'sh joydan chap tugmani bosib torting —
          <span style="color:var(--chz-qozon)">chapdan-o'ngga</span> = to'liq ichidagilar,
          <span style="color:var(--chz-accent)">o'ngdan-chapga</span> = kesib o'tganlar ham.<br>
        &bull; <b>Surish (pan)</b>: o'rta yoki o'ng tugmani bosib torting. G'ildirak — zoom.<br>
        &bull; Birlik: chizish — <b>default m</b>, offset — <b>default cm</b>. Panelda har detal o'z birligi.<br>
        &bull; <b>Ctrl+Z/Ctrl+Y</b> — orqaga/oldinga; <b>Markazga (Ctrl+E)</b> — chiziqlar chegarasigacha avtozoom.
      </div>
    </div>
  </div>
`;

export function mountChizma(root) {
  root.classList.add('chz');
  root.innerHTML = TEMPLATE;
  const q = (name) => root.querySelector(`[data-chz="${name}"]`);

  /* ---------------- PALITRA ---------------- */
  let P = computePalette();
  function applyPaletteVars() {
    root.style.setProperty('--chz-devor', P.devor);
    root.style.setProperty('--chz-qosh', P.qosh);
    root.style.setProperty('--chz-accent', P.accent);
    root.style.setProperty('--chz-qozon', P.qozon);
    root.style.setProperty('--chz-kazirok', P.kazirok);
    root.style.setProperty('--chz-offset', P.offset);
    root.style.setProperty('--chz-edit', P.edit);
  }
  applyPaletteVars();

  /* ---------------- DASTUR HOLATI (STATE) ----------------
     Koordinatalar world mm da (x o'ngga, y pastga).
     Ekran (piksel) = world_mm * scale + pan. scale = piksel/mm. */
  const state = {
    points: [],            // {id, x, y} — world mm
    lines:  [],            // {id, a, b, color, length(mm), unit}
    nextPointId: 1,
    nextLineId: 1,
    color: 'red',          // "red" (Devor) | "yellow" (Qosh)
    unit: 'm',
    unitDevor: 'm', unitQosh: 'm', unitKazirok: 'm', unitKazirokArea: 'm', unitCorner: 'cm',
    selectedLines: new Set(),
    scale: 1 / 50,         // piksel / mm
    panX: 0, panY: 0,
    activeInput: null,     // {mode:"draw"|...}
    placingPoint: false,   // "Nuqta qo'shish" rejimi — maydonni bosib nuqta ekiladi
    showDevorPlus: true,
    showQoshPlus: false,
    showQozon: true,
    showRazmer: true,
    showKazTiles: true,    // devor↔qosh orasidagi kazirok bo'laklari (35.6 + 6 sm) ko'rinishi
    ref: null,             // DXF fon namuna: { paths:[[ [x,y]... ]], unit } — xom (DXF birligida)
    refWorld: [],          // namuna world mm (y to'g'rilangan) — ref'dan hosil qilinadi, saqlanmaydi
    showRef: true,
    // ----- TAHRIR (AutoCAD uslubidagi mustaqil tahrir qatlami) -----
    // Bu qatlam devor/qosh/kazirok hisobiga TEGMAYDI — erkin geometriya.
    editEntities: [],      // {id,type:'line'|'polyline'|'circle'|'arc', ...world mm, layer}
    nextEntId: 1,
    editMode: false,       // "Tahrir" rejimi yoniq/ochiq
    tool: 'select',        // faol asbob
    selEdit: new Set(),    // tanlangan tahrir element id'lari
    toolDraft: null,       // chizilayotgan/amaldagi asbob holati (rubber-band)
    curColor: null,        // joriy rang (null = standart) — yangi/tanlangan elementlarga
    curWidth: null,        // joriy chiziq qalinligi (null = standart 1.6)
    curLayer: '0',         // joriy qatlam (yangi elementlar shunga tushadi)
    layers: [{ name: '0', visible: true }],  // qatlamlar (nom + ko'rinish)
  };

  const svg         = q('svg');
  const canvasWrap  = q('canvasWrap');
  const inputBox    = q('inputBox');
  const lengthInput = q('lengthInput');
  const unitSelect  = q('unitSelect');
  const selBoxEl    = q('selBox');

  /* ---------------- YO'NALISH YORDAMCHILARI ---------------- */
  const DIRS = {
    up:    { dx: 0, dy: -1 },
    down:  { dx: 0, dy:  1 },
    left:  { dx: -1, dy: 0 },
    right: { dx:  1, dy: 0 },
  };

  function dirBetween(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'down' : 'up';
  }

  function worldToScreen(x, y) {
    return { x: x * state.scale + state.panX, y: y * state.scale + state.panY };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - state.panX) / state.scale, y: (sy - state.panY) / state.scale };
  }

  function getPoint(id) { return state.points.find((p) => p.id === id); }
  function getLine(id)  { return state.lines.find((l) => l.id === id); }

  function occupiedDirs(pointId) {
    const set = new Set();
    for (const ln of state.lines) {
      const a = getPoint(ln.a), b = getPoint(ln.b);
      if (!a || !b) continue;
      if (ln.a === pointId) set.add(dirBetween(a, b));
      if (ln.b === pointId) set.add(dirBetween(b, a));
    }
    return set;
  }

  function degree(pointId) {
    return state.lines.filter((l) => l.a === pointId || l.b === pointId).length;
  }

  // Nuqtaga ulangan chiziqlarning ranglari — "+" guruhini aniqlash uchun.
  function pointColors(pid) {
    let red = false, yellow = false;
    for (const l of state.lines) {
      if (l.a === pid || l.b === pid) { if (l.color === 'yellow') yellow = true; else red = true; }
    }
    return { red, yellow };
  }
  function pointPlusVisible(pid) {
    const c = pointColors(pid);
    if (!c.red && !c.yellow) return state.showDevorPlus || state.showQoshPlus;
    return (c.red && state.showDevorPlus) || (c.yellow && state.showQoshPlus);
  }

  // startId dan boshlab, excludeLineId chetidan o'tmasdan, ulangan nuqtalar.
  function componentFrom(startId, excludeLineId) {
    const seen = new Set([startId]);
    const stack = [startId];
    while (stack.length) {
      const cur = stack.pop();
      for (const l of state.lines) {
        if (l.id === excludeLineId) continue;
        let nxt = null;
        if (l.a === cur) nxt = l.b; else if (l.b === cur) nxt = l.a;
        if (nxt != null && !seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
      }
    }
    return seen;
  }

  /* ---------------- TARIX (UNDO / REDO) ---------------- */
  let undoStack = [], redoStack = [];

  function snapshot() {
    return JSON.stringify({
      points: state.points, lines: state.lines,
      np: state.nextPointId, nl: state.nextLineId,
      ents: state.editEntities, ne: state.nextEntId,
      layers: state.layers, curLayer: state.curLayer,
      showRef: state.showRef,   // namuna ko'rinishi ham tarixga kiradi (DXF "tahrirlash"ni qaytarish uchun)
    });
  }
  function restore(s) {
    const o = JSON.parse(s);
    state.points = o.points;
    state.lines = o.lines;
    state.nextPointId = o.np;
    state.nextLineId = o.nl;
    state.editEntities = o.ents || [];
    state.nextEntId = o.ne || (Math.max(0, ...state.editEntities.map((e) => e.id)) + 1);
    if (Array.isArray(o.layers) && o.layers.length) state.layers = o.layers;
    if (typeof o.curLayer === 'string') state.curLayer = o.curLayer;
    if (!state.layers.some((l) => l.name === state.curLayer)) state.curLayer = state.layers[0].name;
    if (typeof o.showRef === 'boolean') state.showRef = o.showRef;
    state.selectedLines.clear();
    state.selEdit.clear();
    state.toolDraft = null;   // undo/redo amaldagi asbob jarayonini (masalan fillet 1-bosqich) bekor qiladi — eski element havolasi qolmasin
    syncRefUI();
    rebuildLayerSelect();
  }
  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 200) undoStack.shift();
    redoStack = [];
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    closeInput();
    render();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    closeInput();
    render();
  }

  /* ---------------- CHIZIQ QO'SHISH ---------------- */
  function addLineFrom(startPointId, dir, lengthMm, unit) {
    const p = getPoint(startPointId);
    if (!p || !(lengthMm > 0)) return;

    const v = DIRS[dir];
    const endX = p.x + v.dx * lengthMm;
    const endY = p.y + v.dy * lengthMm;

    // SNAPPING: oxiri mavjud nuqtaga yaqin bo'lsa, o'shanga yopishadi.
    const thresholdMm = SNAP_PX / state.scale;
    let endPoint = null, best = thresholdMm;
    for (const pt of state.points) {
      if (pt.id === startPointId) continue;
      const d = Math.hypot(pt.x - endX, pt.y - endY);
      if (d <= best) { best = d; endPoint = pt; }
    }
    if (!endPoint) {
      endPoint = { id: state.nextPointId++, x: endX, y: endY };
      state.points.push(endPoint);
    }
    if (endPoint.id === startPointId) return;

    state.lines.push({
      id: state.nextLineId++,
      a: startPointId, b: endPoint.id,
      color: state.color,
      length: lengthMm, unit,
    });

    mergeCollinear();
  }

  /* ---------------- KOLLINEAR CHIZIQLARNI QO'SHISH ---------------- */
  function mergeCollinearAt(pid) {
    const ls = state.lines.filter((l) => l.a === pid || l.b === pid);
    if (ls.length !== 2) return false;
    const [l1, l2] = ls;
    if (l1.color !== l2.color) return false;
    if (l1.srcEdge != null || l2.srcEdge != null) return false;

    const o1 = l1.a === pid ? l1.b : l1.a;
    const o2 = l2.a === pid ? l2.b : l2.a;
    const Pp = getPoint(pid), A = getPoint(o1), B = getPoint(o2);
    if (!Pp || !A || !B || o1 === o2) return false;

    const d1 = { x: A.x - Pp.x, y: A.y - Pp.y };
    const d2 = { x: B.x - Pp.x, y: B.y - Pp.y };
    const cross = d1.x * d2.y - d1.y * d2.x;
    const dot = d1.x * d2.x + d1.y * d2.y;
    if (Math.abs(cross) > 1e-6 || dot >= 0) return false;

    l1.a = o1; l1.b = o2;
    l1.length = Math.hypot(B.x - A.x, B.y - A.y);
    state.lines = state.lines.filter((l) => l !== l2);
    state.points = state.points.filter((p) => p.id !== pid);
    return true;
  }
  function mergeCollinear() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of state.points.slice()) {
        if (mergeCollinearAt(p.id)) { changed = true; break; }
      }
    }
  }

  /* ---------------- RAZMERNI TAHRIRLASH ---------------- */
  function editLength(lineId, newMm, unit) {
    const ln = getLine(lineId);
    if (!ln || !(newMm > 0)) return;
    const a = getPoint(ln.a), b = getPoint(ln.b);
    if (!a || !b) return;

    const dir = dirBetween(a, b);
    const v = DIRS[dir];
    const oldLen = Math.hypot(b.x - a.x, b.y - a.y);
    const delta = newMm - oldLen;

    const moveSet = componentFrom(ln.b, lineId);
    moveSet.delete(ln.a);
    for (const pid of moveSet) {
      const p = getPoint(pid);
      p.x += v.dx * delta;
      p.y += v.dy * delta;
    }
    ln.length = newMm;
    ln.unit = unit;
  }

  /* ---------------- OFFSET (faqat bitta chiziq) ---------------- */
  function lineIntersect(p1, d1, p2, d2, fallback) {
    const denom = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(denom) < 1e-9) return fallback;
    const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom;
    return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
  }

  function mergePoints(keepId, dropId) {
    if (keepId === dropId) return;
    for (const l of state.lines) { if (l.a === dropId) l.a = keepId; if (l.b === dropId) l.b = keepId; }
    state.points = state.points.filter((p) => p.id !== dropId);
    state.lines = state.lines.filter((l) => l.a !== l.b);
  }

  function offsetSegment(edgeId, side, dist) {
    const orig = getLine(edgeId);
    if (!orig) return;
    const a = getPoint(orig.a), b = getPoint(orig.b);
    if (!a || !b) return;

    const na = { id: state.nextPointId++, x: a.x + side.x * dist, y: a.y + side.y * dist, mapOrig: orig.a };
    const nb = { id: state.nextPointId++, x: b.x + side.x * dist, y: b.y + side.y * dist, mapOrig: orig.b };
    state.points.push(na, nb);

    const L = {
      id: state.nextLineId++, a: na.id, b: nb.id, color: 'yellow',
      length: Math.hypot(nb.x - na.x, nb.y - na.y), unit: 'm',
      srcEdge: edgeId, offDist: dist, offSide: { x: side.x, y: side.y }, offUnit: state.unit,
    };
    state.lines.push(L);

    filletCorner(L, orig.a, na.id);
    filletCorner(L, orig.b, nb.id);
    recomputeOffsetLengths();
  }

  function filletCorner(L, origCornerId, newPointId) {
    for (const L2 of state.lines.slice()) {
      if (L2 === L || L2.srcEdge == null) continue;
      const pA = getPoint(L2.a), pB = getPoint(L2.b);
      let p2 = null;
      if (pA && pA.mapOrig === origCornerId) p2 = pA;
      else if (pB && pB.mapOrig === origCornerId) p2 = pB;
      if (!p2 || p2.id === newPointId) continue;

      const np = getPoint(newPointId);
      const la = getPoint(L.a), lb = getPoint(L.b);
      const dL = { x: lb.x - la.x, y: lb.y - la.y };
      const d2 = { x: pB.x - pA.x, y: pB.y - pA.y };
      const inter = lineIntersect({ x: la.x, y: la.y }, dL, { x: pA.x, y: pA.y }, d2, { x: np.x, y: np.y });

      np.x = inter.x; np.y = inter.y;
      mergePoints(newPointId, p2.id);
    }
  }

  function recomputeOffsetLengths() {
    for (const l of state.lines) {
      if (l.srcEdge == null) continue;
      const pa = getPoint(l.a), pb = getPoint(l.b);
      if (pa && pb) l.length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    }
  }

  /* ---------------- BOSHQARUV AMALLARI ---------------- */
  function deleteSelected() {
    if (state.selectedLines.size === 0) return;
    pushHistory();
    state.lines = state.lines.filter((l) => !state.selectedLines.has(l.id));
    state.selectedLines.clear();
    cleanupOrphans();
    render();
  }

  function cleanupOrphans() {
    state.points = state.points.filter((p) => p.id === 0 || degree(p.id) > 0);
  }

  // "Nuqta qo'shish" rejimini yoqish/o'chirish. Yoqilsa — maydonni bosib
  // erkin (chiziqqa ulanmagan) nuqta ekiladi; o'sha nuqtadan "+" orqali
  // chizishni boshlash mumkin.
  function setPlacingPoint(on) {
    state.placingPoint = on;
    if (on) { closeInput(); state.selectedLines.clear(); }
    syncToggleButtons();
    render();
  }

  // Maydonning berilgan ekran nuqtasiga yangi erkin nuqta ekadi.
  function placePointAt(sx, sy) {
    const w = screenToWorld(sx, sy);
    pushHistory();
    state.points.push({ id: state.nextPointId++, x: w.x, y: w.y });
    render();
  }

  function clearAll() {
    if (state.lines.length === 0 && state.points.length <= 1) return;
    pushHistory();
    state.points = [{ id: 0, x: 0, y: 0 }];
    state.lines = [];
    state.selectedLines.clear();
    closeInput();
    render();
  }

  /* ---------------- DXF FON NAMUNA (import) ----------------
     AutoCAD DXF faylni FAQAT ko'rinish uchun fon namuna sifatida yuklaydi.
     Razmerlar aynan saqlanadi (DXF birligidan mm ga o'giriladi), Y o'qi
     to'g'rilanadi (DXF Y yuqoriga, bizda pastga). Namuna tahrirlanmaydi va
     hech qaysi hisob-kitobga (Devor/Qosh/Kazirok) qo'shilmaydi. */
  function refUnitFactor() {
    return REF_UNITS[(state.ref && state.ref.unit) || 'mm'] || 1;
  }
  // Xom DXF yo'llardan world mm yo'llarni qayta hisoblaymiz (birlik o'zgarsa ham).
  function buildRefWorld() {
    const f = refUnitFactor();
    state.refWorld = (state.ref && state.ref.paths ? state.ref.paths : [])
      .map((path) => path.map(([x, y]) => ({ x: x * f, y: -y * f })))
      .filter((path) => path.length >= 2);
  }
  function refBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const path of state.refWorld) for (const p of path) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    return (minX === Infinity) ? null : { minX, minY, maxX, maxY };
  }

  // DXF matnini o'qib, fon namuna sifatida o'rnatadi. `dxf` kutubxonasi
  // talab bo'lgandagina (dinamik) yuklanadi — boshlang'ich yuk yengil qoladi.
  async function importDxfText(text, fileName) {
    setRefInfo('DXF o\'qilmoqda…');
    let Helper;
    try {
      const mod = await import('dxf');
      Helper = mod.Helper || (mod.default && mod.default.Helper);
    } catch (e) { setRefInfo('DXF kutubxonasi yuklanmadi'); return; }
    if (!Helper) { setRefInfo('DXF kutubxonasi yuklanmadi'); return; }
    let parsed, polylines;
    try {
      const helper = new Helper(text);
      parsed = helper.parsed;
      polylines = helper.toPolylines().polylines || [];
    } catch (e) { setRefInfo('DXF o\'qib bo\'lmadi (fayl buzuq?)'); return; }

    const paths = [];
    for (const pl of polylines) {
      const vs = (pl.vertices || []).filter((v) => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1]));
      if (vs.length >= 2) paths.push(vs.map((v) => [v[0], v[1]]));
    }
    if (!paths.length) { setRefInfo('DXF da chiziq topilmadi'); return; }

    // O'lcham birligini $INSUNITS dan aniqlaymiz; noma'lum bo'lsa — mm.
    const code = parsed && parsed.header ? parsed.header.insUnits : undefined;
    const unit = INSUNITS_MAP[code] || 'mm';

    state.ref = { paths, unit };
    state.showRef = true;
    buildRefWorld();
    saveRefLS();
    syncRefUI();
    const knownU = INSUNITS_MAP[code] ? '' : ' (birlik noma\'lum — mm deb olindi, kerak bo\'lsa o\'zgartiring)';
    setRefInfo(`${fileName || 'DXF'}: ${paths.length} chiziq • ${unit}${knownU}`);
    centerView();   // namunani ekranga moslab ko'rsatamiz
  }

  function setRefUnit(u) {
    if (!state.ref) return;
    state.ref.unit = u;
    buildRefWorld();
    saveRefLS();
    centerView();
  }
  function clearRef() {
    state.ref = null;
    state.refWorld = [];
    try { localStorage.removeItem(REF_KEY); } catch (e) { /* noop */ }
    setRefInfo('');
    syncRefUI();
    render();
  }
  function setRefInfo(msg) {
    const el = q('refInfo');
    if (el) el.textContent = msg || '';
  }
  function saveRefLS() {
    try {
      if (state.ref) localStorage.setItem(REF_KEY, JSON.stringify(state.ref));
    } catch (e) { /* juda katta bo'lsa — saqlamaymiz, lekin ko'rinaveradi */ }
  }
  function loadRefLS() {
    try {
      const raw = localStorage.getItem(REF_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o && Array.isArray(o.paths) && o.paths.length) {
        state.ref = { paths: o.paths, unit: REF_UNITS[o.unit] ? o.unit : 'mm' };
        buildRefWorld();
      }
    } catch (e) { /* noop */ }
  }
  // Namuna tugmalari (birlik tanlash, o'chirish, ko'rsатish toggle) ko'rinishi.
  function syncRefUI() {
    const has = !!(state.ref && state.refWorld.length);
    const u = q('unitRef'), c = q('btnRefClear'), t = q('tgRef');
    if (u) { u.style.display = has ? '' : 'none'; if (has) u.value = state.ref.unit; }
    if (c) c.style.display = has ? '' : 'none';
    if (t) { t.style.display = has ? '' : 'none'; t.classList.toggle('off', !state.showRef); }
  }

  /* ============================================================
     TAHRIR QATLAMI (AutoCAD uslubidagi mustaqil tahrir)
     ------------------------------------------------------------
     Erkin burchakli geometriya: line / polyline / circle. Bu qatlam
     devor/qosh/kazirok hisobiga TEGMAYDI — faqat chizish va tahrir.
     Asboblar: select, line, pline, rect, circle, move, copy, rotate,
     mirror, scale, offset, erase. Hammasi sichqoncha bilan (jonli ko'rinish).
     ============================================================ */
  const EDIT_TOOLS = ['select', 'line', 'pline', 'rect', 'circle', 'dim', 'move', 'copy', 'rotate', 'mirror', 'scale', 'offset', 'trim', 'extend', 'fillet', 'erase'];
  let editSel = null;        // select asbobi uchun: {sx,sy,moved,additive,candidate}
  state.cursorW = { x: 0, y: 0 };

  function newEnt(type, props) {
    return Object.assign({ id: state.nextEntId++, type, layer: state.curLayer, color: state.curColor || null, width: state.curWidth || null }, props);
  }
  function layerVisible(name) { const l = state.layers.find((x) => x.name === name); return !l || l.visible; }
  function getEnt(id) { return state.editEntities.find((e) => e.id === id); }
  function cloneEnt(ent) {
    const c = JSON.parse(JSON.stringify(ent));
    c.id = state.nextEntId++;
    return c;
  }
  // Element nuqtalari (hit-test / chegara uchun). Circle — 4 chekka nuqta.
  function entVerts(ent) {
    if (ent.type === 'line' || ent.type === 'dim') return [{ x: ent.x1, y: ent.y1 }, { x: ent.x2, y: ent.y2 }];
    if (ent.type === 'polyline') return ent.pts;
    if (ent.type === 'circle') return [{ x: ent.cx - ent.r, y: ent.cy }, { x: ent.cx + ent.r, y: ent.cy }, { x: ent.cx, y: ent.cy - ent.r }, { x: ent.cx, y: ent.cy + ent.r }];
    return [];
  }
  // Snap (yopishish) uchun "tugun" nuqtalar: uchlar, vertexlar, markaz.
  function entSnapPts(ent) {
    if (ent.type === 'line' || ent.type === 'dim') return [{ x: ent.x1, y: ent.y1 }, { x: ent.x2, y: ent.y2 }];
    if (ent.type === 'polyline') return ent.pts;
    if (ent.type === 'circle') return [{ x: ent.cx, y: ent.cy }];
    return [];
  }

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }
  // Element bilan (wx,wy) orasidagi masofa (world mm).
  function distToEnt(ent, wx, wy) {
    if (ent.type === 'line' || ent.type === 'dim') return distToSeg(wx, wy, ent.x1, ent.y1, ent.x2, ent.y2);
    if (ent.type === 'polyline') {
      let best = Infinity;
      const p = ent.pts;
      for (let i = 0; i < p.length - 1; i++) best = Math.min(best, distToSeg(wx, wy, p[i].x, p[i].y, p[i + 1].x, p[i + 1].y));
      if (ent.closed && p.length > 2) best = Math.min(best, distToSeg(wx, wy, p[p.length - 1].x, p[p.length - 1].y, p[0].x, p[0].y));
      return best;
    }
    if (ent.type === 'circle') return Math.abs(Math.hypot(wx - ent.cx, wy - ent.cy) - ent.r);
    return Infinity;
  }
  function entAtScreen(sx, sy) {
    const thr = 7 / state.scale;       // 7px ni world mm ga
    let best = null, bd = thr;
    const w = screenToWorld(sx, sy);
    for (const ent of state.editEntities) {
      if (!layerVisible(ent.layer)) continue;
      const d = distToEnt(ent, w.x, w.y);
      if (d <= bd) { bd = d; best = ent; }
    }
    return best;
  }

  // Geometrik o'zgartirishlar (in-place).
  function rotPt(p, c, ang) {
    const cos = Math.cos(ang), sin = Math.sin(ang), x = p.x - c.x, y = p.y - c.y;
    return { x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos };
  }
  function reflPt(p, A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, d = dx * dx + dy * dy || 1;
    const t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / d;
    const jx = A.x + t * dx, jy = A.y + t * dy;
    return { x: 2 * jx - p.x, y: 2 * jy - p.y };
  }
  function mapEnt(ent, fn, rFactor) {
    if (ent.type === 'line' || ent.type === 'dim') { const a = fn({ x: ent.x1, y: ent.y1 }), b = fn({ x: ent.x2, y: ent.y2 }); ent.x1 = a.x; ent.y1 = a.y; ent.x2 = b.x; ent.y2 = b.y; }
    else if (ent.type === 'polyline') { ent.pts = ent.pts.map(fn); }
    else if (ent.type === 'circle') { const c = fn({ x: ent.cx, y: ent.cy }); ent.cx = c.x; ent.cy = c.y; if (rFactor != null) ent.r = Math.abs(ent.r * rFactor); }
  }
  function selectedEnts() { return state.editEntities.filter((e) => state.selEdit.has(e.id) && layerVisible(e.layer)); }
  function translateSel(dx, dy) { for (const e of selectedEnts()) mapEnt(e, (p) => ({ x: p.x + dx, y: p.y + dy })); }
  function rotateSel(c, ang) { for (const e of selectedEnts()) mapEnt(e, (p) => rotPt(p, c, ang)); }
  function scaleSel(c, f) { for (const e of selectedEnts()) mapEnt(e, (p) => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f }), f); }
  function mirrorSel(A, B) { for (const e of selectedEnts()) mapEnt(e, (p) => reflPt(p, A, B)); }

  // --- Snap: ekran (sx,sy) ga eng yaqin tugunni topib, world nuqtasini qaytaradi.
  function snapWorld(sx, sy) {
    let best = null, bd = SNAP_PX;
    const consider = (wp) => { const s = worldToScreen(wp.x, wp.y); const d = Math.hypot(s.x - sx, s.y - sy); if (d <= bd) { bd = d; best = wp; } };
    for (const ent of state.editEntities) for (const wp of entSnapPts(ent)) consider(wp);
    if (state.showRef) for (const path of state.refWorld) for (const wp of path) consider(wp);
    return best ? { x: best.x, y: best.y } : screenToWorld(sx, sy);
  }
  function evScreen(e) { const r = svg.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }

  // ---- Import qilingan DXF namunani TAHRIRLANADIGAN qilish ----
  function makeRefEditable() {
    if (!state.refWorld.length || !state.showRef) { setRefInfo('Avval DXF namuna yuklang (Namuna ko\'rinib tursin)'); return; }
    pushHistory();
    let n = 0;
    for (const path of state.refWorld) {
      if (path.length < 2) continue;
      const pts = path.map((p) => ({ x: p.x, y: p.y }));
      const a = pts[0], b = pts[pts.length - 1];
      const closed = pts.length > 2 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
      if (closed) pts.pop();
      state.editEntities.push(newEnt('polyline', { pts, closed }));
      n++;
    }
    // Namuna tahrir qatlamiga ko'chdi — kulrang fonni faqat YASHIRAMIZ (o'chirmaymiz),
    // shunda undo (Ctrl+Z) namunani qaytara oladi va dublikat ko'rinmaydi.
    state.showRef = false;
    syncRefUI();
    if (!state.editMode) setEditMode(true);
    setEditTool('select');
    setRefInfo(`${n} element tahrirlanadigan qilindi`);
    render();
  }

  // ---- Rejim / asbob boshqaruvi ----
  function setEditMode(on) {
    state.editMode = on;
    if (!on) { state.toolDraft = null; editSel = null; state.selEdit.clear(); }
    else { closeInput(); state.placingPoint = false; state.selectedLines.clear(); syncToggleButtons(); }
    syncEditUI();
    render();
  }
  function setEditTool(t) {
    if (!EDIT_TOOLS.includes(t)) return;
    // Modify asboblari tanlovni talab qiladi.
    state.tool = t;
    state.toolDraft = null;
    editSel = null;
    if (['move', 'copy', 'rotate', 'mirror', 'scale'].includes(t) && state.selEdit.size === 0) {
      setEditInfo('Avval element(lar)ni tanlang (Select), so\'ng ' + t);
    } else setEditInfo(toolHint(t));
    syncEditUI();
    render();
  }
  function toolHint(t) {
    const m = {
      select: 'Tanlash: element ustiga bosing yoki ramka torting (Shift — qo\'shish)',
      line: 'Line: 1-nuqta → 2-nuqta bosing. Esc — bekor',
      pline: 'Polyline: nuqtalarni bosing; Enter yoki ikki marta bosish — tugatish',
      rect: 'Rectangle: bir burchak → qarama-qarshi burchak',
      circle: 'Circle: markaz → radius nuqtasini bosing',
      dim: 'O\'lcham: 1-nuqta → 2-nuqta (oraliq masofa yoziladi)',
      move: 'Move: tayanch nuqta → yangi joy',
      copy: 'Copy: tayanch nuqta → nusxa joyi (Esc — to\'xtatish)',
      rotate: 'Rotate: tayanch nuqta → burchak nuqtasi',
      mirror: 'Mirror: o\'q 1-nuqta → 2-nuqta',
      scale: 'Scale: tayanch nuqta → masshtab nuqtasi',
      offset: 'Offset: elementni bosing → tomonni bosing',
      trim: 'Trim: chiziqning kesib tashlanadigan qismini bosing',
      extend: 'Extend: chiziqning cho\'ziladigan uchi tomonidan bosing',
      fillet: 'Fillet: 1-chiziq → 2-chiziqni bosing (burchakda tutashadi)',
      erase: 'Erase: o\'chirish uchun element ustiga bosing',
    };
    return m[t] || '';
  }
  function setEditInfo(msg) { const el = q('editInfo'); if (el) el.textContent = msg || ''; }
  function syncEditUI() {
    const tb = q('editToolbar'); if (tb) tb.style.display = state.editMode ? '' : 'none';
    const be = q('btnEdit'); if (be) be.classList.toggle('active', state.editMode);
    root.querySelectorAll('.etool').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tool') === state.tool));
  }
  // ---- Qatlam (Layers) ----
  function rebuildLayerSelect() {
    const sel = q('layerSel'); if (!sel) return;
    sel.innerHTML = '';
    for (const l of state.layers) {
      const o = document.createElement('option');
      o.value = l.name; o.textContent = l.name + (l.visible ? '' : ' (yashirin)');
      sel.appendChild(o);
    }
    sel.value = state.curLayer;
  }
  function addLayer() {
    let n = state.layers.length, name = 'Qatlam ' + n;
    while (state.layers.some((l) => l.name === name)) { n++; name = 'Qatlam ' + n; }
    pushHistory();
    state.layers.push({ name, visible: true });
    state.curLayer = name;
    rebuildLayerSelect(); render();
  }
  function toggleCurLayerVis() {
    const l = state.layers.find((x) => x.name === state.curLayer);
    if (!l) return;
    pushHistory();
    l.visible = !l.visible;
    // Yashirilgan qatlamdagi elementlar tanlovdan chiqariladi (ko'rinmas holda tahrirlanmasin).
    if (!l.visible) for (const e of state.editEntities) if (e.layer === l.name) state.selEdit.delete(e.id);
    rebuildLayerSelect(); render();
  }
  // ---- Xossa (rang / qalinlik) ----
  function applyToSel(prop, val) {
    if (state.selEdit.size === 0) return;
    pushHistory();
    for (const e of selectedEnts()) e[prop] = val;
    render();
  }

  // ---- Sichqoncha hodisalari (faqat editMode da, chap tugma) ----
  function editDown(e) {
    const { sx, sy } = evScreen(e);
    const w = snapWorld(sx, sy);
    state.cursorW = w;
    const t = state.tool;
    if (t === 'select') { editSel = { sx, sy, moved: false, additive: e.shiftKey, candidate: entAtScreen(sx, sy) }; return; }
    if (t === 'erase') { const ent = entAtScreen(sx, sy); if (ent) { pushHistory(); state.editEntities = state.editEntities.filter((x) => x !== ent); state.selEdit.delete(ent.id); render(); } return; }
    if (t === 'line') return lineClick(w);
    if (t === 'pline') return plineClick(w);
    if (t === 'rect') return rectClick(w);
    if (t === 'circle') return circleClick(w);
    if (t === 'dim') return dimClick(w);
    if (t === 'offset') return offsetClick(sx, sy, w);
    if (t === 'trim') return trimClick(sx, sy, w);
    if (t === 'extend') return extendClick(sx, sy, w);
    if (t === 'fillet') return filletClick(sx, sy, w);
    if (['move', 'copy', 'rotate', 'mirror', 'scale'].includes(t)) return modifyClick(t, w);
  }
  function editMove(e) {
    // Faol asbob jarayoni yoki ramka tortish bo'lmasa — bo'sh harakat, ish yo'q.
    if (!state.toolDraft && !editSel) return;
    const { sx, sy } = evScreen(e);
    state.cursorW = snapWorld(sx, sy);
    if (editSel) {
      if (Math.abs(sx - editSel.sx) > 3 || Math.abs(sy - editSel.sy) > 3) editSel.moved = true;
      if (editSel.moved) {
        const x1 = Math.min(editSel.sx, sx), y1 = Math.min(editSel.sy, sy);
        const w = Math.abs(sx - editSel.sx), h = Math.abs(sy - editSel.sy);
        const crossing = sx < editSel.sx;
        selBoxEl.style.display = 'block';
        selBoxEl.style.left = x1 + 'px'; selBoxEl.style.top = y1 + 'px';
        selBoxEl.style.width = w + 'px'; selBoxEl.style.height = h + 'px';
        selBoxEl.style.border = `1.5px ${crossing ? 'dashed' : 'solid'} ${crossing ? P.accent : P.qozon}`;
        selBoxEl.style.background = `color-mix(in srgb, ${crossing ? P.accent : P.qozon} 12%, transparent)`;
      }
    }
    render();   // jonli ko'rinish (rubber-band / ramka / ghost)
  }
  function editUp(e) {
    if (state.tool !== 'select' || !editSel) { editSel = null; return; }
    const { sx, sy } = evScreen(e);
    if (!editSel.moved) {
      // Oddiy bosish — bitta element tanlash.
      if (!editSel.additive) state.selEdit.clear();
      if (editSel.candidate) {
        if (editSel.additive && state.selEdit.has(editSel.candidate.id)) state.selEdit.delete(editSel.candidate.id);
        else state.selEdit.add(editSel.candidate.id);
      }
    } else {
      // Ramka bilan tanlash. Chapdan-o'ngga = ichidagilar; o'ngdan-chapga = kesganlar ham.
      const r = { x1: Math.min(editSel.sx, sx), y1: Math.min(editSel.sy, sy), x2: Math.max(editSel.sx, sx), y2: Math.max(editSel.sy, sy) };
      const crossing = sx < editSel.sx;
      if (!editSel.additive) state.selEdit.clear();
      for (const ent of state.editEntities) {
        if (!layerVisible(ent.layer)) continue;
        const vs = entVerts(ent).map((p) => worldToScreen(p.x, p.y));
        const allIn = vs.every((s) => pointInRect(s.x, s.y, r));
        let hit = allIn;
        if (!hit && crossing) {
          hit = vs.some((s) => pointInRect(s.x, s.y, r));
          for (let i = 0; !hit && i < vs.length - 1; i++) hit = segIntersectsRect(vs[i], vs[i + 1], r);
          // Yopiq polyline/to'rtburchakning yopuvchi qirrasi ham tekshiriladi.
          if (!hit && ent.type === 'polyline' && ent.closed && vs.length > 2) hit = segIntersectsRect(vs[vs.length - 1], vs[0], r);
        }
        if (hit) state.selEdit.add(ent.id);
      }
    }
    editSel = null;
    render();
  }

  // ---- Chizish asboblari ----
  function lineClick(w) {
    const d = state.toolDraft;
    if (!d || d.tool !== 'line') { state.toolDraft = { tool: 'line', p1: w }; return; }
    if (Math.hypot(w.x - d.p1.x, w.y - d.p1.y) < 1e-6) return;   // nol uzunlik — e'tiborsiz
    pushHistory();
    state.editEntities.push(newEnt('line', { x1: d.p1.x, y1: d.p1.y, x2: w.x, y2: w.y }));
    state.toolDraft = { tool: 'line', p1: w };   // zanjir: keyingi chiziq shu nuqtadan
    render();
  }
  function plineClick(w) {
    const d = state.toolDraft;
    if (!d || d.tool !== 'pline') { state.toolDraft = { tool: 'pline', pts: [w] }; return; }
    // Oxirgi nuqtaga juda yaqin bo'lsa (ikki marta bosish) — tugatamiz.
    const last = d.pts[d.pts.length - 1];
    const sLast = worldToScreen(last.x, last.y), sNow = worldToScreen(w.x, w.y);
    if (Math.hypot(sLast.x - sNow.x, sLast.y - sNow.y) < 6) { finishPline(); return; }
    d.pts.push(w);
    render();
  }
  function finishPline() {
    const d = state.toolDraft;
    if (d && d.tool === 'pline' && d.pts.length >= 2) {
      pushHistory();
      state.editEntities.push(newEnt('polyline', { pts: d.pts.slice(), closed: false }));
    }
    state.toolDraft = null;
    render();
  }
  function rectClick(w) {
    const d = state.toolDraft;
    if (!d || d.tool !== 'rect') { state.toolDraft = { tool: 'rect', p1: w }; return; }
    const a = d.p1;
    if (Math.abs(w.x - a.x) < 1e-6 || Math.abs(w.y - a.y) < 1e-6) { state.toolDraft = null; return; }
    pushHistory();
    state.editEntities.push(newEnt('polyline', {
      pts: [{ x: a.x, y: a.y }, { x: w.x, y: a.y }, { x: w.x, y: w.y }, { x: a.x, y: w.y }], closed: true,
    }));
    state.toolDraft = null;
    render();
  }
  function circleClick(w) {
    const d = state.toolDraft;
    if (!d || d.tool !== 'circle') { state.toolDraft = { tool: 'circle', c: w }; return; }
    const r = Math.hypot(w.x - d.c.x, w.y - d.c.y);
    if (r > 0) { pushHistory(); state.editEntities.push(newEnt('circle', { cx: d.c.x, cy: d.c.y, r })); }
    state.toolDraft = null;
    render();
  }
  // O'lcham (Dimension) — ikki nuqta orasini o'lchab, razmer chizig'i + yozuv qo'yadi.
  function dimClick(w) {
    const d = state.toolDraft;
    if (!d || d.tool !== 'dim') { state.toolDraft = { tool: 'dim', p1: w }; return; }
    if (Math.hypot(w.x - d.p1.x, w.y - d.p1.y) < 1e-6) return;
    pushHistory();
    state.editEntities.push(newEnt('dim', { x1: d.p1.x, y1: d.p1.y, x2: w.x, y2: w.y, unit: state.unit }));
    state.toolDraft = null;
    render();
  }

  // ---- Modify asboblari (tanlanganlarga) ----
  // Tanlangan elementlarning `base` dan eng uzoq nuqtagacha masofasi —
  // Scale uchun ma'noli tayanch (kursor shu masofada bo'lsa masshtab = 1).
  function selMaxDist(base) {
    let m = 0;
    for (const e of selectedEnts()) for (const p of entVerts(e)) m = Math.max(m, Math.hypot(p.x - base.x, p.y - base.y));
    return m;
  }
  function modifyClick(t, w) {
    if (state.selEdit.size === 0) { setEditInfo('Avval element(lar)ni tanlang (Select)'); return; }
    const d = state.toolDraft;
    if (!d || d.tool !== t) {
      // 1-bosish — tayanch. Scale uchun ma'lumotli masofa (d0) shu zahoti olinadi.
      const draft = { tool: t, base: w };
      if (t === 'scale') { const m = selMaxDist(w); draft.d0 = m > 1e-6 ? m : 1; }
      state.toolDraft = draft;
      return;
    }
    // 2-bosish — amalni yakunlaymiz.
    const base = d.base;
    pushHistory();
    if (t === 'move') translateSel(w.x - base.x, w.y - base.y);
    else if (t === 'copy') {
      const clones = selectedEnts().map(cloneEnt);
      for (const c of clones) mapEnt(c, (p) => ({ x: p.x + (w.x - base.x), y: p.y + (w.y - base.y) }));
      state.editEntities.push(...clones);
    } else if (t === 'rotate') { rotateSel(base, Math.atan2(w.y - base.y, w.x - base.x)); }
    else if (t === 'scale') { const f = d.d0 ? Math.hypot(w.x - base.x, w.y - base.y) / d.d0 : 1; if (f > 0) scaleSel(base, f); }
    else if (t === 'mirror') { mirrorSel(base, w); }
    if (t === 'copy') { state.toolDraft = { tool: 'copy', base: w }; }  // davom etadi
    else state.toolDraft = null;
    render();
  }
  function offsetClick(sx, sy, w) {
    const d = state.toolDraft;
    if (!d || d.tool !== 'offset') {
      const ent = entAtScreen(sx, sy);
      if (ent) state.toolDraft = { tool: 'offset', ent };
      return;
    }
    const ent = d.ent;
    if (ent.type === 'polyline') {
      setEditInfo('Offset hozircha faqat line/circle uchun'); state.toolDraft = null; return;
    }
    pushHistory();
    if (ent.type === 'line') {
      let nx = -(ent.y2 - ent.y1), ny = ent.x2 - ent.x1; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const mx = (ent.x1 + ent.x2) / 2, my = (ent.y1 + ent.y2) / 2;
      const sign = ((w.x - mx) * nx + (w.y - my) * ny) >= 0 ? 1 : -1;
      const dist = Math.abs((w.x - mx) * nx + (w.y - my) * ny);
      state.editEntities.push(newEnt('line', { x1: ent.x1 + nx * dist * sign, y1: ent.y1 + ny * dist * sign, x2: ent.x2 + nx * dist * sign, y2: ent.y2 + ny * dist * sign }));
    } else if (ent.type === 'circle') {
      const dr = Math.hypot(w.x - ent.cx, w.y - ent.cy) - ent.r;
      const nr = ent.r + dr;
      if (nr > 0) state.editEntities.push(newEnt('circle', { cx: ent.cx, cy: ent.cy, r: nr }));
    }
    state.toolDraft = null;
    render();
  }

  // ---- Trim / Extend / Fillet uchun geometriya ----
  // Cheksiz to'g'ri chiziqlar kesishishi: p1->p2 va p3->p4. t — 1-chiziq bo'yicha
  // (nuqta = p1 + t*(p2-p1)), u — 2-chiziq bo'yicha. Parallel bo'lsa null.
  function lineInt(p1, p2, p3, p4) {
    const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
    const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
    return { x: p1.x + t * d1x, y: p1.y + t * d1y, t, u };
  }
  // Element qirralari (chegara sifatida): line/polyline. Circle hozircha o'tkazilmaydi.
  function entSegs(ent) {
    const segs = [];
    if (ent.type === 'line') segs.push([{ x: ent.x1, y: ent.y1 }, { x: ent.x2, y: ent.y2 }]);
    else if (ent.type === 'polyline') {
      const p = ent.pts;
      for (let i = 0; i < p.length - 1; i++) segs.push([p[i], p[i + 1]]);
      if (ent.closed && p.length > 2) segs.push([p[p.length - 1], p[0]]);
    }
    return segs;
  }
  function trimClick(sx, sy, w) {
    const ent = entAtScreen(sx, sy);
    if (!ent || ent.type !== 'line') { setEditInfo('Trim hozircha faqat Line uchun'); return; }
    const A = { x: ent.x1, y: ent.y1 }, B = { x: ent.x2, y: ent.y2 };
    const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
    if (L2 < 1e-9) return;
    const ts = [0, 1];
    for (const other of state.editEntities) {
      if (other === ent || !layerVisible(other.layer)) continue;
      for (const [c, d] of entSegs(other)) {
        const r = lineInt(A, B, c, d);
        if (r && r.t > 1e-6 && r.t < 1 - 1e-6 && r.u >= -1e-6 && r.u <= 1 + 1e-6) ts.push(r.t);
      }
    }
    if (ts.length <= 2) { setEditInfo('Kesishish topilmadi'); return; }
    ts.sort((a, b) => a - b);
    const uniq = [];
    for (const t of ts) if (!uniq.length || Math.abs(uniq[uniq.length - 1] - t) > 1e-6) uniq.push(t);
    const tc = ((w.x - A.x) * dx + (w.y - A.y) * dy) / L2;
    let i = 0;
    while (i < uniq.length - 1 && !(tc >= uniq[i] - 1e-6 && tc <= uniq[i + 1] + 1e-6)) i++;
    if (i >= uniq.length - 1) { setEditInfo('Kesish joyi aniqlanmadi'); return; }
    const ta = uniq[i], tb = uniq[i + 1];
    const pt = (t) => ({ x: A.x + dx * t, y: A.y + dy * t });
    // Yangi bo'laklar manba chiziq xossalarini (qatlam/rang/qalinlik) meros oladi.
    const mk = (p, q) => { const e = newEnt('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y }); e.layer = ent.layer; e.color = ent.color; e.width = ent.width; return e; };
    pushHistory();   // har qanday mutatsiyadan (nextEntId++ dan ham) OLDIN suratga olamiz
    const repl = [];
    if (ta > 1e-6) repl.push(mk(pt(0), pt(ta)));
    if (tb < 1 - 1e-6) repl.push(mk(pt(tb), pt(1)));
    const idx = state.editEntities.indexOf(ent);
    state.editEntities.splice(idx, 1, ...repl);
    state.selEdit.delete(ent.id);
    render();
  }
  function extendClick(sx, sy, w) {
    const ent = entAtScreen(sx, sy);
    if (!ent || ent.type !== 'line') { setEditInfo('Extend hozircha faqat Line uchun'); return; }
    const A = { x: ent.x1, y: ent.y1 }, B = { x: ent.x2, y: ent.y2 };
    const extendB = Math.hypot(w.x - B.x, w.y - B.y) <= Math.hypot(w.x - A.x, w.y - A.y);
    const fix = extendB ? A : B, mov = extendB ? B : A;
    let best = null, bestT = Infinity;
    for (const other of state.editEntities) {
      if (other === ent || !layerVisible(other.layer)) continue;
      for (const [c, d] of entSegs(other)) {
        const r = lineInt(fix, mov, c, d);
        if (r && r.t > 1 + 1e-6 && r.u >= -1e-6 && r.u <= 1 + 1e-6 && r.t < bestT) { bestT = r.t; best = { x: r.x, y: r.y }; }
      }
    }
    if (!best) { setEditInfo('Cho\'zish uchun chegara topilmadi'); return; }
    pushHistory();
    if (extendB) { ent.x2 = best.x; ent.y2 = best.y; } else { ent.x1 = best.x; ent.y1 = best.y; }
    render();
  }
  function filletClick(sx, sy, w) {
    const ent = entAtScreen(sx, sy);
    if (!ent || ent.type !== 'line') { setEditInfo('Fillet hozircha faqat Line uchun'); return; }
    const d = state.toolDraft;
    if (!d || d.tool !== 'fillet') { state.toolDraft = { tool: 'fillet', ent1: ent, click1: w }; setEditInfo('Ikkinchi chiziqni bosing'); render(); return; }
    if (ent === d.ent1) { setEditInfo('Boshqa chiziqni tanlang'); return; }
    const e1 = d.ent1, e2 = ent;
    const r = lineInt({ x: e1.x1, y: e1.y1 }, { x: e1.x2, y: e1.y2 }, { x: e2.x1, y: e2.y1 }, { x: e2.x2, y: e2.y2 });
    if (!r) { setEditInfo('Chiziqlar parallel — burchak yo\'q'); state.toolDraft = null; render(); return; }
    pushHistory();
    const moveNear = (e, click) => {
      if (Math.hypot(click.x - e.x2, click.y - e.y2) <= Math.hypot(click.x - e.x1, click.y - e.y1)) { e.x2 = r.x; e.y2 = r.y; }
      else { e.x1 = r.x; e.y1 = r.y; }
    };
    moveNear(e1, d.click1);
    moveNear(e2, w);
    state.toolDraft = null;
    render();
  }

  function eraseSelectedEnts() {
    const ids = new Set(selectedEnts().map((e) => e.id));   // faqat ko'rinadigan tanlanganlar
    if (!ids.size) return;
    pushHistory();
    state.editEntities = state.editEntities.filter((e) => !ids.has(e.id));
    state.selEdit.clear();
    render();
  }
  function editEscape() {
    if (state.toolDraft && state.toolDraft.tool === 'pline' && state.toolDraft.pts.length >= 2) { finishPline(); return; }
    state.toolDraft = null; editSel = null; render();
  }

  // ---- Tahrir qatlami chizilishi ----
  function entSvg(ent, attrs) {
    if (ent.type === 'line') {
      const a = worldToScreen(ent.x1, ent.y1), b = worldToScreen(ent.x2, ent.y2);
      return svgEl('line', Object.assign({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }, attrs));
    }
    if (ent.type === 'polyline') {
      let pts = '';
      for (const p of ent.pts) { const s = worldToScreen(p.x, p.y); pts += s.x + ',' + s.y + ' '; }
      if (ent.closed && ent.pts.length > 2) { const s = worldToScreen(ent.pts[0].x, ent.pts[0].y); pts += s.x + ',' + s.y + ' '; }
      return svgEl('polyline', Object.assign({ points: pts.trim(), fill: 'none' }, attrs));
    }
    if (ent.type === 'circle') {
      const c = worldToScreen(ent.cx, ent.cy);
      return svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: ent.r * state.scale, fill: 'none' }, attrs));
    }
    return null;
  }
  function renderEditLayer() {
    for (const ent of state.editEntities) {
      if (!layerVisible(ent.layer)) continue;
      const sel = state.selEdit.has(ent.id);
      if (ent.type === 'dim') { drawDim(ent, sel); continue; }
      const wdt = ent.width || 1.6;
      const el = entSvg(ent, {
        stroke: sel ? P.accent : (ent.color || P.edit), 'stroke-width': sel ? (wdt + 0.9) : wdt,
        'stroke-dasharray': sel ? '6 4' : 'none', 'pointer-events': 'none', 'stroke-linejoin': 'round',
      });
      if (el) svg.appendChild(el);
    }
  }
  // O'lcham (Dimension) chizilishi — chiziq + uchidagi qoq belgilar + masofa yozuvi.
  function drawDim(ent, sel) {
    const s1 = worldToScreen(ent.x1, ent.y1), s2 = worldToScreen(ent.x2, ent.y2);
    const col = sel ? P.accent : (ent.color || P.kazirok);
    const g = svgEl('g', { 'pointer-events': 'none' });
    g.appendChild(svgEl('line', { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: col, 'stroke-width': sel ? 2.2 : 1.2 }));
    let tx = s2.x - s1.x, ty = s2.y - s1.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const px = -ty * 5, py = tx * 5;
    for (const s of [s1, s2]) g.appendChild(svgEl('line', { x1: s.x - px, y1: s.y - py, x2: s.x + px, y2: s.y + py, stroke: col, 'stroke-width': 1.2 }));
    const lenMm = Math.hypot(ent.x2 - ent.x1, ent.y2 - ent.y1);
    const txt = fmt(lenMm, ent.unit || state.unit);
    const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
    const w = txt.length * 6.4 + 6;
    g.appendChild(svgEl('rect', { x: mx - w / 2, y: my - 16, width: w, height: 14, rx: 3, fill: P.labelBg }));
    const t = svgEl('text', { x: mx, y: my - 5, fill: col, 'font-size': 11, 'text-anchor': 'middle' });
    t.textContent = txt;
    g.appendChild(t);
    svg.appendChild(g);
  }
  function renderEditPreview() {
    if (!state.editMode) return;
    const d = state.toolDraft, cur = state.cursorW;
    const ghost = (el) => { if (el) { el.setAttribute('opacity', '0.85'); el.setAttribute('pointer-events', 'none'); svg.appendChild(el); } };
    const dash = { stroke: P.edit, 'stroke-width': 1.4, 'stroke-dasharray': '5 4', fill: 'none' };
    if (d && d.tool === 'line') ghost(entSvg({ type: 'line', x1: d.p1.x, y1: d.p1.y, x2: cur.x, y2: cur.y }, dash));
    else if (d && d.tool === 'pline') ghost(entSvg({ type: 'polyline', pts: d.pts.concat([cur]), closed: false }, dash));
    else if (d && d.tool === 'rect') { const a = d.p1; ghost(entSvg({ type: 'polyline', pts: [{ x: a.x, y: a.y }, { x: cur.x, y: a.y }, { x: cur.x, y: cur.y }, { x: a.x, y: cur.y }], closed: true }, dash)); }
    else if (d && d.tool === 'circle') ghost(entSvg({ type: 'circle', cx: d.c.x, cy: d.c.y, r: Math.hypot(cur.x - d.c.x, cur.y - d.c.y) }, dash));
    else if (d && d.tool === 'dim') ghost(entSvg({ type: 'line', x1: d.p1.x, y1: d.p1.y, x2: cur.x, y2: cur.y }, dash));
    else if (d && ['move', 'copy', 'rotate', 'scale', 'mirror'].includes(d.tool)) {
      const base = d.base;
      for (const e of selectedEnts()) {
        const g = JSON.parse(JSON.stringify(e));
        if (d.tool === 'move' || d.tool === 'copy') mapEnt(g, (p) => ({ x: p.x + (cur.x - base.x), y: p.y + (cur.y - base.y) }));
        else if (d.tool === 'rotate') { const ang = Math.atan2(cur.y - base.y, cur.x - base.x); mapEnt(g, (p) => rotPt(p, base, ang)); }
        else if (d.tool === 'scale') { const f = d.d0 ? Math.hypot(cur.x - base.x, cur.y - base.y) / d.d0 : 1; mapEnt(g, (p) => ({ x: base.x + (p.x - base.x) * f, y: base.y + (p.y - base.y) * f }), f); }
        else if (d.tool === 'mirror') mapEnt(g, (p) => reflPt(p, base, cur));
        ghost(entSvg(g, { stroke: P.accent, 'stroke-width': 1.6, 'stroke-dasharray': '4 3', fill: 'none' }));
      }
      if (d.tool === 'mirror') { const s1 = worldToScreen(base.x, base.y), s2 = worldToScreen(cur.x, cur.y); ghost(svgEl('line', { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: P.accent, 'stroke-width': 1, 'stroke-dasharray': '2 3' })); }
    } else if (d && d.tool === 'offset' && d.ent) {
      ghost(entSvg(d.ent, { stroke: P.accent, 'stroke-width': 2.6, fill: 'none' }));
    } else if (d && d.tool === 'fillet' && d.ent1) {
      ghost(entSvg(d.ent1, { stroke: P.accent, 'stroke-width': 2.6, fill: 'none' }));
    }
    if (d && d.base) { const s = worldToScreen(d.base.x, d.base.y); svg.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 3, fill: P.accent })); }
  }

  /* ---------------- UZUNLIK QUTISI ---------------- */
  function openInputDraw(pointId, dir) {
    const p = getPoint(pointId);
    if (!p) return;
    state.activeInput = { mode: 'draw', pointId, dir, previewLen: 0, snapPid: null, snapType: null };
    const s = worldToScreen(p.x, p.y);
    const v = DIRS[dir];
    positionBox(s.x + v.dx * (PLUS_OFFSET + 8), s.y + v.dy * (PLUS_OFFSET + 8));
    state.unit = 'm';        // chizishda DEFAULT birlik doim "m"
    setupBox('', 'm');
  }

  function openInputEdit(lineId) {
    const ln = getLine(lineId);
    if (!ln) return;
    const a = getPoint(ln.a), b = getPoint(ln.b);
    state.activeInput = { mode: 'edit', lineId };
    const s1 = worldToScreen(a.x, a.y), s2 = worldToScreen(b.x, b.y);
    positionBox((s1.x + s2.x) / 2, (s1.y + s2.y) / 2);
    const val = ln.length / UNITS[ln.unit];
    setupBox(String(Math.round(val * 1000) / 1000), ln.unit);
  }

  function openInputOffset(lineId, side) {
    const ln = getLine(lineId);
    if (!ln) return;
    const a = getPoint(ln.a), b = getPoint(ln.b);
    const s1 = worldToScreen(a.x, a.y), s2 = worldToScreen(b.x, b.y);
    const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
    state.activeInput = { mode: 'offset', lineId, side };
    positionBox(mx + side.x * (OFFSET_BTN + 12), my + side.y * (OFFSET_BTN + 12));
    state.unit = 'cm';       // offset — DEFAULT birlik doim "cm"
    setupBox('', 'cm');
  }

  function positionBox(cx, cy) {
    inputBox.classList.add('show');
    inputBox.style.left = (cx - 75) + 'px';
    inputBox.style.top  = (cy - 16) + 'px';
  }

  function setupBox(value, unit) {
    lengthInput.value = value;
    lengthInput.dataset.unit = unit;
    unitSelect.value = unit;
    lengthInput.focus();
    lengthInput.select();
  }

  function closeInput() {
    state.activeInput = null;
    inputBox.classList.remove('show');
  }

  function commitInput() {
    if (!state.activeInput) return;
    const ai = state.activeInput;
    const val = parseFloat(lengthInput.value);

    if (ai.mode === 'draw' && !(val > 0)) { finalizeDraw(); return; }

    const unit = unitSelect.value;
    state.unit = unit;
    closeInput();

    if (val > 0) {
      const mm = val * UNITS[unit];
      pushHistory();
      if (ai.mode === 'draw') addLineFrom(ai.pointId, ai.dir, mm, unit);
      else if (ai.mode === 'edit') editLength(ai.lineId, mm, unit);
      else if (ai.mode === 'offset') offsetSegment(ai.lineId, ai.side, mm);
    }
    render();
  }

  function finalizeDraw() {
    const ai = state.activeInput;
    if (!ai || ai.mode !== 'draw') return;
    const len = ai.previewLen || 0;
    const pid = ai.pointId, dir = ai.dir, unit = state.unit;
    closeInput();
    if (len > 0) { pushHistory(); addLineFrom(pid, dir, len, unit); }
    render();
  }

  /* ---------------- FORMATLASH ---------------- */
  function fmt(mm, unit) {
    unit = unit || state.unit;
    const v = mm / UNITS[unit];
    const r = Math.round(v * 100) / 100;
    return (Number.isInteger(r) ? r : parseFloat(r.toFixed(2))) + ' ' + unit;
  }
  function fmtPair(wMm, hMm, unit) {
    unit = unit || state.unit;
    const cv = (v) => { const r = Math.round(v / UNITS[unit] * 100) / 100; return Number.isInteger(r) ? r : parseFloat(r.toFixed(2)); };
    return cv(wMm) + '×' + cv(hMm) + ' ' + unit;
  }
  // Yuza (kvadrat) formatlash — kirish mm², chiqish tanlangan birlik kvadrati.
  function fmtArea(mm2, unit) {
    unit = unit || 'm';
    const v = mm2 / (UNITS[unit] * UNITS[unit]);
    const r = Math.round(v * 100) / 100;
    return (Number.isInteger(r) ? r : parseFloat(r.toFixed(2))) + ' ' + unit + '²';
  }

  /* ---------------- QOZON / KAZIROK HISOBI ---------------- */
  // Bir rangdagi chiziqlar uchrashib BURILGAN nuqtalari = burchaklar.
  function colorCorners(color) {
    const lines = state.lines.filter((l) => l.color === color);
    const map = new Map();
    for (const l of lines) {
      const a = getPoint(l.a), b = getPoint(l.b);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      if (!map.has(l.a)) map.set(l.a, { p: a, ds: [] });
      map.get(l.a).ds.push({ x: dx / len, y: dy / len });
      if (!map.has(l.b)) map.set(l.b, { p: b, ds: [] });
      map.get(l.b).ds.push({ x: -dx / len, y: -dy / len });
    }
    const out = [];
    for (const o of map.values()) {
      if (o.ds.length < 2) continue;
      let bend = false;
      for (let i = 0; i < o.ds.length && !bend; i++) {
        for (let j = i + 1; j < o.ds.length; j++) {
          if (Math.abs(o.ds[i].x * o.ds[j].y - o.ds[i].y * o.ds[j].x) > 1e-6) { bend = true; break; }
        }
      }
      if (bend) out.push({ x: o.p.x, y: o.p.y, ds: o.ds });
    }
    return out;
  }

  // Qozon (burchak) bo'laklari — devor burchagi bilan unga o'zaro eng
  // yaqin qosh burchagi juftlanadi; bo'lak = shu ikki nuqta orasidagi to'rtburchak.
  function computeBlueCorners() {
    const redC = colorCorners('red');
    const yelC = colorCorners('yellow');
    if (!redC.length || !yelC.length) return [];

    const corners = [];
    for (const r of redC) {
      let best = null, bestD = Infinity;
      for (const y of yelC) {
        const d = Math.hypot(y.x - r.x, y.y - r.y);
        if (d < bestD) { bestD = d; best = y; }
      }
      if (!best) continue;
      let backR = null, backD = Infinity;
      for (const r2 of redC) {
        const d = Math.hypot(r2.x - best.x, r2.y - best.y);
        if (d < backD) { backD = d; backR = r2; }
      }
      if (backR !== r) continue;

      // Botiq burchakmi? Devor qirralarining bissektrisasi qosh tomonga qarasa — botiq.
      let bx = 0, by = 0;
      for (const d of r.ds) { bx += d.x; by += d.y; }
      const concave = (bx * (best.x - r.x) + by * (best.y - r.y)) > 0;

      corners.push({
        rx: r.x, ry: r.y, yx: best.x, yy: best.y,
        w: Math.abs(r.x - best.x),
        h: Math.abs(r.y - best.y),
        concave,
      });
    }
    return corners;
  }

  // KAZIROK BO'LAKLARI — devor↔qosh orasidagi yo'lakni to'rtburchaklarga bo'ladi.
  // Har bir offset (qosh) segmenti uchun, chiziq bo'ylab juft-juft teriladi:
  // asosiy (eni KAZ_MAIN_MM) + paloska (eni KAZ_STRIP_MM); bo'yi = offset masofa.
  // Segment oxirida razmer to'g'ri kelmasa, oxirgi bo'lak kichrayadi va FAQAT
  // o'shaning razmeri (eni×bo'yi) ko'rsatiladi. Faqat ko'rinish — hisobga ta'sir yo'q.
  function redDegreeAt(pid) {
    let d = 0;
    for (const l of state.lines) if (l.color !== 'yellow' && (l.a === pid || l.b === pid)) d++;
    return d;
  }
  function computeKazTiles() {
    const out = [];
    const M = KAZ_MAIN_MM, P = KAZ_STRIP_MM, HALF = KAZ_MAIN_MM / 2;
    for (const L of state.lines) {
      if (L.srcEdge == null || !L.offSide || !(L.offDist > 0)) continue;
      // Tiling DEVOR chizig'i bo'ylab teriladi (devor uchidan boshlanadi) —
      // qosh fillet'da burchaklarda siljigani uchun devor aniqroq mos keladi.
      const orig = getLine(L.srcEdge);
      if (!orig) continue;
      const da = getPoint(orig.a), db = getPoint(orig.b);
      if (!da || !db) continue;
      const dx = db.x - da.x, dy = db.y - da.y;
      const seg = Math.hypot(dx, dy);
      if (seg < 1) continue;
      const ux = dx / seg, uy = dy / seg;            // devor bo'ylab birlik vektor
      const sx = L.offSide.x, sy = L.offSide.y;      // devor→qosh birlik perpendikulyar
      const dist = L.offDist;
      // Devor uchi BURCHAK bo'lsa (boshqa devor davom etadi — daraja ≥ 2), o'sha
      // uchda qozon turadi → tiling shu uchni offset masofasicha bo'sh qoldiradi.
      // Ochiq uchda (daraja 1) qozon yo'q — devor uchigacha to'ldiriladi.
      const insetA = (redDegreeAt(orig.a) >= 2) ? dist : 0;
      const insetB = (redDegreeAt(orig.b) >= 2) ? dist : 0;
      const start = insetA, end = seg - insetB;
      const usable = end - start;
      if (usable < 1) continue;   // burchaklar orasida joy yo'q — faqat qozon turadi
      let pos = start;
      const push = (w, paloska, label) => {
        if (w <= 0.5) return;
        const d1 = { x: da.x + ux * pos, y: da.y + uy * pos };            // devor tomoni
        const d2 = { x: da.x + ux * (pos + w), y: da.y + uy * (pos + w) };
        const q1 = { x: d1.x + sx * dist, y: d1.y + sy * dist };          // qosh tomoni
        const q2 = { x: d2.x + sx * dist, y: d2.y + sy * dist };
        out.push({ pts: [d1, d2, q2, q1], paloska, label: !!label, w, h: dist });
        pos += w;
      };
      // Juda qisqa yo'lak — bitta paloska (kerak bo'lsa kichraygan).
      if (usable <= P + 1) { push(usable, true, usable < P - 1); continue; }
      // 1) boshlang'ich paloska (doim).
      push(P, true, false);
      // 2) to'liq (asosiy + paloska) juftliklari — oxirgi paloskaga joy qoldirib.
      let guard = 0;
      while ((end - pos) >= (M + P) && guard++ < 2000) {
        push(M, false, false);
        push(P, true, false);
      }
      // 3) qoldiq: oxirgi asosiy bo'lak kichrayadi (FAQAT u razmerli ko'rinadi).
      const leftover = end - pos;
      if (leftover > 1) {
        const shrunkMain = leftover - P;
        if (shrunkMain >= HALF) {
          push(shrunkMain, false, true);  // kichraygan asosiy — razmeri ko'rinadi
          push(P, true, false);           // yakuniy paloska (doim, agar asosiy yarmidan katta bo'lsa)
        } else {
          // asosiy yarmidan kichik bo'lib qolardi → yakuniy paloskasiz, qoldiq asosiy bo'ladi
          push(leftover, false, true);
        }
      }
    }
    return out;
  }

  // Qirralar to'plamining (har biri {a,b} nuqta-id) hosil qilgan YOPIQ
  // halqa(lar) yuzasi (mm²). Qirralarni kuzatib (trace), shoelace bilan
  // hisoblaymiz; bir nechta yopiq halqa bo'lsa, yuzalar qo'shiladi.
  // Yopilmagan (ochiq) qism hisobga olinmaydi.
  function traceArea(edges) {
    if (edges.length < 3) return 0;
    const adj = new Map();
    for (const l of edges) {
      if (l.a === l.b) continue;
      if (!adj.has(l.a)) adj.set(l.a, []);
      if (!adj.has(l.b)) adj.set(l.b, []);
      adj.get(l.a).push(l.b);
      adj.get(l.b).push(l.a);
    }
    const key = (u, v) => Math.min(u, v) + '-' + Math.max(u, v);
    const used = new Set();
    let total = 0;
    for (const l of edges) {
      if (l.a === l.b || used.has(key(l.a, l.b))) continue;
      const loop = [l.a];
      let prev = l.a, cur = l.b;
      used.add(key(l.a, l.b));
      let guard = 0;
      while (cur !== l.a && guard++ < edges.length + 2) {
        loop.push(cur);
        let next = null;
        for (const n of (adj.get(cur) || [])) {
          if (n === prev || used.has(key(cur, n))) continue;
          next = n; break;
        }
        if (next == null) break;             // ochiq yo'l — halqa emas
        used.add(key(cur, next));
        prev = cur; cur = next;
      }
      if (cur !== l.a) continue;             // yopilmagan — o'tkazib yuboramiz
      let a2 = 0;
      for (let i = 0; i < loop.length; i++) {
        const p = getPoint(loop[i]), qp = getPoint(loop[(i + 1) % loop.length]);
        if (!p || !qp) { a2 = 0; break; }
        a2 += p.x * qp.y - qp.x * p.y;
      }
      total += Math.abs(a2) / 2;
    }
    return total;                            // mm²
  }
  // Bir rangdagi chiziqlar hosil qilgan yopiq kontur(lar) yuzasi.
  function contourArea(color) {
    return traceArea(state.lines.filter((l) => l.color === color));
  }

  // Qosh (offset) chizig'ining OCHIQ uchlari — devor konturi to'liq
  // yopilmaganda. Har bir ochiq qosh uchi (faqat bitta qosh chizig'iga
  // ulangan nuqta) o'zi kelib chiqqan devor burchagiga (mapOrig) ulanadi.
  // Bu "yopqich" chiziqlar — FAQAT ko'rinish va kazirok yuzasi uchun;
  // hech qaysi uzunlik/son hisobiga qo'shilmaydi. Chizma davom etib yana
  // offset tashlansa, eski uch fillet bilan birikib (daraja 2) ochiqligini
  // yo'qotadi — yopqich avtomatik yangi ochiq uchlarga ko'chadi.
  function yellowDegree(pid) {
    let d = 0;
    for (const l of state.lines) if (l.color === 'yellow' && (l.a === pid || l.b === pid)) d++;
    return d;
  }
  function computeEndCaps() {
    const caps = [];
    const seen = new Set();
    for (const l of state.lines) {
      if (l.color !== 'yellow' || l.srcEdge == null) continue;
      for (const pid of [l.a, l.b]) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        const yp = getPoint(pid);
        if (!yp || yp.mapOrig == null) continue;
        if (yellowDegree(pid) !== 1) continue;     // faqat ochiq uch
        const dp = getPoint(yp.mapOrig);
        if (!dp) continue;
        caps.push({ yp, dp });
      }
    }
    return caps;
  }

  // Kazirok = devor umumiy uzunligi − botiq burchaklardagi qozon ikki o'lchami.
  // Kazirok yuzasi = qosh (tashqi kontur) yuzasi − devor (ichki kontur) yuzasi
  // (ya'ni devor bilan qosh chiziqlari orasidagi yuza).
  function updateKazirok() {
    const lenEl = q('kazirokLen');
    let totRed = 0;
    for (const l of state.lines) if (l.color === 'red') totRed += l.length;
    if (totRed <= 0) { lenEl.textContent = '—'; }
    else {
      let sub = 0;
      for (const c of computeBlueCorners()) if (c.concave) sub += c.w + c.h;
      lenEl.textContent = fmt(totRed - sub, state.unitKazirok);
    }

    const areaEl = q('kazirokArea');
    const caps = computeEndCaps();
    let area = 0;
    if (caps.length) {
      // Devor konturi OCHIQ — devor + qosh + uch yopqichlari birgalikda
      // bitta yopiq halqa (strip) hosil qiladi; yuzasi = kazirok yuzasi.
      const edges = state.lines.map((l) => ({ a: l.a, b: l.b }));
      for (const c of caps) edges.push({ a: c.yp.id, b: c.dp.id });
      area = traceArea(edges);
    } else {
      // Devor ham, qosh ham yopiq — ikki kontur yuzasi ayirmasi.
      const devorA = contourArea('red');
      const qoshA  = contourArea('yellow');
      if (devorA > 0 && qoshA > 0) area = Math.abs(qoshA - devorA);
    }
    areaEl.textContent = area > 0 ? fmtArea(area, state.unitKazirokArea) : '—';
  }

  // Qosh (Latok) umumiy (metr) qiymatini saqlab, tashqariga (React) xabar beramiz.
  let lastLatokM = null;
  function publishLatokMeters(meters) {
    const m = Math.max(0, meters || 0);
    if (m === lastLatokM) return;
    lastLatokM = m;
    try { localStorage.setItem(LATOK_M_KEY, String(m)); } catch (e) { /* noop */ }
    try { window.dispatchEvent(new CustomEvent('chizma:latok', { detail: { meters: m } })); } catch (e) { /* noop */ }
  }

  // Qozon soni (ichki/tashqi) — Varyonka sonini avtomatik to'ldirish uchun.
  let lastQozon = null;
  function publishQozon(inner, outer) {
    const key = inner + '|' + outer;
    if (key === lastQozon) return;
    lastQozon = key;
    try { localStorage.setItem(QOZON_KEY, JSON.stringify({ inner, outer })); } catch (e) { /* noop */ }
    try { window.dispatchEvent(new CustomEvent('chizma:qozon', { detail: { inner, outer } })); } catch (e) { /* noop */ }
  }

  /* ---------------- RENDER ---------------- */
  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function colorHex(c) { return c === 'yellow' ? P.qosh : P.devor; }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // 0) DXF FON NAMUNA — eng pastki qatlam, kulrang, bosib bo'lmaydi
    //    (pointer-events yo'q — bosish ostidagi maydonga o'tadi).
    if (state.showRef && state.refWorld.length) {
      for (const path of state.refWorld) {
        let pts = '';
        for (const p of path) { const s = worldToScreen(p.x, p.y); pts += s.x + ',' + s.y + ' '; }
        svg.appendChild(svgEl('polyline', {
          points: pts.trim(), fill: 'none', stroke: P.ref,
          'stroke-width': 1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
          opacity: 0.85, 'pointer-events': 'none',
        }));
      }
    }

    // 0.5) TAHRIR QATLAMI (erkin geometriya) — namuna ustida.
    renderEditLayer();

    const labels = [];

    // Markaziy nuqta — yozuvni tashqi/ichki tomonga joylash uchun.
    let cenX = 0, cenY = 0;
    for (const p of state.points) { cenX += p.x; cenY += p.y; }
    if (state.points.length) { cenX /= state.points.length; cenY /= state.points.length; }

    function chooseSide(midW, perp, isYellow) {
      const ox = midW.x - cenX, oy = midW.y - cenY;
      let s = (perp.x * ox + perp.y * oy) >= 0 ? 1 : -1;
      if (!isYellow) s = -s;
      return { x: perp.x * s, y: perp.y * s };
    }

    // 1) CHIZIQLAR
    for (const ln of state.lines) {
      const a = getPoint(ln.a), b = getPoint(ln.b);
      if (!a || !b) continue;
      const s1 = worldToScreen(a.x, a.y);
      const s2 = worldToScreen(b.x, b.y);
      const selected = state.selectedLines.has(ln.id);

      svg.appendChild(svgEl('line', {
        x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y,
        stroke: colorHex(ln.color),
        'stroke-width': selected ? 3.5 : 1.8,
        'stroke-dasharray': selected ? '6 4' : 'none',
      }));

      // Tahrir rejimida devor/qosh "hit" zonalari bosishni ushlamasin —
      // bosish svg fonigacha o'tib, tahrir tizimiga boradi.
      const hit = svgEl('line', { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, class: 'seg-hit' });
      if (state.editMode) hit.setAttribute('pointer-events', 'none');
      else {
        hit.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect(ln.id, e.shiftKey); });
        hit.addEventListener('dblclick', (e) => { e.stopPropagation(); openInputEdit(ln.id); });
      }
      svg.appendChild(hit);

      const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
      let tx = b.x - a.x, ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const perp = { x: -ty, y: tx };
      const side = chooseSide({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, perp, ln.color === 'yellow');
      const horizontal = Math.abs(tx) >= Math.abs(ty);
      labels.push({ mx, my, side, horizontal, selected, text: fmt(ln.length, ln.unit) });
    }

    // 1.5) UCH YOPQICHLARI — ochiq qosh uchini devor uchiga qosh rangida
    //      ulaydi (faqat ko'rinish; hech qaysi hisobga qo'shilmaydi).
    for (const c of computeEndCaps()) {
      const s1 = worldToScreen(c.yp.x, c.yp.y);
      const s2 = worldToScreen(c.dp.x, c.dp.y);
      svg.appendChild(svgEl('line', {
        x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y,
        stroke: colorHex('yellow'), 'stroke-width': 1.8, 'stroke-linecap': 'round',
      }));
    }

    // 2) NUQTALAR
    for (const p of state.points) {
      const s = worldToScreen(p.x, p.y);
      svg.appendChild(svgEl('circle', {
        cx: s.x, cy: s.y, r: 1.6,
        fill: P.point, stroke: P.pointStroke, 'stroke-width': 0.75,
      }));
    }

    // 2.5) QOZON to'rtburchaklari (faqat ko'rinish; hisobga ta'sir yo'q).
    const blueCorners = computeBlueCorners();
    if (state.showQozon) for (const c of blueCorners) {
      const s1 = worldToScreen(c.rx, c.ry);
      const s2 = worldToScreen(c.yx, c.yy);
      svg.appendChild(svgEl('rect', {
        x: Math.min(s1.x, s2.x), y: Math.min(s1.y, s2.y),
        width: Math.abs(s2.x - s1.x), height: Math.abs(s2.y - s1.y),
        fill: P.qozon, 'fill-opacity': 0.12,
        stroke: P.qozon, 'stroke-width': 1.6,
      }));
      labels.push({
        mx: (s1.x + s2.x) / 2, my: (s1.y + s2.y) / 2,
        side: { x: 0, y: 0 }, horizontal: true, selected: false,
        blue: true, text: fmtPair(c.w, c.h, state.unitCorner),
      });
    }

    // 2.6) KAZIROK BO'LAKLARI (devor↔qosh orasidagi yo'lak; faqat ko'rinish).
    //   Asosiy bo'lak = qozon bilan bir xil narsa → qozon rangida; paloska — kazirok
    //   rangida (ikki xil rang). Birinchi va oxirgi bo'lak doim paloska.
    if (state.showKazTiles) for (const t of computeKazTiles()) {
      const scr = t.pts.map((p) => worldToScreen(p.x, p.y));
      const col = t.paloska ? P.kazirok : P.qozon;
      svg.appendChild(svgEl('polygon', {
        points: scr.map((s) => s.x + ',' + s.y).join(' '),
        fill: col, 'fill-opacity': t.paloska ? 0.24 : 0.13,
        stroke: col, 'stroke-width': 1,
      }));
      // Faqat oxirgi (kichraygan) bo'lakning razmeri ko'rinadi — qozondagidek.
      if (t.label) {
        const cx = (scr[0].x + scr[1].x + scr[2].x + scr[3].x) / 4;
        const cy = (scr[0].y + scr[1].y + scr[2].y + scr[3].y) / 4;
        labels.push({ mx: cx, my: cy, side: { x: 0, y: 0 }, horizontal: true, selected: false, kaz: true, col, text: fmtPair(t.w, t.h, state.unitCorner) });
      }
    }

    // 3) OFFSET MASOFA O'LCHOVLARI (dimlinear uslubi).
    for (const L of state.lines) {
      if (L.srcEdge == null) continue;
      const orig = getLine(L.srcEdge);
      if (!orig) continue;
      const oa = getPoint(orig.a), ob = getPoint(orig.b);
      if (!oa || !ob) continue;
      const side = L.offSide, dist = L.offDist;
      let dx = ob.x - oa.x, dy = ob.y - oa.y; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const f = 0.5;
      const baseW = { x: oa.x + dx * len * f, y: oa.y + dy * len * f };
      const tipW  = { x: baseW.x + side.x * dist, y: baseW.y + side.y * dist };
      const p1 = worldToScreen(baseW.x, baseW.y), p2 = worldToScreen(tipW.x, tipW.y);
      svg.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: P.offset, 'stroke-width': 1, 'stroke-dasharray': '3 2', opacity: 0.9 }));
      const tk = 4;
      for (const p of [p1, p2]) {
        svg.appendChild(svgEl('line', { x1: p.x - dx * tk, y1: p.y - dy * tk, x2: p.x + dx * tk, y2: p.y + dy * tk, stroke: P.offset, 'stroke-width': 1 }));
      }
      if (state.showRazmer) {
        const tposx = (p1.x + p2.x) / 2 + dx * 10, tposy = (p1.y + p2.y) / 2 + dy * 10;
        const dt = fmt(dist, L.offUnit || 'cm');
        const wdt = dt.length * 6.0 + 6;
        svg.appendChild(svgEl('rect', { x: tposx - wdt / 2, y: tposy - 8, width: wdt, height: 13, rx: 2, fill: P.labelBg }));
        const dtext = svgEl('text', { x: tposx, y: tposy + 2.5, fill: P.offset, 'font-size': 10, 'text-anchor': 'middle' });
        dtext.textContent = dt;
        svg.appendChild(dtext);
      }
    }

    // 4) O'LCHOV YOZUVLARI (fon bilan) — "+" belgilardan OLDIN chiziladi,
    //    aks holda yozuv foni offset "+" ni bekitib, bosib bo'lmay qolardi.
    const LABEL_OFF = 13;
    if (state.showRazmer) for (const L of labels) {
      let x, y, anchor, baseline, ry;
      if (L.blue || L.kaz) {
        x = L.mx; y = L.my; anchor = 'middle'; baseline = 'middle'; ry = y - 7;
      } else {
        x = L.mx + L.side.x * LABEL_OFF;
        y = L.my + L.side.y * LABEL_OFF;
        if (L.horizontal) {
          anchor = 'middle';
          if (L.side.y < 0) { baseline = 'auto';    ry = y - 13; }
          else              { baseline = 'hanging'; ry = y - 1; }
        } else {
          baseline = 'middle'; ry = y - 7;
          anchor = L.side.x > 0 ? 'start' : 'end';
        }
      }
      const w = L.text.length * 6.4 + 6;
      let rx;
      if (anchor === 'middle') rx = x - w / 2;
      else if (anchor === 'start') rx = x - 3;
      else rx = x - w + 3;
      svg.appendChild(svgEl('rect', { x: rx, y: ry, width: w, height: 14, rx: 3, fill: P.labelBg }));
      const label = svgEl('text', {
        x, y, fill: L.kaz ? (L.col || P.kazirok) : (L.blue ? P.qozon : (L.selected ? P.accent : P.text)), 'font-size': 11,
        'text-anchor': anchor, 'dominant-baseline': baseline,
      });
      label.textContent = L.text;
      svg.appendChild(label);
    }

    // 5) "+" BELGILARI (chiziq rangiga qarab guruhlangan) — eng ustda,
    //    razmer yozuvi ustiga tushsa ham ko'rinadi va bosiladi.
    //    Tahrir rejimida "+" belgilari ko'rsatilmaydi (chalkashmasin).
    if (!state.editMode) {
    for (const p of state.points) {
      if (!pointPlusVisible(p.id)) continue;
      const s = worldToScreen(p.x, p.y);
      const occ = occupiedDirs(p.id);
      for (const dir in DIRS) {
        if (occ.has(dir)) continue;
        const v = DIRS[dir];
        svg.appendChild(makePlus(s.x + v.dx * PLUS_OFFSET, s.y + v.dy * PLUS_OFFSET, p.id, dir));
      }
    }
    for (const ln of state.lines) {
      const grpVisible = ln.color === 'yellow' ? state.showQoshPlus : state.showDevorPlus;
      if (!grpVisible) continue;
      const a = getPoint(ln.a), b = getPoint(ln.b);
      if (!a || !b) continue;
      const s1 = worldToScreen(a.x, a.y), s2 = worldToScreen(b.x, b.y);
      const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
      let tx = b.x - a.x, ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const perps = [{ x: -ty, y: tx }, { x: ty, y: -tx }];
      for (const pv of perps) {
        svg.appendChild(makeOffsetPlus(mx + pv.x * OFFSET_BTN, my + pv.y * OFFSET_BTN, ln.id, pv));
      }
    }
    }  // if (!state.editMode)

    // 5.5) TAHRIR asbobining jonli ko'rinishi (rubber-band / ghost).
    renderEditPreview();

    // 6) CHIZISH PREVIEW (punktir + jonli uzunlik + snap).
    const ai = state.activeInput;
    if (ai && ai.mode === 'draw') {
      const A = getPoint(ai.pointId);
      if (A) {
        const v = DIRS[ai.dir], len = ai.previewLen || 0;
        const sA = worldToScreen(A.x, A.y);
        const sE = worldToScreen(A.x + v.dx * len, A.y + v.dy * len);
        const active = ai.snapType != null;
        svg.appendChild(svgEl('line', {
          x1: sA.x, y1: sA.y, x2: sE.x, y2: sE.y,
          stroke: active ? P.accent : colorHex(state.color),
          'stroke-width': active ? 2.2 : 1.6, 'stroke-dasharray': '6 4',
        }));
        if (ai.snapType === 'point' && ai.snapPid != null) {
          const B = getPoint(ai.snapPid);
          if (B) { const sB = worldToScreen(B.x, B.y); svg.appendChild(greenCross(sB.x, sB.y)); }
        }
        if (len > 0) {
          const t = fmt(len, state.unit);
          const w = t.length * 6.4 + 6;
          const tx = sE.x + (v.dx * 12) + (v.dx === 0 ? 12 : 0);
          const ty = sE.y + (v.dy * 14) - (v.dy === 0 ? 8 : 0);
          svg.appendChild(svgEl('rect', { x: tx - w / 2, y: ty - 9, width: w, height: 14, rx: 3, fill: P.labelBg }));
          const tlbl = svgEl('text', { x: tx, y: ty, fill: active ? P.accent : P.text, 'font-size': 11, 'text-anchor': 'middle' });
          tlbl.textContent = t;
          svg.appendChild(tlbl);
        }
      }
    }

    repositionInput();   // pan/zoom paytida kiritish qutisi chizma bilan birga ko'chadi
    updatePanel();
    updateScaleInfo();
    syncHistoryButtons();
    saveStateLS();
  }

  // Kiritish qutisini joriy activeInput langariga qarab qayta joylaydi
  // (pan/zoom'da quti chizmaga "yopishib" yuradi, yopilmaydi).
  function repositionInput() {
    const ai = state.activeInput;
    if (!ai) return;
    if (ai.mode === 'draw') {
      const p = getPoint(ai.pointId); if (!p) return;
      const s = worldToScreen(p.x, p.y);
      const v = DIRS[ai.dir];
      positionBox(s.x + v.dx * (PLUS_OFFSET + 8), s.y + v.dy * (PLUS_OFFSET + 8));
    } else if (ai.mode === 'edit') {
      const ln = getLine(ai.lineId); if (!ln) return;
      const a = getPoint(ln.a), b = getPoint(ln.b);
      if (!a || !b) return;
      const s1 = worldToScreen(a.x, a.y), s2 = worldToScreen(b.x, b.y);
      positionBox((s1.x + s2.x) / 2, (s1.y + s2.y) / 2);
    } else if (ai.mode === 'offset') {
      const ln = getLine(ai.lineId); if (!ln) return;
      const a = getPoint(ln.a), b = getPoint(ln.b);
      if (!a || !b) return;
      const s1 = worldToScreen(a.x, a.y), s2 = worldToScreen(b.x, b.y);
      positionBox((s1.x + s2.x) / 2 + ai.side.x * (OFFSET_BTN + 12), (s1.y + s2.y) / 2 + ai.side.y * (OFFSET_BTN + 12));
    }
  }

  // Kichik "+" (tekislash/snap indikatori) — accent rangda.
  function greenCross(cx, cy) {
    const g = svgEl('g', {});
    g.appendChild(svgEl('circle', { cx, cy, r: 4, fill: P.accentSoft, stroke: P.accent, 'stroke-width': 1 }));
    g.appendChild(svgEl('line', { x1: cx - 2, y1: cy, x2: cx + 2, y2: cy, stroke: P.accent, 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: cx, y1: cy - 2, x2: cx, y2: cy + 2, stroke: P.accent, 'stroke-width': 1.2 }));
    return g;
  }

  function makePlus(cx, cy, pointId, dir) {
    const g = svgEl('g', {});
    g.appendChild(svgEl('circle', { cx, cy, r: 4.5, fill: P.accentSoft, stroke: P.accent, 'stroke-width': 1 }));
    g.appendChild(svgEl('line', { x1: cx - 2, y1: cy, x2: cx + 2, y2: cy, stroke: P.accent, 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: cx, y1: cy - 2, x2: cx, y2: cy + 2, stroke: P.accent, 'stroke-width': 1.2 }));
    const hit = svgEl('circle', { cx, cy, r: 8, class: 'plus-hit' });
    hit.addEventListener('click', (e) => { e.stopPropagation(); openInputDraw(pointId, dir); });
    g.appendChild(hit);
    return g;
  }

  // OFFSET "+" — chiziqni shu tomonga nusxalaydi.
  function makeOffsetPlus(cx, cy, lineId, side) {
    const g = svgEl('g', { class: 'offset-plus', opacity: 0.7 });
    g.appendChild(svgEl('circle', {
      cx, cy, r: 4.2, fill: P.offset, 'fill-opacity': 0.16,
      stroke: P.offset, 'stroke-width': 1, 'stroke-opacity': 0.9,
    }));
    g.appendChild(svgEl('line', { x1: cx - 2, y1: cy, x2: cx + 2, y2: cy, stroke: P.offset, 'stroke-width': 1.2 }));
    g.appendChild(svgEl('line', { x1: cx, y1: cy - 2, x2: cx, y2: cy + 2, stroke: P.offset, 'stroke-width': 1.2 }));
    const hit = svgEl('circle', { cx, cy, r: 8, class: 'offset-hit' });
    hit.addEventListener('click', (e) => { e.stopPropagation(); openInputOffset(lineId, side); });
    g.appendChild(hit);
    return g;
  }

  /* ---------------- TANLASH ---------------- */
  function toggleSelect(lineId, additive) {
    if (additive) {
      if (state.selectedLines.has(lineId)) state.selectedLines.delete(lineId);
      else state.selectedLines.add(lineId);
    } else {
      const only = state.selectedLines.size === 1 && state.selectedLines.has(lineId);
      state.selectedLines.clear();
      if (!only) state.selectedLines.add(lineId);
    }
    render();
  }

  /* ---------------- YON PANEL ---------------- */
  function updatePanel() {
    let totRed = 0, totYel = 0;
    for (const ln of state.lines) {
      if (ln.color === 'yellow') totYel += ln.length; else totRed += ln.length;
    }
    q('totalRed').textContent = fmt(totRed, state.unitDevor);
    q('totalYellow').textContent = fmt(totYel, state.unitQosh);
    q('lineCount').textContent = state.lines.filter((l) => l.color === 'red').length;

    updateKazirok();
    publishLatokMeters(totYel / UNITS.m); // latok uzunligi — Qosh (Latok) umumiy bo'yicha

    const corners = computeBlueCorners();
    q('qozonCount').textContent = corners.length + ' dona';
    const innerN = corners.filter((c) => c.concave).length;
    publishQozon(innerN, corners.length - innerN); // ichki (botiq) va oddiy (tashqi) qozon soni

    const list = q('lineList');
    list.innerHTML = '';

    // Qozonlar — eng tepada (bosib bo'lmaydi).
    corners.forEach((c, i) => {
      const item = document.createElement('div');
      item.className = 'item info';
      const nomi = c.concave ? `Qozon (Ichki) ${i + 1}` : `Qozon ${i + 1}`;
      item.innerHTML =
        '<span class="swatch" style="background:var(--chz-qozon)"></span>' +
        `<span>${nomi}</span>` +
        `<span class="len">${fmtPair(c.w, c.h, state.unitCorner)}</span>`;
      list.appendChild(item);
    });

    if (state.lines.length === 0 && corners.length === 0) {
      const e = document.createElement('div');
      e.className = 'empty'; e.textContent = "Hali chiziq yo'q.";
      list.appendChild(e);
      return;
    }

    state.lines.forEach((ln, i) => {
      const item = document.createElement('div');
      item.className = 'item' + (state.selectedLines.has(ln.id) ? ' selected' : '');
      const lu = ln.color === 'yellow' ? state.unitQosh : state.unitDevor;
      const sw = ln.color === 'yellow' ? 'var(--chz-qosh)' : 'var(--chz-devor)';
      item.innerHTML =
        `<span class="swatch" style="background:${sw}"></span>` +
        `<span>#${i + 1}</span>` +
        `<span class="len">${fmt(ln.length, lu)}</span>` +
        '<span class="editBtn" title="Tahrirlash">✎</span>';
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('editBtn')) { openInputEdit(ln.id); return; }
        toggleSelect(ln.id, e.shiftKey);
      });
      list.appendChild(item);
    });
  }

  function updateScaleInfo() {
    const mmPerPx = Math.round((1 / state.scale) * 100) / 100;
    q('scaleInfo').textContent =
      `1 px = ${mmPerPx} mm • Chizish: ${state.color === 'yellow' ? 'Qosh (Latok)' : 'Devor'} • Birlik: ${state.unit}`;
  }

  function syncHistoryButtons() {
    q('btnUndo').disabled = undoStack.length === 0;
    q('btnRedo').disabled = redoStack.length === 0;
  }
  function syncToggleButtons() {
    q('btnAddPoint').classList.toggle('active', state.placingPoint);
    q('tgDevor').classList.toggle('off', !state.showDevorPlus);
    q('tgQosh').classList.toggle('off', !state.showQoshPlus);
    q('tgQozon').classList.toggle('off', !state.showQozon);
    q('tgKaz').classList.toggle('off', !state.showKazTiles);
    q('tgRazmer').classList.toggle('off', !state.showRazmer);
  }

  /* ---------------- TEKISLASH (snap) ---------------- */
  function nearestPointId(sx, sy, thr, excludeId) {
    let best = null, bd = thr;
    for (const p of state.points) {
      if (p.id === excludeId) continue;
      const s = worldToScreen(p.x, p.y);
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d <= bd) { bd = d; best = p.id; }
    }
    return best;
  }

  function updateDrawPreview(e) {
    const ai = state.activeInput;
    if (!ai || ai.mode !== 'draw') return;
    const A = getPoint(ai.pointId);
    if (!A) return;
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const wc = screenToWorld(sx, sy);
    const v = DIRS[ai.dir];
    const horiz = (ai.dir === 'left' || ai.dir === 'right');
    const sign = (ai.dir === 'right' || ai.dir === 'down') ? 1 : -1;

    let len = (wc.x - A.x) * v.dx + (wc.y - A.y) * v.dy;
    if (len < 0) len = 0;
    let snapPid = null, snapType = null;

    // Boshqa nuqtaga TEKISLASH (snap).
    const bId = nearestPointId(sx, sy, 14, ai.pointId);
    if (bId != null) {
      const B = getPoint(bId);
      const signed = horiz ? (B.x - A.x) * sign : (B.y - A.y) * sign;
      if (signed > 0) { len = signed; snapPid = bId; snapType = 'point'; }
    }

    ai.previewLen = len;
    ai.snapPid = snapPid;
    ai.snapType = snapType;
    render();
  }

  /* ---------------- TANLASH RAMKASI YORDAMCHILARI ---------------- */
  function pointInRect(x, y, r) { return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2; }
  function turn(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segSeg(a, b, c, d) {
    const d1 = turn(c, d, a), d2 = turn(c, d, b), d3 = turn(a, b, c), d4 = turn(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function segIntersectsRect(p1, p2, r) {
    const c = [{ x: r.x1, y: r.y1 }, { x: r.x2, y: r.y1 }, { x: r.x2, y: r.y2 }, { x: r.x1, y: r.y2 }];
    for (let i = 0; i < 4; i++) if (segSeg(p1, p2, c[i], c[(i + 1) % 4])) return true;
    return false;
  }

  /* ---------------- SAQLASH / YUKLASH (localStorage) ---------------- */
  let _saveT = null;
  function saveStateLS() {
    if (_saveT) return;
    _saveT = setTimeout(() => {
      _saveT = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          points: state.points, lines: state.lines,
          ents: state.editEntities, ne: state.nextEntId,
          layers: state.layers, curLayer: state.curLayer, curColor: state.curColor, curWidth: state.curWidth,
          np: state.nextPointId, nl: state.nextLineId,
          color: state.color, unit: state.unit,
          unitDevor: state.unitDevor, unitQosh: state.unitQosh,
          unitKazirok: state.unitKazirok, unitKazirokArea: state.unitKazirokArea, unitCorner: state.unitCorner,
          showDevorPlus: state.showDevorPlus, showQoshPlus: state.showQoshPlus, showQozon: state.showQozon,
          showRazmer: state.showRazmer, showRef: state.showRef, showKazTiles: state.showKazTiles,
          scale: state.scale, panX: state.panX, panY: state.panY,
        }));
      } catch (e) { /* noop */ }
    }, 250);
  }

  function loadStateLS() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || !Array.isArray(o.points)) return false;
      state.points = o.points;
      state.lines = o.lines || [];
      state.editEntities = o.ents || [];
      if (Array.isArray(o.layers) && o.layers.length) state.layers = o.layers;
      if (typeof o.curLayer === 'string') state.curLayer = o.curLayer;
      state.curColor = o.curColor || null;
      state.curWidth = o.curWidth || null;
      state.nextPointId = o.np || (Math.max(0, ...state.points.map((p) => p.id)) + 1);
      state.nextLineId = o.nl || (Math.max(0, ...state.lines.map((l) => l.id)) + 1);
      state.nextEntId = o.ne || (Math.max(0, ...state.editEntities.map((e) => e.id)) + 1);
      state.color = o.color || 'red';
      state.unit = o.unit || 'm';
      state.unitDevor = o.unitDevor || 'm';
      state.unitQosh = o.unitQosh || 'm';
      state.unitKazirok = o.unitKazirok || 'm';
      state.unitKazirokArea = o.unitKazirokArea || 'm';
      state.unitCorner = o.unitCorner || 'cm';
      state.showDevorPlus = o.showDevorPlus !== false;
      state.showQoshPlus = o.showQoshPlus === true;
      state.showQozon = o.showQozon !== false;
      state.showRazmer = o.showRazmer !== false;
      state.showRef = o.showRef !== false;
      state.showKazTiles = o.showKazTiles !== false;
      if (o.scale) state.scale = o.scale;
      if (typeof o.panX === 'number') state.panX = o.panX;
      if (typeof o.panY === 'number') state.panY = o.panY;
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- HODISALAR (hammasi destroy'da olib tashlanadi) ---------------- */
  const cleanups = [];
  function on(target, ev, fn, opts) {
    target.addEventListener(ev, fn, opts);
    cleanups.push(() => target.removeEventListener(ev, fn, opts));
  }

  // Quti hodisalari.
  on(lengthInput, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); commitInput(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeInput(); render(); }
  });
  on(unitSelect, 'change', () => {
    const oldUnit = lengthInput.dataset.unit || state.unit;
    const newUnit = unitSelect.value;
    const v = parseFloat(lengthInput.value);
    if (v > 0) {
      const conv = v * UNITS[oldUnit] / UNITS[newUnit];
      lengthInput.value = String(Math.round(conv * 1000) / 1000);
    }
    lengthInput.dataset.unit = newUnit;
    state.unit = newUnit;
    render();
    lengthInput.focus();
  });
  // ZOOM (g'ildirak) — kiritish qutisi ochiq bo'lsa ham yopilmaydi,
  // render ichida repositionInput() uni yangi joyga ko'chiradi.
  on(canvasWrap, 'wheel', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = screenToWorld(mx, my);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    state.scale *= factor;
    state.panX = mx - w.x * state.scale;
    state.panY = my - w.y * state.scale;
    render();
  }, { passive: false });

  // Sichqoncha: chap — tanlash ramkasi, o'rta/o'ng — pan.
  let panning = false, panStart = null;
  let selecting = false, selStart = null, selCur = null, selMoved = false, selShift = false;

  on(canvasWrap, 'contextmenu', (e) => e.preventDefault());

  on(canvasWrap, 'mousedown', (e) => {
    if (inputBox.contains(e.target)) return;
    if (state.activeInput && state.activeInput.mode === 'draw' && e.button === 0) {
      e.preventDefault();
      finalizeDraw();
      return;
    }
    // O'rta/o'ng tugma (pan) — chizish/kiritish rejimida ham ishlaydi,
    // kiritish qutisi YOPILMAYDI (faqat Esc yopadi).
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      panning = true;
      panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      return;
    }
    // TAHRIR rejimi — chap tugma svg ichidagi ISTALGAN joyda tahrir tizimiga
    // boradi (qozon to'rtburchagi/razmer yozuvi/devor chizig'i ustini bossa ham;
    // tahrir o'z geometrik hit-testini ishlatadi). e.target===svg sharti shart emas.
    if (state.editMode && e.button === 0 && svg.contains(e.target)) { e.preventDefault(); editDown(e); return; }
    if (e.target !== svg) return;
    const rect = svg.getBoundingClientRect();
    // "Nuqta qo'shish" rejimi — chap tugma bilan maydonni bosib nuqta ekiladi.
    if (e.button === 0 && state.placingPoint) {
      e.preventDefault();
      placePointAt(e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    if (e.button === 0) {
      selecting = true; selMoved = false; selShift = e.shiftKey;
      selStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      selCur = { ...selStart };
    }
  });

  on(window, 'mousemove', (e) => {
    if (panning) {
      state.panX = panStart.panX + (e.clientX - panStart.x);
      state.panY = panStart.panY + (e.clientY - panStart.y);
      render();
      return;
    }
    if (state.editMode) { editMove(e); return; }
    if (selecting) {
      const rect = svg.getBoundingClientRect();
      selCur = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const x1 = Math.min(selStart.x, selCur.x), y1 = Math.min(selStart.y, selCur.y);
      const w = Math.abs(selCur.x - selStart.x), h = Math.abs(selCur.y - selStart.y);
      if (w > 3 || h > 3) selMoved = true;
      const crossing = selCur.x < selStart.x;
      selBoxEl.style.display = 'block';
      selBoxEl.style.left = x1 + 'px'; selBoxEl.style.top = y1 + 'px';
      selBoxEl.style.width = w + 'px'; selBoxEl.style.height = h + 'px';
      if (crossing) {
        selBoxEl.style.border = `1.5px dashed ${P.accent}`;
        selBoxEl.style.background = `color-mix(in srgb, ${P.accent} 12%, transparent)`;
      } else {
        selBoxEl.style.border = `1.5px solid ${P.qozon}`;
        selBoxEl.style.background = `color-mix(in srgb, ${P.qozon} 12%, transparent)`;
      }
      return;
    }
    if (state.activeInput && state.activeInput.mode === 'draw') updateDrawPreview(e);
  });

  on(window, 'mouseup', (e) => {
    if (panning) { panning = false; return; }
    if (state.editMode) { editUp(e); selBoxEl.style.display = 'none'; return; }
    if (!selecting) return;
    selecting = false;
    selBoxEl.style.display = 'none';

    if (!selMoved) {
      if (!selShift) { state.selectedLines.clear(); render(); }
      return;
    }
    const r = {
      x1: Math.min(selStart.x, selCur.x), y1: Math.min(selStart.y, selCur.y),
      x2: Math.max(selStart.x, selCur.x), y2: Math.max(selStart.y, selCur.y),
    };
    const crossing = selCur.x < selStart.x;
    if (!selShift) state.selectedLines.clear();
    for (const ln of state.lines) {
      const a = getPoint(ln.a), b = getPoint(ln.b);
      if (!a || !b) continue;
      const s1 = worldToScreen(a.x, a.y), s2 = worldToScreen(b.x, b.y);
      const in1 = pointInRect(s1.x, s1.y, r), in2 = pointInRect(s2.x, s2.y, r);
      const hit = crossing ? (in1 || in2 || segIntersectsRect(s1, s2, r)) : (in1 && in2);
      if (hit) state.selectedLines.add(ln.id);
    }
    render();
  });

  // Klaviatura qisqartmalari.
  on(window, 'keydown', (e) => {
    // Kiritish/chizish rejimi FAQAT Esc bilan yopiladi — fokus qayerda
    // bo'lishidan qat'i nazar (input ichidagi Esc o'zi to'xtatadi).
    if (state.activeInput) {
      if (e.key === 'Escape') { closeInput(); render(); }
      return;
    }
    // "Nuqta qo'shish" rejimi — Esc bilan bekor qilinadi.
    if (state.placingPoint && e.key === 'Escape') { setPlacingPoint(false); return; }
    // TAHRIR rejimi qisqartmalari (Ctrl+Z/Y/E pastda umumiy ishlayveradi).
    if (state.editMode) {
      if (e.key === 'Escape') { e.preventDefault(); editEscape(); return; }
      if (e.key === 'Enter') { e.preventDefault(); finishPline(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selEdit.size > 0) { e.preventDefault(); eraseSelectedEnts(); return; }
    }
    // Boshqa input/textarea fokusta bo'lsa aralashmaymiz (zakas formasi).
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'e') { e.preventDefault(); centerView(); }
    else if (!state.editMode && (e.key === 'Delete' || e.key === 'Backspace') && state.selectedLines.size > 0) {
      e.preventDefault(); deleteSelected();
    }
  });

  // Toolbar hodisalari.
  on(q('btnAddPoint'), 'click', () => setPlacingPoint(!state.placingPoint));
  on(q('btnRed'), 'click', () => setColor('red'));
  on(q('btnYellow'), 'click', () => setColor('yellow'));
  on(q('btnUndo'), 'click', undo);
  on(q('btnRedo'), 'click', redo);
  on(q('btnDelete'), 'click', deleteSelected);
  on(q('btnClear'), 'click', clearAll);
  on(q('btnFit'), 'click', centerView);

  // DXF fon namuna: tugma / fayl tanlash / sudrab-tashlash / birlik / o'chirish.
  async function handleRefFile(file) {
    if (!file) return;
    const name = file.name || 'DXF';
    if (!/\.dxf$/i.test(name)) { setRefInfo('Faqat .dxf fayl bo\'lishi kerak'); return; }
    let text;
    try { text = await file.text(); } catch (e) { setRefInfo('Faylni o\'qib bo\'lmadi'); return; }
    await importDxfText(text, name);
  }
  on(q('btnImport'), 'click', () => q('fileInput').click());
  on(q('fileInput'), 'change', (e) => {
    const f = e.target.files && e.target.files[0];
    handleRefFile(f);
    e.target.value = '';   // bir xil faylni qayta tanlash mumkin bo'lsin
  });
  on(q('unitRef'), 'change', (e) => setRefUnit(e.target.value));
  on(q('btnRefClear'), 'click', clearRef);
  on(q('tgRef'), 'click', () => { state.showRef = !state.showRef; syncRefUI(); render(); });
  // Faylni chizma maydoniga sudrab tashlash.
  on(canvasWrap, 'dragover', (e) => { e.preventDefault(); canvasWrap.classList.add('chz-dragover'); });
  on(canvasWrap, 'dragleave', () => canvasWrap.classList.remove('chz-dragover'));
  on(canvasWrap, 'drop', (e) => {
    e.preventDefault();
    canvasWrap.classList.remove('chz-dragover');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleRefFile(f);
  });

  // TAHRIR rejimi tugmalari.
  on(q('btnEdit'), 'click', () => setEditMode(!state.editMode));
  on(q('btnRefEdit'), 'click', makeRefEditable);
  root.querySelectorAll('.etool').forEach((b) => on(b, 'click', () => setEditTool(b.getAttribute('data-tool'))));
  // Xossa (rang/qalinlik) — joriy qiymatga o'rnatadi va tanlangan(lar)ga qo'llaydi.
  on(q('entColor'), 'change', (e) => { state.curColor = e.target.value; applyToSel('color', e.target.value); });
  on(q('entWidth'), 'change', (e) => { state.curWidth = parseFloat(e.target.value); applyToSel('width', parseFloat(e.target.value)); });
  // Qatlam
  on(q('layerSel'), 'change', (e) => { state.curLayer = e.target.value; });
  on(q('btnLayerAdd'), 'click', addLayer);
  on(q('btnLayerVis'), 'click', toggleCurLayerVis);

  on(q('unitKazirok'), 'change', (e) => { state.unitKazirok = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitKazirokArea'), 'change', (e) => { state.unitKazirokArea = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitDevor'), 'change',   (e) => { state.unitDevor   = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitQosh'), 'change',    (e) => { state.unitQosh    = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitCorner'), 'change',  (e) => { state.unitCorner  = e.target.value; updatePanel(); saveStateLS(); });

  on(q('tgDevor'), 'click', () => { state.showDevorPlus = !state.showDevorPlus; syncToggleButtons(); render(); });
  on(q('tgQosh'), 'click',  () => { state.showQoshPlus  = !state.showQoshPlus;  syncToggleButtons(); render(); });
  on(q('tgQozon'), 'click', () => { state.showQozon     = !state.showQozon;     syncToggleButtons(); render(); });
  on(q('tgKaz'), 'click',   () => { state.showKazTiles  = !state.showKazTiles;  syncToggleButtons(); render(); });
  on(q('tgRazmer'), 'click', () => { state.showRazmer   = !state.showRazmer;    syncToggleButtons(); saveStateLS(); render(); });

  // Chiziqlar ro'yxati — DOIM yashirin boshlanadi, tugma bosilsa ochiladi.
  let showList = false;
  on(q('tgList'), 'click', () => {
    showList = !showList;
    q('lineList').style.display = showList ? '' : 'none';
    q('tgList').classList.toggle('open', showList);
  });

  // Qo'llanma (yordam matni) — DOIM yashirin boshlanadi, tugma bosilsa ochiladi.
  let showHint = false;
  on(q('tgHint'), 'click', () => {
    showHint = !showHint;
    q('hintBox').style.display = showHint ? '' : 'none';
    q('tgHint').classList.toggle('open', showHint);
  });

  function setColor(c) {
    state.color = c;
    q('btnRed').classList.toggle('active', c === 'red');
    q('btnYellow').classList.toggle('active', c === 'yellow');
    updateScaleInfo();
  }

  // Markazga (Ctrl+E) — FAQAT chiziqlar chegarasigacha avtozoom
  // ("+" belgilari va yolg'iz boshlang'ich nuqta hisobga olinmaydi).
  function centerView() {
    const rect = svg.getBoundingClientRect();
    // Chiziqlarga ulangan nuqtalargina chegarani belgilaydi;
    // chiziq bo'lmasa — mavjud nuqtalar (boshlang'ich) olinadi.
    const ids = new Set();
    for (const l of state.lines) { ids.add(l.a); ids.add(l.b); }
    const pts = ids.size ? state.points.filter((p) => ids.has(p.id)) : state.points;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    // DXF fon namuna chegarasini ham hisobga olamiz (mavjud bo'lsa).
    const rb = refBounds();
    if (rb) {
      minX = Math.min(minX, rb.minX); maxX = Math.max(maxX, rb.maxX);
      minY = Math.min(minY, rb.minY); maxY = Math.max(maxY, rb.maxY);
    }
    // Tahrir elementlari chegarasi ham.
    for (const ent of state.editEntities) for (const p of entVerts(ent)) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (minX === Infinity) return;
    const w = maxX - minX, h = maxY - minY;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const pad = 45;

    if (!(w < 1 && h < 1)) {
      const sx = (rect.width  - 2 * pad) / Math.max(w, 1);
      const sy = (rect.height - 2 * pad) / Math.max(h, 1);
      let s = Math.min(sx, sy);
      if (!isFinite(s) || s <= 0) s = 1 / 50;
      s = Math.min(s, 5);
      state.scale = s;
    }
    state.panX = rect.width / 2 - cx * state.scale;
    state.panY = rect.height / 2 - cy * state.scale;
    render();
  }

  // Mavzu o'zgarsa — palitrani qaytadan hisoblab, chizmani yangilaymiz.
  const themeObs = new MutationObserver(() => {
    P = computePalette();
    applyPaletteVars();
    render();
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  // O'lcham o'zgarsa (to'liq ekran / oyna) — qayta chizish.
  const resizeObs = new ResizeObserver(() => render());
  resizeObs.observe(canvasWrap);

  /* ---------------- ISHGA TUSHIRISH ---------------- */
  const restored = loadStateLS();
  if (!restored) {
    state.points = [{ id: 0, x: 0, y: 0 }];
    state.lines = [];
    const rect = svg.getBoundingClientRect();
    state.panX = rect.width / 2;
    state.panY = rect.height / 2;
  }
  loadRefLS();             // saqlangan DXF fon namuna (bo'lsa)
  setColor(state.color);
  q('unitKazirok').value = state.unitKazirok;
  q('unitKazirokArea').value = state.unitKazirokArea;
  q('unitDevor').value = state.unitDevor;
  q('unitQosh').value = state.unitQosh;
  q('unitCorner').value = state.unitCorner;
  syncToggleButtons();
  syncRefUI();
  syncEditUI();
  rebuildLayerSelect();
  render();
  // Chizma yoki namuna bo'lsa — ochilganda darhol markazga olamiz
  // (oyna o'lchami avvalgi sessiyadan farq qilishi mumkin).
  if (state.lines.length || state.refWorld.length || state.editEntities.length) requestAnimationFrame(centerView);

  return {
    centerView,
    destroy() {
      if (_saveT) { clearTimeout(_saveT); _saveT = null; }
      themeObs.disconnect();
      resizeObs.disconnect();
      cleanups.forEach((fn) => fn());
      root.innerHTML = '';
      root.classList.remove('chz');
    },
  };
}
