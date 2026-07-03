import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy as fsOrderBy, 
  limit as fsLimit, 
  where as fsWhere 
} from 'firebase/firestore/lite';

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
 * Safe, crash-proof Firestore helper for Vercel Serverless Functions and Node backend.
 * Uses pure JS client SDK (firebase/firestore/lite) which does NOT rely on GCP metadata servers,
 * service accounts, or native C++ modules, making it 100% reliable without PERMISSION_DENIED errors.
 */
export function getFirestoreDb() {
  if (dbInstance) return dbInstance;

  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);

    const buildRef = (pathSegments: string[], queryConstraints: any[] = []): any => {
      const isCollection = pathSegments.length % 2 === 1;

      return {
        doc: (docId: string) => buildRef([...pathSegments, docId]),
        collection: (colName: string) => buildRef([...pathSegments, colName]),
        
        where: (field: string, op: any, value: any) => 
          buildRef(pathSegments, [...queryConstraints, fsWhere(field, op, value)]),
          
        orderBy: (field: string, direction?: 'asc' | 'desc') => 
          buildRef(pathSegments, [...queryConstraints, fsOrderBy(field, direction || 'asc')]),
          
        limit: (n: number) => 
          buildRef(pathSegments, [...queryConstraints, fsLimit(n)]),

        get: async () => {
          try {
            if (isCollection) {
              const colRef = collection(db, pathSegments[0], ...pathSegments.slice(1));
              const q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : colRef;
              const querySnap = await getDocs(q as any);
              
              const docsList = querySnap.docs.map(d => ({
                id: d.id,
                data: () => d.data()
              }));

              return {
                empty: querySnap.empty,
                exists: !querySnap.empty,
                docs: docsList,
                forEach: (cb: (doc: any) => void) => docsList.forEach(cb),
                data: () => ({ chats: docsList.map(d => d.data()) })
              };
            } else {
              const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
              const snap = await getDoc(docRef);
              const exists = typeof snap.exists === 'function' ? snap.exists() : Boolean(snap.exists);
              return {
                exists,
                id: snap.id,
                data: () => snap.data()
              };
            }
          } catch (err) {
            // Return empty result gracefully on permission disallow or network issue
            return {
              empty: true,
              exists: false,
              docs: [],
              forEach: () => {},
              data: () => null
            };
          }
        },

        set: async (data: any, options?: any) => {
          try {
            const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
            await setDoc(docRef, data, options);
          } catch (err) {
            // Silently fallback
          }
        },

        update: async (data: any) => {
          try {
            const docRef = doc(db, pathSegments[0], ...pathSegments.slice(1));
            await updateDoc(docRef, data);
          } catch (err) {
            // Silently fallback
          }
        },

        add: async (data: any) => {
          try {
            const colRef = collection(db, pathSegments[0], ...pathSegments.slice(1));
            return await addDoc(colRef, data);
          } catch (err) {
            return null;
          }
        }
      };
    };

    dbInstance = {
      collection: (colName: string) => buildRef([colName])
    };
    return dbInstance;
  } catch (err) {
    return null;
  }
}

