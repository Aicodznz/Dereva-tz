import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { toast } from 'sonner';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
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
  
  // Custom message for connection errors
  if (errInfo.error.includes('unavailable') || errInfo.error.includes('offline')) {
    toast.error("Network Error: Firestore connection failed.", {
      description: "If you are on a restricted network (proxy/VPN), please try switching to a standard connection or check your browser privacy settings."
    });
  }
  
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  // Give the app a moment to stabilize before checking connection
  await new Promise(r => setTimeout(r, 1000));
  
  try {
    // Attempt a cold read to verify backend reachability
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("%cFirestore connection established successfully.", "color: green; font-weight: bold;");
  } catch (error: any) {
    if (error?.code === 'unavailable') {
      console.warn("Firestore connection 'unavailable'. The app will operate in offline mode.");
      toast.warning("Firestore is currently unavailable. The app will sync when back online.", {
        description: "Check your internet or browser extensions if this persisted."
      });
    } else if (error?.code === 'permission-denied') {
      console.log("%cFirestore backend reached (Access Denied). Connectivity verified.", "color: orange; font-weight: bold;");
    } else {
      console.error("Firestore connectivity check failed:", error);
    }
  }
}

testConnection();
