// ============================================================
//  SAQLASH — Firestore (bulut, real-vaqt)
//  Har bir kalit `shop/{key}` hujjati: { value: <massiv|obyekt> }
//  save(key, value)   -> yozadi
//  subscribe(key, cb) -> real-vaqt: o'zgarganda cb(value|null)
// ============================================================
import { doc, setDoc, onSnapshot, deleteField, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';

// Merge yozuvda biror ichki katakni O'CHIRISH belgisi.
// Misol: saveField('yoqlama', { '2026-06-23': { ishchiId: O_CHIR } })
export const O_CHIR = deleteField();

export const storage = {
  async save(key, value) {
    await setDoc(doc(db, 'shop', key), { value });
  },
  // Atomar almashtirish: SERVERDAGI qiymat shart(value) ni qanoatlantirsagina
  // yangi(value) yoziladi (tranzaksiya — lokal kesh emas, server o'qiladi va
  // oraliqda boshqa qurilma yozgan bo'lsa qayta uriniladi). true = yozildi.
  // Keshdagi eskirgan qiymatga qarab yangiroq server qiymatini bosib ketmaslik uchun.
  async almashtirAgar(key, shart, yangi) {
    const ref = doc(db, 'shop', key);
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const v = snap.exists() ? snap.data().value : null;
      if (!shart(v)) return false;
      tx.set(ref, { value: yangi(v) });
      return true;
    });
  },
  // Faqat o'zgargan qismni yozadi (deep merge) — butun hujjatni qayta yozmaydi.
  // Shu bilan bir vaqtda boshqa joydan (masalan kamera/bot) yozilgan ma'lumot
  // yo'qolmaydi. `partial` — value ichidagi ichki obyekt (sana → ishchi → holat).
  async saveField(key, partial) {
    await setDoc(doc(db, 'shop', key), { value: partial }, { merge: true });
  },
  // cb(value, meta) — meta.fromCache: snapshot lokal keshdan (server tasdiqlamagan).
  // Bo'sh keshdan kelgan null'ga qarab seed/overwrite qilish XAVFLI — meta bilan ajratiladi.
  subscribe(key, cb) {
    return onSnapshot(
      doc(db, 'shop', key),
      (snap) => cb(
        snap.exists() ? snap.data().value : null,
        { fromCache: snap.metadata.fromCache, exists: snap.exists() },
      ),
      (err) => console.error('subscribe xatosi:', key, err),
    );
  },
};
