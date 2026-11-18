import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc,
  addDoc as firestoreAddDoc, 
  writeBatch as firestoreWriteBatch,
  query as firestoreQuery, 
  where as firestoreWhere, 
  orderBy as firestoreOrderBy, 
  limit as firestoreLimit,
  onSnapshot as firestoreOnSnapshot
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Fallback in-memory store
const memoryStore = new Map<string, Map<string, any>>();

export function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined).filter((v) => v !== undefined);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = cleanUndefined(v);
    }
  }
  return clean;
}

async function withTimeout<T>(promise: Promise<T>, ms = 2500, label = "Operation"): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function getMemoryCollection(colPath: string): Map<string, any> {
  let col = memoryStore.get(colPath);
  if (!col) {
    col = new Map<string, any>();
    memoryStore.set(colPath, col);
  }
  return col;
}

let realDb: any = null;
let appInstance: any = null;
let authPromise: Promise<any> | null = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    realDb = getFirestore(appInstance);
    console.log("[getFirestoreDb] Real JS Client Firestore instance initialized successfully on server-side!");

    // Automatically sign in the server-side client as the guest staff to avoid permission denied
    const auth = getAuth(appInstance);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Auth timeout")), 1500)
    );
    authPromise = Promise.race([
      signInWithEmailAndPassword(auth, 'guest_staff@mabasi.com', 'GuestStaff123!')
        .then((userCred) => {
          console.log(`[getFirestoreDb] Server-side Firebase client signed in successfully as guest staff (UID: ${userCred.user.uid})`);
          return userCred;
        }),
      timeoutPromise
    ]).catch((err) => {
      console.warn("[getFirestoreDb] Server-side guest staff authentication skipped/timed out:", err.message);
      return null;
    });
  }
} catch (e) {
  console.warn("[getFirestoreDb] Failed to initialize JS Client Firestore:", e);
}

interface QueryRule {
  field: string;
  op: string;
  value: any;
}

interface OrderRule {
  field: string;
  direction: 'asc' | 'desc';
}

