import { api } from '@/lib/api';
import {
  OutboxOperation,
  getPendingOutboxOperations,
  removeOutboxOperation,
  enqueueOutboxOperation,
  getCachedUserCollections,
  setCachedUserCollections,
  getCachedCollectionDetail,
  setCachedCollectionDetail,
} from './userDataDb';

export class OutboxSyncManager {
  private isSyncing = false;

  public async sync(userId: string, onConflict?: (conflict: { op: OutboxOperation; serverRecord: any }) => void): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || !window.navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;

    try {
      // Lightweight health check
      await api.get('/health', { timeout: 4000 });

      const pendingOps = await getPendingOutboxOperations(userId);
      const tempToServerIdMap = new Map<string, string>();

      for (const op of pendingOps) {
        try {
          // Resolve any temporary entity ID mapped in previous steps
          const resolvedEntityId = tempToServerIdMap.get(op.entityId) || op.entityId;

          // 1. CREATE_COLLECTION
          if (op.type === 'CREATE_COLLECTION') {
            const res = await api.post('/collections', op.payload, {
              headers: { 'Idempotency-Key': op.id },
            });
            const created = res.data;
            tempToServerIdMap.set(op.entityId, created.id);

            // Clean up temp record and put server record in local cache
            const colls = await getCachedUserCollections(userId);
            const updatedColls = colls.filter(c => c.id !== op.entityId);
            await setCachedUserCollections(userId, [created, ...updatedColls]);

            // Replace detail cache if present
            const cachedDetail = await getCachedCollectionDetail(userId, op.entityId);
            if (cachedDetail) {
              const { getUserDB } = await import('./userDataDb');
              const db = await getUserDB();
              await db.delete('collectionDetails', op.entityId);
              await setCachedCollectionDetail(userId, { ...created, items: created.verses || [] });
            }

            await removeOutboxOperation(op.id);
            synced++;
          }
          // 2. UPDATE_COLLECTION
          else if (op.type === 'UPDATE_COLLECTION') {
            // Conflict Detection check
            if (op.baseUpdatedAt) {
              try {
                const currentServerRes = await api.get(`/collections/${resolvedEntityId}`);
                const serverRecord = currentServerRes.data;
                const serverDate = new Date(serverRecord.updatedAt).getTime();
                const baseDate = new Date(op.baseUpdatedAt).getTime();

                if (serverDate > baseDate) {
                  // Conflict: server modified after base version
                  onConflict?.({ op, serverRecord });
                  // Keep local copy so user can resolve, skip overwriting
                  continue;
                }
              } catch (e) {
                // If 404, item was deleted on server
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
              tempToServerIdMap.set(op.payload.tempId, createdComp.id);
            }
            await removeOutboxOperation(op.id);
            synced++;
          }
          // 8. DELETE_COMPARISON
          else if (op.type === 'DELETE_COMPARISON') {
            const compId = tempToServerIdMap.get(op.payload.comparisonId) || op.payload.comparisonId;
            await api.delete(`/comparisons/${compId}`, {
              headers: { 'Idempotency-Key': op.id },
            });
            await removeOutboxOperation(op.id);
            synced++;
          }
          // 9. ADD_DIFFERENCE
          else if (op.type === 'ADD_DIFFERENCE') {
            const compId = tempToServerIdMap.get(op.payload.comparisonId) || op.payload.comparisonId;
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
            synced++;
          }
          // 11. CREATE_CONNECTION
          else if (op.type === 'CREATE_CONNECTION') {
            const res = await api.post(`/collections/${resolvedEntityId}/connections`, op.payload.body, {
              headers: { 'Idempotency-Key': op.id },
            });
            const createdConn = res.data;
            if (op.payload.tempId && createdConn?.id) {
              tempToServerIdMap.set(op.payload.tempId, createdConn.id);
            }
            await removeOutboxOperation(op.id);
            synced++;
          }
          // 12. UPDATE_CONNECTION
          else if (op.type === 'UPDATE_CONNECTION') {
            const connId = tempToServerIdMap.get(op.payload.connectionId) || op.payload.connectionId;
            await api.put(`/connections/${connId}`, op.payload.body, {
              headers: { 'Idempotency-Key': op.id },
            });
            await removeOutboxOperation(op.id);
            synced++;
          }
          // 13. DELETE_CONNECTION
          else if (op.type === 'DELETE_CONNECTION') {
            const connId = tempToServerIdMap.get(op.payload.connectionId) || op.payload.connectionId;
            await api.delete(`/connections/${connId}`, {
              headers: { 'Idempotency-Key': op.id },
            });
            await removeOutboxOperation(op.id);
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
              tempToServerIdMap.set(op.payload.tempId, createdNote.id);
            }
            await removeOutboxOperation(op.id);
            synced++;
          }
          // 17. UPDATE_NOTE
          else if (op.type === 'UPDATE_NOTE') {
            const noteId = tempToServerIdMap.get(op.payload.noteId) || op.payload.noteId;
            await api.put(`/notes/${noteId}`, op.payload.body, {
              headers: { 'Idempotency-Key': op.id },
            });
            await removeOutboxOperation(op.id);
            synced++;
          }
          // 18. DELETE_NOTE
          else if (op.type === 'DELETE_NOTE') {
            const noteId = tempToServerIdMap.get(op.payload.noteId) || op.payload.noteId;
            await api.delete(`/notes/${noteId}`, {
              headers: { 'Idempotency-Key': op.id },
            });
            await removeOutboxOperation(op.id);
            synced++;
          }
        } catch (err: any) {
          console.error(`Outbox op ${op.id} failed:`, err);
          failed++;
        }
      }
    } catch (err) {
      console.warn('Network unreachable for outbox sync:', err);
    } finally {
      this.isSyncing = false;
    }

    return { synced, failed };
  }
}

export const outboxSyncManager = new OutboxSyncManager();
