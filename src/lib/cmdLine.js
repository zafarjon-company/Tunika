// ============================================================
//  BUYRUQ SATRI (AutoCAD command line) — SOF MANTIQ (DOM yo'q)
//  Testlar: npm run test:cmd
//  - parseInput: buyruq satriga yozilgan matnni nuqta / masofa / son ga aylantiradi
//    (AutoCAD sintaksisi: 10,20  @10,20  @10<45  10<45  @  50)
//  - deriveKeywords / matchKeyword / promptWithOptions: asbob variantlari uchun yoziladigan
//    kalit so'zlar (AutoCAD [Radius/Polyline/Kesish] ko'rinishi)
//  - cmdScore / cmdFilter: buyruq nomi va qisqartmasi bo'yicha qidiruv (AutoComplete)
//  Konvensiya: world mm, x o'ngga, y PASTGA. Foydalanuvchi Y ni TEPAGA deb kiritadi (AutoCAD),
//  shuning uchun kiritilgan y ning ishorasi teskarilanadi. Burchak: 0° o'ng, 90° tepa, CCW musbat.
// ============================================================

const D2R = Math.PI / 180;
function dirVec(deg) { const r = deg * D2R; return { dx: Math.cos(r), dy: -Math.sin(r) }; }

// «12.5», «12,5» (bitta vergul — kasr), « 12 » → son yoki null
export function num1(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s+/g, '');
  if (!t) return null;
  const v = Number(t.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}
