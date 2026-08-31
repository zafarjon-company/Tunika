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
  'kaziroklar', 'kazirok-turlari', 'jurnal',
  'telegram-bot-token', 'telegram-chat-id', 'telegram-dxf-chats', 'telegram-settings', 'telegram-links',
  'camera-links', 'camera-unlinked',
  // YOLO kamera / yangi Telegram yo'qlama tizimi kalitlari
  'telegram_config', 'telegram_links', 'yolo_cameras', 'yolo_control', 'yolo_kelish', 'yolo_settings', 'arrival-log',
  // Ombor (material qoldig'i) va avtomatik ishlar sozlamasi
  'ombor', 'ombor-harakat', 'avto-ish',
];

// Barcha zaxira kalitlarini Firestore'dan o'qib bitta obyektga yig'adi.
// (Qo'lda yuklab olish ham, avtomatik Telegram zaxirasi ham shundan foydalanadi.)
// Har kalit ALOHIDA try/catch bilan o'qiladi: Firestore qoidalari yopilgach ba'zi
// kalitlar (masalan 'users' — faqat asoschi o'qiydi) ruxsat bermasligi mumkin —
// bitta kalit yiqilgani uchun BUTUN zaxira yiqilib qolmasin.
export async function zaxiraMalumot() {
  const data = {};
  await Promise.all(ZAXIRA_KEYS.map(async (k) => {
    try {
      const snap = await getDoc(doc(db, 'shop', k));
      if (snap.exists()) data[k] = snap.data().value;
    } catch (e) {
      console.warn('Zaxira: kalit o\'qilmadi (ruxsat yo\'q bo\'lishi mumkin):', k);
    }
  }));
  // Xavfsizlik: foydalanuvchilar ro'yxatidan OCHIQ MATNDAGI parol maydonini
  // olib tashlaymiz — zaxira fayli (ayniqsa Telegramga ketadigani) parol sizdirmasin.
  // parolHash qoladi: tiklashda loginlar ishlashda davom etadi.
  if (Array.isArray(data.users)) {
    data.users = data.users.map((u) => {
      if (!u || typeof u !== 'object') return u;
      const { parol, ...qolgani } = u;
      return qolgani;
    });
  }
  return data;
}

export async function eksportZaxira() {
  const data = await zaxiraMalumot();

  const payload = { __app: 'tunika', __version: 2, sana: toDateInput(), data };
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
