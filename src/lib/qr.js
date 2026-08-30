// ============================================================
//  QR KOD — chekdagi "zakas holati" havolasi uchun
// ------------------------------------------------------------
//  Mijoz QR ni skanerlaydi → /z/<token> ochiladi → loginsiz
//  o'z zakasining holati, summasi va qoldiq qarzini ko'radi.
// ============================================================
import QRCode from 'qrcode';

// Matndan PNG data URL yasaydi. Xatoda null qaytaradi — chek buzilmasin.
export async function qrDataUrl(text, opts = {}) {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(String(text), {
      margin: 1,
      width: 220,
      errorCorrectionLevel: 'M',
      ...opts,
      color: { dark: '#0f172a', light: '#ffffff', ...(opts.color || {}) },
    });
  } catch (e) {
    console.error('QR yasashda xato:', e);
    return null;
  }
}

// Zakas holati sahifasiga to'liq havola: https://.../z/<token>
export function zakasHavola(token, origin) {
  if (!token) return '';
  const xom = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const base = String(xom).replace(/\/+$/, '');   // oxiridagi "/" ikkilanmasin
  return `${base}/z/${encodeURIComponent(token)}`;
}