// Ikki qismli koordinata: «10,20» / «10.5,-3» → [a, b] yoki null
function pair(s) {
  const i = s.indexOf(',');
  if (i < 0) return null;
  const sa = s.slice(0, i).trim(), sb = s.slice(i + 1).trim();
  if (!sa || !sb) return null;   // «10,» yoki «,5» — koordinata emas
  const a = Number(sa), b = Number(sb);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

/* ---------------- KIRITISHNI TAHLIL QILISH ----------------
   ctx = { from:{x,y}|null (oxirgi nuqta), unit: 1 (mm) yoki 10 (sm) — uzunlik ko'paytmasi }
   Natija:
     { kind:'point', x, y }   — world nuqta (mm)
     { kind:'dist',  mm }     — uzunlik (mm): kursor yo'nalishida (to'g'ridan-to'g'ri masofa, @50)
     { kind:'number', v, mm } — oddiy son (v — yozilgani, mm — birlikka ko'paytirilgani)
     { kind:'empty' } | { kind:'invalid', reason }
*/
const MAXC = 1e7;   // mm — bundan katta koordinata chizmani (zoom, gabarit) buzadi
const rnd9 = (v) => Math.round(v * 1e9) / 1e9;
function pointRes(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { kind: 'invalid', reason: "Koordinata noto'g'ri" };
  if (Math.abs(x) > MAXC || Math.abs(y) > MAXC) return { kind: 'invalid', reason: "Koordinata juda katta (10 km dan ortiq)" };
  return { kind: 'point', x: rnd9(x), y: rnd9(y) };
}
// Mobil klaviatura va nusxa-ko'chirishdan keladigan belgilar: uzilmas probel, unicode minus, to'liq kenglikdagi belgilar
export function normSym(s) {
  return String(s == null ? '' : s)
    .replace(/[    ]/g, ' ')
    .replace(/[−‒–—]/g, '-')
    .replace(/[＜‹〈]/g, '<')
    .replace(/[，،]/g, ',')
    .replace(/[＠]/g, '@')
    .replace(/[．]/g, '.');
}
export function parseInput(raw, ctx = {}) {
  const U = ctx.unit > 0 ? ctx.unit : 1;
  let s = normSym(raw).trim();
  if (!s) return { kind: 'empty' };
  s = s.replace(/\s+/g, '');
  const rel = s[0] === '@';
  if (rel) s = s.slice(1);
  const from = ctx.from && Number.isFinite(ctx.from.x) && Number.isFinite(ctx.from.y) ? ctx.from : null;
  if (rel && !s) return from ? pointRes(from.x, from.y) : { kind: 'invalid', reason: "Oldingi nuqta yo'q (@)" };
  if (rel && !from) return { kind: 'invalid', reason: "Nisbiy kiritish (@) uchun oldingi nuqta yo'q" };
  // Qutbiy: masofa<burchak
  const lt = s.indexOf('<');
  if (lt >= 0) {
    const d = num1(s.slice(0, lt)), a = num1(s.slice(lt + 1));
    if (d == null || a == null) return { kind: 'invalid', reason: 'Qutbiy kiritish: masofa<burchak (masalan @50<45)' };
    const v = dirVec(a), L = d * U, b = rel ? from : { x: 0, y: 0 };
    return pointRes(b.x + v.dx * L, b.y + v.dy * L);
  }
  // Dekart: x,y (vergul — koordinata ajratkichi; kasr uchun nuqta yoziladi)
  const pr = pair(s);
  if (pr) {
    const b = rel ? from : { x: 0, y: 0 };
    return pointRes(b.x + pr[0] * U, b.y - pr[1] * U);   // ekranda Y TEPAGA
  }
  if (s.indexOf(',') >= 0) return { kind: 'invalid', reason: 'Koordinata: x,y (masalan 120,80)' };
  const v = num1(s);
  if (v == null) return { kind: 'invalid', reason: 'Son yoki koordinata kiriting' };
  if (rel) return { kind: 'dist', mm: v * U };   // @50 — kursor yo'nalishida 50
  return { kind: 'number', v, mm: v * U };
}

// To'g'ridan-to'g'ri masofa: oxirgi nuqtadan kursor yo'nalishida mm masofadagi nuqta
export function pointFromDist(from, cursor, mm) {
  if (!from || !cursor || !Number.isFinite(mm)) return null;
  const dx = cursor.x - from.x, dy = cursor.y - from.y, L = Math.hypot(dx, dy);
  if (!(L > 1e-9) || !(mm > 0)) return null;
  return { x: from.x + (dx / L) * mm, y: from.y + (dy / L) * mm };
}

/* ---------------- ARIFMETIK IFODA (AutoCAD 'CAL o'rnida: «50*2», «(30+20)/2») ----------------
   Faqat sonlar va + − * / ( ) — xavfsiz (eval ishlatilmaydi). Ifoda bo'lmasa null. */
export function evalExpr(s) {
  const t = normSym(s).replace(/\s+/g, '');
  if (!t || !/^[-+*/().\d]+$/.test(t) || !/[+*/]|\d-/.test(t)) return null;   // amal belgisi bo'lmasa — oddiy son
  const toks = t.match(/\d+(?:\.\d+)?|[-+*/()]/g);
  if (!toks || toks.join('') !== t) return null;
  const out = [], ops = [], pr = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3 };
  let prev = null;
  for (const raw of toks) {
    let tk = raw;
    if (/^\d/.test(tk)) { out.push(Number(tk)); prev = 'n'; continue; }
    if (tk === '(') { ops.push(tk); prev = '('; continue; }
    if (tk === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
      if (!ops.length) return null;
      ops.pop(); prev = 'n'; continue;
    }
    // Unar ishora (satr boshida, qavsdan yoki boshqa amaldan keyin): «-5+10», «3*-2»
    if ((tk === '-' || tk === '+') && (prev === null || prev === '(' || prev === 'o')) {
      if (tk === '+') { prev = 'o'; continue; }
      tk = 'u-';
    }
    while (ops.length && ops[ops.length - 1] !== '(' && (pr[ops[ops.length - 1]] > pr[tk] || (pr[ops[ops.length - 1]] === pr[tk] && tk !== 'u-'))) out.push(ops.pop());
    ops.push(tk); prev = 'o';
  }
  while (ops.length) { const o = ops.pop(); if (o === '(') return null; out.push(o); }
  const st = [];
  for (const o of out) {
    if (typeof o === 'number') { st.push(o); continue; }
    if (o === 'u-') { const a = st.pop(); if (a == null) return null; st.push(-a); continue; }
    const b = st.pop(), a = st.pop();
    if (a == null || b == null) return null;
    st.push(o === '+' ? a + b : o === '-' ? a - b : o === '*' ? a * b : b === 0 ? NaN : a / b);
  }
  const v = st.length === 1 ? st[0] : null;
  return Number.isFinite(v) ? v : null;
}

