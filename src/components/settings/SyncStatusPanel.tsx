import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/common/Toast';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  getAllOutboxOperations,
  getOutboxStats,
  retryOutboxOperation,
  discardOutboxOperation,
  resetLocalCache,
  exportUnsyncedData,
  OutboxOperation,
} from '@/offline/userDataDb';
import { outboxSyncManager } from '@/offline/outboxSyncManager';
import { connectivity } from '@/offline/connectivity';
import { useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  CloudOff,
  AlertTriangle,
  RotateCw,
  Trash2,
  Download,
  Database,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toArabicDigits, formatRelativeTime } from '@/lib/utils';

export const SyncStatusPanel: React.FC = () => {
  const { user } = useAuth();
  const { t, direction } = useLanguage();
  const isRtl = direction === 'rtl';
  const toast = useToast();
  const queryClient = useQueryClient();

  const [stats, setStats] = useState<{ pending: number; failed: number; dead: number; total: number }>({
    pending: 0,
    failed: 0,
    dead: 0,
    total: 0,
  });
  const [stuckOps, setStuckOps] = useState<OutboxOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [opToDiscard, setOpToDiscard] = useState<OutboxOperation | null>(null);
  const [isResetWarningModalOpen, setIsResetWarningModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const s = await getOutboxStats(user.id);
      setStats(s);

      const all = await getAllOutboxOperations(user.id);
      const troubled = all.filter(o => o.status === 'DEAD' || o.status === 'FAILED' || o.status === 'CONFLICT');
      setStuckOps(troubled);
    } catch (e) {
      console.warn('Failed to load sync stats', e);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const unsubscribe = connectivity.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [loadData]);

  const handleSyncNow = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await outboxSyncManager.sync(user.id);
      await loadData();
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (res.synced > 0) {
        toast.success(t(`تمت مزامنة ${res.synced} عملية بنجاح.`, `Successfully synced ${res.synced} operations.`));
      } else if (res.failed > 0) {
        toast.error(t(`تعثرت مزامنة ${res.failed} عملية، راجع السجل أدناه.`, `Failed to sync ${res.failed} operations.`));
      } else {
        toast.info(t('جميع البيانات متزامنة تماماً.', 'All data is up to date.'));
      }
    } catch {
      toast.error(t('تعذر الاتصال بالخادم للمزامنة.', 'Could not connect to server for sync.'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryOp = async (op: OutboxOperation) => {
    await retryOutboxOperation(op.id);
    toast.info(t('تمت إعادة إدراج العملية في قائمة المزامنة.', 'Operation queued for retry.'));
    await loadData();
    if (user) {
      outboxSyncManager.sync(user.id).then(() => {
        loadData();
        queryClient.invalidateQueries({ queryKey: ['collections'] });
      });
    }
  };

  const handleConfirmDiscard = async () => {
    if (!opToDiscard) return;
    await discardOutboxOperation(opToDiscard.id);
    toast.success(t('تم استبعاد العملية من القائمة.', 'Operation discarded.'));
    setOpToDiscard(null);
    await loadData();
  };

  const handleExportUnsynced = async () => {
    if (!user) return;
    try {
      const json = await exportUnsyncedData(user.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quran-unsynced-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('تم تصدير نسخة احتياطية من التعديلات المحلية بنجاح.', 'Backup exported successfully.'));
    } catch {
      toast.error(t('تعذر تصدير النسخة الاحتياطية.', 'Failed to export backup.'));
    }
  };

  const handleExecuteReset = async () => {
    if (!user) return;
    try {
      await resetLocalCache(user.id);
      setIsResetWarningModalOpen(false);
      setIsResetConfirmOpen(false);
      toast.info(t('جارٍ إعادة تنزيل المجموعات من الخادم...', 'Downloading collections from server...'));
      await outboxSyncManager.reconcileAndCleanup(user.id);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      await loadData();
      toast.success(t('تمت إعادة ضبط الذاكرة المحلية وتحديث البيانات.', 'Local cache reset and refreshed.'));
    } catch {
      toast.error(t('تعذر إتمام إعادة الضبط.', 'Failed to reset local cache.'));
    }
  };

  const formatOpTitle = (op: OutboxOperation) => {
    switch (op.type) {
      case 'CREATE_COLLECTION':
        return t('إنشاء مجموعة جديدة', 'Create Collection');
      case 'UPDATE_COLLECTION':
        return t('تعديل بيانات مجموعة', 'Update Collection');
      case 'DELETE_COLLECTION':
        return t('حذف مجموعة بالكامل', 'Delete Collection');
      case 'ADD_VERSE':
        return t('إضافة آية لمجموعة', 'Add Verse');
      case 'REMOVE_VERSE':
        return t('إزالة آية من مجموعة', 'Remove Verse');
      case 'CREATE_COMPARISON':
        return t('إضافة موضع متشابه', 'Create Position');
      case 'DELETE_COMPARISON':
        return t('حذف موضع متشابه', 'Delete Position');
      case 'ADD_DIFFERENCE':
        return t('رصد فارق لفظي', 'Add Difference');
      case 'DELETE_DIFFERENCE':
        return t('حذف فارق لفظي', 'Delete Difference');
      case 'CREATE_CONNECTION':
        return t('إضافة رابط حفظ', 'Add Connection');
      case 'UPDATE_CONNECTION':
        return t('تعديل رابط حفظ', 'Update Connection');
      case 'DELETE_CONNECTION':
        return t('حذف رابط حفظ', 'Delete Connection');
      case 'CREATE_NOTE':
        return t('إضافة ملاحظة', 'Create Note');
      case 'UPDATE_NOTE':
        return t('تعديل ملاحظة', 'Update Note');
      case 'DELETE_NOTE':
        return t('حذف ملاحظة', 'Delete Note');
      case 'SAVE_NOTE':
        return t('حفظ ملاحظة آية', 'Save Verse Note');
      default:
        return op.type;
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <span>{t('حالة المزامنة والبيانات المحلية', 'Sync Status & Offline Storage')}</span>
        </h2>

        <Button
          size="sm"
          variant="outline"
          icon={<RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />}
          onClick={handleSyncNow}
          disabled={isSyncing}
          className="text-xs"
        >
          {isSyncing ? t('جارٍ المزامنة...', 'Syncing...') : t('مزامنة الآن', 'Sync Now')}
        </Button>
      </div>

      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
        {t(
          'تتيح لك المنصة العمل دون إنترنت مع حفظ كافة عملياتك محلياً بدقة، وتتم المزامنة تلقائياً عند عودة الاتصال دون فقدان أي حرف أو نص كتبته.',
          'The platform lets you work completely offline, queuing operations locally and syncing automatically when back online without losing any user text.'
        )}
      </p>

      {/* Sync Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-3 rounded-xl bg-background border border-border text-center">
          <span className="text-[11px] text-text-secondary block mb-1">{t('قيد الانتظار', 'Pending')}</span>
          <span className="font-bold text-base text-primary">
            {isRtl ? toArabicDigits(stats.pending) : stats.pending}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background border border-border text-center">
          <span className="text-[11px] text-text-secondary block mb-1">{t('فشلت مؤقتاً', 'Retrying')}</span>
          <span className={`font-bold text-base ${stats.failed > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`}>
            {isRtl ? toArabicDigits(stats.failed) : stats.failed}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background border border-border text-center">
          <span className="text-[11px] text-text-secondary block mb-1">{t('عمليات متعثرة', 'Dead')}</span>
          <span className={`font-bold text-base ${stats.dead > 0 ? 'text-danger' : 'text-text-secondary'}`}>
            {isRtl ? toArabicDigits(stats.dead) : stats.dead}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background border border-border text-center">
          <span className="text-[11px] text-text-secondary block mb-1">{t('إجمالي الطابور', 'Total')}</span>
          <span className="font-bold text-base text-text-primary">
            {isRtl ? toArabicDigits(stats.total) : stats.total}
          </span>
        </div>
      </div>

      {/* List of Stuck / Troubled Operations */}
      {stuckOps.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>{t('العمليات المتعثرة أو التي تنتظر المعالجة:', 'Stuck / Failing Operations:')}</span>
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pe-1">
            {stuckOps.map(op => {
              const isDead = op.status === 'DEAD';
              const isConflict = op.status === 'CONFLICT';
              return (
                <div
                  key={op.id}
                  className="p-3 rounded-xl bg-background border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs text-xs"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-text-primary">{formatOpTitle(op)}</span>
                      {isDead && (
                        <Badge variant="danger" size="sm">
                          {t('متعثرة (404/400)', 'Dead (Non-retryable)')}
                        </Badge>
                      )}
                      {isConflict && (
                        <Badge variant="blue" size="sm">
                          {t('تعارض (409)', 'Conflict (409)')}
                        </Badge>
                      )}
                      {!isDead && !isConflict && (
                        <Badge variant="accent" size="sm">
                          {t('إعادة محاولة', 'Retrying')}
                        </Badge>
                      )}
                      <span className="text-[10px] text-text-secondary">
                        {t('المحاولات:', 'Attempts:')} {isRtl ? toArabicDigits(op.attempts || 0) : op.attempts || 0}
                      </span>
                    </div>

                    {op.lastError && (
                      <p className="text-[11px] text-danger/90 leading-tight truncate" title={op.lastError}>
                        {op.lastError}
                      </p>
                    )}

                    <span className="text-[10px] text-text-muted block">
                      {t('التاريخ:', 'Date:')} {formatRelativeTime(new Date(op.timestamp).toISOString())}
                    </span>
                  </div>

                  {/* Actions for this stuck op */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RotateCw className="w-3 h-3 text-primary" />}
                      onClick={() => handleRetryOp(op)}
                      className="text-xs h-7 px-2"
                    >
                      {t('إعادة المحاولة', 'Retry')}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="w-3 h-3 text-danger" />}
                      onClick={() => setOpToDiscard(op)}
                      className="text-xs text-danger hover:bg-danger-subtle hover:text-danger h-7 px-2"
                    >
                      {t('استبعاد', 'Discard')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cache Reset & Export Action Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportUnsynced}
            className="text-xs"
            title={t('تصدير نسخة احتياطية من التعديلات المحلية', 'Export Backup of Unsynced Local Data')}
          >
            {t('تصدير التعديلات غير المتزامنة', 'Export Unsynced Backup')}
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
          onClick={() => {
            if (stats.total > 0) {
              setIsResetWarningModalOpen(true);
            } else {
              setIsResetConfirmOpen(true);
            }
          }}
          className="text-xs text-danger hover:bg-danger-subtle hover:text-danger"
        >
          {t('إعادة ضبط الذاكرة المحلية والتحميل من الخادم', 'Reset Local Cache & Re-download')}
        </Button>
      </div>

      {/* Modal: Confirm Discard Single Op */}
      <ConfirmDialog
        isOpen={!!opToDiscard}
        onClose={() => setOpToDiscard(null)}
        onConfirm={handleConfirmDiscard}
        title={t('استبعاد عملية المزامنة', 'Discard Sync Operation')}
        message={t(
          'هل أنت متأكد من استبعاد هذه العملية نهائياً من طابور المزامنة؟ لن يتم تطبيق هذا التغيير على الخادم.',
          'Are you sure you want to discard this operation from the outbox? This change will not be sent to the server.'
        )}
        confirmText={t('استبعاد العملية', 'Discard Operation')}
      />

      {/* Modal: Warning when resetting cache with unsynced changes */}
      <Modal
        isOpen={isResetWarningModalOpen}
        onClose={() => setIsResetWarningModalOpen(false)}
        title={t('تحذير: توجد تعديلات محلية غير متزامنة', 'Warning: Unsynced Local Changes Exist')}
        maxWidth="md"
      >
        <div className="space-y-4 text-start">
          <div className="p-3.5 rounded-xl bg-danger-subtle border border-danger/30 text-danger space-y-1">
            <span className="font-bold text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>{t('تنبيه فقدان البيانات المحلية', 'Local Data Loss Warning')}</span>
            </span>
            <p className="text-xs leading-relaxed text-text-primary">
              {t(
                `لديك حالياً (${isRtl ? toArabicDigits(stats.total) : stats.total}) عملية وتعديل محلي لم تكتمل مزامنتها مع الخادم بعد. إذا قمت بإعادة الضبط الآن، ستُحذف هذه التعديلات نهائياً من هذا الجهاز.`,
                `You have ${stats.total} unsynced operations. Resetting will permanently delete these local unsynced edits.`
              )}
            </p>
          </div>

          <p className="text-xs text-text-secondary">
            {t(
              'لحماية نصوصك وتدويناتك، نوصي بتصدير نسخة احتياطية أولاً قبل المتابعة.',
              'To preserve your notes and text, we strongly recommend exporting a backup file first.'
            )}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="w-3.5 h-3.5 text-primary" />}
              onClick={handleExportUnsynced}
            >
              {t('تصدير النسخة الاحتياطية أولاً', 'Export Backup First')}
            </Button>

            <Button
              size="sm"
              variant="danger"
              onClick={handleExecuteReset}
            >
              {t('تأكيد مسح الذاكرة والتحميل', 'Confirm Reset & Re-download')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirm Reset when no unsynced changes */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleExecuteReset}
        title={t('إعادة ضبط الذاكرة والتحميل من الخادم', 'Reset Cache & Re-download')}
        message={t(
          'سيتم مسح النسخة المحلية المؤقتة وإعادة تحميل كافة مجموعاتك بالكامل مباشرة من الخادم. هل تريد المتابعة؟',
          'This will clear the local temporary cache and re-download all your collections freshly from the server. Proceed?'
        )}
        confirmText={t('إعادة الضبط والتحميل', 'Reset & Re-download')}
      />
    </Card>
  );
};
