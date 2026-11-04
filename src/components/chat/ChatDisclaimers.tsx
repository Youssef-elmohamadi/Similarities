import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

export const ChatDisclaimers: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [isDismissed, setIsDismissed] = useState(() => {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('chat_disclaimer_dismissed') === '1';
  });

  if (isDismissed) return null;

  return (
    <div
      role="note"
      aria-label="تنبيهات وضوابط استخدام المساعد الذكي"
      className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 transition-all shadow-2xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">
            مساعد تجريبي قد يُخطئ، راجع أهل العلم ولا تعتمد عليه في فهم كلام الله.
          </span>
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 text-amber-800/80 dark:text-amber-300/80 text-[10px] sm:text-[11px]">
            <ShieldAlert className="w-3 h-3 text-amber-600/80 dark:text-amber-400/80 shrink-0" />
            <span className="truncate">
              رسائلك تُرسل إلى خدمة ذكاء اصطناعي خارجية، ولا تكتب بيانات شخصية أو حساسة.
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setIsDismissed(true);
          try {
            sessionStorage.setItem('chat_disclaimer_dismissed', '1');
          } catch {
            // Ignore storage errors
          }
        }}
        className="p-0.5 rounded text-amber-800/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-200 shrink-0 cursor-pointer"
        aria-label="إغلاق التنبيه"
        title="إغلاق التنبيه"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
