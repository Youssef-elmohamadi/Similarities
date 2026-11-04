import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export const ChatDisclaimers: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div
      role="note"
      aria-label="تنبيهات وضوابط استخدام المساعد الذكي"
      className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs md:text-sm text-text-secondary space-y-1.5 transition-colors"
    >
      <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300 font-medium">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>مساعد تجريبي قد يُخطئ، راجع أهل العلم ولا تعتمد عليه في فهم كلام الله.</span>
      </div>
      {!compact && (
        <div className="flex items-start gap-2 text-text-muted text-[11px] md:text-xs">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>رسائلك تُرسل إلى خدمة ذكاء اصطناعي خارجية، ولا تكتب بيانات شخصية أو حساسة.</span>
        </div>
      )}
    </div>
  );
};

