// ============================================================
//  KLAVIATURA YORLIQLARI (keybinds) — sozlanadigan
// ------------------------------------------------------------
//  Sozlamalar → Klaviatura bo'limidan o'zgartiriladi, localStorage'da
//  saqlanadi. Ctrl/Cmd teng deb qaraladi (Mac/Windows).
// ============================================================

export const KEY_ACTIONS = [
  { id: 'qidiruv', label: 'Global qidiruv', def: 'Ctrl+K' },
  { id: 'saqlash', label: 'Zakasni saqlash', def: 'Ctrl+S' },
];

const DEF = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.def]));

export function getKeys() {
  try {
    const raw = JSON.parse(localStorage.getItem('keybinds') || '{}');
    return { ...DEF, ...raw };
  } catch (e) {
    return { ...DEF };
  }
}

export function saveKeys(k) {
  try { localStorage.setItem('keybinds', JSON.stringify(k)); } catch (e) { /* noop */ }
}

// Klaviatura hodisasidan kombinatsiya satrini yasaydi: "Ctrl+Shift+K".
// Faqat modifikator bosilgan bo'lsa null qaytaradi.
export function comboFromEvent(e) {
  const k = e.key;
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(k)) return null;
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Cmd');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}

// Kombinatsiya qabul qilinarli — kamida modifikator yoki funksional klavisha (F1-F12)
export function comboValid(combo) {
  if (!combo) return false;
  return /Ctrl|Cmd|Alt/.test(combo) || /^F\d{1,2}$/.test(combo);
}

// Hodisa berilgan kombinatsiyaga mos keladimi (Cmd↔Ctrl teng)
export function matchCombo(e, combo) {
  if (!combo) return false;
  const c = comboFromEvent(e);
  if (!c) return false;
  const norm = (s) => s.replace(/Cmd/g, 'Ctrl').toLowerCase();
  return norm(c) === norm(combo);
}
