// ============================================================
//  XLSX EKSPORT — tashqi kutubxonasiz minimal .xlsx (OOXML) yozuvchi
// ------------------------------------------------------------
//  Nega o'zimiz yozamiz: xlsx/exceljs paketlari bundle'ga ~1 MB qo'shadi,
//  bizga esa faqat BITTA varaq, oddiy uslub va raqam formatlari kerak.
//
//  .xlsx — bu ZIP arxiv ichidagi bir nechta XML fayl. ZIP ni SIQISHSIZ
//  ("store", usul 0) yozamiz — bu ham to'liq yaroqli arxiv, Excel ham,
//  LibreOffice ham, Google Sheets ham muammosiz ochadi. Siqish (deflate)
//  yozish uchun esa butun boshli algoritm kerak bo'lardi.
//
//  Arxiv tarkibi:
//    [Content_Types].xml          — qaysi fayl qanday turda
//    _rels/.rels                  — ildiz bog'lanish (→ xl/workbook.xml)
//    xl/workbook.xml              — varaqlar ro'yxati
//    xl/_rels/workbook.xml.rels   — workbook bog'lanishlari (varaq, uslublar)
//    xl/styles.xml                — shrift/fon/raqam formatlari
//    xl/worksheets/sheet1.xml     — kataklar
//
//  ISHLATISH:
//    downloadXLSX('ombor.xlsx', {
//      nom: 'Ombor',
//      ustunlar: [{ nom: 'Rang',  kenglik: 18, tur: 'matn' },
//                 { nom: 'Summa', kenglik: 16, tur: 'pul'  }],
//      qatorlar: [{ katak: ['Mokriy', 1250000], fon: 'sariq' }],
//      jami:     { katak: ['JAMI', 1250000] },   // ixtiyoriy
//    });
//
//  DIQQAT: bu yerda hech qanday narx/kurs/koeffitsient YO'Q — faylga nima
//  yozilishi butunlay chaqiruvchi (props orqali kelgan) ma'lumotdan olinadi.
// ============================================================

// ----- Ustun turlari va ularning Excel raqam formatlari -----
//  'matn'   — umumiy (format yo'q)
//  'son'    — 1 234
//  'pul'    — 1 234 so'm
//  'dollar' — 1 234 $
const TURLAR = ['matn', 'son', 'pul', 'dollar'];
const NUM_FMT_ID = { matn: 0, son: 164, pul: 165, dollar: 166 };
const NUM_FMT_KOD = {
  son: '#,##0',
  pul: '#,##0" so\'m"',
  dollar: '#,##0" $"',
};

// ----- Qator fon ranglari (ARGB: oldida FF — to'liq shaffofmas) -----
const FONLAR = ['', 'sariq', 'toq', 'qizil'];
const FON_ARGB = { sariq: 'FFFEF3C7', toq: 'FFFFEDD5', qizil: 'FFFEE2E2' };
const SARLAVHA_ARGB = 'FFE2E8F0'; // slate-200 — mavjud dizayn tizimidagi chegara rangi
const CHIZIQ_ARGB = 'FFCBD5E1';   // slate-300 — "jami" qatori tepasidagi chiziq

// Uslub (cellXfs) indekslari — stylesXml() dagi tartib bilan AYNAN bir xil
// bo'lishi shart, aks holda Excel boshqa formatni qo'llaydi.
const uslubTana = (turIdx, fonIdx) => fonIdx * TURLAR.length + turIdx; // 0..15
const USLUB_SARLAVHA = FONLAR.length * TURLAR.length;                  // 16
const uslubJami = (turIdx) => USLUB_SARLAVHA + 1 + turIdx;             // 17..20

const turIndeks = (tur) => {
  const i = TURLAR.indexOf(tur);
  return i < 0 ? 0 : i;
};
const fonIndeks = (fon) => {
  const i = FONLAR.indexOf(fon || '');
  return i < 0 ? 0 : i;
};
// Fon indeksidan fills[] indeksi: 0 = fon yo'q, 1 = gray125 (Excel talabi),
// 2 = sarlavha, keyin sariq/toq/qizil.
const fonToFill = (fonIdx) => (fonIdx === 0 ? 0 : fonIdx + 2);

