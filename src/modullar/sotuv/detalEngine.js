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
//  mountDetal(root, { variant }) — DOM quradi, { destroy, centerView } qaytaradi.
//  variant: 'detal' (asl) yoki 'gul' — Gul chizish rejimi (gulEngine.js): bir xil
//  asboblar, lekin yon panelda «Nechta ofset tashlansin» soni — Offset asbobi
//  shuncha parallel kontur tashlaydi (geometriya: src/lib/offsetGeom.js);
//  proyeksiyalar bo'limi yo'q, alohida localStorage kalitlari (VARIANTS jadvali).
// ============================================================

import { sonMatn, sonQiymat } from '../../lib/helpers.js';
import { computePalette } from './chizmaEngine.js';
import { safeFileName, downloadDxf } from '../../lib/dxfExport.js';
import { loadSnap, saveSnap, buildGeom, resolveSnap, updateAcquire, gridStepFor, snapMarkerShapes, POLAR_INCS, POLAR_DISTS } from '../../lib/osnap.js';
import { mountStatusBar } from '../../lib/cadStatusBar.js';
import { offsetSide, offsetSeries } from '../../lib/offsetGeom.js';
import { chainOf, chainSide, offsetChainSeries, buildChains, offsetChainInward, piecesToEnts } from '../../lib/chainOffset.js';
import { trimAt, extendAt } from '../../lib/trimExtend.js';
import { breakEnt, stretchEnt, lengthenEnt, polygonPts, polygonEdge, divideEnt, measureEnt, polyArea, polyPerim, chainArea, areaOfEnt } from '../../lib/editGeom.js';
import { curveOf, filletCurves, chamferLines, replaceSegEnd, adjacentSegs, cornerOp, filletPlineAll, chamferPlineAll, explodeEnt, joinEnts } from '../../lib/modifyGeom.js';
import { arcSweep, arcLen, arcStart, arcEnd, arcMid, arcPt, angInArc, arcBounds, distToArc, arcSamples, arcDrawnEnd, arcSCA, arcSCE, arcSCL, arcSEA, arcSED, arcSER, arcFrom3, arcContinue, arcMap, arcSvgPath } from '../../lib/arcGeom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const UNITS = { mm: 1, cm: 10 };
const UNIT_LABEL = { mm: 'mm', cm: 'sm' };
const AUTO_OFF_DEF = 20;     // Gul rejimi: yopiq kontur ichkariga avtomatik ofset masofasi (mm) — 2 sm
const AUTO_OFF_MAX = 1000;
// Rejim variantlari — bitta dvigatel, ikki rejim: Detal chizish (asl) va Gul chizish (gulEngine.js).
// Gulga xos yangi imkoniyatlar shu jadval va V.autoOffset / V.zakas / V.joinOffset shoxlari orqali qo'shiladi.
const VARIANTS = {
  detal: {
    cls: 'dtl', storageKey: 'detal-chizma-v1', libKey: 'detal-chizma-lib-v1',
    title: 'Detal', namePh: 'Detal nomi (masalan: Qosh 12 sm)', autoName: 'Detal', saveEx: 'patalok, qosh',
    libLabel: 'Saqlangan detallar', libEmpty: "Hali saqlangan detal yo'q", libDel: "Detal kutubxonadan o'chirildi",
    offTitle: 'Offset — parallel nusxa (list qalinligi uchun qulay): elementni bosing, masofani yozing, tomonni bosing',
    filePrefix: 'detal_', proj: true, autoOffset: false, zakas: false, joinOffset: false,
  },
  gul: {
    cls: 'gul', storageKey: 'gul-chizma-v1', libKey: 'gul-chizma-lib-v1',
    title: 'Gul', namePh: 'Gul nomi (masalan: Lola 20 sm)', autoName: 'Gul', saveEx: 'lola, yaproq',
    libLabel: 'Saqlangan gullar', libEmpty: "Hali saqlangan gul yo'q", libDel: "Gul kutubxonadan o'chirildi",
    offTitle: "Offset — parallel nusxalar: elementni bosing, masofani yozing, tomonni bosing — yon paneldagi son bo'yicha bir nechta",
    filePrefix: 'gul_', proj: false, autoOffset: true, zakas: true, joinOffset: true,
  },
};
// Gul rejimi: yon paneldagi «Nechta ofset tashlansin» bloki va qo'llanma bandi
const OFFSET_PANEL = '<h3 class="dtl-h3">Ofset</h3>'
  + '<div class="gul-off">'
  + '<div class="dtl-gap gul-offrow"><span>Ofset (ichkariga)</span>'
  + '<span class="gul-step">'
  + '<button type="button" data-dtl="offMinus" title="0.5 sm kam">&minus;</button>'
  + "<input data-dtl=\"autoOff\" type=\"text\" inputmode=\"decimal\" data-num=\"pos\" title=\"Yopiq kontur ichkariga avtomatik ofset masofasi (0 — o'chiq)\" />"
  + '<i data-dtl="autoOffUnit">sm</i>'
  + "<button type=\"button\" data-dtl=\"offPlus\" title=\"0.5 sm ko'p\">+</button>"
  + '</span></div>'
  + "<div class=\"gul-offhint\">Chizmadagi shakl hamma tomondan yopiq bo'lsa (uchlari tutashgan chiziq va yoylar — xuddi join qilingandek), shu masofada ichkariga parallel kontur o'zi chiziladi; chizma yoki son o'zgarganda qayta hisoblanadi. 0 — o'chirish.</div>"
  + '</div>';
