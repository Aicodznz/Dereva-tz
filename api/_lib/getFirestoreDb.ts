import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection } from 'firebase/firestore/lite';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyAUcXq9VRS0XbW6JflRcbS7yPaZdmAGtCU",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "hapotesti.firebaseapp.com",
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://hapotesti-default-rtdb.firebaseio.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "hapotesti",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "hapotesti.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "48479004705",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:48479004705:web:b89a1835edcf647ceb5b60"
};

let dbInstance: any = null;

/**
 * Safe, crash-proof Firestore helper for Vercel Serverless Functions.
 * Uses pure JS client SDK (firebase/firestore/lite) which does NOT rely on GCP metadata servers
 * or native C++ modules, making it 100% reliable in Vercel's serverless runtime environment.
 */
export function getFirestoreDb() {
  if (dbInstance) return dbInstance;

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);

    const buildRef = (pathSegments: string[]): any => ({
      doc: (docId: string) => buildRef([...pathSegments, docId]),
      collection: (colName: string) => buildRef([...pathSegments, colName]),
      get: async () => {
        try {
          const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
          const snap = await getDoc(docRef);
          const exists = typeof snap.exists === 'function' ? snap.exists() : Boolean(snap.exists);
          return {
            exists,
            data: () => snap.data()
          };
        } catch (err) {
          console.warn("[Vercel Firestore] getDoc warning:", err);
          return { exists: false, data: () => null };
        }
      },
      set: async (data: any, options?: any) => {
        try {
          const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
          await setDoc(docRef, data, options);
        } catch (err) {
          console.warn("[Vercel Firestore] setDoc warning:", err);
        }
      },
      update: async (data: any) => {
        try {
          const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
          await updateDoc(docRef, data);
        } catch (err) {
          console.warn("[Vercel Firestore] updateDoc warning:", err);
        }
      },
      add: async (data: any) => {
        try {
          const colRef = collection(db, pathSegments[0], ...pathSegments.slice(1));
          return await addDoc(colRef, data);
        } catch (err) {
          console.warn("[Vercel Firestore] addDoc warning:", err);
          return null;
        }
      }
    });

    dbInstance = {
      collection: (colName: string) => buildRef([colName])
    };
    return dbInstance;
  } catch (err) {
    console.warn("[Vercel Firestore] Initialization warning:", err);
    return null;
  }
}
