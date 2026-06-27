import { 
  doc as fsDoc,
  collection as fsCollection,
  getDoc as fsGetDoc, 
  setDoc as fsSetDoc, 
  updateDoc as fsUpdateDoc, 
  addDoc as fsAddDoc, 
  deleteDoc as fsDeleteDoc, 
  getDocs as fsGetDocs, 
  onSnapshot as fsOnSnapshot,
  DocumentReference,
  CollectionReference,
  Query,
} from 'firebase/firestore';
import { db } from './config';

// Simple event emitter for real-time local sync
class LocalEventEmitter {
  private listeners: { [key: string]: Array<() => void> } = {};

  subscribe(key: string, callback: () => void): () => void {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);
    return () => {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    };
  }

  emit(key: string) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => cb());
    }
  }
}

const localEmitter = new LocalEventEmitter();

// Helper to manage localStorage data
const localDb = {
  get(collectionName: string): any[] {
    const data = localStorage.getItem(`db_${collectionName}`);
    return data ? JSON.parse(data) : [];
  },
  
  set(collectionName: string, items: any[]) {
    localStorage.setItem(`db_${collectionName}`, JSON.stringify(items));
    localEmitter.emit(collectionName);
  },

  getDoc(collectionName: string, docId: string): any | null {
    const items = this.get(collectionName);
    return items.find((item: any) => item.uid === docId || item.id === docId) || null;
  },

  setDoc(collectionName: string, docId: string, data: any) {
    const items = this.get(collectionName);
    const existingIndex = items.findIndex((item: any) => item.uid === docId || item.id === docId || (collectionName === 'users' && item.uid === docId));
    
    const newItem = { 
      id: docId, 
      uid: docId, 
      ...data,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex > -1) {
      items[existingIndex] = { ...items[existingIndex], ...newItem };
    } else {
      newItem.createdAt = new Date().toISOString();
      items.push(newItem);
    }
    this.set(collectionName, items);
  },

  updateDoc(collectionName: string, docId: string, data: any) {
    const items = this.get(collectionName);
    const existingIndex = items.findIndex((item: any) => item.uid === docId || item.id === docId);
    if (existingIndex > -1) {
      items[existingIndex] = { ...items[existingIndex], ...data, updatedAt: new Date().toISOString() };
      this.set(collectionName, items);
    } else {
      // Create if it doesn't exist
      this.setDoc(collectionName, docId, data);
    }
  },

  addDoc(collectionName: string, data: any): string {
    const items = this.get(collectionName);
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newItem = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.push(newItem);
    this.set(collectionName, items);
    return id;
  },

  deleteDoc(collectionName: string, docId: string) {
    const items = this.get(collectionName);
    const filtered = items.filter((item: any) => item.id !== docId && item.uid !== docId);
    this.set(collectionName, filtered);
  }
};

// Seed default users if empty (for beautiful UI preview experience) - KEEP EMPTY FOR PRODUCTION CLEANLINESS
if (localDb.get('users').length === 0) {
  localDb.set('users', []);
}

// Seed default apps if empty
if (localDb.get('apps').length === 0) {
  localDb.set('apps', []);
}

// Seed default messages if empty (disabled to allow purely real user chat)
if (localDb.get('messages').length === 0) {
  localDb.set('messages', []);
}

// Parse collection and document details from references
function parseRef(ref: any): { collectionName: string; docId: string | null } {
  // Safe extraction of path properties
  const path = ref._path?.segments || ref.path?.split('/') || [];
  return {
    collectionName: path[0] || '',
    docId: path[1] || null
  };
}

// Helper to determine if we should fall back to localStorage on Firestore errors (denied permission or offline/unreachable connection)
function shouldFallback(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  const code = error.code ? String(error.code).toLowerCase() : '';
  
  // Only fall back to local storage if it's a permanent security rule restriction or missing DB
  // DO NOT fall back on transient connection, network, or offline states.
  return (
    msg.includes('permission') ||
    msg.includes('insufficient') ||
    code === 'permission-denied'
  );
}

// Local storage filter utility for queries when using local storage fallback
function filterLocalItems(collectionName: string, items: any[], queryObj: any): any[] {
  if (!queryObj || !queryObj._query) return items;
  
  const filters = queryObj._query.filters || [];
  if (filters.length === 0) return items;
  
  let filtered = [...items];
  
  for (const f of filters) {
    // Extract field name
    const field = f.field?.stringField || f.field?.path?.segments?.[0] || f.field?.path || '';
    if (!field) continue;

    // Extract comparison value
    let val = f.value?.internalValue;
    if (val === undefined) {
      val = f.value?.value?.internalValue;
    }
    if (val === undefined) {
      val = f.value;
    }
    if (val === undefined) continue;

    // Extract operator
    const op = (f.op?.name || f.op || '').toLowerCase();
    
    filtered = filtered.filter(item => {
      const itemValue = item[field];
      if (op.includes('eq') || op === '==' || op === 'equal') {
        return itemValue === val;
      }
      if (op.includes('not') || op === '!=' || op === 'not_equal') {
        return itemValue !== val;
      }
      return true;
    });
  }
  
  return filtered;
}

