import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  isOfflineDatasetAvailable,
  getStoredDatasetVersion,
  saveDatasetToIndexedDB,
  QuranDataset,
} from '@/offline/quranDb';
import { initLocalWorker } from '@/offline/searchWorkerClient';
import { connectivity } from '@/offline/connectivity';
import { Database, CheckCircle2, Download, WifiOff, AlertTriangle } from 'lucide-react';

interface DatasetContextType {
  isOfflineReady: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  downloadStage: string;
  isOffline: boolean;
  datasetVersion: string | null;
  triggerDownload: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

export const DatasetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [datasetVersion, setDatasetVersion] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!connectivity.isOnline());
  const [showProgressModal, setShowProgressModal] = useState(false);

  // Monitor network connectivity passively (events + request status, zero polling)
  useEffect(() => {
    return connectivity.subscribe(online => {
      setIsOffline(!online);
    });
  }, []);

  // Check initial dataset readiness (deferred to idle/load for anonymous landing visitors)
  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const ready = await isOfflineDatasetAvailable();
        if (cancelled) return;
        setIsOfflineReady(ready);
        if (ready) {
          const ver = await getStoredDatasetVersion();
          if (cancelled) return;
          setDatasetVersion(ver);
          // Initialize Web Worker with IndexedDB data
          initLocalWorker().catch(err => console.error('Failed to init worker:', err));
        }
      } catch (err) {
        console.warn('Dataset readiness check failed:', err);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(() => checkStatus(), { timeout: 2000 });
      return () => {
        cancelled = true;
        (window as any).cancelIdleCallback(handle);
      };
    } else {
      const timer = setTimeout(checkStatus, 500);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, []);

  // Check version on startup & auto-download on first login if online
  useEffect(() => {
    if (!user || isOffline || !connectivity.isOnline()) return;

    const checkAndDownload = async () => {
      try {
        const res = await api.get<{ versionHash: string }>('/quran/export/version');
        const serverHash = res.data.versionHash;
        const localHash = await getStoredDatasetVersion();

        if (!localHash || localHash !== serverHash) {
          // Dataset missing or outdated: prompt / download
          await downloadDataset();
        }
      } catch (err) {
        console.warn('Could not verify dataset version from server:', err);
      }
    };

    checkAndDownload();
  }, [user, isOffline]);

  const downloadDataset = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setShowProgressModal(true);
    setDownloadProgress(5);
    setDownloadStage(t('جاري الاتصال بالخادم لتحميل المصحف الشريف...', 'Connecting to server to download Quran dataset...'));

    try {
      const res = await api.get<QuranDataset>('/quran/export', {
        onDownloadProgress: progressEvent => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 50) / progressEvent.total);
            setDownloadProgress(Math.min(50, 5 + pct));
            setDownloadStage(t(`جاري تنزيل البيانات (${Math.round(progressEvent.loaded / 1024 / 1024)} ميجابايت)...`, `Downloading dataset (${Math.round(progressEvent.loaded / 1024 / 1024)} MB)...`));
          }
        },
      });

      const dataset = res.data;
      await saveDatasetToIndexedDB(dataset, (pct, stage) => {
        setDownloadProgress(50 + Math.round(pct * 0.5));
        setDownloadStage(stage);
      });

      setIsOfflineReady(true);
      setDatasetVersion(dataset.versionHash);
      await initLocalWorker();

      setTimeout(() => {
        setShowProgressModal(false);
        setIsDownloading(false);
      }, 1000);
    } catch (err: unknown) {
      console.error('Error downloading dataset:', err);
      setDownloadStage(t('تعذر إكمال تحميل المصحف بدون إنترنت. سنحاول مرة أخرى لاحقاً.', 'Failed to download offline dataset. Will retry later.'));
      setTimeout(() => {
        setShowProgressModal(false);
        setIsDownloading(false);
      }, 2500);
    }
  };

  return (
    <DatasetContext.Provider
      value={{
        isOfflineReady,
        isDownloading,
        downloadProgress,
        downloadStage,
        isOffline,
        datasetVersion,
        triggerDownload: downloadDataset,
      }}
    >
      {children}

      {/* Dataset Download Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface p-6 sm:p-8 rounded-2xl max-w-md w-full space-y-5 text-center border border-border shadow-2xl animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-primary-tint text-primary mx-auto flex items-center justify-center">
              <Download className="w-7 h-7 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-text-primary">
                {t('جاري تجهيز المصحف للعمل بدون إنترنت', 'Preparing Quran for Offline Mode')}
              </h3>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                {downloadStage}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-background rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                <span>{downloadProgress}%</span>
                <span>{t('تحميل لمرة واحدة فقط', 'One-time download')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </DatasetContext.Provider>
  );
};

export const useDataset = () => {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
};

