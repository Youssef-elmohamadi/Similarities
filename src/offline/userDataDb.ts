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
  baseSurahId?: number;
  baseSurahNameArabic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CachedCollectionDetail extends CachedCollection {
  items: any[];
  comparisons: any[];
  connections: any[];
  notes: any[];
  verses?: any[];
}

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'DEAD' | 'CONFLICT';

export interface OutboxOperation {
  id: string; // Unique idempotency key / operation ID
  userId: string;
  type:
    | 'CREATE_COLLECTION'
    | 'UPDATE_COLLECTION'
    | 'DELETE_COLLECTION'
    | 'ADD_VERSE'
    | 'REMOVE_VERSE'
    | 'SAVE_NOTE'
    | 'CREATE_COMPARISON'
    | 'DELETE_COMPARISON'
    | 'ADD_DIFFERENCE'
    | 'DELETE_DIFFERENCE'
    | 'CREATE_CONNECTION'
    | 'UPDATE_CONNECTION'
    | 'DELETE_CONNECTION'
    | 'REORDER_CONNECTIONS'
    | 'CREATE_NOTE'
    | 'UPDATE_NOTE'
    | 'DELETE_NOTE'
    | 'REORDER_VERSES';
  entityId: string; // Target collection / note ID
  payload: any;
  timestamp: number;
  baseUpdatedAt?: string;
  status?: OutboxStatus;
  attempts?: number;
  lastError?: string;
  lastStatusCode?: number;
  nextRetryAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface TombstoneRecord {
  entityId: string;
  userId: string;
  entityType: 'collection' | 'comparison' | 'difference' | 'connection' | 'note' | 'verse';
  deletedAt: number;
}

export interface TempIdMapping {
  tempId: string;
  serverId: string;
  userId: string;
  createdAt: number;
}

export interface CachedChatConversation {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  isArchived: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CachedChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCallsJson?: string;
  proposalsJson?: string;
  tokenCount: number;
  createdAt: string;
}

interface UserDBSchema extends DBSchema {
  collections: {
    key: string; // id
    value: CachedCollection;
    indexes: {
      'by-user': string;
      'by-user-updated': [string, string];
    };
  };
  collectionDetails: {
    key: string; // collectionId
    value: CachedCollectionDetail;
    indexes: { 'by-user': string };
  };
  outbox: {
    key: string; // operation id (idempotency key)
    value: OutboxOperation;
    indexes: { 'by-user': string; 'by-timestamp': number; 'by-status': string; 'by-entity': string };
  };
  tombstones: {
    key: string; // entityId
    value: TombstoneRecord;
    indexes: { 'by-user': string };
  };
  tempIdMappings: {
    key: string; // tempId
    value: TempIdMapping;
    indexes: { 'by-user': string };
  };
  chatConversations: {
    key: string; // id
    value: CachedChatConversation;
    indexes: {
      'by-user': string;
      'by-user-updated': [string, string];
    };
  };
  chatMessages: {
    key: string; // id
    value: CachedChatMessage;
    indexes: {
      'by-user': string;
      'by-conversation': string;
      'by-created': string;
    };
  };
}

const USER_DB_NAME = 'QuranUserOfflineDB';
const USER_DB_VERSION = 4;

let userDbPromise: Promise<IDBPDatabase<UserDBSchema>> | null = null;

export function getUserDB(): Promise<IDBPDatabase<UserDBSchema>> {
  if (!userDbPromise) {
    userDbPromise = openDB<UserDBSchema>(USER_DB_NAME, USER_DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('collections')) {
          const s = db.createObjectStore('collections', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
          s.createIndex('by-user-updated', ['userId', 'updatedAt']);
        } else {
          const collStore = transaction.objectStore('collections');
          if (!collStore.indexNames.contains('by-user-updated')) {
            collStore.createIndex('by-user-updated', ['userId', 'updatedAt']);
          }
        }
        if (!db.objectStoreNames.contains('collectionDetails')) {
          const s = db.createObjectStore('collectionDetails', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const s = db.createObjectStore('outbox', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
          s.createIndex('by-timestamp', 'timestamp');
          s.createIndex('by-status', 'status');
          s.createIndex('by-entity', 'entityId');
        } else {
          const outboxStore = transaction.objectStore('outbox');
          if (!outboxStore.indexNames.contains('by-status')) {
            outboxStore.createIndex('by-status', 'status');
          }
          if (!outboxStore.indexNames.contains('by-entity')) {
            outboxStore.createIndex('by-entity', 'entityId');
          }
        }
        if (!db.objectStoreNames.contains('tombstones')) {
          const s = db.createObjectStore('tombstones', { keyPath: 'entityId' });
          s.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('tempIdMappings')) {
          const s = db.createObjectStore('tempIdMappings', { keyPath: 'tempId' });
          s.createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('chatConversations')) {
          const s = db.createObjectStore('chatConversations', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
          s.createIndex('by-user-updated', ['userId', 'updatedAt']);
        }
        if (!db.objectStoreNames.contains('chatMessages')) {
          const s = db.createObjectStore('chatMessages', { keyPath: 'id' });
          s.createIndex('by-user', 'userId');
          s.createIndex('by-conversation', 'conversationId');
          s.createIndex('by-created', 'createdAt');
        }
      },
    });
  }
  return userDbPromise;
}

// ---------------------------------------------------------------------------
// In-Memory L1 Cache & Batched Asynchronous Write-Through Store
// ---------------------------------------------------------------------------
export class UserDataMemoryStore {
  private collectionsByUser = new Map<string, CachedCollection[]>();
  private collectionDetails = new Map<string, CachedCollectionDetail>();
  private pendingDetailWrites = new Map<string, CachedCollectionDetail>();
  private pendingDeletes = new Set<string>();
  private flushScheduled = false;

  public getCollectionsSync(userId: string): CachedCollection[] | null {
    return this.collectionsByUser.get(userId) || null;
  }

  public setCollectionsSync(userId: string, collections: CachedCollection[]): void {
    this.collectionsByUser.set(userId, [...collections]);
  }

  public getCollectionDetailSync(collectionId: string): CachedCollectionDetail | null {
    return this.collectionDetails.get(collectionId) || null;
  }

  public setCollectionDetailSync(userId: string, detail: CachedCollectionDetail): void {
    const copy = { ...detail, userId };
    this.collectionDetails.set(detail.id, copy);

    // Synchronously update summary in collections list
    const userList = this.collectionsByUser.get(userId);
    if (userList) {
      const idx = userList.findIndex(c => c.id === detail.id);
      const summary: CachedCollection = {
        id: detail.id,
        userId: detail.userId || userId,
        title: detail.title,
        description: detail.description,
        color: detail.color,
        isFavorite: detail.isFavorite,
        itemCount: detail.itemCount ?? (detail.items ? detail.items.length : 0),
        tags: detail.tags,
        baseSurahId: detail.baseSurahId,
        baseSurahNameArabic: detail.baseSurahNameArabic,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
      };
      if (idx >= 0) {
        userList[idx] = summary;
      } else {
        userList.unshift(summary);
      }
    }

    this.pendingDetailWrites.set(detail.id, copy);
    this.scheduleBatchWrite();
  }

  public deleteCollectionSync(userId: string, collectionId: string): void {
    this.collectionDetails.delete(collectionId);
    const userList = this.collectionsByUser.get(userId);
    if (userList) {
      this.collectionsByUser.set(userId, userList.filter(c => c.id !== collectionId));
    }
    this.pendingDetailWrites.delete(collectionId);
    this.pendingDeletes.add(collectionId);
    this.scheduleBatchWrite();
  }

  public remapCollectionIdSync(userId: string, tempId: string, serverId: string, serverRecord?: any): void {
    const detail = this.collectionDetails.get(tempId);
    if (detail) {
      this.collectionDetails.delete(tempId);
      this.collectionDetails.set(serverId, {
        ...(serverRecord || detail),
        id: serverId,
        userId,
      });
    }
    const userList = this.collectionsByUser.get(userId);
    if (userList) {
      const idx = userList.findIndex(c => c.id === tempId);
      if (idx >= 0) {
        userList[idx] = {
          ...(serverRecord || userList[idx]),
          id: serverId,
          userId,
        };
      }
    }
    if (this.pendingDetailWrites.has(tempId)) {
      const p = this.pendingDetailWrites.get(tempId)!;
      this.pendingDetailWrites.delete(tempId);
      this.pendingDetailWrites.set(serverId, {
        ...p,
        id: serverId,
      });
    }
  }

  private scheduleBatchWrite(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;

    const flush = async () => {
      this.flushScheduled = false;
      try {
        const db = await getUserDB();
        const tx = db.transaction(['collections', 'collectionDetails'], 'readwrite');

        for (const id of this.pendingDeletes) {
          await tx.objectStore('collections').delete(id);
          await tx.objectStore('collectionDetails').delete(id);
        }
        this.pendingDeletes.clear();

        for (const [id, detail] of this.pendingDetailWrites.entries()) {
          await tx.objectStore('collectionDetails').put(detail);
          const summary: CachedCollection = {
            id: detail.id,
            userId: detail.userId,
            title: detail.title,
            description: detail.description,
            color: detail.color,
            isFavorite: detail.isFavorite,
            itemCount: detail.itemCount ?? (detail.items ? detail.items.length : 0),
            tags: detail.tags,
            baseSurahId: detail.baseSurahId,
            baseSurahNameArabic: detail.baseSurahNameArabic,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
          };
          await tx.objectStore('collections').put(summary);
        }
        this.pendingDetailWrites.clear();

        await tx.done;
      } catch (err) {
        console.warn('Background batch write-through to IndexedDB failed:', err);
      }
    };

    if (typeof queueMicrotask !== 'undefined') {
      queueMicrotask(flush);
    } else {
      setTimeout(flush, 0);
    }
  }

  public clear(): void {
    this.collectionsByUser.clear();
    this.collectionDetails.clear();
    this.pendingDetailWrites.clear();
    this.pendingDeletes.clear();
  }
}

export const userDataMemoryStore = new UserDataMemoryStore();

// ---------------------------------------------------------------------------
// 1. Tombstone Management
// ---------------------------------------------------------------------------
export async function addTombstone(
  userId: string,
  entityId: string,
  entityType: TombstoneRecord['entityType'] = 'collection'
): Promise<void> {
  userDataMemoryStore.deleteCollectionSync(userId, entityId);
  const db = await getUserDB();
  await db.put('tombstones', {
    entityId,
    userId,
    entityType,
    deletedAt: Date.now(),
  });
}

export async function removeTombstone(entityId: string): Promise<void> {
  const db = await getUserDB();
  await db.delete('tombstones', entityId);
}

export async function isTombstoned(userId: string, entityId: string): Promise<boolean> {
  const db = await getUserDB();
  const item = await db.get('tombstones', entityId);
  return !!item && item.userId === userId;
}

export async function getTombstonedEntityIds(userId: string): Promise<Set<string>> {
  const db = await getUserDB();
  const all = await db.getAllFromIndex('tombstones', 'by-user', userId);
  return new Set(all.map(t => t.entityId));
}

// ---------------------------------------------------------------------------
// 2. Temp-ID Mapping Management
// ---------------------------------------------------------------------------
export async function saveTempIdMapping(userId: string, tempId: string, serverId: string): Promise<void> {
  const db = await getUserDB();
  await db.put('tempIdMappings', {
    tempId,
    serverId,
    userId,
    createdAt: Date.now(),
  });
}

export async function getResolvedEntityId(userId: string, id: string): Promise<string> {
  if (!id || !id.startsWith('temp-')) return id;
  const db = await getUserDB();
  const mapping = await db.get('tempIdMappings', id);
  if (mapping && mapping.userId === userId) {
    return mapping.serverId;
  }
  return id;
}

export async function remapOutboxEntityIds(userId: string, tempId: string, serverId: string): Promise<void> {
  const db = await getUserDB();
  const tx = db.transaction('outbox', 'readwrite');
  const ops = await tx.store.index('by-user').getAll(userId);
  for (const op of ops) {
    let changed = false;
    if (op.entityId === tempId) {
      op.entityId = serverId;
      changed = true;
    }
    if (op.payload && typeof op.payload === 'object') {
      if (op.payload.collectionId === tempId) {
        op.payload.collectionId = serverId;
        changed = true;
      }
      if (op.payload.tempId === tempId) {
        op.payload.tempId = serverId;
        changed = true;
      }
    }
    if (changed) {
      op.updatedAt = Date.now();
      await tx.store.put(op);
    }
  }
  await tx.done;
}

export async function remapLocalCollectionId(
  userId: string,
  tempId: string,
  serverId: string,
  serverRecord?: any
): Promise<void> {
  userDataMemoryStore.remapCollectionIdSync(userId, tempId, serverId, serverRecord);
  const db = await getUserDB();

  // 1. Collections store
  const coll = await db.get('collections', tempId);
  if (coll) {
    await db.delete('collections', tempId);
    await db.put('collections', {
      ...(serverRecord || coll),
      id: serverId,
      userId,
    });
  }

  // 2. CollectionDetails store
  const detail = await db.get('collectionDetails', tempId);
  if (detail) {
    await db.delete('collectionDetails', tempId);
    await db.put('collectionDetails', {
      ...(serverRecord || detail),
      id: serverId,
      userId,
    });
  }
}

export async function removeStaleLocalEntity(userId: string, entityId: string): Promise<void> {
  userDataMemoryStore.deleteCollectionSync(userId, entityId);
  const db = await getUserDB();
  await db.delete('collections', entityId);
  await db.delete('collectionDetails', entityId);
}

// ---------------------------------------------------------------------------
// 3. Cached Collections (Tombstone-Aware with In-Memory Acceleration)
// ---------------------------------------------------------------------------
export async function getCachedUserCollections(userId: string): Promise<CachedCollection[]> {
  const tombstones = await getTombstonedEntityIds(userId);
  const inMem = userDataMemoryStore.getCollectionsSync(userId);
  if (inMem) {
    return inMem
      .filter(c => !tombstones.has(c.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const db = await getUserDB();
  const all = await db.getAllFromIndex('collections', 'by-user', userId);
  const valid = all
    .filter(c => !tombstones.has(c.id))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  userDataMemoryStore.setCollectionsSync(userId, valid);
  return valid;
}

export async function setCachedUserCollections(userId: string, collections: any[]): Promise<void> {
  const tombstones = await getTombstonedEntityIds(userId);
  const valid: CachedCollection[] = [];
  for (const c of collections) {
    if (!tombstones.has(c.id)) {
      valid.push({ ...c, userId });
    }
  }

  userDataMemoryStore.setCollectionsSync(userId, valid);

  const db = await getUserDB();
  const tx = db.transaction('collections', 'readwrite');
  for (const c of valid) {
    await tx.store.put(c);
  }
  await tx.done;
}

export async function getCachedCollectionDetail(userId: string, collectionId: string): Promise<CachedCollectionDetail | null> {
  const inMem = userDataMemoryStore.getCollectionDetailSync(collectionId);
  if (inMem && inMem.userId === userId) {
    return inMem;
  }

  const db = await getUserDB();
  const tombstones = await getTombstonedEntityIds(userId);
  if (tombstones.has(collectionId)) {
    return null;
  }
  const detail = await db.get('collectionDetails', collectionId);
  if (detail && detail.userId === userId) {
    userDataMemoryStore.setCollectionDetailSync(userId, detail);
    return detail;
  }
  return null;
}

export async function setCachedCollectionDetail(userId: string, detail: any): Promise<void> {
  const tombstones = await getTombstonedEntityIds(userId);
  if (tombstones.has(detail.id)) {
    return;
  }
  userDataMemoryStore.setCollectionDetailSync(userId, detail);
}

// ---------------------------------------------------------------------------
// 4. Outbox Queue Management & Coalescing
// ---------------------------------------------------------------------------
export async function enqueueOutboxOperation(op: OutboxOperation): Promise<{ coalesced: boolean }> {
  const db = await getUserDB();
  const now = Date.now();
  op.attempts = op.attempts ?? 0;
  op.status = op.status ?? 'PENDING';
  op.timestamp = op.timestamp ?? now;
  op.createdAt = op.createdAt ?? now;
  op.updatedAt = now;

  // Requirement 4 & 5: Coalesce operations & Store Tombstones
  if (op.type === 'DELETE_COLLECTION') {
    await addTombstone(op.userId, op.entityId, 'collection');

    const tx = db.transaction('outbox', 'readwrite');
    const userOps = await tx.store.index('by-user').getAll(op.userId);

    const isTemp = op.entityId.startsWith('temp-');
    const createOp = userOps.find(o => o.entityId === op.entityId && o.type === 'CREATE_COLLECTION');

    if (createOp || isTemp) {
      // Create + Delete on temp-id cancels both without network call
      for (const o of userOps) {
        if (o.entityId === op.entityId) {
          await tx.store.delete(o.id);
        }
      }
      await tx.done;
      await removeStaleLocalEntity(op.userId, op.entityId);
      await removeTombstone(op.entityId);
      return { coalesced: true };
    }

    // Delete supersedes pending updates for this entity
    for (const o of userOps) {
      if (
        o.entityId === op.entityId &&
        (o.type === 'UPDATE_COLLECTION' || o.type.startsWith('ADD_') || o.type.startsWith('SAVE_'))
      ) {
        await tx.store.delete(o.id);
      }
    }
    await tx.store.put(op);
    await tx.done;
    return { coalesced: false };
  }

  if (op.type === 'UPDATE_COLLECTION') {
    const tx = db.transaction('outbox', 'readwrite');
    const userOps = await tx.store.index('by-user').getAll(op.userId);
    const existingUpdate = userOps.find(
      o => o.entityId === op.entityId && o.type === 'UPDATE_COLLECTION' && o.status !== 'SYNCING'
    );
    if (existingUpdate) {
      // Multiple updates collapse into latest
      existingUpdate.payload = { ...existingUpdate.payload, ...op.payload };
      existingUpdate.timestamp = op.timestamp;
      existingUpdate.updatedAt = now;
      existingUpdate.baseUpdatedAt = op.baseUpdatedAt || existingUpdate.baseUpdatedAt;
      existingUpdate.status = 'PENDING';
      existingUpdate.nextRetryAt = undefined;
      await tx.store.put(existingUpdate);
      await tx.done;
      return { coalesced: true };
    }
    await tx.store.put(op);
    await tx.done;
    return { coalesced: false };
  }

  await db.put('outbox', op);
  return { coalesced: false };
}

export async function getPendingOutboxOperations(userId: string): Promise<OutboxOperation[]> {
  const db = await getUserDB();
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  return ops
    .filter(o => o.status !== 'DEAD')
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getAllOutboxOperations(userId: string): Promise<OutboxOperation[]> {
  const db = await getUserDB();
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  return ops.sort((a, b) => a.timestamp - b.timestamp);
}

export async function updateOutboxOperation(op: OutboxOperation): Promise<void> {
  const db = await getUserDB();
  op.updatedAt = Date.now();
  await db.put('outbox', op);
}

export async function removeOutboxOperation(opId: string): Promise<void> {
  const db = await getUserDB();
  await db.delete('outbox', opId);
}

export async function retryOutboxOperation(opId: string): Promise<void> {
  const db = await getUserDB();
  const op = await db.get('outbox', opId);
  if (op) {
    op.status = 'PENDING';
    op.attempts = 0;
    op.lastError = undefined;
    op.lastStatusCode = undefined;
    op.nextRetryAt = undefined;
    op.updatedAt = Date.now();
    await db.put('outbox', op);
  }
}

export async function discardOutboxOperation(opId: string): Promise<void> {
  const db = await getUserDB();
  await db.delete('outbox', opId);
}

export async function getOutboxStats(
  userId: string
): Promise<{ pending: number; failed: number; dead: number; total: number }> {
  const db = await getUserDB();
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  let pending = 0;
  let failed = 0;
  let dead = 0;
  for (const op of ops) {
    if (op.status === 'DEAD') dead++;
    else if (op.status === 'FAILED' || op.status === 'CONFLICT') failed++;
    else pending++;
  }
  return { pending, failed, dead, total: ops.length };
}

// ---------------------------------------------------------------------------
// 5. Data Export & Reset (Never Lose User Text)
// ---------------------------------------------------------------------------
export async function exportUnsyncedData(userId: string): Promise<string> {
  const db = await getUserDB();
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  const collections = await db.getAllFromIndex('collections', 'by-user', userId);
  const details = await db.getAllFromIndex('collectionDetails', 'by-user', userId);

  const backup = {
    exportedAt: new Date().toISOString(),
    userId,
    unsyncedOutboxOperations: ops,
    cachedCollections: collections,
    cachedCollectionDetails: details,
  };
  return JSON.stringify(backup, null, 2);
}

export async function resetLocalCache(userId: string): Promise<void> {
  const db = await getUserDB();

  // Clear collections and details for this user
  const colls = await db.getAllFromIndex('collections', 'by-user', userId);
  const tx1 = db.transaction('collections', 'readwrite');
  for (const c of colls) {
    await tx1.store.delete(c.id);
  }
  await tx1.done;

  const details = await db.getAllFromIndex('collectionDetails', 'by-user', userId);
  const tx2 = db.transaction('collectionDetails', 'readwrite');
  for (const d of details) {
    await tx2.store.delete(d.id);
  }
  await tx2.done;
}

// ---------------------------------------------------------------------------
// 6. User Isolation & Logout Wipe
// ---------------------------------------------------------------------------
export async function wipeUserDataOnLogout(userId: string): Promise<void> {
  userDataMemoryStore.clear();
  const db = await getUserDB();

  // 1. Collections
  const colls = await db.getAllFromIndex('collections', 'by-user', userId);
  const tx1 = db.transaction('collections', 'readwrite');
  for (const c of colls) {
    await tx1.store.delete(c.id);
  }
  await tx1.done;

  // 2. Collection details
  const details = await db.getAllFromIndex('collectionDetails', 'by-user', userId);
  const tx2 = db.transaction('collectionDetails', 'readwrite');
  for (const d of details) {
    await tx2.store.delete(d.id);
  }
  await tx2.done;

  // 3. Outbox
  const ops = await db.getAllFromIndex('outbox', 'by-user', userId);
  const tx3 = db.transaction('outbox', 'readwrite');
  for (const op of ops) {
    await tx3.store.delete(op.id);
  }
  await tx3.done;

  // 4. Tombstones
  const tombstones = await db.getAllFromIndex('tombstones', 'by-user', userId);
  const tx4 = db.transaction('tombstones', 'readwrite');
  for (const t of tombstones) {
    await tx4.store.delete(t.entityId);
  }
  await tx4.done;

  // 5. Temp-ID mappings
  const mappings = await db.getAllFromIndex('tempIdMappings', 'by-user', userId);
  const tx5 = db.transaction('tempIdMappings', 'readwrite');
  for (const m of mappings) {
    await tx5.store.delete(m.tempId);
  }
  await tx5.done;

  // 6. Chat Conversations
  try {
    const convs = await db.getAllFromIndex('chatConversations', 'by-user', userId);
    const tx6 = db.transaction('chatConversations', 'readwrite');
    for (const c of convs) {
      await tx6.store.delete(c.id);
    }
    await tx6.done;
  } catch (err) {
    console.warn('Failed to wipe chat conversations on logout:', err);
  }

  // 7. Chat Messages
  try {
    const msgs = await db.getAllFromIndex('chatMessages', 'by-user', userId);
    const tx7 = db.transaction('chatMessages', 'readwrite');
    for (const m of msgs) {
      await tx7.store.delete(m.id);
    }
    await tx7.done;
  } catch (err) {
    console.warn('Failed to wipe chat messages on logout:', err);
  }
}

// ---------------------------------------------------------------------------
// 7. Chat History Offline Persistence
// ---------------------------------------------------------------------------
export async function saveChatConversationsToCache(
  userId: string,
  convs: Array<Partial<CachedChatConversation> & { id: string; title: string; createdAt: string; updatedAt: string }>
): Promise<void> {
  try {
    const db = await getUserDB();
    const tx = db.transaction('chatConversations', 'readwrite');
    for (const c of convs) {
      await tx.store.put({
        id: c.id,
        userId,
        title: c.title,
        summary: c.summary,
        isArchived: Boolean(c.isArchived),
        messageCount: c.messageCount ?? 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
    }
    await tx.done;
  } catch (err) {
    console.warn('Failed to cache chat conversations:', err);
  }
}

export async function getCachedChatConversations(userId: string): Promise<CachedChatConversation[]> {
  try {
    const db = await getUserDB();
    const convs = await db.getAllFromIndex('chatConversations', 'by-user', userId);
    return convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.warn('Failed to retrieve cached chat conversations:', err);
    return [];
  }
}

export async function deleteCachedChatConversation(userId: string, conversationId: string): Promise<void> {
  try {
    const db = await getUserDB();
    const tx1 = db.transaction('chatConversations', 'readwrite');
    await tx1.store.delete(conversationId);
    await tx1.done;

    const msgs = await db.getAllFromIndex('chatMessages', 'by-conversation', conversationId);
    const tx2 = db.transaction('chatMessages', 'readwrite');
    for (const m of msgs) {
      await tx2.store.delete(m.id);
    }
    await tx2.done;
  } catch (err) {
    console.warn('Failed to delete cached conversation:', err);
  }
}

export async function saveChatMessagesToCache(
  userId: string,
  conversationId: string,
  messages: Array<Partial<CachedChatMessage> & { id: string; role: any; content: string; createdAt: string }>
): Promise<void> {
  try {
    const db = await getUserDB();
    const tx = db.transaction('chatMessages', 'readwrite');
    for (const m of messages) {
      await tx.store.put({
        id: m.id,
        conversationId,
        userId,
        role: m.role || 'user',
        content: m.content || '',
        toolCallsJson: m.toolCallsJson,
        proposalsJson: m.proposalsJson,
        tokenCount: m.tokenCount ?? 0,
        createdAt: m.createdAt,
      });
    }
    await tx.done;
  } catch (err) {
    console.warn('Failed to cache chat messages:', err);
  }
}

export async function getCachedChatMessages(conversationId: string): Promise<CachedChatMessage[]> {
  try {
    const db = await getUserDB();
    const msgs = await db.getAllFromIndex('chatMessages', 'by-conversation', conversationId);
    return msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (err) {
    console.warn('Failed to retrieve cached chat messages:', err);
    return [];
  }
}