const OFFSET_HINT = "&bull; <b>Ofset</b> (yon panel, sm): shakl hamma tomondan yopiq bo'lsa (uchlari tutashgan chiziq/yoylar — join), shu masofada ichkariga parallel kontur <b>avtomatik</b> chiziladi (binafsha); chizma yoki son o'zgarsa qayta hisoblanadi, DXF (OFSET qatlami) va rasmga kiradi. Qo'lda «Offset» asbobi ham tutashgan elementlarni bitta kontur sifatida ofset qiladi.<br>";
// Yoy chizish usullari (AutoCAD «Arc» menyusi, o'zbekcha). steps: ['pt', nom] — nuqta bosiladi
// (yoki oldingi nuqtadan masofa + burchak yoziladi); ['ang'|'len', nom] — oxirgi qiymat yoziladi
// yoki sichqoncha bilan beriladi. grp — menyudagi ajratgich guruhi (AutoCAD tartibi).
const ARC_METHODS = [
  { key: '3p', nomi: '3 nuqta', grp: 0, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Yoy ustidagi 2-nuqta'], ['pt', 'Oxirgi nuqta']] },
  { key: 'sce', nomi: 'Boshi, Markaz, Oxiri', grp: 1, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Markaz'], ['pt', 'Oxirgi nuqta']] },
  { key: 'sca', nomi: 'Boshi, Markaz, Burchak', grp: 1, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Markaz'], ['ang', 'Burchak']] },
  { key: 'scl', nomi: 'Boshi, Markaz, Vatar', grp: 1, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Markaz'], ['len', 'Vatar']] },
  { key: 'sea', nomi: 'Boshi, Oxiri, Burchak', grp: 2, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Oxirgi nuqta'], ['ang', 'Burchak']] },
  { key: 'sed', nomi: "Boshi, Oxiri, Yo'nalish", grp: 2, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Oxirgi nuqta'], ['ang', "Yo'nalish"]] },
  { key: 'ser', nomi: 'Boshi, Oxiri, Radius', grp: 2, steps: [['pt', "Boshlang'ich nuqta"], ['pt', 'Oxirgi nuqta'], ['len', 'Radius']] },
  { key: 'cse', nomi: 'Markaz, Boshi, Oxiri', grp: 3, steps: [['pt', 'Markaz'], ['pt', "Boshlang'ich nuqta"], ['pt', 'Oxirgi nuqta']] },
  { key: 'csa', nomi: 'Markaz, Boshi, Burchak', grp: 3, steps: [['pt', 'Markaz'], ['pt', "Boshlang'ich nuqta"], ['ang', 'Burchak']] },
  { key: 'csl', nomi: 'Markaz, Boshi, Vatar', grp: 3, steps: [['pt', 'Markaz'], ['pt', "Boshlang'ich nuqta"], ['len', 'Vatar']] },
  { key: 'cont', nomi: 'Davom ettirish', grp: 4, steps: [['pt', 'Oxirgi nuqta']] },
];
const ARC_BY_KEY = Object.fromEntries(ARC_METHODS.map((m) => [m.key, m]));
// Buyruq qidirish ro'yxati: o'zbekcha nomi + AutoCAD qisqartmalari (id — asbob yoki #amal)
const CMDS = [
  { id: 'select', nomi: 'Tanlash', al: ['SEL'] },
  { id: 'pline', nomi: 'Chiziq', al: ['L', 'PL', 'LINE', 'PLINE'] },
  { id: 'rect', nomi: "To'rtburchak", al: ['REC', 'RECTANG'] },
  { id: 'polygon', nomi: "Ko'pburchak", al: ['POL', 'POLYGON'] },
  { id: 'donut', nomi: 'Halqa', al: ['DO', 'DONUT'] },
  { id: 'point', nomi: 'Nuqta', al: ['PO', 'POINT'] },
  { id: 'circle', nomi: 'Aylana', al: ['C', 'CIRCLE'] },
  { id: 'arc', nomi: 'Yoy', al: ['A', 'ARC'] },
  { id: 'dim', nomi: "O'lcham", al: ['DIM', 'DLI', 'DAL'] },
  { id: 'move', nomi: "Ko'chirish", al: ['M', 'MOVE'] },
  { id: 'copy', nomi: 'Nusxa', al: ['CO', 'CP', 'COPY'] },
  { id: 'rotate', nomi: 'Burish', al: ['RO', 'ROTATE'] },
  { id: 'mirror', nomi: 'Aks ettirish', al: ['MI', 'MIRROR'] },
  { id: 'scale', nomi: 'Masshtab', al: ['SC', 'SCALE'] },
  { id: 'array', nomi: 'Massiv', al: ['AR', 'ARRAY'] },
  { id: 'stretch', nomi: "Cho'zish", al: ['S', 'STRETCH'] },
  { id: 'align', nomi: 'Tekislash', al: ['AL', 'ALIGN'] },
  { id: 'break', nomi: 'Uzish', al: ['BR', 'BREAK'] },
  { id: 'lengthen', nomi: "Uzunlikni o'zgartirish", al: ['LEN', 'LENGTHEN'] },
  { id: 'dist', nomi: "Masofa (o'lchash)", al: ['DI', 'DIST'] },
  { id: 'area', nomi: 'Yuza (maydon)', al: ['AA', 'AREA'] },
  { id: 'divide', nomi: "Bo'lish (nuqtalar)", al: ['DIV', 'DIVIDE'] },
  { id: 'measure', nomi: "O'lchab qo'yish (nuqtalar)", al: ['ME', 'MEASURE'] },
  { id: 'offset', nomi: 'Offset', al: ['O', 'OFFSET'] },
  { id: 'trim', nomi: 'Kesish', al: ['TR', 'TRIM'] },
  { id: 'extend', nomi: 'Uzaytirish', al: ['EX', 'EXTEND'] },
  { id: 'fillet', nomi: 'Tutashtirish', al: ['F', 'FILLET'] },
  { id: 'chamfer', nomi: 'Faska', al: ['CHA', 'CHAMFER'] },
  { id: 'explode', nomi: 'Portlatish', al: ['X', 'EXPLODE'] },
  { id: 'join', nomi: 'Birlashtirish', al: ['J', 'JOIN'] },
  { id: 'erase', nomi: "O'chirish", al: ['E', 'ERASE', 'DEL'] },
  { id: '#undo', nomi: 'Orqaga', al: ['U', 'UNDO'] },
  { id: '#redo', nomi: 'Oldinga', al: ['REDO'] },
  { id: '#fit', nomi: 'Markazga (zoom)', al: ['Z', 'ZOOM'] },
  { id: '#clear', nomi: 'Tozalash', al: ['CLEAR'] },
  { id: '#start0', nomi: '0,0 dan boshlash', al: ['0'] },
];
// Usul belgisi (AutoCAD uslubida): yoy + boshi/oxiri nuqtalari, markaz (+), burchak, vatar, yo'nalish, radius
function arcIcon(key) {
  const A = '<path d="M4 20 A16 16 0 0 0 20 4" fill="none" stroke="currentColor" stroke-width="1.8"/>';
  const dot = (x, y, f) => '<circle cx="' + x + '" cy="' + y + '" r="2.2" fill="' + (f ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.4"/>';
  const cen = '<path d="M1.5 4 H6.5 M4 1.5 V6.5" stroke="currentColor" stroke-width="1.4"/>';
  const chord = '<path d="M4 20 L20 4" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/>';
  const wedge = '<path d="M4 20 L4 4 L20 4" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/><path d="M4 9 A5 5 0 0 0 9 4" fill="none" stroke="currentColor" stroke-width="1.2"/>';
  const radius = '<path d="M4 4 L15.3 15.3" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/>';
  const dirn = '<path d="M4 20 L13 20 M10 17 L13 20 L10 23" fill="none" stroke="currentColor" stroke-width="1.4"/>';
  const S = dot(4, 20, true), En = dot(20, 4, true), M = dot(15.3, 15.3, false);
  const body = {
    '3p': A + S + M + En,
    sce: A + S + cen + En, sca: A + wedge + S + cen, scl: A + chord + S + cen,
    sea: A + wedge + S + En, sed: A + dirn + S + En, ser: A + radius + S + En,
    cse: A + cen + S + En, csa: A + wedge + cen + S, csl: A + chord + cen + S,
    cont: '<path d="M2 21 H9" stroke="currentColor" stroke-width="1.8"/><path d="M9 21 A12 12 0 0 0 21 9" fill="none" stroke="currentColor" stroke-width="1.8"/>' + dot(9, 21, true) + dot(21, 9, false),
  }[key] || A;
  return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + body + '</svg>';
}
const ARC_HINT = "&bull; <b>Yoy</b> — «Yoy» tugmasi yonidagi ▾ dan usulni tanlang (AutoCAD'dagidek): <b>3 nuqta</b>; <b>Boshi, Markaz, Oxiri / Burchak / Vatar</b>; <b>Boshi, Oxiri, Burchak / Yo'nalish / Radius</b>; <b>Markaz, Boshi, …</b>; <b>Davom ettirish</b> — oxirgi chiziq yoki yoy uchidan tangens bo'ylab. Nuqtalarni bosing yoki oldingi nuqtadan masofa + burchak yozing; oxirgi qiymat (burchak / vatar / radius / yo'nalish) yoziladi yoki sichqoncha bilan beriladi; manfiy qiymat — soat mili bo'yicha / katta yoy. Yoyning uchlari, o'rtasi, markazi va kvadrantlariga magnit yopishadi; yoyga 2 marta bosib radius/burchak tahrirlanadi.<br>";
// Gul rejimi: zakasdagi gullar ro'yxati (yon panel tepasi)
const ZAKAS_KEY = 'gul-zakas-v1';   // localStorage: { [zakasKey]: { active, items:[{id,name,ents,autoOff,t}], t } }
const ZAKAS_MAX = 40;                // saqlanadigan zakaslar soni (eng eskisi tashlanadi)
const ZAKAS_PANEL = '<div class="gul-zakas" data-dtl="zakasBox">'
  + '<div class="gul-zakas-head"><span>Zakasdagi gullar <span class="dtl-cnt" data-dtl="zakasCnt"></span></span>'
  + "<button type=\"button\" class=\"dtl-btn on\" data-dtl=\"zakasAdd\" title=\"Shu zakasga yana bir gul qo'shish (joriysi saqlanib qoladi)\">&#10010; Yangi gul</button></div>"
  + '<div class="gul-zakas-list" data-dtl="zakasList"></div>'
  + "<div class=\"gul-offhint\">Gulni bosib unga o'ting; nomi pastdagi maydonda, o'lchami (eni × bo'yi) chizmadan olinadi.</div>"
  + '</div>';
const SNAP_PX = 12;          // nuqtaga yopishish chegarasi (px)
const GRIP_PX = 4;           // grip kvadratining yarim tomoni (px)
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
// DXF $INSUNITS kodi -> 1 birlik necha mm
const INSUNITS_MM = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };
const TOOLS = ['select', 'pline', 'rect', 'polygon', 'circle', 'arc', 'donut', 'point', 'dim', 'move', 'copy', 'rotate', 'mirror', 'scale', 'stretch', 'align', 'array', 'offset', 'trim', 'extend', 'break', 'lengthen', 'fillet', 'chamfer', 'explode', 'join', 'erase', 'dist', 'area', 'divide', 'measure'];
const PICK_TOOLS = ['select', 'erase', 'trim', 'extend', 'fillet', 'chamfer', 'explode', 'join', 'lengthen', 'divide', 'measure'];   // obyekt tanlanadi — magnit belgisi ko'rsatilmaydi
const LIVE_TOOLS = ['pline', 'rect', 'polygon', 'circle', 'arc', 'donut', 'dim', 'offset', 'trim', 'extend', 'array', 'fillet', 'chamfer', 'stretch', 'align', 'break', 'lengthen', 'divide', 'measure', 'dist', 'area'];   // kursor harakatida qayta chiziladi   // obyekt tanlanadi — magnit belgisi ko'rsatilmaydi
const CIRCLE_MODES = { cr: 'Markaz, radius', dia: 'Markaz, diametr', '2p': '2 nuqta', '3p': '3 nuqta' };
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

/* ---------------- DOM SHABLONI (V — rejim varianti) ---------------- */
function buildTemplate(V) {
  return `
  <div class="chz-toolbar chz-ribbon">
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool etool" data-tool="select" title="Tanlash — bosing (har bosish qo'shiladi, Shift+bosish — olib tashlash, bo'sh joy/Esc — bo'shatish) yoki ramka torting; uchlarini (grip) sudrab o'zgartiring; chiziqqa 2 marta bosing — uzunlik/burchak tahriri">&#10530; Tanlash</button>
    </div><div class="chz-rlbl">Tanlash</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool etool" data-tool="pline" title="Chiziq (L) — boshlang'ich nuqtani bosing, so'ng uzunlik (sm) va burchak (°) yozib Enter bosing. Esc — tugatish, C — konturni yopish">&#9998; Chiziq</button>
      <button type="button" class="tool etool" data-tool="rect" title="To'rtburchak (REC) — burchakni bosing; eni/bo'yini yozing yoki qarama-qarshi burchakni bosing">&#9645; To'rtburchak</button>
      <button type="button" class="tool etool" data-tool="polygon" title="Ko'pburchak (POL) — muntazam: tomonlar soni, markaz → radius (ichki / tashqi) yoki tomon bo'yicha">&#11041; Ko'pburchak</button>
      <button type="button" class="tool etool" data-tool="circle" title="Aylana (C) — markaz+radius, markaz+diametr, 2 nuqta, 3 nuqta (pastdagi variantlar)">&#9711; Aylana</button>
      <span class="chz-arcwrap" data-dtl="arcWrap">
        <button type="button" class="tool etool" data-tool="arc" data-dtl="arcBtn" title="Yoy (A) — usulni yonidagi ▾ dan tanlang (oxirgi usul eslab qolinadi)">&#9696; Yoy</button><button type="button" class="tool arcdd" data-dtl="arcMenuBtn" title="Yoy chizish usullari (AutoCAD Arc)">&#9662;</button>
        <div class="chz-arcmenu" data-dtl="arcMenu"></div>
      </span>
      <button type="button" class="tool etool" data-tool="donut" title="Halqa (DO) — ichki va tashqi diametrli ikki aylana; markazni bosing (takrorlanadi)">&#9678; Halqa</button>
      <button type="button" class="tool etool" data-tool="point" title="Nuqta (PO) — nuqta qo'yish (magnit: Tugun)">&#8226; Nuqta</button>
    </div><div class="chz-rlbl">Chizish</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool etool" data-tool="move" title="Ko'chirish (M) — tanlanganlarni: tayanch nuqta → yangi joy (yoki masofa + burchak yozing)">Ko'chirish</button>
      <button type="button" class="tool etool" data-tool="copy" title="Nusxa (CO) — tayanch nuqta → nusxa joyi (yoki masofa + burchak yozing)">Nusxa</button>
      <button type="button" class="tool etool" data-tool="rotate" title="Burish (RO) — tayanch nuqta → burchak (gradus yozing yoki bosing)">Burish</button>
      <button type="button" class="tool etool" data-tool="mirror" title="Aks ettirish (MI) — o'qning 2 nuqtasini bosing">Aks</button>
      <button type="button" class="tool etool" data-tool="scale" title="Masshtab (SC) — tayanch nuqta → koeffitsient (yozing yoki bosing)">Masshtab</button>
      <button type="button" class="tool etool" data-tool="stretch" title="Cho'zish (S) — ramka torting: ichidagi tugunlar suriladi, qolgani joyida (chiziqlar cho'ziladi); tayanch → yangi joy">&#8660; Cho'zish</button>
      <button type="button" class="tool etool" data-tool="align" title="Tekislash (AL) — tanlanganlarni 2 juft nuqta bo'yicha ko'chirish + burish (masshtab ixtiyoriy)">&#8646; Tekislash</button>
      <button type="button" class="tool etool" data-tool="array" title="Massiv (AR) — to'rtburchak (qator × ustun) yoki qutbiy (markaz atrofida — gul yaproqlari)">&#9638; Massiv</button>
      <button type="button" class="tool etool" data-tool="offset" title="${V.offTitle}">Offset</button>
    </div><div class="chz-rlbl">O'zgartirish</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool etool" data-tool="trim" title="Kesish (TR) — olib tashlanadigan qismga bosing, eng yaqin kesishmalargacha o'chadi">&#9986; Kesish</button>
      <button type="button" class="tool etool" data-tool="extend" title="Uzaytirish (EX) — chiziq yoki yoy uchiga yaqin bosing, yo'nalishidagi eng yaqin elementgacha cho'ziladi">&#10145; Uzaytirish</button>
      <button type="button" class="tool etool" data-tool="break" title="Uzish (BR) — obyektni ikki nuqta orasida uzish (oralig'i olib tashlanadi) yoki bitta nuqtada ikkiga bo'lish">&#8942; Uzish</button>
      <button type="button" class="tool etool" data-tool="lengthen" title="Uzunlikni o'zgartirish (LEN) — chiziq/yoy uchini: delta, foiz yoki umumiy uzunlik bo'yicha">&#8596;&#xFE0E; Uzunlik</button>
      <button type="button" class="tool etool" data-tool="fillet" title="Tutashtirish (F) — ikki obyektni radiusli yoy bilan ulash (Shift — radius 0). Variantlar: Radius, Polyline, Kesish">&#8978; Tutashtirish</button>
      <button type="button" class="tool etool" data-tool="chamfer" title="Faska (CHA) — ikki chiziq burchagini qiya kesish: masofa 1 va masofa 2">&#9698; Faska</button>
      <button type="button" class="tool etool" data-tool="explode" title="Portlatish (X) — polyline'ni alohida chiziqlarga ajratish (tanlangan bo'lsa darhol)">&#10033; Portlatish</button>
      <button type="button" class="tool etool" data-tool="join" title="Birlashtirish (J) — uchlari tutashgan chiziqlar → bitta polyline, bir aylanadagi yoylar → bitta yoy">&#8734; Birlashtirish</button>
      <button type="button" class="tool etool erase" data-tool="erase" title="O'chirish (E) — element ustiga bosing">O'chirish</button>
    </div><div class="chz-rlbl">Tahrir</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool etool" data-tool="dim" title="O'lcham chizig'i — 1-nuqta, 2-nuqta, so'ng o'lcham chizig'i turadigan joyni bosing">&#8596; O'lcham</button>
      <button type="button" class="tool etool" data-tool="dist" title="Masofa (DI) — ikki nuqta orasidagi masofa, ΔX, ΔY va burchak">&#128207; Masofa</button>
      <button type="button" class="tool etool" data-tool="area" title="Yuza (AA) — yopiq kontur (polyline, aylana, tutash chiziq/yoylar) yoki nuqtalar bo'yicha yuza va perimetr">&#9634; Yuza</button>
      <button type="button" class="tool etool" data-tool="divide" title="Bo'lish (DIV) — obyektni teng bo'laklarga bo'lib nuqtalar qo'yish">&#8759; Bo'lish</button>
      <button type="button" class="tool etool" data-tool="measure" title="O'lchab qo'yish (ME) — obyekt bo'ylab har N masofada nuqta qo'yish">&#8285; O'lchab qo'yish</button>
    </div><div class="chz-rlbl">O'lchash</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool" data-dtl="btnUndo" title="Orqaga (Ctrl+Z, U)">&#8630; Orqaga</button>
      <button type="button" class="tool" data-dtl="btnRedo" title="Oldinga (Ctrl+Y)">&#8631; Oldinga</button>
      <button type="button" class="tool" data-dtl="btnClear" title="Butun chizmani tozalash (Orqaga bilan qaytariladi)">&#10005; Tozalash</button>
      <button type="button" class="tool" data-dtl="btnFit" title="Chizma chegarasigacha avtozoom — Ctrl+E (Z)">&#10530; Markazga</button>
    </div><div class="chz-rlbl">Chizma</div></div>
    <span class="chz-cmdwrap" data-dtl="cmdWrap">
      <input class="chz-cmd" data-dtl="cmd" placeholder="Buyruq: chiziq, L, yoy, O…" autocomplete="off" spellcheck="false" title="Buyruqni yozib qidiring (o'zbekcha nomi yoki AutoCAD qisqartmasi) — maydon ustida harf bossangiz o'zi tushadi" />
      <div class="chz-cmdlist" data-dtl="cmdList"></div>
    </span>
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
    <span class="chz-tglbl">Burchak qadami:</span>
    <select class="rowUnit" data-dtl="polarSel" title="Polar (AutoCAD): chiziq shu burchaklarga yopishadi — 5° → 5, 10, 15…; 15° → 15, 30, 45, 60…; 45° → 45, 90, 135, 180, 225… «O'chiq» — erkin burchak">
      <option value="off">o'chiq (erkin)</option>
      <option value="ortho">faqat 90° (orto)</option>
      ${POLAR_INCS.filter((a) => a !== 90).map((a) => '<option value="' + a + '">' + a + '° — ' + [1, 2, 3, 4].map((k) => +(a * k).toFixed(1)).join(', ') + '…</option>').join('')}
      <option value="custom">boshqa…</option>
    </select>
    <span class="chz-tglbl">Uzunlik qadami:</span>
    <select class="rowUnit" data-dtl="pdistSel" title="Sichqoncha bilan chizganda uzunlik shu qadamga yaxlitlanadi (AutoCAD PolarSnap) — 109.96 emas, 110. Yozib kiritilgan qiymat aniq qoladi">
      ${POLAR_DISTS.map((d) => '<option value="' + d + '">' + (d === 0 ? "o'chiq (aniq)" : (d >= 10 ? (d / 10) + ' sm' : d + ' mm')) + '</option>').join('')}
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
  <div class="chz-optrow" data-dtl="optRow" style="display:none"></div>
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
      ${V.zakas ? ZAKAS_PANEL : ''}
      <h3>${V.title}</h3>
      <div class="dtl-name">
        <input data-dtl="nameInput" type="text" placeholder="${V.namePh}" maxlength="60" />
      </div>
      <div class="dtl-libbtns">
        <button type="button" class="dtl-btn on" data-dtl="btnSave" title="Joriy chizmani shu nom bilan kutubxonaga saqlash">&#128190; Saqlash</button>
        <button type="button" class="dtl-btn" data-dtl="btnNew" title="Yangi bo'sh chizma (joriysi Orqaga bilan qaytariladi)">&#10010; Yangi</button>
      </div>
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn" data-dtl="tgLib" title="${V.libLabel} ro'yxatini ko'rsatish / yashirish">
          <span class="chev">&#9656;</span> ${V.libLabel} <span class="dtl-cnt" data-dtl="libCnt"></span>
        </button>
      </div>
      <div class="dtl-lib" data-dtl="libList" style="display:none"></div>
      <div data-dtl="projSect"${V.proj ? '' : ' style="display:none"'}>
      <h3 class="dtl-h3">Proyeksiyalar</h3>
      <label class="dtl-closed"><input type="checkbox" data-dtl="projOn" /> 3 ta proyeksiya: old (V) &middot; ustdan (H) &middot; yon (W)</label>
      <div class="dtl-proj" data-dtl="projBody" style="display:none">
        <div class="dtl-projinfo" data-dtl="projInfo"></div>
        <div class="dtl-projbtns">
          <button type="button" class="dtl-btn" data-dtl="genV" title="Ustdan (H) va yon (W) dan old ko'rinishni hosil qilish">&#8592; Old (V) ni hosil qilish (H + W dan)</button>
          <button type="button" class="dtl-btn" data-dtl="genH" title="Old (V) va yon (W) dan ustdan ko'rinishni hosil qilish">&#8595; Ustdan (H) ni hosil qilish (V + W dan)</button>
          <button type="button" class="dtl-btn" data-dtl="genW" title="Old (V) va ustdan (H) dan yon ko'rinishni hosil qilish">&#8594; Yon (W) ni hosil qilish (V + H dan)</button>
        </div>
        <label class="dtl-closed"><input type="checkbox" data-dtl="projGuides" checked /> Bog'lanish chiziqlari &mdash; magnit</label>
        <label class="dtl-closed"><input type="checkbox" data-dtl="projLinks" checked /> Tanlanganning proyeksiya chiziqlari</label>
        <label class="dtl-gap">Proyeksiyalar oralig'i <input data-dtl="projGap" type="text" inputmode="decimal" data-num="pos" /> <i data-dtl="projGapUnit">sm</i></label>
      </div>
      </div>
      ${V.autoOffset ? OFFSET_PANEL : ''}
      <h3 class="dtl-h3">Hisob <span class="dtl-cnt" data-dtl="stScope"></span></h3>
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
        <span${V.proj ? '' : ' hidden'}>&bull; <b>3 proyeksiya</b> (chizma geometriya): yoqilsa maydon <b>OLD (V)</b> chap-yuqori, <b>USTDAN (H)</b> chap-past, <b>YON (W)</b> o'ng-yuqori kvadrantlarga bo'linadi; 45° buklash chizig'i H↔W chuqurligini bog'laydi. Ikkita proyeksiyani chizing (masalan H da 15 sm, W da 25 sm kesma) — <b>hosil qilish</b> tugmasi uchinchisini (15×25 to'rtburchak, qayirma chiziqlari bilan) chizadi; keyin uni oddiy chizmadek tahrirlang. Chizganda kursor boshqa proyeksiyalardagi uchlarning <b>bog'lanish chiziqlariga</b> yopishadi ("Proyeksiya" maslahati). Burchakdagi kvadratchani sudrab proyeksiyalarni suring.<br></span>
        ${V.autoOffset ? OFFSET_HINT : ''}
        ${ARC_HINT}
        &bull; <b>Ichki buyruqlar qatori</b> (asboblar ostida, AutoCAD variantlari): Chiziq — Yopish / Orqaga / Yoy (davomida); Aylana — Markaz+radius / Markaz+diametr / 2 nuqta / 3 nuqta; Nusxa — Rejim Ko'p/Bitta, Massiv; Ko'chirish, Burish, Masshtab — Nusxa (asli qoladi); Aks — Aslini o'chirish; Offset — Ko'p; <b>Massiv</b> — to'rtburchak (qator × ustun, oraliqlar) yoki qutbiy (markazni bosing, soni, to'ldirish burchagi — gul yaproqlari), jonli ko'rinish, «Bajarish» yoki Enter.<br>
        &bull; <b>Chizish</b>: <b>Ko'pburchak</b> (POL — tomonlar soni; ichki / tashqi / tomon bo'yicha), <b>Halqa</b> (DO — ichki va tashqi diametrli aylanalar), <b>Nuqta</b> (PO). <b>O'zgartirish</b>: <b>Cho'zish</b> (S — ramka ichidagi tugunlar suriladi, chiziqlar cho'ziladi), <b>Tekislash</b> (AL — tanlanganlarni 2 juft nuqta bo'yicha ko'chirish + burish, masshtab ixtiyoriy). <b>Tahrir</b>: <b>Uzish</b> (BR — ikki nuqta orasini olib tashlash yoki nuqtada ikkiga bo'lish), <b>Uzunlik</b> (LEN — delta / foiz / umumiy). <b>O'lchash</b>: <b>Masofa</b> (DI — masofa, ΔX, ΔY, burchak), <b>Yuza</b> (AA — yopiq kontur yoki nuqtalar), <b>Bo'lish</b> (DIV — teng bo'laklarga nuqtalar), <b>O'lchab qo'yish</b> (ME — har N masofada nuqta).<br>
        &bull; <b>Tutashtirish</b> (F, FILLET): birinchi, so'ng ikkinchi obyektni bosing — radiusli yoy bilan ulanadi (chiziq, polyline segmenti, yoy, aylana; bosilgan qismlar saqlanadi, qolgani kesiladi/uzayadi); <b>Shift</b>+bosish yoki radius 0 — burchakka tutashtirish; parallel chiziqlar — yarim aylana; variantlar: <b>Radius</b>, <b>Polyline</b> (butun konturning barcha burchaklari), <b>Kesish</b> Ha/Yo'q. Ikkinchi obyekt ustida natija jonli ko'rinadi. <b>Faska</b> (CHA): masofa 1 va 2 bilan qiya kesish. <b>Portlatish</b> (X): polyline → alohida chiziqlar. <b>Birlashtirish</b> (J): uchlari tutashgan chiziqlar → bitta polyline, bir aylanadagi yoylar → bitta yoy.<br>
        &bull; <b>Kesish</b> (TR) va <b>Uzaytirish</b> (EX) — AutoCAD tez rejimi: chegara tanlanmaydi, chizmadagi boshqa elementlar chegara. Kesishda olib tashlanadigan qismga bosing — eng yaqin kesishmalargacha o'chadi (kursor ostida qizil ko'rinadi; yopiq kontur ochiq polyline bo'lib qoladi, aylana yoyga aylanadi). Uzaytirishda chiziq/yoy uchiga yaqin bosing — yo'nalishidagi (yoy — aylanasi bo'ylab) eng yaqin elementgacha cho'ziladi.<br>
        &bull; <b>Saqlash</b> — nomlab kutubxonaga (${V.saveEx}...); ro'yxatdan bosib qayta ochasiz. <b>DXF</b> — lazer/AutoCAD (mm); <b>Rasm</b> — PNG.
      </div>
    </div>
  </div>
`;
}

export function mountDetal(root, opts) {
  const V = VARIANTS[opts && opts.variant] || VARIANTS.detal;
  const zakasKey = String((opts && opts.zakasKey) || '_');   // Gul rejimi: zakas identifikatori — gullar ro'yxati shunga bog'lanadi
  root.classList.add('chz', 'dtl', V.cls);
  root.innerHTML = buildTemplate(V);
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
    proj: { on: false, sepX: 300, sepY: 300, gap: 100, guides: true, links: true },   // 3 proyeksiya (V old · H ustdan · W yon)
    autoOff: AUTO_OFF_DEF, // Gul rejimi: yopiq kontur ichkariga avtomatik ofset masofasi (mm)
    autoEnts: [],          // hisoblangan avto-ofset konturlari (id'siz, chizmaga kirmaydi — jonli)
    lastTool: 'pline',     // Enter/Tab bilan takrorlanadigan oxirgi asbob (AutoCAD)
    arcMethod: '3p',       // yoy chizish usuli (oxirgi tanlangan, ARC_METHODS)
    cont: null,            // «Davom ettirish» uchun oxirgi chiziq/yoy uchi {x, y, ang — tangens yo'nalishi}
    zakas: { active: 0, items: [] },   // Gul rejimi: shu zakasdagi gullar [{id,name,ents,autoOff,t}], faoli = ishchi holat
    name: '',
    lib: [],               // saqlangan detallar [{id,name,ents,t}]
    cursor: { x: 0, y: 0 },   // world (snap/cheklov qo'llangan)
    cursorS: null,            // ekran {sx,sy}
    snapHit: null,            // {x,y,kind} — yopishgan nuqta (belgi uchun)
    box: null,                // dinamik kiritish qutisi konfiguratsiyasi
    grip: null,               // sudralayotgan grip {ent, kind, idx}
    hist: [], redo: [],
    pointerIn: false,      // kursor chizma (asboblar, maydon, panel) ustidami — klaviatura buyruqlari shu holatda tutiladi
    // Asbob variantlari (AutoCAD buyruq variantlari — pastdagi ichki buyruqlar qatori)
    opt: { circleMode: 'cr', copyMulti: true, moveCopy: false, rotateCopy: false, mirrorErase: false, scaleCopy: false, offsetMulti: false,
      filletR: 10, filletPoly: false, filletTrim: true, chamD1: 10, chamD2: 10, chamPoly: false, chamTrim: true,
      polyN: 6, polyMode: 'in', donutIn: 10, donutOut: 20, breakMode: '2p', lenMode: 'delta', lenDelta: 10, lenPct: 110, lenTotal: 1000,
      divN: 5, measLen: 100, areaMode: 'obj', alignScale: false,
      arr: { kind: 'polar', rows: 2, cols: 2, dr: 200, dc: 200, n: 6, fill: 360 } },
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
  // Variantlar qatoridagi «Burchak qadami» / «Uzunlik qadami» — holat panelidagi POLAR bilan bir sozlama
  function syncPolarSel() {
    const s = state.snapSet, ps = q('polarSel'), dsel = q('pdistSel');
    if (ps) {
      let v = s.ortho ? 'ortho' : (!s.polar ? 'off' : String(s.polarInc));
      if (v !== 'off' && v !== 'ortho' && ![...ps.options].some((o) => o.value === v)) {
        const o = document.createElement('option'); o.value = v; o.textContent = v + '° — ' + [1, 2, 3, 4].map((k) => +(s.polarInc * k).toFixed(1)).join(', ') + '…';
        ps.insertBefore(o, ps.querySelector('option[value="custom"]'));
      }
      if (s.polar && !s.ortho && s.polarInc === 90) v = 'ortho';
      ps.value = v;
    }
    if (dsel) dsel.value = String(s.polarDist || 0);
  }

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
    if (e.type === 'arc') { const o = [arcStart(e), arcEnd(e)]; for (const qd of [0, 90, 180, 270]) if (angInArc(e, qd)) o.push(arcPt(e, qd)); return o; }   // uchlari + kvadrant chekkalari (gabarit, proyeksiya, tanlash)
    if (e.type === 'circle') return [{ x: e.cx - e.r, y: e.cy }, { x: e.cx + e.r, y: e.cy }, { x: e.cx, y: e.cy - e.r }, { x: e.cx, y: e.cy + e.r }];
    if (e.type === 'dim') return [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
    if (e.type === 'point') return [{ x: e.x, y: e.y }];
    return [];
  }
  function mapEnt(e, fn, rFactor) {
    if (e.type === 'point') { const q2 = fn({ x: e.x, y: e.y }); e.x = q2.x; e.y = q2.y; return; }
    if (e.type === 'pline') e.pts = e.pts.map(fn);
    else if (e.type === 'arc') { const a = arcMap(e, fn); if (a) Object.assign(e, a); }   // aks ettirishda yo'nalish ham tuzatiladi
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
    if (e.type === 'arc') return { d: distToArc(e, { x: wx, y: wy }), seg: -1 };
    if (e.type === 'point') return { d: Math.hypot(wx - e.x, wy - e.y), seg: -1 };
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
  // Elementlar chegarasi (withDraft — chizilayotgan ham; withFrames — proyeksiya ajratgichlari ham)
  function boundsOf(ents, withDraft, withFrames) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); };
    for (const e of ents) {
      if (e.type === 'arc') { const ab = arcBounds(e); add({ x: ab.minX, y: ab.minY }); add({ x: ab.maxX, y: ab.maxY }); continue; }
      for (const p of entVerts(e)) add(p);
      if (e.type === 'dim') { const n = dimNormal(e); add({ x: e.x1 + n.x * e.off, y: e.y1 + n.y * e.off }); add({ x: e.x2 + n.x * e.off, y: e.y2 + n.y * e.off }); }
    }
    if (withDraft && state.draft && state.draft.pts) for (const p of state.draft.pts) add(p);
    if (withFrames && state.proj.on) { add({ x: state.proj.sepX, y: state.proj.sepY }); add({ x: state.proj.sepX + state.proj.gap, y: state.proj.sepY + state.proj.gap }); }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }
  function bounds(withFrames) { return boundsOf(state.ents, true, withFrames); }

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
    if (d && d.tool === 'arc') for (const p of d.pts) nodes.push({ x: p.x, y: p.y, eid: -1 });
    return buildGeom(state.ents, { skip: (e) => skipEid != null && e.id === skipEid, nodes, segs });
  }
  // Ekran nuqtasini world nuqtaga: OSNAP > kuzatish kesishmasi > polar/orto > kuzatish > to'r > xom
  function resolveCursor(sx, sy, from, skipEid) {
    const geom = snapGeom(skipEid);
    const cur = screenToWorld(sx, sy);
    const res = resolveSnap({ geom, cur, scale: state.scale, settings: state.snapSet, from, skipEid, acquired: state.track.acq, gridStep: gridStep(), guides: projGuides(cur) });
    state.snapRes = res;
    state.snapHit = res.snap ? { x: res.snap.x, y: res.snap.y, kind: res.snap.kind } : null;
    updateAcquire(state.track, res, Date.now(), geom, state.snapSet);
    return { x: res.x, y: res.y };
  }
  // Nuqta belgilangach olingan (OTRACK) nuqtalar tozalanadi — AutoCAD'dek
  function clearAcq() { state.track.acq = []; state.track.hover = null; }

  /* ---------------- 3 PROYEKSIYA (chizma geometriya: V old · H ustdan · W yon) ----------------
     Maydon ikki ajratgich (sepX, sepY) bilan 4 kvadrantga bo'linadi (Monge usuli):
       V — chap-yuqori (x, z): x o'ngga, z tepaga (world y manfiy)
       H — chap-past (x, y): x o'ngga, chuqurlik y PASTGA; chuqurlik 0 → world y = hy
       W — o'ng-yuqori (y, z): chuqurlik y O'NGGA; chuqurlik 0 → world x = wx
     hy = sepY + gap/2, wx = sepX + gap/2 — 45° buklash chizig'i (sepX, sepY) dan o'tadi, shuning
     uchun H dagi chuqurlik W dagiga aynan mos keladi. V↔H umumiy x, V↔W umumiy z (world y).
     Element qaysi proyeksiyaga tegishli ekani markazi turgan kvadrantdan aniqlanadi.
     Uchinchi proyeksiya qolgan ikkitasining uchlaridan hosil qilinadi: kontur — ekstentlar
     to'rtburchagi, ichki chiziqlar — boshqa proyeksiyalardagi ORALIQ uch koordinatalari
     (qayirma/bukilish chiziqlari). Natija oddiy chiziqlar — grip, jadval bilan tahrirlanadi. */
  const VIEW_NOMI = { V: 'OLD (V)', H: 'USTDAN (H)', W: 'YON (W)' };
  const PROJ_DEF = { on: false, sepX: 300, sepY: 300, gap: 100, guides: true, links: true };
  function sanitizeProj(o) {
    const p = Object.assign({}, PROJ_DEF);
    if (!o || typeof o !== 'object') return p;
    p.on = !!o.on; p.guides = o.guides !== false; p.links = o.links !== false;
    if (Number.isFinite(o.sepX)) p.sepX = o.sepX;
    if (Number.isFinite(o.sepY)) p.sepY = o.sepY;
    if (Number.isFinite(o.gap) && o.gap >= 0) p.gap = o.gap;
    return p;
  }
  function projP() { const p = state.proj; return { sepX: p.sepX, sepY: p.sepY, hy: p.sepY + p.gap / 2, wx: p.sepX + p.gap / 2 }; }
  function viewAt(pt) {
    if (!state.proj.on) return null;
    const P = projP();
    if (pt.x < P.sepX) return pt.y < P.sepY ? 'V' : 'H';
    return pt.y < P.sepY ? 'W' : null;
  }
  function entCenter(e) {
    const vs = entVerts(e); if (!vs.length) return { x: 0, y: 0 };
    let x = 0, y = 0; for (const p of vs) { x += p.x; y += p.y; }
    return { x: x / vs.length, y: y / vs.length };
  }
  function viewOf(e) { return viewAt(entCenter(e)); }
  function vertsOf(view) { const out = []; for (const e of state.ents) if (viewOf(e) === view) for (const p of entVerts(e)) out.push(p); return out; }
  function projCounts() { const c = { V: 0, H: 0, W: 0 }; for (const e of state.ents) { const v = viewOf(e); if (v) c[v]++; } return c; }
  // Boshqa proyeksiyalardagi uchlardan BOG'LANISH chiziqlari — magnit (osnap guides)
  function projGuides(cur) {
    if (!state.proj.on || !state.proj.guides) return [];
    const view = viewAt(cur); if (!view) return [];
    const P = projP(), out = [], seen = new Set();
    const add = (x, y, ang) => { const k = ang + ':' + Math.round((ang === 90 ? x : y) * 100); if (seen.has(k)) return; seen.add(k); out.push({ x, y, ang }); };
    for (const e of state.ents) {
      const ev = viewOf(e); if (!ev || ev === view) continue;
      for (const p of entVerts(e)) {
        if (view === 'V') { if (ev === 'H') add(p.x, 0, 90); else add(0, p.y, 0); }
        else if (view === 'H') { if (ev === 'V') add(p.x, 0, 90); else add(0, P.hy + (p.x - P.wx), 0); }
        else { if (ev === 'V') add(0, p.y, 0); else add(P.wx + (p.y - P.hy), 0, 90); }
      }
    }
    return out;
  }
  function distinctVals(arr) {
    const s = arr.slice().sort((a, b) => a - b), out = [];
    for (const v of s) if (!out.length || v - out[out.length - 1] > 0.05) out.push(v);
    return out;
  }
  // Uchinchi proyeksiyani qolgan ikkitasidan hosil qilish (target: 'V'|'H'|'W')
  function genView(target) {
    const P = projP();
    let xs, ys, srcA, srcB;
    if (target === 'V') { srcA = 'H'; srcB = 'W'; xs = vertsOf('H').map((p) => p.x); ys = vertsOf('W').map((p) => p.y); }
    else if (target === 'H') { srcA = 'V'; srcB = 'W'; xs = vertsOf('V').map((p) => p.x); ys = vertsOf('W').map((p) => P.hy + (p.x - P.wx)); }
    else { srcA = 'H'; srcB = 'V'; xs = vertsOf('H').map((p) => P.wx + (p.y - P.hy)); ys = vertsOf('V').map((p) => p.y); }
    const X = distinctVals(xs), Y = distinctVals(ys);
    if (!X.length || !Y.length || (X.length < 2 && Y.length < 2)) { setInfo(VIEW_NOMI[target] + ' uchun ' + VIEW_NOMI[srcA] + ' va ' + VIEW_NOMI[srcB] + " da chiziqlar bo'lishi kerak (kamida bittasida kesma)"); return false; }
    const x0 = X[0], x1 = X[X.length - 1], y0 = Y[0], y1 = Y[Y.length - 1];
    cancelDraft(false);
    pushHistory();
    state.ents = state.ents.filter((e) => viewOf(e) !== target);
    const mk = (pts, closed) => { const e = newEnt('pline', { pts, closed }); state.ents.push(e); return e; };
    let outline, inner = 0, msg;
    if (X.length < 2 || Y.length < 2) {
      // Tekis detal (yassi list) — bu proyeksiyada faqat QIRRASI ko'rinadi: kesma
      outline = mk([{ x: x0, y: y0 }, { x: x1, y: y1 }], false);
      msg = VIEW_NOMI[target] + ' hosil qilindi: ' + fmtLen(Math.hypot(x1 - x0, y1 - y0)) + ' kesma (detal bu tomondan qirrasi bilan ko\'rinadi)';
    } else {
      outline = mk([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], true);
      for (const x of X.slice(1, -1)) { mk([{ x, y: y0 }, { x, y: y1 }], false); inner++; }
      for (const y of Y.slice(1, -1)) { mk([{ x: x0, y }, { x: x1, y }], false); inner++; }
      msg = VIEW_NOMI[target] + ' hosil qilindi: ' + fmtLen(x1 - x0) + ' × ' + fmtLen(y1 - y0) + (inner ? ', ichki chiziqlar: ' + inner : '') + ' — endi tahrirlang (grip, jadval, chiziq asboblari)';
    }
    state.sel.clear(); state.sel.add(outline.id);
    afterChange();
    setInfo(msg);
    return true;
  }
  function clearView(v) {
    if (!state.ents.some((e) => viewOf(e) === v)) return;
    cancelDraft(false); pushHistory();
    state.ents = state.ents.filter((e) => viewOf(e) !== v);
    state.sel.clear(); afterChange();
    setInfo(VIEW_NOMI[v] + ' tozalandi');
  }
  function setProjOn(on) {
    cancelDraft(false);
    if (on && !state.proj.on) {
      // Mavjud chizma OLD (V) bo'lib qoladi — ajratgichlar uning o'ng-pastiga qo'yiladi
      const b = boundsOf(state.ents, false, false);
      if (b) { state.proj.sepX = Math.max(b.maxX + 60, 100); state.proj.sepY = Math.max(b.maxY + 60, 100); }
    }
    state.proj.on = !!on;
    afterChange(); centerView();
    setInfo(on ? "3 proyeksiya: chap-yuqori OLD (V), chap-past USTDAN (H), o'ng-yuqori YON (W). Ikkitasini chizing, uchinchisini tugma bilan hosil qiling. Burchakdagi kvadratchani sudrab proyeksiyalarni suring" : 'Oddiy rejim');
  }
  // Oraliq o'zgarsa H/W elementlari chuqurlik saqlangan holda suriladi (hy, wx = ajratgich + oraliq/2)
  function setProjGap(gMm) {
    const g = Math.max(0, gMm), d = (g - state.proj.gap) / 2;
    if (Math.abs(d) < 1e-9) return;
    pushHistory();
    const views = state.ents.map((e) => viewOf(e));
    state.ents.forEach((e, i) => { if (views[i] === 'H') mapEnt(e, (p) => ({ x: p.x, y: p.y + d })); else if (views[i] === 'W') mapEnt(e, (p) => ({ x: p.x + d, y: p.y })); });
    state.proj.gap = g;
    afterChange();
  }
  // Ajratgich burchagi (buklash chizig'i boshi) sudralsa — H pastga/yuqoriga, W o'ngga/chapga birga
  function moveProjCorner(x, y) {
    const dx = x - state.proj.sepX, dy = y - state.proj.sepY;
    if (!dx && !dy) return;
    const views = state.ents.map((e) => viewOf(e));
    state.ents.forEach((e, i) => { if (views[i] === 'H') mapEnt(e, (p) => ({ x: p.x, y: p.y + dy })); else if (views[i] === 'W') mapEnt(e, (p) => ({ x: p.x + dx, y: p.y })); });
    state.proj.sepX = x; state.proj.sepY = y;
  }
  function genClick(target, btn) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    const c = projCounts();
    if (c[target] && btn.dataset.arm !== '1') {
      btn.dataset.arm = '1'; btn.classList.add('arm');
      btn.textContent = VIEW_NOMI[target] + ' bor — almashtirish? (yana bosing)';
      setTimeout(() => { if (btn.isConnected) { btn.dataset.arm = ''; btn.classList.remove('arm'); btn.textContent = btn.dataset.label; } }, 3500);
      return;
    }
    btn.dataset.arm = ''; btn.classList.remove('arm'); btn.textContent = btn.dataset.label;
    genView(target);
  }
  function syncProjUI() {
    const p = state.proj;
    q('projOn').checked = p.on;
    q('projBody').style.display = p.on ? '' : 'none';
    q('projGuides').checked = p.guides; q('projLinks').checked = p.links;
    if (document.activeElement !== q('projGap')) q('projGap').value = fmtNum(p.gap / U(), 2);
    q('projGapUnit').textContent = UNIT_LABEL[state.unit];
    const c = projCounts();
    q('projInfo').innerHTML = ['V', 'H', 'W'].map((v) => '<span><b>' + VIEW_NOMI[v] + '</b>: ' + c[v] + (c[v] ? ' <button type="button" data-act="clear" data-view="' + v + '" title="' + VIEW_NOMI[v] + ' ni tozalash">&#10005;</button>' : '') + '</span>').join('');
    q('genV').disabled = !(c.H && c.W); q('genH').disabled = !(c.V && c.W); q('genW').disabled = !(c.V && c.H);
  }
  /* ---------------- AVTOMATIK ICHKI OFSET (Gul rejimi) ----------------
     Yopiq zanjirlar (uchlari tutashgan chiziq/yoylar — xuddi join qilingandek) va aylanalar uchun
     state.autoOff (mm) masofada ichkariga parallel kontur hisoblanadi (state.autoEnts, id'siz);
     har o'zgarishda (afterChange) qayta hisoblanadi — jonli. */
  function sanitizeAutoOff(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(AUTO_OFF_MAX, n)) : AUTO_OFF_DEF; }
  function setAutoOff(mm) {
    state.autoOff = sanitizeAutoOff(mm);
    syncOffUI(true); computeAutoOff(); saveLS(); render();
  }
  // force — maydon fokusda bo'lsa ham qiymat yoziladi (o'zgartirishdan keyin)
  function syncOffUI(force) {
    if (!V.autoOffset) return;
    const inp = q('autoOff');
    if (force || document.activeElement !== inp) inp.value = fmtNum(state.autoOff / U(), 2);
    q('autoOffUnit').textContent = UNIT_LABEL[state.unit];
    q('offMinus').disabled = state.autoOff <= 0;
  }
  function computeAutoOff() {
    state.autoEnts = [];
    if (!V.autoOffset || !(state.autoOff > 0)) return;
    const D = state.autoOff;
    for (const ch of buildChains(state.ents)) {
      if (!ch.closed) continue;
      const ps = offsetChainInward(ch, D);
      if (ps) state.autoEnts.push(...piecesToEnts(ps, true));
    }
    for (const e of state.ents) if (e.type === 'circle' && e.r - D > 1e-6) state.autoEnts.push({ type: 'circle', cx: e.cx, cy: e.cy, r: e.r - D });
  }
  // Joriy asbob uchun cheklov tayanch nuqtasi (rubber-band boshi)
  function anchorPoint() {
    const d = state.draft;
    if (!d) return null;
    if (d.tool === 'pline') return d.pts[d.pts.length - 1];
    if (d.tool === 'arc') return arcPrev(d);
    if (d.tool === 'dim') return d.p2 ? null : (d.p1 || null);
    if (d.tool === 'circle') return d.c || d.p2 || d.p1 || null;
    if (d.tool === 'array') return d.center || null;
    if (d.tool === 'polygon') return d.c || d.p1 || null;
    if (d.tool === 'stretch') return d.base || null;
    if (d.tool === 'align') return d.pts.length % 2 === 1 ? d.pts[d.pts.length - 1] : null;
    if (d.tool === 'break' || d.tool === 'dist') return d.p1 || null;
    if (d.tool === 'area') return d.pts.length ? d.pts[d.pts.length - 1] : null;
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
    in1.value = (cfg.f1 && cfg.f1.val != null) ? String(cfg.f1.val) : '';
    in2.value = (cfg.f2 && cfg.f2.val != null) ? String(cfg.f2.val) : '';
    if (!state.snapSet.dyn) { inputBox.classList.remove('show'); return; }   // DYN o'chiq — faqat sichqoncha bilan (maydonlar tozalangan)
    inputBox.classList.add('show');
    positionBox();
    const first = cfg.f1 ? in1 : in2;
    first.focus(); first.select();
  }
  function syncBoxLabels() {
    const b = state.box; if (!b) return;
    q('f1Wrap').style.display = b.f1 ? '' : 'none';
    q('f2Wrap').style.display = b.f2 ? '' : 'none';
    const unitTxt = (f) => (f.unit === 'len' ? UNIT_LABEL[state.unit] : (f.unit === 'ang' ? '°' : '×'));
    if (b.f1) { q('f1Label').textContent = b.f1.label; q('f1Unit').textContent = unitTxt(b.f1); in1.dataset.num = (b.f1.unit === 'ang' || b.f1.neg) ? 'neg' : 'pos'; }
    if (b.f2) { q('f2Label').textContent = b.f2.label; q('f2Unit').textContent = unitTxt(b.f2); in2.dataset.num = (b.f2.unit === 'ang' || b.f2.neg) ? 'neg' : 'pos'; }
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
      select: "Tanlash: element ustiga bosing — har bosish qo'shiladi (AutoCAD); Shift+bosish — olib tashlash; bo'sh joy yoki Esc — bo'shatish; ramka torting; chiziqqa 2 marta bosing — uzunlik/burchak tahriri",
      pline: "Chiziq: boshlang'ich nuqtani bosing (yoki «0,0 dan boshlash»), so'ng uzunlik + burchak yozib Enter",
      rect: "To'rtburchak: birinchi burchakni bosing",
      circle: state.opt.circleMode === '2p' ? 'Aylana (2 nuqta): diametrning 1-uchini bosing' : (state.opt.circleMode === '3p' ? 'Aylana (3 nuqta): 1-nuqtani bosing' : 'Aylana (' + CIRCLE_MODES[state.opt.circleMode] + '): markazni bosing'),
      array: state.opt.arr.kind === 'polar' ? "Massiv (qutbiy): markazni bosing — soni va to'ldirish burchagi pastdagi qatorda, so'ng «Bajarish»" : "Massiv (to'rtburchak): qator/ustun soni va oraliqlarni pastdagi qatorda yozib «Bajarish» (yoki maydonni bosing)",
      arc: arcHint0(),
      dim: "O'lcham: 1-nuqtani bosing",
      move: "Ko'chirish: tayanch nuqtani bosing",
      copy: 'Nusxa: tayanch nuqtani bosing',
      rotate: 'Burish: tayanch nuqtani bosing',
      mirror: "Aks: o'qning 1-nuqtasini bosing",
      scale: 'Masshtab: tayanch nuqtani bosing',
      offset: V.joinOffset ? 'Offset: chiziq, yoy yoki aylanani bosing — uchlari tutashgan elementlar bitta kontur (join) sifatida' : 'Offset: chiziq yoki aylanani bosing',
      trim: "Kesish: olib tashlanadigan qismga bosing — eng yaqin kesishmalargacha o'chadi (chegara — chizmadagi boshqa elementlar)",
      extend: "Uzaytirish: chiziq yoki yoyning uchiga yaqin bosing — yo'nalishidagi eng yaqin elementgacha cho'ziladi",
      fillet: state.opt.filletPoly ? "Tutashtirish (Polyline): polyline'ni bosing — barcha burchaklari R " + fmtLen(state.opt.filletR) + ' bilan yumaloqlanadi' : 'Tutashtirish (R ' + fmtLen(state.opt.filletR) + '): birinchi obyektni (chiziq, yoy, aylana) bosing',
      chamfer: state.opt.chamPoly ? "Faska (Polyline): polyline'ni bosing — barcha burchaklari kesiladi" : 'Faska (' + fmtLen(state.opt.chamD1) + ' × ' + fmtLen(state.opt.chamD2) + '): birinchi chiziqni bosing',
      explode: "Portlatish: polyline'ni bosing — alohida chiziqlarga ajraladi",
      join: "Birlashtirish: uchlari tutashgan chiziqlarni (yoki bir aylanadagi yoylarni) bosib tanlang, so'ng Enter",
      erase: "O'chirish: element ustiga bosing",
      polygon: state.opt.polyMode === 'edge' ? "Ko'pburchak (" + state.opt.polyN + ' tomon, tomon bo\'yicha): tomonning 1-uchini bosing' : "Ko'pburchak (" + state.opt.polyN + ' tomon, ' + (state.opt.polyMode === 'out' ? 'tashqi' : 'ichki') + '): markazni bosing',
      donut: 'Halqa (D ' + fmtLen(state.opt.donutOut) + ' / d ' + fmtLen(state.opt.donutIn) + '): markazni bosing',
      point: "Nuqta: joyini bosing (magnit: Tugun — NOD)",
      stretch: "Cho'zish: ramkaning 1-burchagini bosing — ramka ichidagi tugunlar suriladi",
      align: state.sel.size ? 'Tekislash: 1-manba nuqtani bosing' : "Tekislash: avval obyektlarni «Tanlash» bilan belgilang",
      break: state.opt.breakMode === '1p' ? "Uzish (nuqtada): obyektni uziladigan joyidan bosing" : "Uzish: obyektni 1-nuqtadan bosing, so'ng 2-nuqtani — oralig'i olib tashlanadi",
      lengthen: "Uzunlik (" + (state.opt.lenMode === 'percent' ? state.opt.lenPct + '%' : (state.opt.lenMode === 'total' ? 'umumiy ' + fmtLen(state.opt.lenTotal) : 'delta ' + fmtLen(state.opt.lenDelta))) + "): chiziq/yoyning o'zgaradigan uchiga yaqin bosing",
      dist: "Masofa: 1-nuqtani bosing",
      area: state.opt.areaMode === 'pts' ? "Yuza (nuqtalar): burchaklarni bosing, Enter — hisoblash" : 'Yuza: yopiq kontur (polyline, aylana yoki tutash chiziq/yoylar) ustiga bosing',
      divide: "Bo'lish (" + state.opt.divN + " bo'lak): obyektni bosing",
      measure: "O'lchab qo'yish (har " + fmtLen(state.opt.measLen) + "): obyektni boshlanadigan uchiga yaqin bosing",
    };
    return m[t] || '';
  }
  const MODIFY = ['move', 'copy', 'rotate', 'mirror', 'scale'];
  function setTool(t) {
    if (!TOOLS.includes(t)) return;
    cancelDraft(true);
    state.tool = t;
    if (t !== 'select') state.lastTool = t;   // Enter/Tab bilan takrorlash uchun
    state.measureShow = null;
    if ((t === 'explode' || t === 'join') && state.sel.size) {   // oldin tanlangan bo'lsa — darhol bajariladi
      const list = selectedEnts(); state.tool = 'select'; syncButtons();
      if (t === 'explode') explodeEnts(list); else joinSelected(list);
      return;
    }
    if ((MODIFY.includes(t) || t === 'array') && !state.sel.size) setInfo("Avval element(lar)ni «Tanlash» asbobi bilan belgilang, so'ng " + (t === 'array' ? 'massiv parametrlarini bering' : 'tayanch nuqtani bosing'));
    else setInfo(toolHint(t));
    if (t === 'arc') arcAutoStart();
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
    setInfo(toolHint(state.tool)); render(); renderOptRow();
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
      const n = pts.length;
      state.cont = { x: pts[n - 1].x, y: pts[n - 1].y, ang: vecAng(pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y) };
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

  /* ---- Aylana: Markaz+radius (cr) · Markaz+diametr (dia) · 2 nuqta (2p) · 3 nuqta (3p) — variantlar qatorida ---- */
  function circleR() {
    const d = state.draft, [v] = boxVals();
    if (state.opt.circleMode === 'dia') return v > 0 ? v * U() / 2 : dist(d.c, state.cursor);
    return v > 0 ? v * U() : dist(d.c, state.cursor);
  }
  // Rejimga qarab jonli / yakuniy aylana {cx, cy, r} yoki null
  function circleFrom(d, cur) {
    const m = state.opt.circleMode;
    if (m === '2p') { if (!d.p1) return null; return { cx: (d.p1.x + cur.x) / 2, cy: (d.p1.y + cur.y) / 2, r: dist(d.p1, cur) / 2 }; }
    if (m === '3p') { if (!d.p1 || !d.p2) return null; const a = arcFrom3(d.p1, d.p2, cur); return a ? { cx: a.cx, cy: a.cy, r: a.r } : null; }
    if (!d.c) return null;
    return { cx: d.c.x, cy: d.c.y, r: circleR() };
  }
  function circleClick(w) {
    const d = state.draft, m = state.opt.circleMode;
    if (m === '2p' || m === '3p') {
      if (!d) { state.draft = { tool: 'circle', p1: { x: w.x, y: w.y } }; setInfo(m === '2p' ? 'Aylana (2 nuqta): diametrning 2-uchini bosing' : 'Aylana (3 nuqta): 2-nuqtani bosing'); render(); return; }
      if (m === '3p' && !d.p2) { if (dist(d.p1, w) < 1e-6) return; d.p2 = { x: w.x, y: w.y }; setInfo('Aylana (3 nuqta): 3-nuqtani bosing'); render(); return; }
      const c = circleFrom(d, w);
      if (!c || !(c.r > 1e-6)) { setInfo("Aylana hosil bo'lmadi — nuqtalar bir chiziqda yoki bir xil"); return; }
      makeCircle({ x: c.cx, y: c.cy }, c.r); return;
    }
    const dia = m === 'dia';
    if (!d) {
      state.draft = { tool: 'circle', c: { x: w.x, y: w.y } };
      openBox({ anchor: w, f1: { label: dia ? 'Diametr' : 'Radius', unit: 'len' }, f2: null,
        onCommit: (v) => { if (v > 0) makeCircle(state.draft.c, dia ? v * U() / 2 : v * U()); else setInfo((dia ? 'Diametr' : 'Radius') + ' yozing yoki aylana ustidagi nuqtani bosing'); } });
      setInfo((dia ? 'Diametr' : 'Radius') + ' yozib Enter yoki aylana ustidagi nuqtani bosing'); render(); return;
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

  /* ---- Yoy (AutoCAD «Arc» usullari) — geometriya: src/lib/arcGeom.js ----
     draft = { tool:'arc', method, pts:[...] }. Nuqta qadamida oldingi nuqtadan masofa + burchak
     yozish mumkin (quti); oxirgi qiymat qadamida (burchak / vatar / radius / yo'nalish) qiymat
     yoziladi yoki sichqoncha bilan beriladi. Yoy har doim CCW saqlanadi (arcGeom.js). */
  function arcDef() { return ARC_BY_KEY[state.arcMethod] || ARC_METHODS[0]; }
  function arcHint0() {
    const M = arcDef();
    if (M.key === 'cont') return contValid() ? "Yoy (Davom ettirish): oxirgi nuqtani bosing — oldingi chiziq/yoy uchidan tangens bo'ylab" : 'Yoy (Davom ettirish): avval chiziq yoki yoy chizing';
    return 'Yoy (' + M.nomi + '): ' + M.steps[0][1].toLowerCase() + 'ni bosing';
  }
  // state.cont hali mavjud element uchimi (o'chirilgan / Orqaga / Tozalash / boshqa chizma bo'lsa — yo'q)
  function contValid() {
    const c = state.cont; if (!c) return false;
    const at = (p) => Math.abs(p.x - c.x) < 1e-6 && Math.abs(p.y - c.y) < 1e-6;
    const ok = state.ents.some((e) => (e.type === 'pline' && e.pts.length >= 2 && (at(e.pts[e.pts.length - 1]) || at(e.pts[0]))) || (e.type === 'arc' && (at(arcStart(e)) || at(arcEnd(e)))));
    if (!ok) state.cont = null;
    return ok;
  }
  // «Davom ettirish» tanlanganda draft darhol boshlanadi — tangens yoyning jonli ko'rinishi va masofa + burchak qutisi uchun
  function arcAutoStart() {
    if (state.draft || state.tool !== 'arc' || arcDef().key !== 'cont' || !contValid()) return;
    state.draft = { tool: 'arc', method: 'cont', pts: [] };
    arcOpenBox();
  }
  // Oldingi nuqta (masofa/burchak va rubber-band uchun); Davom ettirishda — oldingi element uchi
  function arcPrev(d) { return d.pts.length ? d.pts[d.pts.length - 1] : (d.method === 'cont' && contValid() ? { x: state.cont.x, y: state.cont.y } : null); }
  // Nuqtalar (usul tartibida) + oxirgi qiymat (yoki kursor) → yoy {cx,cy,r,a0,a1,ccw} yoki null
  function arcBuild(d, param, cur) {
    const M = ARC_BY_KEY[d.method], p = d.pts, last = M.steps[M.steps.length - 1];
    const pt = (i) => (i < p.length ? p[i] : (i === p.length ? cur : null));
    if (M.key === 'cont') return contValid() ? arcContinue(state.cont, pt(0)) : null;
    if (M.key === '3p') return arcFrom3(pt(0), pt(1), pt(2));
    const isCS = M.key[0] === 'c';
    const s = isCS ? pt(1) : pt(0), c = isCS ? pt(0) : pt(1);   // sea/sed/ser da c — OXIRGI nuqta
    if (!s || !c) return null;
    if (M.key === 'sce' || M.key === 'cse') return arcSCE(s, c, pt(2));
    if (last[0] === 'pt' || p.length < M.steps.length - 1) return null;
    if (M.key === 'sca' || M.key === 'csa') return arcSCA(s, c, param != null ? param : norm360(vecAng(cur.x - c.x, cur.y - c.y) - vecAng(s.x - c.x, s.y - c.y)));
    if (M.key === 'scl' || M.key === 'csl') return arcSCL(s, c, param != null ? param * U() : Math.min(dist(cur, s), 2 * dist(s, c)));
    if (M.key === 'sea') return param != null ? arcSEA(s, c, param) : arcFrom3(s, cur, c);
    if (M.key === 'sed') return arcSED(s, c, param != null ? param : vecAng(cur.x - s.x, cur.y - s.y));
    if (M.key === 'ser') return arcSER(s, c, param != null ? param * U() : dist(cur, c));
    return null;
  }
  // Nuqta qadamida qutidagi masofa/burchakdan (bo'lmasa kursordan) keyingi nuqta
  function arcPendingPt() {
    const d = state.draft, prev = arcPrev(d), c = state.cursor;
    if (!prev || !state.box) return c;
    const [L, ang] = boxVals();
    if (L == null && ang == null) return c;
    const A = ang == null ? (dist(prev, c) > 1e-6 ? vecAng(c.x - prev.x, c.y - prev.y) : 0) : norm360(ang);
    const len = L == null ? dist(prev, c) : L * U();
    const v = dirVec(A);
    return { x: prev.x + v.dx * len, y: prev.y + v.dy * len };
  }
  function arcOpenBox() {
    const d = state.draft, M = ARC_BY_KEY[d.method], step = M.steps[d.pts.length], prev = arcPrev(d);
    if (!step || !prev) { closeBox(); return; }
    if (step[0] === 'pt') {
      openBox({ anchor: prev, f1: { label: 'Masofa', unit: 'len' }, f2: { label: 'Burchak', unit: 'ang' },
        onCommit: (L, ang) => {
          if (L == null && ang == null) { setInfo(step[1] + 'ni bosing yoki masofa + burchak yozing'); return; }
          if (L != null && !(L > 0)) { setInfo("Masofa 0 dan katta bo'lsin"); return; }
          arcPoint(arcPendingPt());
        } });
      setInfo('Yoy (' + M.nomi + '): ' + step[1].toLowerCase() + 'ni bosing yoki oldingi nuqtadan masofa + burchak yozib Enter');
    } else {
      const neg = step[0] === 'ang' ? " (manfiy — soat mili bo'yicha)" : ' (manfiy — katta yoy)';
      openBox({ anchor: prev, f1: { label: step[1], unit: step[0], neg: true }, f2: null,   // manfiy — soat mili bo'yicha / katta yoy
        onCommit: (v) => { if (v == null) { setInfo(step[1] + ' yozing yoki sichqoncha bilan bosing'); return; } finishArc(v); } });
      setInfo('Yoy (' + M.nomi + '): ' + step[1].toLowerCase() + ' yozib Enter yoki sichqoncha bilan bosing' + neg);
    }
  }
  function arcPoint(w) {
    const d = state.draft, M = ARC_BY_KEY[d.method], prev = arcPrev(d);
    if (prev && dist(prev, w) < 1e-6) { setInfo('Bir xil nuqta — boshqa nuqtani bosing'); return; }
    d.pts.push({ x: w.x, y: w.y });
    if (d.pts.length >= M.steps.length) { finishArc(null); return; }
    arcOpenBox(); render();
  }
  function arcClick(w) {
    const M = arcDef();
    if (!state.draft) {
      if (M.key === 'cont' && !contValid()) { setInfo('Davom ettirish uchun avval chiziq yoki yoy chizing'); return; }
      state.draft = { tool: 'arc', method: M.key, pts: [] };
    }
    const d = state.draft, step = ARC_BY_KEY[d.method].steps[d.pts.length];
    if (!step) return;
    if (step[0] === 'pt') { arcPoint(d.pts.length || d.method === 'cont' ? arcPendingPt() : w); return; }
    finishArc(boxVals()[0]);   // qiymat qadamida: qutida yozilgan bo'lsa u (jonli ko'rinishdagidek), bo'sh bo'lsa sichqoncha (null)
  }
  function finishArc(param) {
    const d = state.draft; if (!d || d.tool !== 'arc') return;
    const a = arcBuild(d, param, state.cursor);
    if (!a) {
      const M = ARC_BY_KEY[d.method], lastPt = M.steps[M.steps.length - 1][0] === 'pt';
      // Oxirgi qadam nuqta bo'lsa uni qaytaramiz — qayta bosish mumkin (draft qotib qolmaydi)
      if (lastPt && d.pts.length >= M.steps.length) { d.pts.pop(); arcOpenBox(); render(); }
      // Xato xabari qutining maslahatidan KEYIN — ko'rinib qolsin
      setInfo("Yoy hosil bo'lmadi — nuqtalar bir chiziqda yoki qiymat mos emas (masalan radius vatarning yarmidan kichik, vatar diametrdan katta)" + (lastPt ? ' — oxirgi nuqtani qaytadan bosing' : ''));
      return;
    }
    pushHistory();
    const e = newEnt('arc', { cx: a.cx, cy: a.cy, r: a.r, a0: a.a0, a1: a.a1 });
    state.ents.push(e); state.sel.clear();
    state.cont = arcDrawnEnd(e, a.ccw);
    state.draft = null; closeBox(); state.snapHit = null;
    afterChange();
    arcAutoStart();   // Davom ettirish — keyingi yoy shu yoyning uchidan darhol davom etadi
    setInfo('Yoy: R ' + fmtLen(e.r) + ', ' + fmtAng(arcSweep(e)) + ', uzunligi ' + fmtLen(arcLen(e)) + ' — ' + arcHint0());
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
    if (t === 'move') {   // variant «Nusxa»: asli qoladi, surilgan nusxa qo'shiladi
      const src = state.opt.moveCopy ? selectedEnts().map(cloneEnt) : selectedEnts();
      for (const e of src) mapEnt(e, (p) => ({ x: p.x + target.x - base.x, y: p.y + target.y - base.y }));
      if (state.opt.moveCopy) { state.ents.push(...src); state.sel.clear(); for (const e of src) state.sel.add(e.id); }
    } else if (t === 'copy') {
      const cl = selectedEnts().map(cloneEnt);
      for (const c of cl) mapEnt(c, (p) => ({ x: p.x + target.x - base.x, y: p.y + target.y - base.y }));
      state.ents.push(...cl);
    } else if (t === 'rotate') {   // variant «Nusxa»: asli qoladi, burilgan nusxa qo'shiladi
      const src = state.opt.rotateCopy ? selectedEnts().map(cloneEnt) : selectedEnts();
      for (const e of src) mapEnt(e, (p) => rotPt(p, base, val));
      if (state.opt.rotateCopy) { state.ents.push(...src); state.sel.clear(); for (const e of src) state.sel.add(e.id); }
    } else if (t === 'scale') {
      if (val > 0) {
        const src = state.opt.scaleCopy ? selectedEnts().map(cloneEnt) : selectedEnts();
        for (const e of src) mapEnt(e, (p) => ({ x: base.x + (p.x - base.x) * val, y: base.y + (p.y - base.y) * val }), val);
        if (state.opt.scaleCopy) { state.ents.push(...src); state.sel.clear(); for (const e of src) state.sel.add(e.id); }
      }
    } else if (t === 'mirror') {
      const cl = selectedEnts().map(cloneEnt);
      for (const c of cl) { mapEnt(c, (p) => reflPt(p, base, target)); if (c.type === 'dim') c.off = -c.off; }
      if (state.opt.mirrorErase) { state.ents = state.ents.filter((e) => !state.sel.has(e.id)); state.sel.clear(); for (const c of cl) state.sel.add(c.id); }   // variant «Aslini o'chirish»
      state.ents.push(...cl);
    }
    state.draft = null; closeBox();
    if (t === 'copy' && state.opt.copyMulti) { state.draft = { tool: 'copy', base: { x: base.x, y: base.y } }; /* tayanch ASL nuqtada qoladi (AutoCAD) */ openModifyBox('copy', state.draft.base); setInfo("Yana nusxa (rejim: Ko'p): joyni bosing yoki masofa + burchak; Esc — tugatish"); }
    afterChange();
  }

  /* ---- Offset — parallel nusxa (geometriya: src/lib/offsetGeom.js) ----
     Gul rejimida yon paneldagi son bo'yicha N ta nusxa: masofa, 2×masofa, … N×masofa
     (aylana radiusi tugasa to'xtaydi). Detal rejimida har doim 1 ta. */
  function offsetCount() { return 1; }   // qo'lda ofset — bitta nusxa (AutoCAD); avto-ofset yon panelda
  // Bitta qadam (ishorali, mm) — tomon kursordan (raw — yopishtirilmagan world nuqta);
  // masofa: qutida yozilgan > Enter bilan kiritilgan > kursorgacha masofa
  function offsetStep(e, raw) {
    const d = state.draft;
    const s = (d && d.chain) ? chainSide(d.chain, raw) : offsetSide(e, raw); if (!s) return null;
    const [typed] = boxVals();
    const D = typed > 0 ? typed * U() : (d && d.dist != null ? d.dist : s.nd);
    return D * s.side;
  }
  // Ofset natijasi: har qadam uchun elementlar guruhi (zanjir — bir nechta element, oddiy — bitta)
  function offsetMade(d, step, N) { return d.chain ? offsetChainSeries(d.chain, step, N) : offsetSeries(d.ent, step, N).map((o) => [o]); }
  function offsetClick(sx, sy, w) {
    const d = state.draft;
    if (!d) {
      const hit = entAt(sx, sy);
      if (!hit || hit.ent.type === 'dim') { setInfo('Offset uchun chiziq, yoy yoki aylanani bosing'); return; }
      // Gul rejimi: uchlari tutashgan elementlar (chiziqlar, yoylar) bitta kontur — AutoCAD JOIN + OFFSET
      const ch = (V.joinOffset && hit.ent.type !== 'circle') ? chainOf(state.ents, hit.ent.id) : null;
      state.draft = { tool: 'offset', ent: hit.ent, chain: (ch && ch.ids.size > 1) ? ch : null, dist: null };
      openBox({ anchor: w, f1: { label: 'Masofa', unit: 'len' }, f2: null,
        onCommit: (v) => { if (v > 0) { state.draft.dist = v * U(); setInfo("Qaysi tomonga — o'sha tomonni bosing"); render(); } else setInfo("Masofani yozing, so'ng tomonni bosing"); } });
      const chTxt = state.draft.chain ? (state.draft.chain.closed ? 'Yopiq kontur' : 'Zanjir') + ' (' + state.draft.chain.ids.size + ' ta tutashgan element) birga ofset qilinadi. ' : '';
      setInfo(chTxt + "Masofani yozing (Enter), so'ng tomonni bosing — yoki to'g'ridan-to'g'ri tomonni bosing"); render(); return;
    }
    const e = d.ent, step = offsetStep(e, screenToWorld(sx, sy));
    if (step == null || !(Math.abs(step) > 1e-9)) { setInfo('Masofani yozing yoki kursorni chiziqdan nariroqqa olib tomonni bosing'); return; }
    const N = offsetCount();
    const made = offsetMade(d, step, N);
    if (!made.length) { setInfo("Ofset sig'madi — masofani kichraytiring"); return; }
    pushHistory();
    for (const grp of made) for (const o of grp) state.ents.push(newEnt(o.type, o));
    const chTxt = d.chain ? ' — ' + d.chain.ids.size + ' ta element birga' : '';
    if (state.opt.offsetMulti) {   // variant «Ko'p»: o'sha element, o'sha masofa — yana tomonni bosing
      state.draft = { tool: 'offset', ent: e, chain: d.chain, dist: Math.abs(step) };
      afterChange(); setInfo("Ofset tashlandi (" + fmtLen(Math.abs(step)) + ")" + chTxt + ". Ko'p rejim: yana tomonni bosing; Esc — tugatish"); return;
    }
    state.draft = null; closeBox();
    afterChange();
    setInfo(N > 1 ? made.length + ' ta ofset tashlandi (qadam ' + fmtLen(Math.abs(step)) + ')' + (made.length < N ? " — qolgani sig'madi" : '') + chTxt : toolHint('offset') + chTxt);
  }

  /* ---- Massiv (ARRAY): to'rtburchak (qator × ustun) va qutbiy (markaz atrofida — gul yaproqlari) ---- */
  function arrayClick(w) {
    commitOptInputs();
    if (!state.sel.size) { setInfo("Avval element(lar)ni «Tanlash» asbobi bilan belgilang"); return; }
    if (state.opt.arr.kind === 'polar') {
      state.draft = { tool: 'array', center: { x: w.x, y: w.y } };
      renderOptRow(); setInfo("Markaz belgilandi — soni va to'ldirish burchagini tekshirib «Bajarish» (Enter); markazni qayta bosish mumkin"); render(); return;
    }
    applyArray();
  }
  // Massiv nusxalari (asl elementlarsiz, id'siz) — jonli ko'rinish va bajarish uchun
  function arrayClones() {
    const a = state.opt.arr, src = selectedEnts(), out = [];
    if (a.kind === 'rect') {
      const rows = Math.max(1, Math.round(a.rows)), cols = Math.max(1, Math.round(a.cols));
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        if (!i && !j) continue;
        for (const e of src) { const c = JSON.parse(JSON.stringify(e)); mapEnt(c, (p) => ({ x: p.x + j * a.dc, y: p.y - i * a.dr })); out.push(c); }   // qatorlar TEPAGA (AutoCAD +Y)
      }
    } else {
      const d = state.draft; if (!d || d.tool !== 'array' || !d.center) return out;
      const n = Math.max(2, Math.round(a.n)), fill = Number.isFinite(a.fill) && Math.abs(a.fill) > 1e-9 ? a.fill : 360;
      const step = Math.abs(Math.abs(fill) - 360) < 1e-9 ? 360 / n : fill / (n - 1);
      for (let k = 1; k < n; k++) for (const e of src) { const c = JSON.parse(JSON.stringify(e)); mapEnt(c, (p) => rotPt(p, d.center, step * k)); out.push(c); }
    }
    return out;
  }
  function applyArray() {
    commitOptInputs();
    if (!state.sel.size) { setInfo('Massiv: avval element(lar)ni belgilang'); return; }
    const a = state.opt.arr;
    if (a.kind === 'polar' && !(state.draft && state.draft.tool === 'array' && state.draft.center)) { setInfo('Qutbiy massiv: avval markazni maydonda bosing'); return; }
    const cl = arrayClones();
    if (!cl.length) { setInfo(a.kind === 'polar' ? "Massiv: soni 2 dan katta bo'lsin" : "Massiv: qator yoki ustun soni 2 dan katta bo'lsin"); return; }
    pushHistory();
    for (const c of cl) { c.id = state.nextId++; state.ents.push(c); }
    state.draft = null; state.sel.clear();
    afterChange(); setTool('select');   // buyruq tugadi (AutoCAD) — takror Enter ustma-ust nusxa qo'shmasin
    setInfo(cl.length + " ta nusxa qo'shildi (massiv) — Orqaga (Ctrl+Z) bilan qaytariladi");
  }
  function paintArrayPreview(target, w2s, view, PP) {
    if (state.tool !== 'array' || !state.sel.size) return;
    const a = state.opt.arr, d = state.draft;
    if (a.kind === 'polar' && !(d && d.tool === 'array' && d.center)) return;
    const dash = { stroke: PP.accent, 'stroke-width': 1.6, 'stroke-dasharray': '6 4', fill: 'none', 'pointer-events': 'none' };
    for (const g of arrayClones()) {
      if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, dash)));
      else if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, dash))); }
      else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, dash)));
      else if (g.type === 'dim') paintDim(target, g, true, w2s, view, PP);
      else if (g.type === 'point') drawEntShape(target, g, w2s, view, dash);
    }
    if (d && d.tool === 'array' && d.center) { const c = w2s(d.center.x, d.center.y); target.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 4, fill: PP.accent, 'pointer-events': 'none' })); }
  }

  /* ---------------- ICHKI BUYRUQLAR QATORI (AutoCAD buyruq variantlari, o'zbekcha) ----------------
     Joriy asbobga qarab pastdagi qatorda variantlar: tugma (bosiladi / yoqiladi), son maydoni, matn. */
  let optRowItems = [];
  const toolLabel = (t) => (CMDS.find((c) => c.id === t) || {}).nomi || t;
  function optItems() {
    const t = state.tool, d = state.draft, o = state.opt, items = [];
    const btn = (label, act, extra) => items.push(Object.assign({ kind: 'btn', label, act }, extra || {}));
    const tog = (label, key) => items.push({ kind: 'btn', label: label + ': ' + (o[key] ? 'Ha' : "Yo'q"), act: () => { o[key] = !o[key]; }, on: !!o[key] });
    const num = (label, val, set, unit) => items.push({ kind: 'num', label, val, set, unit });
    if (t === 'select') { btn('Hammasini tanlash', () => { for (const e of state.ents) state.sel.add(e.id); }); btn("Bo'shatish (Esc)", () => state.sel.clear(), { disabled: !state.sel.size }); }
    else if (t === 'pline') {
      const on = !!(d && d.tool === 'pline');
      btn('Yopish (C)', () => finishPline(true), { disabled: !(on && d.pts.length >= 3) });
      btn('Orqaga (Backspace)', () => plineBackspace(), { disabled: !(on && d.pts.length >= 2) });
      btn('Yoy (davomida)', () => { if (on) finishPline(false); state.arcMethod = 'cont'; renderArcMenu(); setTool('arc'); }, { disabled: !((on && d.pts.length >= 2) || contValid()) });
    } else if (t === 'circle') {
      for (const k of Object.keys(CIRCLE_MODES)) btn(CIRCLE_MODES[k], () => { o.circleMode = k; cancelDraft(false); setInfo(toolHint('circle')); }, { on: o.circleMode === k });
    } else if (t === 'arc') { btn('Usul: ' + arcDef().nomi + ' \u25BE', () => showArcMenu(true)); }
    else if (t === 'copy') { btn('Rejim: ' + (o.copyMulti ? "Ko'p" : 'Bitta'), () => { o.copyMulti = !o.copyMulti; }, { on: o.copyMulti }); btn('Massiv\u2026', () => setTool('array')); }
    else if (t === 'move') tog('Nusxa (asli qoladi)', 'moveCopy');
    else if (t === 'rotate') tog('Nusxa (asli qoladi)', 'rotateCopy');
    else if (t === 'scale') tog('Nusxa (asli qoladi)', 'scaleCopy');
    else if (t === 'mirror') tog("Aslini o'chirish", 'mirrorErase');
    else if (t === 'offset') tog("Ko'p (bir masofa, ketma-ket)", 'offsetMulti');
    else if (t === 'fillet') {
      num('Radius', o.filletR / U(), (v) => { o.filletR = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      tog('Polyline (butun kontur)', 'filletPoly'); tog('Kesish (Trim)', 'filletTrim');
      btn('Faska\u2026', () => setTool('chamfer'));
    } else if (t === 'chamfer') {
      num('Masofa 1', o.chamD1 / U(), (v) => { o.chamD1 = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      num('Masofa 2', o.chamD2 / U(), (v) => { o.chamD2 = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      tog('Polyline (butun kontur)', 'chamPoly'); tog('Kesish (Trim)', 'chamTrim');
      btn('Tutashtirish\u2026', () => setTool('fillet'));
    } else if (t === 'polygon') {
      num('Tomonlar', o.polyN, (v) => { o.polyN = Math.max(3, Math.min(1024, Math.round(v))); }, '');
      btn('Ichki (aylanaga)', () => { o.polyMode = 'in'; cancelDraft(false); setInfo(toolHint('polygon')); }, { on: o.polyMode === 'in' });
      btn('Tashqi (aylana atrofida)', () => { o.polyMode = 'out'; cancelDraft(false); setInfo(toolHint('polygon')); }, { on: o.polyMode === 'out' });
      btn("Tomon bo'yicha", () => { o.polyMode = 'edge'; cancelDraft(false); setInfo(toolHint('polygon')); }, { on: o.polyMode === 'edge' });
    } else if (t === 'donut') {
      num('Ichki diametr', o.donutIn / U(), (v) => { o.donutIn = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      num('Tashqi diametr', o.donutOut / U(), (v) => { o.donutOut = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
    } else if (t === 'break') {
      btn('Ikki nuqta', () => { o.breakMode = '2p'; cancelDraft(false); setInfo(toolHint('break')); }, { on: o.breakMode === '2p' });
      btn('Nuqtada (ikkiga bo\'lish)', () => { o.breakMode = '1p'; cancelDraft(false); setInfo(toolHint('break')); }, { on: o.breakMode === '1p' });
    } else if (t === 'lengthen') {
      btn('Delta', () => { o.lenMode = 'delta'; }, { on: o.lenMode === 'delta' });
      btn('Foiz', () => { o.lenMode = 'percent'; }, { on: o.lenMode === 'percent' });
      btn('Umumiy', () => { o.lenMode = 'total'; }, { on: o.lenMode === 'total' });
      if (o.lenMode === 'percent') num('Foiz', o.lenPct, (v) => { o.lenPct = Math.max(0, v); }, '%');
      else if (o.lenMode === 'total') num('Umumiy uzunlik', o.lenTotal / U(), (v) => { o.lenTotal = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      else num('Delta (− qisqartiradi)', o.lenDelta / U(), (v) => { o.lenDelta = v * U(); }, UNIT_LABEL[state.unit]);
    } else if (t === 'divide') num("Bo'laklar soni", o.divN, (v) => { o.divN = Math.max(2, Math.min(32767, Math.round(v))); }, '');
    else if (t === 'measure') num('Masofa', o.measLen / U(), (v) => { o.measLen = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
    else if (t === 'area') {
      btn('Obyekt', () => { o.areaMode = 'obj'; cancelDraft(false); setInfo(toolHint('area')); }, { on: o.areaMode === 'obj' });
      btn('Nuqtalar', () => { o.areaMode = 'pts'; cancelDraft(false); setInfo(toolHint('area')); }, { on: o.areaMode === 'pts' });
      if (o.areaMode === 'pts') btn('Hisoblash (Enter)', () => finishAreaPts(), { primary: true, disabled: !(d && d.tool === 'area' && d.pts.length >= 3) });
    } else if (t === 'align') {
      tog('Masshtab (2-juft bo\'yicha)', 'alignScale');
      items.push({ kind: 'txt', text: 'Nuqtalar: ' + (d && d.tool === 'align' ? d.pts.length : 0) + ' / 4 — Enter 2 tadan keyin: faqat ko\'chirish' });
    } else if (t === 'stretch') items.push({ kind: 'txt', text: d && d.tool === 'stretch' ? (d.base ? 'Yangi joyni bosing' : (d.rect ? 'Tayanch nuqtani bosing' : '2-burchakni bosing')) : 'Ramka: 1-burchak → 2-burchak → tayanch → yangi joy' });
    else if (t === 'explode') btn('Tanlanganlarni portlatish', () => explodeEnts(selectedEnts()), { disabled: !state.sel.size });
    else if (t === 'join') {
      items.push({ kind: 'txt', text: 'Tanlangan: ' + state.sel.size });
      btn('Birlashtirish (Enter)', () => joinSelected(selectedEnts()), { primary: true, disabled: state.sel.size < 2 });
      btn("Bo'shatish", () => state.sel.clear(), { disabled: !state.sel.size });
    }
    else if (t === 'array') {
      const a = o.arr;
      btn("To'rtburchak", () => { a.kind = 'rect'; cancelDraft(false); setInfo(toolHint('array')); }, { on: a.kind === 'rect' });
      btn('Qutbiy (markaz atrofida)', () => { a.kind = 'polar'; cancelDraft(false); setInfo(toolHint('array')); }, { on: a.kind === 'polar' });
      if (a.kind === 'rect') {
        num('Qatorlar', a.rows, (v) => { a.rows = Math.max(1, Math.round(v)); }, '');
        num('Ustunlar', a.cols, (v) => { a.cols = Math.max(1, Math.round(v)); }, '');
        num("Qator oralig'i", a.dr / U(), (v) => { a.dr = v * U(); }, UNIT_LABEL[state.unit]);
        num("Ustun oralig'i", a.dc / U(), (v) => { a.dc = v * U(); }, UNIT_LABEL[state.unit]);
      } else {
        num('Soni', a.n, (v) => { a.n = Math.max(2, Math.round(v)); }, '');
        num("To'ldirish burchagi", a.fill, (v) => { a.fill = v; }, '\u00B0');
        items.push({ kind: 'txt', text: d && d.tool === 'array' && d.center ? 'Markaz: ' + fmtNum(d.center.x / U(), 2) + '; ' + fmtNum(-d.center.y / U(), 2) : 'Markazni maydonda bosing' });
      }
      btn('Bajarish (Enter)', () => applyArray(), { primary: true, disabled: !state.sel.size || (a.kind === 'polar' && !(d && d.tool === 'array' && d.center)) });
    }
    return items;
  }
  // Qatordagi yozilgan (hali commit bo'lmagan) sonlarni qo'llash — maydonga bosishdan / bajarishdan oldin
  function commitOptInputs() {
    const row = q('optRow'); if (!row) return false;
    let changed = false;
    row.querySelectorAll('input[data-opt]').forEach((i) => {
      const it = optRowItems[+i.dataset.opt]; if (!it || !it.set) return;
      const v = sonQiymat(i.value);
      if (Math.abs(v - it.val) > 1e-9) { it.set(v); it.val = v; changed = true; }
    });
    if (changed) { saveLS(); render(); syncOptRow(); }
    return changed;
  }
  // Qatorni qayta qurmasdan yangilash (fokus va bosilayotgan tugma yo'qolmasin): tugma holati, matn
  function syncOptRow() {
    const row = q('optRow'); if (!row) return;
    optItems().forEach((it, i) => {
      if (it.kind === 'btn') { const b = row.querySelector('button[data-opt="' + i + '"]'); if (b) { b.disabled = !!it.disabled; b.classList.toggle('on', !!it.on); if (b.textContent !== it.label) b.textContent = it.label; } }
      else if (it.kind === 'txt') { const s = row.querySelector('.chz-opttxt'); if (s && s.textContent !== it.text) s.textContent = it.text; }
    });
  }
  function renderOptRow() {
    const row = q('optRow'); if (!row) return;
    const items = optItems();
    optRowItems = items;
    if (!items.length) { row.style.display = 'none'; row.innerHTML = ''; return; }
    row.style.display = '';
    row.innerHTML = '<span class="chz-optlbl">' + escHtml(toolLabel(state.tool)) + ':</span>' + items.map((it, i) => {
      if (it.kind === 'txt') return '<span class="chz-opttxt">' + escHtml(it.text) + '</span>';
      if (it.kind === 'num') return '<label class="chz-optnum">' + escHtml(it.label) + ' <input type="text" inputmode="decimal" data-num="neg" data-opt="' + i + '" value="' + escHtml(fmtNum(it.val, 2)) + '" />' + (it.unit ? '<i>' + escHtml(it.unit) + '</i>' : '') + '</label>';
      return '<button type="button" class="chz-opt' + (it.on ? ' on' : '') + (it.primary ? ' primary' : '') + '" data-opt="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' + escHtml(it.label) + '</button>';
    }).join('');
  }

  /* ---- Tutashtirish (FILLET) / Faska (CHAMFER) / Portlatish / Birlashtirish — geometriya: src/lib/modifyGeom.js ---- */
  // Joriy qiymatlar: qutida yozilgan bo'lsa u (hali Enter bosilmagan), aks holda variantlar qatoridagi
  function filletVals(kind) {
    const o = state.opt, [v1, v2] = state.box ? boxVals() : [null, null];
    if (kind === 'fillet') return { R: v1 != null && v1 >= 0 ? v1 * U() : o.filletR };
    return { d1: v1 != null && v1 >= 0 ? v1 * U() : o.chamD1, d2: v2 != null && v2 >= 0 ? v2 * U() : o.chamD2 };
  }
  // Ikki tanlovdan o'zgarishlar: { remove:[id], add:[props], patch:[{id,patch}], shape } yoki { reason }
  function computeFillet(kind, h1, P1, h2, P2, zero) {
    const e1 = h1.ent, e2 = h2.ent;
    if (e1.type === 'dim' || e2.type === 'dim') return { reason: "O'lcham chizig'i tanlanmaydi" };
    if (e1 === e2 && (e1.type !== 'pline' || h1.seg === h2.seg)) return { reason: 'Ikkinchi (boshqa) obyekt yoki segmentni tanlang' };
    const c1 = curveOf(e1, h1.seg), c2 = curveOf(e2, h2.seg);
    if (!c1 || !c2) return { reason: 'Tanlangan obyekt mos emas' };
    const v = filletVals(kind);
    const res = kind === 'fillet' ? filletCurves(c1, P1, c2, P2, zero ? 0 : v.R) : chamferLines(c1, P1, c2, P2, zero ? 0 : v.d1, zero ? 0 : v.d2);
    if (!res || res.reason) return res || { reason: "Bajarib bo'lmadi" };
    const trim = kind === 'fillet' ? state.opt.filletTrim : state.opt.chamTrim;
    const shape = res.arc ? Object.assign({ type: 'arc' }, res.arc) : (res.seg ? { type: 'pline', pts: [res.seg.a, res.seg.b], closed: false } : null);
    const op = { remove: [], add: [], patch: [], shape };
    if (!trim) { if (shape) op.add.push(shape); return op; }
    if (e1 === e2) {   // bir polyline'ning ikki segmenti — burchak
      const adj = adjacentSegs(e1, h1.seg, h2.seg);
      if (!adj) return { reason: "Bir polyline'ning qo'shni bo'lmagan segmentlari — avval Portlatish (X) qiling" };
      const first = h1.seg === adj.prev;
      const Tp = first ? res.t1 : res.t2, Tn = first ? res.t2 : res.t1, trP = first ? res.trim1 : res.trim2, trN = first ? res.trim2 : res.trim1;
      if (trP.end !== 'b' || trN.end !== 'a') return { reason: 'Burchakka tutash qismlarni bosing' };
      if (dist(Tp, Tn) < 1e-9) return { reason: 'Burchak allaqachon tutash (radius / masofa 0)' };
      op.remove.push(e1.id);
      op.add.push(...cornerOp(e1, adj.v, Tp, Tn, kind));
      if (kind === 'fillet' && shape) op.add.push(shape);
      return op;
    }
    const apply = (ent, cv, tr, T) => {
      if (ent.type === 'pline' && tr.end) { op.remove.push(ent.id); op.add.push(...replaceSegEnd(ent, cv.seg, tr.end, T)); }
      else if (ent.type === 'arc' && tr.arc) {
        if (norm360(tr.arc.a1 - tr.arc.a0) < 1e-6) op.remove.push(ent.id);   // yoy nolga tushdi
        else op.patch.push({ id: ent.id, patch: tr.arc });
      }
    };
    apply(e1, c1, res.trim1, res.t1); apply(e2, c2, res.trim2, res.t2);
    if (shape) op.add.push(shape);
    return op;
  }
  function applyOp(op, msg) {
    if (!op || (!op.remove.length && !op.add.length && !op.patch.length)) { setInfo("Hech narsa o'zgarmadi"); return false; }
    pushHistory();
    const rm = new Set(op.remove);
    state.ents = state.ents.filter((e) => !rm.has(e.id));
    for (const p of op.patch) { const e = getEnt(p.id); if (e) Object.assign(e, p.patch); }
    for (const a of op.add) state.ents.push(newEnt(a.type, a));
    state.sel.clear(); state.cont = null;
    afterChange(); if (msg) setInfo(msg);
    return true;
  }
  function filletClick(kind, sx, sy) {
    const hit = entAt(sx, sy), raw = screenToWorld(sx, sy), o = state.opt, d = state.draft;
    const nm = kind === 'fillet' ? 'Tutashtirish' : 'Faska';
    if (!d) {
      if (!hit || hit.ent.type === 'dim') { setInfo(toolHint(kind)); return; }
      if (kind === 'fillet' ? o.filletPoly : o.chamPoly) {   // «Polyline» — butun konturning barcha burchaklari
        if (hit.ent.type !== 'pline') { setInfo(nm + " (Polyline): polyline'ni bosing"); return; }
        const res = kind === 'fillet' ? filletPlineAll(hit.ent, o.filletR) : chamferPlineAll(hit.ent, o.chamD1, o.chamD2);
        if (res.reason) { setInfo(res.reason); return; }
        applyOp({ remove: [hit.ent.id], add: res.ents, patch: [] }, nm + ': ' + res.count + ' ta burchak' + (res.skipped ? ' (' + res.skipped + " tasi juda qisqa — o'tkazib yuborildi)" : ''));
        return;
      }
      if (kind === 'chamfer' && hit.ent.type !== 'pline') { setInfo('Faska: chiziq (segment) bosing'); return; }
      state.draft = { tool: kind, h1: { ent: hit.ent, seg: hit.seg }, p1: raw };
      if (kind === 'fillet') openBox({ anchor: raw, f1: { label: 'Radius', unit: 'len', val: fmtNum(o.filletR / U(), 2) }, f2: null,
        onCommit: (v) => { if (v != null && v >= 0) { o.filletR = v * U(); saveLS(); renderOptRow(); setInfo('Radius ' + fmtLen(o.filletR) + ' — ikkinchi obyektni bosing'); render(); } } });
      else openBox({ anchor: raw, f1: { label: 'Masofa 1', unit: 'len', val: fmtNum(o.chamD1 / U(), 2) }, f2: { label: 'Masofa 2', unit: 'len', val: fmtNum(o.chamD2 / U(), 2) },
        onCommit: (a, b) => { if (a != null && a >= 0) o.chamD1 = a * U(); if (b != null && b >= 0) o.chamD2 = b * U(); saveLS(); renderOptRow(); setInfo('Faska ' + fmtLen(o.chamD1) + ' × ' + fmtLen(o.chamD2) + ' — ikkinchi chiziqni bosing'); render(); } });
      setInfo(nm + ': ikkinchi obyektni bosing (Shift+bosish — ' + (kind === 'fillet' ? 'radius' : 'masofa') + ' 0, burchakka tutashtirish; Esc — bekor)');
      render(); return;
    }
    if (!hit) { setInfo(nm + ': ikkinchi obyektni bosing'); return; }
    const op = computeFillet(kind, d.h1, d.p1, { ent: hit.ent, seg: hit.seg }, raw, !!state.shiftDown);
    if (op.reason) { setInfo(op.reason); return; }
    state.draft = null; closeBox();
    applyOp(op, nm + ' bajarildi. ' + toolHint(kind));
  }
  // Jonli ko'rinish: 1-tanlov (ajratilgan), kursor ostidagi 2-obyekt va natija (punktir)
  function paintFilletPreview(target, w2s, view, PP, d) {
    const shapeEl = (g, attrs) => {
      if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, attrs)));
      else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, attrs)));
      else if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, attrs))); }
    };
    const pick = (h, attrs) => { const cv = curveOf(h.ent, h.seg); if (!cv) return; if (cv.kind === 'line') shapeEl({ type: 'pline', pts: [cv.a, cv.b] }, attrs); else shapeEl(h.ent, attrs); };
    const hl = { stroke: PP.accent, 'stroke-width': 3.5, fill: 'none', opacity: 0.55, 'stroke-linecap': 'round', 'pointer-events': 'none' };
    pick(d.h1, hl);
    const s = state.cursorS; if (!s) return;
    const hit = entAt(s.sx, s.sy);
    if (!hit || hit.ent.type === 'dim' || (hit.ent === d.h1.ent && hit.seg === d.h1.seg)) return;
    pick(hit, Object.assign({}, hl, { opacity: 0.3 }));
    const op = computeFillet(d.tool, d.h1, d.p1, { ent: hit.ent, seg: hit.seg }, screenToWorld(s.sx, s.sy), false);
    if (!op || op.reason) return;
    const dash = { stroke: PP.edit, 'stroke-width': 2, 'stroke-dasharray': '6 4', fill: 'none', 'pointer-events': 'none' };
    for (const g of op.add) shapeEl(g, dash);
    for (const p of op.patch) { const e = getEnt(p.id); if (e) shapeEl(Object.assign({}, e, p.patch), dash); }
  }
  function explodeEnts(list) {
    const rm = [], add = [];
    for (const e of list) { const parts = explodeEnt(e); if (parts && parts.length) { rm.push(e.id); add.push(...parts); } }
    if (!rm.length) { setInfo("Portlatiladigan polyline yo'q (aylana, yoy va bitta segmentli chiziq portlatilmaydi)"); return; }
    applyOp({ remove: rm, add, patch: [] }, rm.length + ' ta polyline ' + add.length + ' ta chiziqqa ajratildi');
  }
  function joinSelected(list) {
    const r = joinEnts(list);
    if (!r.remove.length) { setInfo("Birlashtiriladigan narsa yo'q — chiziqlar uchlari tutashgan (yoki yoylar bir aylanada, tutash) bo'lishi kerak"); return; }
    applyOp({ remove: r.remove, add: r.add, patch: [] }, r.remove.length + ' ta element ' + r.add.length + ' taga birlashtirildi');
  }

  /* ---- 3-to'lqin asboblari — geometriya: src/lib/editGeom.js ---- */
  const WP = (w) => ({ x: w.x, y: w.y });
  function fmtArea(mm2) {
    const base = state.unit === 'mm' ? fmtNum(mm2, 1) + ' mm²' : fmtNum(mm2 / 100, 2) + ' sm²';
    return mm2 >= 1e5 ? base + ' (' + fmtNum(mm2 / 1e6, 4) + ' m²)' : base;
  }
  // Ko'pburchak
  function polyFrom(d, cur) {
    const o = state.opt;
    if (o.polyMode === 'edge') return d.p1 ? polygonEdge(d.p1, cur, o.polyN) : null;
    if (!d.c) return null;
    const [r, a] = state.box ? boxVals() : [null, null];
    const dd = dist(d.c, cur), R = r > 0 ? r * U() : dd;
    if (!(R > 1e-9)) return null;
    const ang = a != null ? a : (dd > 1e-9 ? vecAng(cur.x - d.c.x, cur.y - d.c.y) : 90);
    return polygonPts(d.c, o.polyN, R, o.polyMode, ang);
  }
  function makePolygon(pts) {
    state.draft = null; closeBox();
    if (!pts) { render(); return; }
    pushHistory(); state.ents.push(newEnt('pline', { pts, closed: true }));
    afterChange(); setInfo("Ko'pburchak: " + pts.length + ' tomon. ' + toolHint('polygon'));
  }
  function polygonClick(w) {
    const o = state.opt, d = state.draft;
    if (!d) {
      if (o.polyMode === 'edge') { state.draft = { tool: 'polygon', p1: WP(w) }; setInfo("Ko'pburchak: tomonning 2-uchini bosing (ko'pburchak chap tomonda quriladi)"); render(); return; }
      state.draft = { tool: 'polygon', c: WP(w) };
      openBox({ anchor: w, f1: { label: 'Radius', unit: 'len' }, f2: { label: 'Burchak', unit: 'ang' },
        onCommit: () => { const pts = polyFrom(state.draft, state.cursor); if (pts) makePolygon(pts); else setInfo('Radius yozing yoki bosing'); } });
      setInfo("Ko'pburchak: radiusni yozing (burchak ixtiyoriy) yoki bosing"); render(); return;
    }
    const pts = polyFrom(d, w);
    if (!pts) { setInfo("Ko'pburchak hosil bo'lmadi — nuqtalar bir xil"); return; }
    makePolygon(pts);
  }
  // Halqa, Nuqta
  function donutClick(w) {
    const o = state.opt;
    if (!(o.donutOut > 0)) { setInfo('Halqa: tashqi diametrni kiriting'); return; }
    pushHistory();
    state.ents.push(newEnt('circle', { cx: w.x, cy: w.y, r: o.donutOut / 2 }));
    if (o.donutIn > 0 && o.donutIn < o.donutOut) state.ents.push(newEnt('circle', { cx: w.x, cy: w.y, r: o.donutIn / 2 }));
    afterChange(); setInfo('Halqa qo\'yildi (D ' + fmtLen(o.donutOut) + ' / d ' + fmtLen(o.donutIn) + ') — yana markazni bosing');
  }
  function pointClick(w) {
    pushHistory(); state.ents.push(newEnt('point', { x: w.x, y: w.y }));
    afterChange(); setInfo('Nuqta: X ' + fmtNum(w.x / U(), 2) + '  Y ' + fmtNum(-w.y / U(), 2) + ' ' + UNIT_LABEL[state.unit] + ' — yana bosing');
  }
  // Cho'zish
  function stretchTarget() {
    const d = state.draft, [L, a] = state.box ? boxVals() : [null, null];
    if (L > 0) { const v = dirVec(norm360(a || 0)); return { x: d.base.x + v.dx * L * U(), y: d.base.y + v.dy * L * U() }; }
    return state.cursor;
  }
  function stretchClick(w) {
    const d = state.draft;
    if (!d) { state.draft = { tool: 'stretch', c1: WP(w) }; setInfo("Cho'zish: ramkaning 2-burchagini bosing"); render(); return; }
    if (!d.rect) {
      const rect = { x1: Math.min(d.c1.x, w.x), y1: Math.min(d.c1.y, w.y), x2: Math.max(d.c1.x, w.x), y2: Math.max(d.c1.y, w.y) };
      const hits = state.ents.filter((e) => stretchEnt(e, rect, 1, 0));
      if (!hits.length) { state.draft = null; setInfo("Ramka ichida tugun yo'q — qaytadan 1-burchakni bosing"); render(); return; }
      d.rect = rect; d.ids = hits.map((e) => e.id);
      setInfo("Cho'zish: " + hits.length + ' ta obyekt — tayanch nuqtani bosing'); render(); return;
    }
    if (!d.base) {
      d.base = WP(w);
      openBox({ anchor: w, f1: { label: 'Masofa', unit: 'len' }, f2: { label: 'Burchak', unit: 'ang' },
        onCommit: (L) => { if (L > 0) applyStretch(stretchTarget()); else setInfo('Masofa (+ burchak) yozing yoki yangi joyni bosing'); } });
      setInfo("Cho'zish: yangi joyni bosing yoki masofa + burchak yozing"); render(); return;
    }
    applyStretch(stretchTarget());
  }
  function applyStretch(target) {
    const d = state.draft; if (!d || !d.rect || !d.base) return;
    const dx = target.x - d.base.x, dy = target.y - d.base.y, patches = [];
    for (const id of d.ids) { const e = getEnt(id); const p = e && stretchEnt(e, d.rect, dx, dy); if (p) patches.push({ id, patch: p }); }
    state.draft = null; closeBox();
    applyOp({ remove: [], add: [], patch: patches }, "Cho'zildi: " + patches.length + ' ta obyekt. ' + toolHint('stretch'));
  }
  // Tekislash (ALIGN)
  function alignFnFull(pts) {
    const s1 = pts[0], d1 = pts[1], s2 = pts[2], d2 = pts[3];
    if (!s2 || !d2 || dist(s1, s2) < 1e-9) return { fn: (p) => ({ x: p.x + d1.x - s1.x, y: p.y + d1.y - s1.y }), k: 1 };
    const ang = vecAng(d2.x - d1.x, d2.y - d1.y) - vecAng(s2.x - s1.x, s2.y - s1.y);
    const k = state.opt.alignScale ? dist(d1, d2) / dist(s1, s2) : 1;
    return { k, fn: (p) => { const t = { x: p.x - s1.x + d1.x, y: p.y - s1.y + d1.y }, r = rotPt(t, d1, ang); return { x: d1.x + (r.x - d1.x) * k, y: d1.y + (r.y - d1.y) * k }; } };
  }
  function applyAlign(pts) {
    if (!state.sel.size) { setInfo("Tekislash: obyektlar tanlanmagan"); return; }
    const { fn, k } = alignFnFull(pts);
    pushHistory(); for (const e of selectedEnts()) mapEnt(e, fn, Math.abs(k - 1) > 1e-12 ? k : null);
    state.draft = null; afterChange();
    setInfo('Tekislandi' + (pts.length >= 4 ? (Math.abs(k - 1) > 1e-12 ? ' (masshtab ×' + fmtNum(k, 3) + ')' : ' (ko\'chirish + burish)') : ' (faqat ko\'chirish)') + '. ' + toolHint('align'));
  }
  function alignClick(w) {
    if (!state.sel.size) { setInfo("Tekislash: avval obyektlarni «Tanlash» bilan belgilang"); return; }
    const d = state.draft || (state.draft = { tool: 'align', pts: [] });
    d.pts.push(WP(w));
    if (d.pts.length >= 4) { applyAlign(d.pts); return; }
    const names = ['1-manba nuqta', '1-maqsad nuqta', '2-manba nuqta', '2-maqsad nuqta'];
    setInfo('Tekislash: ' + names[d.pts.length] + 'ni bosing' + (d.pts.length === 2 ? " (yoki Enter — faqat ko'chirish)" : '')); render();
  }
  // Uzish
  function breakClick(sx, sy, w) {
    const d = state.draft, o = state.opt;
    if (!d) {
      const hit = entAt(sx, sy);
      if (!hit || !['pline', 'arc', 'circle'].includes(hit.ent.type)) { setInfo('Uzish: chiziq, yoy yoki aylanani bosing'); return; }
      if (o.breakMode === '1p') {
        const r = breakEnt(hit.ent, WP(w));
        if (r.reason) { setInfo(r.reason); return; }
        applyOp({ remove: [hit.ent.id], add: r.add, patch: [] }, 'Nuqtada uzildi — ' + r.add.length + ' bo\'lak. ' + toolHint('break')); return;
      }
      state.draft = { tool: 'break', ent: hit.ent, p1: WP(w) };
      setInfo("Uzish: 2-nuqtani bosing — oralig'i olib tashlanadi (Esc — bekor)"); render(); return;
    }
    const r = breakEnt(d.ent, d.p1, WP(w));
    if (r.reason) { setInfo(r.reason); return; }
    state.draft = null;
    applyOp({ remove: [d.ent.id], add: r.add, patch: [] }, 'Uzildi' + (r.add.length ? '' : ' — element butunlay olib tashlandi') + '. ' + toolHint('break'));
  }
  // Uzunlik
  function lengthenCompute(hit, raw) {
    const o = state.opt;
    return lengthenEnt(hit.ent, raw, o.lenMode, o.lenMode === 'percent' ? o.lenPct : (o.lenMode === 'total' ? o.lenTotal : o.lenDelta));
  }
  function lengthenClick(sx, sy) {
    const hit = entAt(sx, sy); if (!hit) { setInfo(toolHint('lengthen')); return; }
    const r = lengthenCompute(hit, screenToWorld(sx, sy));
    if (r.reason) { setInfo(r.reason); return; }
    applyOp({ remove: [], add: [], patch: [{ id: hit.ent.id, patch: r.patch }] }, "Uzunlik o'zgartirildi (" + (r.delta >= 0 ? '+' : '−') + fmtLen(Math.abs(r.delta)) + '). ' + toolHint('lengthen'));
  }
  // Bo'lish / O'lchab qo'yish
  function divMeasCompute(t, e, raw) { return t === 'divide' ? divideEnt(e, state.opt.divN) : measureEnt(e, state.opt.measLen, raw); }
  function divMeasClick(t, sx, sy) {
    const hit = entAt(sx, sy);
    if (!hit || !['pline', 'arc', 'circle'].includes(hit.ent.type)) { setInfo(toolHint(t)); return; }
    const r = divMeasCompute(t, hit.ent, screenToWorld(sx, sy));
    if (r.reason) { setInfo(r.reason); return; }
    if (!r.pts.length) { setInfo("Masofa obyekt uzunligidan katta — nuqta qo'yilmadi"); return; }
    pushHistory(); for (const q of r.pts) state.ents.push(newEnt('point', { x: q.x, y: q.y }));
    afterChange(); setInfo(r.pts.length + " ta nuqta qo'yildi (magnit: Tugun — NOD). " + toolHint(t));
  }
  // Masofa / Yuza
  function distClick(w) {
    const d = state.draft;
    if (!d) { state.draft = { tool: 'dist', p1: WP(w) }; state.measureShow = null; setInfo('Masofa: 2-nuqtani bosing'); render(); return; }
    const a = d.p1, b = WP(w);
    state.draft = null; state.measureShow = { a, b };
    setInfo('Masofa = ' + fmtLen(dist(a, b)) + ',  ΔX = ' + fmtLen(b.x - a.x) + ',  ΔY = ' + fmtLen(a.y - b.y) + ',  burchak = ' + fmtAng(vecAng(b.x - a.x, b.y - a.y)));
    render();
  }
  function areaClick(sx, sy, w) {
    if (state.opt.areaMode === 'pts') {
      const d = state.draft || (state.draft = { tool: 'area', pts: [] });
      d.pts.push(WP(w)); state.measureShow = null;
      setInfo('Yuza (nuqtalar): ' + d.pts.length + ' nuqta — keyingisini bosing, Enter — hisoblash'); render(); return;
    }
    const hit = entAt(sx, sy); if (!hit) { setInfo(toolHint('area')); return; }
    let r = areaOfEnt(hit.ent), ids = [hit.ent.id];
    if (!r) { const ch = chainOf(state.ents, hit.ent.id); if (ch && ch.closed) { r = chainArea(ch.pieces); ids = [...ch.ids]; } }
    if (!r) { setInfo("Yopiq kontur emas — yopiq polyline, aylana yoki uchlari tutashgan yopiq zanjirni bosing"); return; }
    state.measureShow = { ids };
    setInfo('Yuza = ' + fmtArea(r.area) + ',  perimetr = ' + fmtLen(r.perim)); render();
  }
  function finishAreaPts() {
    const d = state.draft; if (!d || d.tool !== 'area') return;
    if (d.pts.length < 3) { setInfo('Yuza: kamida 3 nuqta kerak'); return; }
    state.measureShow = { poly: d.pts.slice() }; state.draft = null;
    setInfo('Yuza = ' + fmtArea(polyArea(d.pts)) + ',  perimetr = ' + fmtLen(polyPerim(d.pts, true))); render();
  }
  // Umumiy shakl chizuvchi (jonli ko'rinishlar uchun)
  function drawEntShape(target, g, w2s, view, attrs) {
    if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, attrs)));
    else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, attrs)));
    else if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, attrs))); }
    else if (g.type === 'point') { const c = w2s(g.x, g.y); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: 3.5 }, attrs))); }
  }
  function paintEditPreview(target, w2s, view, PP, d) {
    const cur = state.cursor;
    const dash = { stroke: PP.edit, 'stroke-width': 1.8, 'stroke-dasharray': '6 4', fill: 'none', 'pointer-events': 'none' };
    const thin = { stroke: PP.accent, 'stroke-width': 1, 'stroke-dasharray': '3 3', 'pointer-events': 'none' };
    const hl = { stroke: PP.accent, 'stroke-width': 3.5, fill: 'none', opacity: 0.45, 'stroke-linecap': 'round', 'pointer-events': 'none' };
    const seg = (a, b, attrs) => { const p = w2s(a.x, a.y), q2 = w2s(b.x, b.y); target.appendChild(svgEl('line', Object.assign({ x1: p.x, y1: p.y, x2: q2.x, y2: q2.y }, attrs))); };
    const dot = (p) => { const s = w2s(p.x, p.y); target.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 3.5, fill: PP.accent, 'pointer-events': 'none' })); };
    const cs = w2s(cur.x, cur.y);
    if (d.tool === 'polygon') {
      const pts = polyFrom(d, cur);
      if (pts) drawEntShape(target, { type: 'pline', pts, closed: true }, w2s, view, dash);
      if (d.c) { dot(d.c); seg(d.c, cur, thin); label(target, cs.x + 30, cs.y - 22, 'R ' + fmtLen(dist(d.c, cur)) + '  · ' + state.opt.polyN + ' tomon', PP.edit, 11, PP, true); }
      if (d.p1) { dot(d.p1); label(target, cs.x + 30, cs.y - 22, 'Tomon ' + fmtLen(dist(d.p1, cur)), PP.edit, 11, PP, true); }
      return;
    }
    if (d.tool === 'break') {
      drawEntShape(target, d.ent, w2s, view, hl);
      const r = breakEnt(d.ent, d.p1, cur);
      if (r.add) for (const g of r.add) drawEntShape(target, g, w2s, view, dash);
      dot(d.p1); return;
    }
    if (d.tool === 'stretch') {
      const r = d.rect || { x1: Math.min(d.c1.x, cur.x), y1: Math.min(d.c1.y, cur.y), x2: Math.max(d.c1.x, cur.x), y2: Math.max(d.c1.y, cur.y) };
      const a = w2s(r.x1, r.y1), b = w2s(r.x2, r.y2);
      target.appendChild(svgEl('rect', { x: a.x, y: a.y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), fill: 'rgba(34,197,94,.10)', stroke: '#16a34a', 'stroke-width': 1.2, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }));
      if (d.base) {
        const t = stretchTarget();
        for (const id of d.ids) { const e = getEnt(id), p = e && stretchEnt(e, r, t.x - d.base.x, t.y - d.base.y); if (p) drawEntShape(target, Object.assign({}, e, p), w2s, view, dash); }
        seg(d.base, t, thin); dot(d.base);
      }
      return;
    }
    if (d.tool === 'align') {
      const Pt = d.pts;
      for (let i = 0; i + 1 < Pt.length; i += 2) seg(Pt[i], Pt[i + 1], thin);
      if (Pt.length % 2 === 1) seg(Pt[Pt.length - 1], cur, thin);
      Pt.forEach(dot);
      if (Pt.length === 1 || Pt.length === 3) {
        const fk = alignFnFull(Pt.concat([cur]));
        for (const e of selectedEnts()) { const g = JSON.parse(JSON.stringify(e)); mapEnt(g, fk.fn, Math.abs(fk.k - 1) > 1e-12 ? fk.k : null); drawEntShape(target, g, w2s, view, dash); }
      }
      return;
    }
    if (d.tool === 'dist') {
      seg(d.p1, cur, Object.assign({}, dash, { stroke: PP.accent })); dot(d.p1);
      label(target, cs.x + 34, cs.y - 22, fmtLen(dist(d.p1, cur)) + '   ∠ ' + fmtAng(vecAng(cur.x - d.p1.x, cur.y - d.p1.y)), PP.accent, 11, PP, true);
      return;
    }
    if (d.tool === 'area') {
      const pts = d.pts.concat([WP(cur)]);
      target.appendChild(svgEl('polygon', { points: ptsAttr(pts, w2s), fill: 'color-mix(in srgb, ' + PP.accent + ' 14%, transparent)', stroke: PP.accent, 'stroke-width': 1.4, 'stroke-dasharray': '6 4', 'pointer-events': 'none' }));
      d.pts.forEach(dot);
      if (pts.length >= 3) label(target, cs.x + 40, cs.y - 22, fmtArea(polyArea(pts)), PP.accent, 11, PP, true);
    }
  }
  // Tanlovsiz asboblar: kursor ostidagi obyekt bo'yicha natija (Uzunlik, Bo'lish, O'lchab qo'yish, Halqa, Uzish nuqtada)
  function paintHoverPreview(target, w2s, view, PP) {
    const t = state.tool, s = state.cursorS; if (!s) return;
    const dash = { stroke: PP.edit, 'stroke-width': 1.8, 'stroke-dasharray': '6 4', fill: 'none', 'pointer-events': 'none' };
    if (t === 'donut') {
      const o = state.opt, c = state.cursor;
      if (o.donutOut > 0) drawEntShape(target, { type: 'circle', cx: c.x, cy: c.y, r: o.donutOut / 2 }, w2s, view, dash);
      if (o.donutIn > 0 && o.donutIn < o.donutOut) drawEntShape(target, { type: 'circle', cx: c.x, cy: c.y, r: o.donutIn / 2 }, w2s, view, dash);
      return;
    }
    if (!['lengthen', 'divide', 'measure', 'break'].includes(t)) return;
    const hit = entAt(s.sx, s.sy); if (!hit || hit.ent.type === 'dim' || hit.ent.type === 'point') return;
    const raw = screenToWorld(s.sx, s.sy);
    drawEntShape(target, hit.ent, w2s, view, { stroke: PP.accent, 'stroke-width': 3.5, fill: 'none', opacity: 0.35, 'pointer-events': 'none' });
    if (t === 'lengthen') { const r = lengthenCompute(hit, raw); if (r.patch) drawEntShape(target, Object.assign({}, hit.ent, r.patch), w2s, view, dash); }
    else if (t === 'break') { if (state.opt.breakMode === '1p') { const c = w2s(state.cursor.x, state.cursor.y); target.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 4, fill: 'none', stroke: '#ef4444', 'stroke-width': 1.6, 'pointer-events': 'none' })); } }
    else { const r = divMeasCompute(t, hit.ent, raw); if (r.pts) for (const q of r.pts) { const c = w2s(q.x, q.y); target.appendChild(svgEl('circle', { cx: c.x, cy: c.y, r: 3, fill: PP.accent, 'pointer-events': 'none' })); } }
  }
  // Masofa / Yuza natijasi (keyingi asbobgacha ko'rinib turadi)
  function paintMeasureShow(target, w2s, view, PP) {
    const m = state.measureShow; if (!m) return;
    if (m.a && m.b) {
      const p = w2s(m.a.x, m.a.y), q2 = w2s(m.b.x, m.b.y);
      target.appendChild(svgEl('line', { x1: p.x, y1: p.y, x2: q2.x, y2: q2.y, stroke: PP.accent, 'stroke-width': 1.6, 'stroke-dasharray': '6 3', 'pointer-events': 'none' }));
      label(target, (p.x + q2.x) / 2, (p.y + q2.y) / 2 - 14, fmtLen(dist(m.a, m.b)), PP.accent, 11, PP, true);
    }
    if (m.poly) target.appendChild(svgEl('polygon', { points: ptsAttr(m.poly, w2s), fill: 'color-mix(in srgb, ' + PP.accent + ' 16%, transparent)', stroke: PP.accent, 'stroke-width': 1.6, 'pointer-events': 'none' }));
    if (m.ids) for (const id of m.ids) { const e = getEnt(id); if (e) drawEntShape(target, e, w2s, view, { stroke: PP.accent, 'stroke-width': 4, fill: 'none', opacity: 0.5, 'pointer-events': 'none' }); }
  }

  /* ---- Kesish / Uzaytirish (AutoCAD tez rejim) — geometriya: src/lib/trimExtend.js ---- */
  function trimExtendClick(t, sx, sy) {
    const hit = entAt(sx, sy);
    if (!hit || hit.ent.type === 'dim') { setInfo(t === 'trim' ? 'Kesish: chiziq, yoy yoki aylananing olib tashlanadigan qismiga bosing' : 'Uzaytirish: chiziq yoki yoyning uchiga yaqin bosing'); return; }
    const raw = screenToWorld(sx, sy);
    if (t === 'trim') {
      const res = trimAt(state.ents, hit.ent, raw, hit.seg);
      if (!res || !res.remove) { setInfo(res && res.reason ? res.reason : 'Kesib bo\'lmadi'); return; }
      pushHistory();
      state.ents = state.ents.filter((e) => !res.remove.includes(e.id));
      for (const o of res.add) state.ents.push(newEnt(o.type, o));
      state.sel.clear(); state.cont = null;
      afterChange(); setInfo('Kesildi' + (res.add.length ? '' : ' — element butunlay olib tashlandi') + '. ' + toolHint('trim'));
    } else {
      const res = extendAt(state.ents, hit.ent, raw);
      if (!res || !res.patch) { setInfo(res && res.reason ? res.reason : 'Uzaytirib bo\'lmadi'); return; }
      pushHistory();
      Object.assign(hit.ent, res.patch);
      afterChange(); setInfo('Uzaytirildi. ' + toolHint('extend'));
    }
  }
  // Jonli ko'rinish: kursor ostidagi elementning kesiladigan qismi (qizil) / uzaytiriladigan qismi (punktir)
  function paintTrimExtendPreview(target, w2s, view, PP) {
    const s = state.cursorS; if (!s) return;
    const hit = entAt(s.sx, s.sy); if (!hit || hit.ent.type === 'dim') return;
    const raw = screenToWorld(s.sx, s.sy);
    const shape = (g, attrs) => {
      if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, attrs))); }
      else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, attrs)));
      else if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, attrs)));
    };
    if (state.tool === 'trim') {
      const res = trimAt(state.ents, hit.ent, raw, hit.seg);
      if (!res || !res.removed) return;
      shape(res.removed, { stroke: '#ef4444', 'stroke-width': 4, fill: 'none', opacity: 0.75, 'stroke-linecap': 'round', 'pointer-events': 'none' });
    } else {
      const res = extendAt(state.ents, hit.ent, raw);
      if (!res || !res.patch) return;
      const g = Object.assign({}, hit.ent, res.patch);
      shape(g, { stroke: PP.accent, 'stroke-width': 2.2, fill: 'none', 'stroke-dasharray': '6 4', 'pointer-events': 'none' });
    }
  }
  function toolClick(sx, sy, w) {
    const t = state.tool;
    if (t === 'fillet' || t === 'chamfer') return filletClick(t, sx, sy);
    if (t === 'polygon') return polygonClick(w);
    if (t === 'donut') return donutClick(w);
    if (t === 'point') return pointClick(w);
    if (t === 'stretch') return stretchClick(w);
    if (t === 'align') return alignClick(w);
    if (t === 'break') return breakClick(sx, sy, w);
    if (t === 'lengthen') return lengthenClick(sx, sy);
    if (t === 'divide' || t === 'measure') return divMeasClick(t, sx, sy);
    if (t === 'dist') return distClick(w);
    if (t === 'area') return areaClick(sx, sy, w);
    if (t === 'explode') { const hit = entAt(sx, sy); if (hit) explodeEnts([hit.ent]); else setInfo(toolHint('explode')); return; }
    if (t === 'join') {
      const hit = entAt(sx, sy);
      if (!hit) { setInfo(toolHint('join')); return; }
      if (state.sel.has(hit.ent.id)) state.sel.delete(hit.ent.id); else state.sel.add(hit.ent.id);
      render(); renderOptRow(); setInfo('Tanlangan: ' + state.sel.size + ' — yana bosing yoki Enter / «Birlashtirish»'); return;
    }
    if (t === 'pline') return plineClick(w);
    if (t === 'rect') return rectClick(w);
    if (t === 'circle') return circleClick(w);
    if (t === 'arc') return arcClick(w);
    if (t === 'dim') return dimClick(w);
    if (t === 'offset') return offsetClick(sx, sy, w);
    if (t === 'array') return arrayClick(w);
    if (t === 'trim' || t === 'extend') return trimExtendClick(t, sx, sy);
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

  // Yoy: radius (markaz va boshi saqlanadi) va burchak (boshidan CCW) tahriri
  function openArcEdit(ent) {
    openBox({ anchor: arcMid(ent), f1: { label: 'Radius', unit: 'len', val: fmtNum(ent.r / U(), 2) }, f2: { label: 'Burchak', unit: 'ang', val: fmtNum(arcSweep(ent), 1) },
      onCommit: (r, sw) => {
        if (r != null && !(r > 0)) { setInfo("Radius 0 dan katta bo'lsin"); return; }
        if (sw != null && !(sw > 0 && sw < 360)) { setInfo('Burchak 0 dan 360 gacha (boshidan soat miliga qarshi)'); return; }
        pushHistory();
        if (r != null) ent.r = r * U();
        if (sw != null) ent.a1 = norm360(ent.a0 + sw);
        closeBox(); afterChange();
      } });
    setInfo("Radius / burchakni o'zgartirib Enter (Esc — bekor)"); render();
  }

  /* ---- Griplar (tanlangan elementning uchlari) ---- */
  function gripsOf(e) {
    if (e.type === 'pline') return e.pts.map((p, i) => ({ x: p.x, y: p.y, kind: 'v', idx: i }));
    if (e.type === 'circle') return [{ x: e.cx, y: e.cy, kind: 'c' }, { x: e.cx + e.r, y: e.cy, kind: 'r' }];
    if (e.type === 'arc') { const s = arcStart(e), en = arcEnd(e), m = arcMid(e); return [{ x: s.x, y: s.y, kind: 'as' }, { x: en.x, y: en.y, kind: 'ae' }, { x: m.x, y: m.y, kind: 'am' }, { x: e.cx, y: e.cy, kind: 'ac' }]; }
    if (e.type === 'point') return [{ x: e.x, y: e.y, kind: 'pt' }];
    if (e.type === 'dim') { const n = dimNormal(e); return [{ x: e.x1, y: e.y1, kind: 'p1' }, { x: e.x2, y: e.y2, kind: 'p2' }, { x: (e.x1 + e.x2) / 2 + n.x * e.off, y: (e.y1 + e.y2) / 2 + n.y * e.off, kind: 'off' }]; }
    return [];
  }
  function gripAt(sx, sy) {
    for (const e of selectedEnts()) for (const g of gripsOf(e)) {
      const s = worldToScreen(g.x, g.y);
      if (Math.abs(s.x - sx) <= GRIP_PX + 3 && Math.abs(s.y - sy) <= GRIP_PX + 3) return { ent: e, kind: g.kind, idx: g.idx, pushed: false };
    }
    if (state.proj.on) {   // proyeksiya ajratgichlari burchagi — sudrab proyeksiyalarni surish
      const s = worldToScreen(state.proj.sepX, state.proj.sepY);
      if (Math.abs(s.x - sx) <= GRIP_PX + 3 && Math.abs(s.y - sy) <= GRIP_PX + 3) return { ent: null, kind: 'projCorner', pushed: false };
    }
    return null;
  }
  function applyGrip(w) {
    const g = state.grip, e = g.ent;
    if (g.kind === 'projCorner') { moveProjCorner(w.x, w.y); return; }
    if (g.kind === 'v') e.pts[g.idx] = { x: w.x, y: w.y };
    else if (g.kind === 'c') { e.cx = w.x; e.cy = w.y; }
    else if (g.kind === 'r') e.r = Math.max(0.1, dist(w, { x: e.cx, y: e.cy }));
    else if (g.kind === 'p1') { e.x1 = w.x; e.y1 = w.y; }
    else if (g.kind === 'p2') { e.x2 = w.x; e.y2 = w.y; }
    else if (g.kind === 'off') { const n = dimNormal(e); e.off = (w.x - e.x1) * n.x + (w.y - e.y1) * n.y; }
    else if (g.kind === 'as' || g.kind === 'ae') {   // yoy uchi — markaz/radius saqlanadi, burchak o'zgaradi
      if (Math.hypot(w.x - e.cx, w.y - e.cy) < 1e-6) return;
      const ang = vecAng(w.x - e.cx, w.y - e.cy);
      if (g.kind === 'as') { if (norm360(e.a1 - ang) > 1e-6) e.a0 = ang; } else if (norm360(ang - e.a0) > 1e-6) e.a1 = ang;
    }
    else if (g.kind === 'am') { const a = arcFrom3(arcStart(e), w, arcEnd(e)); if (a) { e.cx = a.cx; e.cy = a.cy; e.r = a.r; e.a0 = a.a0; e.a1 = a.a1; } }   // o'rtasi — bo'rtish
    else if (g.kind === 'ac') { e.cx = w.x; e.cy = w.y; }   // markaz — butun yoy suriladi
    else if (g.kind === 'pt') { e.x = w.x; e.y = w.y; }
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
  // Yoy yozuvlari: uzunlik + radius (tashqi tomonda), burchak (ichki tomonda)
  function paintArcLabels(target, e, w2s, PP, sel) {
    const m = PP.fs || 1, mid = arcMid(e), sm = w2s(mid.x, mid.y), v = dirVec(e.a0 + arcSweep(e) / 2);   // markazdan tashqariga
    if (state.showLen) label(target, sm.x + v.dx * 16 * m, sm.y + v.dy * 16 * m, fmtLen(arcLen(e)) + ' · R ' + fmtLen(e.r), sel ? PP.accent : PP.text, 11, PP);
    if (state.showAng) label(target, sm.x - v.dx * 16 * m, sm.y - v.dy * 16 * m, fmtAng(arcSweep(e)), PP.offset, 10.5, PP);
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
    if (d.tool === 'fillet' || d.tool === 'chamfer') { paintFilletPreview(target, w2s, view, PP, d); return; }
    if (['polygon', 'break', 'stretch', 'align', 'dist', 'area'].includes(d.tool)) { paintEditPreview(target, w2s, view, PP, d); return; }
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
      const cf = circleFrom(d, cur);
      if (cf && cf.r > 1e-6) { const c = w2s(cf.cx, cf.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: cf.r * view.scale }, dash))); label(target, c.x, c.y - cf.r * view.scale - 12, (state.opt.circleMode === 'dia' ? 'D ' + fmtLen(cf.r * 2) : 'R ' + fmtLen(cf.r)), PP.edit, 11, PP, true); }
      if (d.p1) { const s1 = w2s(d.p1.x, d.p1.y), sc = w2s(cur.x, cur.y); target.appendChild(svgEl('line', Object.assign({ x1: s1.x, y1: s1.y, x2: sc.x, y2: sc.y }, dash))); target.appendChild(svgEl('circle', { cx: s1.x, cy: s1.y, r: 3, fill: PP.edit, 'pointer-events': 'none' })); if (d.p2) { const s2 = w2s(d.p2.x, d.p2.y); target.appendChild(svgEl('circle', { cx: s2.x, cy: s2.y, r: 3, fill: PP.edit, 'pointer-events': 'none' })); } }
    } else if (d.tool === 'arc') {
      const M = ARC_BY_KEY[d.method], prev = arcPrev(d), step = M.steps[d.pts.length];
      const [v1] = boxVals();
      const tp = step && step[0] === 'pt' ? arcPendingPt() : cur;
      const a = arcBuild(d, step && step[0] !== 'pt' ? v1 : null, tp);
      for (const p of d.pts) { const s = w2s(p.x, p.y); target.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 3.5, fill: PP.edit, 'pointer-events': 'none' })); }
      if (prev && M.key === 'cont') { const s = w2s(prev.x, prev.y); target.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 3.5, fill: PP.edit, 'pointer-events': 'none' })); }
      const st = w2s(tp.x, tp.y);
      if (a) {
        target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(a, w2s, view.scale) }, dash)));
        const c = w2s(a.cx, a.cy);
        target.appendChild(svgEl('line', { x1: c.x - 5, y1: c.y, x2: c.x + 5, y2: c.y, stroke: PP.edit, 'stroke-width': 1, 'pointer-events': 'none' }));
        target.appendChild(svgEl('line', { x1: c.x, y1: c.y - 5, x2: c.x, y2: c.y + 5, stroke: PP.edit, 'stroke-width': 1, 'pointer-events': 'none' }));
        label(target, st.x + 30, st.y - 22, 'R ' + fmtLen(a.r) + '   ∠ ' + fmtAng(arcSweep(a)) + (a.ccw ? '' : ' ↻'), PP.edit, 11, PP, true);
      } else if (prev) {
        const sp = w2s(prev.x, prev.y);
        target.appendChild(svgEl('line', Object.assign({ x1: sp.x, y1: sp.y, x2: st.x, y2: st.y }, dash)));
        const L = dist(prev, tp);
        if (L > 1e-6) label(target, st.x + 30, st.y - 22, fmtLen(L) + '   ∠ ' + fmtAng(vecAng(tp.x - prev.x, tp.y - prev.y)), PP.edit, 11, PP, true);
      }
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
        else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, dash, { stroke: PP.accent })));
        else if (g.type === 'point') drawEntShape(target, g, w2s, view, Object.assign({}, dash, { stroke: PP.accent }));
      }
      if (d.tool === 'mirror') { const s1 = w2s(base.x, base.y), s2 = w2s(cur.x, cur.y); target.appendChild(svgEl('line', { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y, stroke: PP.accent, 'stroke-width': 1, 'stroke-dasharray': '2 3', 'pointer-events': 'none' })); }
      const sb = w2s(base.x, base.y);
      target.appendChild(svgEl('circle', { cx: sb.x, cy: sb.y, r: 3.5, fill: PP.accent, 'pointer-events': 'none' }));
    } else if (d.tool === 'offset' && d.ent) {
      const e = d.ent, hi = { stroke: PP.accent, 'stroke-width': 3.5, fill: 'none', opacity: 0.55, 'pointer-events': 'none' };
      const shape = (g, attrs) => {
        if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, attrs))); }
        else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, attrs)));
        else target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, attrs)));
      };
      shape(e, hi);
      if (d.chain) for (const x of state.ents) if (x.id !== e.id && d.chain.ids.has(x.id) && x.type !== 'dim') shape(x, hi);   // zanjir a'zolari
      // Jonli ko'rinish: kursor tomonida N ta parallel nusxa (qadam — yozilgan/kiritilgan masofa, bo'lmasa kursorgacha)
      if (state.cursorS) {
        const step = offsetStep(e, screenToWorld(state.cursorS.sx, state.cursorS.sy));
        if (step != null && Math.abs(step) > 1e-9) {
          const N = offsetCount(), made = offsetMade(d, step, N);
          for (const grp of made) for (const o of grp) shape(o, dash);
          if (N > 1) label(target, state.cursorS.sx + 30, state.cursorS.sy - 22, made.length + ' × ' + fmtLen(Math.abs(step)), PP.edit, 11, PP, true);
        }
      }
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
  // Proyeksiya ajratgichlari, 45° buklash chizig'i, nomlar (+ Tanlashda burchak gripi)
  function paintProjFrames(target, w2s, W, H, PP, exportMode) {
    const P = projP(), c = w2s(P.sepX, P.sepY), m = PP.fs || 1;
    const ln = (x1, y1, x2, y2, dash) => target.appendChild(svgEl('line', { x1, y1, x2, y2, stroke: PP.ref, 'stroke-width': 1 * m, 'stroke-dasharray': dash, opacity: 0.9, 'pointer-events': 'none' }));
    ln(c.x, -10, c.x, H + 10, '12 6'); ln(-10, c.y, W + 10, c.y, '12 6');
    const ext = Math.max(W, H) * 2; ln(c.x, c.y, c.x + ext, c.y + ext, '4 4');
    const lbl = (x, y, txt, anchor) => { const t = svgEl('text', { x, y, fill: PP.text, opacity: 0.55, 'font-size': 11 * m, 'font-weight': 800, 'text-anchor': anchor, 'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', 'pointer-events': 'none' }); t.textContent = txt; target.appendChild(t); };
    lbl(c.x - 8 * m, c.y - 8 * m, VIEW_NOMI.V, 'end'); lbl(c.x - 8 * m, c.y + 16 * m, VIEW_NOMI.H, 'end'); lbl(c.x + 8 * m, c.y - 8 * m, VIEW_NOMI.W, 'start');
    if (!exportMode && state.tool === 'select') target.appendChild(svgEl('rect', { x: c.x - 5, y: c.y - 5, width: 10, height: 10, fill: PP.accentSoft || '#fff', stroke: PP.accent, 'stroke-width': 1.4, 'pointer-events': 'none' }));
  }
  // Tanlangan elementning uchlaridan boshqa proyeksiyalarga bog'lanish chiziqlari (45° orqali)
  function paintProjLinks(target, w2s, W, H, PP) {
    const P = projP(), seen = new Set();
    const dot = (a, b) => target.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: PP.accent, 'stroke-width': 0.9, 'stroke-dasharray': '2 4', opacity: 0.55, 'pointer-events': 'none' }));
    for (const e of selectedEnts()) {
      const v = viewOf(e); if (!v) continue;
      for (const p of entVerts(e)) {
        const k = v + Math.round(p.x * 10) + ':' + Math.round(p.y * 10); if (seen.has(k)) continue; seen.add(k);
        const s = w2s(p.x, p.y);
        if (v === 'V') { dot(s, { x: s.x, y: H + 10 }); dot(s, { x: W + 10, y: s.y }); }
        else if (v === 'H') { dot(s, { x: s.x, y: -10 }); const f = w2s(P.wx + (p.y - P.hy), p.y); dot(s, f); dot(f, { x: f.x, y: -10 }); }
        else { dot(s, { x: -10, y: s.y }); const f = w2s(p.x, P.hy + (p.x - P.wx)); dot(s, f); dot(f, { x: -10, y: f.y }); }
      }
    }
  }
  function paint(target, view, W, H, exportMode) {
    const PP = exportMode ? EXPORT_P : P;
    const m = PP.fs || 1;
    const w2s = (x, y) => ({ x: x * view.scale + view.panX, y: y * view.scale + view.panY });
    while (target.firstChild) target.removeChild(target.firstChild);
    if (exportMode) target.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));
    else if (state.snapSet.grid) paintGrid(target, view, W, H);
    if (state.proj.on) paintProjFrames(target, w2s, W, H, PP, exportMode);
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
      } else if (e.type === 'arc') {
        target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(e, w2s, view.scale) }, attrs)));
      } else if (e.type === 'point') {   // AutoCAD PDMODE 34 kabi: aylana + krestik
        const s = w2s(e.x, e.y), k = 4.5 * m, pa = { stroke: col, 'stroke-width': 1.3 * m, 'pointer-events': 'none' };
        target.appendChild(svgEl('line', Object.assign({ x1: s.x - k, y1: s.y, x2: s.x + k, y2: s.y }, pa)));
        target.appendChild(svgEl('line', Object.assign({ x1: s.x, y1: s.y - k, x2: s.x, y2: s.y + k }, pa)));
        target.appendChild(svgEl('circle', Object.assign({ cx: s.x, cy: s.y, r: k * 0.6, fill: 'none' }, pa)));
      }
    }
    // 2) yozuvlar (uzunlik + burchak)
    for (const e of state.ents) {
      if (e.type === 'pline') paintPlineLabels(target, e.pts, e.closed, w2s, PP, !exportMode && state.sel.has(e.id));
      else if (e.type === 'circle' && state.showLen) { const c = w2s(e.cx, e.cy); label(target, c.x, c.y - e.r * view.scale - 12 * m, 'R ' + fmtLen(e.r), PP.text, 11, PP); }
      else if (e.type === 'arc') paintArcLabels(target, e, w2s, PP, !exportMode && state.sel.has(e.id));
    }
    // 2b) avtomatik ichki ofset konturi (Gul rejimi) — binafsha, eksportga ham kiradi
    for (const g of state.autoEnts || []) {
      const at = { stroke: PP.offset, 'stroke-width': 1.5 * m, fill: 'none', 'stroke-linejoin': 'round', 'pointer-events': 'none' };
      if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, at)));
      else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, at)));
      else if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, at))); }
    }
    if (exportMode) return;
    if (state.proj.on && state.proj.links) paintProjLinks(target, w2s, W, H, PP);
    // 3) chizilayotgan (jonli)
    if (state.draft) paintDraft(target, w2s, view, PP);
    else if (state.tool === 'trim' || state.tool === 'extend') paintTrimExtendPreview(target, w2s, view, PP);
    else paintHoverPreview(target, w2s, view, PP);
    if (state.measureShow) paintMeasureShow(target, w2s, view, PP);
    if (state.tool === 'array') paintArrayPreview(target, w2s, view, PP);
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
  function afterChange() { computeAutoOff(); render(); updatePanel(); }

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
    // 3 proyeksiya rejimida hisob faol chiziq turgan proyeksiya bo'yicha (yoyilma bir proyeksiyaniki)
    const apv = activePline();
    const scope = (state.proj.on && apv && !apv.draft) ? viewOf(apv) : null;
    q('stScope').textContent = scope ? '— ' + VIEW_NOMI[scope] : '';
    const scoped = scope ? state.ents.filter((e) => viewOf(e) === scope) : state.ents;
    for (const e of scoped) if (e.type === 'arc') { total += arcLen(e); segs++; } else if (e.type === 'pline') {
      for (const s of plineSegs(e)) { total += dist(s.a, s.b); segs++; }
      const n = e.pts.length, cyc = e.closed && n > 2;
      for (let k = 0; k < n; k++) {
        if (!(k > 0 || cyc) || !(k < n - 1 || cyc)) continue;
        if (interiorAngle(e.pts[(k - 1 + n) % n], e.pts[k], e.pts[(k + 1) % n]) < 179.5) bends++;
      }
    }
    q('stTotal').textContent = segs ? fmtLen(total) : '—';
    const b = scope ? boundsOf(scoped, false, false) : bounds();
    q('stBox').textContent = b ? fmtNum((b.maxX - b.minX) / U(), 2) + ' × ' + fmtNum((b.maxY - b.minY) / U(), 2) + ' ' + UNIT_LABEL[state.unit] : '—';
    q('stBends').textContent = String(bends);
    q('stSegs').textContent = String(segs);
    renderTable(); renderLib(); renderZakas(); syncButtons(); syncProjUI(); syncOffUI();
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
  function loadLib() { try { const a = JSON.parse(localStorage.getItem(V.libKey)); state.lib = Array.isArray(a) ? a : []; } catch (e) { state.lib = []; } }
  function saveLib() { try { localStorage.setItem(V.libKey, JSON.stringify(state.lib)); } catch (e) { /* noop */ } }
  function libMeta(it) {
    let total = 0, segs = 0;
    for (const e of it.ents || []) if (e.type === 'pline') for (const s of plineSegs(e)) { total += dist(s.a, s.b); segs++; }
    return segs ? segs + ' seg · ' + fmtLen(total) : (it.ents || []).length + ' element';
  }
  function renderLib() {
    const el = q('libList');
    q('libCnt').textContent = state.lib.length ? '(' + state.lib.length + ')' : '';
    if (!state.lib.length) { el.innerHTML = '<div class="dtl-empty">' + escHtml(V.libEmpty) + '</div>'; return; }
    el.innerHTML = state.lib.map((it) =>
      `<div class="dtl-libitem${it.name === state.name ? ' cur' : ''}">`
      + `<button type="button" class="dtl-libopen" data-act="open" data-id="${it.id}" title="Ochish"><b>${escHtml(it.name)}</b><span>${escHtml(libMeta(it))}</span></button>`
      + `<button type="button" class="dtl-libdel" data-act="del" data-id="${it.id}" title="Kutubxonadan o'chirish">&#10005;</button></div>`).join('');
  }
  function saveToLib() {
    let name = (q('nameInput').value || '').trim();
    if (!state.ents.length) { setInfo("Chizma bo'sh — saqlash uchun avval chizing"); return; }
    if (!name) { name = V.autoName + ' ' + (state.lib.length + 1); q('nameInput').value = name; }
    state.name = name;
    const item = { id: Date.now(), name, ents: JSON.parse(JSON.stringify(state.ents)), proj: JSON.parse(JSON.stringify(state.proj)), autoOff: state.autoOff, t: Date.now() };
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
    if (it.proj && V.proj) state.proj = sanitizeProj(it.proj);
    if (V.autoOffset && it.autoOff != null) state.autoOff = sanitizeAutoOff(it.autoOff);
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
    let out = '', lay = 'DETAL';
    const L = (x1, y1, x2, y2) => { out += '0\nLINE\n8\n' + lay + '\n10\n' + num(x1) + '\n20\n' + num(-y1) + '\n30\n0\n11\n' + num(x2) + '\n21\n' + num(-y2) + '\n31\n0\n'; };
    const emit = (ents) => {
      for (const e of ents) {
        if (e.type === 'pline') { for (const s of plineSegs(e)) if (dist(s.a, s.b) > 1e-6) L(s.a.x, s.a.y, s.b.x, s.b.y); }
        else if (e.type === 'circle') out += '0\nCIRCLE\n8\n' + lay + '\n10\n' + num(e.cx) + '\n20\n' + num(-e.cy) + '\n30\n0\n40\n' + num(e.r) + '\n';
        else if (e.type === 'point') out += '0\nPOINT\n8\n' + lay + '\n10\n' + num(e.x) + '\n20\n' + num(-e.y) + '\n30\n0\n';
        else if (e.type === 'arc') out += '0\nARC\n8\n' + lay + '\n10\n' + num(e.cx) + '\n20\n' + num(-e.cy) + '\n30\n0\n40\n' + num(e.r) + '\n50\n' + num(e.a0) + '\n51\n' + num(e.a1) + '\n';
      }
    };
    emit(state.ents);
    lay = 'OFSET'; emit(state.autoEnts || []);   // avtomatik ichki ofset — alohida qatlam
    return '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n' + out + '0\nENDSEC\n0\nEOF\n';
  }
  function exportDxf() {
    if (!state.ents.some((e) => e.type !== 'dim')) { setInfo("Chizma bo'sh — eksport qilinmaydi"); return; }
    downloadDxf(V.filePrefix + safeFileName(state.name || 'chizma') + '.dxf', buildDxf());
    setInfo('DXF yuklab olindi (mm, Y yuqoriga)');
  }
  async function exportPng() {
    const b = bounds(true); if (!b) { setInfo("Chizma bo'sh"); return; }
    const pad = 70, top = 60, W = 1600;
    const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
    let sc = (W - 2 * pad) / w; if (h * sc > 2400) sc = 2400 / h;
    const H = Math.round(h * sc + top + 2 * pad);
    const view = { scale: sc, panX: pad - b.minX * sc, panY: top + pad - b.minY * sc };
    const ex = svgEl('svg', { xmlns: SVG_NS, width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    paint(ex, view, W, H, true);
    const title = svgEl('text', { x: pad, y: 40, 'font-size': 22, 'font-weight': 700, fill: '#0f172a', 'font-family': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' });
    title.textContent = state.name || V.title;
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
      await new Promise((res) => cv.toBlob((png) => { if (png) downloadBlob(V.filePrefix + safeFileName(state.name || 'chizma') + '.png', png); res(); }, 'image/png'));
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
      localStorage.setItem(V.storageKey, JSON.stringify({
        ents: state.ents, nextId: state.nextId, unit: state.unit, angMode: state.angMode, tool: state.tool,
        showLen: state.showLen, showAng: state.showAng,
        scale: state.scale, panX: state.panX, panY: state.panY, name: state.name,
        proj: state.proj, autoOff: state.autoOff, arcMethod: state.arcMethod, opt: state.opt,
      }));
    } catch (e) { /* noop */ }
    zakasSave();
  }
  function saveLS() { if (_saveT) return; _saveT = setTimeout(() => { _saveT = null; saveStateNow(); }, 250); }
  function flushSaveLS() { if (!_saveT) return; clearTimeout(_saveT); _saveT = null; saveStateNow(); }
  function loadStateLS() {
    try {
      const raw = localStorage.getItem(V.storageKey); if (!raw) return false;
      const o = JSON.parse(raw); if (!o || !Array.isArray(o.ents)) return false;
      state.ents = o.ents.filter((e) => e && (e.type === 'pline' ? Array.isArray(e.pts) : (e.type === 'arc' ? [e.cx, e.cy, e.r, e.a0, e.a1].every(Number.isFinite) && e.r > 0 : true)));
      state.nextId = o.nextId || (Math.max(0, ...state.ents.map((e) => e.id || 0)) + 1);
      if (UNITS[o.unit]) state.unit = o.unit;
      state.angMode = o.angMode === 'rel' ? 'rel' : 'abs';
      if (TOOLS.includes(o.tool)) state.tool = o.tool;
      state.showLen = o.showLen !== false; state.showAng = o.showAng !== false;
      if (o.scale > 0) state.scale = o.scale;
      if (typeof o.panX === 'number') state.panX = o.panX;
      if (typeof o.panY === 'number') state.panY = o.panY;
      state.name = o.name || '';
      state.proj = sanitizeProj(o.proj);
      if (!V.proj) state.proj.on = false;   // Gul rejimida proyeksiyalar yo'q
      state.autoOff = o.autoOff == null ? AUTO_OFF_DEF : sanitizeAutoOff(o.autoOff);
      if (ARC_BY_KEY[o.arcMethod]) state.arcMethod = o.arcMethod;
      if (o.opt && typeof o.opt === 'object') {
        const p = o.opt, so = state.opt;
        if (CIRCLE_MODES[p.circleMode]) so.circleMode = p.circleMode;
        for (const k of ['copyMulti', 'moveCopy', 'rotateCopy', 'mirrorErase', 'scaleCopy', 'offsetMulti', 'filletPoly', 'filletTrim', 'chamPoly', 'chamTrim']) if (typeof p[k] === 'boolean') so[k] = p[k];
        for (const k of ['filletR', 'chamD1', 'chamD2', 'donutIn', 'donutOut', 'lenPct', 'lenTotal', 'measLen']) if (Number.isFinite(p[k]) && p[k] >= 0) so[k] = p[k];
        if (Number.isFinite(p.lenDelta)) so.lenDelta = p.lenDelta;
        if (Number.isFinite(p.polyN) && p.polyN >= 3 && p.polyN <= 1024) so.polyN = Math.round(p.polyN);
        if (Number.isFinite(p.divN) && p.divN >= 2 && p.divN <= 32767) so.divN = Math.round(p.divN);
        if (['in', 'out', 'edge'].includes(p.polyMode)) so.polyMode = p.polyMode;
        if (['2p', '1p'].includes(p.breakMode)) so.breakMode = p.breakMode;
        if (['delta', 'percent', 'total'].includes(p.lenMode)) so.lenMode = p.lenMode;
        if (['obj', 'pts'].includes(p.areaMode)) so.areaMode = p.areaMode;
        if (typeof p.alignScale === 'boolean') so.alignScale = p.alignScale;
        if (p.arr && typeof p.arr === 'object') {
          if (p.arr.kind === 'rect' || p.arr.kind === 'polar') so.arr.kind = p.arr.kind;
          for (const k of ['rows', 'cols', 'dr', 'dc', 'n', 'fill']) if (Number.isFinite(p.arr[k])) so.arr[k] = p.arr[k];
        }
      }
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
    syncPolarSel();
    renderOptRow();
  }
  function updateScaleInfo() { const el = q('scaleInfo'); if (el) el.textContent = '1 sm = ' + fmtNum(10 * state.scale, 1) + ' px'; }
  function centerView() {
    const r = svg.getBoundingClientRect(); if (!r.width || !r.height) return;
    const b = bounds(true);
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

  on(root, 'mouseenter', () => { state.pointerIn = true; });
  on(root, 'mouseleave', () => { state.pointerIn = false; });

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
    commitOptInputs();   // variantlar qatoridagi yozilgan son (blur bo'lmagan) qo'llansin
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
    state.shiftDown = e.shiftKey;
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
      applyGrip(g.ent ? resolveCursor(sx, sy, null, g.ent.id) : screenToWorld(sx, sy));
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
    if (PICK_TOOLS.includes(state.tool)) { state.snapHit = null; state.snapRes = null; }
    statusBar.setCoords('X ' + fmtNum(state.cursor.x / U(), 2) + '   Y ' + fmtNum(-state.cursor.y / U(), 2) + '  ' + UNIT_LABEL[state.unit]);
    if (state.draft || LIVE_TOOLS.includes(state.tool) || MODIFY.includes(state.tool)) render();
  });
  on(window, 'mouseup', (e) => {
    if (panning) { panning = false; return; }
    if (state.grip) { const pushed = state.grip.pushed; state.grip = null; state.snapHit = null; if (pushed) afterChange(); else render(); return; }
    if (!boxSel) return;
    const { sx, sy } = evScreen(e);
    const bs = boxSel; boxSel = null; selBoxEl.style.display = 'none';
    if (!bs.moved) {
      // AutoCAD (PICKADD): har bosish tanlovga QO'SHILADI; Shift+bosish — olib tashlaydi; bo'sh joyga bosish — bo'shatadi (Esc kabi)
      if (bs.candidate) {
        const id = bs.candidate.ent.id;
        if (bs.additive) state.sel.delete(id); else state.sel.add(id);   // Shift — faqat olib tashlash (AutoCAD)
      } else if (!bs.additive) state.sel.clear();
    } else {
      const r = { x1: Math.min(bs.sx, sx), y1: Math.min(bs.sy, sy), x2: Math.max(bs.sx, sx), y2: Math.max(bs.sy, sy) };
      const crossing = sx < bs.sx;
      // Ramka ham tanlovga qo'shadi (AutoCAD); Shift+ramka — olib tashlaydi
      for (const ent of state.ents) {
        const vs = (ent.type === 'arc' ? arcSamples(ent, 24) : entVerts(ent)).map((p) => worldToScreen(p.x, p.y));
        let hit = vs.length > 0 && vs.every((s) => pointInRect(s.x, s.y, r));
        if (!hit && crossing) {
          hit = vs.some((s) => pointInRect(s.x, s.y, r));
          for (let i = 0; !hit && i < vs.length - 1; i++) hit = segIntersectsRect(vs[i], vs[i + 1], r);
          if (!hit && ent.type === 'pline' && ent.closed && vs.length > 2) hit = segIntersectsRect(vs[vs.length - 1], vs[0], r);
        }
        if (hit) { if (bs.additive) state.sel.delete(ent.id); else state.sel.add(ent.id); }
      }
    }
    render(); renderTable(); renderOptRow();
  });
  on(canvasWrap, 'dblclick', (e) => {
    if (inputBox.contains(e.target) || state.tool !== 'select') return;
    e.preventDefault();
    const { sx, sy } = evScreen(e);
    const hit = entAt(sx, sy); if (!hit) return;
    if (hit.ent.type === 'pline') openSegEdit(hit.ent, hit.seg);
    else if (hit.ent.type === 'circle') { state.sel.clear(); state.sel.add(hit.ent.id); openCircleEdit(hit.ent); }
    else if (hit.ent.type === 'arc') { state.sel.clear(); state.sel.add(hit.ent.id); openArcEdit(hit.ent); }
  });

  // Klaviatura
  on(window, 'keydown', (e) => {
    if (statusBar.handleKey(e)) { e.preventDefault(); onSnapChange(e.key); return; }
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'Escape') {
      if (arcMenu.classList.contains('show')) { e.preventDefault(); showArcMenu(false); return; }
      if (state.measureShow) { state.measureShow = null; render(); }
      if (state.draft || state.box) { e.preventDefault(); cancelCurrent(); }
      else if (state.sel.size) { e.preventDefault(); state.sel.clear(); render(); renderTable(); }
      return;
    }
    // Chizma «faol»mi: kursor chizma ustida, fokus chizma ichida yoki to'liq ekran. Chizmadan TASHQARIDAGI
    // tugma/havola fokusda bo'lsa (sahifa tugmalari, «Kichraytirish») yoki Shift+Tab — tutilmaydi, sahifa klaviaturasi ishlayveradi
    const ae = document.activeElement;
    const outsideControl = !!(ae && ae !== document.body && !root.contains(ae));
    const active = !outsideControl && (state.pointerIn || root.contains(ae) || !!root.closest('.chz-full-wrap'));
    if (!active) return;
    if (e.key === 'Tab' && e.shiftKey) return;
    if (e.key === 'Enter' || e.key === 'Tab') {   // AutoCAD: buyruqni tugatish; bo'sh joyda → Tanlash, yana bossa → oxirgi asbob
      e.preventDefault();
      if (state.draft && state.draft.tool === 'pline') { finishPline(false); return; }
      if (state.tool === 'array' && state.sel.size && (state.opt.arr.kind === 'rect' || (state.draft && state.draft.center))) { applyArray(); return; }
      if (state.tool === 'join' && state.sel.size && !state.draft) { joinSelected(selectedEnts()); return; }
      if (state.draft && state.draft.tool === 'align' && state.draft.pts.length >= 2) { applyAlign(state.draft.pts.slice(0, 2)); return; }
      if (state.draft && state.draft.tool === 'area') { finishAreaPts(); return; }
      if (state.draft) { cancelCurrent(); return; }
      if (state.tool !== 'select') setTool('select');
      else if (state.lastTool && TOOLS.includes(state.lastTool)) setTool(state.lastTool);
      return;
    }
    // Chiziq chizilayotganda C — konturni yopish (AutoCAD LINE → Close)
    if (state.draft && state.draft.tool === 'pline' && (e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); finishPline(true); return; }
    // Harf bosilsa — buyruq qidirish maydoniga tushadi (AutoCAD buyruq satri kabi)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /[a-zA-Z0-9']/.test(e.key)) { e.preventDefault(); cmdOpen(e.key); return; }
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
  on(q('polarSel'), 'change', (e) => {
    const s = state.snapSet, v = e.target.value;
    if (v === 'off') { s.polar = false; s.ortho = false; }
    else if (v === 'ortho') { s.ortho = true; s.polar = false; }
    else if (v === 'custom') {
      const t = window.prompt("Burchak qadami (°), masalan 7.5 yoki 12:", String(s.polarInc));
      const n = parseFloat(String(t || '').replace(',', '.'));
      if (n >= 0.5 && n <= 180) { s.polarInc = n; s.polar = true; s.ortho = false; }
    } else { s.polarInc = +v; s.polar = true; s.ortho = false; }
    statusBar.sync(); onSnapChange('polarInc'); e.target.blur();
    setInfo(s.ortho ? 'Burchak: faqat 0° / 90° / 180° / 270° (orto)' : (s.polar ? 'Burchak qadami ' + s.polarInc + '° — chiziq ' + [1, 2, 3, 4].map((k) => +(s.polarInc * k).toFixed(1)).join('°, ') + "°… burchaklarga yopishadi" : 'Burchak erkin (polar o\'chiq)'));
  });
  on(q('pdistSel'), 'change', (e) => {
    state.snapSet.polarDist = +e.target.value || 0; statusBar.sync(); onSnapChange('polarDist'); e.target.blur();
    setInfo(state.snapSet.polarDist ? 'Uzunlik ' + fmtLen(state.snapSet.polarDist) + ' qadam bilan yaxlitlanadi (polar/orto nuri bo\'ylab)' : 'Uzunlik aniq (yaxlitlanmaydi)');
  });
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
  on(q('nameInput'), 'input', (e) => { state.name = e.target.value; renderZakas(); saveLS(); });
  on(q('nameInput'), 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveToLib(); } });
  on(q('btnSave'), 'click', saveToLib);
  on(q('btnNew'), 'click', newDrawing);
  // 3 proyeksiya
  on(q('projOn'), 'change', (e) => setProjOn(e.target.checked));
  on(q('projGuides'), 'change', (e) => { state.proj.guides = e.target.checked; saveLS(); render(); });
  on(q('projLinks'), 'change', (e) => { state.proj.links = e.target.checked; saveLS(); render(); });
  on(q('projGap'), 'change', (e) => { const v = sonQiymat(e.target.value); if (v >= 0) setProjGap(v * U()); else syncProjUI(); });
  on(q('projGap'), 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
  for (const v of ['V', 'H', 'W']) on(q('gen' + v), 'click', (e) => genClick(v, e.currentTarget));
  on(q('projInfo'), 'click', (e) => { const b = e.target.closest('button[data-act="clear"]'); if (b) clearView(b.dataset.view); });
  // Gul rejimi: avtomatik ichki ofset masofasi (− / sm / +, ↑↓ bilan ham; 0 — o'chiq)
  if (V.autoOffset) {
    const STEP = 5;   // mm — 0.5 sm
    on(q('offMinus'), 'click', () => setAutoOff(state.autoOff - STEP));
    on(q('offPlus'), 'click', () => setAutoOff(state.autoOff + STEP));
    on(q('autoOff'), 'change', (e) => setAutoOff(sonQiymat(e.target.value) * U()));
    on(q('autoOff'), 'keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setAutoOff(state.autoOff + STEP); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setAutoOff(state.autoOff - STEP); }
    });
  }

  /* ---------------- ZAKASDAGI GULLAR (Gul rejimi) ----------------
     localStorage ZAKAS_KEY: { [zakasKey]: { active, items:[{id,name,ents,autoOff,t}], t } }.
     Faol gul = ishchi holat (state.ents / name / autoOff); har saqlashda ro'yxatga qaytariladi. */
  function zakasReadAll() { try { const o = JSON.parse(localStorage.getItem(ZAKAS_KEY) || 'null'); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; } }
  function zakasBlank() { return { id: Date.now() + Math.floor(Math.random() * 1000), name: '', ents: [], autoOff: state.autoOff, t: Date.now() }; }
  function zakasLoad() {
    if (!V.zakas) return;
    const all = zakasReadAll(), ent = all && all[zakasKey];
    const items = ent && Array.isArray(ent.items) ? ent.items.filter((it) => it && Array.isArray(it.ents)) : [];
    if (items.length) {
      state.zakas.items = items.map((it) => ({ id: it.id || Date.now(), name: String(it.name || ''), ents: it.ents, autoOff: it.autoOff == null ? AUTO_OFF_DEF : sanitizeAutoOff(it.autoOff), t: it.t || 0 }));
      state.zakas.active = Math.min(Math.max(0, ent.active | 0), state.zakas.items.length - 1);
      zakasApply();
      return;
    }
    // Birinchi ochilish: ro'yxat umuman bo'lmasa mavjud chizma 1-gul bo'ladi (eski holatdan ko'chirish), aks holda bo'sh gul
    const seed = (!all && state.ents.length) ? JSON.parse(JSON.stringify(state.ents)) : [];
    state.zakas.items = [Object.assign(zakasBlank(), { name: seed.length ? state.name : '', ents: seed })];
    state.zakas.active = 0;
    zakasApply();
  }
  // Faol guldan ishchi holatga
  function zakasApply() {
    const it = state.zakas.items[state.zakas.active]; if (!it) return;
    state.ents = JSON.parse(JSON.stringify(it.ents || [])).filter((e) => e && e.type);
    state.nextId = Math.max(0, ...state.ents.map((e) => e.id || 0)) + 1;
    state.name = it.name || ''; q('nameInput').value = state.name;
    state.autoOff = it.autoOff == null ? AUTO_OFF_DEF : sanitizeAutoOff(it.autoOff);
    state.sel.clear(); state.hist.length = 0; state.redo.length = 0; state.cont = null;
  }
  // Ishchi holatdan faol gulga (saqlashdan / almashishdan oldin)
  function zakasSyncActive() {
    const it = state.zakas.items[state.zakas.active]; if (!it) return;
    it.name = state.name; it.ents = JSON.parse(JSON.stringify(state.ents)); it.autoOff = state.autoOff; it.t = Date.now();
  }
  function zakasSave() {
    if (!V.zakas || !state.zakas.items.length) return;
    zakasSyncActive();
    const all = zakasReadAll() || {};
    // Bo'sh zakas (hech narsa chizilmagan, nom yo'q) saqlanmaydi — kvotani (ZAKAS_MAX) to'ldirmasin
    const meaningful = state.zakas.items.some((it) => (it.ents && it.ents.length) || (it.name && String(it.name).trim()));
    if (!meaningful) { if (!all[zakasKey]) return; delete all[zakasKey]; }
    else all[zakasKey] = { active: state.zakas.active, items: state.zakas.items, t: Date.now() };
    const keys = Object.keys(all).sort((a, b) => ((all[b] && all[b].t) || 0) - ((all[a] && all[a].t) || 0));
    for (const k of keys.slice(ZAKAS_MAX)) delete all[k];
    try { localStorage.setItem(ZAKAS_KEY, JSON.stringify(all)); } catch (e) { /* noop */ }
  }
  function zakasSwitch(i) {
    if (!V.zakas || i === state.zakas.active || !state.zakas.items[i]) return;
    cancelDraft(false); zakasSyncActive();
    state.zakas.active = i; zakasApply();
    afterChange(); centerView();
    setInfo('«' + (state.name || 'Gul ' + (i + 1)) + '» ochildi');
  }
  function zakasAdd() {
    if (!V.zakas) return;
    cancelDraft(false); zakasSyncActive();
    state.zakas.items.push(zakasBlank());
    state.zakas.active = state.zakas.items.length - 1; zakasApply();
    afterChange(); centerView();
    q('nameInput').focus();
    setInfo("Yangi gul qo'shildi — nomini yozing va chizing (oldingisi ro'yxatda turibdi)");
  }
  function zakasRemove(i) {
    const items = state.zakas.items; if (!items[i]) return;
    cancelDraft(false);
    if (i !== state.zakas.active) zakasSyncActive();
    items.splice(i, 1);
    if (!items.length) items.push(zakasBlank());
    if (i === state.zakas.active) { state.zakas.active = Math.min(i, items.length - 1); zakasApply(); afterChange(); centerView(); }
    else { if (i < state.zakas.active) state.zakas.active--; renderZakas(); saveLS(); }
    setInfo("Gul zakasdan o'chirildi");
  }
  function sizeOf(ents) {
    const b = boundsOf(ents, false, false);
    return b ? fmtNum((b.maxX - b.minX) / U(), 1) + ' × ' + fmtNum((b.maxY - b.minY) / U(), 1) + ' ' + UNIT_LABEL[state.unit] : '—';
  }
  function renderZakas() {
    if (!V.zakas) return;
    const items = state.zakas.items, act = state.zakas.active;
    q('zakasCnt').textContent = items.length ? '(' + items.length + ')' : '';
    q('zakasList').innerHTML = items.map((it, i) => {
      const cur = i === act, ents = cur ? state.ents : (it.ents || []), name = (cur ? state.name : it.name) || ('Gul ' + (i + 1));
      return '<div class="gul-zakas-item' + (cur ? ' cur' : '') + '">'
        + '<button type="button" class="gul-zakas-open" data-act="open" data-i="' + i + '" title="' + (cur ? 'Joriy gul' : "Shu gulga o'tish") + '"><span class="n">' + (i + 1) + '</span><b>' + escHtml(name) + '</b><span>' + escHtml(sizeOf(ents)) + '</span></button>'
        + '<button type="button" class="dtl-libdel" data-act="del" data-i="' + i + '" title="Zakasdan o\'chirish">&#10005;</button></div>';
    }).join('');
  }
  if (V.zakas) {
    on(q('zakasAdd'), 'click', zakasAdd);
    on(q('zakasList'), 'click', (e) => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const i = +b.dataset.i;
      if (b.dataset.act === 'open') { zakasSwitch(i); return; }
      if (b.dataset.arm === '1') { zakasRemove(i); return; }
      b.dataset.arm = '1'; b.textContent = 'Tasdiq?'; b.classList.add('arm');
      setTimeout(() => { if (b.isConnected) { b.dataset.arm = ''; b.innerHTML = '&#10005;'; b.classList.remove('arm'); } }, 3000);
    });
  }

  /* ---------------- YOY USULLARI MENYUSI (AutoCAD Arc ▾) ---------------- */
  const arcMenu = q('arcMenu');
  function renderArcMenu() {
    let h = '', grp = -1;
    for (const M of ARC_METHODS) {
      if (M.grp !== grp) { if (grp >= 0) h += '<div class="chz-arcsep"></div>'; grp = M.grp; }
      h += '<button type="button" class="chz-arcitem' + (M.key === state.arcMethod ? ' on' : '') + '" data-arc="' + M.key + '"><i>' + arcIcon(M.key) + '</i>' + escHtml(M.nomi) + '</button>';
    }
    arcMenu.innerHTML = h;
    q('arcBtn').innerHTML = '<i class="arcico">' + arcIcon(state.arcMethod) + '</i> Yoy';
    q('arcBtn').title = 'Yoy — ' + arcDef().nomi + ' (usulni yonidagi ▾ dan tanlang)';
  }
  function showArcMenu(show) {
    arcMenu.classList.toggle('show', !!show);
    if (!show) return;
    arcMenu.classList.remove('flip');
    const r = arcMenu.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) arcMenu.classList.add('flip');   // tor ekran: o'ng chetga tekislanadi
  }
  on(q('arcMenuBtn'), 'click', (e) => { e.stopPropagation(); showArcMenu(!arcMenu.classList.contains('show')); });
  on(arcMenu, 'click', (e) => {
    const b = e.target.closest('button[data-arc]'); if (!b || !ARC_BY_KEY[b.dataset.arc]) return;
    state.arcMethod = b.dataset.arc; showArcMenu(false); renderArcMenu(); saveLS();
    setTool('arc');   // amaldagi yoy jarayoni bekor bo'lib, yangi usul bilan boshlanadi
  });
  on(document, 'mousedown', (e) => { if (arcMenu.classList.contains('show') && !q('arcWrap').contains(e.target)) showArcMenu(false); });

  /* ---------------- BUYRUQ QIDIRISH (AutoCAD buyruq satri, o'zbekcha) ----------------
     Asbob nomi yoki AutoCAD qisqartmasini yozing — ro'yxatdan tanlab Enter. Maydon ustida harf
     bosilsa o'zi ochiladi. */
  const cmdInput = q('cmd'), cmdList = q('cmdList');
  let cmdSel = 0;
  const cmdNorm = (s) => String(s || '').toLowerCase().replace(/[‘’ʻʼ`]/g, "'").trim();
  function cmdAll() {
    const base = CMDS.slice();
    for (const M of ARC_METHODS) base.push({ id: 'arc:' + M.key, nomi: 'Yoy — ' + M.nomi, al: [] });
    return base;
  }
  function cmdMatches(qs) {
    const s = cmdNorm(qs); if (!s) return [];
    const toks = s.split(/\s+/).filter(Boolean);   // bir nechta so'z — hammasi nom yoki qisqartmada uchrasin («yoy 3», «boshi markaz»)
    const score = (c) => {
      const nm = cmdNorm(c.nomi), als = c.al.map(cmdNorm), hay = nm + ' ' + als.join(' ');
      if (als.includes(s)) return 0;
      if (als.some((a) => a.startsWith(s))) return 1;
      if (nm.startsWith(s)) return 2;
      if (nm.includes(s)) return 3;
      if (als.some((a) => a.includes(s))) return 4;
      if (toks.length > 1 && toks.every((t) => hay.includes(t))) return 5;
      return -1;
    };
    return cmdAll().map((c) => ({ c, sc: score(c) })).filter((x) => x.sc >= 0).sort((a, b) => a.sc - b.sc).slice(0, 9).map((x) => x.c);
  }
  function renderCmdList() {
    const list = cmdMatches(cmdInput.value);
    if (!list.length) { cmdList.classList.remove('show'); cmdList.innerHTML = ''; return; }
    cmdSel = Math.max(0, Math.min(cmdSel, list.length - 1));
    cmdList.innerHTML = list.map((c, i) => '<div class="chz-cmditem' + (i === cmdSel ? ' on' : '') + '" data-cmd="' + c.id + '"><span>' + escHtml(c.nomi) + '</span><b>' + escHtml(c.al.join(', ')) + '</b></div>').join('');
    cmdList.classList.add('show');
  }
  function cmdOpen(ch) { cmdInput.value = ch || ''; cmdSel = 0; cmdInput.focus(); renderCmdList(); }
  function cmdClose() { cmdInput.value = ''; cmdList.classList.remove('show'); cmdList.innerHTML = ''; cmdInput.blur(); }
  function runCmd(id) {
    cmdClose();
    if (!id) return;
    if (id === '#undo') return undo();
    if (id === '#redo') return redo();
    if (id === '#fit') return centerView();
    if (id === '#clear') return q('btnClear').click();
    if (id === '#start0') return start0();
    if (id.startsWith('arc:')) { const k = id.slice(4); if (ARC_BY_KEY[k]) { state.arcMethod = k; renderArcMenu(); saveLS(); } setTool('arc'); return; }
    if (TOOLS.includes(id)) setTool(id);
  }
  on(cmdInput, 'input', () => { cmdSel = 0; renderCmdList(); });
  on(cmdInput, 'focus', renderCmdList);
  on(cmdInput, 'keydown', (e) => {
    const list = cmdMatches(cmdInput.value);
    if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdSel + 1, list.length - 1); renderCmdList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(cmdSel - 1, 0); renderCmdList(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); if (list.length) runCmd(list[cmdSel] ? list[cmdSel].id : list[0].id); else cmdClose(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cmdClose(); }
  });
  on(cmdList, 'mousedown', (e) => { e.preventDefault(); const it = e.target.closest('[data-cmd]'); if (it) runCmd(it.dataset.cmd); });
  on(document, 'mousedown', (e) => { if (cmdList.classList.contains('show') && !q('cmdWrap').contains(e.target)) cmdClose(); });

  on(q('optRow'), 'click', (e) => {
    const b = e.target.closest('button[data-opt]'); if (!b) return;
    const it = optRowItems[+b.dataset.opt];
    if (it && it.act) { it.act(); renderOptRow(); saveLS(); render(); }
  });
  on(q('optRow'), 'change', (e) => {
    const i = e.target.closest('input[data-opt]'); if (!i) return;
    const it = optRowItems[+i.dataset.opt];
    if (it && it.set) { const v = sonQiymat(i.value); it.set(v); it.val = v; i.value = fmtNum(v, 2); saveLS(); render(); syncOptRow(); }   // qator qayta qurilmaydi — fokus/tugma saqlanadi
  });
  on(q('optRow'), 'keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); if (state.tool === 'array') applyArray(); } });
  on(q('libList'), 'click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = +b.dataset.id;
    if (b.dataset.act === 'open') { loadFromLib(id); return; }
    if (b.dataset.arm === '1') { state.lib = state.lib.filter((x) => x.id !== id); saveLib(); renderLib(); setInfo(V.libDel); return; }
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
  zakasLoad();
  computeAutoOff();
  renderArcMenu();
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
      root.classList.remove('chz', 'dtl', V.cls);
    },
  };
}