export function getFirestoreDb() {
  const buildRef = (
    pathSegments: string[],
    whereRules: QueryRule[] = [],
    orderRules: OrderRule[] = [],
    limitNum: number | null = null
  ): any => {
    const colPath = pathSegments.join('/');
    const isCollection = pathSegments.length % 2 === 1;

    // Helper to run in-memory get
    const getInMemory = () => {
      if (isCollection) {
        const col = getMemoryCollection(colPath);
        let docs = Array.from(col.entries()).map(([id, data]) => ({
          id,
          ref: buildRef([...pathSegments, id]),
          data: () => data
        }));

        for (const rule of whereRules) {
          docs = docs.filter(docObj => {
            const val = docObj.data()?.[rule.field];
            if (rule.op === '==') return val === rule.value;
            if (rule.op === '!=') return val !== rule.value;
            if (rule.op === 'in') return Array.isArray(rule.value) && rule.value.includes(val);
            if (rule.op === 'array-contains') return Array.isArray(val) && val.includes(rule.value);
            return true;
          });
        }

        if (orderRules.length > 0) {
          docs.sort((a, b) => {
            for (const o of orderRules) {
              const valA = a.data()?.[o.field];
              const valB = b.data()?.[o.field];
              if (valA < valB) return o.direction === 'desc' ? 1 : -1;
              if (valA > valB) return o.direction === 'desc' ? -1 : 1;
            }
            return 0;
          });
        }

        if (limitNum !== null && limitNum > 0) {
          docs = docs.slice(0, limitNum);
        }

        return {
          empty: docs.length === 0,
          exists: docs.length > 0,
          docs,
          forEach: (cb: (doc: any) => void) => docs.forEach(cb),
          data: () => ({ chats: docs.map(d => d.data()) })
        };
      } else {
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getMemoryCollection(parentColPath);
        const data = col.get(docId);
        const exists = data !== undefined;

        return {
          id: docId,
          exists,
          data: () => (exists ? { ...data } : null)
        };
      }
    };

    return {
      doc: (docId: string) => buildRef([...pathSegments, docId], whereRules, orderRules, limitNum),
      collection: (colName: string) => buildRef([...pathSegments, colName], whereRules, orderRules, limitNum),

      where: (field: string, op: string, value: any) =>
        buildRef(pathSegments, [...whereRules, { field, op, value }], orderRules, limitNum),

      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') =>
        buildRef(pathSegments, whereRules, [...orderRules, { field, direction }], limitNum),

      limit: (n: number) =>
        buildRef(pathSegments, whereRules, orderRules, n),

      get: async () => {
        if (authPromise) {
          try {
            await authPromise;
          } catch (e: any) {
            console.warn("[getFirestoreDb] Failed awaiting authPromise in get(), continuing:", e?.message || e);
          }
        }
        if (realDb) {
          try {
            if (isCollection) {
              const colRef = firestoreCollection(realDb, colPath);
              const queryParams = [];
              for (const r of whereRules) {
                queryParams.push(firestoreWhere(r.field, r.op as any, r.value));
              }
              for (const o of orderRules) {
                queryParams.push(firestoreOrderBy(o.field, o.direction));
              }
              if (limitNum !== null) {
                queryParams.push(firestoreLimit(limitNum));
              }
              
              const q = queryParams.length > 0 
                ? firestoreQuery(colRef, ...queryParams)
                : colRef;
                
              const snap = await withTimeout(firestoreGetDocs(q), 2500, `getDocs(${colPath})`);
              const docs = snap.docs.map((doc: any) => ({
                id: doc.id,
                ref: buildRef([...pathSegments, doc.id]),
                data: () => doc.data()
              }));
              return {
                empty: snap.empty,
                exists: !snap.empty,
                docs,
                forEach: (cb: (doc: any) => void) => docs.forEach(cb),
                data: () => ({ chats: docs.map(d => d.data()) })
              };
            } else {
              const docRef = firestoreDoc(realDb, colPath);
              const snap = await withTimeout(firestoreGetDoc(docRef), 2500, `getDoc(${colPath})`);
              return {
                id: snap.id,
                exists: snap.exists(),
                data: () => snap.data()
              };
            }
          } catch (err: any) {
            console.warn(`[getFirestoreDb] Real DB get() fallback for ${colPath}:`, err?.message || err);
            return getInMemory();
          }
        }
        return getInMemory();
      },

      set: async (data: any, options?: any) => {
        const cleanData = cleanUndefined(data);
        // Sync in-memory first
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getMemoryCollection(parentColPath);
        if (options && options.merge && col.has(docId)) {
          col.set(docId, { ...col.get(docId), ...cleanData });
        } else {
          col.set(docId, { ...cleanData });
        }

        // Try real DB
        if (authPromise) {
          try {
            await authPromise;
          } catch (e: any) {
            console.warn("[getFirestoreDb] Failed awaiting authPromise in set():", e?.message || e);
          }
        }
        if (realDb) {
          try {
            const docRef = firestoreDoc(realDb, colPath);
            await withTimeout(firestoreSetDoc(docRef, cleanData, options), 2500, `setDoc(${colPath})`);
          } catch (err: any) {
            console.warn(`[getFirestoreDb] Real DB set() failed for ${colPath}/${docId}:`, err?.message || err);
          }
        }
      },

      update: async (data: any) => {
        const cleanData = cleanUndefined(data);
        // Sync in-memory first
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getMemoryCollection(parentColPath);
        const current = col.get(docId) || {};
        col.set(docId, { ...current, ...cleanData });

        // Try real DB
        if (authPromise) {
          try {
            await authPromise;
          } catch (e: any) {
            console.warn("[getFirestoreDb] Failed awaiting authPromise in update():", e?.message || e);
          }
        }
        if (realDb) {
          try {
            const docRef = firestoreDoc(realDb, colPath);
            await withTimeout(firestoreUpdateDoc(docRef, cleanData), 2500, `updateDoc(${colPath})`);
          } catch (err: any) {
            console.warn(`[getFirestoreDb] Real DB update() failed for ${colPath}/${docId}:`, err?.message || err);
          }
        }
      },

      add: async (data: any) => {
        const cleanData = cleanUndefined(data);
        const autoId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Sync in-memory first
        const col = getMemoryCollection(colPath);
        col.set(autoId, { id: autoId, ...cleanData });

        let finalId = autoId;

        // Try real DB
        if (authPromise) {
          try {
            await authPromise;
          } catch (e: any) {
            console.warn("[getFirestoreDb] Failed awaiting authPromise in add():", e?.message || e);
          }
        }
        if (realDb) {
          try {
            const colRef = firestoreCollection(realDb, colPath);
            const docRef = await withTimeout(firestoreAddDoc(colRef, cleanData), 2500, `addDoc(${colPath})`);
            finalId = docRef.id;
            col.delete(autoId);
            col.set(finalId, { id: finalId, ...cleanData });
          } catch (err: any) {
            console.warn(`[getFirestoreDb] Real DB add() failed for ${colPath}:`, err?.message || err);
          }
        }

        return {
          id: finalId,
          get: async () => ({
            id: finalId,
            exists: true,
            data: () => col.get(finalId) || data
          })
        };
      },

      delete: async () => {
        if (isCollection) {
          throw new Error(`Cannot delete a collection reference directly: ${colPath}`);
        }
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getMemoryCollection(parentColPath);
        col.delete(docId);

        if (authPromise) {
          try {
            await authPromise;
          } catch (e: any) {
            console.warn("[getFirestoreDb] Failed awaiting authPromise in delete():", e?.message || e);
          }
        }
        if (realDb) {
          try {
            const docRef = firestoreDoc(realDb, colPath);
            await withTimeout(firestoreDeleteDoc(docRef), 2500, `deleteDoc(${colPath})`);
          } catch (err: any) {
            console.warn(`[getFirestoreDb] Real DB delete() failed for ${colPath}:`, err?.message || err);
          }
        }
      },

      _pathSegments: pathSegments,
      _colPath: colPath
    };
  };

  return {
    collection: (colName: string) => buildRef([colName]),
    batch: () => {
      const ops: Array<{ type: 'set' | 'update' | 'delete'; ref: any; data?: any; options?: any }> = [];
      return {
        set: (ref: any, data: any, options?: any) => {
          ops.push({ type: 'set', ref, data, options });
        },
        update: (ref: any, data: any) => {
          ops.push({ type: 'update', ref, data });
        },
        delete: (ref: any) => {
          ops.push({ type: 'delete', ref });
        },
        commit: async () => {
          // 1. Apply to in-memory store immediately
          for (const op of ops) {
            const segs: string[] | undefined = op.ref?._pathSegments;
            if (!Array.isArray(segs) || segs.length < 2) continue;
            const docId = segs[segs.length - 1];
            const parentColPath = segs.slice(0, -1).join('/');
            const col = getMemoryCollection(parentColPath);
            if (op.type === 'delete') {
              col.delete(docId);
            } else if (op.type === 'set') {
              const cleanData = cleanUndefined(op.data);
              if (op.options?.merge && col.has(docId)) {
                col.set(docId, { ...col.get(docId), ...cleanData });
              } else {
                col.set(docId, { ...cleanData });
              }
            } else if (op.type === 'update') {
              const cleanData = cleanUndefined(op.data);
              col.set(docId, { ...(col.get(docId) || {}), ...cleanData });
            }
          }

          // 2. Apply to real Firestore
          if (authPromise) {
            try {
              await authPromise;
            } catch {}
          }
          if (realDb && ops.length > 0) {
            try {
              const b = firestoreWriteBatch(realDb);
              for (const op of ops) {
                const docPath = op.ref?._colPath;
                if (!docPath) continue;
                const docRef = firestoreDoc(realDb, docPath);
                if (op.type === 'delete') b.delete(docRef);
                else if (op.type === 'set') b.set(docRef, cleanUndefined(op.data), op.options);
                else if (op.type === 'update') b.update(docRef, cleanUndefined(op.data));
              }
              await withTimeout(b.commit(), 3000, 'batch.commit()');
            } catch (err: any) {
              console.warn('[getFirestoreDb] Real DB batch.commit() warning:', err?.message || err);
            }
          }
        }
      };
    }
  };
}

