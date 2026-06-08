// ============================================================
//  EKSPORT — CSV (Excel) faylga yuklab olish
// ------------------------------------------------------------
//  Excel uchun ';' ajratuvchi + UTF-8 BOM ishlatamiz (uz/ru
//  Excelda ustunlar to'g'ri ajraladi va harflar buzilmaydi).
// ============================================================

function esc(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCSV(filename, headers, rows) {
  const sep = ';';
  const lines = [headers.map(esc).join(sep), ...rows.map((r) => r.map(esc).join(sep))];
  const BOM = String.fromCharCode(0xFEFF); // Excel UTF-8 ni to'g'ri o'qishi uchun
  const csv = BOM + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
