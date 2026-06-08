// ============================================================
//  ZAXIRA (BACKUP) — Firestore'дан JSON faylga eksport / import
// ============================================================
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { toDateInput } from './helpers.js';

export const ZAXIRA_KEYS = [
  'tunika-baza', 'latok-data', 'orders', 'shop-name', 'shop-phone', 'ustalar',
  'klentlar', 'usd-rate', 'usd-olish', 'dynamic-products', 'aksessuarlar', 'metrlilar',
  'ishchilar', 'lavozimlar', 'qobiliyatlar', 'kamchiliklar', 'yoqlama',
  'avanslar', 'ranglar', 'users',
];

export async function eksportZaxira() {
  const data = {};
  await Promise.all(ZAXIRA_KEYS.map(async (k) => {
    const snap = await getDoc(doc(db, 'shop', k));
    if (snap.exists()) data[k] = snap.data().value;
  }));

  const payload = { __app: 'tunika-sex', __version: 2, sana: toDateInput(), data };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tunika-zaxira-${toDateInput()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importZaxira(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const data = parsed && parsed.data ? parsed.data : parsed;
  const keys = Object.keys(data).filter((k) => ZAXIRA_KEYS.includes(k));
  if (keys.length === 0) throw new Error('Faylda mos ma\'lumot topilmadi');
  await Promise.all(keys.map((k) => setDoc(doc(db, 'shop', k), { value: data[k] })));
  return keys.length;
}
