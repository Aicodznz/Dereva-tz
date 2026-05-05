import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { toast } from 'sonner';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Using initializeFirestore to enable ignoreUndefinedProperties and better connectivity
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalAutoDetectLongPolling: true, // Improved connection for some environments
}, (firebaseConfig as any).firestoreDatabaseId);

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
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.includes('Quota limit exceeded') || errorMessage.includes('resource-exhausted')) {
    toast.error("Quota ya Firestore imeisha kwaleo. Tafadhali jaribu tena kesho.", {
      description: "Limit ya database ya bure imefikiwa.",
      duration: Infinity,
    });
  } else if (errorMessage.includes('unavailable') || errorMessage.includes('Could not reach Cloud Firestore backend') || errorMessage.includes('client is offline')) {
    toast.error("Inashindwa kuunganishwa na database (Offline).", {
      description: "Hakikisha Firestore imewezeshwa kwenye Console na una internet.",
      duration: 8000
    });
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
        console.error("Please check your Firebase configuration or internet connection.");
      }
    }
  }
}

testConnection();
