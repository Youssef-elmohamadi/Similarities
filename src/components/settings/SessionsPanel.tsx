import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/common/Toast';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { api, getApiErrorMessage } from '@/lib/api';
import { connectivity } from '@/offline/connectivity';
import { UserSession } from '@/types/auth';
import { Laptop, Smartphone, ShieldCheck, LogOut, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export const SessionsPanel: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!connectivity.isOnline() || !user) return;
    setIsLoading(true);
    try {
      const response = await api.get<UserSession[]>('/auth/sessions');
      setSessions(response.data || []);
    } catch (err) {
      console.warn('Could not fetch active sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSessions();
    const unsub = connectivity.subscribe(online => {
      if (online) loadSessions();
    });
    return () => unsub();
  }, [loadSessions]);

  const handleRevokeSingle = async (sessionId: string) => {
    const confirmed = window.confirm(
      t('هل أنت متأكد من رغبتك في تسجيل الخروج وإنهاء الجلسة على هذا الجهاز؟', 'Are you sure you want to revoke this session?')
    );
    if (!confirmed) return;

    setRevokingId(sessionId);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success(t('تم إنهاء الجلسة بنجاح.', 'Session revoked successfully.'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    const otherCount = sessions.filter(s => !s.isCurrent).length;
    if (otherCount === 0) {
      toast.info(t('لا توجد جلسات أخرى مسجلة حالياً.', 'No other active sessions.'));
      return;
    }

    const confirmed = window.confirm(
      t(
        `هل تريد تسجيل الخروج من كافة الأجهزة الأخرى (${otherCount} أجهزة)؟`,
        `Sign out of all other ${otherCount} devices?`
      )
    );
    if (!confirmed) return;

    setIsRevokingAll(true);
    try {
      // Revoke all other sessions individually or via logout-all
      const otherSessions = sessions.filter(s => !s.isCurrent);
      await Promise.all(otherSessions.map(s => api.delete(`/auth/sessions/${s.id}`)));
      setSessions(prev => prev.filter(s => s.isCurrent));
      toast.success(t('تم تسجيل الخروج من جميع الأجهزة الأخرى بنجاح.', 'Signed out from all other devices.'));
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsRevokingAll(false);
    }
  };

  const getDeviceIcon = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('iphone') || lower.includes('android') || lower.includes('phone')) {
      return <Smartphone className="w-4 h-4 text-primary shrink-0" />;
    }
    return <Laptop className="w-4 h-4 text-primary shrink-0" />;
  };

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h2 className="font-semibold text-base text-text-primary">
              {t('الأجهزة والجلسات المسجلة', 'Devices & Active Sessions')}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {t(
                'إدارة الأجهزة المتصلة بحسابك؛ يتم الحفاظ على جلستك مفتوحة دائماً حتى تسجل الخروج.',
                'Manage devices connected to your account; sessions stay persistent until you sign out.'
              )}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={loadSessions}
          disabled={isLoading || !connectivity.isOnline()}
          className="min-h-[36px] px-2 text-xs text-text-secondary hover:text-text-primary"
          title={t('تحديث قائمة الجلسات', 'Refresh sessions list')}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Offline banner note */}
      {!connectivity.isOnline() && (
        <div className="p-3 rounded-lg bg-surface border border-border text-xs text-text-secondary flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-text-secondary shrink-0" />
          <span>
            {t(
              'أنت في وضع عدم الاتصال. يتم الحفاظ على جلستك المحلية بشكل آمن.',
              'You are offline. Your local session is kept safe.'
            )}
          </span>
        </div>
      )}

      {/* Sessions list */}
      <div className="space-y-2">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
              session.isCurrent
                ? 'bg-primary/5 border-primary/30'
                : 'bg-background border-border hover:bg-surface/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                {getDeviceIcon(session.deviceLabel)}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {session.deviceLabel}
                  </span>
                  {session.isCurrent && (
                    <Badge variant="primary" className="text-[10px] py-0.5 px-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('هذا الجهاز', 'Current Device')}</span>
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                  <span>
                    {session.isCurrent
                      ? t('نشط الآن', 'Active now')
                      : `${t('آخر نشاط', 'Last active')}: ${formatRelativeTime(session.lastUsedAt)}`}
                  </span>
                  {session.ipAddress && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-[11px] opacity-75">{session.ipAddress}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Revoke button (for other sessions only) */}
            {!session.isCurrent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRevokeSingle(session.id)}
                disabled={revokingId === session.id}
                className="text-xs text-danger hover:bg-danger-subtle hover:text-danger min-h-[36px] shrink-0"
              >
                {revokingId === session.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  t('إنهاء الجلسة', 'Revoke')
                )}
              </Button>
            )}
          </div>
        ))}

        {sessions.length === 0 && !isLoading && connectivity.isOnline() && (
          <div className="text-center py-6 text-xs text-text-secondary">
            {t('لا توجد جلسات مسجلة للعرض.', 'No active sessions to display.')}
          </div>
        )}
      </div>

      {/* Revoke all other devices button */}
      {sessions.filter(s => !s.isCurrent).length > 0 && (
        <div className="pt-2 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevokeAllOthers}
            disabled={isRevokingAll || !connectivity.isOnline()}
            className="text-xs text-danger hover:bg-danger-subtle min-h-[38px] flex items-center gap-1.5"
          >
            {isRevokingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            <span>{t('إنهاء الجلسات على جميع الأجهزة الأخرى', 'Sign out of all other devices')}</span>
          </Button>
        </div>
      )}
    </Card>
  );
};
