import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app);
export { signInWithPopup, signOut, signInAnonymously };
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error details: ', JSON.stringify(errInfo));
  // If it's a connection error, we might want to warn the user about their network
  if (errInfo.error.includes('unavailable') || errInfo.error.includes('offline')) {
    console.warn("Firestore appears to be unavailable. This is usually due to network restrictions or firewall blocking Google APIs.");
  }
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    // Attempt a cold read to verify backend reachability
    // We use getDocFromServer to bypass local cache and force a network round-trip
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("%cFirestore connection established successfully.", "color: green; font-weight: bold;");
  } catch (error: any) {
    if (error?.code === 'unavailable') {
      console.warn("Firestore connection 'unavailable'. The app will operate in offline mode.");
    } else if (error?.code === 'permission-denied') {
      // If we get a permission-denied, it actually means we SUCCESSFULLY reached the server
      // and the server rejected us. This is a positive connectivity test!
      console.log("%cFirestore backend reached (Access Denied). Connectivity verified.", "color: orange; font-weight: bold;");
    } else {
      console.error("Firestore connectivity check failed:", error);
    }
  }
}

testConnection();
