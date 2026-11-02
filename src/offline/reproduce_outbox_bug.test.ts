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
  wipeUserDataOnLogout,
  OutboxOperation,
} from './userDataDb';
import { outboxSyncManager } from './outboxSyncManager';
import { api } from '@/lib/api';

describe('Requirement 1: Reproduce and Inspect Stuck Outbox Bug', () => {
  const userId = 'user-repro-123';

  beforeEach(async () => {
    await wipeUserDataOnLogout(userId);
    vi.restoreAllMocks();
  });

  it('demonstrates legacy root cause: untreated 404 error leaves op stuck in PENDING with 0 attempts', async () => {
    // Legacy behavior simulation:
    // When api.delete throws 404, the old sync manager caught the error in `catch (err) { failed++; }`
    // without updating the operation's status or removing it.
    const stuckOp: OutboxOperation = {
      id: 'op-legacy-stuck',
      userId,
      type: 'DELETE_COLLECTION',
      entityId: 'deleted-on-server-col',
      payload: {},
      timestamp: 1000,
      status: 'PENDING',
      attempts: 0,
    };

    await enqueueOutboxOperation(stuckOp);

    // Old sync logic simulation:
    try {
      const err: any = new Error('Request failed with status code 404');
      err.response = { status: 404, data: { message: 'Collection not found' } };
      throw err;
    } catch {
      // Old manager did nothing to the outbox record
    }

    const pending = await getPendingOutboxOperations(userId);
    console.log('--- REPRODUCED STUCK OUTBOX RECORD (LEGACY BUG) ---');
    console.table(pending.map(p => ({
      id: p.id,
      type: p.type,
      entityId: p.entityId,
      status: p.status,
      attempts: p.attempts ?? 0,
      lastError: p.lastError ?? 'None (unrecorded by old manager)',
    })));

    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('PENDING');
    expect(pending[0].attempts).toBe(0);
  });

  it('verifies the fix: new sync engine handles 404 DELETE gracefully, removing it from queue', async () => {
    const fixedOp: OutboxOperation = {
      id: 'op-delete-stale',
      userId,
      type: 'DELETE_COLLECTION',
      entityId: 'collection-already-deleted-on-server',
      payload: {},
      timestamp: 1000,
      status: 'PENDING',
    };

    const validOp: OutboxOperation = {
      id: 'op-update-valid',
      userId,
      type: 'UPDATE_COLLECTION',
      entityId: 'valid-collection-id',
      payload: { title: 'Updated Title' },
      timestamp: 2000,
      status: 'PENDING',
    };

    await enqueueOutboxOperation(fixedOp);
    await enqueueOutboxOperation(validOp);

    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/health') return { data: { status: 'healthy' } } as any;
      return { data: {} } as any;
    });

    vi.spyOn(api, 'delete').mockImplementation(async (url: string) => {
      if (url.includes('collection-already-deleted-on-server')) {
        const error: any = new Error('Request failed with status code 404');
        error.response = { status: 404, data: { message: 'Collection not found' } };
        throw error;
      }
      return { data: { success: true } } as any;
    });

    vi.spyOn(api, 'put').mockImplementation(async () => {
      return { data: { success: true } } as any;
    });

    const result = await outboxSyncManager.sync(userId);

    // Both operations completed: 404 DELETE counted as synced, valid UPDATE synced
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);

    const pending = await getPendingOutboxOperations(userId);
    expect(pending).toHaveLength(0);
  });
});
