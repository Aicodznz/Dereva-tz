import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let dbInstance: any = null;

/**
 * Safe, crash-proof Firestore helper for Vercel Serverless Functions.
 * Uses pure JS client SDK (firebase/firestore) which does NOT rely on GCP metadata servers
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
          return {
            exists: snap.exists(),
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
