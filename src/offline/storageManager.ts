/**
 * Storage Persistence and Usage Manager
 *
 * Implements W3C Storage API (navigator.storage.persist / estimate)
 * Guarantees that user collections, outbox operations, and the offline Quran
 * dataset are protected against automatic browser cache eviction under storage pressure.
 */

export interface StorageReport {
  usageBytes: number;
  quotaBytes: number;
  usageMB: number;
  quotaMB: number;
  percent: number;
  isPersisted: boolean;
  supported: boolean;
}

export function isPersistentStorageSupported(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && typeof navigator.storage.persist === 'function';
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!isPersistentStorageSupported()) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export async function requestPersistentStorage(): Promise<{ persisted: boolean; reason?: string }> {
  if (!isPersistentStorageSupported()) {
    return { persisted: false, reason: 'متصفحك الحالي لا يدعم ميزة الحماية من الحذف التلقائي.' };
  }

  try {
    const isAlready = await navigator.storage.persisted();
    if (isAlready) {
      return { persisted: true };
    }

    const granted = await navigator.storage.persist();
    if (granted) {
      return { persisted: true };
    } else {
      return {
        persisted: false,
        reason: 'تم رفض طلب التخزين الدائم من قبل إعدادات المتصفح أو لعدم إضافة التطبيق للشاشة الرئيسية.',
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { persisted: false, reason: msg };
  }
}

export async function getStorageReport(): Promise<StorageReport> {
  const supported = isPersistentStorageSupported();
  let usageBytes = 0;
  let quotaBytes = 0;
  let isPersisted = false;

  if (typeof navigator !== 'undefined' && 'storage' in navigator && typeof navigator.storage.estimate === 'function') {
    try {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch (e) {
      console.warn('Storage estimate error:', e);
    }
  }

  if (supported) {
    try {
      isPersisted = await navigator.storage.persisted();
    } catch {}
  }

  const usageMB = Math.round((usageBytes / (1024 * 1024)) * 10) / 10;
  const quotaMB = Math.round((quotaBytes / (1024 * 1024)) * 10) / 10;
  const percent = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 1000) / 10 : 0;

  return {
    usageBytes,
    quotaBytes,
    usageMB,
    quotaMB,
    percent,
    isPersisted,
    supported,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

