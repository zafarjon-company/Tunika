// ============================================================
//  YOY (ARC) GEOMETRIYASI — AutoCAD «Arc» usullari (Detal / Gul chizish)
// ------------------------------------------------------------
//  Sof geometriya, DOM yo'q (testlar: npm run test:arc).
//  Konvensiya: world mm, x o'ngga, y PASTGA. Burchak AutoCAD'dek: 0° = o'ng,
//  90° = TEPA, soat miliga qarshi (vizual CCW) musbat — osnap.js bilan bir xil.
//  Yoy elementi: { type:'arc', cx, cy, r, a0, a1 } — a0 dan a1 gacha HAR DOIM
//  soat miliga qarshi (AutoCAD ham yoyni shunday saqlaydi). Sweep = norm360(a1−a0),
//  0 bo'lsa to'liq aylana deb qaraladi (yaratilmaydi — Aylana asbobi bor).
//  Quruvchilar (AutoCAD usullari) {cx,cy,r,a0,a1,ccw} qaytaradi yoki null:
//    ccw — foydalanuvchi chizgan yo'nalish (boshi→oxiri) soat miliga qarshimi;
//    saqlanadigan yoy baribir CCW, «Davom ettirish» uchun chizilgan oxiri va
//    u yerdagi tangens yo'nalishi arcDrawnEnd() bilan olinadi.
//    3 nuqta · Boshi,Markaz,Oxiri · Boshi,Markaz,Burchak · Boshi,Markaz,Vatar ·
//    Boshi,Oxiri,Burchak · Boshi,Oxiri,Yo'nalish · Boshi,Oxiri,Radius ·
//    Markaz,Boshi,* (= Boshi,Markaz,* — nuqtalar tartibi boshqa) · Davom ettirish.
//  Ishoralar AutoCAD'dek: burchak/vatar/radius manfiy bo'lsa — teskari tomon /
//  katta (major) yoy.
// ============================================================
import { norm360, dirVec, vecAng } from './osnap.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const EPS = 1e-9;

export function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/* ---------------- ELEMENT XOSSALARI ---------------- */
// Yoyning burchak kengligi (0, 360]: a0 == a1 → 360 (to'liq)
export function arcSweep(e) { const s = norm360(e.a1 - e.a0); return s < 1e-9 ? 360 : s; }
export function arcLen(e) { return e.r * arcSweep(e) * D2R; }
export function arcPt(e, ang) { const v = dirVec(ang); return { x: e.cx + v.dx * e.r, y: e.cy + v.dy * e.r }; }
export function arcStart(e) { return arcPt(e, e.a0); }
export function arcEnd(e) { return arcPt(e, e.a1); }
export function arcMid(e) { return arcPt(e, e.a0 + arcSweep(e) / 2); }
// ang burchagi yoy ichidami (a0 dan CCW sweep gacha)
export function angInArc(e, ang, eps = 1e-7) { return norm360(ang - e.a0) <= arcSweep(e) + eps; }
// Yoyning gabariti — uchlari + oraliqdagi kvadrant nuqtalari
export function arcBounds(e) {
  const pts = [arcStart(e), arcEnd(e)];
  for (const q of [0, 90, 180, 270]) if (angInArc(e, q)) pts.push(arcPt(e, q));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
}
// Nuqtadan yoygacha masofa: burchak yoy ichida — aylanagacha; tashqarida — yaqin uchigacha
export function distToArc(e, p) {
  const dx = p.x - e.cx, dy = p.y - e.cy, d = Math.hypot(dx, dy);
  if (d > EPS && angInArc(e, vecAng(dx, dy))) return Math.abs(d - e.r);
  return Math.min(dist(p, arcStart(e)), dist(p, arcEnd(e)));
}
// Yoy bo'ylab n+1 nuqta (a0 dan a1 gacha) — tanlash ramkasi / taxminiy kesishma uchun
export function arcSamples(e, n = 16) {
  const sw = arcSweep(e), out = [];
  for (let k = 0; k <= n; k++) out.push(arcPt(e, e.a0 + sw * k / n));
  return out;
}
// Chizilgan (foydalanuvchi yo'nalishidagi) oxiri va u yerdagi harakat yo'nalishi (tangens) —
// «Davom ettirish» uchun. ccw=false bo'lsa chizilgan oxiri a0 uchi, yo'nalish — a0 − 90°.
export function arcDrawnEnd(e, ccw = true) {
  if (ccw !== false) return { x: arcEnd(e).x, y: arcEnd(e).y, ang: norm360(e.a1 + 90) };
  return { x: arcStart(e).x, y: arcStart(e).y, ang: norm360(e.a0 - 90) };
}

