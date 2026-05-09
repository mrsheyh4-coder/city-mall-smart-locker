'use client';

import type { Translation } from '@/lib/i18n';

interface ErrorToastProps {
  message: string;
  t: Translation;
  onDismiss: () => void;
}

export function ErrorToast({ message, t, onDismiss }: ErrorToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-[#b3806e]/35 bg-[#1a212f]/90 p-4 text-sm text-[#ffffff] shadow-2xl shadow-[#b3806e]/15 backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#b3806e] shadow-[0_0_18px_rgba(179,128,110,0.75)]" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t.apiError}</p>
          <p className="mt-1 leading-6 text-[#ffffff]/75">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-2 text-lg leading-none text-[#ffffff]/70 transition hover:bg-[#ffffff]/10 hover:text-[#ffffff]"
          aria-label={t.dismissError}
        >
          x
        </button>
      </div>
    </div>
  );
}
