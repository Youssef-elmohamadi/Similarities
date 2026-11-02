import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Ensure window.navigator.onLine is available in Node test runner
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { navigator: { onLine: true } };
} else if (!(globalThis as any).window.navigator) {
  (globalThis as any).window.navigator = { onLine: true };
}

import {
  getUserDB,
  enqueueOutboxOperation,
  getPendingOutboxOperations,
  getAllOutboxOperations,
  setCachedUserCollections,
  getCachedUserCollections,
  setCachedCollectionDetail,
  getCachedCollectionDetail,
  addTombstone,
  isTombstoned,
  wipeUserDataOnLogout,
  exportUnsyncedData,
  resetLocalCache,
  OutboxOperation,
} from './userDataDb';
import { outboxSyncManager } from './outboxSyncManager';
import { api } from '@/lib/api';

describe('Requirement 9: Outbox and Offline Sync Test Suite', () => {
  const userId = 'user-test-456';

  beforeEach(async () => {
    await wipeUserDataOnLogout(userId);
    vi.restoreAllMocks();

    // Default health check passes
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/health') return { data: { status: 'healthy' } } as any;
      return { data: {} } as any;
    });
  });

  // 1. Delete while offline then sync
  it('Scenario 1: delete while offline then sync (calls DELETE, clears outbox, removes tombstone)', async () => {
    const entityId = 'col-offline-delete-1';

    // Step A: Cache initial collection locally
    await setCachedUserCollections(userId, [{ id: entityId, title: 'My Collection' }]);
    expect(await getCachedUserCollections(userId)).toHaveLength(1);

    // Step B: User deletes while offline -> tombstone added and outbox op enqueued
    await addTombstone(userId, entityId, 'collection');
    await enqueueOutboxOperation({
      id: 'op-del-1',
      userId,
      type: 'DELETE_COLLECTION',
      entityId,
      payload: {},
      timestamp: Date.now(),
      status: 'PENDING',
    });

    // Verify local collection is tombstoned and filtered from local reads
    expect(await isTombstoned(userId, entityId)).toBe(true);
    expect(await getCachedUserCollections(userId)).toHaveLength(0);

    // Step C: Come online and sync
    const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValueOnce({ data: { success: true } } as any);

    const result = await outboxSyncManager.sync(userId);

    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(deleteSpy).toHaveBeenCalledWith(`/collections/${entityId}`, expect.any(Object));

    // Verify outbox queue is empty and tombstone removed
    const pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(0);
    expect(await isTombstoned(userId, entityId)).toBe(false);
  });

  // 2. Delete of an item already deleted on the server (404)
  it('Scenario 2: delete of an item already deleted on the server (404 is treated as success, queue does not hang)', async () => {
    const entityId = 'col-already-deleted-server';

    await addTombstone(userId, entityId, 'collection');
    await enqueueOutboxOperation({
      id: 'op-del-404',
      userId,
      type: 'DELETE_COLLECTION',
      entityId,
      payload: {},
      timestamp: Date.now(),
      status: 'PENDING',
    });

    // Mock server returning 404 Not Found for the DELETE
    vi.spyOn(api, 'delete').mockImplementation(async () => {
      const err: any = new Error('Not Found');
      err.response = { status: 404, data: { message: 'Collection does not exist' } };
      throw err;
    });

    const result = await outboxSyncManager.sync(userId);

    // Should count as synced (already gone on server), not failed or hung
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);

    // Queue must be empty, no hanging operation
    const pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(0);
    expect(await isTombstoned(userId, entityId)).toBe(false);
  });

  // 3. Create + Delete offline cancels out
  it('Scenario 3: create+delete offline of temp-id cancels both with 0 network calls', async () => {
    const tempId = 'temp-col-cancel-999';

    // Step A: Offline create
    await enqueueOutboxOperation({
      id: 'op-create-temp',
      userId,
      type: 'CREATE_COLLECTION',
      entityId: tempId,
      payload: { title: 'Temporary Collection' },
      timestamp: 1000,
      status: 'PENDING',
    });

    let pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('CREATE_COLLECTION');

    // Step B: Offline delete of the same temp ID
    await enqueueOutboxOperation({
      id: 'op-delete-temp',
      userId,
      type: 'DELETE_COLLECTION',
      entityId: tempId,
      payload: {},
      timestamp: 2000,
      status: 'PENDING',
    });

    // Coalescing in enqueueOutboxOperation must have cancelled both!
    pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(0);

    // Step C: Verify sync executes zero network calls
    const postSpy = vi.spyOn(api, 'post');
    const deleteSpy = vi.spyOn(api, 'delete');

    const result = await outboxSyncManager.sync(userId);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(0);
    expect(postSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  // 4. Multiple updates to one entity collapse into latest
  it('Scenario 4: multiple updates to one entity collapse into the latest payload', async () => {
    const entityId = 'col-existing-123';

    await enqueueOutboxOperation({
      id: 'op-up-1',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId,
      payload: { title: 'First Update', description: 'Desc 1' },
      timestamp: 1000,
      status: 'PENDING',
    });

    await enqueueOutboxOperation({
      id: 'op-up-2',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId,
      payload: { title: 'Second Update', description: 'Desc 2' },
      timestamp: 2000,
      status: 'PENDING',
    });

    const pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.title).toBe('Second Update');
    expect(pending[0].payload.description).toBe('Desc 2');
  });

  // 5. Delete supersedes pending updates
  it('Scenario 5: delete supersedes pending updates of that entity', async () => {
    const entityId = 'col-existing-456';

    await enqueueOutboxOperation({
      id: 'op-up',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId,
      payload: { title: 'Updated' },
      timestamp: 1000,
      status: 'PENDING',
    });

    await enqueueOutboxOperation({
      id: 'op-del',
      userId,
      type: 'DELETE_COLLECTION',
      entityId,
      payload: {},
      timestamp: 2000,
      status: 'PENDING',
    });

    const pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe('DELETE_COLLECTION');
  });

  // 6. A failing operation on entity A does NOT block entity B
  it('Scenario 6: failing op on entity A (500) does NOT block operations on entity B', async () => {
    const entityA = 'col-failing-A';
    const entityB = 'col-succeeding-B';

    await enqueueOutboxOperation({
      id: 'op-A',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId: entityA,
      payload: { title: 'Failing Update' },
      timestamp: 1000,
      status: 'PENDING',
    });

    await enqueueOutboxOperation({
      id: 'op-B',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId: entityB,
      payload: { title: 'Successful Update' },
      timestamp: 2000,
      status: 'PENDING',
    });

    // Mock PUT: fails for A with 500, succeeds for B with 200
    vi.spyOn(api, 'put').mockImplementation(async (url: string) => {
      if (url.includes(entityA)) {
        const err: any = new Error('Internal Server Error');
        err.response = { status: 500, data: { message: 'DB down' } };
        throw err;
      }
      return { data: { success: true } } as any;
    });

    const result = await outboxSyncManager.sync(userId);

    // A failed (1 failed), B succeeded (1 synced)
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(1);

    // Entity A operation is in FAILED status with backoff
    const allOps = await getAllOutboxOperations(userId);
    const opA = allOps.find(o => o.entityId === entityA);
    const opB = allOps.find(o => o.entityId === entityB);

    expect(opA).toBeDefined();
    expect(opA?.status).toBe('FAILED');
    expect(opA?.attempts).toBe(1);
    expect(opA?.nextRetryAt).toBeGreaterThan(Date.now());
    expect(opA?.lastStatusCode).toBe(500);

    // Entity B operation was completely synced and removed
    expect(opB).toBeUndefined();
  });

  // 7. Deleted items never reappear after reload/refetch (tombstone enforcement)
  it('Scenario 7: tombstone prevents deleted items from reappearing when server returns old list', async () => {
    const deletedId = 'col-tombstone-test';
    const activeId = 'col-active-test';

    // Step A: Tombstone the deleted collection
    await addTombstone(userId, deletedId, 'collection');

    // Step B: Set cache with both collections (simulating a refetch or stale response from server)
    await setCachedUserCollections(userId, [
      { id: deletedId, title: 'Should be suppressed' },
      { id: activeId, title: 'Active collection' },
    ]);

    // Step C: Query cached collections
    const collections = await getCachedUserCollections(userId);

    // Only activeId should be returned! deletedId is pruned by tombstone!
    expect(collections).toHaveLength(1);
    expect(collections[0].id).toBe(activeId);
  });

  // 8. Temp-ID remapping in queue and cache after create succeeds
  it('Scenario 8: temp-id remapping renames child operations in outbox and local cache', async () => {
    const tempId = 'temp-create-remap';
    const serverGuid = 'server-guid-777';

    // Step A: Enqueue CREATE_COLLECTION
    await enqueueOutboxOperation({
      id: 'op-create',
      userId,
      type: 'CREATE_COLLECTION',
      entityId: tempId,
      payload: { title: 'New Offline Collection' },
      timestamp: 1000,
      status: 'PENDING',
    });

    // Step B: Enqueue child operation on the temp ID (e.g. ADD_VERSE)
    await enqueueOutboxOperation({
      id: 'op-add-verse',
      userId,
      type: 'ADD_VERSE',
      entityId: tempId,
      payload: { surahNumber: 2, verseNumber: 255 },
      timestamp: 2000,
      status: 'PENDING',
    });

    // Cache local collection with tempId
    await setCachedUserCollections(userId, [{ id: tempId, title: 'New Offline Collection' }]);

    // Mock API post for creation returning serverGuid
    vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/collections') {
        return { data: { id: serverGuid, title: 'New Offline Collection' } } as any;
      }
      return { data: { success: true } } as any;
    });

    const result = await outboxSyncManager.sync(userId);
    expect(result.synced).toBe(2);

    // Check local collections cache: ID should now be serverGuid!
    const cached = await getCachedUserCollections(userId);
    expect(cached).toHaveLength(1);
    expect(cached[0].id).toBe(serverGuid);
  });

  // 9. Logout wipes the outbox and all local stores
  it('Scenario 9: logout wipes outbox, collections, tombstones, and mappings', async () => {
    await enqueueOutboxOperation({
      id: 'op-logout-test',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId: 'col-logout',
      payload: { title: 'Pending edit' },
      timestamp: 1000,
      status: 'PENDING',
    });
    await addTombstone(userId, 'col-tombstone', 'collection');
    await setCachedUserCollections(userId, [{ id: 'col-cached', title: 'Cached' }]);

    // Verify data exists
    expect((await getAllOutboxOperations(userId)).length).toBeGreaterThan(0);
    expect(await isTombstoned(userId, 'col-tombstone')).toBe(true);
    expect((await getCachedUserCollections(userId)).length).toBeGreaterThan(0);

    // Logout wipe
    await wipeUserDataOnLogout(userId);

    // All stores must be cleared
    expect(await getAllOutboxOperations(userId)).toHaveLength(0);
    expect(await isTombstoned(userId, 'col-tombstone')).toBe(false);
    expect(await getCachedUserCollections(userId)).toHaveLength(0);
  });

  // 10. Status handling: 404 on UPDATE marks DEAD and removes local copy
  it('Scenario 10: 404 on UPDATE marks op as DEAD and purges stale local copy', async () => {
    const entityId = 'col-ghost-update';

    await setCachedUserCollections(userId, [{ id: entityId, title: 'Ghost collection' }]);
    await enqueueOutboxOperation({
      id: 'op-ghost',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId,
      payload: { title: 'Attempt Update' },
      timestamp: 1000,
      status: 'PENDING',
    });

    vi.spyOn(api, 'put').mockImplementation(async () => {
      const err: any = new Error('Not Found');
      err.response = { status: 404, data: { message: 'Entity deleted on server' } };
      throw err;
    });

    const result = await outboxSyncManager.sync(userId);
    expect(result.failed).toBe(1);

    const allOps = await getAllOutboxOperations(userId);
    const op = allOps.find(o => o.id === 'op-ghost');
    expect(op?.status).toBe('DEAD');
    expect(op?.lastStatusCode).toBe(404);

    // Local cached copy was removed
    const cached = await getCachedUserCollections(userId);
    expect(cached.find(c => c.id === entityId)).toBeUndefined();
  });

  // 11. Status handling: 409 Conflict keeps local copy and does not loop
  it('Scenario 11: 409 Conflict marks CONFLICT and notifies without infinite loop', async () => {
    const entityId = 'col-conflict-item';

    await enqueueOutboxOperation({
      id: 'op-conflict',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId,
      payload: { title: 'My conflicting edit' },
      timestamp: 1000,
      status: 'PENDING',
    });

    vi.spyOn(api, 'put').mockImplementation(async () => {
      const err: any = new Error('Conflict');
      err.response = { status: 409, data: { message: 'Version mismatch' } };
      throw err;
    });

    let conflictReported = false;
    const result = await outboxSyncManager.sync(userId, (conflict) => {
      conflictReported = true;
      expect(conflict.op.id).toBe('op-conflict');
    });

    expect(result.failed).toBe(1);
    expect(conflictReported).toBe(true);

    const allOps = await getAllOutboxOperations(userId);
    const op = allOps.find(o => o.id === 'op-conflict');
    expect(op?.status).toBe('CONFLICT');
  });

  // 12. Export unsynced data and cache reset safety
  it('Scenario 12: export unsynced data before cache reset protects user text', async () => {
    await enqueueOutboxOperation({
      id: 'op-unsynced-note',
      userId,
      type: 'CREATE_NOTE',
      entityId: 'col-1',
      payload: { body: { note: 'Crucial user note written offline' } },
      timestamp: 1000,
      status: 'FAILED',
    });

    // Export unsynced data
    const exportedJson = await exportUnsyncedData(userId);
    expect(exportedJson).toContain('Crucial user note written offline');
    expect(exportedJson).toContain('CREATE_NOTE');

    // Reset local cache preserves or clears cache without losing outbox
    await resetLocalCache(userId);
    const ops = await getAllOutboxOperations(userId);
    expect(ops).toHaveLength(1);
    expect(ops[0].id).toBe('op-unsynced-note');
  });
});

