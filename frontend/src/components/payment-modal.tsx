'use client';

import { QRCodeSVG } from 'qrcode.react';
import type { DemoPaymentResponse } from '@/types/locker';
import type { Translation } from '@/lib/i18n';

type PaymentStage = 'idle' | 'processing' | 'authorizing' | 'success';

interface PaymentModalProps {
  stage: PaymentStage;
  result: DemoPaymentResponse | null;
  t: Translation;
  onClose: () => void;
}

export function PaymentModal({ stage, result, t, onClose }: PaymentModalProps) {
  if (stage === 'idle') {
    return null;
  }

  const stageText = {
    idle: t.stageReady,
    processing: t.stageProcessing,
    authorizing: t.stageAuthorizing,
    success: t.stageSuccess,
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#1a212f]/80 px-4 backdrop-blur-md">
      <section className="luxury-card-strong relative w-full max-w-lg overflow-hidden rounded-[2rem] p-6">
        <div className="bronze-line absolute inset-x-10 top-0 h-px" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#ffffff]/70">
              {t.paymentTitle}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {stageText[stage]}
            </h2>
          </div>
          {stage === 'success' ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#ffffff]/10 px-3 py-1 text-sm text-[#ffffff]/70 transition hover:bg-[#ffffff]/10 hover:text-[#ffffff]"
            >
              {t.close}
            </button>
          ) : null}
        </div>

        {stage !== 'success' ? (
          <div className="mt-8">
            <div className="relative h-2 overflow-hidden rounded-full bg-[#ffffff]/10">
              <div className="absolute inset-y-0 left-0 w-1/2 animate-[scan_1.2s_ease-in-out_infinite] rounded-full bg-[#b3806e] shadow-[0_0_24px_rgba(179,128,110,0.7)]" />
            </div>
            <div className="mt-6 grid gap-3 text-sm text-[#ffffff]/75">
              <p className="rounded-2xl border border-[#ffffff]/8 bg-[#ffffff]/[0.045] p-4">
                {t.validating}
              </p>
              <p className="rounded-2xl border border-[#ffffff]/8 bg-[#ffffff]/[0.045] p-4">
                {t.terminal}
              </p>
            </div>
          </div>
        ) : null}

        {stage === 'success' && result ? (
          <div className="mt-7 grid gap-5">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <QrPreview value={result.access.qrCode} />
              <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <p className="text-sm text-[#ffffff]/50">{t.locker}</p>
                <p className="mt-1 text-3xl font-semibold text-white">
                  {result.data.number}
                </p>
                <p className="mt-5 text-sm text-[#ffffff]/50">{t.pinCode}</p>
                <p className="mt-1 text-3xl font-semibold tracking-[0.22em] text-[#ffffff]">
                  {result.access.pinCode}
                </p>
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <p className="text-[#ffffff]/50">{t.payment}</p>
                <p className="mt-1 font-semibold text-white">
                  {result.payment.amount.toLocaleString('uz-UZ')} {result.payment.currency}
                </p>
              </div>
              <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <p className="text-[#ffffff]/50">{t.session}</p>
                <p className="mt-1 font-semibold text-[#ffffff]">
                  {result.session.status}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function QrPreview({ value }: { value: string }) {
  return (
    <div className="rounded-2xl border border-[#b3806e]/35 bg-[#ffffff] p-3 shadow-[0_0_30px_rgba(179,128,110,0.25)]">
      <QRCodeSVG value={value} size={136} bgColor="#ffffff" fgColor="#1a212f" level="M" />
    </div>
  );
}
