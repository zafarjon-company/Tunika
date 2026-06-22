// ============================================================
//  DXF EKSPORT — sartirovka qilingan listni DXF (LINE) faylga yozish
//  ------------------------------------------------------------
//  Har List uchun alohida DXF. Bo'lak konturlari joylangan o'rinlariga
//  ko'chiriladi; USTMA-UST tushgan kesim chiziqlari BITTA qilib birlashtiriladi
//  (dedupe) — lazer bir chiziqni ikki marta kesmaydi. Y o'qi yuqoriga (DXF
//  standarti), shakl ekrandagidek (peshona tepada). Birlik: mm ($INSUNITS=4).
//  Format: oddiy R12 DXF (HEADER + ENTITIES, faqat LINE) — universal ochiladi.
// ============================================================

function num(v) { return (Math.round(v * 1000) / 1000).toString(); }

// Segmentni kanonik kalitga aylantirish (ikki uchini tartiblab, 0.1 mm yaxlitlab)
function segKey(x1, y1, x2, y2) {
  const r = (v) => Math.round(v * 10) / 10;
  let a = [r(x1), r(y1)], b = [r(x2), r(y2)];
  if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) { const t = a; a = b; b = t; }
  return a[0] + ',' + a[1] + ',' + b[0] + ',' + b[1];
}

function lineEntity(layer, x1, y1, x2, y2) {
  return '0\nLINE\n8\n' + layer + '\n10\n' + num(x1) + '\n20\n' + num(y1) + '\n30\n0\n'
    + '11\n' + num(x2) + '\n21\n' + num(y2) + '\n31\n0\n';
}

// BITTA sheet (list) -> DXF matni. Konturlar joyiga ko'chirilib, ustma-ust
// chiziqlar birlashtiriladi (dedupe). FAQAT kesiladigan konturlar ("KESIM"
// qatlami) — list (1245×L) ramkasi CHIZILMAYDI (kerak emas). Y yuqoriga.
//   sheet = { w, l, pieces:[{ segs, x, y, w, h }] }
export function buildSheetDxf(sheet) {
  const seen = new Set();
  const cutLines = [];   // KESIM qatlami (deduped)
  const L = sheet.l;
  const fy = (y) => L - y;   // Y yuqoriga

  for (const pc of sheet.pieces) {
    for (const s of pc.segs) {
      const X1 = pc.x + s[0], Y1 = fy(pc.y + s[1]);
      const X2 = pc.x + s[2], Y2 = fy(pc.y + s[3]);
      if (Math.abs(X1 - X2) < 0.01 && Math.abs(Y1 - Y2) < 0.01) continue; // nuqta-segment
      const key = segKey(X1, Y1, X2, Y2);
      if (seen.has(key)) continue;     // USTMA-UST -> bitta chiziq
      seen.add(key);
      cutLines.push(lineEntity('KESIM', X1, Y1, X2, Y2));
    }
  }

  const header = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n';
  const entities = '0\nSECTION\n2\nENTITIES\n' + cutLines.join('') + '0\nENDSEC\n';
  return header + entities + '0\nEOF\n';
}

// Fayl nomi uchun xavfsiz nom (lotin/raqam/-_; bo'shliqlar -> _)
export function safeFileName(s) {
  return String(s || 'list').trim().replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'list';
}

// Nestlarni DXF fayllarga aylantiradi — HAR SHEET (list) ALOHIDA FAYL.
//   nests = [{ listId, kind, sheets:[...] }];  resolveName(listId) -> List nomi
//   lengthKey = '4m'|'6m';  customerName -> mijoz (fayl oxirida)
// Nom: {patalok|paloska}_{List}_{6m}_{Ism_Familiya}_{N}.dxf  (N — sheet tartibi)
// Qaytaradi: [{ name, text, listId, kind, sheetIndex, pieces }]
export function nestsToDxfFiles(nests, resolveName, lengthKey, customerName) {
  const cust = customerName ? safeFileName(customerName) : '';
  const files = [];
  for (const n of nests) {
    const listNm = safeFileName(resolveName ? resolveName(n.listId) : n.listId);
    const kindLabel = n.kind === 'pat' ? 'patalok' : 'paloska';
    (n.sheets || []).forEach((sh, i) => {
      const base = [kindLabel, listNm, lengthKey, cust, String(i + 1)].filter(Boolean).join('_');
      files.push({
        listId: n.listId, kind: n.kind, sheetIndex: i + 1,
        name: base + '.dxf',
        text: buildSheetDxf(sh),
        pieces: sh.pieces.length,
      });
    });
  }
  return files;
}

// Brauzerда faylni yuklab olish (Telegram sozlanmagan bo'lsa — zaxira yo'l)
export function downloadDxf(name, text) {
  const blob = new Blob([text], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
