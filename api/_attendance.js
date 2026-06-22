// ============================================================
//  YO'QLAMA YOZUVI + DEDUP (server tomoni)
// ------------------------------------------------------------
//  - Sana/vaqt SERVER vaqtidan (Asia/Tashkent) olinadi (kamera soati
//    noto'g'ri bo'lsa ham yarim tunda chalkashmasin).
//  - markArrival: tranzaksiyada yo'qlamaga 'keldi' yozadi (faqat hali
//    qo'lda holat qo'yilmagan bo'lsa) va xabar berishni "band qiladi"
//    (notified) — shu sabab bir ishchiga kuniga 1 DM + 1 guruh xabari.
// ============================================================
import { doc, runTransaction } from 'firebase/firestore';

export function bugunTashkent() {
  // en-CA → YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function vaqtTashkent() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
}

// Tranzaksiya: yo'qlama (keldi) + arrival-log (dedup). { firstTime, changed } qaytaradi.
export async function markArrival(db, { date, ishchiId, personId, score }) {
  const yoqRef = doc(db, 'shop', 'yoqlama');
  const logRef = doc(db, 'shop', 'arrival-log');
  return runTransaction(db, async (tx) => {
    const logSnap = await tx.get(logRef);
    const yoqSnap = await tx.get(yoqRef);
    const log = (logSnap.exists() ? (logSnap.data() || {}).value : null) || {};
    const yoq = (yoqSnap.exists() ? (yoqSnap.data() || {}).value : null) || {};

    const existing = (log[date] && log[date][ishchiId]) || null;
    const firstTime = !existing || !existing.notified;
    const curStatus = (yoq[date] && yoq[date][ishchiId]) || null;

    let changed = false;
    if (!curStatus) {
      // qo'lda holat qo'yilmagan → avtomatik "keldi"
      tx.set(yoqRef, { value: { [date]: { [ishchiId]: 'keldi' } } }, { merge: true });
      changed = true;
    }

    const entry = {
      firstSeen: (existing && existing.firstSeen) || vaqtTashkent(),
      lastStatus: curStatus || 'keldi',
      notified: true, // xabar berishni band qilamiz (qaytadan yubormaslik uchun)
      person_id: personId != null ? personId : (existing ? existing.person_id : null),
      score: score != null ? score : (existing ? existing.score : 0),
    };
    if (existing && existing.managerMsg) entry.managerMsg = existing.managerMsg;
    tx.set(logRef, { value: { [date]: { [ishchiId]: entry } } }, { merge: true });

    return { firstTime, changed, firstSeen: entry.firstSeen };
  });
}
