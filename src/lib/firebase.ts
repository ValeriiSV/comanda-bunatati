import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB48maYhxqPs_3XQqTfLbbTa0SfYyyEPq4',
  authDomain: 'victoria-ghecrea-crm.firebaseapp.com',
  projectId: 'victoria-ghecrea-crm',
  storageBucket: 'victoria-ghecrea-crm.firebasestorage.app',
  messagingSenderId: '461744075686',
  appId: '1:461744075686:web:b9f73d32d40f797535d567',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
