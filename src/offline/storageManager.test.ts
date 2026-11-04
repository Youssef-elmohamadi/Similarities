import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isPersistentStorageSupported,
  isStoragePersisted,
  requestPersistentStorage,
  getStorageReport,
  formatBytes,
} from './storageManager';

describe('Storage Persistence Manager Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats bytes into human readable sizes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 15.5)).toBe('15.5 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
  });

  it('detects persistence and requests storage permission', async () => {
    // Mock navigator.storage
    const persistMock = vi.fn().mockResolvedValue(true);
    const persistedMock = vi.fn().mockResolvedValue(false);
    const estimateMock = vi.fn().mockResolvedValue({
      usage: 15 * 1024 * 1024,
      quota: 1000 * 1024 * 1024,
    });

    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          persist: persistMock,
          persisted: persistedMock,
          estimate: estimateMock,
        },
      },
      writable: true,
      configurable: true,
    });

    expect(isPersistentStorageSupported()).toBe(true);

    const result = await requestPersistentStorage();
    expect(result.persisted).toBe(true);
    expect(persistMock).toHaveBeenCalled();

    const report = await getStorageReport();
    expect(report.usageMB).toBe(15);
    expect(report.quotaMB).toBe(1000);
    expect(report.percent).toBe(1.5);
  });

  it('handles permission denial gracefully with a clear Arabic explanation', async () => {
    const persistMock = vi.fn().mockResolvedValue(false);
    const persistedMock = vi.fn().mockResolvedValue(false);

    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          persist: persistMock,
          persisted: persistedMock,
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await requestPersistentStorage();
    expect(result.persisted).toBe(false);
    expect(result.reason).toContain('تم رفض طلب التخزين الدائم');
  });
});

