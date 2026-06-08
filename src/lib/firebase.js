// ============================================================
//  FIREBASE — bulut baza (Firestore) + anonim Auth
//  Offline kesh (persistentLocalCache) yoqilgan: ma'lumot darhol
//  keshdan ko'rinadi, keyin fonda sinxronlanadi (tez + offline).
// ============================================================
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBZAxHapB3mcnQZd7UMbok8LPWp_7SEb3s',
  authDomain: 'tunika-sex.firebaseapp.com',
  projectId: 'tunika-sex',
  storageBucket: 'tunika-sex.firebasestorage.app',
  messagingSenderId: '371096604019',
  appId: '1:371096604019:web:2267bc0fa7da4d6b2f0906',
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
