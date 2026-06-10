import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
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

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: Platform.OS === 'web'
      ? browserLocalPersistence
      : getReactNativePersistence(AsyncStorage)
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

db = getFirestore(app);

export { auth, db };
export default app;