/* ---------------- QURUVCHILAR (AutoCAD usullari) ---------------- */
function mk(cx, cy, r, a0, a1, ccw) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !(r > EPS)) return null;
  a0 = norm360(a0); a1 = norm360(a1);
  if (norm360(a1 - a0) < 1e-7) return null;   // nol yoki to'liq aylana — yoy emas
  return { cx, cy, r, a0, a1, ccw: ccw !== false };
}
// Boshi, Markaz, Burchak — ishorali sweep (+ soat miliga qarshi, − soat mili bo'yicha)
export function arcSCA(s, c, sweep) {
  if (!s || !c || !Number.isFinite(sweep)) return null;
  const r = dist(s, c); if (r < EPS) return null;
  const as = vecAng(s.x - c.x, s.y - c.y);
  if (Math.abs(sweep) < 1e-7 || Math.abs(sweep) >= 360) return null;
  if (sweep > 0) return mk(c.x, c.y, r, as, as + sweep, true);
  return mk(c.x, c.y, r, as + sweep, as, false);
}
// Boshi, Markaz, Oxiri — oxirgi nuqta faqat burchakni beradi (radius boshidan), har doim CCW
export function arcSCE(s, c, ePt) {
  if (!s || !c || !ePt) return null;
  const r = dist(s, c); if (r < EPS || dist(ePt, c) < EPS) return null;
  const sweep = norm360(vecAng(ePt.x - c.x, ePt.y - c.y) - vecAng(s.x - c.x, s.y - c.y));
  if (sweep < 1e-7) return null;
  return arcSCA(s, c, sweep);
}
// Boshi, Markaz, Vatar — vatar uzunligi: + kichik (minor) yoy, − katta (major); |L| ≤ 2r
export function arcSCL(s, c, chord) {
  if (!s || !c || !Number.isFinite(chord) || Math.abs(chord) < EPS) return null;
  const r = dist(s, c); if (r < EPS) return null;
  const L = Math.abs(chord);
  if (L > 2 * r + 1e-9) return null;
  const th = 2 * Math.asin(Math.min(1, L / (2 * r))) * R2D;
  const sweep = chord > 0 ? th : 360 - th;
  if (sweep < 1e-7 || sweep >= 360) return null;
  return arcSCA(s, c, sweep);
}
// Boshi, Oxiri, Burchak — ichki (markaziy) burchak; + boshidan oxiriga CCW, − soat mili bo'yicha
export function arcSEA(s, e, sweep) {
  if (!s || !e || !Number.isFinite(sweep)) return null;
  const th = Math.abs(sweep);
  if (th < 1e-7 || th >= 360) return null;
  if (sweep < 0) { const a = arcSEA(e, s, th); if (a) a.ccw = false; return a; }
  const c = dist(s, e); if (c < EPS) return null;
  const r = c / (2 * Math.sin(th / 2 * D2R));
  const h = r * Math.cos(th / 2 * D2R);   // th > 180 bo'lsa manfiy — markaz vatarning o'ng tomonida
  const phi = vecAng(e.x - s.x, e.y - s.y), n = dirVec(phi + 90);   // vatar yo'nalishining chap tomoni
  const cx = (s.x + e.x) / 2 + n.dx * h, cy = (s.y + e.y) / 2 + n.dy * h;
  return mk(cx, cy, r, vecAng(s.x - cx, s.y - cy), vecAng(e.x - cx, e.y - cy), true);
}
// Boshi, Oxiri, Yo'nalish — boshidagi tangens yo'nalishi (gradus)
export function arcSED(s, e, dirDeg) {
  if (!s || !e || !Number.isFinite(dirDeg)) return null;
  if (dist(s, e) < EPS) return null;
  const alpha = norm180(vecAng(e.x - s.x, e.y - s.y) - dirDeg);   // tangensdan vatarga burilish
  if (Math.abs(alpha) < 1e-7 || Math.abs(alpha) > 180 - 1e-7) return null;
  return arcSEA(s, e, 2 * alpha);
}
// Boshi, Oxiri, Radius — + kichik yoy (CCW), − katta yoy; |R| ≥ vatar/2
export function arcSER(s, e, radius) {
  if (!s || !e || !Number.isFinite(radius) || Math.abs(radius) < EPS) return null;
  const c = dist(s, e); if (c < EPS) return null;
  const R = Math.abs(radius);
  if (R < c / 2 - 1e-9) return null;
  const th = 2 * Math.asin(Math.min(1, c / (2 * R))) * R2D;
  const sweep = radius > 0 ? th : 360 - th;
  if (sweep < 1e-7 || sweep >= 360) return null;
  return arcSEA(s, e, sweep);
}
// 3 nuqta — p1 boshi, p2 yoy ustida, p3 oxiri (yo'nalish nuqtalardan aniqlanadi)
export function arcFrom3(p1, p2, p3) {
  if (!p1 || !p2 || !p3) return null;
  const ax = p1.x, ay = p1.y, bx = p2.x, by = p2.y, cx = p3.x, cy = p3.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return null;   // bir chiziqda
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  const t1 = vecAng(ax - ux, ay - uy), t2 = vecAng(bx - ux, by - uy), t3 = vecAng(cx - ux, cy - uy);
  const ccw = norm360(t2 - t1) < norm360(t3 - t1);   // p2 CCW yo'lda p3 dan oldin keladi
  return ccw ? mk(ux, uy, r, t1, t3, true) : mk(ux, uy, r, t3, t1, false);
}
// Davom ettirish — oldingi element oxiridan (p, tangens yo'nalishi ang) oxirgi nuqtagacha
export function arcContinue(from, e) {
  if (!from || !Number.isFinite(from.ang)) return null;
  return arcSED({ x: from.x, y: from.y }, e, from.ang);
}

