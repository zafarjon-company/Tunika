// ============================================================
//  SAQLASH — Firestore (bulut, real-vaqt)
//  Har bir kalit `shop/{key}` hujjati: { value: <massiv|obyekt> }
//  save(key, value)   -> yozadi
//  subscribe(key, cb) -> real-vaqt: o'zgarganda cb(value|null)
// ============================================================
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';

export const storage = {
  async save(key, value) {
    await setDoc(doc(db, 'shop', key), { value });
  },
  subscribe(key, cb) {
    return onSnapshot(
      doc(db, 'shop', key),
      (snap) => cb(snap.exists() ? snap.data().value : null),
      (err) => console.error('subscribe xatosi:', key, err),
    );
  },
};
