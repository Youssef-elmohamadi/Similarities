import { api, API_BASE_URL, requestTokenRefresh } from '@/lib/api';
import axios from 'axios';
import { connectivity } from './connectivity';
import {
  OutboxOperation,
  getPendingOutboxOperations,
  getAllOutboxOperations,
  removeOutboxOperation,
  updateOutboxOperation,
  getCachedUserCollections,
  setCachedUserCollections,
  getCachedCollectionDetail,
  setCachedCollectionDetail,
  saveTempIdMapping,
  getResolvedEntityId,
  remapOutboxEntityIds,
  remapLocalCollectionId,
  removeStaleLocalEntity,
  removeTombstone,
  getTombstonedEntityIds,
} from './userDataDb';

export interface SyncResult {
  synced: number;
  failed: number;
  dead?: number;
  pausedOnAuth?: boolean;
}

export class OutboxSyncManager {
  private isSyncing = false;

  private isOnline(): boolean {
    return connectivity.isOnline();
  }

  public async tryRefreshToken(): Promise<boolean> {
    try {
      const token = await requestTokenRefresh();
      return !!token;
    } catch {
      return false;
    }
  }

  public scheduleIdleSync(userId: string): void {
    if (!this.isOnline() || this.isSyncing) return;
    const run = () => {
      this.sync(userId).catch(err => console.warn('Background idle outbox sync:', err));
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 500);
    }
  }

  public async sync(
    userId: string,
    onConflict?: (conflict: { op: OutboxOperation; serverRecord: any }) => void
  ): Promise<SyncResult> {
    if (this.isSyncing || !this.isOnline()) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    let pausedOnAuth = false;

    try {
      const pendingOps = await getPendingOutboxOperations(userId);
      const now = Date.now();

      // Filter eligible operations (skip DEAD ops and ops currently in backoff)
      const eligibleOps = pendingOps.filter(op => {
        if (op.status === 'DEAD') return false;
        if (op.nextRetryAt && now < op.nextRetryAt) return false;
        return true;
      });

      // Requirement 2: Group by entityId so a failing operation only stops its own entity
      // Unrelated entities process completely independently!
      const opsByEntity = new Map<string, OutboxOperation[]>();
      for (const op of eligibleOps) {
        const list = opsByEntity.get(op.entityId) || [];
        list.push(op);
        opsByEntity.set(op.entityId, list);
      }

      for (const [entityId, entityOps] of opsByEntity.entries()) {
        // Process operations for this entity sequentially in timestamp order
        entityOps.sort((a, b) => a.timestamp - b.timestamp);

        for (const op of entityOps) {
          op.status = 'SYNCING';
          await updateOutboxOperation(op);

          try {
            // Requirement 6: Resolve temporary IDs to server GUIDs
            const resolvedEntityId = await getResolvedEntityId(userId, op.entityId);

            // 1. CREATE_COLLECTION
            if (op.type === 'CREATE_COLLECTION') {
              const res = await api.post('/collections', op.payload, {
                headers: { 'Idempotency-Key': op.id },
              });
              const created = res.data;
              const serverId = created.id;

              // Remap IDs in queue and local storage
              await saveTempIdMapping(userId, op.entityId, serverId);
              await remapOutboxEntityIds(userId, op.entityId, serverId);
              await remapLocalCollectionId(userId, op.entityId, serverId, created);

              await removeOutboxOperation(op.id);
              synced++;
            }
            // 2. UPDATE_COLLECTION
            else if (op.type === 'UPDATE_COLLECTION') {
              // Conflict detection check
              if (op.baseUpdatedAt) {
                try {
                  const currentServerRes = await api.get(`/collections/${resolvedEntityId}`);
                  const serverRecord = currentServerRes.data;
                  const serverDate = new Date(serverRecord.updatedAt).getTime();
                  const baseDate = new Date(op.baseUpdatedAt).getTime();

                  if (serverDate > baseDate) {
                    op.status = 'CONFLICT';
                    op.lastError = 'Server record was modified after base revision (409 Conflict)';
                    op.lastStatusCode = 409;
                    await updateOutboxOperation(op);
                    onConflict?.({ op, serverRecord });
                    failed++;
                    break; // Do not loop for this entity
                  }
                } catch (e: any) {
                  if (e.response?.status === 404) {
                    // Item deleted on server! Handled below in catch
                    throw e;
                  }
                }
              }

              await api.put(`/collections/${resolvedEntityId}`, op.payload, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 3. DELETE_COLLECTION
            else if (op.type === 'DELETE_COLLECTION') {
              await api.delete(`/collections/${resolvedEntityId}`, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              await removeTombstone(op.entityId);
              synced++;
            }
            // 4. ADD_VERSE
            else if (op.type === 'ADD_VERSE') {
              await api.post(`/collections/${resolvedEntityId}/verses`, op.payload, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 5. REMOVE_VERSE
            else if (op.type === 'REMOVE_VERSE') {
              await api.delete(`/collections/${resolvedEntityId}/verses/${op.payload.verseId}`, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 6. SAVE_NOTE
            else if (op.type === 'SAVE_NOTE') {
              await api.put(
                `/collections/${resolvedEntityId}/verses/${op.payload.quranVerseId}/note`,
                { personalNote: op.payload.note },
                { headers: { 'Idempotency-Key': op.id } }
              );
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 7. CREATE_COMPARISON
            else if (op.type === 'CREATE_COMPARISON') {
              const res = await api.post(`/collections/${resolvedEntityId}/comparisons`, op.payload.body, {
                headers: { 'Idempotency-Key': op.id },
              });
              const createdComp = res.data;
              if (op.payload.tempId && createdComp?.id) {
                await saveTempIdMapping(userId, op.payload.tempId, createdComp.id);
              }
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 8. DELETE_COMPARISON
            else if (op.type === 'DELETE_COMPARISON') {
              const compId = await getResolvedEntityId(userId, op.payload.comparisonId);
              await api.delete(`/comparisons/${compId}`, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              await removeTombstone(op.payload.comparisonId);
              synced++;
            }
            // 9. ADD_DIFFERENCE
            else if (op.type === 'ADD_DIFFERENCE') {
              const compId = await getResolvedEntityId(userId, op.payload.comparisonId);
              await api.post(`/comparisons/${compId}/differences`, op.payload.diffPayload, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 10. DELETE_DIFFERENCE
            else if (op.type === 'DELETE_DIFFERENCE') {
              await api.delete(`/differences/${op.payload.differenceId}`, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              await removeTombstone(op.payload.differenceId);
              synced++;
            }
            // 11. CREATE_CONNECTION
            else if (op.type === 'CREATE_CONNECTION') {
              const res = await api.post(`/collections/${resolvedEntityId}/connections`, op.payload.body, {
                headers: { 'Idempotency-Key': op.id },
              });
              const createdConn = res.data;
              if (op.payload.tempId && createdConn?.id) {
                await saveTempIdMapping(userId, op.payload.tempId, createdConn.id);
              }
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 12. UPDATE_CONNECTION
            else if (op.type === 'UPDATE_CONNECTION') {
              const connId = await getResolvedEntityId(userId, op.payload.connectionId);
              await api.put(`/connections/${connId}`, op.payload.body, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 13. DELETE_CONNECTION
            else if (op.type === 'DELETE_CONNECTION') {
              const connId = await getResolvedEntityId(userId, op.payload.connectionId);
              await api.delete(`/connections/${connId}`, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              await removeTombstone(op.payload.connectionId);
              synced++;
            }
            // 14. REORDER_VERSES
            else if (op.type === 'REORDER_VERSES') {
              await api.put(`/collections/${resolvedEntityId}/verses/reorder`, op.payload, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 15. REORDER_CONNECTIONS
            else if (op.type === 'REORDER_CONNECTIONS') {
              await api.put(`/collections/${resolvedEntityId}/connections/reorder`, op.payload, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 16. CREATE_NOTE
            else if (op.type === 'CREATE_NOTE') {
              const res = await api.post(`/collections/${resolvedEntityId}/notes`, op.payload.body, {
                headers: { 'Idempotency-Key': op.id },
              });
              const createdNote = res.data;
              if (op.payload.tempId && createdNote?.id) {
                await saveTempIdMapping(userId, op.payload.tempId, createdNote.id);
              }
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 17. UPDATE_NOTE
            else if (op.type === 'UPDATE_NOTE') {
              const noteId = await getResolvedEntityId(userId, op.payload.noteId);
              await api.put(`/notes/${noteId}`, op.payload.body, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              synced++;
            }
            // 18. DELETE_NOTE
            else if (op.type === 'DELETE_NOTE') {
              const noteId = await getResolvedEntityId(userId, op.payload.noteId);
              await api.delete(`/notes/${noteId}`, {
                headers: { 'Idempotency-Key': op.id },
              });
              await removeOutboxOperation(op.id);
              await removeTombstone(op.payload.noteId);
              synced++;
            }
          } catch (err: any) {
            // Requirement 3: Error handling per HTTP status code
            const status = err.response?.status;
            const errMsg = err.response?.data?.message || err.message || 'Operation failed';

            // --- 404 Not Found ---
            if (status === 404) {
              const isDeleteOp =
                op.type === 'DELETE_COLLECTION' ||
                op.type === 'DELETE_COMPARISON' ||
                op.type === 'DELETE_DIFFERENCE' ||
                op.type === 'DELETE_CONNECTION' ||
                op.type === 'DELETE_NOTE' ||
                op.type === 'REMOVE_VERSE';

              if (isDeleteOp) {
                // Treat DELETE as success (already gone on server)
                await removeOutboxOperation(op.id);
                await removeTombstone(op.entityId);
                synced++;
                continue; // Continue with remaining ops
              } else {
                // UPDATE or child mutation on non-existent entity -> mark DEAD and remove local stale copy
                op.status = 'DEAD';
                op.attempts = (op.attempts || 0) + 1;
                op.lastError = `Entity was deleted on server (404): ${errMsg}`;
                op.lastStatusCode = 404;
                await updateOutboxOperation(op);
                await removeStaleLocalEntity(userId, op.entityId);
                failed++;
                break; // Stop subsequent ops for this dead entity
              }
            }

            // --- 409 Conflict ---
            if (status === 409) {
              op.status = 'CONFLICT';
              op.attempts = (op.attempts || 0) + 1;
              op.lastError = `Conflict (409): ${errMsg}`;
              op.lastStatusCode = 409;
              await updateOutboxOperation(op);
              onConflict?.({ op, serverRecord: err.response?.data });
              failed++;
              break; // Do not loop continuously
            }

            // --- 401 Unauthorized ---
            if (status === 401) {
              op.status = 'PENDING'; // Never drop operations on 401
              op.lastError = 'Session expired (401)';
              op.lastStatusCode = 401;
              await updateOutboxOperation(op);

              pausedOnAuth = true;
              failed++;
              const refreshed = await this.tryRefreshToken();
              if (!refreshed) {
                // Pause sync and preserve outbox
                return { synced, failed, pausedOnAuth: true };
              }
              // If refreshed, retry next pass
              break;
            }

            // --- 400 or 422 Bad Request / Validation Failure ---
            if (status === 400 || status === 422) {
              op.status = 'DEAD';
              op.attempts = (op.attempts || 0) + 1;
              op.lastError = `Validation Error (${status}): ${errMsg}`;
              op.lastStatusCode = status;
              await updateOutboxOperation(op);
              failed++;
              break; // Stop dependent ops on this entity
            }

            // --- 5xx Server Error or Network / Timeout ---
            if (!status || status >= 500 || err.code === 'ECONNABORTED' || err.message?.includes('Network Error')) {
              op.status = 'FAILED';
              op.attempts = (op.attempts || 0) + 1;
              op.lastError = `Network / Server Error (${status || 'Network'}): ${errMsg}`;
              op.lastStatusCode = status;
              // Exponential backoff: 2s, 4s, 8s, 16s... up to 60s max
              const backoffSec = Math.min(60, Math.pow(2, op.attempts));
              op.nextRetryAt = Date.now() + backoffSec * 1000;
              await updateOutboxOperation(op);
              failed++;
              break; // Stop ops for this entity until retry
            }

            // --- Other unclassified errors ---
            op.status = 'FAILED';
            op.attempts = (op.attempts || 0) + 1;
            op.lastError = `Error (${status}): ${errMsg}`;
            op.lastStatusCode = status;
            op.nextRetryAt = Date.now() + 5000;
            await updateOutboxOperation(op);
            failed++;
            break;
          }
        }
      }
    } catch (globalErr) {
      console.warn('Outbox sync encountered global issue:', globalErr);
    } finally {
      this.isSyncing = false;
    }

    return { synced, failed, pausedOnAuth };
  }

  // Requirement 8: One-time migration/cleanup on app start
  public async reconcileAndCleanup(
    userId: string
  ): Promise<{ purgedDeadCount: number; reconciledCollections: number }> {
    let purgedDeadCount = 0;
    let reconciledCollections = 0;

    try {
      const allOps = await getAllOutboxOperations(userId);
      const tombstones = await getTombstonedEntityIds(userId);
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

      for (const op of allOps) {
        // Purge DEAD operations older than 7 days
        if (op.status === 'DEAD' && op.updatedAt && now - op.updatedAt > SEVEN_DAYS_MS) {
          await removeOutboxOperation(op.id);
          purgedDeadCount++;
          continue;
        }

        // Purge operations referencing entities that have already been confirmed tombstoned
        if (tombstones.has(op.entityId) && op.type !== 'DELETE_COLLECTION') {
          await removeOutboxOperation(op.id);
          purgedDeadCount++;
        }
      }

      // Reconcile local collections cache with server list when online
      if (this.isOnline()) {
        try {
          const res = await api.get<any[]>('/collections');
          if (Array.isArray(res.data)) {
            // Apply tombstones
            const serverColls = res.data.filter(c => !tombstones.has(c.id));
            await setCachedUserCollections(userId, serverColls);
            reconciledCollections = serverColls.length;
          }
        } catch {
          // Ignore offline / network errors during reconciliation
        }

        // Run sync
        await this.sync(userId);
      }
    } catch (e) {
      console.warn('Reconcile and cleanup warning:', e);
    }

    return { purgedDeadCount, reconciledCollections };
  }
}

export const outboxSyncManager = new OutboxSyncManager();

// Automatically resume outbox sync on the online event (zero polling, zero retry storms while offline)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.id) {
          outboxSyncManager.scheduleIdleSync(u.id);
        }
      }
    } catch {}
  });
}
