import { initializeApp, getApps, getApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCY04TlRCuLBZv8QunxD2QvlU_akV9WK90",
  authDomain: "alankara-textile.firebaseapp.com",
  projectId: "alankara-textile",
  storageBucket: "alankara-textile.firebasestorage.app",
  messagingSenderId: "1042620589621",
  appId: "1:1042620589621:web:12fb464be7968280ea737c"
};

let app;
let auth;
let db;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (authError) {
      auth = getAuth(app);
    }
  } else {
    app = getApp();
    auth = getAuth(app);
  }
  db = getFirestore(app);
} catch (e) {
  console.log('Firebase init error:', e);
}

export { auth, db };
export default app;
