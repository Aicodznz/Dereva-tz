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
  addDoc as firestoreAddDoc, 
  query as firestoreQuery, 
  where as firestoreWhere, 
  orderBy as firestoreOrderBy, 
  limit as firestoreLimit 
} from 'firebase/firestore';

// Fallback in-memory store
const memoryStore = new Map<string, Map<string, any>>();

function getMemoryCollection(colPath: string): Map<string, any> {
  let col = memoryStore.get(colPath);
  if (!col) {
    col = new Map<string, any>();
    memoryStore.set(colPath, col);
  }
  return col;
}

let realDb: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    realDb = getFirestore(app);
    console.log("[getFirestoreDb] Real JS Client Firestore instance initialized successfully on server-side!");
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
                
              const snap = await firestoreGetDocs(q);
              const docs = snap.docs.map((doc: any) => ({
                id: doc.id,
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
              const snap = await firestoreGetDoc(docRef);
              return {
                id: snap.id,
                exists: snap.exists(),
                data: () => snap.data()
              };
            }
          } catch (err) {
            console.warn(`[getFirestoreDb] Real DB get() failed for ${colPath}, using in-memory fallback:`, err);
            return getInMemory();
          }
        }
        return getInMemory();
      },

      set: async (data: any, options?: any) => {
        // Sync in-memory first
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getMemoryCollection(parentColPath);
        if (options && options.merge && col.has(docId)) {
          col.set(docId, { ...col.get(docId), ...data });
        } else {
          col.set(docId, { ...data });
        }

        // Try real DB
        if (realDb) {
          try {
            const docRef = firestoreDoc(realDb, colPath);
            await firestoreSetDoc(docRef, data, options);
          } catch (err) {
            console.warn(`[getFirestoreDb] Real DB set() failed for ${colPath}/${docId}:`, err);
          }
        }
      },

      update: async (data: any) => {
        // Sync in-memory first
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getMemoryCollection(parentColPath);
        const current = col.get(docId) || {};
        col.set(docId, { ...current, ...data });

        // Try real DB
        if (realDb) {
          try {
            const docRef = firestoreDoc(realDb, colPath);
            await firestoreUpdateDoc(docRef, data);
          } catch (err) {
            console.warn(`[getFirestoreDb] Real DB update() failed for ${colPath}/${docId}:`, err);
          }
        }
      },

      add: async (data: any) => {
        const autoId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        // Sync in-memory first
        const col = getMemoryCollection(colPath);
        col.set(autoId, { id: autoId, ...data });

        let finalId = autoId;

        // Try real DB
        if (realDb) {
          try {
            const colRef = firestoreCollection(realDb, colPath);
            const docRef = await firestoreAddDoc(colRef, data);
            finalId = docRef.id;
            col.delete(autoId);
            col.set(finalId, { id: finalId, ...data });
          } catch (err) {
            console.warn(`[getFirestoreDb] Real DB add() failed for ${colPath}:`, err);
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
      }
    };
  };

  return {
    collection: (colName: string) => buildRef([colName])
  };
}
