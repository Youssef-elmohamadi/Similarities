import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface CachedCollection {
  id: string; // server GUID or temp UUID
  userId: string;
  title: string;
  description?: string;
  color?: string;
  isFavorite: boolean;
  itemCount: number;
  tags?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedCollectionDetail extends CachedCollection {
  items: any[];
  comparisons: any[];
  connections: any[];
  notes: any[];
}

export interface OutboxOperation {
  id: string; // Unique idempotency key / operation ID
  userId: string;
  type: 'CREATE_COLLECTION' | 'UPDATE_COLLECTION' | 'DELETE_COLLECTION' | 'ADD_VERSE' | 'REMOVE_VERSE' | 'SAVE_NOTE';
  entityId: string; // Target collection / note ID
  payload: any;
  timestamp: number;
  baseUpdatedAt?: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
  errorMessage?: string;
}

interface UserDBSchema extends DBSchema {
  collections: {
    key: string; // id
    value: CachedCollection;
    indexes: { 'by-user': string };
  };
  collectionDetails: {
    key: string; // collectionId
    value: CachedCollectionDetail;
    indexes: { 'by-user': string };
  };
  outbox: {
    key: string; // operation id (idempotency key)
    value: OutboxOperation;
    indexes: { 'by-user': string; 'by-timestamp': number };
  };
}

const USER_DB_NAME = 'QuranUserOfflineDB';
const USER_DB_VERSION = 1;

let userDbPromise: Promise<IDBPDatabase<UserDBSchema>> | null = null;

export function getUserDB(): Promise<IDBPDatabase<UserDBSchema>> {
  if (!userDbPromise) {
    userDbPromise = openDB<UserDBSchema>(USER_DB_NAME, USER_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('collections')) {
          const s = db.createObjectStore('collections', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('collectionDetails')) {
          const s = db.createObjectStore('collectionDetails', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const s = db.createObjectStore('outbox', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
          s.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return userDbPromise;
}

// 1. Isolation & Cache per user
export async function getCachedUserCollections(userId: string): Promise<CachedCollection[]> {
  const db = await getUserDB();
  const all = await db.getAllFromIndex('collections', 'by-user', userId);
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function setCachedUserCollections(userId: string, collections: any[]): Promise<void> {
  const db = await getUserDB();
  const tx = db.transaction('collections', 'readwrite');
  for (const c of collections) {
    await tx.store.put({ ...c, userId });
  }
  await tx.done;
}

export async function getCachedCollectionDetail(userId: string, collectionId: string): Promise<CachedCollectionDetail | null> {
  const db = await getUserDB();
  const detail = await db.get('collectionDetails', collectionId);
  if (detail && detail.userId === userId) {
    return detail;
  }
  return null;
}

export async function setCachedCollectionDetail(userId: string, detail: any): Promise<void> {
  const db = await getUserDB();
  await db.put('collectionDetails', { ...detail, userId });
}

// 2. Outbox Queue management
export async function enqueueOutboxOperation(op: OutboxOperation): Promise<void> {
  const db = await getUserDB();
  await db.put('outbox', op);
}

export async function getPendingOutboxOperations(userId: string): Promise<OutboxOperation[]> {
  const db = await getUserDB();
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  return ops.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeOutboxOperation(opId: string): Promise<void> {
  const db = await getUserDB();
  await db.delete('outbox', opId);
}

// 3. User Isolation & Logout Wipe
export async function wipeUserDataOnLogout(userId: string): Promise<void> {
  const db = await getUserDB();

  // Remove all collections for this user
  const colls = await db.getAllFromIndex('collections', 'by-user', userId);
  const tx1 = db.transaction('collections', 'readwrite');
  for (const c of colls) {
    await tx1.store.delete(c.id);
  }
  await tx1.done;

  // Remove collection details
  const details = await db.getAllFromIndex('collectionDetails', 'by-user', userId);
  const tx2 = db.transaction('collectionDetails', 'readwrite');
  for (const d of details) {
    await tx2.store.delete(d.id);
  }
  await tx2.done;

  // Remove outbox operations
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  const tx3 = db.transaction('outbox', 'readwrite');
  for (const op of ops) {
    await tx3.store.delete(op.id);
  }
  await tx3.done;
}

