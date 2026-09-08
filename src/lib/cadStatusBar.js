// ============================================================
//  CAD HOLAT PANELI — AutoCAD pastki o'ng burchagidagi tugmalar
// ------------------------------------------------------------
//  SNAP (F9) · GRID (F7, qadam ▾) · ORTHO (F8) · POLAR (F10, qadam ▾)
//  · OSNAP (F3, rejimlar ▾) · OTRACK (F11) · DYN (F12). Chapda kursor
//  koordinatasi (AutoCAD'dek Y yuqoriga). Sozlamalar obyekti (osnap.js
//  DEFAULT_SNAP shaklida) joyida o'zgartiriladi; har o'zgarishda
//  onChange(key) chaqiriladi — dvigatel saqlaydi va qayta chizadi.
//  mountStatusBar(host, { settings, onChange }) ->
//    { sync(), setCoords(text), handleKey(e) -> bool, destroy() }
// ============================================================
import { SNAP_MODES, POLAR_INCS, GRID_STEPS, snapMarkerShapes } from './osnap.js';

let uidSeq = 0;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// Rejim belgisi (16×16 SVG) — osnap.js dagi marker shakllaridan
function iconSvg(kind) {
  const shapes = snapMarkerShapes(kind, 8, 8, 'currentColor', 5);
  const body = shapes.map((sh) => '<' + sh.tag + ' ' + Object.entries(sh.attrs).map(([k, v]) => k + '="' + esc(v) + '"').join(' ') + '/>').join('');
  return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">' + body + '</svg>';
}
const F_KEYS = { F3: 'osnap', F7: 'grid', F8: 'ortho', F9: 'gridSnap', F10: 'polar', F11: 'otrack', F12: 'dyn' };

