// src/services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection } from 'firebase/firestore';
// 🔴 આ બે નવી લાઈન એડ કરી (પાસવર્ડ સેવ રાખવા)
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// તારી વેબસાઈટનું અસલી ડેટાબેઝ કનેક્શન (Firebase Config)
const firebaseConfig = {
  apiKey: "AIzaSyAIEul0E3lPP5UUWMeDwdhHeVJSJfmiZKc",
  authDomain: "mihirsync-news.firebaseapp.com",
  projectId: "mihirsync-news",
  storageBucket: "mihirsync-news.firebasestorage.app",
  messagingSenderId: "655643804828",
  appId: "1:655643804828:web:6e458847ac120dae711959",
  measurementId: "G-ZCWBNND5CV"
};

// ફાયરબેઝ ચાલુ કરો (ડબલ ઇનિશિયલાઇઝ ના થાય એના માટેનું સેટિંગ)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// ડેટાબેઝ એક્સપોર્ટ
export const db = getFirestore(app);

// 🔴 મેજિક અહિયાં છે! આનાથી એપ બંધ કરીશ તો પણ યુઝરનું લોગીન રહેશે
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // જો પહેલેથી ઓથ ચાલુ હોય તો ગભરાવાની જરૂર નથી
  import('firebase/auth').then(({ getAuth }) => {
    auth = getAuth(app);
  });
}
export { auth };

// તારા એડમિન પેનલ માટેના જૂના કલેક્શન (એમનેમ રાખ્યા છે જેથી વેબસાઈટ બગડે નહિ)
export const articlesCollection = collection(db, 'articles');