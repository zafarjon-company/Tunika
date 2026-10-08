// ============================================================
//  FIREBASE (server tomoni) — Vercel serverless funksiyalar uchun
// ------------------------------------------------------------
//  IKKI REJIM:
//  1) ADMIN — FIREBASE_SERVICE_ACCOUNT env (JSON satr) o'rnatilgan
//     bo'lsa firebase-admin ishlatiladi: Firestore qoidalarini
//     chetlab o'tadi, custom token yasay oladi (api/login.js).
//  2) ANONIM (eski usul, moslik uchun) — env yo'q bo'lsa brauzer
//     kabi PUBLIC config + anonim auth. Endpointlar maxfiyligi
//     ARRIVAL_SECRET / TG_WEBHOOK_SECRET bilan ta'minlanadi.
//  Ma'lumot: har bir kalit `shop/{key}` hujjati = { value: ... }
//  DIQQAT: firebase-admin FAQAT env bor bo'lganda dynamic import
//  qilinadi — env'siz deploylarda modul umuman yuklanmaydi.
// ============================================================
import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDoc, setDoc, deleteField, runTransaction } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBZAxHapB3mcnQZd7UMbok8LPWp_7SEb3s',
  authDomain: 'tunika-sex.firebaseapp.com',
  projectId: 'tunika-sex',
  storageBucket: 'tunika-sex.firebasestorage.app',
  messagingSenderId: '371096604019',
  appId: '1:371096604019:web:2267bc0fa7da4d6b2f0906',
};

// ---------------- ADMIN rejim (service account) ----------------

// Admin rejim yoqilganmi (service account env o'rnatilganmi)
export function adminBormi() {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}

let _admin = null;        // { db, auth, FieldValue } — yuklangach shu yerda
let _adminPromise = null; // parallel chaqiriqlar bitta init'ni kutsin

async function loadAdmin() {
  if (_admin) return _admin;
  if (!_adminPromise) {
    _adminPromise = (async () => {
      // Dynamic import — env'siz deploylarda firebase-admin yuklanmasin
      const [appMod, fsMod, authMod] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/firestore'),
        import('firebase-admin/auth'),
      ]);
      const hisob = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const app = appMod.getApps().length
        ? appMod.getApps()[0]
        : appMod.initializeApp({ credential: appMod.cert(hisob) });
      _admin = {
        db: fsMod.getFirestore(app),
        auth: authMod.getAuth(app),
        FieldValue: fsMod.FieldValue,
      };
      return _admin;
    })().catch((e) => { _adminPromise = null; throw e; });
  }
  return _adminPromise;
}

// Custom token yasash (api/login.js) — faqat admin rejimda ishlaydi
export async function mintCustomToken(uid, claims) {
  if (!adminBormi()) throw new Error('admin rejim yoq: FIREBASE_SERVICE_ACCOUNT o\'rnatilmagan');
  const { auth } = await loadAdmin();
  return auth.createCustomToken(String(uid), claims || {});
}

// Klient idToken'ini tekshirish (api/users.js) — faqat admin rejimda
export async function verifyIdToken(idToken) {
  if (!adminBormi()) throw new Error('admin rejim yoq: FIREBASE_SERVICE_ACCOUNT o\'rnatilmagan');
  const { auth } = await loadAdmin();
  return auth.verifyIdToken(idToken);
}

// ---------------- ANONIM rejim (eski usul) ----------------

let _db = null;
let _authPromise = null;

function getApp() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export async function getDb() {
  if (adminBormi()) {
    // Admin Firestore — qoidalarni chetlab o'tadi
    return (await loadAdmin()).db;
  }
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

// admin SDK'dagi FieldValue.delete() bilan mos shaklda (kod o'zgarmasin).
// Admin rejimda admin'ning sentineli, anonim rejimda klient deleteField().
// Eslatma: FieldValue.delete() doim getDb()'dan KEYIN chaqiriladi (barcha
// api fayllarida shunday), shu payt admin allaqachon yuklangan bo'ladi.
export const FieldValue = {
  delete: () => {
    if (adminBormi()) {
      if (!_admin) throw new Error('FieldValue.delete() dan oldin getDb() chaqirilishi kerak');
      return _admin.FieldValue.delete();
    }
    return deleteField();
  },
};

export async function readShop(db, key) {
  if (adminBormi()) {
    const snap = await db.collection('shop').doc(key).get();
    return snap.exists ? ((snap.data() || {}).value ?? null) : null;
  }
  const snap = await getDoc(doc(db, 'shop', key));
  return snap.exists() ? ((snap.data() || {}).value ?? null) : null;
}

export async function mergeShop(db, key, partial) {
  if (adminBormi()) {
    await db.collection('shop').doc(key).set({ value: partial }, { merge: true });
    return;
  }
  await setDoc(doc(db, 'shop', key), { value: partial }, { merge: true });
}

// Atomar "o'qi → qaror → yoz": fn(joriyQiymat, qoshimcha) → { patch, natija }.
//  qoshimchaKalitlar — shu tranzaksiyada FAQAT O'QILADIGAN boshqa hujjatlar
//  (masalan 'yoqlama'): qoshimcha = { kalit: qiymat }. Ular ham tranzaksiyada
//  o'qilgani uchun oraliqda o'zgarsa Firestore tranzaksiyani yangi ma'lumot bilan
//  qayta ishga tushiradi — qaror eskirgan ma'lumotga tayanmaydi.
// patch bo'lsa merge bilan yoziladi (FieldValue.delete() ichma-ich ham ishlaydi).
// fn SOF bo'lsin — Firestore to'qnashuvda tranzaksiyani qayta ishga tushiradi.
// Ishchi botida "bir xabar — bir marta" kafolati shunga tayanadi (ustma-ust
// kelgan ikki so'rov bir yozuvni ikkalasi ham "yangi" deb ko'rmasin).
export async function txShop(db, key, fn, qoshimchaKalitlar = []) {
  const tana = async (tx, ref, qRefs, bormi) => {
    const snap = await tx.get(ref);
    const qoshimcha = {};
    for (let i = 0; i < qRefs.length; i += 1) {
      const s = await tx.get(qRefs[i]);
      qoshimcha[qoshimchaKalitlar[i]] = bormi(s) ? ((s.data() || {}).value ?? null) : null;
    }
    const v = bormi(snap) ? ((snap.data() || {}).value ?? null) : null;
    const { patch, natija } = fn(v, qoshimcha);
    if (patch && Object.keys(patch).length) tx.set(ref, { value: patch }, { merge: true });
    return natija;
  };
  if (adminBormi()) {
    const ref = db.collection('shop').doc(key);
    const qRefs = qoshimchaKalitlar.map((k) => db.collection('shop').doc(k));
    return db.runTransaction((tx) => tana(tx, ref, qRefs, (s) => s.exists));
  }
  const ref = doc(db, 'shop', key);
  const qRefs = qoshimchaKalitlar.map((k) => doc(db, 'shop', k));
  return runTransaction(db, (tx) => tana(tx, ref, qRefs, (s) => s.exists()));
}
