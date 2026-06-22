// ============================================================
//  SAQLASH — Firestore (bulut, real-vaqt)
//  Har bir kalit `shop/{key}` hujjati: { value: <massiv|obyekt> }
//  save(key, value)   -> yozadi
//  subscribe(key, cb) -> real-vaqt: o'zgarganda cb(value|null)
// ============================================================
import { doc, setDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { db } from './firebase.js';

// Merge yozuvda biror ichki katakni O'CHIRISH belgisi.
// Misol: saveField('yoqlama', { '2026-06-23': { ishchiId: O_CHIR } })
export const O_CHIR = deleteField();

export const storage = {
  async save(key, value) {
    await setDoc(doc(db, 'shop', key), { value });
  },
  // Faqat o'zgargan qismni yozadi (deep merge) — butun hujjatni qayta yozmaydi.
  // Shu bilan bir vaqtda boshqa joydan (masalan kamera/bot) yozilgan ma'lumot
  // yo'qolmaydi. `partial` — value ichidagi ichki obyekt (sana → ishchi → holat).
  async saveField(key, partial) {
    await setDoc(doc(db, 'shop', key), { value: partial }, { merge: true });
  },
  subscribe(key, cb) {
    return onSnapshot(
      doc(db, 'shop', key),
      (snap) => cb(snap.exists() ? snap.data().value : null),
      (err) => console.error('subscribe xatosi:', key, err),
    );
  },
};
