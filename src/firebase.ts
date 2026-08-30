import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { toast } from 'sonner';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust long-polling transport for cloud container / sandbox preview resilience
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId || '(default)');

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

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

let lastOfflineToastTime = 0;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isOffline = errorMessage.includes('unavailable') || 
                    errorMessage.includes('Could not reach Cloud Firestore backend') || 
                    errorMessage.includes('client is offline') || 
                    errorMessage.includes('offline') ||
                    errorMessage.includes('network');

  const isPermissionError = errorMessage.includes('permission-denied') || errorMessage.includes('Missing or insufficient permissions');

  if (errorMessage.includes('Quota limit exceeded') || errorMessage.includes('resource-exhausted')) {
    toast.error("Quota ya Firestore imeisha kwaleo. Tafadhali jaribu tena kesho.", {
      description: "Limit ya database ya bure imefikiwa.",
      duration: 10000,
    });
  } else if (isOffline) {
    // Only notify once every 60 seconds to prevent alert noise
    const now = Date.now();
    if (now - lastOfflineToastTime > 60000) {
      lastOfflineToastTime = now;
      toast.info("Unatumia Mfumo bila Mtandao (Offline Mode).", {
        description: "Data zako zitatunzwa kwenye kifaa chako hadi mtandao urudi.",
        duration: 4000
      });
    }
  }

  if (isOffline || isPermissionError) {
    console.warn('Firestore Notice: ', errInfo.error);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  // Only throw for non-permission modification operations as per integration instructions
  const isModifying = [OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE, OperationType.WRITE].includes(operationType);
  if (isModifying && !isOffline && !isPermissionError) {
    throw new Error(JSON.stringify(errInfo));
  }
}