// ============================================================
//  XML YORDAMCHILARI
// ============================================================

// XML 1.0 ruxsat bermaydigan belgilar. Ikki guruh:
//   1) boshqaruv belgilari (\t \n \r dan tashqari);
//   2) U+FFFE va U+FFFF — "nobelgi"lar (masalan noto'g'ri dekodlangan BOM yoki
//      buzuq nusxa-ko'chirishdan Firestore ga tushib qolgan matnlarda uchraydi).
// Bittasi ham fayl ichiga tushsa XML butunlay yaroqsiz bo'ladi va Excel bitta
// katakni emas, BUTUN kitobni "buzilgan" deb ochmaydi — shuning uchun olib tashlaymiz.
// Yolg'iz surrogat (\uD800-\uDFFF) uchun alohida chora kerak emas: uni TextEncoder
// yozishda U+FFFD ga aylantiradi, bu esa XML uchun yaroqli belgi.
const XATO_BELGI = /[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g;

// & < > " ' ekranlash. Kirill/o'zbek harflari tegilmaydi — UTF-8 da yoziladi.
export function escXml(xom) {
  return String(xom == null ? '' : xom)
    .replace(XATO_BELGI, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Ustun raqamidan (0-dan) Excel harfi: 0→A, 25→Z, 26→AA, 701→ZZ, 702→AAA
export function ustunHarfi(indeks) {
  let s = '';
  let n = Math.max(0, Math.floor(indeks));
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// Katak manzili: (0,0) → "A1"
const katakManzil = (ustun, qator) => `${ustunHarfi(ustun)}${qator}`;

// Sonni XML ga yozish uchun satr. Eksponentli yozuv (1e+21, 1e-7) Excelda
// o'qilmaydi — uni oddiy o'nlik ko'rinishga o'tkazamiz. Yaxlitlash QILINMAYDI:
// son qanday bo'lsa shundayligicha yoziladi, ko'rinishni numFmt hal qiladi.
//  DIQQAT: 1e21 dan katta BUTUN sonlarda toFixed() ham eksponent qaytaradi,
//  shuning uchun u yerda BigInt ishlatiladi.
function xmlSon(n) {
  if (!Number.isFinite(n)) return null;
  const s = String(n);
  if (!/[eE]/.test(s)) return s;
  if (Number.isInteger(n)) {
    try { return BigInt(n).toString(); } catch (e) { return s; }
  }
  // Kichik kasrlar (1e-7) — 20 xona yetarli, ortiqcha nollar olib tashlanadi
  return n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
}

// ============================================================
//  CRC32 (ZIP uchun) — jadval bir marta hisoblanadi
// ============================================================
let CRC_JADVAL = null;
function crcJadvalTuz() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
}
function crc32(baytlar) {
  if (!CRC_JADVAL) CRC_JADVAL = crcJadvalTuz();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < baytlar.length; i += 1) {
    c = CRC_JADVAL[(c ^ baytlar[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================
//  ZIP (store, siqishsiz)
// ============================================================

// Sana/vaqtni DOS formatiga: 1980-yildan kichik bo'lsa ZIP qabul qilmaydi.
function dosSanaVaqt(d = new Date()) {
  const yil = Math.max(1980, d.getFullYear());
  const vaqt = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const sana = ((yil - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { vaqt: vaqt & 0xFFFF, sana: sana & 0xFFFF };
}

// fayllar = [{ nom, matn }] → Uint8Array (to'liq ZIP arxiv).
// Fayl nomlari ASCII (arxiv ichidagi yo'llar), mazmun UTF-8.
function zipYoz(fayllar) {
  const kodlovchi = new TextEncoder();
  const { vaqt, sana } = dosSanaVaqt();

  const yozuvlar = fayllar.map((f) => {
    const nomB = kodlovchi.encode(f.nom);
    const data = kodlovchi.encode(f.matn);
    return { nomB, data, crc: crc32(data), ofset: 0 };
  });

  // Har bir yozuvning arxiv boshidan o'rnini oldindan hisoblaymiz
  let ofset = 0;
  for (const y of yozuvlar) {
    y.ofset = ofset;
    ofset += 30 + y.nomB.length + y.data.length; // local header + nom + ma'lumot
  }
  const cdBoshi = ofset;
  let cdHajm = 0;
  for (const y of yozuvlar) cdHajm += 46 + y.nomB.length;

  const out = new Uint8Array(cdBoshi + cdHajm + 22); // +22 = end of central directory
  const dv = new DataView(out.buffer);
  let p = 0;
  const u32 = (v) => { dv.setUint32(p, v >>> 0, true); p += 4; };
  const u16 = (v) => { dv.setUint16(p, v & 0xFFFF, true); p += 2; };
  const baytlar = (b) => { out.set(b, p); p += b.length; };

  // 1) Local file header + ma'lumot (usul 0 = store, shuning uchun siqilgan
  //    va asl hajm bir xil)
  for (const y of yozuvlar) {
    u32(0x04034B50); u16(20); u16(0x0800); u16(0);
    u16(vaqt); u16(sana);
    u32(y.crc); u32(y.data.length); u32(y.data.length);
    u16(y.nomB.length); u16(0);
    baytlar(y.nomB); baytlar(y.data);
  }

  // 2) Central directory
  for (const y of yozuvlar) {
    u32(0x02014B50); u16(20); u16(20); u16(0x0800); u16(0);
    u16(vaqt); u16(sana);
    u32(y.crc); u32(y.data.length); u32(y.data.length);
    u16(y.nomB.length); u16(0); u16(0); u16(0); u16(0);
    u32(0); u32(y.ofset);
    baytlar(y.nomB);
  }

  // 3) End of central directory
  u32(0x06054B50); u16(0); u16(0);
  u16(yozuvlar.length); u16(yozuvlar.length);
  u32(cdHajm); u32(cdBoshi); u16(0);

  return out;
}

// ============================================================
//  OOXML QISMLARI
// ============================================================
const XML_BOSH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_DOC_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const contentTypesXml = () => `${XML_BOSH}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
  + '</Types>';

const rootRelsXml = () => `${XML_BOSH}<Relationships xmlns="${NS_PKG_REL}">`
  + `<Relationship Id="rId1" Type="${NS_DOC_REL}/officeDocument" Target="xl/workbook.xml"/>`
  + '</Relationships>';

const workbookRelsXml = () => `${XML_BOSH}<Relationships xmlns="${NS_PKG_REL}">`
  + `<Relationship Id="rId1" Type="${NS_DOC_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
  + `<Relationship Id="rId2" Type="${NS_DOC_REL}/styles" Target="styles.xml"/>`
  + '</Relationships>';

// Varaq nomida Excel taqiqlagan belgilar bor va uzunligi 31 dan oshmasligi kerak
function varaqNomiTozala(nom) {
  const s = String(nom || 'Varaq')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (s || 'Varaq').slice(0, 31);
}

const workbookXml = (nom) => `${XML_BOSH}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_DOC_REL}">`
  + `<sheets><sheet name="${escXml(varaqNomiTozala(nom))}" sheetId="1" r:id="rId1"/></sheets>`
  + '</workbook>';

// ----- styles.xml -----
//  cellXfs tartibi (uslub indekslari yuqoridagi uslubTana/uslubJami bilan mos):
//    0..15  — tana kataklari: fon (yo'q/sariq/toq/qizil) × tur (matn/son/pul/dollar)
//    16     — sarlavha (qalin + kulrang fon, markazda)
//    17..20 — "jami" qatori (qalin + tepasida chiziq) × tur
function stylesXml() {
  const numFmts = ['son', 'pul', 'dollar']
    .map((t) => `<numFmt numFmtId="${NUM_FMT_ID[t]}" formatCode="${escXml(NUM_FMT_KOD[t])}"/>`)
    .join('');

  const shrift = '<sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/>';
  const fonts = `<fonts count="2"><font>${shrift}</font><font><b/>${shrift}</font></fonts>`;

  const solid = (argb) => `<fill><patternFill patternType="solid"><fgColor rgb="${argb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = '<fills count="6">'
    + '<fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>' // Excel shu ikkitasini talab qiladi
    + solid(SARLAVHA_ARGB) + solid(FON_ARGB.sariq) + solid(FON_ARGB.toq) + solid(FON_ARGB.qizil)
    + '</fills>';

  const borders = '<borders count="2">'
    + '<border><left/><right/><top/><bottom/><diagonal/></border>'
    + `<border><left/><right/><top style="thin"><color rgb="${CHIZIQ_ARGB}"/></top><bottom/><diagonal/></border>`
    + '</borders>';

  const xfs = [];
  for (let f = 0; f < FONLAR.length; f += 1) {
    for (let t = 0; t < TURLAR.length; t += 1) {
      const nf = NUM_FMT_ID[TURLAR[t]];
      xfs.push(`<xf numFmtId="${nf}" fontId="0" fillId="${fonToFill(f)}" borderId="0" xfId="0"`
        + `${nf ? ' applyNumberFormat="1"' : ''}${f ? ' applyFill="1"' : ''}/>`);
    }
  }
  xfs.push('<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"'
    + ' applyFont="1" applyFill="1" applyAlignment="1">'
    + '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>');
  for (let t = 0; t < TURLAR.length; t += 1) {
    const nf = NUM_FMT_ID[TURLAR[t]];
    xfs.push(`<xf numFmtId="${nf}" fontId="1" fillId="0" borderId="1" xfId="0"`
      + ` applyFont="1" applyBorder="1"${nf ? ' applyNumberFormat="1"' : ''}/>`);
  }

  return `${XML_BOSH}<styleSheet xmlns="${NS_MAIN}">`
    + `<numFmts count="3">${numFmts}</numFmts>`
    + fonts + fills + borders
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
}

// ----- Bitta katak -----
//  number  → raqam katak (t atributi yo'q, <v>)
//  string  → inline string (umumiy jadval (sharedStrings) kerak emas)
//  boolean → mantiqiy katak
//  null/undefined/'' → bo'sh katak (lekin uslub saqlanadi — fon ko'rinsin)
function katakXml(qiymat, manzil, uslub) {
  const bosh = `<c r="${manzil}" s="${uslub}"`;
  if (qiymat === null || qiymat === undefined || qiymat === '') return `${bosh}/>`;
  if (typeof qiymat === 'number') {
    const s = xmlSon(qiymat);
    return s === null ? `${bosh}/>` : `${bosh}><v>${s}</v></c>`;
  }
  if (typeof qiymat === 'boolean') return `${bosh} t="b"><v>${qiymat ? 1 : 0}</v></c>`;
  return `${bosh} t="inlineStr"><is><t xml:space="preserve">${escXml(qiymat)}</t></is></c>`;
}

// ----- sheet1.xml -----
function sheetXml(varaq) {
  const ustunlar = Array.isArray(varaq.ustunlar) ? varaq.ustunlar : [];
  const qatorlar = Array.isArray(varaq.qatorlar) ? varaq.qatorlar : [];
  const jami = varaq.jami && Array.isArray(varaq.jami.katak) ? varaq.jami : null;

  // Ustun soni — sarlavha va eng uzun qator bo'yicha (kimdir ortiqcha katak bersa ham yo'qolmaydi)
  let nUstun = ustunlar.length;
  for (const q of qatorlar) nUstun = Math.max(nUstun, (q && q.katak ? q.katak.length : 0));
  if (jami) nUstun = Math.max(nUstun, jami.katak.length);
  nUstun = Math.max(1, nUstun);

  const turlar = [];
  for (let i = 0; i < nUstun; i += 1) turlar.push(turIndeks(ustunlar[i] && ustunlar[i].tur));

  // Ustun kengliklari
  const kenglikDefault = (turIdx) => [22, 12, 16, 12][turIdx] || 14;
  const cols = ustunlar.length
    ? `<cols>${turlar.map((t, i) => {
      const w = Number(ustunlar[i] && ustunlar[i].kenglik) || kenglikDefault(t);
      return `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`;
    }).join('')}</cols>`
    : '';

  // 1-qator — sarlavha
  const satrlar = [];
  satrlar.push(`<row r="1" ht="24" customHeight="1">${
    turlar.map((_, i) => katakXml(
      ustunlar[i] ? (ustunlar[i].nom ?? '') : '',
      katakManzil(i, 1),
      USLUB_SARLAVHA,
    )).join('')
  }</row>`);

  // Tana qatorlari
  let r = 1;
  for (const q of qatorlar) {
    r += 1;
    const fonIdx = fonIndeks(q && q.fon);
    const katak = (q && Array.isArray(q.katak)) ? q.katak : [];
    satrlar.push(`<row r="${r}">${
      turlar.map((t, i) => katakXml(katak[i], katakManzil(i, r), uslubTana(t, fonIdx))).join('')
    }</row>`);
  }
  const oxirgiTana = r; // avtofiltr shu yergacha (jami qatori kirmaydi)

  // "Jami" — qalin oxirgi qator
  if (jami) {
    r += 1;
    satrlar.push(`<row r="${r}">${
      turlar.map((t, i) => katakXml(jami.katak[i], katakManzil(i, r), uslubJami(t))).join('')
    }</row>`);
  }

  const oxirgiUstun = ustunHarfi(nUstun - 1);
  // Sarlavhani muzlatish (freeze pane) — pastga aylantirilganda ustun nomlari ko'rinib turadi
  const sheetViews = '<sheetViews><sheetView workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
    + '</sheetView></sheetViews>';
  const autoFilter = oxirgiTana > 1 ? `<autoFilter ref="A1:${oxirgiUstun}${oxirgiTana}"/>` : '';

  // OOXML da elementlar tartibi QAT'IY: dimension → sheetViews → sheetFormatPr
  // → cols → sheetData → autoFilter
  return `${XML_BOSH}<worksheet xmlns="${NS_MAIN}">`
    + `<dimension ref="A1:${oxirgiUstun}${r}"/>`
    + sheetViews
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + cols
    + `<sheetData>${satrlar.join('')}</sheetData>`
    + autoFilter
    + '</worksheet>';
}

// ============================================================
//  OMMAVIY API
// ============================================================

// Varaqdan to'liq .xlsx arxivini baytlar ko'rinishida yasaydi.
// (Node'da sinash uchun ham shu ishlatiladi — Blob/URL kerak emas.)
export function xlsxBaytlar(varaq) {
  const v = varaq || {};
  return zipYoz([
    { nom: '[Content_Types].xml', matn: contentTypesXml() },
    { nom: '_rels/.rels', matn: rootRelsXml() },
    { nom: 'xl/workbook.xml', matn: workbookXml(v.nom) },
    { nom: 'xl/_rels/workbook.xml.rels', matn: workbookRelsXml() },
    { nom: 'xl/styles.xml', matn: stylesXml() },
    { nom: 'xl/worksheets/sheet1.xml', matn: sheetXml(v) },
  ]);
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Varaqdan Blob
export function xlsxBlob(varaq) {
  return new Blob([xlsxBaytlar(varaq)], { type: XLSX_MIME });
}

// Faylni yuklab olish (eksport.js dagi downloadCSV bilan bir xil uslubda)
export function downloadXLSX(faylNomi, varaq) {
  const nom = /\.xlsx$/i.test(faylNomi || '') ? faylNomi : `${faylNomi || 'eksport'}.xlsx`;
  const blob = xlsxBlob(varaq);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
