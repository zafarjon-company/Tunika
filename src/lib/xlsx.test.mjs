// ============================================================
//  XLSX YOZUVCHI — SINOV
//  Ishga tushirish:  node src/lib/xlsx.test.mjs
//  Brauzer kerak emas: xlsxBlob() dan baytlarni olib faylga yozamiz
//  (Node 18+ da Blob global, blob.arrayBuffer() bor).
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { xlsxBlob, xlsxBaytlar, ustunHarfi, escXml } from './xlsx.js';

const CHIQISH = '/tmp/claude-0/-home-user-Tunika/7649828e-ae35-5b0d-a208-56fa873a7e1d/scratchpad/sinov.xlsx';

let xato = 0;
let jami = 0;
function tekshir(nom, kutilgan, olingan) {
  jami += 1;
  const ok = kutilgan === olingan;
  if (!ok) xato += 1;
  console.log(`${ok ? '  ✅' : '  ❌'} ${nom}: ${olingan}${ok ? '' : `  (kutilgan: ${kutilgan})`}`);
}
function rost(nom, shart) {
  jami += 1;
  if (!shart) xato += 1;
  console.log(`${shart ? '  ✅' : '  ❌'} ${nom}`);
}

console.log('\n=== XLSX — SOF FUNKSIYALAR ===\n');
tekshir('ustunHarfi(0)', 'A', ustunHarfi(0));
tekshir('ustunHarfi(25)', 'Z', ustunHarfi(25));
tekshir('ustunHarfi(26)', 'AA', ustunHarfi(26));
tekshir('ustunHarfi(27)', 'AB', ustunHarfi(27));
tekshir('ustunHarfi(51)', 'AZ', ustunHarfi(51));
tekshir('ustunHarfi(701)', 'ZZ', ustunHarfi(701));
tekshir('ustunHarfi(702)', 'AAA', ustunHarfi(702));
tekshir('escXml(& < > " \')', '&amp;&lt;&gt;&quot;&apos;', escXml('&<>"\''));
tekshir('escXml kirill tegilmaydi', 'полимерка', escXml('полимерка'));
// Apostrof ham ekranlanadi (&apos;) — XML uni o'qiganda yana apostrofga aylanadi
tekshir("escXml apostrof", 'Mokriy qora, o&apos;lchov', escXml("Mokriy qora, o'lchov"));

// ============================================================
//  Sinov varag'i: kirill matn, kasr son, katta pul summasi, fonli qatorlar
// ============================================================
const varaq = {
  nom: 'Ombor sinov',
  ustunlar: [
    { nom: 'Rang',        kenglik: 20, tur: 'matn' },
    { nom: 'Tur',         kenglik: 16, tur: 'matn' },
    { nom: "Og'irlik, kg", kenglik: 14, tur: 'son' },
    { nom: 'Uzunlik, m',  kenglik: 14, tur: 'son' },
    { nom: '1 m narxi',   kenglik: 18, tur: 'pul' },
    { nom: 'Jami summa',  kenglik: 20, tur: 'pul' },
    { nom: 'Dollarda',    kenglik: 14, tur: 'dollar' },
  ],
  qatorlar: [
    // kirill tur nomi + kasr son + katta pul summasi
    { katak: ['Mokriy asfalt', 'полимерка', 1250.5, 1422.375, 49080.73, 69792810.5, 5512.75], fon: '' },
    { katak: ["To'q ko'k",     'полимерка', 980.25, 1120.5,   51200,    57369600,   4529],    fon: 'sariq' },
    { katak: ['Qizil <SMZ> & "AB"', 'оцинковка', 0.45, 3.5,   1234567,  4321000000, 341.5],   fon: 'toq' },
    { katak: ['Qora',          'полимерка', 12,     0,        0,        0,          0],       fon: 'qizil' },
    // bo'sh kataklar (null/undefined) — fon baribir ko'rinishi kerak
    { katak: ['Nomsiz', null, undefined, '', 0, null, undefined], fon: 'sariq' },
  ],
  jami: { katak: ['JAMI', '', 2243.2, 2546.375, null, 131483410.5, 10383.25] },
};

console.log('\n=== XLSX — FAYL YASASH ===\n');
const blob = xlsxBlob(varaq);
const buf = Buffer.from(await blob.arrayBuffer());
mkdirSync(dirname(CHIQISH), { recursive: true });
writeFileSync(CHIQISH, buf);

tekshir('blob.type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', blob.type);
rost('fayl bo\'sh emas (' + buf.length + ' bayt)', buf.length > 1000);
tekshir('ZIP imzosi (PK\\x03\\x04)', '504b0304', buf.subarray(0, 4).toString('hex'));
tekshir('xlsxBaytlar hajmi = blob hajmi', buf.length, xlsxBaytlar(varaq).length);

// XML ichini oddiy matn sifatida ham tekshirib qo'yamiz (siqishsiz ZIP —
// mazmun arxivda ochiq turadi, shuning uchun izlash mumkin).
const matn = buf.toString('utf8');
rost('kirill matn faylda bor', matn.includes('полимерка'));
rost('kasr son faylda bor', matn.includes('<v>1422.375</v>'));
rost('katta summa faylda bor', matn.includes('<v>69792810.5</v>'));
rost('inlineStr ishlatilgan', matn.includes('t="inlineStr"'));
rost('freeze pane bor', matn.includes('ySplit="1"'));
rost("pul formati e'lon qilingan", matn.includes('numFmtId="165"'));
rost('sariq fon rangi bor', matn.includes('FFFEF3C7'));
rost('XML ekranlash ishladi', matn.includes('Qizil &lt;SMZ&gt; &amp; &quot;AB&quot;'));
rost('xom "<SMZ>" faylga tushmagan', !matn.includes('Qizil <SMZ>'));

console.log(`\n  Fayl: ${CHIQISH}`);
console.log(`\n=== NATIJA: ${jami - xato}/${jami} o'tdi ===\n`);
process.exit(xato ? 1 : 0);
