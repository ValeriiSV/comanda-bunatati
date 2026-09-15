import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDu86lUJXgQYTkbNQlLX3bIFd5ht3_PWoY',
  authDomain: 'comanda-bunatati.firebaseapp.com',
  projectId: 'comanda-bunatati',
  storageBucket: 'comanda-bunatati.firebasestorage.app',
  messagingSenderId: '600432537903',
  appId: '1:600432537903:web:a1a6813a59a6033c33f1da',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
