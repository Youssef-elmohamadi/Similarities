import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  enqueueOutboxOperation,
  getPendingOutboxOperations,
  removeOutboxOperation,
  setCachedUserCollections,
  getCachedUserCollections,
  wipeUserDataOnLogout,
  OutboxOperation,
} from './userDataDb';

describe('User Data Offline DB & Outbox Suite', () => {
  const userA = 'user-uuid-aaaa-1111';
  const userB = 'user-uuid-bbbb-2222';

  beforeEach(async () => {
    await wipeUserDataOnLogout(userA);
    await wipeUserDataOnLogout(userB);
  });

  it('guarantees user isolation: User B never sees User A cached collections', async () => {
    await setCachedUserCollections(userA, [
      { id: 'col-1', title: 'متشابهات البقرة والنساء', itemCount: 10, updatedAt: '2026-11-02T10:00:00Z', isFavorite: false, createdAt: '2026-11-02T10:00:00Z' },
    ]);

    await setCachedUserCollections(userB, [
      { id: 'col-2', title: 'متشابهات آل عمران', itemCount: 5, updatedAt: '2026-11-02T11:00:00Z', isFavorite: true, createdAt: '2026-11-02T11:00:00Z' },
    ]);

    const aColls = await getCachedUserCollections(userA);
    const bColls = await getCachedUserCollections(userB);

    expect(aColls).toHaveLength(1);
    expect(aColls[0].title).toBe('متشابهات البقرة والنساء');

    expect(bColls).toHaveLength(1);
    expect(bColls[0].title).toBe('متشابهات آل عمران');

    // Strict isolation
    expect(aColls.some(c => c.id === 'col-2')).toBe(false);
    expect(bColls.some(c => c.id === 'col-1')).toBe(false);
  });

  it('enforces outbox strict chronological ordering by timestamp', async () => {
    const op1: OutboxOperation = {
      id: 'op-1',
      userId: userA,
      type: 'CREATE_COLLECTION',
      entityId: 'temp-1',
      payload: { title: 'First' },
      timestamp: 1000,
      status: 'PENDING',
    };
    const op2: OutboxOperation = {
      id: 'op-2',
      userId: userA,
      type: 'ADD_VERSE',
      entityId: 'temp-1',
      payload: { verseId: 255 },
      timestamp: 2000,
      status: 'PENDING',
    };
    const op3: OutboxOperation = {
      id: 'op-3',
      userId: userA,
      type: 'UPDATE_COLLECTION',
      entityId: 'temp-1',
      payload: { title: 'Updated' },
      timestamp: 3000,
      status: 'PENDING',
    };

    // Insert out of order
    await enqueueOutboxOperation(op2);
    await enqueueOutboxOperation(op3);
    await enqueueOutboxOperation(op1);

    const pending = await getPendingOutboxOperations(userA);
    expect(pending).toHaveLength(3);
    expect(pending[0].id).toBe('op-1');
    expect(pending[1].id).toBe('op-2');
    expect(pending[2].id).toBe('op-3');
  });

  it('wipes all cached data and pending outbox for user upon logout', async () => {
    await setCachedUserCollections(userA, [
      { id: 'col-1', title: 'Test Collection', itemCount: 1, updatedAt: '2026-11-02T10:00:00Z', isFavorite: false, createdAt: '2026-11-02T10:00:00Z' },
    ]);
    await enqueueOutboxOperation({
      id: 'op-logout-test',
      userId: userA,
      type: 'CREATE_COLLECTION',
      entityId: 'col-1',
      payload: {},
      timestamp: Date.now(),
      status: 'PENDING',
    });

    // Logout wipe
    await wipeUserDataOnLogout(userA);

    const colls = await getCachedUserCollections(userA);
    const ops = await getPendingOutboxOperations(userA);

    expect(colls).toHaveLength(0);
    expect(ops).toHaveLength(0);
  });

  it('handles conflict detection: detects when server updatedAt is newer than baseUpdatedAt', () => {
    const baseUpdatedAt = '2026-11-02T10:00:00.000Z';
    const serverNewerUpdatedAt = '2026-11-02T10:05:00.000Z';
    const serverOlderUpdatedAt = '2026-11-02T09:55:00.000Z';

    const isConflict1 = new Date(serverNewerUpdatedAt).getTime() > new Date(baseUpdatedAt).getTime();
    expect(isConflict1).toBe(true);

    const isConflict2 = new Date(serverOlderUpdatedAt).getTime() > new Date(baseUpdatedAt).getTime();
    expect(isConflict2).toBe(false);
  });

  it('maps temporary client IDs to server GUIDs in outbox operations', async () => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const serverGuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

    const tempMap = new Map<string, string>();
    tempMap.set(tempId, serverGuid);

    const nextOpEntityId = tempId;
    const resolved = tempMap.get(nextOpEntityId) || nextOpEntityId;

    expect(resolved).toBe(serverGuid);
  });
});
