// ============================================================
//  FIREBASE (server tomoni) — Vercel serverless funksiyalar uchun
// ------------------------------------------------------------
//  Brauzer kabi: PUBLIC config + ANONIM auth (firebase-admin EMAS).
//  Service account / maxfiy kalit / MFA KERAK EMAS.
//  Endpointlar maxfiyligi ARRIVAL_SECRET / TG_WEBHOOK_SECRET bilan
//  ta'minlanadi (Firestore xavfsizligi brauzer bilan bir xil — anonim).
//  Ma'lumot: har bir kalit `shop/{key}` hujjati = { value: ... }
// ============================================================
import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBZAxHapB3mcnQZd7UMbok8LPWp_7SEb3s',
  authDomain: 'tunika-sex.firebaseapp.com',
  projectId: 'tunika-sex',
  storageBucket: 'tunika-sex.firebasestorage.app',
  messagingSenderId: '371096604019',
  appId: '1:371096604019:web:2267bc0fa7da4d6b2f0906',
};

let _db = null;
let _authPromise = null;

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export async function getDb() {
  const app = getApp();
  if (!_db) {
    // Node/serverless'da long-polling barqarorroq
    try {
      _db = initializeFirestore(app, { experimentalForceLongPolling: true });
    } catch {
      _db = getFirestore(app);
    }
  }
  if (!_authPromise) {
    const auth = getAuth(app);
    _authPromise = (auth.currentUser ? Promise.resolve() : signInAnonymously(auth))
      .catch((e) => { _authPromise = null; throw e; });
  }
  await _authPromise;
  return _db;
}

// admin SDK'dagi FieldValue.delete() bilan mos shaklda (kod o'zgarmasin)
export const FieldValue = { delete: () => deleteField() };

export async function readShop(db, key) {
  const snap = await getDoc(doc(db, 'shop', key));
  return snap.exists() ? ((snap.data() || {}).value ?? null) : null;
}

export async function mergeShop(db, key, partial) {
  await setDoc(doc(db, 'shop', key), { value: partial }, { merge: true });
}
