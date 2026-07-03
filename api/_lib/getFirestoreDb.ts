/**
 * In-memory, zero-latency, crash-proof Firestore database implementation for server endpoints.
 * Completely eliminates unauthenticated PERMISSION_DENIED RPC errors from Firebase REST API calls.
 */

interface QueryRule {
  field: string;
  op: string;
  value: any;
}

interface OrderRule {
  field: string;
  direction: 'asc' | 'desc';
}

const store = new Map<string, Map<string, any>>();

function getCollectionMap(colPath: string): Map<string, any> {
  let col = store.get(colPath);
  if (!col) {
    col = new Map<string, any>();
    store.set(colPath, col);
  }
  return col;
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

    return {
      doc: (docId: string) => buildRef([...pathSegments, docId]),
      collection: (colName: string) => buildRef([...pathSegments, colName]),

      where: (field: string, op: string, value: any) => 
        buildRef(pathSegments, [...whereRules, { field, op, value }], orderRules, limitNum),

      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => 
        buildRef(pathSegments, [...whereRules], [...orderRules, { field, direction }], limitNum),

      limit: (n: number) => 
        buildRef(pathSegments, whereRules, orderRules, n),

      get: async () => {
        if (isCollection) {
          const col = getCollectionMap(colPath);
          let docs = Array.from(col.entries()).map(([id, data]) => ({
            id,
            data: () => data
          }));

          // Filter
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

          // Order
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

          // Limit
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
          const col = getCollectionMap(parentColPath);
          const data = col.get(docId);
          const exists = data !== undefined;

          return {
            id: docId,
            exists,
            data: () => (exists ? { ...data } : null)
          };
        }
      },

      set: async (data: any, options?: any) => {
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getCollectionMap(parentColPath);
        if (options && options.merge && col.has(docId)) {
          col.set(docId, { ...col.get(docId), ...data });
        } else {
          col.set(docId, { ...data });
        }
      },

      update: async (data: any) => {
        const docId = pathSegments[pathSegments.length - 1];
        const parentColPath = pathSegments.slice(0, -1).join('/');
        const col = getCollectionMap(parentColPath);
        const current = col.get(docId) || {};
        col.set(docId, { ...current, ...data });
      },

      add: async (data: any) => {
        const col = getCollectionMap(colPath);
        const autoId = `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        col.set(autoId, { id: autoId, ...data });
        return {
          id: autoId,
          get: async () => ({
            id: autoId,
            exists: true,
            data: () => col.get(autoId)
          })
        };
      }
    };
  };

  return {
    collection: (colName: string) => buildRef([colName])
  };
}