export function subscribeCollectionChanges(
  colPath: string,
  whereRules: QueryRule[],
  onChanges: (changes: Array<{ type: 'added' | 'modified' | 'removed'; id: string; data: any }>, isInitialSnapshot: boolean) => void
): () => void {
  if (!realDb) {
    return () => {};
  }
  let isInitialSnapshot = true;
  let unsub: (() => void) | null = null;
  let cancelled = false;

  (async () => {
    if (authPromise) {
      try {
        await authPromise;
      } catch {}
    }
    if (cancelled) return;
    try {
      const colRef = firestoreCollection(realDb, colPath);
      const queryParams = whereRules.map((r) => firestoreWhere(r.field, r.op as any, r.value));
      const q = queryParams.length > 0 ? firestoreQuery(colRef, ...queryParams) : colRef;
      unsub = firestoreOnSnapshot(
        q,
        (snap: any) => {
          const changes = snap.docChanges().map((c: any) => ({
            type: c.type as 'added' | 'modified' | 'removed',
            id: c.doc.id,
            data: c.doc.data(),
          }));
          const initial = isInitialSnapshot;
          isInitialSnapshot = false;
          if (changes.length > 0) {
            onChanges(changes, initial);
          }
        },
        (err: any) => {
          console.warn(`[getFirestoreDb] Real-time listener warning for ${colPath}:`, err?.message || err);
        }
      );
    } catch (err: any) {
      console.warn(`[getFirestoreDb] Failed to subscribe to ${colPath}:`, err?.message || err);
    }
  })();

  return () => {
    cancelled = true;
    if (unsub) {
      try {
        unsub();
      } catch {}
    }
  };
}

