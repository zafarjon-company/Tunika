// ============================================================
//  Tuzatish tugmalari — callback_data (64 baytdan past)
//  Format: "yq|<sana>|<ishchiId>|<kod>"  (id'lar qisqa: ~13 belgi)
// ============================================================
export function cbData(date, ishchiId, code) {
  return `yq|${date}|${ishchiId}|${code}`;
}

export function parseCb(data) {
  const p = String(data || '').split('|');
  if (p[0] !== 'yq' || p.length < 4) return null;
  return { date: p[1], ishchiId: p[2], code: p[3] };
}

// Menejer xabari ostidagi tugmalar
export function correctionKeyboard(date, ishchiId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Keldi', callback_data: cbData(date, ishchiId, 'keldi') },
        { text: '½ Yarim', callback_data: cbData(date, ishchiId, 'yarim') },
        { text: '❌ Kelmadi', callback_data: cbData(date, ishchiId, 'kelmadi') },
      ],
      [{ text: '🚫 Bu u emas', callback_data: cbData(date, ishchiId, 'notme') }],
    ],
  };
}

export const HOLAT_LABEL = {
  keldi: 'Keldi ✅', yarim: 'Yarim kun ½', kelmadi: 'Kelmadi ❌',
};
