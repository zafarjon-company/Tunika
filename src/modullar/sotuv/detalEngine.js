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
import { loadSnap, saveSnap, buildGeom, resolveSnap, updateAcquire, gridStepFor, snapMarkerShapes, POLAR_INCS, POLAR_DISTS, SNAP_MODES } from '../../lib/osnap.js';
import { mountStatusBar } from '../../lib/cadStatusBar.js';
import { offsetSide, offsetSeries } from '../../lib/offsetGeom.js';
import { chainOf, chainSide, offsetChainSeries, buildChains, offsetChainInward, piecesToEnts } from '../../lib/chainOffset.js';
import { trimAt, extendAt } from '../../lib/trimExtend.js';
import { breakEnt, stretchEnt, lengthenEnt, polygonPts, polygonEdge, divideEnt, measureEnt, polyArea, polyPerim, chainArea, areaOfEnt } from '../../lib/editGeom.js';
import { curveOf, filletCurves, chamferLines, replaceSegEnd, adjacentSegs, cornerOp, filletPlineAll, chamferPlineAll, explodeEnt, joinEnts } from '../../lib/modifyGeom.js';
import { arcSweep, arcLen, arcStart, arcEnd, arcMid, arcPt, angInArc, arcBounds, distToArc, arcSamples, arcDrawnEnd, arcSCA, arcSCE, arcSCL, arcSEA, arcSED, arcSER, arcFrom3, arcContinue, arcMap, arcSvgPath } from '../../lib/arcGeom.js';
import { closedLoops, findRegion, pointInLoops, regionArea, regionAreaOf } from '../../lib/hatchGeom.js';
import { TEXT_CAP } from '../../lib/curveGeom.js';
import { parseInput, pointFromDist, deriveKeywords, matchKeyword, promptWithOptions, cmdFilter, num1 as cmdNum, evalExpr } from '../../lib/cmdLine.js';
import { ellipsePts, ellipseFromCenter, ellipseFromAxis, distToAxis, ellipseGrips, ellipseMap, splinePts, textBox, distToTextBox, textMap, linearRot, rotatedDim, rotatedOff, angularDim, lineInt, radialDim } from '../../lib/curveGeom.js';
import { ACI, ACI_NOM, ACI_LIST, LT, LT_LIST, LW_LIST, LW_BYLAYER, lwLabel, lwPx, normLayerName, layerNameError, makeLayer, defaultLayers, findLayer, sortLayers, canDeleteLayer, aciHex, resolveStyle, usedLayerNames, migrateEnts, sanitizeLayers } from '../../lib/cadLayer.js';

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
    filePrefix: 'detal_', proj: true, autoOffset: false, zakas: false, joinOffset: false, mainLayer: 'DETAL',
  },
  gul: {
    cls: 'gul', storageKey: 'gul-chizma-v1', libKey: 'gul-chizma-lib-v1',
    title: 'Gul', namePh: 'Gul nomi (masalan: Lola 20 sm)', autoName: 'Gul', saveEx: 'lola, yaproq',
    libLabel: 'Saqlangan gullar', libEmpty: "Hali saqlangan gul yo'q", libDel: "Gul kutubxonadan o'chirildi",
    offTitle: "Offset — parallel nusxalar: elementni bosing, masofani yozing, tomonni bosing — yon paneldagi son bo'yicha bir nechta",
    filePrefix: 'gul_', proj: false, autoOffset: true, zakas: true, joinOffset: true, mainLayer: 'DETAL',
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
  { id: 'ellipse', nomi: 'Ellips', al: ['EL', 'ELLIPSE'] },
  { id: 'spline', nomi: 'Splayn (silliq egri)', al: ['SPL', 'SPLINE'] },
  { id: 'text', nomi: 'Matn (yozuv)', al: ['T', 'DT', 'TEXT', 'MT', 'MTEXT'] },
  { id: 'xline', nomi: 'Yordamchi chiziq (cheksiz)', al: ['XL', 'XLINE'] },
  { id: 'ray', nomi: 'Nur (bir tomonga cheksiz)', al: ['RAY'] },
  { id: 'hatch', nomi: "Shtrix (sohani bo'yash)", al: ['H', 'BH', 'HATCH'] },
  { id: 'boundary', nomi: 'Kontur (sohadan chegara)', al: ['BO', 'BOUNDARY'] },
  { id: 'dim', nomi: "O'lcham", al: ['DIM'] },
  { id: 'dim:lin', nomi: "O'lcham — chiziqli (gorizontal / vertikal)", al: ['DLI', 'DIMLINEAR'] },
  { id: 'dim:al', nomi: "O'lcham — parallel (qiya)", al: ['DAL', 'DIMALIGNED'] },
  { id: 'dim:ang', nomi: "O'lcham — burchak", al: ['DAN', 'DIMANGULAR'] },
  { id: 'dim:rad', nomi: "O'lcham — radius", al: ['DRA', 'DIMRADIUS'] },
  { id: 'dim:dia', nomi: "O'lcham — diametr", al: ['DDI', 'DIMDIAMETER'] },
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
  { id: 'pedit', nomi: 'Silliqlash (siniq chiziq ↔ splayn)', al: ['PE', 'PEDIT', 'SPE', 'SPLINEDIT'] },
  { id: 'erase', nomi: "O'chirish", al: ['E', 'ERASE', 'DEL'] },
  // Qatlamlar (AutoCAD LAYER va LAY* buyruqlari)
  { id: '#layer', nomi: 'Qatlamlar boshqaruvchisi', al: ['LA', 'LAYER', 'DDLMODES'] },
  { id: '#laymcur', nomi: 'Qatlamni joriy qilish (elementni bosib)', al: ['LAYMCUR'] },
  { id: '#laycur', nomi: 'Tanlanganlarni joriy qatlamga', al: ['LAYCUR'] },
  { id: '#layoff', nomi: "Qatlamni o'chirish (elementni bosib)", al: ['LAYOFF'] },
  { id: '#layon', nomi: 'Barcha qatlamlarni yoqish', al: ['LAYON'] },
  { id: '#layfrz', nomi: 'Qatlamni muzlatish (elementni bosib)', al: ['LAYFRZ'] },
  { id: '#laythw', nomi: 'Barcha qatlamlarni eritish', al: ['LAYTHW'] },
  { id: '#laylck', nomi: 'Qatlamni qulflash (elementni bosib)', al: ['LAYLCK'] },
  { id: '#layulk', nomi: 'Qatlam qulfini ochish (elementni bosib)', al: ['LAYULK'] },
  { id: '#layiso', nomi: 'Qatlamni izolyatsiya qilish', al: ['LAYISO'] },
  { id: '#layuniso', nomi: 'Izolyatsiyani qaytarish', al: ['LAYUNISO'] },
  { id: '#matchprop', nomi: 'Xususiyat nusxasi', al: ['MA', 'MATCHPROP'] },
  { id: '#props', nomi: 'Xususiyatlar (tanlanganning)', al: ['PR', 'PROPS', 'PROPERTIES', 'DDMODIFY'] },
  { id: '#ltscale', nomi: 'Punktir masshtabi (LTSCALE)', al: ['LTS', 'LTSCALE'] },
  { id: '#lwdisplay', nomi: "Chiziq qalinligi ko'rinishi", al: ['LWD', 'LWDISPLAY'] },
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
const TOOLS = ['select', 'pline', 'rect', 'polygon', 'circle', 'arc', 'donut', 'point', 'ellipse', 'spline', 'xline', 'ray', 'hatch', 'boundary', 'text', 'dim', 'move', 'copy', 'rotate', 'mirror', 'scale', 'stretch', 'align', 'array', 'offset', 'trim', 'extend', 'break', 'lengthen', 'fillet', 'chamfer', 'explode', 'join', 'pedit', 'erase', 'dist', 'area', 'divide', 'measure'];
const PICK_TOOLS = ['select', 'erase', 'trim', 'extend', 'fillet', 'chamfer', 'explode', 'join', 'pedit', 'lengthen', 'divide', 'measure', 'hatch', 'boundary'];   // obyekt tanlanadi — magnit belgisi ko'rsatilmaydi
const PICK_FIRST = ['move', 'copy', 'rotate', 'mirror', 'scale', 'array', 'align'];   // tanlovsiz tanlansa — avval obyektlar tanlanadi (AutoCAD verb-noun)
// AutoCAD doskasi ranglari (model maydoni: 33,40,48)
const ACAD_BOARD = { bg: '#212830', devor: '#ffffff', accent: '#5b9bff', edit: '#e8edf3', text: '#d5dde7', labelBg: 'rgba(33,40,48,.84)', ref: '#6b7686', kazirok: '#cfd8e3', offset: '#ff66e8', accentSoft: '#1b2230', qozon: '#5b9bff', cross: '#ffffff', snap: '#f2c200' };
const LIVE_TOOLS = ['pline', 'rect', 'polygon', 'circle', 'arc', 'donut', 'point', 'ellipse', 'spline', 'xline', 'ray', 'hatch', 'boundary', 'text', 'dim', 'offset', 'trim', 'extend', 'array', 'fillet', 'chamfer', 'stretch', 'align', 'break', 'lengthen', 'divide', 'measure', 'dist', 'area'];   // kursor harakatida qayta chiziladi   // obyekt tanlanadi — magnit belgisi ko'rsatilmaydi
const CIRCLE_MODES = { cr: 'Markaz, radius', dia: 'Markaz, diametr', '2p': '2 nuqta', '3p': '3 nuqta' };
// Matn normallashtirish (kichik harf + o'zbek apostroflari) — buyruq va kalit so'z solishtirishlari uchun
function cmdNormPlain(s) { return String(s == null ? '' : s).toLowerCase().replace(/[‘’ʻʼ`]/g, "'").trim(); }
// O'lcham turlari (AutoCAD DIMALIGNED / DIMLINEAR / DIMANGULAR / DIMRADIUS / DIMDIAMETER)
const DIM_KINDS = { lin: 'Chiziqli', al: 'Parallel', ang: 'Burchak', rad: 'Radius', dia: 'Diametr' };
const TEXT_FONT = 'Arial, Helvetica, sans-serif';
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
      <button type="button" class="tool etool" data-tool="ellipse" title="Ellips (EL) — markaz → 1-o'q uchi → 2-o'q uzunligi (yoki «O'q, uch»: o'qning ikki uchi). Silliq yopiq kontur — Offset, Kesish va boshqa asboblar bilan ishlaydi; griplar: markaz va o'q uchlari">&#11053; Ellips</button>
      <button type="button" class="tool etool" data-tool="spline" title="Splayn (SPL) — silliq egri: nuqtalarni bosing, egri har biridan o'tadi; Enter — tugatish, C — yopish, Backspace — orqaga. Gul yaproqlari uchun qulay; griplar bilan shaklini o'zgartiring">&#8765; Splayn</button>
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
      <button type="button" class="tool etool" data-tool="pedit" title="Silliqlash (PE) — siniq chiziqni (polyline) bosing: uchlari orqali silliq egriga (splayn) aylanadi; splaynni bosing — qaytadan siniq chiziq (AutoCAD PEDIT Spline / Decurve)">&#8767; Silliqlash</button>
      <button type="button" class="tool etool erase" data-tool="erase" title="O'chirish (E) — element ustiga bosing">O'chirish</button>
    </div><div class="chz-rlbl">Tahrir</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <button type="button" class="tool etool" data-tool="text" title="Matn (T) — joyni bosing, yozing; Enter — keyingi qator, bo'sh Enter yoki Esc — tugatish. Balandlik va burchak pastdagi qatorda. Matnga 2 marta bosib tahrirlang"><b class="chz-ticon">A</b> Matn</button>
      <button type="button" class="tool etool" data-tool="xline" title="Yordamchi chiziq (XL) — ikki tomonga cheksiz: nuqta orqali (1-nuqta, so'ng yo'nalish — takrorlanadi), gorizontal, vertikal yoki burchak bo'yicha. Kesish/Uzaytirish chegarasi, magnit (kesishma) — rasmga chiqmaydi">&#10231; Yordamchi</button>
      <button type="button" class="tool etool" data-tool="ray" title="Nur (RAY) — boshlang'ich nuqtadan bir tomonga cheksiz; har bosishda yangi nur (Enter — tugatish)">&#10230; Nur</button>
      <button type="button" class="tool etool" data-tool="hatch" title="Shtrix (H) — yopiq soha ichiga bosing: yaxlit bo'yoq yoki chiziqli naqsh (oraliq va burchak pastdagi qatorda); ichidagi yopiq konturlar — orollar (bo'yalmaydi). Gul yaproqlarini ajratib ko'rsatish uchun">&#9638; Shtrix</button>
      <button type="button" class="tool etool" data-tool="boundary" title="Kontur (BO) — yopiq soha ichiga bosing: chegarasi (va orollari) yangi element sifatida nusxalanadi (tanlangan bo'ladi)">&#9635; Kontur</button>
      <button type="button" class="tool etool" data-tool="dim" data-dimk="lin" title="Chiziqli o'lcham (DLI) — 2 nuqta, so'ng joy: kursorga qarab gorizontal yoki vertikal">&#8596; Chiziqli</button>
      <button type="button" class="tool etool" data-tool="dim" data-dimk="al" title="Parallel o'lcham (DAL) — 2 nuqta orasidagi haqiqiy (qiya) masofa">&#10529; Parallel</button>
      <button type="button" class="tool etool" data-tool="dim" data-dimk="ang" title="Burchak o'lchami (DAN) — ikki chiziqni (yoki yoyni) bosing, so'ng o'lcham yoyi joyini; bo'sh joy bosilsa — uch nuqta: uch, 1-nur, 2-nur">&#8736; Burchak</button>
      <button type="button" class="tool etool" data-tool="dim" data-dimk="rad" title="Radius o'lchami (DRA) — aylana yoki yoyni bosing, so'ng yozuv joyini">&#9676; Radius</button>
      <button type="button" class="tool etool" data-tool="dim" data-dimk="dia" title="Diametr o'lchami (DDI) — aylana yoki yoyni bosing, so'ng yozuv joyini">&#8960; Diametr</button>
    </div><div class="chz-rlbl">Izoh</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <select class="chz-laysel" data-dtl="laySel" title="Joriy qatlam (AutoCAD CLAYER) — yangi elementlar shu qatlamga tushadi. Tanlangan elementlar bo'lsa — ular shu qatlamga ko'chiriladi"></select>
      <button type="button" class="tool" data-dtl="btnLayMgr" title="Qatlamlar boshqaruvchisi (LA) — yoqish/o'chirish, muzlatish, qulflash, rang, chiziq turi, qalinlik">&#9776; Qatlamlar</button>
      <button type="button" class="tool" data-dtl="btnLayCur" title="Joriy qilish (LAYMCUR) — tanlangan elementning qatlamini joriy qatlam qilish">&#10004; Joriy qilish</button>
    </div><div class="chz-rlbl">Qatlam</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
      <select class="chz-laysel" data-dtl="colSel" title="Rang (AutoCAD CECOLOR) — tanlanganlarga yoki yangi elementlarga. «Qatlam bo'yicha» — rang qatlamdan olinadi"></select>
      <select class="chz-laysel" data-dtl="ltSel" title="Chiziq turi (CELTYPE) — uzluksiz, yashirin punktir, o'q chizig'i…"></select>
      <select class="chz-laysel" data-dtl="lwSel" title="Chiziq qalinligi (CELWEIGHT) — ekranda ko'rinishi uchun «Qalinlik» tugmasini yoqing"></select>
    </div><div class="chz-rlbl">Xususiyatlar</div></div>
    <div class="chz-rgrp"><div class="chz-rbtns">
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
      ${POLAR_INCS.map((a) => '<option value="' + a + '">' + a + '° — ' + [1, 2, 3, 4].map((k) => +(a * k).toFixed(1)).join(', ') + '…</option>').join('')}
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
    <button type="button" class="tool tg" data-dtl="tgBoard" title="AutoCAD doskasi: to'q kulrang fon, oq chiziqlar, ko'k tanlov (o'chirilsa — ilova mavzusi ranglari)">AutoCAD doska</button>
    <span class="sep"></span>
    <button type="button" class="tool tg off" data-dtl="tgLw" title="Chiziq qalinligi ekranda ko'rsatilsin (AutoCAD LWDISPLAY) — qalinlik qatlamdan yoki elementdan olinadi">&#9613; Qalinlik</button>
    <button type="button" class="tool" data-dtl="btnMatch" title="Xususiyat nusxasi (MA / MATCHPROP) — avval namuna elementni, so'ng o'zgartiriladiganlarini bosing (qatlam, rang, chiziq turi, qalinlik ko'chiriladi)">&#128394; Xususiyat nusxasi</button>
  </div>
  <div class="chz-optrow" data-dtl="optRow" style="display:none"></div>
  <div class="chz-main">
    <div class="chz-canvas" data-dtl="canvasWrap">
      <svg data-dtl="svg" xmlns="${SVG_NS}"></svg>
      <div class="chz-selbox" data-dtl="selBox"></div>
      <div class="chz-cmdline" data-dtl="cmdLine" title="Buyruq satri (AutoCAD): buyruq nomi yoki qisqartmasi, kalit so'z, koordinata (120,80 / @50&lt;45 / @30,20) yoki masofa. O'ng tugma — oxirgi buyruqlar, F2 — buyruqlar oynasi">
        <div class="chz-cmdhist" data-dtl="cmdHist"></div>
        <div class="chz-cmdrow">
          <span class="chz-cmdprompt" data-dtl="info"></span>
          <span class="chz-cmdwrap" data-dtl="cmdWrap">
            <input class="chz-cmd" data-dtl="cmd" placeholder="Buyruq yoki koordinata" autocomplete="off" spellcheck="false" title="Buyruq nomi / qisqartmasi (L, C, A, REC, M, CO, TR, O…), kalit so'z (R — Radius), koordinata 120,80 · nisbiy @30,20 · qutbiy @50&lt;45 · masofa 50. Enter/Probel — bajarish, bo'sh Enter — oxirgi buyruqni takrorlash, strelka TEPA — avval yozilganlar" />
            <div class="chz-cmdlist" data-dtl="cmdList"></div>
          </span>
          <button type="button" class="chz-cmdf2" data-dtl="btnTextWin" title="Buyruqlar oynasi — butun tarix (F2)">F2</button>
        </div>
      </div>
      <div class="chz-textwin" data-dtl="textWin">
        <div class="chz-tw-head"><b>Buyruqlar oynasi</b><span>F2 yoki Esc — yopish</span><button type="button" data-dtl="twClose" title="Yopish">&#10005;</button></div>
        <div class="chz-tw-body" data-dtl="twBody"></div>
      </div>
      <div class="chz-dlg" data-dtl="layDlg">
        <div class="chz-dlg-card">
          <div class="chz-dlg-head"><b>Qatlamlar boshqaruvchisi</b><span>AutoCAD LAYER (LA)</span><button type="button" data-dtl="layClose" title="Yopish (Esc)">&#10005;</button></div>
          <div class="chz-dlg-tools">
            <input data-dtl="layNew" type="text" maxlength="64" placeholder="Yangi qatlam nomi" title="Nom yozib «Qo'shish» yoki Enter bosing" />
            <button type="button" class="dtl-btn on" data-dtl="btnLayAdd" title="Yangi qatlam (Alt+N)">&#10010; Qo'shish</button>
            <button type="button" class="dtl-btn" data-dtl="btnLayIso" title="Izolyatsiya (LAYISO) — tanlangan elementlar qatlamlaridan boshqasi o'chiriladi">Izolyatsiya</button>
            <button type="button" class="dtl-btn" data-dtl="btnLayUniso" title="Qaytarish (LAYUNISO) — barcha qatlamlarni yoqish">Hammasini yoqish</button>
            <span class="sep"></span>
            <label class="chz-dlg-lbl" title="LTSCALE — punktir naqshi masshtabi (kattalashtirsangiz shtrixlar uzayadi)">LTSCALE <input data-dtl="ltScaleIn" type="text" inputmode="decimal" data-num="pos" /></label>
            <label class="chz-dlg-lbl"><input type="checkbox" data-dtl="lwShowIn" /> Qalinlik ko'rinsin</label>
          </div>
          <div class="chz-dlg-body" data-dtl="layBody"></div>
          <div class="chz-dlg-foot">Yashil belgi &mdash; joriy qatlam (yangi elementlar shunga tushadi). <b>Lampochka</b> &mdash; ko'rinishi; <b>qor</b> &mdash; muzlatish (magnit ham ishlamaydi); <b>qulf</b> &mdash; ko'rinadi, lekin tanlanmaydi; <b>printer</b> &mdash; DXF/rasmga chiqishi.</div>
        </div>
      </div>
      <div class="chz-ctxmenu" data-dtl="ctxMenu"></div>
      <input class="chz-texted" data-dtl="textEd" type="text" autocomplete="off" spellcheck="false" placeholder="Matn yozing…" />
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
      <div class="chz-listhead">
        <button type="button" class="chz-listbtn" data-dtl="tgProps" title="Xususiyatlar (Ctrl+1) — tanlangan elementning qatlami, rangi, chiziq turi, qalinligi va o'lchovlari">
          <span class="chev">&#9656;</span> Xususiyatlar <span class="dtl-cnt" data-dtl="propCnt"></span>
        </button>
      </div>
      <div class="dtl-props" data-dtl="propBox" style="display:none"></div>
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
        &bull; <b>Doska (AutoCAD)</b>: to'q kulrang fon, oq chiziqlar, krestik kursor (obyekt tanlanadigan asboblarda — quticha), UCS belgisi (X qizil, Y yashil), kursor ostidagi obyekt ajralib turadi, ramka: chapdan o'ngga — ko'k (to'liq ichidagilar), o'ngdan chapga — yashil (kesib o'tganlar ham). <b>Buyruq satri</b> pastda (oxirgi xabarlar tarixi; harf bossangiz buyruq qidiriladi). <b>O'ng tugma</b> — menyu (Takrorlash, Kiritish, Bekor qilish, Orqaga, Hammasini tanlash…), o'ng tugma bilan sudrash — surish. <b>Probel</b> = Enter. G'ildirakni <b>2 marta</b> bosish — markazga. Ko'chirish/Nusxa/Burish/Aks/Masshtab/Massiv/Tekislash tanlovsiz tanlansa — avval obyektlarni tanlang, so'ng Enter (AutoCAD). «AutoCAD doska» tugmasi — mavzu ranglariga qaytish.<br>
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
  // Chizma maydoni palitrasi: AutoCAD doskasi yoki mavzu ranglari (asboblar paneli ranglari o'zgarmaydi)
  function BP() { return state.board === 'acad' ? Object.assign({}, P, ACAD_BOARD) : P; }
  function applyBoard() {
    const on = state.board === 'acad';
    root.classList.toggle('acad-board', on);
    const cw = root.querySelector('[data-dtl="canvasWrap"]'); if (cw) cw.style.background = on ? ACAD_BOARD.bg : '';
  }

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
    cursorIn: false,       // kursor aynan chizma maydoni (svg) ustida — krestik chiziladi
    picking: false,        // buyruq obyekt tanlashni kutmoqda (verb-noun): bosish/ramka qo'shadi, Enter — tayyor
    board: 'acad',         // 'acad' — AutoCAD doskasi (to'q fon, oq chiziqlar), 'theme' — ilova mavzusi ranglari
    // Qatlamlar (AutoCAD Layer) — src/lib/cadLayer.js
    layers: defaultLayers(V.mainLayer),   // [{nomi,on,frozen,locked,color,lt,lw,plot,izoh}]
    clay: V.mainLayer,     // joriy qatlam (CLAYER) — yangi elementlar shunga tushadi
    ltscale: 1,            // LTSCALE — punktir naqshi masshtabi
    lwShow: false,         // LWDISPLAY — qalinlikni ekranda ko'rsatish
    layPrev: null,         // LAYUNISO / LAYERP uchun oldingi holat
    layPick: null,         // LAYOFF/LAYFRZ/LAYLCK/LAYMCUR — element bosilishini kutmoqda
    match: null,           // MATCHPROP — { src } namuna element
    // Asbob variantlari (AutoCAD buyruq variantlari — pastdagi ichki buyruqlar qatori)
    cmdUse: {},            // buyruqlar ishlatilish soni — takliflar tartibi uchun (AutoCAD adaptiv)
    cmdFresh: false,       // buyruq endigina boshlandi (birinchi kiritish kutilmoqda) — kalit so'zlar ustun
    lastPt: null,          // oxirgi qo'yilgan nuqta (AutoCAD LASTPOINT) — «@» shundan
    snapOnce: null,        // bir martalik magnit (END, MID…)
    opt: { col: null, lt: null, lw: null,   // joriy element xossalari (CECOLOR/CELTYPE/CELWEIGHT); null — «Qatlam bo'yicha»
      circleMode: 'cr', copyMulti: true, moveCopy: false, rotateCopy: false, mirrorErase: false, scaleCopy: false, offsetMulti: false,
      filletR: 10, filletPoly: false, filletTrim: true, chamD1: 10, chamD2: 10, chamPoly: false, chamTrim: true,
      polyN: 6, polyMode: 'in', donutIn: 10, donutOut: 20, breakMode: '2p', lenMode: 'delta', lenDelta: 10, lenPct: 110, lenTotal: 1000,
      divN: 5, measLen: 100, areaMode: 'obj', alignScale: false,
      dimKind: 'al', ellMode: 'center', splClosed: false, textH: 30, textRot: 0,
      hatchPat: 'ansi31', hatchSc: 10, hatchAng: 0, xlMode: 'pt', xlAng: 45,
      arr: { kind: 'polar', rows: 2, cols: 2, dr: 200, dc: 200, n: 6, fill: 360 } },
  };

  const svg = q('svg');
  const canvasWrap = q('canvasWrap');
  const inputBox = q('inputBox');
  const in1 = q('f1'), in2 = q('f2');
  const selBoxEl = q('selBox');
  const textEd = q('textEd');
  let fromCmd = false;   // hozirgi amal buyruq satridan kelmoqda — dinamik quti fokusni o'g'irlamasin
  let _loops = null;   // yopiq halqalar keshi (Shtrix / Kontur) — har o'zgarishda tozalanadi
  const HP = 'hp' + Math.random().toString(36).slice(2, 7);   // shtrix naqshlari id prefiksi
  // Matn kengligi (mm): brauzer shrifti bo'yicha o'lchanadi (bo'lmasa — taxmin)
  const _tctx = (() => { try { return document.createElement('canvas').getContext('2d'); } catch (e) { return null; } })();
  function textW(t) {
    const s = String(t.text || '');
    if (_tctx) { _tctx.font = '100px ' + TEXT_FONT; return (_tctx.measureText(s).width / 100) * (t.h / TEXT_CAP); }
    return s.length * 0.6 * (t.h / TEXT_CAP);
  }

  // AutoCAD holat paneli (chizma maydoni pastida): SNAP/GRID/ORTHO/POLAR/OSNAP/OTRACK/DYN + koordinata
  const SNAP_UZ = { osnap: 'Magnit (OSNAP)', grid: "To'r", ortho: 'Orto', gridSnap: "To'rga yopishish", polar: 'Polar', otrack: 'Kuzatish (OTRACK)', dyn: 'Dinamik kiritish' };
  function onSnapChange(key) {
    if (SNAP_UZ[key]) logLine('<' + SNAP_UZ[key] + ' ' + (state.snapSet[key] ? 'yoqildi' : "o'chirildi") + '>');   // AutoCAD: <Ortho on>
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
      ps.value = v;
    }
    if (dsel) dsel.value = String(s.polarDist || 0);
  }

  function U() { return UNITS[state.unit]; }
  function fmtLen(mm) { return fmtNum(mm / U(), 2) + ' ' + UNIT_LABEL[state.unit]; }
  function worldToScreen(x, y) { return { x: x * state.scale + state.panX, y: y * state.scale + state.panY }; }
  function screenToWorld(sx, sy) { return { x: (sx - state.panX) / state.scale, y: (sy - state.panY) / state.scale }; }
  function evScreen(e) { const r = svg.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; }
  /* ---------------- BUYRUQ SATRI TARIXI (AutoCAD command window) ----------------
     cmdLog — hamma qatorlar: kiritilgan buyruqlar aks-sadosi ('cmd'), so'rovlar va xabarlar ('msg'),
     xatolar ('err'). Pastda oxirgi 2 qator ko'rinadi, F2 — butun tarix oynasi. */
  const cmdLog = [];
  const CMD_LOG_MAX = 400;
  let curPrompt = '';
  function logLine(s, kind) {
    if (!s) return;
    const last = cmdLog[cmdLog.length - 1];
    if (last && last.s === s && last.k === (kind || 'msg')) return;   // takror xabar qayta yozilmaydi
    cmdLog.push({ s, k: kind || 'msg' });
    if (cmdLog.length > CMD_LOG_MAX) cmdLog.shift();
    renderCmdLog();
  }
  function renderCmdLog() {
    const h = q('cmdHist');
    if (h) {
      h.innerHTML = cmdLog.slice(-4, -1).map((m) => '<div class="' + (m.k === 'cmd' ? 'ln-cmd' : m.k === 'err' ? 'ln-err' : '') + '">' + escHtml(m.s) + '</div>').join('');
      h.scrollTop = h.scrollHeight;
    }
    const b = q('twBody');
    if (b && q('textWin').classList.contains('show')) {
      b.innerHTML = cmdLog.map((m) => '<div class="' + (m.k === 'cmd' ? 'ln-cmd' : m.k === 'err' ? 'ln-err' : '') + '">' + escHtml(m.s) + '</div>').join('');
      b.scrollTop = b.scrollHeight;
    }
  }
  // So'rov qatori: xabar + joriy asbobning yoziladigan variantlari [Radius/Polyline/Kesish]
  function syncPrompt() {
    const el = q('info'); if (!el) return;
    if (pendingNum) { el.textContent = curPrompt || 'Buyruq:'; return; }   // qiymat kutilmoqda — variantlar ro'yxati ko'rsatilmaydi
    // Bo'sh holat (buyruq kutilmoqda) — AutoCAD «Command:»
    const idle = !state.draft && !state.picking && !state.box && state.tool === 'select';
    if (idle) { el.textContent = 'Buyruq:'; return; }
    const opts = optKeys();
    if (!opts.length) { el.textContent = curPrompt || 'Buyruq:'; return; }
    // Kalit so'zlar bosiladigan havola (AutoCAD 2014+): bosilsa o'sha variant tanlanadi
    const parts = opts.map((o, i) => {
      const extra = [];
      if (o.kw && !o.short.toLowerCase().replace(/\s+/g, '').startsWith(o.kw.toLowerCase())) extra.push(o.kw);
      if (o.alt && o.alt.toLowerCase() !== (o.kw || '').toLowerCase()) extra.push(o.alt);
      return '<b class="chz-kwl" data-k="' + i + '" title="Bosing yoki buyruq satriga yozing">' + escHtml(o.short) + (extra.length ? ' (' + escHtml(extra.join('/')) + ')' : '') + '</b>';
    });
    el.innerHTML = escHtml(curPrompt || 'Buyruq:') + ' yoki [' + parts.join('/') + ']';
  }
  function setInfo(msg, kind) {
    curPrompt = msg || '';
    syncPrompt();
    logLine(msg, kind);
  }
  function toggleTextWin(on) {
    const w = q('textWin'); if (!w) return;
    const open = on == null ? !w.classList.contains('show') : !!on;
    w.classList.toggle('show', open);
    if (open) renderCmdLog();
  }

  /* ---------------- TARIX (undo/redo) ---------------- */
  function snapshot() { return JSON.stringify({ ents: state.ents, nextId: state.nextId, name: state.name, layers: state.layers, clay: state.clay }); }
  function restore(s) {
    const o = JSON.parse(s);
    state.ents = o.ents || []; state.nextId = o.nextId || 1; state.name = o.name || '';
    if (Array.isArray(o.layers) && o.layers.length) { state.layers = o.layers; layDirty(); }
    if (o.clay && findLayer(state.layers, o.clay)) state.clay = findLayer(state.layers, o.clay).nomi;
    q('nameInput').value = state.name;
    state.sel.clear();
  }
  function pushHistory() { state.hist.push(snapshot()); if (state.hist.length > 120) state.hist.shift(); state.redo.length = 0; }
  function undo() { if (!state.hist.length) return; cancelDraft(false); state.redo.push(snapshot()); restore(state.hist.pop()); afterChange(); }
  function redo() { if (!state.redo.length) return; cancelDraft(false); state.hist.push(snapshot()); restore(state.redo.pop()); afterChange(); }

  /* ---------------- ELEMENTLAR ---------------- */
  /* ---------------- QATLAMLAR (AutoCAD Layer) ---------------- */
  const FALLBACK_LAY = makeLayer('0');   // jadval buzilgan bo'lsa ham render yiqilmasin
  let _layMap = null;   // nom -> qatlam (kichik harfda); har o'zgarishda tozalanadi
  function layMap() {
    if (!_layMap) { _layMap = new Map(); for (const l of state.layers) _layMap.set(l.nomi.toLowerCase(), l); }
    return _layMap;
  }
  function layDirty() { _layMap = null; }
  // Element qaysi qatlamda: nomi yo'q (eski chizma) yoki topilmasa — asosiy qatlam
  function layOf(e) {
    const m = layMap();
    return m.get(String(e && e.lay != null ? e.lay : V.mainLayer).toLowerCase())
      || m.get(String(V.mainLayer).toLowerCase()) || state.layers[0] || FALLBACK_LAY;
  }
  function curLay() { return findLayer(state.layers, state.clay) || state.layers[0]; }
  function entHidden(e) { const l = layOf(e); return !l || !l.on || l.frozen; }          // ko'rinmaydi
  function entLocked(e) { const l = layOf(e); return !!(l && l.locked); }                 // ko'rinadi, tanlanmaydi
  function entPickable(e) { const l = layOf(e); return !!l && l.on && !l.frozen && !l.locked; }
  function visEnts() { return state.ents.filter((e) => !entHidden(e)); }                  // chiziladigan
  function pickEnts() { return state.ents.filter(entPickable); }                          // tanlanadigan
  function plotEnts() { const l = (e) => layOf(e); return state.ents.filter((e) => { const x = l(e); return x && x.on && !x.frozen && x.plot !== false; }); }
  // Element uslubi: rang, punktir, qalinlik (qatlam + element ustunligi)
  function styleOf(e, PP, scale, exportMode, mult) {
    return resolveStyle(e, state.layers, {
      ink: PP.devor, ltscale: state.ltscale, pxPerMm: scale, lwOn: state.lwShow,
      mult: mult || 1, exportMode, mainLayer: V.mainLayer,
    });
  }
  // Yangi elementga uslub berish: src bo'lsa — undan meros (Kesish, Ofset, Portlatish
  // natijasi AutoCAD'da asl qatlamda qoladi), aks holda joriy qatlam + joriy xossalar
  function applyStyleTo(e, src) {
    if (src) {
      e.lay = src.lay == null ? state.clay : src.lay;
      if (src.col != null) e.col = src.col;
      if (src.lt != null) e.lt = src.lt;
      if (src.lw != null) e.lw = src.lw;
      return e;
    }
    e.lay = state.clay;
    const o = state.opt;
    if (Number.isFinite(o.col)) e.col = o.col;
    if (o.lt && LT[o.lt]) e.lt = o.lt;
    if (Number.isFinite(o.lw)) e.lw = o.lw;
    return e;
  }
  // Geometriya modulidan kelgan «yalang'och» obyektlarga manba uslubini yopishtirish
  function withStyle(list, src) { for (const o of list || []) if (o && o.lay == null && src) { o.lay = src.lay; if (src.col != null) o.col = src.col; if (src.lt != null) o.lt = src.lt; if (src.lw != null) o.lw = src.lw; } return list; }
  function newEnt(type, props, src) {
    const e = Object.assign({ id: state.nextId++, type }, props);
    if (e.lay == null) applyStyleTo(e, src);
    return e;
  }
  // Kutubxonadan / zakasdan chizma ochilganda: yo'q qatlamlar qo'shiladi (borlari tegilmaydi)
  function mergeLayers(list) {
    if (!Array.isArray(list) || !list.length) return 0;
    let n = 0;
    for (const raw of sanitizeLayers(list, V.mainLayer)) {
      if (!findLayer(state.layers, raw.nomi)) { state.layers.push(raw); n++; }
    }
    if (n) { layDirty(); state.layers = sortLayers(state.layers); }
    return n;
  }
  /* ---- Qatlam amallari (AutoCAD LAYER va LAY* buyruqlari) ---- */
  function setClay(nomi, quiet) {
    const l = findLayer(state.layers, nomi); if (!l) return false;
    if (l.frozen) { setInfo('Muzlatilgan qatlam joriy qilinmaydi — avval eritilsin', 'err'); return false; }
    state.clay = l.nomi;
    syncLayerUI(); saveLS();
    if (!quiet) setInfo('Joriy qatlam: ' + l.nomi);
    return true;
  }
  function layerChanged(msg) {
    layDirty(); _loops = null;
    // Ko'rinmas qatlamga tushgan tanlov bo'shatiladi (AutoCAD ham shunday qiladi)
    for (const id of [...state.sel]) { const e = getEnt(id); if (!e || !entPickable(e)) state.sel.delete(id); }
    computeAutoOff(); render(); renderTable(); syncLayerUI(); renderLayerDlg(); saveLS();
    if (msg) setInfo(msg);
  }
  function addLayer(nomi) {
    const err = layerNameError(nomi, state.layers);
    if (err) { setInfo(err, 'err'); return null; }
    pushHistory();
    const l = makeLayer(nomi, { color: 7 });
    state.layers.push(l); state.layers = sortLayers(state.layers);
    layerChanged('Qatlam qo‘shildi: ' + l.nomi);
    return l;
  }
  function delLayer(nomi) {
    const used = usedLayerNames(state.ents, V.mainLayer);
    const err = canDeleteLayer(state.layers, nomi, used, state.clay);
    if (err) { setInfo(err, 'err'); return false; }
    pushHistory();
    state.layers = state.layers.filter((l) => l.nomi !== normLayerName(nomi));
    layerChanged('Qatlam o‘chirildi: ' + nomi);
    return true;
  }
  function renameLay(oldN, newN) {
    const l = findLayer(state.layers, oldN); if (!l) return false;
    if (l.nomi === '0') { setInfo('Qatlam «0» qayta nomlanmaydi', 'err'); return false; }
    const err = layerNameError(newN, state.layers, l.nomi);
    if (err) { setInfo(err, 'err'); return false; }
    pushHistory();
    const nn = normLayerName(newN), on = l.nomi;
    l.nomi = nn;
    for (const e of state.ents) if (String(e.lay == null ? V.mainLayer : e.lay).toLowerCase() === on.toLowerCase()) e.lay = nn;
    if (state.clay.toLowerCase() === on.toLowerCase()) state.clay = nn;
    state.layers = sortLayers(state.layers);
    layerChanged('Qatlam nomi: ' + on + ' → ' + nn);
    return true;
  }
  // Tanlangan (yoki bosilgan) elementlarni boshqa qatlamga o'tkazish — LAYCUR / CHPROP
  function moveSelToLayer(nomi) {
    const l = findLayer(state.layers, nomi); if (!l || !state.sel.size) return;
    pushHistory();
    for (const e of selectedEnts()) e.lay = l.nomi;
    layerChanged(state.sel.size + ' ta element «' + l.nomi + '» qatlamiga o‘tkazildi');
  }
  // Tanlanganlarning xossasini o'zgartirish (Properties / rang-chiziq turi-qalinlik ro'yxatlari)
  function setSelProp(key, val) {
    if (!state.sel.size) return false;
    pushHistory();
    for (const e of selectedEnts()) { if (val == null) delete e[key]; else e[key] = val; }
    layerChanged(state.sel.size + ' ta elementning xossasi o‘zgardi');
    return true;
  }
  // LAYISO / LAYUNISO — faqat tanlanganlar qatlami qolsin
  function layIso() {
    if (!state.sel.size) { setInfo('Avval obyektlarni tanlang (izolyatsiya qilinadigan qatlamlar shulardan olinadi)', 'err'); return; }
    const keep = new Set(selectedEnts().map((e) => layOf(e).nomi.toLowerCase()));
    pushHistory();
    state.layPrev = JSON.parse(JSON.stringify(state.layers));
    let n = 0;
    for (const l of state.layers) if (!keep.has(l.nomi.toLowerCase())) { l.on = false; n++; }
    layerChanged('Izolyatsiya: ' + keep.size + ' ta qatlam qoldi, ' + n + ' tasi o‘chirildi (LAYUNISO — qaytarish)');
  }
  function layUniso() {
    if (!state.layPrev) { for (const l of state.layers) { l.on = true; l.frozen = false; } layerChanged('Barcha qatlamlar yoqildi'); return; }
    pushHistory();
    const prev = state.layPrev; state.layPrev = null;
    for (const l of state.layers) { const o = findLayer(prev, l.nomi); if (o) { l.on = o.on; l.frozen = o.frozen; } }
    layerChanged('Qatlamlar holati qaytarildi');
  }
  // Bosilgan element qatlamiga amal (LAYOFF / LAYFRZ / LAYLCK / LAYMCUR) — obyektni bosishni kutadi
  function startLayPick(mode) {
    state.layPick = mode;
    setTool('select');
    const nom = { off: 'o‘chirish', frz: 'muzlatish', lck: 'qulflash', ulk: 'qulfni ochish', cur: 'joriy qilish' }[mode] || mode;
    setInfo('Qaysi qatlam ' + nom + ' kerak — o‘sha qatlamdagi elementni bosing (Esc — bekor)');
  }
  function doLayPick(ent) {
    const mode = state.layPick; state.layPick = null;
    const l = layOf(ent); if (!l) return;
    if (mode === 'cur') { setClay(l.nomi); return; }
    pushHistory();
    if (mode === 'off') l.on = false;
    else if (mode === 'frz') { if (l.nomi.toLowerCase() === state.clay.toLowerCase()) { setInfo('Joriy qatlam muzlatilmaydi', 'err'); return; } l.frozen = true; }
    else if (mode === 'lck') l.locked = true;
    else if (mode === 'ulk') l.locked = false;
    layerChanged('«' + l.nomi + '» qatlami: ' + (mode === 'off' ? 'o‘chirildi' : mode === 'frz' ? 'muzlatildi' : mode === 'lck' ? 'qulflandi' : 'qulfi ochildi'));
  }

  /* ---- Xususiyat nusxasi (MATCHPROP / MA) ---- */
  function startMatchProp() {
    if (!state.ents.length) { setInfo('Chizma bo‘sh', 'err'); return; }
    state.match = { src: null }; state.layPick = null;
    setTool('select');
    setInfo('Xususiyat nusxasi: avval NAMUNA elementni bosing');
  }
  function doMatchProp(ent) {
    const m = state.match;
    if (!m.src) {
      m.src = ent;
      setInfo('Namuna olindi (qatlam «' + layOf(ent).nomi + '») — endi o‘zgartiriladigan elementlarni bosing (Esc — tugatish)');
      return;
    }
    const s = m.src;
    if (s.id === ent.id) return;
    pushHistory();
    ent.lay = s.lay == null ? state.clay : s.lay;
    for (const k of ['col', 'lt', 'lw']) { if (s[k] == null) delete ent[k]; else ent[k] = s[k]; }
    layerChanged('Xususiyatlar ko‘chirildi — yana bosing yoki Esc');
  }

  /* ---------------- QATLAM INTERFEYSI ---------------- */
  function ink() { return BP().devor; }
  function layOptions(sel) {
    return state.layers.map((l) => {
      const bad = (!l.on || l.frozen) ? ' — ko‘rinmaydi' : (l.locked ? ' — qulf' : '');
      return '<option value="' + escHtml(l.nomi) + '"' + (l.nomi === sel ? ' selected' : '') + '>' + escHtml(l.nomi) + bad + '</option>';
    }).join('');
  }
  function colOptions(v) {
    let s = '<option value=""' + (v == null ? ' selected' : '') + '>Qatlam bo‘yicha</option>';
    for (const a of ACI_LIST) s += '<option value="' + a + '"' + (v === a ? ' selected' : '') + '>' + a + ' — ' + escHtml(ACI_NOM[a] || '') + '</option>';
    return s;
  }
  function ltOptions(v, withByLayer) {
    let s = withByLayer ? '<option value=""' + (v == null ? ' selected' : '') + '>Qatlam bo‘yicha</option>' : '';
    for (const k of LT_LIST) s += '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + escHtml(LT[k].nomi) + '</option>';
    return s;
  }
  function lwOptions(v, withByLayer) {
    let s = withByLayer ? '<option value=""' + (v == null ? ' selected' : '') + '>Qatlam bo‘yicha</option>' : '';
    for (const w of LW_LIST) s += '<option value="' + w + '"' + (v === w ? ' selected' : '') + '>' + escHtml(lwLabel(w)) + '</option>';
    return s;
  }
  // Lentadagi ro'yxatlar: joriy qatlam + joriy xossalar (tanlov bo'lsa — tanlanganniki)
  function syncLayerUI() {
    const ls = q('laySel'); if (!ls) return;
    const selEnts = selectedEnts();
    const uni = (fn) => { if (!selEnts.length) return undefined; const v = fn(selEnts[0]); return selEnts.every((e) => fn(e) === v) ? v : null; };
    const layV = selEnts.length ? uni((e) => layOf(e).nomi) : state.clay;
    ls.innerHTML = layOptions(layV == null ? '' : layV);
    if (layV == null) ls.value = '';
    const cs = q('colSel'), lt = q('ltSel'), lw = q('lwSel');
    const cv = selEnts.length ? uni((e) => (Number.isFinite(e.col) ? e.col : null)) : state.opt.col;
    const tv = selEnts.length ? uni((e) => (e.lt || null)) : state.opt.lt;
    const wv = selEnts.length ? uni((e) => (Number.isFinite(e.lw) ? e.lw : null)) : state.opt.lw;
    if (cs) { cs.innerHTML = colOptions(cv === undefined ? null : cv); if (cv == null && selEnts.length) cs.value = ''; }
    if (lt) { lt.innerHTML = ltOptions(tv === undefined ? null : tv, true); if (tv == null && selEnts.length) lt.value = ''; }
    if (lw) { lw.innerHTML = lwOptions(wv === undefined ? null : wv, true); if (wv == null && selEnts.length) lw.value = ''; }
    const t = q('tgLw'); if (t) t.classList.toggle('off', !state.lwShow);
  }
  function openLayerDlg(on) {
    const d = q('layDlg'); if (!d) return;
    const show = on == null ? !d.classList.contains('show') : !!on;
    d.classList.toggle('show', show);
    if (show) { renderLayerDlg(); const i = q('ltScaleIn'); if (i) i.value = fmtNum(state.ltscale, 3); const c = q('lwShowIn'); if (c) c.checked = state.lwShow; }
  }
  const LAY_TG = [
    { k: 'on', on: '\u{1F4A1}', off: '\u{1F311}', t: 'Yoqilgan / o‘chirilgan (ko‘rinishi)' },
    { k: 'frozen', on: '❄', off: '☀', t: 'Muzlatilgan / eritilgan' },
    { k: 'locked', on: '\u{1F512}', off: '\u{1F513}', t: 'Qulflangan / ochiq' },
    { k: 'plot', on: '\u{1F5A8}', off: '⊘', t: 'Chop etiladi / etilmaydi (DXF va rasm)' },
  ];
  function renderLayerDlg() {
    const b = q('layBody'); if (!b || !q('layDlg').classList.contains('show')) return;
    const used = usedLayerNames(state.ents, V.mainLayer).map((x) => String(x).toLowerCase());
    const cnt = {};
    for (const e of state.ents) { const n = layOf(e).nomi; cnt[n] = (cnt[n] || 0) + 1; }
    let h = '<table class="chz-laytab"><thead><tr><th title="Joriy qatlam">✓</th><th>Nomi</th><th>\u{1F4A1}</th><th>❄</th><th>\u{1F512}</th><th>\u{1F5A8}</th><th>Rang</th><th>Chiziq turi</th><th>Qalinlik</th><th>Soni</th><th></th></tr></thead><tbody>';
    for (const l of state.layers) {
      const cur = l.nomi.toLowerCase() === state.clay.toLowerCase();
      h += '<tr data-lay="' + escHtml(l.nomi) + '"' + (cur ? ' class="cur"' : '') + '>';
      h += '<td><button type="button" class="lay-cur" data-act="cur" title="Joriy qatlam qilish">' + (cur ? '✔' : '○') + '</button></td>';
      h += '<td><input class="lay-nom" data-act="nom" value="' + escHtml(l.nomi) + '"' + (l.nomi === '0' ? ' readonly' : '') + ' title="Nomini o‘zgartirib Enter bosing" /></td>';
      for (const t of LAY_TG) {
        const onv = t.k === 'frozen' || t.k === 'locked' ? !l[t.k] : l[t.k] !== false;
        h += '<td><button type="button" class="lay-tg' + (onv ? '' : ' off') + '" data-act="' + t.k + '" title="' + t.t + '">' + (onv ? t.on : t.off) + '</button></td>';
      }
      h += '<td><span class="chz-sw" style="background:' + aciHex(l.color, ink()) + '"></span><select class="lay-sel" data-act="color">' + colOptions(l.color).replace('<option value="" selected>', '<option value="">') + '</select></td>';
      h += '<td><select class="lay-sel" data-act="lt">' + ltOptions(l.lt, false) + '</select></td>';
      h += '<td><select class="lay-sel" data-act="lw">' + lwOptions(l.lw, false) + '</select></td>';
      h += '<td class="lay-cnt">' + (cnt[l.nomi] || 0) + '</td>';
      const del = l.nomi === '0' || cur || used.includes(l.nomi.toLowerCase());
      h += '<td><button type="button" class="lay-del" data-act="del"' + (del ? ' disabled' : '') + ' title="' + (del ? 'O‘chirib bo‘lmaydi (0, joriy yoki elementli qatlam)' : 'Qatlamni o‘chirish') + '">✕</button></td></tr>';
    }
    b.innerHTML = h + '</tbody></table>';
    // rang ro'yxatida tanlangan qiymat
    b.querySelectorAll('tr[data-lay]').forEach((tr) => {
      const l = findLayer(state.layers, tr.getAttribute('data-lay')); if (!l) return;
      const c = tr.querySelector('select[data-act="color"]'); if (c) c.value = String(l.color);
    });
  }
  // Yon paneldagi «Xususiyatlar» (AutoCAD Properties, Ctrl+1)
  function renderProps() {
    const box = q('propBox'), cnt = q('propCnt'); if (!box) return;
    const list = selectedEnts();
    if (cnt) cnt.textContent = list.length ? '(' + list.length + ')' : '';
    if (box.style.display === 'none') return;
    if (!list.length) { box.innerHTML = '<div class="dtl-propempty">Hech narsa tanlanmagan. Element(lar)ni tanlang — qatlami, rangi, chiziq turi, qalinligi va o‘lchovlari shu yerda ko‘rinadi va o‘zgartiriladi.</div>'; return; }
    const uni = (fn) => { const v = fn(list[0]); return list.every((e) => fn(e) === v) ? v : null; };
    const TN = { pline: 'Siniq chiziq', circle: 'Aylana', arc: 'Yoy', point: 'Nuqta', text: 'Matn', dim: "O'lcham", hatch: 'Shtrix', xline: 'Yordamchi chiziq', ray: 'Nur' };
    const tp = uni((e) => e.type);
    let h = '<div class="dtl-prow"><span>Turi</span><b>' + (tp ? escHtml(TN[tp] || tp) : list.length + ' xil element') + '</b></div>';
    h += '<div class="dtl-prow"><span>Qatlam</span><select data-prop="lay">' + layOptions(uni((e) => layOf(e).nomi) || '') + '</select></div>';
    h += '<div class="dtl-prow"><span>Rang</span><select data-prop="col">' + colOptions(uni((e) => (Number.isFinite(e.col) ? e.col : null))) + '</select></div>';
    h += '<div class="dtl-prow"><span>Chiziq turi</span><select data-prop="lt">' + ltOptions(uni((e) => (e.lt || null)), true) + '</select></div>';
    h += '<div class="dtl-prow"><span>Qalinlik</span><select data-prop="lw">' + lwOptions(uni((e) => (Number.isFinite(e.lw) ? e.lw : null)), true) + '</select></div>';
    // Geometriya (bitta element tanlansa)
    if (list.length === 1) {
      const e = list[0];
      const row = (k, v) => { h += '<div class="dtl-prow ro"><span>' + k + '</span><b>' + v + '</b></div>'; };
      if (e.type === 'circle') { row('Markaz', fmtNum(e.cx / U(), 2) + ', ' + fmtNum(-e.cy / U(), 2)); row('Radius', fmtLen(e.r)); row('Diametr', fmtLen(e.r * 2)); row('Uzunlik', fmtLen(2 * Math.PI * e.r)); }
      else if (e.type === 'arc') { row('Markaz', fmtNum(e.cx / U(), 2) + ', ' + fmtNum(-e.cy / U(), 2)); row('Radius', fmtLen(e.r)); row('Burchak', fmtAng(arcSweep(e))); row('Uzunlik', fmtLen(arcLen(e))); }
      else if (e.type === 'pline') {
        let L = 0; for (const s of plineSegs(e)) L += dist(s.a, s.b);
        row('Tugunlar', e.pts.length); row('Yopiq', e.closed ? 'ha' : "yo'q"); row('Uzunlik', fmtLen(L));
        if (e.closed) row('Yuza', fmtArea(Math.abs(polyArea(e.pts))));
      } else if (e.type === 'text') { row('Matn', escHtml(e.text)); row('Balandlik', fmtLen(e.h)); row('Burchak', fmtAng(e.rot || 0)); }
      else if (e.type === 'point') row('Koordinata', fmtNum(e.x / U(), 2) + ', ' + fmtNum(-e.y / U(), 2));
      else if (e.type === 'hatch') { row('Yuza', fmtArea(e.area || 0)); row('Naqsh', escHtml(e.pat)); row('Oraliq', fmtLen(e.sc)); row('Burchak', fmtAng(e.ang || 0)); }
      else if (e.type === 'dim') { row('Turi', DIM_KINDS[dimKind(e)] || dimKind(e)); row('Qiymat', escHtml(dimValueText(e))); }
      else if (isCons(e)) { row('Nuqta', fmtNum(e.x / U(), 2) + ', ' + fmtNum(-e.y / U(), 2)); row('Burchak', fmtAng(e.ang)); }
    }
    box.innerHTML = h;
  }
  function getEnt(id) { return state.ents.find((e) => e.id === id); }
  function cloneEnt(e) { const c = JSON.parse(JSON.stringify(e)); c.id = state.nextId++; return c; }
  // Izoh obyektlari (o'lcham, nuqta, matn) — Offset / Kesish / Tutashtirish kabi asboblar ularni olmaydi
  function isAnno(e) { return e.type === 'dim' || e.type === 'point' || e.type === 'text' || e.type === 'hatch' || isCons(e); }
  function isCons(e) { return e.type === 'xline' || e.type === 'ray'; }   // yordamchi chiziq / nur — cheksiz
  // Proyeksiya bog'lanish chiziqlari uchun tugunlar: izohlar yo'q, silliq egrida — faqat chekka nuqtalar
  function projVerts(e) {
    if (e.type === 'text' || e.type === 'dim' || e.type === 'hatch' || isCons(e)) return [];
    if (e.type === 'pline' && e.smooth && e.pts.length > 4) {
      let a = e.pts[0], b = a, c = a, d = a;
      for (const p of e.pts) { if (p.x < a.x) a = p; if (p.x > b.x) b = p; if (p.y < c.y) c = p; if (p.y > d.y) d = p; }
      return [a, b, c, d];
    }
    return entVerts(e);
  }
  function entVerts(e) {
    if (e.type === 'pline') return e.pts;
    if (e.type === 'text') return textBox(e, textW(e));
    if (e.type === 'hatch') return [].concat(...e.loops);
    if (isCons(e)) return [{ x: e.x, y: e.y }];
    if (e.type === 'arc') { const o = [arcStart(e), arcEnd(e)]; for (const qd of [0, 90, 180, 270]) if (angInArc(e, qd)) o.push(arcPt(e, qd)); return o; }   // uchlari + kvadrant chekkalari (gabarit, proyeksiya, tanlash)
    if (e.type === 'circle') return [{ x: e.cx - e.r, y: e.cy }, { x: e.cx + e.r, y: e.cy }, { x: e.cx, y: e.cy - e.r }, { x: e.cx, y: e.cy + e.r }];
    if (e.type === 'dim') return dimKeyPts(e);
    if (e.type === 'point') return [{ x: e.x, y: e.y }];
    return [];
  }
  function mapEnt(e, fn, rFactor) {
    if (e.type === 'point') { const q2 = fn({ x: e.x, y: e.y }); e.x = q2.x; e.y = q2.y; return; }
    if (e.type === 'text') { Object.assign(e, textMap(e, textW(e), fn)); return; }
    if (isCons(e)) { const u = dirVec(e.ang), a = fn({ x: e.x, y: e.y }), b = fn({ x: e.x + u.dx, y: e.y + u.dy }); e.x = a.x; e.y = a.y; e.ang = vecAng(b.x - a.x, b.y - a.y); return; }
    if (e.type === 'hatch') {   // naqsh burchagi ham birga buriladi; masshtabda oraliq ham
      const off = e.pat === 'line' ? 0 : 45;   // chizilgan chiziqlar yo'nalishi (ang + off) akslantiriladi — ko'zguda ham to'g'ri
      const p0 = (e.loops[0] && e.loops[0][0]) || { x: 0, y: 0 }, u = dirVec((e.ang || 0) + off), a = fn(p0), b = fn({ x: p0.x + u.dx, y: p0.y + u.dy });
      const s = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      e.ang = norm360(vecAng(b.x - a.x, b.y - a.y) - off);
      e.sc = Math.abs(e.sc * s);
      if (Number.isFinite(e.area)) e.area *= s * s;
      e.loops = e.loops.map((l) => l.map(fn)); return;
    }
    if (e.type === 'pline') { e.pts = e.pts.map(fn); if (e.fit) e.fit = e.fit.map(fn); if (e.ell) e.ell = ellipseMap(e.ell, fn); }
    else if (e.type === 'arc') { const a = arcMap(e, fn); if (a) Object.assign(e, a); }   // aks ettirishda yo'nalish ham tuzatiladi
    else if (e.type === 'circle') { const c = fn({ x: e.cx, y: e.cy }); e.cx = c.x; e.cy = c.y; if (rFactor != null) e.r = Math.abs(e.r * rFactor); }
    else if (e.type === 'dim') {
      if (e.kind === 'lin') { const u = dirVec(e.rot || 0), p0 = fn({ x: e.x1, y: e.y1 }), pu = fn({ x: e.x1 + u.dx, y: e.y1 + u.dy }); e.rot = vecAng(pu.x - p0.x, pu.y - p0.y); }
      if (e.kind === 'ang') { const c = fn({ x: e.cx, y: e.cy }), l = fn({ x: e.lx, y: e.ly }); e.cx = c.x; e.cy = c.y; e.lx = l.x; e.ly = l.y; }
      const a = fn({ x: e.x1, y: e.y1 }), b = fn({ x: e.x2, y: e.y2 });
      e.x1 = a.x; e.y1 = a.y; e.x2 = b.x; e.y2 = b.y;
      if (e.kind === 'ang' && e.arc) {   // yoy o'lchami CCW boshi→oxiri: aks ettirishda uchlari almashadi
        const o0 = fn({ x: 0, y: 0 }), ox = fn({ x: 1, y: 0 }), oy = fn({ x: 0, y: 1 });
        if ((ox.x - o0.x) * (oy.y - o0.y) - (ox.y - o0.y) * (oy.x - o0.x) < 0) { const tx = e.x1, ty = e.y1; e.x1 = e.x2; e.y1 = e.y2; e.x2 = tx; e.y2 = ty; }
      }
      if (rFactor != null) { if (e.off != null) e.off *= Math.abs(rFactor); if (e.r != null) e.r = Math.abs(e.r * rFactor); }
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
    if (e.type === 'text') return { d: distToTextBox(e, textW(e), { x: wx, y: wy }), seg: -1 };
    if (isCons(e)) {
      const u = dirVec(e.ang), dx = wx - e.x, dy = wy - e.y, t = dx * u.dx + dy * u.dy;
      if (e.type === 'ray' && t < 0) return { d: Math.hypot(dx, dy), seg: -1 };
      return { d: Math.abs(dx * u.dy - dy * u.dx), seg: -1 };
    }
    if (e.type === 'hatch') {   // ichida — 5 px (ustidagi chiziqlar afzal), chegarada +2 px (kontur chizig'i afzal)
      if (pointInLoops({ x: wx, y: wy }, e.loops)) return { d: 5 / state.scale, seg: -1 };
      let best = Infinity;
      for (const l of e.loops) for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; best = Math.min(best, distToSeg(wx, wy, a.x, a.y, b.x, b.y)); }
      return { d: best + 2 / state.scale, seg: -1 };
    }
    if (e.type === 'dim') return { d: distToDim(e, { x: wx, y: wy }), seg: -1 };
    return { d: Infinity, seg: -1 };
  }
  function entAt(sx, sy) {
    const thr = 7 / state.scale;
    const w = screenToWorld(sx, sy);
    let best = null, bd = thr, bseg = -1;
    // Qatlam o'chiq/muzlatilgan yoki QULFLANGAN bo'lsa — tanlanmaydi (AutoCAD)
    for (const e of state.ents) { if (!entPickable(e)) continue; const r = distToEnt(e, w.x, w.y); if (r.d <= bd) { bd = r.d; best = e; bseg = r.seg; } }
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
      if (isCons(e)) continue;   // cheksiz yordamchi chiziqlar gabaritga (Ctrl+E, PNG) kirmaydi — AutoCAD kabi
      if (e.type === 'arc') { const ab = arcBounds(e); add({ x: ab.minX, y: ab.minY }); add({ x: ab.maxX, y: ab.maxY }); continue; }
      for (const p of entVerts(e)) add(p);
      if (e.type === 'dim') for (const p of dimExtentPts(e)) add(p);
    }
    if (withDraft && state.draft && state.draft.pts) for (const p of state.draft.pts) add(p);
    if (withFrames && state.proj.on) { add({ x: state.proj.sepX, y: state.proj.sepY }); add({ x: state.proj.sepX + state.proj.gap, y: state.proj.sepY + state.proj.gap }); }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }
  // Gabarit (Ctrl+E, PNG): ko'rinmaydigan qatlamlar hisobga olinmaydi (AutoCAD ZOOM Extents)
  function bounds(withFrames) { const v = visEnts(); return boundsOf(v.length ? v : state.ents, true, withFrames); }

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
    // O'chiq/muzlatilgan qatlamga magnit yopishmaydi (qulflanganga — yopishadi, AutoCAD kabi)
    return buildGeom(state.ents, { skip: (e) => (skipEid != null && e.id === skipEid) || entHidden(e), nodes, segs });
  }
  // Ekran nuqtasini world nuqtaga: OSNAP > kuzatish kesishmasi > polar/orto > kuzatish > to'r > xom
  function resolveCursor(sx, sy, from, skipEid) {
    const geom = snapGeom(skipEid);
    const cur = screenToWorld(sx, sy);
    // Bir martalik magnit (AutoCAD: buyruq satridan END, MID, CEN… yozilsa — faqat shu rejim, bitta nuqtaga)
    const sset = state.snapOnce ? Object.assign({}, state.snapSet, { osnap: true, modes: Object.assign({}, ...SNAP_MODES.map((m) => ({ [m.key]: m.key === state.snapOnce }))) }) : state.snapSet;
    const res = resolveSnap({ geom, cur, scale: state.scale, settings: sset, from, skipEid, acquired: state.track.acq, gridStep: gridStep(), guides: projGuides(cur) });
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
  function vertsOf(view) { const out = []; for (const e of state.ents) if (viewOf(e) === view) for (const p of projVerts(e)) out.push(p); return out; }
  function projCounts() { const c = { V: 0, H: 0, W: 0 }; for (const e of state.ents) { const v = viewOf(e); if (v) c[v]++; } return c; }
  // Boshqa proyeksiyalardagi uchlardan BOG'LANISH chiziqlari — magnit (osnap guides)
  function projGuides(cur) {
    if (!state.proj.on || !state.proj.guides) return [];
    const view = viewAt(cur); if (!view) return [];
    const P = projP(), out = [], seen = new Set();
    const add = (x, y, ang) => { const k = ang + ':' + Math.round((ang === 90 ? x : y) * 100); if (seen.has(k)) return; seen.add(k); out.push({ x, y, ang }); };
    for (const e of state.ents) {
      const ev = viewOf(e); if (!ev || ev === view) continue;
      for (const p of projVerts(e)) {
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
      const b = boundsOf(visEnts(), false, false);
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
    for (const ch of buildChains(visEnts())) {
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
    if (d.tool === 'rect') return d.p1 || null;
    if (d.tool === 'text') return d.p || null;
    if (d.tool === 'arc') return arcPrev(d);
    if (d.tool === 'dim') {
      if (d.kind === 'ang') return d.V && !d.p2 ? d.V : null;
      if (d.kind === 'rad' || d.kind === 'dia') return d.c || null;
      return d.p2 ? null : (d.p1 || null);
    }
    if (d.tool === 'spline') return d.pts[d.pts.length - 1];
    if (d.tool === 'xline' || d.tool === 'ray') return d.base || null;
    if (d.tool === 'ellipse') return d.mode === 'axis' ? (d.p2 ? null : d.p1) : (d.a ? null : d.c);
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
    if (fromCmd) return;   // buyruq satridan kiritilgan nuqta — fokus o'sha yerda qoladi (AutoCAD)
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
    if (!state.box || fromCmd) return;
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
      dim: ({ al: "O'lcham (parallel): 1-nuqtani bosing", lin: "O'lcham (chiziqli): 1-nuqtani bosing — gorizontal yoki vertikal kursorga qarab", ang: "O'lcham (burchak): 1-chiziqni yoki yoyni bosing (bo'sh joy — uch nuqtasi)", rad: "O'lcham (radius): aylana yoki yoyni bosing", dia: "O'lcham (diametr): aylana yoki yoyni bosing" })[state.opt.dimKind || 'al'],
      xline: ({ pt: "Yordamchi chiziq: 1-nuqtani bosing, so'ng yo'nalishini (har bosishda yangisi)", hor: 'Yordamchi chiziq (gorizontal): joyini bosing', ver: 'Yordamchi chiziq (vertikal): joyini bosing', ang: 'Yordamchi chiziq (' + fmtAng(state.opt.xlAng) + '): joyini bosing' })[state.opt.xlMode],
      ray: "Nur: boshlang'ich nuqtani bosing, so'ng yo'nalishini (har bosishda yangi nur)",
      hatch: "Shtrix (" + ({ solid: 'yaxlit', ansi31: 'qiya chiziq', net: "to'r", line: 'gorizontal' })[state.opt.hatchPat] + "): yopiq soha ichiga bosing",
      boundary: 'Kontur: yopiq soha ichiga bosing — chegarasi yangi element bo\'lib chiziladi',
      ellipse: state.opt.ellMode === 'axis' ? "Ellips (O'q, uch): o'qning 1-uchini bosing" : 'Ellips (Markaz): markazni bosing',
      spline: "Splayn: 1-nuqtani bosing — egri har bir nuqtadan o'tadi; Enter — tugatish" + (state.opt.splClosed ? ' (yopiq)' : ''),
      text: 'Matn (balandlik ' + fmtLen(state.opt.textH) + (state.opt.textRot ? ', burchak ' + fmtAng(state.opt.textRot) : '') + '): joyini bosing',
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
      pedit: "Silliqlash: siniq chiziqni bosing — silliq egri (splayn) bo'ladi; splaynni bosing — qaytadan siniq chiziq",
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
    state.picking = false;
    if (t === 'erase' && state.sel.size) { const n = state.sel.size; eraseSelected(); state.tool = 'select'; syncButtons(); render(); setInfo(n + " ta obyekt o'chirildi"); return; }   // AutoCAD noun-verb
    if ((t === 'explode' || t === 'join') && state.sel.size) {   // oldin tanlangan bo'lsa — darhol bajariladi
      const list = selectedEnts(); state.tool = 'select'; syncButtons();
      if (t === 'explode') explodeEnts(list); else joinSelected(list);
      return;
    }
    state.cmdFresh = true;   // buyruq boshlandi: birinchi kiritishgacha kalit so'zlar ustun
    state.snapOnce = null; pendingNum = null;
    if (PICK_FIRST.includes(t) && !state.sel.size) { state.picking = true; setInfo(toolLabel(t) + ": obyektlarni tanlang (bosing yoki ramka torting), so'ng Enter / Probel / o'ng tugma"); }
    else setInfo(toolHint(t));
    if (t === 'arc') arcAutoStart();
    syncButtons(); render();
  }
  // Amaldagi jarayonni to'xtatish. finish=true — chizilayotgan chiziq saqlanib qoladi.
  function cancelDraft(finish) {
    const d = state.draft;
    if (d && d.tool === 'pline' && finish) { finishPline(false); return; }
    if (d && d.tool === 'spline' && finish) { finishSpline(null); return; }
    if (d && d.tool === 'text') { if (finish && d.edit == null) { textCommit(false); return; } closeTextEd(); }
    state.draft = null; closeBox(); state.snapHit = null;
  }
  function cancelCurrent() {
    if (state.draft || state.box || state.picking) logLine('*Bekor qilindi*');
    state.snapOnce = null; state.cmdFresh = false; pendingNum = null;
    if (state.picking) { state.picking = false; state.sel.clear(); setTool('select'); state.cmdFresh = false; setInfo('*Bekor qilindi*'); return; }
    if (state.draft && state.draft.tool === 'pline') { finishPline(false); return; }
    if (state.draft && state.draft.tool === 'spline') { finishSpline(null); return; }
    if (state.draft && state.draft.tool === 'text') { textCommit(false); return; }
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

  /* ---- O'lchamlar (AutoCAD DIMALIGNED / DIMLINEAR / DIMANGULAR / DIMRADIUS / DIMDIAMETER) ----
     dim: { x1,y1,x2,y2, off } — parallel (kind yo'q); kind 'lin' — + rot (0° / 90°, off — rot normali bo'yicha);
     'ang' — nurlardagi nuqtalar x1..y2 + cx,cy (uch) + lx,ly (o'lcham yoyi joyi);
     'rad' / 'dia' — x1,y1 markaz, x2,y2 yozuv joyi, r. Geometriya: src/lib/curveGeom.js */
  function dimKind(e) { return e.kind || 'al'; }
  function dimKeyPts(e) {
    if (dimKind(e) === 'ang') return [{ x: e.cx, y: e.cy }, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
    return [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
  }
  // Gabarit uchun: o'lcham chizig'i / yoyi / yozuv joyi ham
  function dimExtentPts(e) {
    const k = dimKind(e), out = dimKeyPts(e);
    if (k === 'al') { const n = dimNormal(e); out.push({ x: e.x1 + n.x * e.off, y: e.y1 + n.y * e.off }, { x: e.x2 + n.x * e.off, y: e.y2 + n.y * e.off }); }
    else if (k === 'lin') { const r = rotatedDim(e); out.push(r.a, r.b); }
    else if (k === 'ang') { const a = angularDim(e); for (let i = 0; i <= 8; i++) { const v = dirVec(a.a0 + (a.sweep * i) / 8); out.push({ x: e.cx + v.dx * a.r, y: e.cy + v.dy * a.r }); } }
    else { const r = radialDim(e); out.push(r.P, r.L); if (k === 'dia') out.push(r.Q); }
    return out;
  }
  function dimValueText(e) {
    const k = dimKind(e);
    if (k === 'lin') return fmtLen(rotatedDim(e).value);
    if (k === 'ang') return fmtAng(angularDim(e).sweep);
    if (k === 'rad') return 'R ' + fmtLen(e.r);
    if (k === 'dia') return 'Ø ' + fmtLen(2 * e.r);
    return fmtLen(dist({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }));
  }
  function distToDim(e, w) {
    const k = dimKind(e), sg = (a, b) => distToSeg(w.x, w.y, a.x, a.y, b.x, b.y);
    const p1 = { x: e.x1, y: e.y1 }, p2 = { x: e.x2, y: e.y2 };
    if (k === 'al') { const n = dimNormal(e); return Math.min(sg({ x: e.x1 + n.x * e.off, y: e.y1 + n.y * e.off }, { x: e.x2 + n.x * e.off, y: e.y2 + n.y * e.off }), sg(p1, p2)); }
    if (k === 'lin') { const r = rotatedDim(e); return Math.min(sg(r.a, r.b), sg(p1, r.a), sg(p2, r.b)); }
    if (k === 'ang') {
      const a = angularDim(e), th = vecAng(w.x - e.cx, w.y - e.cy);
      const onArc = norm360(th - a.a0) <= a.sweep + 1e-9 ? Math.abs(dist(a.V, w) - a.r) : Infinity;
      const v0 = dirVec(a.a0), v1 = dirVec(a.a1);
      return Math.min(onArc, dist(w, { x: e.cx + v0.dx * a.r, y: e.cy + v0.dy * a.r }), dist(w, { x: e.cx + v1.dx * a.r, y: e.cy + v1.dy * a.r }));
    }
    const r = radialDim(e);
    return sg(k === 'dia' ? r.Q : r.c, r.out ? r.L : r.P);
  }
  function projOnLine(a, b, p) {
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }
  function dimOff(p1, p2, w) {
    const n = dimNormal({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    const o = (w.x - p1.x) * n.x + (w.y - p1.y) * n.y;
    return Math.abs(o) < 1e-6 ? 24 / state.scale : o;
  }
  // Parallel / chiziqli qoralamadan o'lcham (kursor — joy)
  function dimDraftEnt(d, cur) {
    if (d.kind === 'lin') { const rot = linearRot(d.p1, d.p2, cur); return { kind: 'lin', x1: d.p1.x, y1: d.p1.y, x2: d.p2.x, y2: d.p2.y, rot, off: rotatedOff(d.p1, rot, cur) }; }
    return { x1: d.p1.x, y1: d.p1.y, x2: d.p2.x, y2: d.p2.y, off: dimOff(d.p1, d.p2, cur) };
  }
  function commitDim(props) {
    state.draft = null;
    if (!props.kind || props.kind === 'al') delete props.kind;
    pushHistory();
    state.ents.push(newEnt('dim', props));
    afterChange(); setInfo(dimValueText(props) + ' — ' + toolHint('dim'));
  }
  function dimClick(w, sx, sy) {
    const k = state.opt.dimKind || 'al', d = state.draft;
    const nm = "O'lcham (" + DIM_KINDS[k].toLowerCase() + ')';
    if (k === 'rad' || k === 'dia') {
      if (!d) {
        const hit = entAt(sx, sy);
        if (!hit || (hit.ent.type !== 'circle' && hit.ent.type !== 'arc')) { setInfo(nm + ': aylana yoki yoyni bosing'); return; }
        state.draft = { tool: 'dim', kind: k, c: { x: hit.ent.cx, y: hit.ent.cy }, r: hit.ent.r };
        setInfo(nm + ': yozuv joyini bosing'); render(); return;
      }
      commitDim({ kind: k, x1: d.c.x, y1: d.c.y, x2: w.x, y2: w.y, r: d.r }); return;
    }
    if (k === 'ang') {
      if (!d) {
        const hit = entAt(sx, sy), raw = screenToWorld(sx, sy);
        if (hit && hit.ent.type === 'arc') {
          const a = hit.ent;
          state.draft = { tool: 'dim', kind: 'ang', V: { x: a.cx, y: a.cy }, p1: arcStart(a), p2: arcEnd(a), arc: true };
          setInfo(nm + ": o'lcham yoyi joyini bosing"); render(); return;
        }
        const cv = hit && !isAnno(hit.ent) ? curveOf(hit.ent, hit.seg) : null;
        if (cv && cv.kind === 'line') { state.draft = { tool: 'dim', kind: 'ang', l1: { a: cv.a, b: cv.b, p: projOnLine(cv.a, cv.b, raw) } }; setInfo(nm + ': ikkinchi chiziqni bosing'); render(); return; }
        state.draft = { tool: 'dim', kind: 'ang', V: WP(w), three: true };
        setInfo(nm + " (3 nuqta): 1-nurdagi nuqtani bosing"); render(); return;
      }
      if (d.l1 && !d.V) {
        const hit = entAt(sx, sy), raw = screenToWorld(sx, sy);
        const cv = hit && !isAnno(hit.ent) ? curveOf(hit.ent, hit.seg) : null;
        if (!cv || cv.kind !== 'line') { setInfo(nm + ': ikkinchi chiziqni (segmentni) bosing'); return; }
        const V = lineInt(d.l1.a, d.l1.b, cv.a, cv.b);
        if (!V) { setInfo("Chiziqlar parallel — burchak yo'q. Boshqa chiziqni bosing"); return; }
        const onL = (l, p) => (dist(p, V) > 1e-6 ? p : (dist(l.a, V) > dist(l.b, V) ? l.a : l.b));
        d.V = V; d.p1 = onL(d.l1, d.l1.p); d.p2 = onL(cv, projOnLine(cv.a, cv.b, raw));
        setInfo(nm + ": o'lcham yoyi joyini bosing (4 sektordan biri)"); render(); return;
      }
      if (d.three && !d.p1) { if (dist(w, d.V) < 1e-6) return; d.p1 = WP(w); setInfo(nm + ': 2-nurdagi nuqtani bosing'); render(); return; }
      if (d.three && !d.p2) { if (dist(w, d.V) < 1e-6) return; d.p2 = WP(w); setInfo(nm + ": o'lcham yoyi joyini bosing"); render(); return; }
      if (d.V && d.p1 && d.p2) commitDim(Object.assign({ kind: 'ang', cx: d.V.x, cy: d.V.y, x1: d.p1.x, y1: d.p1.y, x2: d.p2.x, y2: d.p2.y, lx: w.x, ly: w.y }, d.arc ? { arc: true } : {}));
      return;
    }
    if (!d) { state.draft = { tool: 'dim', kind: k, p1: WP(w) }; setInfo(nm + ': 2-nuqtani bosing'); render(); return; }
    if (!d.p2) { if (dist(d.p1, w) < 1e-6) return; d.p2 = WP(w); setInfo(nm + ": o'lcham chizig'i turadigan joyni bosing"); render(); return; }
    commitDim(dimDraftEnt(d, state.cursor));
  }

  /* ---- Ellips (EL) — silliq yopiq polyline (AutoCAD PELLIPSE=1 kabi), parametrlari ell da ---- */
  function ellFromDraft(d, cur, r2) {
    if (d.mode === 'axis') { if (!d.p2) return null; const c = { x: (d.p1.x + d.p2.x) / 2, y: (d.p1.y + d.p2.y) / 2 }; return ellipseFromAxis(d.p1, d.p2, r2 != null ? r2 : distToAxis(c, d.p2, cur)); }
    if (!d.a) return null;
    return ellipseFromCenter(d.c, d.a, r2 != null ? r2 : distToAxis(d.c, d.a, cur));
  }
  function ellipseClick(w) {
    const d = state.draft, axis = state.opt.ellMode === 'axis';
    if (!d) {
      state.draft = axis ? { tool: 'ellipse', mode: 'axis', p1: WP(w) } : { tool: 'ellipse', mode: 'center', c: WP(w) };
      openBox({ anchor: w, f1: { label: axis ? "O'q uzunligi" : "1-o'q (yarim)", unit: 'len' }, f2: { label: 'Burchak', unit: 'ang' },
        onCommit: (L, ang) => {
          if (!(L > 0)) { setInfo("Uzunlik (+ burchak) yozing yoki o'q uchini bosing"); return; }
          const dd = state.draft, b = dd.mode === 'axis' ? dd.p1 : dd.c, v = dirVec(norm360(ang || 0));
          ellipseClick({ x: b.x + v.dx * L * U(), y: b.y + v.dy * L * U() });
        } });
      setInfo(axis ? "Ellips: o'qning 2-uchini bosing (yoki uzunlik + burchak yozing)" : "Ellips: 1-o'q uchini bosing (yoki yarim uzunlik + burchak yozing)"); render(); return;
    }
    if (d.mode === 'axis' ? !d.p2 : !d.a) {
      const base = d.mode === 'axis' ? d.p1 : d.c;
      if (dist(base, w) < 1e-6) return;
      if (d.mode === 'axis') d.p2 = WP(w); else d.a = WP(w);
      openBox({ anchor: w, f1: { label: "2-o'q (yarim)", unit: 'len' }, f2: null,
        onCommit: (r2) => { if (r2 > 0) finishEllipse(r2 * U()); else setInfo("2-o'q yarim uzunligini yozing yoki bosing"); } });
      setInfo("Ellips: 2-o'q yarim uzunligini yozing yoki sichqoncha bilan bosing"); render(); return;
    }
    const [v1] = boxVals();   // qutida yozilgan 2-o'q (jonli ko'rinishdagidek) — bo'sh bo'lsa sichqoncha
    finishEllipse(v1 > 0 ? v1 * U() : null);
  }
  function finishEllipse(r2) {
    const d = state.draft; if (!d || d.tool !== 'ellipse') return;
    const ell = ellFromDraft(d, state.cursor, r2);
    if (!ell) { setInfo("Ellips hosil bo'lmadi — 2-o'q uzunligi 0 dan katta bo'lsin"); return; }
    state.draft = null; closeBox();
    pushHistory();
    state.ents.push(newEnt('pline', { pts: ellipsePts(ell), closed: true, smooth: 'ellipse', ell }));
    afterChange(); setInfo('Ellips ' + fmtLen(2 * ell.rx) + ' × ' + fmtLen(2 * ell.ry) + ' — ' + toolHint('ellipse'));
  }
  function openEllipseEdit(ent) {
    const E = ent.ell;
    openBox({ anchor: { x: E.cx, y: E.cy }, f1: { label: "1-o'q (yarim)", unit: 'len', val: fmtNum(E.rx / U(), 2) }, f2: { label: "2-o'q (yarim)", unit: 'len', val: fmtNum(E.ry / U(), 2) },
      onCommit: (a, b) => {
        if ((a != null && !(a > 0)) || (b != null && !(b > 0))) { setInfo("Yarim o'qlar 0 dan katta bo'lsin"); return; }
        pushHistory();
        if (a != null) E.rx = a * U();
        if (b != null) E.ry = b * U();
        ent.pts = ellipsePts(E); closeBox(); afterChange();
      } });
    setInfo("Ellips yarim o'qlarini o'zgartirib Enter (Esc — bekor)"); render();
  }

  /* ---- Silliqlash (PEDIT Spline / Decurve): siniq chiziq ↔ splayn (uchlari fit nuqtalar) ---- */
  function peditEnt(e) {
    if (e.type !== 'pline') { setInfo("Silliqlash: siniq chiziq (polyline) yoki splaynni bosing"); return; }
    if (e.ell) { setInfo("Ellips allaqachon silliq — uni Portlatish (X) bilan siniq chiziqqa aylantirish mumkin"); return; }
    if (e.fit) {   // Decurve — splayn → fit nuqtalar bo'yicha siniq chiziq
      pushHistory();
      e.pts = e.fit.map((p) => ({ x: p.x, y: p.y })); delete e.fit; delete e.smooth;
      afterChange(); setInfo('Siniq chiziqqa qaytarildi: ' + e.pts.length + ' nuqta — ' + toolHint('pedit')); return;
    }
    if (e.smooth) { setInfo("Bu egrining fit nuqtalari yo'q (kesilgan / cho'zilgan) — qaytarib bo'lmaydi"); return; }
    const n = e.pts.length, closed = !!e.closed && n > 2;
    if (n < 3) { setInfo("Silliqlash uchun kamida 3 nuqtali siniq chiziq kerak"); return; }
    pushHistory();
    e.fit = e.pts.map((p) => ({ x: p.x, y: p.y })); e.smooth = 'spline'; e.closed = closed;
    e.pts = splinePts(e.fit, closed);
    afterChange(); setInfo('Silliq egri (splayn): ' + n + ' nuqta orqali — griplar bilan shaklini o\'zgartiring. ' + toolHint('pedit'));
  }

  /* ---- Splayn (SPL) — fit nuqtalar orqali silliq egri (polyline, fit nuqtalari saqlanadi) ---- */
  function splineClick(w) {
    const d = state.draft;
    if (!d) { state.draft = { tool: 'spline', pts: [WP(w)] }; setInfo("Splayn: keyingi nuqtani bosing; Enter — tugatish, C — yopish, Backspace — orqaga"); render(); renderOptRow(); return; }
    if (dist(d.pts[d.pts.length - 1], w) < 1e-6) return;
    d.pts.push(WP(w)); render(); syncOptRow();
  }
  function splineBack() {
    const d = state.draft; if (!d || d.tool !== 'spline') return;
    if (d.pts.length > 1) d.pts.pop(); else state.draft = null;
    render(); renderOptRow();
  }
  function finishSpline(close) {
    const d = state.draft; if (!d || d.tool !== 'spline') return;
    state.draft = null; closeBox();
    const closed = close != null ? close : state.opt.splClosed;
    if (d.pts.length < 2 || (closed && d.pts.length < 3)) { setInfo('Splayn uchun kamida 2 nuqta (yopiq — 3) kerak'); render(); renderOptRow(); return; }
    const fit = d.pts.map((p) => ({ x: p.x, y: p.y }));
    pushHistory();
    state.ents.push(newEnt('pline', { pts: splinePts(fit, closed), closed: !!closed, smooth: 'spline', fit }));
    afterChange(); setInfo('Splayn: ' + fit.length + ' nuqta — ' + toolHint('spline'));
  }

  /* ---- Yordamchi chiziq (XLINE) / Nur (RAY) — { x, y, ang }: cheksiz, chizmada ko'rinish oynasiga qirqiladi ---- */
  function consClick(t, w) {
    const o = state.opt, d = state.draft;
    const fixed = t === 'xline' && o.xlMode !== 'pt' ? ({ hor: 0, ver: 90, ang: o.xlAng })[o.xlMode] : null;
    if (fixed != null) { pushHistory(); state.ents.push(newEnt('xline', { x: w.x, y: w.y, ang: norm360(fixed) })); afterChange(); setInfo(toolHint('xline') + ' (yana bosing; Enter — tugatish)'); return; }
    if (!d) { state.draft = { tool: t, base: WP(w) }; setInfo(t === 'ray' ? "Nur: yo'nalish nuqtasini bosing" : "Yordamchi chiziq: yo'nalish nuqtasini bosing"); render(); return; }
    if (dist(d.base, w) < 1e-6) return;
    pushHistory();
    state.ents.push(newEnt(t, { x: d.base.x, y: d.base.y, ang: vecAng(w.x - d.base.x, w.y - d.base.y) }));
    afterChange();
    setInfo((t === 'ray' ? 'Nur' : 'Yordamchi chiziq') + ' qo\'shildi — yana yo\'nalish bosing (Enter / Esc — tugatish)');
  }
  // Ko'rinadigan oynani to'liq kesib o'tadigan uchlar (world) — ray: asosdan boshlanadi
  function consEnds(e, view, W, H) {
    const u = dirVec(e.ang);
    const cx = (W / 2 - view.panX) / view.scale, cy = (H / 2 - view.panY) / view.scale;
    const R = Math.hypot(e.x - cx, e.y - cy) + Math.hypot(W, H) / view.scale + 10;
    return [e.type === 'ray' ? { x: e.x, y: e.y } : { x: e.x - u.dx * R, y: e.y - u.dy * R }, { x: e.x + u.dx * R, y: e.y + u.dy * R }];
  }

  /* ---- Shtrix (HATCH) / Kontur (BOUNDARY) — soha: src/lib/hatchGeom.js ---- */
  function loopsNow() { if (!_loops) _loops = closedLoops(visEnts().filter((e) => !isAnno(e))); return _loops; }
  function regionAt(w) { return findRegion(loopsNow(), w); }
  function hatchClick(w) {
    const r = regionAt(w);
    if (!r) { setInfo('Shtrix: yopiq soha topilmadi — yopiq kontur (yopiq chiziq, uchlari tutashgan chiziq/yoylar, aylana, ellips) ichiga bosing'); return; }
    const o = state.opt;
    const loops = [r.outer].concat(r.islands).map((l) => l.pts.map((p) => ({ x: p.x, y: p.y })));
    pushHistory();
    const area = regionAreaOf(r.outer, r.islands);   // aniq (yoylar / aylanalar bo'yicha), ko'pburchak taxminisiz
    state.ents.push(newEnt('hatch', { loops, pat: o.hatchPat, sc: o.hatchSc, ang: o.hatchAng, area }));
    afterChange();
    setInfo('Shtrix: yuza ' + fmtArea(area) + (r.islands.length ? ', orollar: ' + r.islands.length : '') + ' — ' + toolHint('hatch'));
  }
  function boundaryClick(w) {
    const r = regionAt(w);
    if (!r) { setInfo('Kontur: yopiq soha topilmadi — yopiq kontur ichiga bosing'); return; }
    const add = [];
    for (const l of [r.outer].concat(r.islands)) {
      if (l.ent) { const c = JSON.parse(JSON.stringify(l.ent)); delete c.id; add.push(c); }
      else for (const g of piecesToEnts(l.pieces, true)) add.push(g);
    }
    pushHistory();
    state.sel.clear();
    for (const g of add) { const e = newEnt(g.type, g); state.ents.push(e); state.sel.add(e.id); }
    afterChange();
    setInfo('Kontur: ' + add.length + ' ta element yaratildi (tanlangan — Ko\'chirish bilan ajratib olish mumkin)');
  }
  function hatchPath(e, w2s) { return e.loops.map((l) => 'M' + l.map((p) => { const s = w2s(p.x, p.y); return s.x.toFixed(1) + ' ' + s.y.toFixed(1); }).join(' L') + ' Z').join(' '); }
  function paintHatch(target, e, w2s, view, PP, sel, exportMode, st) {
    const col = sel ? PP.accent : ((st && st.color) || PP.devor);
    const fade = (st && st.locked && !exportMode) ? 0.45 : 1;   // qulflangan qatlam xira
    let fill = col, op = 1;
    if (e.pat === 'solid') op = sel ? 0.5 : 0.32;
    else {
      let defs = target.querySelector('defs');
      if (!defs) { defs = svgEl('defs', {}); target.insertBefore(defs, target.firstChild); }
      const id = HP + (exportMode ? 'x' : '') + e.id;
      const sp = Math.max(3, e.sc * view.scale), o = w2s(0, 0);
      const rot = -norm360((e.ang || 0) + (e.pat === 'line' ? 0 : 45));
      const pat = svgEl('pattern', { id, patternUnits: 'userSpaceOnUse', width: sp, height: sp, patternTransform: 'translate(' + o.x + ' ' + o.y + ') rotate(' + rot + ')' });
      const lw = 0.9 * (PP.fs || 1);
      pat.appendChild(svgEl('line', { x1: 0, y1: sp / 2, x2: sp, y2: sp / 2, stroke: col, 'stroke-width': lw }));
      if (e.pat === 'net') pat.appendChild(svgEl('line', { x1: sp / 2, y1: 0, x2: sp / 2, y2: sp, stroke: col, 'stroke-width': lw }));
      defs.appendChild(pat);
      fill = 'url(#' + id + ')';
    }
    target.appendChild(svgEl('path', { d: hatchPath(e, w2s), fill, 'fill-opacity': op * fade, 'fill-rule': 'evenodd', stroke: sel ? PP.accent : 'none', 'stroke-width': 1, 'stroke-dasharray': sel ? '6 4' : 'none', 'pointer-events': 'none' }));
  }

  /* ---- Matn (TEXT / DTEXT) — joyni bosing, yozing; Enter — keyingi qator ---- */
  function positionTextEd() {
    const d = state.draft; if (!d || d.tool !== 'text') return;
    const s = worldToScreen(d.p.x, d.p.y), r = svg.getBoundingClientRect();
    const fs = Math.max(13, Math.min(34, (d.h / TEXT_CAP) * state.scale));
    textEd.style.fontSize = fs + 'px';
    textEd.style.left = Math.max(4, Math.min(s.x, r.width - 190)) + 'px';
    textEd.style.top = Math.max(4, Math.min(s.y + 10, r.height - fs * 1.6 - 34)) + 'px';
  }
  function closeTextEd() { textEd.classList.remove('show'); textEd.value = ''; if (document.activeElement === textEd) textEd.blur(); }
  function textStart(w, edit) {
    const o = state.opt;
    closeBox();
    state.draft = edit ? { tool: 'text', edit: edit.id, p: { x: edit.x, y: edit.y }, h: edit.h, rot: edit.rot || 0 } : { tool: 'text', p: WP(w), h: o.textH, rot: o.textRot || 0 };
    textEd.value = edit ? edit.text : '';
    textEd.classList.add('show');
    positionTextEd();
    textEd.focus(); if (edit) textEd.select();
    setInfo(edit ? "Matnni o'zgartiring — Enter (Esc — bekor; bo'shatilsa o'chadi)" : "Matn: yozing — Enter keyingi qator, bo'sh Enter yoki Esc — tugatish");
    render();
  }
  // Joriy qatorni saqlash; next — keyingi qatorga o'tish (AutoCAD DTEXT)
  function textCommit(next) {
    const d = state.draft; if (!d || d.tool !== 'text') return;
    const s = textEd.value.replace(/\s+$/, '');
    if (d.edit != null) {
      const e = getEnt(d.edit);
      state.draft = null; closeTextEd();
      if (e && s !== e.text) { pushHistory(); if (s.trim()) e.text = s; else { state.ents = state.ents.filter((x) => x !== e); state.sel.delete(e.id); } afterChange(); } else render();
      setInfo(toolHint(state.tool)); return;
    }
    if (!s.trim()) { state.draft = null; closeTextEd(); render(); setInfo(toolHint('text')); return; }
    pushHistory();
    state.ents.push(newEnt('text', { x: d.p.x, y: d.p.y, h: d.h, rot: d.rot, text: s }));
    if (next) {
      const v = dirVec(d.rot + 90);
      d.p = { x: d.p.x - v.dx * d.h * 1.6, y: d.p.y - v.dy * d.h * 1.6 };
      textEd.value = ''; afterChange(); positionTextEd(); textEd.focus();
      setInfo("Keyingi qator — yozing (bo'sh Enter yoki Esc — tugatish)");
    } else { state.draft = null; closeTextEd(); afterChange(); setInfo(toolHint('text')); }
  }
  function textClick(w) {
    if (state.draft && state.draft.tool === 'text') textCommit(false);
    textStart(w, null);
  }
  function paintText(target, e, w2s, view, col, sel, opacity) {
    const s = w2s(e.x, e.y), fs = (e.h / TEXT_CAP) * view.scale;   // h — bosh harf balandligi (AutoCAD)
    if (!(fs > 0.3)) return;
    const t = svgEl('text', { x: s.x, y: s.y, fill: col, 'font-size': fs, 'font-family': TEXT_FONT, 'pointer-events': 'none', style: 'white-space:pre' });
    if (e.rot) t.setAttribute('transform', 'rotate(' + (-e.rot) + ' ' + s.x + ' ' + s.y + ')');
    if (opacity != null) t.setAttribute('opacity', opacity);
    t.textContent = e.text;
    target.appendChild(t);
    if (sel) target.appendChild(svgEl('polygon', { points: ptsAttr(textBox(e, textW(e)), w2s), fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' }));
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
      for (const c of cl) { mapEnt(c, (p) => reflPt(p, base, target)); if (c.type === 'dim' && c.off != null) c.off = -c.off; }
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
  // Silliq egridan (ellips / splayn) hosil bo'lgan bo'laklar ham silliq: bitta uzunlik yozuvi, ichki tugunlarga magnit yo'q
  function smoothFrom(srcs, list) {
    if (!srcs.length || !srcs.every((s) => s && s.type === 'pline' && s.smooth)) return list;
    for (const g of list) if (g && g.type === 'pline') g.smooth = 'curve';
    return list;
  }
  // Ofset natijasi: har qadam uchun elementlar guruhi (zanjir — bir nechta element, oddiy — bitta)
  function offsetMade(d, step, N) { return d.chain ? offsetChainSeries(d.chain, step, N) : offsetSeries(d.ent, step, N).map((o) => [o]); }
  function offsetClick(sx, sy, w) {
    const d = state.draft;
    if (!d) {
      const hit = entAt(sx, sy);
      if (!hit || isAnno(hit.ent)) { setInfo('Offset uchun chiziq, yoy yoki aylanani bosing'); return; }
      // Gul rejimi: uchlari tutashgan elementlar (chiziqlar, yoylar) bitta kontur — AutoCAD JOIN + OFFSET
      const ch = (V.joinOffset && hit.ent.type !== 'circle') ? chainOf(visEnts(), hit.ent.id) : null;
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
    const srcs = d.chain ? [...d.chain.ids].map(getEnt) : [e];
    for (const grp of made) for (const o of smoothFrom(srcs, grp)) state.ents.push(newEnt(o.type, o, srcs[0]));
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
    else if (t === 'dim') { for (const k of Object.keys(DIM_KINDS)) btn(DIM_KINDS[k], () => { o.dimKind = k; cancelDraft(false); setInfo(toolHint('dim')); syncButtons(); }, { on: (o.dimKind || 'al') === k }); }
    else if (t === 'ellipse') {
      btn('Markaz', () => { o.ellMode = 'center'; cancelDraft(false); setInfo(toolHint('ellipse')); }, { on: o.ellMode !== 'axis' });
      btn("O'q, uch", () => { o.ellMode = 'axis'; cancelDraft(false); setInfo(toolHint('ellipse')); }, { on: o.ellMode === 'axis' });
    } else if (t === 'spline') {
      const on = !!(d && d.tool === 'spline');
      btn('Yopish', () => finishSpline(true), { disabled: !(on && d.pts.length >= 3) });   // AutoCAD Close: yopadi va tugatadi
      btn('Tugatish (Enter)', () => finishSpline(null), { primary: true, disabled: !(on && d.pts.length >= 2) });
      btn('Orqaga (Backspace)', () => splineBack(), { disabled: !on });
    } else if (t === 'xline') {
      const XM = { pt: 'Nuqta orqali', hor: 'Gorizontal', ver: 'Vertikal', ang: 'Burchak' };
      for (const k of Object.keys(XM)) btn(XM[k], () => { o.xlMode = k; cancelDraft(false); setInfo(toolHint('xline')); }, { on: o.xlMode === k });
      if (o.xlMode === 'ang') num('Burchak', o.xlAng, (v) => { o.xlAng = norm360(v); }, '°');
    } else if (t === 'hatch') {
      const PATS = { solid: 'Yaxlit', ansi31: 'Qiya (ANSI31)', net: "To'r", line: 'Gorizontal' };
      for (const k of Object.keys(PATS)) btn(PATS[k], () => { o.hatchPat = k; setInfo(toolHint('hatch')); }, { on: o.hatchPat === k });
      if (o.hatchPat !== 'solid') {
        num('Oraliq', o.hatchSc / U(), (v) => { o.hatchSc = Math.max(0.5, v * U()); }, UNIT_LABEL[state.unit]);
        num('Burchak', o.hatchAng, (v) => { o.hatchAng = norm360(v); }, '°');
      }
    } else if (t === 'text') {
      const live = () => state.draft && state.draft.tool === 'text' && state.draft.edit == null;
      num('Balandlik', o.textH / U(), (v) => { o.textH = Math.max(0.1, v * U()); if (live()) { state.draft.h = o.textH; positionTextEd(); } }, UNIT_LABEL[state.unit]);
      num('Burchak', o.textRot, (v) => { o.textRot = norm360(v); if (live()) state.draft.rot = o.textRot; }, '°');
    }
    else if (t === 'copy') { btn('Rejim: ' + (o.copyMulti ? "Ko'p" : 'Bitta'), () => { o.copyMulti = !o.copyMulti; }, { on: o.copyMulti }); btn('Massiv\u2026', () => setTool('array'), { noKw: true }); }
    else if (t === 'move') tog('Nusxa (asli qoladi)', 'moveCopy');
    else if (t === 'rotate') tog('Nusxa (asli qoladi)', 'rotateCopy');
    else if (t === 'scale') tog('Nusxa (asli qoladi)', 'scaleCopy');
    else if (t === 'mirror') tog("Aslini o'chirish", 'mirrorErase');
    else if (t === 'offset') tog("Ko'p (bir masofa, ketma-ket)", 'offsetMulti');
    else if (t === 'fillet') {
      num('Radius', o.filletR / U(), (v) => { o.filletR = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      tog('Polyline (butun kontur)', 'filletPoly'); tog('Kesish (Trim)', 'filletTrim');
      btn('Faska\u2026', () => setTool('chamfer'), { noKw: true });   // boshqa asbobga o'tish — kalit so'z emas (F — Tutashtirish buyrug'i)
    } else if (t === 'chamfer') {
      num('Masofa 1', o.chamD1 / U(), (v) => { o.chamD1 = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      num('Masofa 2', o.chamD2 / U(), (v) => { o.chamD2 = Math.max(0, v * U()); }, UNIT_LABEL[state.unit]);
      tog('Polyline (butun kontur)', 'chamPoly'); tog('Kesish (Trim)', 'chamTrim');
      btn('Tutashtirish\u2026', () => setTool('fillet'), { noKw: true });
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
    if (changed) { syncFilletBox(); saveLS(); render(); syncOptRow(); }
    return changed;
  }
  // Qatorni qayta qurmasdan yangilash (fokus va bosilayotgan tugma yo'qolmasin): tugma holati, matn
  function syncOptRow() {
    const row = q('optRow'); if (!row) return;
    optItems().forEach((it, i) => {
      if (it.kind === 'btn') {
        const b = row.querySelector('button[data-opt="' + i + '"]');
        if (b) {
          b.disabled = !!it.disabled; b.classList.toggle('on', !!it.on);
          const tx = b.lastChild;   // kalit so'z belgisi (<b class="chz-optkw">) saqlanadi
          if (tx && tx.nodeType === 3) { if (tx.nodeValue !== it.label) tx.nodeValue = it.label; }
          else if (b.textContent !== it.label) b.textContent = it.label;
        }
      }
      else if (it.kind === 'txt') { const s = row.querySelector('.chz-opttxt'); if (s && s.textContent !== it.text) s.textContent = it.text; }
    });
  }
  // AutoCAD ning inglizcha kalitlari — o'zbekcha yorliq bilan birga qabul qilinadi (C — Close, U — Undo, R — Radius…)
  const ACAD_ALT = {
    yopish: 'C', orqaga: 'U', yoy: 'A', radius: 'R', polyline: 'P', kesish: 'T', faska: 'CHA', tutashtirish: 'F',
    massiv: 'AR', nusxa: 'C', diametr: 'D', 'markaz, diametr': 'D', '2 nuqta': '2P', '3 nuqta': '3P',
    ichki: 'I', tashqi: 'CI', "tomon bo'yicha": 'E', delta: 'DE', foiz: 'P', umumiy: 'T', burchak: 'A', masofa: 'D',
    gorizontal: 'H', vertikal: 'V', 'nuqta orqali': 'B', yaxlit: 'S', nuqtalar: 'P', obyekt: 'O', yopiq: 'CL',
    'aslini o‘chirish': 'E', 'hammasini tanlash': 'ALL', 'bo‘shatish': 'X', tugatish: 'E', markaz: 'C',
  };
  // Kalitlar jadvali normallashtirilgan holda (apostrof va bo'shliqlar farqi yo'qoladi)
  const normKw = (t) => cmdNormPlain(t).replace(/\s+/g, '');
  const ACAD_ALT_N = Object.fromEntries(Object.entries(ACAD_ALT).map(([k, v]) => [normKw(k), v]));
  // Yoziladigan kalit so'zlar uchun qisqa yorliq: «Polyline (butun kontur): Ha» → «Polyline»
  const shortLab = (s) => String(s == null ? '' : s).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[:：].*$/, '').replace(/[.…]+$/, '').trim();
  // Joriy asbobning buyruq satridan yoziladigan variantlari (AutoCAD kalit so'zlari)
  function optKeys() {
    const out = [];
    (optRowItems || []).forEach((it, i) => {
      if (!it || it.disabled || it.noKw || (it.kind !== 'btn' && it.kind !== 'num') || !it.label) return;
      out.push({ label: it.label, short: it.short || shortLab(it.label), kw: it.kw || '', alt: it.alt || '', idx: i, kind: it.kind });
    });
    return out;
  }
  function renderOptRow() {
    const row = q('optRow'); if (!row) return;
    const items = optItems();
    optRowItems = items;
    if (pendingNum && (!optRowItems[pendingNum.idx] || optRowItems[pendingNum.idx].label !== pendingNum.full)) pendingNum = null;   // asbob/qator almashdi — qiymat kutish bekor
    const pick = items.map((it, i) => ({ it, i })).filter((x) => (x.it.kind === 'btn' || x.it.kind === 'num') && !x.it.noKw);
    const kws = deriveKeywords(pick.map((x) => shortLab(x.it.label)));
    const taken = new Set(kws.map((k) => k.toLowerCase()));
    pick.forEach((x, n) => {
      x.it.short = shortLab(x.it.label); x.it.kw = kws[n];
      const alt = ACAD_ALT_N[normKw(x.it.short)];
      x.it.alt = alt && !taken.has(alt.toLowerCase()) ? alt : '';
      if (x.it.alt) taken.add(alt.toLowerCase());
    });
    syncPrompt();
    if (!items.length) { row.style.display = 'none'; row.innerHTML = ''; return; }
    row.style.display = '';
    row.innerHTML = '<span class="chz-optlbl">' + escHtml(toolLabel(state.tool)) + ':</span>' + items.map((it, i) => {
      if (it.kind === 'txt') return '<span class="chz-opttxt">' + escHtml(it.text) + '</span>';
      const kwT = it.kw ? ' title="Buyruq satridan: ' + escHtml(it.kw + (it.alt ? ' yoki ' + it.alt : '')) + '"' : '';
      if (it.kind === 'num') return '<label class="chz-optnum"' + kwT + '><b class="chz-optkw">' + escHtml(it.kw || '') + '</b>' + escHtml(it.label) + ' <input type="text" inputmode="decimal" data-num="neg" data-opt="' + i + '" value="' + escHtml(fmtNum(it.val, 2)) + '" />' + (it.unit ? '<i>' + escHtml(it.unit) + '</i>' : '') + '</label>';
      return '<button type="button" class="chz-opt' + (it.on ? ' on' : '') + (it.primary ? ' primary' : '') + '" data-opt="' + i + '"' + (it.disabled ? ' disabled' : '') + kwT + '><b class="chz-optkw">' + escHtml(it.kw || '') + '</b>' + escHtml(it.label) + '</button>';
    }).join('');
  }

  /* ---- Tutashtirish (FILLET) / Faska (CHAMFER) / Portlatish / Birlashtirish — geometriya: src/lib/modifyGeom.js ---- */
  // Joriy qiymatlar: qutida yozilgan bo'lsa u (hali Enter bosilmagan), aks holda variantlar qatoridagi
  // Tutashtirish/Faska: 1-tanlovdan keyin variantlar qatorida o'zgartirilgan qiymat ochiq qutiga ham yoziladi
  function syncFilletBox() {
    const d = state.draft, o = state.opt;
    if (!state.box || !d || (d.tool !== 'fillet' && d.tool !== 'chamfer')) return;
    if (d.tool === 'fillet') in1.value = fmtNum(o.filletR / U(), 2);
    else { in1.value = fmtNum(o.chamD1 / U(), 2); in2.value = fmtNum(o.chamD2 / U(), 2); }
  }
  function filletVals(kind) {
    const o = state.opt, [v1, v2] = state.box ? boxVals() : [null, null];
    if (kind === 'fillet') return { R: v1 != null && v1 >= 0 ? v1 * U() : o.filletR };
    return { d1: v1 != null && v1 >= 0 ? v1 * U() : o.chamD1, d2: v2 != null && v2 >= 0 ? v2 * U() : o.chamD2 };
  }
  // Ikki tanlovdan o'zgarishlar: { remove:[id], add:[props], patch:[{id,patch}], shape } yoki { reason }
  function computeFillet(kind, h1, P1, h2, P2, zero) {
    const e1 = h1.ent, e2 = h2.ent;
    if (e1.type === 'dim' || e2.type === 'dim') return { reason: "O'lcham chizig'i tanlanmaydi" };
    if (e1.type === 'point' || e2.type === 'point' || e1.type === 'text' || e2.type === 'text') return { reason: 'Nuqta / matnni tutashtirib bo\'lmaydi — chiziq, yoy yoki aylana tanlang' };
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
    const src0 = op.remove.length ? getEnt(op.remove[0]) : (op.patch.length ? getEnt(op.patch[0].id) : null);   // natija asl qatlamda qoladi
    state.ents = state.ents.filter((e) => !rm.has(e.id));
    for (const p of op.patch) { const e = getEnt(p.id); if (e) { if (p.patch.pts) { delete e.ell; delete e.fit; } Object.assign(e, p.patch); } }   // tugunlari o'zgargan ellips/splayn — oddiy silliq egri
    for (const a of op.add) state.ents.push(newEnt(a.type, a, src0));
    state.sel.clear(); state.cont = null;
    afterChange(); if (msg) setInfo(msg);
    return true;
  }
  function filletClick(kind, sx, sy) {
    const hit = entAt(sx, sy), raw = screenToWorld(sx, sy), o = state.opt, d = state.draft;
    const nm = kind === 'fillet' ? 'Tutashtirish' : 'Faska';
    if (!d) {
      if (!hit || isAnno(hit.ent)) { setInfo(toolHint(kind)); return; }
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
    if (!hit || isAnno(hit.ent) || (hit.ent === d.h1.ent && hit.seg === d.h1.seg)) return;
    pick(hit, Object.assign({}, hl, { opacity: 0.3 }));
    const op = computeFillet(d.tool, d.h1, d.p1, { ent: hit.ent, seg: hit.seg }, screenToWorld(s.sx, s.sy), false);
    if (!op || op.reason) return;
    const dash = { stroke: PP.edit, 'stroke-width': 2, 'stroke-dasharray': '6 4', fill: 'none', 'pointer-events': 'none' };
    for (const g of op.add) shapeEl(g, dash);
    for (const p of op.patch) { const e = getEnt(p.id); if (e) shapeEl(Object.assign({}, e, p.patch), dash); }
  }
  function explodeEnts(list) {
    const rm = [], add = [];
    for (const e of list) { const parts = explodeEnt(e); if (parts && parts.length) { rm.push(e.id); add.push(...withStyle(parts, e)); } }
    if (!rm.length) { setInfo("Portlatiladigan polyline yo'q (aylana, yoy va bitta segmentli chiziq portlatilmaydi)"); return; }
    applyOp({ remove: rm, add, patch: [] }, rm.length + ' ta polyline ' + add.length + ' ta chiziqqa ajratildi');
  }
  function joinSelected(list) {
    const r = joinEnts(list);
    withStyle(r.add, list[0]);
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
        applyOp({ remove: [hit.ent.id], add: smoothFrom([hit.ent], r.add), patch: [] }, 'Nuqtada uzildi — ' + r.add.length + ' bo\'lak. ' + toolHint('break')); return;
      }
      state.draft = { tool: 'break', ent: hit.ent, p1: WP(w) };
      setInfo("Uzish: 2-nuqtani bosing — oralig'i olib tashlanadi (Esc — bekor)"); render(); return;
    }
    const r = breakEnt(d.ent, d.p1, WP(w));
    if (r.reason) { setInfo(r.reason); return; }
    state.draft = null;
    applyOp({ remove: [d.ent.id], add: smoothFrom([d.ent], r.add), patch: [] }, 'Uzildi' + (r.add.length ? '' : ' — element butunlay olib tashlandi') + '. ' + toolHint('break'));
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
    if (!r && hit.ent.type === 'hatch') { let per = 0; for (const l of hit.ent.loops) per += polyPerim(l, true); r = { area: Number.isFinite(hit.ent.area) ? hit.ent.area : regionArea(hit.ent.loops), perim: per }; }
    if (!r) { const ch = chainOf(visEnts(), hit.ent.id); if (ch && ch.closed) { r = chainArea(ch.pieces); ids = [...ch.ids]; } }
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
    else if (g.type === 'text') paintText(target, g, w2s, view, attrs.stroke || '#888', false, attrs.opacity);
    else if (g.type === 'hatch') target.appendChild(svgEl('path', Object.assign({ d: hatchPath(g, w2s), 'fill-rule': 'evenodd' }, attrs)));
    else if (isCons(g)) { const r = svg.getBoundingClientRect(), [a, b] = consEnds(g, view, r.width, r.height), sa = w2s(a.x, a.y), sb = w2s(b.x, b.y); target.appendChild(svgEl('line', Object.assign({ x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y }, attrs))); }
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
    if (t === 'hatch' || t === 'boundary') {   // kursor ostidagi soha (orollari bilan) — oldindan ko'rinish
      if (!state.cursorIn) return;
      const r = regionAt(screenToWorld(s.sx, s.sy)); if (!r) return;   // xom nuqta — magnit chegaraga tortmasin
      target.appendChild(svgEl('path', { d: hatchPath({ loops: [r.outer].concat(r.islands).map((l) => l.pts) }, w2s), fill: PP.accent, 'fill-opacity': 0.14, 'fill-rule': 'evenodd', stroke: PP.accent, 'stroke-width': 1.6, 'stroke-dasharray': '6 4', 'pointer-events': 'none' }));
      return;
    }
    if (t === 'donut') {
      const o = state.opt, c = state.cursor;
      if (o.donutOut > 0) drawEntShape(target, { type: 'circle', cx: c.x, cy: c.y, r: o.donutOut / 2 }, w2s, view, dash);
      if (o.donutIn > 0 && o.donutIn < o.donutOut) drawEntShape(target, { type: 'circle', cx: c.x, cy: c.y, r: o.donutIn / 2 }, w2s, view, dash);
      return;
    }
    if (!['lengthen', 'divide', 'measure', 'break'].includes(t)) return;
    const hit = entAt(s.sx, s.sy); if (!hit || isAnno(hit.ent)) return;
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
    if (!hit || isAnno(hit.ent)) { setInfo(t === 'trim' ? 'Kesish: chiziq, yoy yoki aylananing olib tashlanadigan qismiga bosing' : 'Uzaytirish: chiziq yoki yoyning uchiga yaqin bosing'); return; }
    const raw = screenToWorld(sx, sy);
    if (t === 'trim') {
      const res = trimAt(visEnts(), hit.ent, raw, hit.seg);
      if (!res || !res.remove) { setInfo(res && res.reason ? res.reason : 'Kesib bo\'lmadi'); return; }
      pushHistory();
      state.ents = state.ents.filter((e) => !res.remove.includes(e.id));
      for (const o of smoothFrom([hit.ent], res.add)) state.ents.push(newEnt(o.type, o, hit.ent));
      state.sel.clear(); state.cont = null;
      afterChange(); setInfo('Kesildi' + (res.add.length ? '' : ' — element butunlay olib tashlandi') + '. ' + toolHint('trim'));
    } else {
      const res = extendAt(visEnts(), hit.ent, raw);
      if (!res || !res.patch) { setInfo(res && res.reason ? res.reason : 'Uzaytirib bo\'lmadi'); return; }
      pushHistory();
      if (res.patch.pts) { delete hit.ent.ell; delete hit.ent.fit; }   // tugunlari o'zgargan ellips/splayn — eskirgan parametrlar tashlanadi
      Object.assign(hit.ent, res.patch);
      afterChange(); setInfo('Uzaytirildi. ' + toolHint('extend'));
    }
  }
  // Jonli ko'rinish: kursor ostidagi elementning kesiladigan qismi (qizil) / uzaytiriladigan qismi (punktir)
  function paintTrimExtendPreview(target, w2s, view, PP) {
    const s = state.cursorS; if (!s) return;
    const hit = entAt(s.sx, s.sy); if (!hit || isAnno(hit.ent)) return;
    const raw = screenToWorld(s.sx, s.sy);
    const shape = (g, attrs) => {
      if (g.type === 'circle') { const c = w2s(g.cx, g.cy); target.appendChild(svgEl('circle', Object.assign({ cx: c.x, cy: c.y, r: g.r * view.scale }, attrs))); }
      else if (g.type === 'arc') target.appendChild(svgEl('path', Object.assign({ d: arcSvgPath(g, w2s, view.scale) }, attrs)));
      else if (g.type === 'pline') target.appendChild(svgEl(g.closed && g.pts.length > 2 ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(g.pts, w2s) }, attrs)));
    };
    if (state.tool === 'trim') {
      const res = trimAt(visEnts(), hit.ent, raw, hit.seg);
      if (!res || !res.removed) return;
      shape(res.removed, { stroke: '#ef4444', 'stroke-width': 4, fill: 'none', opacity: 0.75, 'stroke-linecap': 'round', 'pointer-events': 'none' });
    } else {
      const res = extendAt(visEnts(), hit.ent, raw);
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
    if (t === 'ellipse') return ellipseClick(w);
    if (t === 'spline') return splineClick(w);
    if (t === 'text') return textClick(w);
    if (t === 'hatch') return hatchClick(screenToWorld(sx, sy));   // xom (magnitsiz) nuqta: chegaraga tortilsa soha noto'g'ri topilardi
    if (t === 'xline' || t === 'ray') return consClick(t, w);
    if (t === 'boundary') return boundaryClick(screenToWorld(sx, sy));
    if (t === 'stretch') return stretchClick(w);
    if (t === 'align') return alignClick(w);
    if (t === 'break') return breakClick(sx, sy, w);
    if (t === 'lengthen') return lengthenClick(sx, sy);
    if (t === 'divide' || t === 'measure') return divMeasClick(t, sx, sy);
    if (t === 'dist') return distClick(w);
    if (t === 'area') return areaClick(sx, sy, w);
    if (t === 'explode') { const hit = entAt(sx, sy); if (hit) explodeEnts([hit.ent]); else setInfo(toolHint('explode')); return; }
    if (t === 'pedit') { const hit = entAt(sx, sy); if (hit) peditEnt(hit.ent); else setInfo(toolHint('pedit')); return; }
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
    if (t === 'dim') return dimClick(w, sx, sy);
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
    if (e.type === 'pline' && e.ell) { const g = ellipseGrips(e.ell); return [{ x: g.c.x, y: g.c.y, kind: 'ec' }, { x: g.a.x, y: g.a.y, kind: 'ea' }, { x: g.b.x, y: g.b.y, kind: 'eb' }]; }
    if (e.type === 'pline' && e.fit) return e.fit.map((p, i) => ({ x: p.x, y: p.y, kind: 'fp', idx: i }));
    if (e.type === 'pline' && e.smooth) { const n = e.pts.length; return e.closed || n < 2 ? [] : [{ x: e.pts[0].x, y: e.pts[0].y, kind: 'v', idx: 0 }, { x: e.pts[n - 1].x, y: e.pts[n - 1].y, kind: 'v', idx: n - 1 }]; }
    if (e.type === 'pline') return e.pts.map((p, i) => ({ x: p.x, y: p.y, kind: 'v', idx: i }));
    if (e.type === 'text') return [{ x: e.x, y: e.y, kind: 'tx' }];
    if (isCons(e)) { const u = dirVec(e.ang), L = 60 / state.scale; return [{ x: e.x, y: e.y, kind: 'xb' }, { x: e.x + u.dx * L, y: e.y + u.dy * L, kind: 'xd' }]; }
    if (e.type === 'circle') return [{ x: e.cx, y: e.cy, kind: 'c' }, { x: e.cx + e.r, y: e.cy, kind: 'r' }];
    if (e.type === 'arc') { const s = arcStart(e), en = arcEnd(e), m = arcMid(e); return [{ x: s.x, y: s.y, kind: 'as' }, { x: en.x, y: en.y, kind: 'ae' }, { x: m.x, y: m.y, kind: 'am' }, { x: e.cx, y: e.cy, kind: 'ac' }]; }
    if (e.type === 'point') return [{ x: e.x, y: e.y, kind: 'pt' }];
    if (e.type === 'dim') {
      const k = dimKind(e);
      if (k === 'lin') { const r = rotatedDim(e); return [{ x: e.x1, y: e.y1, kind: 'p1' }, { x: e.x2, y: e.y2, kind: 'p2' }, { x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2, kind: 'off' }]; }
      if (k === 'ang') return [{ x: e.lx, y: e.ly, kind: 'dl' }];
      if (k === 'rad' || k === 'dia') return [{ x: e.x2, y: e.y2, kind: 'p2' }];
      const n = dimNormal(e); return [{ x: e.x1, y: e.y1, kind: 'p1' }, { x: e.x2, y: e.y2, kind: 'p2' }, { x: (e.x1 + e.x2) / 2 + n.x * e.off, y: (e.y1 + e.y2) / 2 + n.y * e.off, kind: 'off' }];
    }
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
    else if (g.kind === 'off') { if (e.kind === 'lin') e.off = rotatedOff({ x: e.x1, y: e.y1 }, e.rot || 0, w); else { const n = dimNormal(e); e.off = (w.x - e.x1) * n.x + (w.y - e.y1) * n.y; } }
    else if (g.kind === 'dl') { e.lx = w.x; e.ly = w.y; }
    else if (g.kind === 'tx' || g.kind === 'xb') { e.x = w.x; e.y = w.y; }
    else if (g.kind === 'xd') { if (dist(w, e) > 1e-6) e.ang = vecAng(w.x - e.x, w.y - e.y); }
    else if (g.kind === 'ec') { const dx = w.x - e.ell.cx, dy = w.y - e.ell.cy; e.ell.cx = w.x; e.ell.cy = w.y; e.pts = e.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })); }
    else if (g.kind === 'ea') { const r = dist(w, { x: e.ell.cx, y: e.ell.cy }); if (r > 1e-6) { e.ell.rx = r; e.ell.rot = vecAng(w.x - e.ell.cx, w.y - e.ell.cy); e.pts = ellipsePts(e.ell); } }
    else if (g.kind === 'eb') { const c = { x: e.ell.cx, y: e.ell.cy }, u = dirVec(e.ell.rot), r = distToAxis(c, { x: c.x + u.dx, y: c.y + u.dy }, w); if (r > 1e-6) { e.ell.ry = r; e.pts = ellipsePts(e.ell); } }
    else if (g.kind === 'fp') { e.fit[g.idx] = { x: w.x, y: w.y }; e.pts = splinePts(e.fit, e.closed); }
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
  // Oyna (to'liq ichida) / kesib o'tish ramkasi elementni oladimi. Shtrix — har halqa alohida yopiq;
  // yordamchi chiziq / nur — cheksiz: oynaga hech qachon to'liq sig'maydi, kesib o'tishda ko'rinadigan qismi tekshiriladi
  function boxHit(ent, r, crossing) {
    const S = (p) => worldToScreen(p.x, p.y);
    if (isCons(ent)) {
      if (!crossing) return false;
      const R = svg.getBoundingClientRect(), [a, b] = consEnds(ent, state, R.width, R.height), sa = S(a), sb = S(b);
      return pointInRect(sa.x, sa.y, r) || pointInRect(sb.x, sb.y, r) || segIntersectsRect(sa, sb, r);
    }
    const rings = ent.type === 'hatch'
      ? ent.loops.map((l) => ({ vs: l.map(S), closed: true }))
      : [{ vs: (ent.type === 'arc' ? arcSamples(ent, 24) : entVerts(ent)).map(S), closed: ent.type === 'pline' && ent.closed }];
    if (rings.length && rings.every((g) => g.vs.length > 0 && g.vs.every((s) => pointInRect(s.x, s.y, r)))) return true;
    if (!crossing) return false;
    for (const g of rings) {
      const vs = g.vs;
      if (vs.some((s) => pointInRect(s.x, s.y, r))) return true;
      for (let i = 0; i < vs.length - 1; i++) if (segIntersectsRect(vs[i], vs[i + 1], r)) return true;
      if (g.closed && vs.length > 2 && segIntersectsRect(vs[vs.length - 1], vs[0], r)) return true;
    }
    return false;
  }
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
      grp.appendChild(svgEl('line', { x1: sx, y1: 0, x2: sx, y2: H, stroke: BP().ref, 'stroke-width': k === 0 ? 1.3 : 1, opacity: k === 0 ? 0.8 : (k % 5 === 0 ? 0.42 : 0.17) }));
    }
    for (let y = y0; y <= y1 + 1e-9; y += g) {
      const k = Math.round(y / g), sy = y * view.scale + view.panY;
      grp.appendChild(svgEl('line', { x1: 0, y1: sy, x2: W, y2: sy, stroke: BP().ref, 'stroke-width': k === 0 ? 1.3 : 1, opacity: k === 0 ? 0.8 : (k % 5 === 0 ? 0.42 : 0.17) }));
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
  function paintPlineLabels(target, pts, closed, w2s, PP, sel, smooth) {
    const n = pts.length;
    if (n < 2) return;
    let cx = 0, cy = 0; for (const p of pts) { cx += p.x; cy += p.y; } cx /= n; cy /= n;
    const sc = w2s(cx, cy);
    const m = PP.fs || 1;
    if (smooth) {   // ellips / splayn: bitta umumiy uzunlik (egri o'rtasida, tashqi tomonda), burchaklar yo'q
      if (!state.showLen) return;
      const segs = plineSegs({ pts, closed }); let tot = 0; for (const s of segs) tot += dist(s.a, s.b);
      let acc = 0, mp = pts[0], sd = null;
      for (const s of segs) { const L = dist(s.a, s.b); if (acc + L >= tot / 2) { const t = L > 1e-12 ? (tot / 2 - acc) / L : 0; mp = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }; sd = s; break; } acc += L; }
      const sm = w2s(mp.x, mp.y);
      let nx = 0, ny = -1;
      if (sd) { const sa = w2s(sd.a.x, sd.a.y), sb = w2s(sd.b.x, sd.b.y); nx = -(sb.y - sa.y); ny = sb.x - sa.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if ((sm.x - sc.x) * nx + (sm.y - sc.y) * ny < 0) { nx = -nx; ny = -ny; } }
      label(target, sm.x + nx * 16 * m, sm.y + ny * 16 * m, fmtLen(tot), sel ? PP.accent : PP.text, 11, PP);
      return;
    }
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
  function dimArrow(g, tip, dir, col, m) {   // dir — o'q uchi qaragan yo'nalish (ekranda, birlik)
    const ah = 9 * m, aw = 2.8 * m, nx = -dir.y, ny = dir.x;
    g.appendChild(svgEl('polygon', { points: `${tip.x},${tip.y} ${tip.x - dir.x * ah + nx * aw},${tip.y - dir.y * ah + ny * aw} ${tip.x - dir.x * ah - nx * aw},${tip.y - dir.y * ah - ny * aw}`, fill: col }));
  }
  // O'lcham rangi: qatlamda alohida rang berilgan bo'lsa — o'sha, aks holda AutoCAD'dagidek xira ko'k
  function dimCol(st, PP) { return st && st.aci !== 7 ? st.color : PP.kazirok; }
  function paintDim(target, e, sel, w2s, view, PP, st, fade) {
    const k = dimKind(e);
    if (k === 'al') { paintDimAligned(target, e, sel, w2s, view, PP, st, fade); return; }
    const m = PP.fs || 1, col = sel ? PP.accent : dimCol(st, PP);
    const g = svgEl('g', { 'pointer-events': 'none' });
    if (fade != null && fade !== 1) g.setAttribute('opacity', fade);
    const ln = (a, b, wd, op) => g.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': wd * m, opacity: op == null ? 1 : op }));
    const S = (p) => w2s(p.x, p.y);
    const unitv = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
    let lx, ly;
    if (k === 'lin') {
      const r = rotatedDim(e), a = S(r.a), b = S(r.b), p1 = S({ x: e.x1, y: e.y1 }), p2 = S({ x: e.x2, y: e.y2 }), ext = 7 * m;
      if (dist(p1, a) > 0.5) { const u = unitv(p1, a); ln(p1, { x: a.x + u.x * ext, y: a.y + u.y * ext }, 0.9, 0.8); }
      if (dist(p2, b) > 0.5) { const u = unitv(p2, b); ln(p2, { x: b.x + u.x * ext, y: b.y + u.y * ext }, 0.9, 0.8); }
      ln(a, b, sel ? 1.8 : 1.1);
      if (dist(a, b) > 1) { const u = unitv(a, b); dimArrow(g, a, { x: -u.x, y: -u.y }, col, m); dimArrow(g, b, u, col, m); }
      const sgn = e.off >= 0 ? 1 : -1;
      lx = (a.x + b.x) / 2 + r.n.x * 10 * m * sgn; ly = (a.y + b.y) / 2 + r.n.y * 10 * m * sgn;
    } else if (k === 'ang') {
      const A = angularDim(e), V = S(A.V), R = A.r * view.scale;
      const pa = (ang) => { const v = dirVec(ang); return { x: V.x + v.dx * R, y: V.y + v.dy * R }; };
      const A0 = pa(A.a0), A1 = pa(A.a1);
      if (A.sweep > 1e-6 && R > 1) {
        g.appendChild(svgEl('path', { d: `M${A0.x} ${A0.y} A${R} ${R} 0 ${A.sweep > 180 ? 1 : 0} 0 ${A1.x} ${A1.y}`, stroke: col, 'stroke-width': (sel ? 1.8 : 1.1) * m, fill: 'none' }));
        const t0 = dirVec(A.a0 - 90), t1 = dirVec(A.a1 + 90);
        dimArrow(g, A0, { x: t0.dx, y: t0.dy }, col, m); dimArrow(g, A1, { x: t1.dx, y: t1.dy }, col, m);
      }
      // uzaytma chiziqlar: nurdagi nuqtadan o'lcham yoyigacha (yoy undan uzoqda bo'lsa)
      for (const [bd, E] of [[A.lo, A0], [A.hi, A1]]) {
        if (A.r > bd.from + 1e-6) { const v = dirVec(bd.ang), F = S({ x: A.V.x + v.dx * bd.from, y: A.V.y + v.dy * bd.from }); ln(F, { x: E.x + v.dx * 5 * m, y: E.y + v.dy * 5 * m }, 0.9, 0.8); }
      }
      const mid = dirVec(A.a0 + A.sweep / 2);
      lx = V.x + mid.dx * (R + 13 * m); ly = V.y + mid.dy * (R + 13 * m);
    } else {
      const r = radialDim(e), c = S(r.c), P = S(r.P), L = S(r.L), Q = S(r.Q), u = r.u;
      const start = k === 'dia' ? Q : c, end = r.out ? L : P;
      ln(start, end, sel ? 1.8 : 1.1);
      dimArrow(g, P, u, col, m);
      if (k === 'dia') dimArrow(g, Q, { x: -u.x, y: -u.y }, col, m);
      else { ln({ x: c.x - 4, y: c.y }, { x: c.x + 4, y: c.y }, 1); ln({ x: c.x, y: c.y - 4 }, { x: c.x, y: c.y + 4 }, 1); }
      if (r.out) { lx = L.x + u.x * 16 * m; ly = L.y + u.y * 16 * m; }
      else { lx = (start.x + P.x) / 2 - u.y * 11 * m; ly = (start.y + P.y) / 2 + u.x * 11 * m; }
    }
    target.appendChild(g);
    label(target, lx, ly, dimValueText(e), col, 11, PP, true);
  }
  function paintDimAligned(target, e, sel, w2s, view, PP, st, fade) {
    const p1 = w2s(e.x1, e.y1), p2 = w2s(e.x2, e.y2);
    let dx = p2.x - p1.x, dy = p2.y - p1.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const nx = dy, ny = -dx;
    const m = PP.fs || 1;
    const o = e.off * view.scale, sgn = o >= 0 ? 1 : -1, ext = 7 * m * sgn;
    const a = { x: p1.x + nx * o, y: p1.y + ny * o }, b = { x: p2.x + nx * o, y: p2.y + ny * o };
    const col = sel ? PP.accent : dimCol(st, PP);
    const g = svgEl('g', { 'pointer-events': 'none' });
    if (fade != null && fade !== 1) g.setAttribute('opacity', fade);
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
      const k = d.kind || 'al';
      const dot = (p) => { const s = w2s(p.x, p.y); target.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 3, fill: PP.edit, 'pointer-events': 'none' })); };
      if (k === 'rad' || k === 'dia') paintDim(target, { kind: k, x1: d.c.x, y1: d.c.y, x2: cur.x, y2: cur.y, r: d.r }, true, w2s, view, PP);
      else if (k === 'ang') {
        if (d.l1 && !d.V) { const a = w2s(d.l1.a.x, d.l1.a.y), b = w2s(d.l1.b.x, d.l1.b.y); target.appendChild(svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: PP.accent, 'stroke-width': 3.5, opacity: 0.5, 'stroke-linecap': 'round', 'pointer-events': 'none' })); }
        else if (d.V && d.p1 && d.p2) paintDim(target, { kind: 'ang', arc: !!d.arc, cx: d.V.x, cy: d.V.y, x1: d.p1.x, y1: d.p1.y, x2: d.p2.x, y2: d.p2.y, lx: cur.x, ly: cur.y }, true, w2s, view, PP);
        else if (d.V) { dot(d.V); const sv = w2s(d.V.x, d.V.y); for (const p of [d.p1, cur]) if (p) { const s = w2s(p.x, p.y); target.appendChild(svgEl('line', Object.assign({ x1: sv.x, y1: sv.y, x2: s.x, y2: s.y }, dash))); } }
      } else if (!d.p2) { const s1 = w2s(d.p1.x, d.p1.y), s2 = w2s(cur.x, cur.y); target.appendChild(svgEl('line', Object.assign({ x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y }, dash))); }
      else paintDim(target, dimDraftEnt(d, cur), true, w2s, view, PP);
    } else if (d.tool === 'ellipse') {
      const base = d.mode === 'axis' ? d.p1 : d.c, sb = w2s(base.x, base.y), sc = w2s(cur.x, cur.y);
      const stage2 = d.mode === 'axis' ? !!d.p2 : !!d.a;
      if (!stage2) {
        target.appendChild(svgEl('line', Object.assign({ x1: sb.x, y1: sb.y, x2: sc.x, y2: sc.y }, dash)));
        label(target, sc.x + 30, sc.y - 22, fmtLen(dist(base, cur)) + '   ∠ ' + fmtAng(vecAng(cur.x - base.x, cur.y - base.y)), PP.edit, 11, PP, true);
      } else {
        const [v1] = boxVals();
        const ell = ellFromDraft(d, cur, v1 > 0 ? v1 * U() : null);
        const ax = d.mode === 'axis' ? d.p2 : d.a, sa = w2s(ax.x, ax.y);
        target.appendChild(svgEl('line', { x1: sb.x, y1: sb.y, x2: sa.x, y2: sa.y, stroke: PP.edit, 'stroke-width': 1, 'stroke-dasharray': '2 3', 'pointer-events': 'none' }));
        if (ell) { drawEntShape(target, { type: 'pline', pts: ellipsePts(ell), closed: true }, w2s, view, dash); label(target, sc.x + 30, sc.y - 22, fmtLen(2 * ell.rx) + ' × ' + fmtLen(2 * ell.ry), PP.edit, 11, PP, true); }
      }
      target.appendChild(svgEl('circle', { cx: sb.x, cy: sb.y, r: 3, fill: PP.edit, 'pointer-events': 'none' }));
    } else if (d.tool === 'xline' || d.tool === 'ray') {
      if (dist(d.base, cur) > 1e-6) { const r = svg.getBoundingClientRect(); const [a, b] = consEnds({ type: d.tool, x: d.base.x, y: d.base.y, ang: vecAng(cur.x - d.base.x, cur.y - d.base.y) }, view, r.width, r.height); const sa = w2s(a.x, a.y), sb = w2s(b.x, b.y); target.appendChild(svgEl('line', Object.assign({ x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y }, dash))); }
      const s0 = w2s(d.base.x, d.base.y); target.appendChild(svgEl('circle', { cx: s0.x, cy: s0.y, r: 3.5, fill: PP.edit, 'pointer-events': 'none' }));
      const sc = w2s(cur.x, cur.y); label(target, sc.x + 30, sc.y - 22, '∠ ' + fmtAng(vecAng(cur.x - d.base.x, cur.y - d.base.y)), PP.edit, 11, PP, true);
    } else if (d.tool === 'spline') {
      const pts = d.pts.concat(dist(d.pts[d.pts.length - 1], cur) > 1e-6 ? [cur] : []);
      const closed = state.opt.splClosed && pts.length >= 3;
      const sp = splinePts(pts, closed, 12);
      if (sp.length >= 2) target.appendChild(svgEl(closed ? 'polygon' : 'polyline', Object.assign({ points: ptsAttr(sp, w2s) }, dash, { 'stroke-dasharray': 'none', 'stroke-width': 1.8 })));
      for (const p of d.pts) { const s = w2s(p.x, p.y); target.appendChild(svgEl('rect', { x: s.x - 3, y: s.y - 3, width: 6, height: 6, fill: 'none', stroke: PP.accent, 'stroke-width': 1.2, 'pointer-events': 'none' })); }
    } else if (d.tool === 'text') {
      const s = textEd.value;
      const ghost = { x: d.p.x, y: d.p.y, h: d.h, rot: d.rot, text: s };
      if (s) paintText(target, ghost, w2s, view, PP.edit, false);
      const u = dirVec(d.rot), v = dirVec(d.rot + 90), W = s ? textW(ghost) : 0;
      const c0 = w2s(d.p.x + u.dx * W, d.p.y + u.dy * W), hh = d.h * view.scale;
      target.appendChild(svgEl('line', { x1: c0.x, y1: c0.y, x2: c0.x + v.dx * hh, y2: c0.y + v.dy * hh, stroke: PP.accent, 'stroke-width': 1.6, 'pointer-events': 'none' }));
      const sp0 = w2s(d.p.x, d.p.y);
      target.appendChild(svgEl('circle', { cx: sp0.x, cy: sp0.y, r: 2.5, fill: PP.accent, 'pointer-events': 'none' }));
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
        if (g.type === 'dim') { if (d.tool === 'mirror' && g.off != null) g.off = -g.off; paintDim(target, g, true, w2s, view, PP); }
        else if (g.type === 'text') paintText(target, g, w2s, view, PP.accent, false, 0.8);
        else if (g.type === 'hatch' || isCons(g)) drawEntShape(target, g, w2s, view, Object.assign({}, dash, { stroke: PP.accent }));
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
    const SNC = PP.snap || PP.accent;   // AutoCAD doskasida sariq (AutoSnap)
    const ext = Math.max(W, H) * 2;
    for (const t of res.tracks || []) {
      const a = w2s(t.from.x, t.from.y), b = w2s(t.to.x, t.to.y);
      let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const p1 = t.polar ? a : { x: a.x - dx * ext, y: a.y - dy * ext };   // polar nur faqat oldinga, kuzatish chizig'i ikki tomonga
      const p2 = { x: a.x + dx * ext, y: a.y + dy * ext };
      target.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: SNC, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0.75, 'pointer-events': 'none' }));
    }
    for (const A of state.track.acq) {
      const s = w2s(A.x, A.y);
      target.appendChild(svgEl('line', { x1: s.x - 5, y1: s.y, x2: s.x + 5, y2: s.y, stroke: SNC, 'stroke-width': 1.2, 'pointer-events': 'none' }));
      target.appendChild(svgEl('line', { x1: s.x, y1: s.y - 5, x2: s.x, y2: s.y + 5, stroke: SNC, 'stroke-width': 1.2, 'pointer-events': 'none' }));
    }
    if (res.snap) { const s = w2s(res.snap.x, res.snap.y); for (const sh of snapMarkerShapes(res.snap.kind, s.x, s.y, SNC, 6)) target.appendChild(svgEl(sh.tag, sh.attrs)); }
    else if (res.kind !== 'raw' && res.kind !== 'grid') { const s = w2s(res.x, res.y); for (const sh of snapMarkerShapes(res.kind, s.x, s.y, SNC, 5)) target.appendChild(svgEl(sh.tag, sh.attrs)); }
    if (res.tip && state.cursorS) label(target, state.cursorS.sx + 16 + res.tip.length * 3.2, state.cursorS.sy + 24, res.tip, SNC, 10.5, PP);
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
      for (const p of projVerts(e)) {
        const k = v + Math.round(p.x * 10) + ':' + Math.round(p.y * 10); if (seen.has(k)) continue; seen.add(k);
        const s = w2s(p.x, p.y);
        if (v === 'V') { dot(s, { x: s.x, y: H + 10 }); dot(s, { x: W + 10, y: s.y }); }
        else if (v === 'H') { dot(s, { x: s.x, y: -10 }); const f = w2s(P.wx + (p.y - P.hy), p.y); dot(s, f); dot(f, { x: f.x, y: -10 }); }
        else { dot(s, { x: -10, y: s.y }); const f = w2s(p.x, P.hy + (p.x - P.wx)); dot(s, f); dot(f, { x: -10, y: f.y }); }
      }
    }
  }
  function paint(target, view, W, H, exportMode) {
    const PP = exportMode ? EXPORT_P : BP();
    const m = PP.fs || 1;
    const w2s = (x, y) => ({ x: x * view.scale + view.panX, y: y * view.scale + view.panY });
    while (target.firstChild) target.removeChild(target.firstChild);
    if (exportMode) target.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: '#ffffff' }));
    else if (state.snapSet.grid) paintGrid(target, view, W, H);
    if (state.proj.on) paintProjFrames(target, w2s, W, H, PP, exportMode);
    // Qatlam: o'chiq/muzlatilgan ko'rinmaydi; eksportda «chop etilmaydi» ham chiqmaydi
    const list = exportMode ? plotEnts() : visEnts();
    // 0) shtrixlar — boshqa elementlar ostida
    for (const e of list) if (e.type === 'hatch') paintHatch(target, e, w2s, view, PP, !exportMode && state.sel.has(e.id), exportMode, styleOf(e, PP, view.scale, exportMode, m));
    // 1) elementlar
    for (const e of list) {
      const sel = !exportMode && state.sel.has(e.id);
      if (e.type === 'hatch') continue;
      const st = styleOf(e, PP, view.scale, exportMode, m);
      const fade = !exportMode && st.locked ? 0.45 : 1;   // qulflangan qatlam xira (AutoCAD LAYLOCKFADECTL)
      if (isCons(e)) {   // yordamchi chiziqlar rasmga (PNG) chiqmaydi
        if (exportMode) continue;
        const [a, b] = consEnds(e, view, W, H), sa = w2s(a.x, a.y), sb = w2s(b.x, b.y);
        target.appendChild(svgEl('line', { x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y, stroke: sel ? PP.accent : st.color, 'stroke-width': sel ? 2 : (st.width || 1.1), 'stroke-dasharray': sel ? '7 4' : (st.dash || 'none'), opacity: (sel ? 1 : 0.7) * fade, 'pointer-events': 'none' }));
        continue;
      }
      if (e.type === 'dim') { paintDim(target, e, sel, w2s, view, PP, st, fade); continue; }
      if (e.type === 'text') {
        if (!exportMode && state.draft && state.draft.tool === 'text' && state.draft.edit === e.id) continue;   // tahrirlanayotgan matn — jonli ko'rinishda
        paintText(target, e, w2s, view, sel ? PP.accent : st.color, sel, fade); continue;
      }
      const col = sel ? PP.accent : st.color;
      const attrs = { stroke: col, 'stroke-width': sel ? 2.6 * m : (st.width || 1.9 * m), fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'pointer-events': 'none' };
      if (st.dash && !sel) attrs['stroke-dasharray'] = st.dash;
      if (fade !== 1) attrs.opacity = fade;
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
    for (const e of list) {
      if (e.type === 'pline') paintPlineLabels(target, e.pts, e.closed, w2s, PP, !exportMode && state.sel.has(e.id), !!e.smooth);
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
    // 6) UCS belgisi (AutoCAD): koordinata boshida, ko'rinmasa — chap pastda
    paintUcs(target, w2s, W, H, PP);
    // 7) Kursor ostidagi obyekt (AutoCAD tanlash oldidan ko'rinishi)
    paintHoverHighlight(target, w2s, view, PP);
    // 8) Krestik kursor (+ tanlash qutichasi)
    paintCrosshair(target, W, H, PP);
  }
  function paintUcs(target, w2s, W, H, PP) {
    const o = w2s(0, 0), bottom = H - 80;
    const inside = o.x > 14 && o.x < W - 44 && o.y > 44 && o.y < bottom;
    const x = inside ? o.x : 18, y = inside ? o.y : bottom - 4, L = 28;
    const g = svgEl('g', { 'pointer-events': 'none', opacity: inside ? 0.95 : 0.75 });
    const red = '#e5534b', green = '#57ab5a';
    g.appendChild(svgEl('line', { x1: x, y1: y, x2: x + L, y2: y, stroke: red, 'stroke-width': 1.6 }));
    g.appendChild(svgEl('polygon', { points: (x + L + 6) + ',' + y + ' ' + (x + L - 2) + ',' + (y - 4) + ' ' + (x + L - 2) + ',' + (y + 4), fill: red }));
    g.appendChild(svgEl('line', { x1: x, y1: y, x2: x, y2: y - L, stroke: green, 'stroke-width': 1.6 }));
    g.appendChild(svgEl('polygon', { points: x + ',' + (y - L - 6) + ' ' + (x - 4) + ',' + (y - L + 2) + ' ' + (x + 4) + ',' + (y - L + 2), fill: green }));
    g.appendChild(svgEl('rect', { x: x - 3, y: y - 3, width: 6, height: 6, fill: 'none', stroke: PP.text, 'stroke-width': 1 }));
    const tx = (t, px, py, c) => { const e2 = svgEl('text', { x: px, y: py, fill: c, 'font-size': 10, 'font-weight': 800, 'font-family': 'system-ui, sans-serif' }); e2.textContent = t; g.appendChild(e2); };
    tx('X', x + L + 8, y + 4, red); tx('Y', x - 4, y - L - 9, green);
    target.appendChild(g);
  }
  function paintHoverHighlight(target, w2s, view, PP) {
    if (!state.cursorIn || !state.cursorS || state.grip || selBoxEl.style.display === 'block') return;
    const t = state.tool;
    const ok = state.picking || (!state.draft && ['select', 'erase', 'explode', 'join', 'pedit', 'offset', 'fillet', 'chamfer'].includes(t)) || (t === 'area' && state.opt.areaMode === 'obj' && !state.draft);
    if (!ok) return;
    const hit = entAt(state.cursorS.sx, state.cursorS.sy); if (!hit) return;
    if (hit.ent.type === 'dim') { paintDim(target, hit.ent, true, w2s, view, PP); return; }
    if (hit.ent.type === 'text') { target.appendChild(svgEl('polygon', { points: ptsAttr(textBox(hit.ent, textW(hit.ent)), w2s), fill: PP.accent, 'fill-opacity': 0.12, stroke: PP.accent, 'stroke-width': 1.2, 'pointer-events': 'none' })); return; }
    drawEntShape(target, hit.ent, w2s, view, { stroke: PP.accent, 'stroke-width': 3.2, fill: 'none', opacity: 0.55, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'pointer-events': 'none' });
  }
  function paintCrosshair(target, W, H, PP) {
    if (!state.cursorIn || !state.cursorS) return;
    const { sx, sy } = state.cursorS, col = PP.cross || PP.text;
    const L = Math.max(36, Math.round(Math.max(W, H) * 0.05));
    const pick = state.picking || (!state.draft && PICK_TOOLS.includes(state.tool));
    const gp = pick ? 5 : 0;
    const g = svgEl('g', { 'pointer-events': 'none', stroke: col, 'stroke-width': 1, opacity: 0.9 });
    g.appendChild(svgEl('line', { x1: sx - L, y1: sy, x2: sx - gp, y2: sy })); g.appendChild(svgEl('line', { x1: sx + gp, y1: sy, x2: sx + L, y2: sy }));
    g.appendChild(svgEl('line', { x1: sx, y1: sy - L, x2: sx, y2: sy - gp })); g.appendChild(svgEl('line', { x1: sx, y1: sy + gp, x2: sx, y2: sy + L }));
    if (pick) g.appendChild(svgEl('rect', { x: sx - 5, y: sy - 5, width: 10, height: 10, fill: 'none' }));
    target.appendChild(g);
  }
  function render() {
    const r = svg.getBoundingClientRect();
    paint(svg, { scale: state.scale, panX: state.panX, panY: state.panY }, r.width, r.height, false);
    positionBox(); positionTextEd(); updateScaleInfo(); saveLS();
    if (state.tool === 'area' || state.tool === 'align' || state.tool === 'stretch') syncOptRow();
  }
  function afterChange() { _loops = null; computeAutoOff(); render(); updatePanel(); }

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
    for (const e of scoped) if (e.type === 'arc') { total += arcLen(e); segs++; } else if (e.type === 'pline' && e.smooth) { for (const s of plineSegs(e)) total += dist(s.a, s.b); segs++; } else if (e.type === 'pline') {
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
    syncLayerUI(); renderProps();   // tanlov o'zgarganda qatlam va xususiyat ro'yxatlari ham yangilanadi
    const el = q('segTable'), ap = activePline();
    if (!ap || ap.pts.length < 2) { el.innerHTML = '<div class="dtl-empty">Chiziq yo\'q — «Chiziq» asbobi bilan chizing</div>'; return; }
    if (ap.smooth) {   // ellips / splayn — segmentlar jadvali o'rniga umumiy ma'lumot
      let L = 0; for (const s of plineSegs(ap)) L += dist(s.a, s.b);
      el.innerHTML = '<div class="dtl-empty">' + (ap.smooth === 'ellipse' ? 'Ellips' : 'Silliq egri (splayn)') + ' — uzunligi ' + fmtLen(L)
        + (ap.ell ? ', ' + fmtLen(2 * ap.ell.rx) + ' × ' + fmtLen(2 * ap.ell.ry) : '')
        + (ap.ell ? ". Griplar (markaz, o'q uchlari) bilan yoki 2 marta bosib o'zgartiring." : (ap.fit ? ". Shaklini fit nuqtalar (griplar) bilan o'zgartiring." : '.')) + '</div>';
      return;
    }
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
    const item = { id: Date.now(), name, ents: JSON.parse(JSON.stringify(state.ents)), layers: JSON.parse(JSON.stringify(state.layers)), proj: JSON.parse(JSON.stringify(state.proj)), autoOff: state.autoOff, t: Date.now() };
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
    mergeLayers(it.layers); migrateEnts(state.ents, V.mainLayer);   // chizma o'z qatlamlarini olib keladi
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
  // DXF: chiziq turlari jadvali (LTYPE) — nomlangan punktirlar boshqa dasturda ham ko'rinsin
  function dxfLtypeTable(names) {
    const num = (v) => (Math.round(v * 1000) / 1000).toString();
    const list = ['CONTINUOUS'].concat(names.filter((n) => n !== 'CONTINUOUS'));
    let t = '0\nTABLE\n2\nLTYPE\n70\n' + list.length + '\n';
    for (const n of list) {
      const d = LT[n] || LT.CONTINUOUS;
      const pat = d.pat || [];
      const els = [];
      for (let i = 0; i < pat.length; i++) els.push(i % 2 ? -pat[i] : pat[i]);
      const total = els.reduce((a, b) => a + Math.abs(b), 0);
      t += '0\nLTYPE\n2\n' + n + '\n70\n0\n3\n' + (d.nomi || n) + '\n72\n65\n73\n' + els.length + '\n40\n' + num(total) + '\n';
      for (const v of els) t += '49\n' + num(v) + '\n';
    }
    return t + '0\nENDTAB\n';
  }
  // DXF: qatlamlar jadvali (LAYER) — nom, rang (ACI), chiziq turi, qalinlik
  function dxfLayerTable(layers) {
    let t = '0\nTABLE\n2\nLAYER\n70\n' + layers.length + '\n';
    for (const l of layers) {
      const flags = (l.frozen ? 1 : 0) + (l.locked ? 4 : 0);
      const col = l.on ? Math.abs(l.color || 7) : -Math.abs(l.color || 7);   // manfiy — qatlam o'chiq
      t += '0\nLAYER\n2\n' + l.nomi + '\n70\n' + flags + '\n62\n' + col + '\n6\n' + (l.lt || 'CONTINUOUS') + '\n';
      if (Number.isFinite(l.lw) && l.lw >= 0) t += '370\n' + Math.round(l.lw) + '\n';
    }
    return t + '0\nENDTAB\n';
  }
  function buildDxf() {
    const num = (v) => (Math.round(v * 1000) / 1000).toString();
    let out = '', lay = V.mainLayer, extra = '';
    // Element ustidagi xossalar (qatlamdan farqli rang / chiziq turi / qalinlik)
    const ex = (e) => (Number.isFinite(e.col) ? '62\n' + e.col + '\n' : '') + (e.lt && LT[e.lt] ? '6\n' + e.lt + '\n' : '') + (Number.isFinite(e.lw) && e.lw >= 0 ? '370\n' + Math.round(e.lw) + '\n' : '');
    const L = (x1, y1, x2, y2) => { out += '0\nLINE\n8\n' + lay + '\n' + extra + '10\n' + num(x1) + '\n20\n' + num(-y1) + '\n30\n0\n11\n' + num(x2) + '\n21\n' + num(-y2) + '\n31\n0\n'; };
    const emit = (ents, fixedLay) => {
      for (const e of ents) {
        lay = fixedLay || (e.lay == null ? V.mainLayer : e.lay);
        extra = fixedLay ? '' : ex(e);
        if (e.type === 'pline') { for (const s of plineSegs(e)) if (dist(s.a, s.b) > 1e-6) L(s.a.x, s.a.y, s.b.x, s.b.y); }
        else if (e.type === 'circle') out += '0\nCIRCLE\n8\n' + lay + '\n' + extra + '10\n' + num(e.cx) + '\n20\n' + num(-e.cy) + '\n30\n0\n40\n' + num(e.r) + '\n';
        else if (e.type === 'point') out += '0\nPOINT\n8\n' + lay + '\n' + extra + '10\n' + num(e.x) + '\n20\n' + num(-e.y) + '\n30\n0\n';
        else if (e.type === 'text') out += '0\nTEXT\n8\n' + lay + '\n' + extra + '10\n' + num(e.x) + '\n20\n' + num(-e.y) + '\n30\n0\n40\n' + num(e.h) + '\n1\n' + String(e.text).replace(/[\r\n]+/g, ' ') + '\n50\n' + num(e.rot || 0) + '\n';
        else if (e.type === 'arc') out += '0\nARC\n8\n' + lay + '\n' + extra + '10\n' + num(e.cx) + '\n20\n' + num(-e.cy) + '\n30\n0\n40\n' + num(e.r) + '\n50\n' + num(e.a0) + '\n51\n' + num(e.a1) + '\n';
      }
    };
    const ents = plotEnts();   // o'chiq / muzlatilgan / «chop etilmaydi» qatlamlar chiqmaydi
    emit(ents);
    emit(state.autoEnts || [], 'OFSET');   // avtomatik ichki ofset — alohida qatlam
    // Faqat ishlatilgan qatlamlar (+ OFSET bo'lsa) yoziladi
    const usedN = new Set(ents.map((e) => layOf(e).nomi));
    if ((state.autoEnts || []).length) usedN.add('OFSET');
    const layers = state.layers.filter((l) => usedN.has(l.nomi));
    if (!layers.length) layers.push(makeLayer(V.mainLayer, { color: 7 }));
    const lts = Array.from(new Set(layers.map((l) => l.lt).concat(ents.map((e) => e.lt).filter((x) => x && LT[x]))));
    const tables = '0\nSECTION\n2\nTABLES\n' + dxfLtypeTable(lts) + dxfLayerTable(layers) + '0\nENDSEC\n';
    return '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n9\n$LTSCALE\n40\n' + num(state.ltscale) + '\n0\nENDSEC\n'
      + tables + '0\nSECTION\n2\nENTITIES\n' + out + '0\nENDSEC\n0\nEOF\n';
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
        proj: state.proj, autoOff: state.autoOff, arcMethod: state.arcMethod, opt: state.opt, board: state.board, cmdUse: state.cmdUse,
        layers: state.layers, clay: state.clay, ltscale: state.ltscale, lwShow: state.lwShow,
      }));
    } catch (e) { setInfo('Brauzer xotirasi to\u2018ldi \u2014 chizma saqlanmadi (eski detallarni kutubxonadan o\u2018chiring)', 'err'); }
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
      try { state.layers = sanitizeLayers(o.layers, V.mainLayer); } catch (e2) { state.layers = defaultLayers(V.mainLayer); }
      layDirty();
      state.clay = (findLayer(state.layers, o.clay) || findLayer(state.layers, V.mainLayer) || state.layers[0]).nomi;
      if (Number.isFinite(o.ltscale) && o.ltscale > 0) state.ltscale = Math.min(1000, o.ltscale);
      state.lwShow = !!o.lwShow;
      migrateEnts(state.ents, V.mainLayer);   // eski chizma (qatlamsiz) — asosiy qatlamga
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
      if (o.board === 'acad' || o.board === 'theme') state.board = o.board;
      if (o.cmdUse && typeof o.cmdUse === 'object') { for (const k in o.cmdUse) if (Number.isFinite(o.cmdUse[k])) state.cmdUse[k] = o.cmdUse[k]; }
      if (o.opt && typeof o.opt === 'object') {
        const p = o.opt, so = state.opt;
        so.col = Number.isFinite(p.col) ? p.col : null;
        so.lt = (p.lt && LT[p.lt]) ? p.lt : null;
        so.lw = Number.isFinite(p.lw) ? p.lw : null;
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
        if (DIM_KINDS[p.dimKind]) so.dimKind = p.dimKind;
        if (p.ellMode === 'center' || p.ellMode === 'axis') so.ellMode = p.ellMode;
        if (typeof p.splClosed === 'boolean') so.splClosed = p.splClosed;
        if (Number.isFinite(p.textH) && p.textH > 0) so.textH = p.textH;
        if (Number.isFinite(p.textRot)) so.textRot = p.textRot;
        if (['solid', 'ansi31', 'net', 'line'].includes(p.hatchPat)) so.hatchPat = p.hatchPat;
        if (Number.isFinite(p.hatchSc) && p.hatchSc > 0) so.hatchSc = p.hatchSc;
        if (Number.isFinite(p.hatchAng)) so.hatchAng = p.hatchAng;
        if (['pt', 'hor', 'ver', 'ang'].includes(p.xlMode)) so.xlMode = p.xlMode;
        if (Number.isFinite(p.xlAng)) so.xlAng = p.xlAng;
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
    root.querySelectorAll('.etool').forEach((b) => b.classList.toggle('active', b.getAttribute('data-tool') === state.tool && (!b.dataset.dimk || b.dataset.dimk === (state.opt.dimKind || 'al'))));
    const tg = (n, onv) => { const b = q(n); if (b) b.classList.toggle('off', !onv); };
    tg('tgLen', state.showLen); tg('tgAng', state.showAng); tg('tgBoard', state.board === 'acad');
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
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); commitBox(); return; }
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

  let panning = false, panStart = null, boxSel = null, rclick = null, lastMid = 0;
  on(canvasWrap, 'contextmenu', (e) => e.preventDefault());
  on(canvasWrap, 'mousedown', (e) => {
    if (inputBox.contains(e.target) || q('cmdLine').contains(e.target) || ctxMenu.contains(e.target) || q('layDlg').contains(e.target) || e.target === textEd) return;
    commitOptInputs();   // variantlar qatoridagi yozilgan son (blur bo'lmagan) qo'llansin
    hideCtx();
    if (e.button === 0 && state.draft && state.draft.tool === 'text' && state.tool !== 'text') textCommit(false);   // matn tahriri — chizmaga bosilsa saqlanadi
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      if (e.button === 1) {   // g'ildirakni ikki marta bosish — markazga (AutoCAD zoom extents)
        const now = Date.now();
        if (now - lastMid < 350) { lastMid = 0; centerView(); return; }
        lastMid = now;
      }
      rclick = e.button === 2 ? { x: e.clientX, y: e.clientY, moved: false } : null;   // o'ng tugma: surilmasa — menyu
      panning = true; panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();   // fokus kiritish qutisidan ketmasin
    const { sx, sy } = evScreen(e);
    if (state.tool === 'select' || state.picking) {
      const g = state.tool === 'select' ? gripAt(sx, sy) : null;
      if (g) { state.grip = g; state.snapHit = null; return; }
      boxSel = { sx, sy, moved: false, additive: e.shiftKey, candidate: entAt(sx, sy) };
      return;
    }
    const w = resolveCursor(sx, sy, anchorPoint());
    state.cursor = w; state.cursorS = { sx, sy };
    state.shiftDown = e.shiftKey;
    state.lastPt = { x: w.x, y: w.y };
    toolClick(sx, sy, w);
    state.snapOnce = null;   // bir martalik magnit ishlatildi
    state.cmdFresh = false;
    clearAcq();
    refocusBox();
  });
  on(window, 'mousemove', (e) => {
    if (panning) {
      if (rclick && Math.hypot(e.clientX - rclick.x, e.clientY - rclick.y) > 4) rclick.moved = true;
      if (rclick && !rclick.moved) return;   // o'ng tugma hali surilmadi — menyu bo'lishi mumkin
      state.panX = panStart.panX + (e.clientX - panStart.x);
      state.panY = panStart.panY + (e.clientY - panStart.y);
      render(); return;
    }
    const { sx, sy } = evScreen(e);
    const wasIn = state.cursorIn;
    state.cursorIn = e.target === svg;   // faqat chizma maydoni ustida (buyruq satri, holat paneli ustida emas)
    state.cursorS = { sx, sy };
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
        // AutoCAD: oyna (chapdan o'ngga) — ko'k, to'liq ichidagilar; kesib o'tish (o'ngdan chapga) — yashil punktir
        selBoxEl.style.border = crossing ? '1px dashed #3cbf5c' : '1px solid #3c8cff';
        selBoxEl.style.background = crossing ? 'rgba(60,191,92,.18)' : 'rgba(60,140,255,.18)';
        render();
      }
      return;
    }
    state.cursor = resolveCursor(sx, sy, anchorPoint());
    state.cursorS = { sx, sy };
    if (PICK_TOOLS.includes(state.tool) || state.picking) { state.snapHit = null; state.snapRes = null; }
    statusBar.setCoords('X ' + fmtNum(state.cursor.x / U(), 2) + '   Y ' + fmtNum(-state.cursor.y / U(), 2) + '  ' + UNIT_LABEL[state.unit]);
    if (state.cursorIn || wasIn || state.draft || LIVE_TOOLS.includes(state.tool) || MODIFY.includes(state.tool)) render();
  });
  on(window, 'mouseup', (e) => {
    if (panning) { panning = false; const rc = rclick; rclick = null; if (rc && !rc.moved && e.button === 2) onRightClick(e); return; }
    if (state.grip) { const pushed = state.grip.pushed; state.grip = null; state.snapHit = null; if (pushed) afterChange(); else render(); return; }
    if (!boxSel) return;
    const { sx, sy } = evScreen(e);
    const bs = boxSel; boxSel = null; selBoxEl.style.display = 'none';
    if (!bs.moved) {
      // Qatlam amali (LAYOFF…) yoki xususiyat nusxasi (MA) elementni kutmoqda
      if ((state.layPick || state.match) && bs.candidate) {
        if (state.layPick) doLayPick(bs.candidate.ent); else doMatchProp(bs.candidate.ent);
        render(); return;
      }
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
        if (!entPickable(ent)) continue;   // o'chiq / muzlatilgan / qulflangan qatlam ramkaga tushmaydi
        if (boxHit(ent, r, crossing)) { if (bs.additive) state.sel.delete(ent.id); else state.sel.add(ent.id); }
      }
    }
    if (state.picking) setInfo(toolLabel(state.tool) + ': tanlandi ' + state.sel.size + " — yana tanlang yoki Enter / Probel / o'ng tugma");
    render(); renderTable(); renderOptRow();
  });
  on(canvasWrap, 'dblclick', (e) => {
    if (inputBox.contains(e.target) || e.target === textEd || state.tool !== 'select') return;
    e.preventDefault();
    const { sx, sy } = evScreen(e);
    const hit = entAt(sx, sy); if (!hit) return;
    if (hit.ent.type === 'text') { state.sel.clear(); textStart(null, hit.ent); return; }
    if (hit.ent.type === 'pline' && hit.ent.ell) { state.sel.clear(); state.sel.add(hit.ent.id); openEllipseEdit(hit.ent); return; }
    if (hit.ent.type === 'pline' && hit.ent.smooth) { state.sel.clear(); state.sel.add(hit.ent.id); render(); setInfo("Silliq egri: shaklini griplar bilan o'zgartiring"); return; }
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
      if (q('textWin').classList.contains('show')) { e.preventDefault(); toggleTextWin(false); return; }
      if (arcMenu.classList.contains('show')) { e.preventDefault(); showArcMenu(false); return; }
      if (q('layDlg').classList.contains('show')) { e.preventDefault(); openLayerDlg(false); return; }
      if (state.layPick || state.match) { e.preventDefault(); state.layPick = null; state.match = null; setInfo('*Bekor qilindi*'); return; }
      pendingNum = null;
      if (ctxMenu.classList.contains('show')) { e.preventDefault(); hideCtx(); return; }
      if (state.picking) { e.preventDefault(); state.picking = false; state.sel.clear(); setTool('select'); state.cmdFresh = false; setInfo('*Bekor qilindi*'); return; }
      if (state.measureShow) { state.measureShow = null; render(); }
      state.cmdFresh = false;
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
    if (e.key === 'F2') { e.preventDefault(); toggleTextWin(); return; }   // AutoCAD: buyruqlar oynasi (faqat chizma faol bo'lganda)
    if (e.key === 'Tab' && e.shiftKey) return;
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ' ') {   // AutoCAD: Enter / Probel — buyruqni tugatish; bo'sh joyda → Tanlash, yana → oxirgi asbob
      e.preventDefault(); pressEnter(); return;
    }
    // Chiziq chizilayotganda C — konturni yopish (AutoCAD LINE → Close)
    if (state.draft && state.draft.tool === 'pline' && (e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) { e.preventDefault(); finishPline(true); return; }
    if (state.draft && state.draft.tool === 'spline' && !e.ctrlKey && !e.metaKey) {   // Splayn: C — yopish, Backspace — oxirgi nuqtani olib tashlash
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); finishSpline(true); return; }
      if (e.key === 'Backspace') { e.preventDefault(); splineBack(); return; }
    }
    // Harf bosilsa — buyruq qidirish maydoniga tushadi (AutoCAD buyruq satri kabi)
    // Harf, raqam yoki koordinata belgisi bosilsa — buyruq satriga tushadi (AutoCAD buyruq satri kabi)
    if (q('textWin').classList.contains('show')) return;   // buyruqlar oynasi ochiq — ko'rinmas satrga yozilmasin
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /[a-zA-Z0-9'@<,.\-]/.test(e.key)) { e.preventDefault(); cmdOpen(e.key); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel.size && !state.draft) { e.preventDefault(); eraseSelected(); return; }
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'e') { e.preventDefault(); centerView(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '1') { e.preventDefault(); q('tgProps').click(); }   // AutoCAD: Ctrl+1 — Xususiyatlar
    else if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); for (const x of pickEnts()) state.sel.add(x.id); render(); renderTable(); renderOptRow(); setInfo(state.sel.size + ' ta obyekt tanlandi'); }
  });

  function pressEnter() {
    if (state.picking) {   // obyekt tanlash tugadi → buyruq davom etadi
      if (!state.sel.size) { setInfo('Hech narsa tanlanmadi — obyektni bosing yoki ramka torting (Esc — bekor)'); return; }
      state.picking = false; setInfo(toolHint(state.tool)); syncButtons(); render(); return;
    }
    if (state.draft && state.draft.tool === 'pline') { finishPline(false); return; }
    if (state.tool === 'array' && state.sel.size && (state.opt.arr.kind === 'rect' || (state.draft && state.draft.center))) { applyArray(); return; }
    if (state.tool === 'join' && state.sel.size && !state.draft) { joinSelected(selectedEnts()); return; }
    if (state.draft && state.draft.tool === 'align' && state.draft.pts.length >= 2) { applyAlign(state.draft.pts.slice(0, 2)); return; }
    if (state.draft && state.draft.tool === 'area') { finishAreaPts(); return; }
    if (state.draft && state.draft.tool === 'spline') { finishSpline(null); return; }
    if (state.draft && state.draft.tool === 'text') { textCommit(false); return; }
    if (state.draft) { cancelCurrent(); return; }
    if (state.tool !== 'select') setTool('select');
    else if (state.lastTool && TOOLS.includes(state.lastTool)) setTool(state.lastTool);
  }

  /* ---------------- O'NG TUGMA MENYUSI (AutoCAD kontekst menyusi) ---------------- */
  const ctxMenu = q('ctxMenu');
  let ctxItems = [];
  function hideCtx() { ctxMenu.classList.remove('show'); }
  function onRightClick(e) {
    if (state.picking) { pressEnter(); return; }   // AutoCAD: tanlash paytida o'ng tugma = Enter
    const d = state.draft, it = [];
    const add = (label, fn, dis) => it.push({ label, fn, dis: !!dis });
    if (d) {
      add('Kiritish (Enter)', pressEnter);
      if (d.tool === 'pline') { add('Yopish (C)', () => finishPline(true), d.pts.length < 3); add('Orqaga (Backspace)', plineBackspace, d.pts.length < 2); }
      if (d.tool === 'spline') { add('Yopish (C)', () => finishSpline(true), d.pts.length < 3); add('Orqaga (Backspace)', splineBack); }
      add('Bekor qilish (Esc)', cancelCurrent);
    } else {
      const last = state.lastTool && TOOLS.includes(state.lastTool) ? state.lastTool : null;
      if (last) add('Takrorlash: ' + toolLabel(last), () => setTool(last));
      if (cmdRecent.length > 1) { it.push('-'); for (const id of cmdRecent.slice(0, 5)) add('Oxirgi: ' + cmdLabel(id), () => runCmd(id)); }
      if (state.sel.size) {
        it.push('-');
        for (const t of ['move', 'copy', 'rotate', 'scale', 'mirror', 'offset']) add(toolLabel(t), () => setTool(t));
        add("O'chirish (Delete)", () => { eraseSelected(); setInfo("Tanlanganlar o'chirildi"); });
        add("Tanlovni bo'shatish", () => { state.sel.clear(); render(); renderTable(); renderOptRow(); });
      }
      it.push('-');
      add('Hammasini tanlash (Ctrl+A)', () => { for (const x of state.ents) state.sel.add(x.id); render(); renderOptRow(); });
    }
    it.push('-');
    add('Orqaga (Ctrl+Z)', undo, !state.hist.length);
    add('Oldinga (Ctrl+Y)', redo, !state.redo.length);
    add('Markazga (zoom)', centerView);
    openCtxMenu(it, e.clientX, e.clientY);
  }
  function openCtxMenu(it, clientX, clientY) {
    ctxItems = it;
    ctxMenu.innerHTML = it.map((x, i) => (x === '-' ? '<div class="chz-ctxsep"></div>' : '<button type="button" data-i="' + i + '"' + (x.dis ? ' disabled' : '') + '>' + escHtml(x.label) + '</button>')).join('');
    const r = canvasWrap.getBoundingClientRect();
    ctxMenu.classList.add('show');
    const mw = ctxMenu.offsetWidth || 200, mh = ctxMenu.offsetHeight || 200;
    ctxMenu.style.left = Math.max(4, Math.min(clientX - r.left, r.width - mw - 4)) + 'px';
    ctxMenu.style.top = Math.max(4, Math.min(clientY - r.top, r.height - mh - 4)) + 'px';
  }
  on(ctxMenu, 'mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
  on(ctxMenu, 'click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; const x = ctxItems[+b.dataset.i]; hideCtx(); if (x && x.fn) x.fn(); });
  on(document, 'mousedown', (e) => { if (ctxMenu.classList.contains('show') && !ctxMenu.contains(e.target)) hideCtx(); });
  on(q('cmdLine'), 'mousedown', (e) => e.stopPropagation());
  on(q('tgBoard'), 'click', () => { state.board = state.board === 'acad' ? 'theme' : 'acad'; applyBoard(); syncButtons(); render(); saveLS(); setInfo(state.board === 'acad' ? 'AutoCAD doskasi' : 'Mavzu ranglari'); });

  /* ---------------- QATLAM / XUSUSIYAT HODISALARI ---------------- */
  // Lentadagi joriy qatlam ro'yxati: tanlov bo'lsa — tanlanganlarni ko'chiradi (AutoCAD)
  on(q('laySel'), 'change', (e) => {
    const v = e.target.value; if (!v) return;
    if (state.sel.size) moveSelToLayer(v); else setClay(v);
  });
  const propSel = (name, key, parse) => on(q(name), 'change', (e) => {
    const raw = e.target.value;
    const val = raw === '' ? null : parse(raw);
    if (state.sel.size) setSelProp(key, val);
    else { state.opt[key] = val; saveLS(); setInfo((key === 'col' ? 'Rang' : key === 'lt' ? 'Chiziq turi' : 'Qalinlik') + ': ' + (val == null ? 'qatlam bo‘yicha' : raw) + ' — yangi elementlar uchun'); }
    syncLayerUI();
  });
  propSel('colSel', 'col', (v) => Number(v));
  propSel('ltSel', 'lt', (v) => v);
  propSel('lwSel', 'lw', (v) => Number(v));
  on(q('btnLayMgr'), 'click', () => openLayerDlg(true));
  on(q('btnLayCur'), 'click', () => { if (state.sel.size) setClay(layOf(selectedEnts()[0]).nomi); else startLayPick('cur'); });
  on(q('layClose'), 'click', () => openLayerDlg(false));
  on(q('layDlg'), 'mousedown', (e) => { if (e.target === q('layDlg')) openLayerDlg(false); });   // tashqariga bosish — yopish
  on(q('btnLayAdd'), 'click', () => { const i = q('layNew'); if (addLayer(i.value)) { i.value = ''; i.focus(); } });
  on(q('layNew'), 'keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); q('btnLayAdd').click(); } });
  on(q('btnLayIso'), 'click', layIso);
  on(q('btnLayUniso'), 'click', layUniso);
  on(q('ltScaleIn'), 'change', (e) => {
    const v = sonQiymat(e.target.value);
    if (!(v > 0)) { e.target.value = fmtNum(state.ltscale, 3); return; }
    state.ltscale = Math.min(1000, v); render(); saveLS(); setInfo('LTSCALE: ' + fmtNum(state.ltscale, 3));
  });
  on(q('ltScaleIn'), 'keydown', (e) => e.stopPropagation());
  on(q('lwShowIn'), 'change', (e) => { state.lwShow = !!e.target.checked; syncLayerUI(); render(); saveLS(); });
  on(q('tgLw'), 'click', () => { state.lwShow = !state.lwShow; const c = q('lwShowIn'); if (c) c.checked = state.lwShow; syncLayerUI(); render(); saveLS(); setInfo(state.lwShow ? '<Qalinlik yoqildi>' : '<Qalinlik o‘chirildi>'); });
  on(q('btnMatch'), 'click', () => startMatchProp());
  // Qatlamlar jadvali — bosish (tugmalar) va ro'yxatlar
  on(q('layBody'), 'click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const tr = b.closest('tr[data-lay]'); if (!tr) return;
    const l = findLayer(state.layers, tr.getAttribute('data-lay')); if (!l) return;
    const act = b.getAttribute('data-act');
    if (act === 'cur') { setClay(l.nomi); renderLayerDlg(); return; }
    if (act === 'del') { delLayer(l.nomi); return; }
    if (act === 'frozen' && !l.frozen && l.nomi.toLowerCase() === state.clay.toLowerCase()) { setInfo('Joriy qatlam muzlatilmaydi', 'err'); return; }
    pushHistory();
    l[act] = act === 'on' || act === 'plot' ? !(l[act] !== false) : !l[act];
    layerChanged('');
  });
  on(q('layBody'), 'change', (e) => {
    const s = e.target.closest('select[data-act]'), i = e.target.closest('input[data-act]');
    const tr = e.target.closest('tr[data-lay]'); if (!tr || (!s && !i)) return;
    const l = findLayer(state.layers, tr.getAttribute('data-lay')); if (!l) return;
    if (i) { renameLay(l.nomi, i.value); return; }
    pushHistory();
    const act = s.getAttribute('data-act');
    if (act === 'color') l.color = Number(s.value);
    else if (act === 'lt') l.lt = s.value;
    else if (act === 'lw') l.lw = Number(s.value);
    layerChanged('');
  });
  on(q('layBody'), 'keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });
  // Yon paneldagi «Xususiyatlar»
  on(q('tgProps'), 'click', () => {
    const box = q('propBox'), btn = q('tgProps');
    const show = box.style.display === 'none';
    box.style.display = show ? '' : 'none';
    btn.classList.toggle('open', show);
    if (show) renderProps();
  });
  on(q('propBox'), 'change', (e) => {
    const s = e.target.closest('select[data-prop]'); if (!s || !state.sel.size) return;
    const k = s.getAttribute('data-prop'), v = s.value;
    if (k === 'lay') { if (v) moveSelToLayer(v); return; }
    setSelProp(k, v === '' ? null : (k === 'lt' ? v : Number(v)));
  });

  // Asboblar paneli
  root.querySelectorAll('.etool').forEach((b) => on(b, 'click', () => { if (b.dataset.dimk) state.opt.dimKind = b.dataset.dimk; setTool(b.getAttribute('data-tool')); }));
  // Matn muharriri: Enter — saqlash (+ keyingi qator), Esc — tugatish / bekor; chizma klaviaturasiga o'tmaydi
  on(textEd, 'keydown', (e) => {
    e.stopPropagation();
    const d = state.draft;
    if (e.key === 'Enter') { e.preventDefault(); textCommit(!(d && d.edit != null)); }
    else if (e.key === 'Escape') { e.preventDefault(); if (d && d.edit != null) { state.draft = null; closeTextEd(); render(); setInfo('*Bekor qilindi*'); } else textCommit(false); }
  });
  on(textEd, 'input', () => render());
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
    mergeLayers(it.layers); migrateEnts(state.ents, V.mainLayer);
    state.name = it.name || ''; q('nameInput').value = state.name;
    state.autoOff = it.autoOff == null ? AUTO_OFF_DEF : sanitizeAutoOff(it.autoOff);
    state.sel.clear(); state.hist.length = 0; state.redo.length = 0; state.cont = null;
  }
  // Ishchi holatdan faol gulga (saqlashdan / almashishdan oldin)
  function zakasSyncActive() {
    const it = state.zakas.items[state.zakas.active]; if (!it) return;
    it.name = state.name; it.ents = JSON.parse(JSON.stringify(state.ents)); it.layers = JSON.parse(JSON.stringify(state.layers)); it.autoOff = state.autoOff; it.t = Date.now();
  }
  function zakasSave() {
    if (!V.zakas || !state.zakas.items.length) return;
    zakasSyncActive();
    const all = zakasReadAll() || {};
    // Bo'sh zakas (hech narsa chizilmagan, nom yo'q) saqlanmaydi — kvotani (ZAKAS_MAX) to'ldirmasin
    const meaningful = state.zakas.items.some((it) => (it.ents && it.ents.length) || (it.name && String(it.name).trim()) || (it.layers && it.layers.length > defaultLayers(V.mainLayer).length));
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
  // Menyu lenta ichida emas, chizma ildizida turadi (lenta gorizontal suriladi — ichidagi menyu kesilib qolardi)
  root.appendChild(arcMenu);
  function showArcMenu(show) {
    arcMenu.classList.toggle('show', !!show);
    if (!show) return;
    const rb = q('arcBtn').getBoundingClientRect(), rr = root.getBoundingClientRect();
    const mw = arcMenu.offsetWidth || 240;
    let left = rb.left - rr.left;
    if (rr.left + left + mw > window.innerWidth - 8) left = Math.max(4, window.innerWidth - 8 - mw - rr.left);   // tor ekran: o'ng chetdan chiqmasin
    arcMenu.style.left = left + 'px'; arcMenu.style.top = (rb.bottom - rr.top + 4) + 'px';
  }
  on(q('arcMenuBtn'), 'click', (e) => { e.stopPropagation(); showArcMenu(!arcMenu.classList.contains('show')); });
  on(arcMenu, 'click', (e) => {
    const b = e.target.closest('button[data-arc]'); if (!b || !ARC_BY_KEY[b.dataset.arc]) return;
    state.arcMethod = b.dataset.arc; showArcMenu(false); renderArcMenu(); saveLS();
    setTool('arc');   // amaldagi yoy jarayoni bekor bo'lib, yangi usul bilan boshlanadi
  });
  on(document, 'mousedown', (e) => { if (arcMenu.classList.contains('show') && !q('arcWrap').contains(e.target) && !arcMenu.contains(e.target)) showArcMenu(false); });
  on(q('arcMenuBtn').closest('.chz-toolbar'), 'scroll', () => showArcMenu(false));

  /* ---------------- BUYRUQ QIDIRISH (AutoCAD buyruq satri, o'zbekcha) ----------------
     Asbob nomi yoki AutoCAD qisqartmasini yozing — ro'yxatdan tanlab Enter. Maydon ustida harf
     bosilsa o'zi ochiladi. */
  const cmdInput = q('cmd'), cmdList = q('cmdList');
  let cmdSel = 0;
  const cmdNorm = (s) => cmdNormPlain(s);
  const cmdNorm2 = (s) => cmdNorm(s).replace(/\s+/g, '');
  function cmdAll() {
    const base = CMDS.slice();
    for (const M of ARC_METHODS) base.push({ id: 'arc:' + M.key, nomi: 'Yoy — ' + M.nomi, al: [] });
    return base;
  }
  // Takliflar: nom / qisqartma bo'yicha (src/lib/cmdLine.js), ko'p ishlatilgani yuqorida
  function cmdMatches(qs) { return cmdNorm(qs) ? cmdFilter(cmdAll(), qs, 9, state.cmdUse) : []; }
  function renderCmdList() {
    const list = cmdMatches(cmdInput.value);
    if (!list.length) { cmdList.classList.remove('show'); cmdList.innerHTML = ''; return; }
    cmdSel = Math.max(0, Math.min(cmdSel, list.length - 1));
    // Yozilgan harflar qalin ajratiladi (AutoCAD AutoComplete)
    const qs = cmdNorm(cmdInput.value);
    const mark = (txt) => {
      const i = qs ? cmdNorm(txt).indexOf(qs) : -1;
      if (i < 0) return escHtml(txt);
      return escHtml(txt.slice(0, i)) + '<u>' + escHtml(txt.slice(i, i + qs.length)) + '</u>' + escHtml(txt.slice(i + qs.length));
    };
    cmdList.innerHTML = list.map((c, i) => '<div class="chz-cmditem' + (i === cmdSel ? ' on' : '') + '" data-cmd="' + c.id + '"><span>' + mark(c.nomi) + '</span><b>' + c.al.map(mark).join(', ') + '</b></div>').join('');
    cmdList.classList.add('show');
  }
  function cmdOpen(ch) { cmdInput.value = ch || ''; cmdSel = 0; inputPos = -1; tabBase = null; cmdInput.focus(); renderCmdList(); }
  function cmdClose() { cmdInput.value = ''; cmdSel = 0; inputPos = -1; tabBase = null; cmdList.classList.remove('show'); cmdList.innerHTML = ''; }
  // Oxirgi buyruqlar (AutoCAD «Recent Commands» — o'ng tugma menyusi)
  const cmdRecent = [];
  function pushRecent(id) {
    const i = cmdRecent.indexOf(id); if (i >= 0) cmdRecent.splice(i, 1);
    cmdRecent.unshift(id); if (cmdRecent.length > 8) cmdRecent.pop();
    state.lastCmdId = id;
  }
  function cmdById(id) { return cmdAll().find((c) => c.id === id) || null; }
  function cmdLabel(id) { const c = cmdById(id); return c ? c.nomi + (c.al && c.al.length ? ' (' + c.al[0] + ')' : '') : id; }
  function runCmd(id) {
    cmdClose();
    if (!id) return;
    const c = cmdById(id);
    if (c) { logLine('Buyruq: ' + cmdLabel(id), 'cmd'); pushRecent(id); state.cmdUse[id] = (state.cmdUse[id] || 0) + 1; saveLS(); }
    if (id.charAt(0) === '#') state.cmdFresh = false;   // asbob emas — keyingi harf yana buyruq bo'lsin
    if (id === '#layer') return openLayerDlg(true);
    if (id === '#laymcur') return state.sel.size ? setClay(layOf(selectedEnts()[0]).nomi) : startLayPick('cur');
    if (id === '#laycur') { if (!state.sel.size) { setInfo('Avval elementlarni tanlang', 'err'); return; } return moveSelToLayer(state.clay); }
    if (id === '#layoff') return startLayPick('off');
    if (id === '#layfrz') return startLayPick('frz');
    if (id === '#laylck') return startLayPick('lck');
    if (id === '#layulk') return startLayPick('ulk');
    if (id === '#layon') { pushHistory(); for (const l of state.layers) l.on = true; return layerChanged('Barcha qatlamlar yoqildi'); }
    if (id === '#laythw') { pushHistory(); for (const l of state.layers) l.frozen = false; return layerChanged('Barcha qatlamlar eritildi'); }
    if (id === '#layiso') return layIso();
    if (id === '#layuniso') return layUniso();
    if (id === '#matchprop') return startMatchProp();
    if (id === '#props') { const b = q('propBox'); if (b.style.display === 'none') q('tgProps').click(); else renderProps(); return; }
    if (id === '#ltscale') { openLayerDlg(true); const i = q('ltScaleIn'); if (i) { i.focus(); i.select(); } return; }
    if (id === '#lwdisplay') return q('tgLw').click();
    if (id === '#undo') return undo();
    if (id === '#redo') return redo();
    if (id === '#fit') return centerView();
    if (id === '#clear') return q('btnClear').click();
    if (id === '#start0') return start0();
    if (id.startsWith('arc:')) { const k = id.slice(4); if (ARC_BY_KEY[k]) { state.arcMethod = k; renderArcMenu(); saveLS(); } setTool('arc'); return; }
    if (id.startsWith('dim:')) { const k = id.slice(4); if (DIM_KINDS[k]) state.opt.dimKind = k; setTool('dim'); syncButtons(); return; }
    if (TOOLS.includes(id)) setTool(id);
  }
  /* ---- Buyruq satriga yozilganini bajarish (AutoCAD mantiqi) ----
     1) raqamli variant qiymati kutilayotgan bo'lsa — son; 2) bo'sh Enter — oxirgi buyruqni takrorlash;
     3) kalit so'z (Radius → R); 4) koordinata / masofa / qiymat; 5) buyruq nomi yoki qisqartmasi. */
  const inputHist = [];   // yozilganlar tarixi (strelka TEPA)
  let inputPos = -1;
  let pendingNum = null;  // {idx, label, unit} — kalit so'z bilan tanlangan raqamli variant qiymat kutmoqda
  function wantsPoint() {
    if (state.picking) return false;
    if (state.draft) return true;
    return !['select', 'erase', 'explode', 'join', 'pedit', 'trim', 'extend', 'offset', 'fillet', 'chamfer', 'lengthen', 'divide', 'measure', 'hatch', 'boundary'].includes(state.tool);
  }
  function applyOptKeyword(o) {
    const it = optRowItems[o.idx]; if (!it) return;
    if (it.kind === 'btn') { if (it.act) it.act(); renderOptRow(); saveLS(); render(); return; }
    pendingNum = { idx: o.idx, label: o.short, full: it.label, unit: it.unit || '' };
    setInfo(o.short + ' <' + fmtNum(it.val, 2) + (it.unit ? ' ' + it.unit : '') + '>:');   // AutoCAD: standart qiymat burchakli qavsda
  }
  // Kiritilgan nuqtani bosish kabi uzatish
  function feedPoint(p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    const s = worldToScreen(p.x, p.y);
    state.cursor = { x: p.x, y: p.y }; state.cursorS = { sx: s.x, sy: s.y }; state.cursorIn = true;
    state.lastPt = { x: p.x, y: p.y };   // AutoCAD LASTPOINT — «@» shu nuqtadan hisoblanadi
    state.snapOnce = null; state.cmdFresh = false;
    fromCmd = true;
    try { toolClick(s.x, s.y, state.cursor); } finally { fromCmd = false; }
    clearAcq(); render();
    cmdInput.focus();   // keyingi koordinatani ham yozish mumkin bo'lsin
    return true;
  }
  function cmdSubmit(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (s) logLine(s, 'cmd');   // AutoCAD: yozilgani tarixda aks etadi
    if (pendingNum) {   // raqamli variant qiymati (bo'sh Enter — standart qiymat qoladi, AutoCAD <…>)
      const it = optRowItems[pendingNum.idx], v = s ? (evalExpr(s) != null ? evalExpr(s) : cmdNum(s)) : null;
      const nm = pendingNum.label; pendingNum = null; cmdClose();
      if (!s) { setInfo(nm + ' = ' + fmtNum(it ? it.val : 0, 2) + (it && it.unit ? ' ' + it.unit : '') + ' (o‘zgarmadi). ' + toolHint(state.tool)); return; }
      if (v == null || !it || !it.set) { setInfo(nm + ': son kiritilmadi. ' + toolHint(state.tool), 'err'); return; }
      it.set(v); it.val = v; saveLS(); renderOptRow(); render();
      setInfo(nm + ' = ' + fmtNum(v, 2) + (it.unit ? ' ' + it.unit : '') + '. ' + toolHint(state.tool));
      return;
    }
    if (s) { if (inputHist[inputHist.length - 1] !== s) inputHist.push(s); if (inputHist.length > 60) inputHist.shift(); }
    inputPos = -1;
    if (!s) {   // bo'sh Enter: AutoCAD — oxirgi buyruqni takrorlaydi (buyruq bajarilayotgan bo'lsa — tasdiqlaydi)
      if (state.draft || state.picking || state.box) { pressEnter(); return; }
      if (state.lastCmdId) { runCmd(state.lastCmdId); return; }
      pressEnter(); return;
    }
    // 1b) shaffof buyruq (AutoCAD: 'ZOOM) — joriy buyruqni bekor qilmaydi
    let sx = s;
    if (sx[0] === "'") sx = sx.slice(1).trim();
    // Aniq buyruq (qisqartma yoki to'liq nom) — buyruq BAJARILAYOTGAN bo'lmasa kalit so'zdan ustun:
    // AutoCAD'da «F» fillet tugagach yana FILLET ni ishga tushiradi, buyruq ichida esa [Faska] kaliti bo'ladi
    const exact = cmdAll().find((c) => cmdNorm2(c.nomi) === cmdNorm2(sx) || (c.al || []).some((a) => cmdNorm2(a) === cmdNorm2(sx)));
    // «Buyruq bajarilmoqda»: boshlangan buyruq (qoralama, quti, tanlash, qiymat kutish) yoki endigina
    // ishga tushgan asbob (AutoCAD: XLINE → darhol [Gorizontal/Vertikal/\u2026] so'raydi).
    // Buyruq tugagach (nuqta qo'yilgach yoki Esc) — «Buyruq:» holati: harflar yana buyruqni ishga tushiradi
    const busy = !!(state.draft || state.box || state.picking || pendingNum || state.cmdFresh);
    // 2) kalit so'z (buyruq ichida — AutoCAD [Radius/Polyline/Kesish])
    const opts = optKeys();
    // Raqam / koordinata / «@» bilan boshlanadigan kiritish hech qachon kalit so'z emas (AutoCAD)
    const numLike = /^[-+.,0-9@]/.test(sx);
    if (opts.length && !numLike && (busy || !exact)) {
      const ki = matchKeyword(sx, opts.map((o) => ({ label: o.short, kw: o.kw, alt: o.alt })));
      if (ki === -2) { setInfo("Noaniq kalit so'z «" + s + "» — to'liqroq yozing", 'err'); return; }
      if (ki >= 0) { cmdClose(); applyOptKeyword(opts[ki]); return; }
    }
    // 2b) bir martalik magnit (AutoCAD: END, MID, CEN, PER…) — FAQAT to'liq nom bilan, aks holda
    // bir harfli buyruqlar (T — Matn, C — Aylana) magnit deb tushunilardi
    if ((wantsPoint() || state.draft) && !exact) {
      const sn = cmdNorm2(sx);
      const mi = SNAP_MODES.findIndex((m) => cmdNorm2(m.key) === sn || cmdNorm2(m.nomi) === sn
        || (sn === 'endp' && m.key === 'END') || (sn === 'perp' && m.key === 'PER') || (sn === 'near' && m.key === 'NEA'));
      if (mi >= 0) {
        state.snapOnce = SNAP_MODES[mi].key;
        cmdClose(); setInfo('<' + SNAP_MODES[mi].key + ' — ' + SNAP_MODES[mi].nomi + '> magniti: nuqtani bosing');
        render(); return;
      }
    }
    if (exact && !busy) { runCmd(exact.id); return; }
    // 3) dinamik quti ochiq bo'lsa: «50» yoki «50<45» — uzunlik va burchak.
    // Vergul — koordinata ajratkichi, shuning uchun «50,50» bu yerga TUSHMAYDI (u nuqta)
    if (state.box && /^[-+.0-9<]+$/.test(s)) {
      const lt = s.indexOf('<');
      if (lt > 0 && state.box.f2) { in1.value = s.slice(0, lt); in2.value = s.slice(lt + 1); cmdClose(); commitBox(); return; }
      if (lt < 0) { const b = state.box.f1 ? in1 : in2; b.value = s; cmdClose(); commitBox(); return; }
    }
    // 4) koordinata / masofa («@» — tayanch nuqta bo'lmasa oxirgi qo'yilgan nuqtadan, AutoCAD LASTPOINT)
    const anch = anchorPoint();
    const from = anch || state.lastPt || null;   // «@» uchun oxirgi nuqta ham yaraydi (AutoCAD LASTPOINT)
    const ex = evalExpr(sx);   // arifmetik ifoda: «50*2» → 100
    const pr = parseInput(ex != null ? String(ex) : sx, { unit: U(), from });
    if (pr.kind === 'point' && (wantsPoint() || state.draft)) { cmdClose(); feedPoint(pr); return; }
    // To'g'ridan-to'g'ri masofa — FAQAT joriy buyruqning tayanch nuqtasidan (eski nuqtadan emas)
    if (pr.kind === 'dist' && wantsPoint()) {
      const p = pointFromDist(anch, state.cursor, pr.mm);
      if (!p) { setInfo("Masofa uchun avval shu buyruqda nuqta belgilang, so'ng kursorni yo'naltiring", 'err'); return; }
      cmdClose(); feedPoint(p); return;
    }
    if (pr.kind === 'number' && wantsPoint() && anch) {
      const p = pointFromDist(anch, state.cursor, pr.mm);
      if (p) { cmdClose(); feedPoint(p); return; }
    }
    // 5) buyruq. Buyruq bajarilayotganda taxminiy moslik bilan boshqa buyruqqa sakrab o'tilmaydi (AutoCAD):
    // faqat aniq buyruq yoki kalit so'z qabul qilinadi, aks holda so'rov qaytariladi
    const listNow = cmdFilter(cmdAll(), sx, 9, state.cmdUse);
    const fromList = cmdList.classList.contains('show') && listNow.length;   // ro'yxatdan ko'rib tanlandi
    if (busy && !exact && !fromList) {
      cmdClose();
      setInfo("Nuqta yoki kalit so'z kerak. Namunalar: 120,80 · @30,20 · @50<45 · 50" + (opts.length ? ' · ' + opts.map((o) => o.kw).join('/') : ''), 'err');
      return;
    }
    const list = cmdFilter(cmdAll(), sx, 9, state.cmdUse);
    if (list.length) { runCmd(list[cmdSel] && cmdList.classList.contains('show') ? list[Math.min(cmdSel, list.length - 1)].id : list[0].id); return; }
    cmdClose();
    setInfo("«" + s + "» — bunday buyruq yo'q" + (pr.kind === 'invalid' ? ' (' + pr.reason + ')' : ''), 'err');
  }
  let tabBase = null, tabIdx = -1;
  on(cmdInput, 'input', () => { cmdSel = 0; tabBase = null; tabIdx = -1; inputPos = -1; renderCmdList(); });
  on(cmdInput, 'focus', renderCmdList);
  on(cmdInput, 'keydown', (e) => {
    const list = cmdMatches(cmdInput.value);
    const listOpen = cmdList.classList.contains('show') && list.length > 0;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      // Tarix rejimi boshlangan bo'lsa (inputPos >= 0) strelkalar tarix bo'ylab yuraveradi
      if (inputPos < 0 && listOpen && cmdInput.value.trim()) { cmdSel = e.key === 'ArrowDown' ? Math.min(cmdSel + 1, list.length - 1) : Math.max(cmdSel - 1, 0); renderCmdList(); return; }
      if (!inputHist.length) return;   // avval yozilganlarni chaqirish (AutoCAD)
      if (inputPos < 0) inputPos = inputHist.length;
      inputPos = e.key === 'ArrowUp' ? Math.max(0, inputPos - 1) : Math.min(inputHist.length, inputPos + 1);
      cmdInput.value = inputPos >= inputHist.length ? '' : inputHist[inputPos];
      cmdSel = 0; cmdList.classList.remove('show');
      return;
    }
    // AutoCAD: Probel ham Enter kabi bajaradi (bo'sh bo'lsa — oxirgi buyruqni takrorlaydi)
    if (e.key === 'F2') { e.preventDefault(); e.stopPropagation(); toggleTextWin(); return; }
    // Probel — Enter kabi bajaradi (AutoCAD); Shift+Probel — oddiy bo'shliq (ko'p so'zli qidiruv uchun)
    if (e.key === 'Enter' || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); e.stopPropagation(); const v = cmdInput.value; cmdInput.value = ''; cmdSubmit(v); return; }
    const K = e.key.toLowerCase();   // chizma qisqartmalari buyruq satri fokusda bo'lganda ham ishlaydi
    if ((e.ctrlKey || e.metaKey) && !cmdInput.value && ['z', 'y', 'a', 'e'].includes(K)) {
      e.preventDefault(); e.stopPropagation();
      if (K === 'z' && !e.shiftKey) undo();
      else if (K === 'y' || (K === 'z' && e.shiftKey)) redo();
      else if (K === 'e') centerView();
      else { for (const x of state.ents) state.sel.add(x.id); render(); renderTable(); renderOptRow(); setInfo(state.sel.size + ' ta obyekt tanlandi'); }
      return;
    }
    if (e.key === 'Tab') {   // AutoComplete: takliflar orasida aylanish (Shift+Tab — teskari), Enter bajaradi
      e.preventDefault(); e.stopPropagation();
      if (tabBase == null) { tabBase = cmdInput.value; tabIdx = -1; }
      const l2 = cmdMatches(tabBase);
      if (!l2.length) return;
      tabIdx = e.shiftKey ? (tabIdx - 1 + l2.length) % l2.length : (tabIdx + 1) % l2.length;
      cmdInput.value = l2[tabIdx].nomi; cmdSel = 0; renderCmdList();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !cmdInput.value && state.sel.size && !state.draft) { e.preventDefault(); eraseSelected(); return; }
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (cmdList.classList.contains('show') && cmdInput.value) { cmdList.classList.remove('show'); return; }   // 1) ro'yxat yopiladi
      if (pendingNum) { pendingNum = null; cmdClose(); setInfo(toolHint(state.tool)); return; }
      if (cmdInput.value) { cmdClose(); cmdInput.focus(); return; }   // 2) matn tozalanadi
      if (q('textWin').classList.contains('show')) { toggleTextWin(false); return; }
      pendingNum = null; cmdInput.blur(); cancelCurrent(); setInfo('*Bekor qilindi*');
    }
  });
  on(q('info'), 'click', (e) => {   // so'rovdagi kalit so'zni bosish
    const b = e.target.closest('[data-k]'); if (!b) return;
    const o = optKeys()[+b.dataset.k]; if (o) applyOptKeyword(o);
  });
  on(q('btnTextWin'), 'click', () => toggleTextWin());
  on(q('twClose'), 'click', () => toggleTextWin(false));
  on(q('textWin'), 'mousedown', (e) => e.stopPropagation());
  // Buyruq satrida o'ng tugma — oxirgi buyruqlar (AutoCAD)
  on(q('cmdLine'), 'contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    const it = [];
    if (cmdRecent.length) { it.push('-'); for (const id of cmdRecent.slice(0, 6)) it.push({ label: cmdLabel(id), fn: () => runCmd(id), dis: false }); }
    else it.push({ label: "Oxirgi buyruqlar yo'q", fn: () => {}, dis: true });
    it.unshift({ label: 'Buyruqlar oynasi (F2)', fn: () => toggleTextWin(true), dis: false });
    openCtxMenu(it, e.clientX, e.clientY);
  });
  on(cmdList, 'mousedown', (e) => { e.preventDefault(); const it = e.target.closest('[data-cmd]'); if (it) runCmd(it.dataset.cmd); });
  // Chizmaga bosilganda yozilgan matn SAQLANADI (AutoCAD), faqat takliflar ro'yxati yopiladi
  on(document, 'mousedown', (e) => { if (cmdList.classList.contains('show') && !q('cmdWrap').contains(e.target)) cmdList.classList.remove('show'); });

  on(q('optRow'), 'click', (e) => {
    const b = e.target.closest('button[data-opt]'); if (!b) return;
    const it = optRowItems[+b.dataset.opt];
    if (it && it.act) { it.act(); renderOptRow(); saveLS(); render(); }
  });
  on(q('optRow'), 'change', (e) => {
    const i = e.target.closest('input[data-opt]'); if (!i) return;
    const it = optRowItems[+i.dataset.opt];
    if (it && it.set) { const v = sonQiymat(i.value); it.set(v); it.val = v; i.value = fmtNum(v, 2); syncFilletBox(); saveLS(); render(); syncOptRow(); }   // qator qayta qurilmaydi — fokus/tugma saqlanadi
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
  applyBoard();
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