/* ---------------- O'ZGARTIRISH (move/rotate/scale/mirror) ----------------
   fn — nuqta akslantiruvchi (o'xshashlik: surish, burish, masshtab, aks). Markaz, boshi,
   oxiri, o'rtasi akslantiriladi; aks ettirishda yo'nalish teskari bo'lganini o'rta
   nuqta orqali aniqlab a0/a1 almashtiriladi. */
export function arcMap(e, fn) {
  const c = fn({ x: e.cx, y: e.cy }), s = fn(arcStart(e)), en = fn(arcEnd(e)), m = fn(arcMid(e));
  const r = dist(s, c);
  if (!(r > EPS)) return null;
  let a0 = vecAng(s.x - c.x, s.y - c.y), a1 = vecAng(en.x - c.x, en.y - c.y);
  const am = vecAng(m.x - c.x, m.y - c.y);
  const test = { cx: c.x, cy: c.y, r, a0, a1 };
  if (!angInArc(test, am, 1e-6)) { const t = a0; a0 = a1; a1 = t; }
  return { cx: c.x, cy: c.y, r, a0, a1 };
}
// SVG path (ekran koordinatalarida): s, en — ekrandagi uchlar, R — ekran radiusi
export function arcSvgPath(e, w2s, scale) {
  const sw = arcSweep(e);
  const s = w2s(arcStart(e).x, arcStart(e).y), en = w2s(arcEnd(e).x, arcEnd(e).y), R = e.r * scale;
  if (sw >= 360 - 1e-7) { const c = w2s(e.cx, e.cy); return `M${c.x - R} ${c.y} A${R} ${R} 0 1 0 ${c.x + R} ${c.y} A${R} ${R} 0 1 0 ${c.x - R} ${c.y}`; }
  // Bizning CCW (vizual soat miliga qarshi) — SVG'da sweep-flag 0 (y pastga bo'lgani uchun)
  return `M${s.x} ${s.y} A${R} ${R} 0 ${sw > 180 ? 1 : 0} 0 ${en.x} ${en.y}`;
}