// Wrapper Functions supporting Transparent Firestore-to-Local Storage Failover
export async function safeGetDoc(docRef: any): Promise<any> {
  const { collectionName, docId } = parseRef(docRef);
  if (!docId) throw new Error("Document ID missing");

  try {
    const snap = await fsGetDoc(docRef);
    return snap;
  } catch (error: any) {
    if (shouldFallback(error)) {
      console.warn(`Firestore unavailable/denied on getDoc ${collectionName}/${docId}. Falling back to localStorage.`);
      const localData = localDb.getDoc(collectionName, docId);
      return {
        exists: () => localData !== null,
        data: () => localData,
        id: docId
      };
    }
    throw error;
  }
}

export async function safeSetDoc(docRef: any, data: any, options?: any): Promise<void> {
  const { collectionName, docId } = parseRef(docRef);
  if (!docId) throw new Error("Document ID missing");

  try {
    await fsSetDoc(docRef, data, options);
  } catch (error: any) {
    if (shouldFallback(error)) {
      console.warn(`Firestore unavailable/denied on setDoc ${collectionName}/${docId}. Falling back to localStorage.`);
      localDb.setDoc(collectionName, docId, data);
      return;
    }
    throw error;
  }
}

export async function safeUpdateDoc(docRef: any, data: any): Promise<void> {
  const { collectionName, docId } = parseRef(docRef);
  if (!docId) throw new Error("Document ID missing");

  try {
    await fsUpdateDoc(docRef, data);
  } catch (error: any) {
    if (shouldFallback(error)) {
      console.warn(`Firestore unavailable/denied on updateDoc ${collectionName}/${docId}. Falling back to localStorage.`);
      localDb.updateDoc(collectionName, docId, data);
      return;
    }
    throw error;
  }
}

export async function safeAddDoc(colRef: any, data: any): Promise<any> {
  const collectionName = colRef._path?.segments[0] || colRef.path || '';

  try {
    const docRef = await fsAddDoc(colRef, data);
    return docRef;
  } catch (error: any) {
    if (shouldFallback(error)) {
      console.warn(`Firestore unavailable/denied on addDoc to collection ${collectionName}. Falling back to localStorage.`);
      const newId = localDb.addDoc(collectionName, data);
      return { id: newId };
    }
    throw error;
  }
}

export async function safeDeleteDoc(docRef: any): Promise<void> {
  const { collectionName, docId } = parseRef(docRef);
  if (!docId) throw new Error("Document ID missing");

  try {
    await fsDeleteDoc(docRef);
  } catch (error: any) {
    if (shouldFallback(error)) {
      console.warn(`Firestore unavailable/denied on deleteDoc ${collectionName}/${docId}. Falling back to localStorage.`);
      localDb.deleteDoc(collectionName, docId);
      return;
    }
    throw error;
  }
}

export async function safeGetDocs(queryOrCol: any): Promise<any> {
  // Extract collection name from query/col
  const collectionName = queryOrCol._query?.path?.segments[0] || queryOrCol.path || queryOrCol._path?.segments[0] || '';
  
  try {
    const snap = await fsGetDocs(queryOrCol);
    return snap;
  } catch (error: any) {
    if (shouldFallback(error)) {
      console.warn(`Firestore unavailable/denied on getDocs for collection ${collectionName}. Falling back to localStorage.`);
      let localData = localDb.get(collectionName);
      localData = filterLocalItems(collectionName, localData, queryOrCol);
      
      return {
        empty: localData.length === 0,
        docs: localData.map(item => ({
          id: item.uid || item.id,
          data: () => item
        })),
        forEach: (callback: (doc: any) => void) => {
          localData.forEach(item => {
            callback({
              id: item.uid || item.id,
              data: () => item
            });
          });
        }
      };
    }
    throw error;
  }
}

export function safeOnSnapshot(
  queryOrColOrDoc: any, 
  onNext: (snapshot: any) => void, 
  onError?: (error: Error) => void
): () => void {
  // Parse collection or document info
  const pathSegments = queryOrColOrDoc._query?.path?.segments || queryOrColOrDoc._path?.segments || queryOrColOrDoc.path?.split('/') || [];
  const collectionName = pathSegments[0] || '';
  const docId = pathSegments[1] || null;

  try {
    // Attempt standard Firebase listener
    return fsOnSnapshot(queryOrColOrDoc, onNext, (error: any) => {
      if (shouldFallback(error)) {
        console.warn(`Firestore unavailable/denied on onSnapshot for ${collectionName}. Redirecting to localStorage listener.`);
        
        // Trigger initial emission from Local Storage fallback
        triggerLocalSnapshot();

        // Subscribe to local database updates
        const unsubscribe = localEmitter.subscribe(collectionName, () => {
          triggerLocalSnapshot();
        });

        return unsubscribe;
      } else {
        if (onError) onError(error);
      }
    });
  } catch (error: any) {
    console.error("onSnapshot initial setup error: ", error);
    if (onError) onError(error);
    return () => {};
  }

  function triggerLocalSnapshot() {
    if (docId) {
      // Document Snapshot
      const item = localDb.getDoc(collectionName, docId);
      onNext({
        exists: () => item !== null,
        data: () => item,
        id: docId
      });
    } else {
      // Collection/Query Snapshot
      let items = localDb.get(collectionName);
      items = filterLocalItems(collectionName, items, queryOrColOrDoc);
      
      // Sort messages by createdAt
      if (collectionName === 'messages') {
        items = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      onNext({
        empty: items.length === 0,
        docs: items.map((item: any) => ({
          id: item.uid || item.id,
          data: () => item
        })),
        forEach: (callback: (doc: any) => void) => {
          items.forEach((item: any) => {
            callback({
              id: item.uid || item.id,
              data: () => item
            });
          });
        }
      });
    }
  }
}
