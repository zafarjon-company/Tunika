// ============================================================
//  AQLLI SARTIROVKA (2D nesting) — Kazirok bo'laklari uchun
//  ------------------------------------------------------------
//  Deterministik (AI YO'Q). Har List turi alohida: o'sha listdagi barcha
//  Patalok/Paloska bo'laklari (dona soni bilan) 1245 mm enli, foydalanuvchi
//  tanlagan uzunlikdagi (4 yoki 6 m) listga zich joylanadi. Bo'laklar
//  bir-biriga YOPISHIB turadi (oraliq 0); sig'masa keyingi listga o'tadi.
//
//  Algoritm: FFDH (First-Fit Decreasing Height) javon (shelf) joylash —
//  bo'laklar balandligi bo'yicha kamayuvchi tartibda; har bo'lak sig'adigan
//  birinchi javonga (eni bo'ylab), sig'masa yangi javon (uzunlik bo'ylab).
//  Strip (tor-baland) bo'laklar uchun deyarli optimal va barqaror.
// ============================================================

export const SHEET_W_MM = 1245;        // list eni (mm) — o'zgarmas
export const SHEET_LENGTHS = { '4m': 4000, '6m': 6000 };

// Payloaddan bo'laklarni (List × kind) bo'yicha ajratamiz — Patalok va Paloska
// ALOHIDA listlarga ketadi (har fayl toza patalok yoki toza paloska bo'lsin).
// Qaytaradi: [{ listId, kind, pieces:[{ w, h, segs, label }] }]  (har dona alohida).
function piecesByKindList(data) {
  const byKey = new Map(); // "listId|kind" -> { listId, kind, pieces }
  const groups = (data && data.groups) || [];
  for (const g of groups) {
    for (const kind of ['pat', 'pal']) {
      const it = g[kind];
      if (!it || !(it.count > 0) || !Array.isArray(it.segs) || !it.segs.length) continue;
      const id = it.listId || '';
      const key = id + '|' + kind;
      if (!byKey.has(key)) byKey.set(key, { listId: id, kind, pieces: [] });
      const arr = byKey.get(key).pieces;
      const label = (kind === 'pat' ? 'Patalok ' : 'Paloska ') + it.eni;
      for (let i = 0; i < it.count; i++) {
        arr.push({ w: it.wMm, h: it.hMm, segs: it.segs, label, kind });
      }
    }
  }
  return [...byKey.values()];
}

// Bitta List bo'laklarini listlarга (sheets) FFDH bilan joylaymiz.
function packList(pieces, sheetW, sheetL) {
  // Balandlik (keyin eni) bo'yicha kamayuvchi — barqaror tartib (label bilan tie-break)
  const sorted = pieces.slice().sort((a, b) =>
    (b.h - a.h) || (b.w - a.w) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  const sheets = [];
  let cur = null;
  const newSheet = () => ({ pieces: [], shelves: [], usedL: 0 });
  const EPS = 0.01;

  for (const p of sorted) {
    if (!cur) cur = newSheet();
    let placed = false;
    // 1) mavjud javonlardan biriga sig'adimi (eni bo'ylab)?
    for (const sh of cur.shelves) {
      if (sh.usedW + p.w <= sheetW + EPS && p.h <= sh.h + EPS) {
        cur.pieces.push({ segs: p.segs, x: sh.usedW, y: sh.y, w: p.w, h: p.h, label: p.label, kind: p.kind });
        sh.usedW += p.w;
        placed = true;
        break;
      }
    }
    if (placed) continue;
    // 2) yangi javon (uzunlik bo'ylab). Sig'masa — keyingi list.
    let y = cur.usedL;
    if (y + p.h > sheetL + EPS) {
      if (cur.pieces.length) sheets.push(cur);
      cur = newSheet();
      y = 0;
    }
    const sh = { y, h: p.h, usedW: p.w };
    cur.shelves.push(sh);
    cur.usedL = y + p.h;
    cur.pieces.push({ segs: p.segs, x: 0, y, w: p.w, h: p.h, label: p.label, kind: p.kind });
  }
  if (cur && cur.pieces.length) sheets.push(cur);

  // Har list uchun foydalanish ko'rsatkichi
  return sheets.map((s, i) => {
    const usedArea = s.pieces.reduce((a, pc) => a + pc.w * pc.h, 0);
    const sheetArea = sheetW * sheetL;
    return {
      index: i + 1,
      w: sheetW,
      l: sheetL,
      usedL: +s.usedL.toFixed(1),
      count: s.pieces.length,
      fill: sheetArea > 0 ? Math.min(1, usedArea / sheetArea) : 0,
      pieces: s.pieces,
    };
  });
}

// Asosiy: kazirok payloadini (List × kind) bo'yicha listlarga sartirovka qiladi.
//   opts.sheetW (default 1245), opts.sheetL (mm, 4000/6000 ...).
// Qaytaradi: [{ listId, kind, totalPieces, sheets:[...] }]  (har List+kind bo'yicha).
export function nestKazirok(data, opts = {}) {
  const sheetW = opts.sheetW || SHEET_W_MM;
  const sheetL = opts.sheetL || SHEET_LENGTHS['6m'];
  const out = [];
  for (const grp of piecesByKindList(data)) {
    if (!grp.pieces.length) continue;
    const sheets = packList(grp.pieces, sheetW, sheetL);
    out.push({ listId: grp.listId, kind: grp.kind, totalPieces: grp.pieces.length, sheets });
  }
  return out;
}