/* ---------------- KALIT SO'ZLAR (AutoCAD [Radius/Polyline/Kesish]) ---------------- */
export function cmdNorm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[‘’ʻʼ`]/g, "'").trim();
}
// Yorliqlardan takrorlanmas kalitlar: «Radius»→R, «Polyline»→P; to'qnashsa 2-3 harf / keyingi harf
export function deriveKeywords(labels) {
  const used = new Set(), out = [];
  for (const raw of labels || []) {
    const lab = cmdNorm(raw).replace(/[^a-z0-9'\s]/g, ' ').trim();
    const words = lab.split(/\s+/).filter(Boolean);
    const w0 = words[0] || 'x';
    const cands = [w0[0]];
    for (let k = 1; k < words.length; k++) cands.push(w0[0] + words[k][0]);   // «Markaz, diametr» → MD
    for (let n = 2; n <= Math.min(3, w0.length); n++) cands.push(w0.slice(0, n));
    for (let i = 1; i < w0.length; i++) cands.push(w0[i]);
    for (let i = 1; i <= 9; i++) cands.push(w0[0] + i);
    // Kalit HARF bilan aralash bo'lsin: sof raqamli kalit («2 nuqta» → «2») sonli kiritish bilan
    // chalkashadi (AutoCAD ham raqamni kalit so'z deb olmaydi) — «2 nuqta» → 2N
    const kw = cands.find((c) => c && /[a-z]/.test(c) && !used.has(c)) || String(out.length + 1);
    used.add(kw);
    out.push(kw.toUpperCase());
  }
  return out;
}
// Kiritilgan matn qaysi variantga mos: aniq kalit (o'zbekcha yoki AutoCAD inglizchasi) >
// kalit boshlanishi > yorliq boshlanishi.  -1 — mos emas, -2 — noaniq (bir nechta variantga mos)
export function matchKeyword(input, options) {
  const s = cmdNorm(input).replace(/\s+/g, '');
  if (!s || !options || !options.length) return -1;
  const keysOf = (o) => [o.kw, o.alt].map((k) => cmdNorm(k || '')).filter(Boolean);
  for (let j = 0; j < options.length; j++) if (keysOf(options[j]).includes(s)) return j;
  const kws = options.map((o) => cmdNorm(o.kw || ''));
  const pre = options.map((o, j) => ({ ks: keysOf(o), j })).filter((x) => x.ks.some((k) => k.startsWith(s)));
  if (pre.length === 1) return pre[0].j;
  if (pre.length > 1) return -2;   // kalit prefiksi noaniq — yorliq bosqichiga o'tilmaydi
  const labs = options.map((o) => cmdNorm(o.label || '').replace(/\s+/g, ''));
  const lp = labs.map((k, j) => ({ k, j })).filter((x) => x.k && x.k.startsWith(s));
  if (lp.length === 1) return lp[0].j;
  if (pre.length > 1 || lp.length > 1) return -2;
  return -1;
}
// AutoCAD ko'rinishidagi so'rov: «... yoki [Radius/Polyline/Kesish]:»
// Kalit yorliqning boshi bo'lmasa qavsda ko'rsatiladi; AutoCAD inglizcha kaliti (alt) ham qo'shiladi
export function promptWithOptions(base, options) {
  const list = (options || []).filter((o) => o && o.label);
  if (!list.length) return base;
  const parts = list.map((o) => {
    const lab = String(o.label), kw = String(o.kw || ''), alt = String(o.alt || '');
    const shown = [];
    if (kw && !cmdNorm(lab).replace(/\s+/g, '').startsWith(cmdNorm(kw))) shown.push(kw);
    if (alt && cmdNorm(alt) !== cmdNorm(kw)) shown.push(alt);
    return shown.length ? lab + ' (' + shown.join('/') + ')' : lab;
  });
  return base + ' yoki [' + parts.join('/') + ']';
}

/* ---------------- BUYRUQ QIDIRUVI (AutoComplete) ---------------- */
export function cmdScore(c, qs) {
  const s = cmdNorm(qs);
  if (!s || !c) return -1;
  const nm = cmdNorm(c.nomi), als = (c.al || []).map(cmdNorm), hay = nm + ' ' + als.join(' ');
  if (als.includes(s)) return 0;
  if (als.some((a) => a.startsWith(s))) return 1;
  if (nm.startsWith(s)) return 2;
  if (nm.includes(s)) return 3;
  if (als.some((a) => a.includes(s))) return 4;
  const toks = s.split(/\s+/).filter(Boolean);
  if (toks.length > 1 && toks.every((t) => hay.includes(t))) return 5;
  return -1;
}
// use — buyruq id si bo'yicha ishlatilish soni: bir xil ballda ko'p ishlatilgani yuqoriroq (AutoCAD adaptiv takliflari)
export function cmdFilter(list, qs, limit = 9, use) {
  const u = (c) => (use && use[c.id]) || 0;
  return (list || []).map((c) => ({ c, sc: cmdScore(c, qs) })).filter((x) => x.sc >= 0)
    .sort((a, b) => a.sc - b.sc || u(b.c) - u(a.c) || cmdNorm(a.c.nomi).length - cmdNorm(b.c.nomi).length)
    .slice(0, limit).map((x) => x.c);
}
