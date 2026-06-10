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

/* O'lcham birliklari — 1 birlik necha millimetrga teng */
const UNITS = { mm: 1, cm: 10, m: 1000 };

const STORAGE_KEY = 'xona-chizma-v1';

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
  };
}

/* ---------------- DOM SHABLONI ---------------- */
const TEMPLATE = `
  <div class="chz-toolbar">
    <button type="button" class="tool color-devor active" data-chz="btnRed">&#9679; Devor</button>
    <button type="button" class="tool color-qosh" data-chz="btnYellow">&#9679; Qosh (Latok)</button>
    <span class="sep"></span>
    <button type="button" class="tool" data-chz="btnUndo" title="Ctrl+Z">&#8630; Orqaga</button>
    <button type="button" class="tool" data-chz="btnRedo" title="Ctrl+Y">&#8631; Oldinga</button>
    <button type="button" class="tool" data-chz="btnDelete" title="Delete">&#128465; O'chirish</button>
    <button type="button" class="tool" data-chz="btnClear">&#10005; Tozalash</button>
    <span class="sep"></span>
    <button type="button" class="tool" data-chz="btnFit" title="Chiziqlar chegarasigacha avtozoom — Z va E tugmalarini birga bosing">&#10530; Markazga (Z+E)</button>
    <span class="chz-scale" data-chz="scaleInfo"></span>
    <span class="chz-tglbl">Belgilar (+):</span>
    <button type="button" class="tool tg" data-chz="tgDevor" title="Devor + belgilari — razmer ko'rinaveradi">Devor +</button>
    <button type="button" class="tool tg" data-chz="tgQosh" title="Qosh + belgilari — razmer ko'rinaveradi">Qosh +</button>
    <button type="button" class="tool tg" data-chz="tgQozon" title="Qozonlar ko'rinishi — hisobga ta'sir qilmaydi">Qozon</button>
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
      <div class="chz-stat kazirok">
        <span class="lbl">Kazirok umumiy:</span>
        <span class="val" data-chz="kazirokLen">&mdash;</span>
        <select class="rowUnit" data-chz="unitKazirok"><option>mm</option><option>cm</option><option selected>m</option></select>
      </div>
      <div class="chz-stat devor">
        <span class="lbl">Devor umumiy:</span>
        <span class="val" data-chz="totalRed">0</span>
        <select class="rowUnit" data-chz="unitDevor"><option>mm</option><option>cm</option><option selected>m</option></select>
      </div>
      <div class="chz-stat qosh">
        <span class="lbl">Qosh (Latok) umumiy:</span>
        <span class="val" data-chz="totalYellow">0</span>
        <select class="rowUnit" data-chz="unitQosh"><option>mm</option><option>cm</option><option selected>m</option></select>
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
      <div class="chz-hint">
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
        &bull; <b>Ctrl+Z/Ctrl+Y</b> — orqaga/oldinga; <b>Markazga (Z+E)</b> — chiziqlar chegarasigacha avtozoom.
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
    unitDevor: 'm', unitQosh: 'm', unitKazirok: 'm', unitCorner: 'cm',
    selectedLines: new Set(),
    scale: 1 / 50,         // piksel / mm
    panX: 0, panY: 0,
    activeInput: null,     // {mode:"draw"|...}
    showDevorPlus: true,
    showQoshPlus: false,
    showQozon: true,
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
    });
  }
  function restore(s) {
    const o = JSON.parse(s);
    state.points = o.points;
    state.lines = o.lines;
    state.nextPointId = o.np;
    state.nextLineId = o.nl;
    state.selectedLines.clear();
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

  function clearAll() {
    if (state.lines.length === 0 && state.points.length <= 1) return;
    pushHistory();
    state.points = [{ id: 0, x: 0, y: 0 }];
    state.lines = [];
    state.selectedLines.clear();
    closeInput();
    render();
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

  // Kazirok = devor umumiy uzunligi − botiq burchaklardagi qozon ikki o'lchami.
  function updateKazirok() {
    const lenEl = q('kazirokLen');
    let totRed = 0;
    for (const l of state.lines) if (l.color === 'red') totRed += l.length;
    if (totRed <= 0) { lenEl.textContent = '—'; return; }

    let sub = 0;
    for (const c of computeBlueCorners()) if (c.concave) sub += c.w + c.h;

    lenEl.textContent = fmt(totRed - sub, state.unitKazirok);
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

      const hit = svgEl('line', { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, class: 'seg-hit' });
      hit.addEventListener('click', (e) => { e.stopPropagation(); toggleSelect(ln.id, e.shiftKey); });
      hit.addEventListener('dblclick', (e) => { e.stopPropagation(); openInputEdit(ln.id); });
      svg.appendChild(hit);

      const mx = (s1.x + s2.x) / 2, my = (s1.y + s2.y) / 2;
      let tx = b.x - a.x, ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const perp = { x: -ty, y: tx };
      const side = chooseSide({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, perp, ln.color === 'yellow');
      const horizontal = Math.abs(tx) >= Math.abs(ty);
      labels.push({ mx, my, side, horizontal, selected, text: fmt(ln.length, ln.unit) });
    }

    // 2) NUQTALAR
    for (const p of state.points) {
      const s = worldToScreen(p.x, p.y);
      svg.appendChild(svgEl('circle', {
        cx: s.x, cy: s.y, r: 3.5,
        fill: P.point, stroke: P.pointStroke, 'stroke-width': 1,
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
      const tposx = (p1.x + p2.x) / 2 + dx * 10, tposy = (p1.y + p2.y) / 2 + dy * 10;
      const dt = fmt(dist, L.offUnit || 'cm');
      const wdt = dt.length * 6.0 + 6;
      svg.appendChild(svgEl('rect', { x: tposx - wdt / 2, y: tposy - 8, width: wdt, height: 13, rx: 2, fill: P.labelBg }));
      const dtext = svgEl('text', { x: tposx, y: tposy + 2.5, fill: P.offset, 'font-size': 10, 'text-anchor': 'middle' });
      dtext.textContent = dt;
      svg.appendChild(dtext);
    }

    // 4) O'LCHOV YOZUVLARI (fon bilan) — "+" belgilardan OLDIN chiziladi,
    //    aks holda yozuv foni offset "+" ni bekitib, bosib bo'lmay qolardi.
    const LABEL_OFF = 13;
    for (const L of labels) {
      let x, y, anchor, baseline, ry;
      if (L.blue) {
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
        x, y, fill: L.blue ? P.qozon : (L.selected ? P.accent : P.text), 'font-size': 11,
        'text-anchor': anchor, 'dominant-baseline': baseline,
      });
      label.textContent = L.text;
      svg.appendChild(label);
    }

    // 5) "+" BELGILARI (chiziq rangiga qarab guruhlangan) — eng ustda,
    //    razmer yozuvi ustiga tushsa ham ko'rinadi va bosiladi.
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

    const corners = computeBlueCorners();
    q('qozonCount').textContent = corners.length + ' dona';

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
    q('tgDevor').classList.toggle('off', !state.showDevorPlus);
    q('tgQosh').classList.toggle('off', !state.showQoshPlus);
    q('tgQozon').classList.toggle('off', !state.showQozon);
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
          np: state.nextPointId, nl: state.nextLineId,
          color: state.color, unit: state.unit,
          unitDevor: state.unitDevor, unitQosh: state.unitQosh,
          unitKazirok: state.unitKazirok, unitCorner: state.unitCorner,
          showDevorPlus: state.showDevorPlus, showQoshPlus: state.showQoshPlus, showQozon: state.showQozon,
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
      state.nextPointId = o.np || (Math.max(0, ...state.points.map((p) => p.id)) + 1);
      state.nextLineId = o.nl || (Math.max(0, ...state.lines.map((l) => l.id)) + 1);
      state.color = o.color || 'red';
      state.unit = o.unit || 'm';
      state.unitDevor = o.unitDevor || 'm';
      state.unitQosh = o.unitQosh || 'm';
      state.unitKazirok = o.unitKazirok || 'm';
      state.unitCorner = o.unitCorner || 'cm';
      state.showDevorPlus = o.showDevorPlus !== false;
      state.showQoshPlus = o.showQoshPlus === true;
      state.showQozon = o.showQozon !== false;
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
    if (e.target !== svg) return;
    const rect = svg.getBoundingClientRect();
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

  on(window, 'mouseup', () => {
    if (panning) { panning = false; return; }
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
  const heldKeys = new Set();   // Z+E (zoom extents, AutoCAD uslubi) uchun
  on(window, 'keydown', (e) => {
    // Kiritish/chizish rejimi FAQAT Esc bilan yopiladi — fokus qayerda
    // bo'lishidan qat'i nazar (input ichidagi Esc o'zi to'xtatadi).
    if (state.activeInput) {
      if (e.key === 'Escape') { closeInput(); render(); }
      return;
    }
    // Boshqa input/textarea fokusta bo'lsa aralashmaymiz (zakas formasi).
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedLines.size > 0) {
      e.preventDefault(); deleteSelected();
    } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      // Z+E birga bosilsa — Markazga (zoom extents, AutoCAD'dagi kabi).
      heldKeys.add(k);
      if (heldKeys.has('z') && heldKeys.has('e')) { e.preventDefault(); centerView(); }
    }
  });
  on(window, 'keyup', (e) => heldKeys.delete(e.key.toLowerCase()));
  on(window, 'blur', () => heldKeys.clear());

  // Toolbar hodisalari.
  on(q('btnRed'), 'click', () => setColor('red'));
  on(q('btnYellow'), 'click', () => setColor('yellow'));
  on(q('btnUndo'), 'click', undo);
  on(q('btnRedo'), 'click', redo);
  on(q('btnDelete'), 'click', deleteSelected);
  on(q('btnClear'), 'click', clearAll);
  on(q('btnFit'), 'click', centerView);

  on(q('unitKazirok'), 'change', (e) => { state.unitKazirok = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitDevor'), 'change',   (e) => { state.unitDevor   = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitQosh'), 'change',    (e) => { state.unitQosh    = e.target.value; updatePanel(); saveStateLS(); });
  on(q('unitCorner'), 'change',  (e) => { state.unitCorner  = e.target.value; updatePanel(); saveStateLS(); });

  on(q('tgDevor'), 'click', () => { state.showDevorPlus = !state.showDevorPlus; syncToggleButtons(); render(); });
  on(q('tgQosh'), 'click',  () => { state.showQoshPlus  = !state.showQoshPlus;  syncToggleButtons(); render(); });
  on(q('tgQozon'), 'click', () => { state.showQozon     = !state.showQozon;     syncToggleButtons(); render(); });

  // Chiziqlar ro'yxati — DOIM yashirin boshlanadi, tugma bosilsa ochiladi.
  let showList = false;
  on(q('tgList'), 'click', () => {
    showList = !showList;
    q('lineList').style.display = showList ? '' : 'none';
    q('tgList').classList.toggle('open', showList);
  });

  function setColor(c) {
    state.color = c;
    q('btnRed').classList.toggle('active', c === 'red');
    q('btnYellow').classList.toggle('active', c === 'yellow');
    updateScaleInfo();
  }

  // Markazga (Z+E) — FAQAT chiziqlar chegarasigacha avtozoom
  // ("+" belgilari va yolg'iz boshlang'ich nuqta hisobga olinmaydi).
  function centerView() {
    const rect = svg.getBoundingClientRect();
    // Chiziqlarga ulangan nuqtalargina chegarani belgilaydi;
    // chiziq bo'lmasa — mavjud nuqtalar (boshlang'ich) olinadi.
    const ids = new Set();
    for (const l of state.lines) { ids.add(l.a); ids.add(l.b); }
    const pts = ids.size ? state.points.filter((p) => ids.has(p.id)) : state.points;
    if (pts.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
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
  setColor(state.color);
  q('unitKazirok').value = state.unitKazirok;
  q('unitDevor').value = state.unitDevor;
  q('unitQosh').value = state.unitQosh;
  q('unitCorner').value = state.unitCorner;
  syncToggleButtons();
  render();
  // Saqlangan chizma bo'lsa — ochilganda darhol markazga olamiz
  // (oyna o'lchami avvalgi sessiyadan farq qilishi mumkin).
  if (restored && state.lines.length) requestAnimationFrame(centerView);

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
