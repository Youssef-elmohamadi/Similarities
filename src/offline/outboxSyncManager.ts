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