export function mountStatusBar(host, opts) {
  const s = opts.settings;
  const uid = 'cs' + (++uidSeq);
  const bar = document.createElement('div');
  bar.className = 'cad-status';
  bar.innerHTML = `
    <span class="cad-coords" data-cs="coords" title="Kursor koordinatasi (Y yuqoriga)">X 0  Y 0</span>
    <button type="button" data-cs="gridSnap" title="SNAP (F9) — kursor to'r tugunlariga tushadi">SNAP</button>
    <span class="cad-dd">
      <button type="button" data-cs="grid" title="GRID (F7) — to'r ko'rinishi">GRID</button>
      <button type="button" class="cad-ddbtn" data-cs="gridMenu" title="To'r qadami">&#9662;</button>
      <div class="cad-menu" data-cs="gridPanel">
        <div class="cad-menu-title">To'r qadami</div>
        ${GRID_STEPS.map((g) => `<label><input type="radio" name="${uid}-grid" value="${g}" /> ${g === 0 ? 'avto (masshtabga qarab)' : (g >= 1000 ? (g / 1000) + ' m' : (g >= 10 ? (g / 10) + ' sm' : g + ' mm'))}</label>`).join('')}
      </div>
    </span>
    <button type="button" data-cs="ortho" title="ORTHO (F8) — faqat 0° / 90° / 180° / 270°">ORTHO</button>
    <span class="cad-dd">
      <button type="button" data-cs="polar" title="POLAR (F10) — kursor polar burchak qadamlariga yopishadi, kuzatish nuri chiqadi">POLAR</button>
      <button type="button" class="cad-ddbtn" data-cs="polarMenu" title="Polar qadam">&#9662;</button>
      <div class="cad-menu" data-cs="polarPanel">
        <div class="cad-menu-title">Polar burchak qadami</div>
        ${POLAR_INCS.map((a) => `<label><input type="radio" name="${uid}-polar" value="${a}" /> ${a}°${a === 90 ? ' (faqat orto)' : ''}</label>`).join('')}
      </div>
    </span>
    <span class="cad-dd">
      <button type="button" data-cs="osnap" title="OSNAP (F3) — obyekt yopishish (magnit): uch, o'rta, markaz, kesishma...">OSNAP</button>
      <button type="button" class="cad-ddbtn" data-cs="osnapMenu" title="Yopishish rejimlari">&#9662;</button>
      <div class="cad-menu cad-menu-wide" data-cs="osnapPanel">
        <div class="cad-menu-title">Obyekt yopishish rejimlari</div>
        ${SNAP_MODES.map((m) => `<label><input type="checkbox" data-mode="${m.key}" /> <i class="cad-ico">${iconSvg(m.key)}</i> ${esc(m.nomi)} <b>${m.key}</b></label>`).join('')}
        <div class="cad-menu-btns">
          <button type="button" data-cs="allOn">Hammasi</button>
          <button type="button" data-cs="allOff">Hech biri</button>
          <label class="cad-menu-inline">Magnit radiusi
            <select data-cs="aperture"><option value="8">8 px</option><option value="12">12 px</option><option value="16">16 px</option><option value="24">24 px</option></select>
          </label>
        </div>
      </div>
    </span>
    <button type="button" data-cs="otrack" title="OTRACK (F11) — yopishgan nuqta ustida biroz turing: undan gorizontal/vertikal/polar kuzatish chiziqlari chiqadi">OTRACK</button>
    <button type="button" data-cs="dyn" title="DYN (F12) — dinamik kiritish: uzunlik/burchak qutisi">DYN</button>
  `;
  host.appendChild(bar);
  const q = (n) => bar.querySelector(`[data-cs="${n}"]`);
  const TOGGLES = ['gridSnap', 'grid', 'ortho', 'polar', 'osnap', 'otrack', 'dyn'];
  const MENUS = [['gridMenu', 'gridPanel'], ['polarMenu', 'polarPanel'], ['osnapMenu', 'osnapPanel']];
  const cleanups = [];
  const on = (el, ev, fn) => { el.addEventListener(ev, fn); cleanups.push(() => el.removeEventListener(ev, fn)); };

  function sync() {
    for (const k of TOGGLES) { const b = q(k); if (b) b.classList.toggle('on', !!s[k]); }
    bar.querySelectorAll(`input[name="${uid}-grid"]`).forEach((r) => { r.checked = +r.value === (s.gridStep || 0); });
    bar.querySelectorAll(`input[name="${uid}-polar"]`).forEach((r) => { r.checked = +r.value === s.polarInc; });
    bar.querySelectorAll('input[data-mode]').forEach((c) => { c.checked = !!s.modes[c.dataset.mode]; });
    const ap = q('aperture');
    if (ap) {
      const v = String(s.aperture || 12);
      // Saqlangan qiymat ro'yxatda bo'lmasa — qo'shamiz (select bo'sh ko'rinmasin)
      if (![...ap.options].some((o) => o.value === v)) {
        const o = document.createElement('option');
        o.value = v; o.textContent = v + ' px';
        ap.appendChild(o);
      }
      ap.value = v;
    }
  }
  function closeMenus() { for (const [, p] of MENUS) { const el = q(p); if (el) el.classList.remove('show'); } }
  function toggle(key) {
    s[key] = !s[key];
    // AutoCAD: ORTHO va POLAR bir vaqtda yonmaydi
    if (key === 'ortho' && s.ortho) s.polar = false;
    if (key === 'polar' && s.polar) s.ortho = false;
    sync();
    opts.onChange && opts.onChange(key);
  }
  // Sichqoncha bilan bosilgan tugma fokusda qolmasin — keyingi Enter/Space
  // rejimni bilmasdan qayta o'zgartirib yubormasin (klaviatura bilan Tab qilsa qoladi).
  const unfocus = (e) => { if (e.detail) e.currentTarget.blur(); };
  for (const k of TOGGLES) on(q(k), 'click', (e) => { toggle(k); unfocus(e); });
  for (const [btn, panel] of MENUS) on(q(btn), 'click', (e) => {
    e.stopPropagation();
    const el = q(panel), open = el.classList.contains('show');
    closeMenus();
    if (!open) el.classList.add('show');
    unfocus(e);
  });
  on(bar, 'change', (e) => {
    const t = e.target;
    if (!t) return;
    if (t.name === `${uid}-grid`) { s.gridStep = +t.value || 0; if (!s.grid) s.grid = true; sync(); opts.onChange && opts.onChange('gridStep'); }
    else if (t.name === `${uid}-polar`) { s.polarInc = +t.value; if (!s.polar) { s.polar = true; s.ortho = false; } sync(); opts.onChange && opts.onChange('polarInc'); }
    else if (t.dataset && t.dataset.mode) { s.modes[t.dataset.mode] = t.checked; if (t.checked && !s.osnap) s.osnap = true; sync(); opts.onChange && opts.onChange('modes'); }
    else if (t === q('aperture')) { s.aperture = +t.value || 12; opts.onChange && opts.onChange('aperture'); }
  });
  on(q('allOn'), 'click', () => { for (const m of SNAP_MODES) s.modes[m.key] = true; s.osnap = true; sync(); opts.onChange && opts.onChange('modes'); });
  on(q('allOff'), 'click', () => { for (const m of SNAP_MODES) s.modes[m.key] = false; sync(); opts.onChange && opts.onChange('modes'); });
  // Menyu ichidagi bosishlar tashqariga (chizmaga) o'tmasin; tashqarida bosilsa menyular yopiladi
  on(bar, 'mousedown', (e) => e.stopPropagation());
  on(bar, 'dblclick', (e) => e.stopPropagation());
  on(bar, 'wheel', (e) => e.stopPropagation());
  const outside = (e) => { if (!bar.contains(e.target)) closeMenus(); };
  document.addEventListener('mousedown', outside);
  cleanups.push(() => document.removeEventListener('mousedown', outside));

  // F-tugmalar: F3 OSNAP, F7 GRID, F8 ORTHO, F9 SNAP, F10 POLAR, F11 OTRACK, F12 DYN
  function handleKey(e) {
    const k = F_KEYS[e.key];
    if (!k) return false;
    toggle(k);
    return true;
  }
  sync();
  return {
    el: bar,
    sync,
    handleKey,
    closeMenus,
    setCoords(text) { const c = q('coords'); if (c) c.textContent = text; },
    destroy() { cleanups.forEach((fn) => fn()); if (bar.parentNode) bar.parentNode.removeChild(bar); },
  };
}
