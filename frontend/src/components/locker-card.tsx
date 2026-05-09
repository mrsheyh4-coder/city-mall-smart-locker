'use client';

import type { Locker } from '@/types/locker';
import { formatLockerNumber } from '@/lib/format';
import type { Translation } from '@/lib/i18n';

interface LockerCardProps {
  locker: Locker;
  isLoading: boolean;
  isDisabled: boolean;
  t: Translation;
  onPay: (locker: Locker) => void;
  onToggle: (locker: Locker) => void;
  onMaintenance: (locker: Locker) => void;
  onRelease: (locker: Locker) => void;
  onValidateAccess: (locker: Locker, credential: string) => void;
}

const statusStyles = {
  AVAILABLE: 'border-[#ffffff]/25 bg-[#ffffff]/10 text-[#ffffff]',
  OCCUPIED: 'border-[#b3806e]/60 bg-[#b3806e]/18 text-[#ffffff] bronze-glow',
  RESERVED: 'border-[#b3806e]/45 bg-[#b3806e]/12 text-[#ffffff]',
  EXPIRED: 'border-[#ffffff]/35 bg-[#ffffff]/8 text-[#ffffff]/75',
  MAINTENANCE: 'border-[#b3806e]/25 bg-[#1a212f]/60 text-[#ffffff]/70',
};

export function LockerCard({
  locker,
  isLoading,
  isDisabled,
  t,
  onPay,
  onToggle,
  onMaintenance,
  onRelease,
  onValidateAccess,
}: LockerCardProps) {
  const statusText = {
    AVAILABLE: t.statusAvailable,
    OCCUPIED: t.statusOccupied,
    RESERVED: t.statusReserved,
    EXPIRED: t.statusExpired,
    MAINTENANCE: t.statusMaintenance,
  };
  const sizeText = {
    SMALL: t.sizeSmall,
    MEDIUM: t.sizeMedium,
    LARGE: t.sizeLarge,
  };
  const expiryTime = locker.bookingExpiresAt
    ? Math.max(0, new Date(locker.bookingExpiresAt).getTime() - Date.now())
    : null;
  const minutesLeft =
    expiryTime === null ? null : Math.floor(expiryTime / 60_000);
  const secondsLeft =
    expiryTime === null ? null : Math.floor((expiryTime % 60_000) / 1000);
  const suggestedCredential = locker.pinCode ?? locker.qrCode ?? '';
  const canFinish =
    locker.status !== 'AVAILABLE' && locker.status !== 'MAINTENANCE';
  const expiryLabel =
    locker.status === 'EXPIRED'
      ? t.expiredText
      : minutesLeft === null
        ? '-'
        : `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <article className="luxury-card group relative overflow-hidden rounded-[1.85rem] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#b3806e]/50 hover:bg-[#ffffff]/[0.09]">
      <div className="bronze-line absolute inset-x-8 top-0 h-px opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase text-[#ffffff]/42">{t.smartCell}</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{formatLockerNumber(locker.number)}</h2>
          <p className="mt-1 text-xs font-semibold uppercase text-[#ffffff]/70">
            {t.lockerSize}: {sizeText[locker.size]}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[locker.status]}`}>
          {statusText[locker.status]}
        </span>
      </div>

      <div className="mt-7 flex items-center justify-center">
        <div className={`relative grid h-28 w-24 place-items-center rounded-2xl border transition duration-500 ${
          locker.isOpen
            ? 'rotate-2 border-[#b3806e]/70 bg-[#b3806e]/15 shadow-[0_0_38px_rgba(179,128,110,0.34)]'
            : 'border-[#ffffff]/10 bg-[#1a212f]/80'
        }`}>
          <div className="absolute inset-y-4 right-3 w-1 rounded-full bg-[#b3806e]/80 shadow-[0_0_18px_rgba(179,128,110,0.65)]" />
          <div className={`h-5 w-5 rounded-full border border-[#ffffff]/20 transition ${locker.isOpen ? 'bg-[#b3806e]' : 'bg-[#ffffff]/10'}`} />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-[#ffffff]/8 bg-[#1a212f]/55 p-3">
          <p className="text-[#ffffff]/42">{t.door}</p>
          <p className="mt-1 font-semibold text-white">{locker.isOpen ? t.open : t.closed}</p>
        </div>
        <div className="rounded-2xl border border-[#ffffff]/8 bg-[#1a212f]/55 p-3">
          <p className="text-[#ffffff]/42">PIN</p>
          <p className="mt-1 font-semibold text-white">{locker.pinCode ?? t.ready}</p>
        </div>
        <div className="rounded-2xl border border-[#ffffff]/8 bg-[#1a212f]/55 p-3">
          <p className="text-[#ffffff]/42">{t.customer}</p>
          <p className="mt-1 truncate font-semibold text-white">
            {formatCustomerName(locker.customerName, t)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#ffffff]/8 bg-[#1a212f]/55 p-3">
          <p className="text-[#ffffff]/42">{t.expires}</p>
          <p className="mt-1 font-semibold text-white">{expiryLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {locker.status === 'AVAILABLE' ? (
          <button
            type="button"
            onClick={() => onPay(locker)}
            disabled={isDisabled}
            className="h-11 w-full rounded-2xl border border-[#b3806e]/60 bg-[#b3806e] px-4 text-sm font-bold text-[#ffffff] shadow-[0_0_28px_rgba(179,128,110,0.32)] transition hover:-translate-y-0.5 hover:bg-[#ffffff] hover:text-[#1a212f] disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? t.processing : t.payNow}
          </button>
        ) : null}

        {locker.status === 'EXPIRED' ? (
          <button
            type="button"
            onClick={() => onRelease(locker)}
            className="h-11 w-full rounded-2xl border border-[#b3806e]/50 bg-[#b3806e]/20 px-4 text-sm font-bold text-[#ffffff] shadow-[0_0_28px_rgba(179,128,110,0.22)] transition hover:bg-[#b3806e]"
          >
            {t.releaseLocker}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onToggle(locker)}
          disabled={isDisabled}
          className="h-11 w-full rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.065] px-4 text-sm font-bold text-[#ffffff] transition hover:border-[#b3806e]/50 hover:bg-[#b3806e]/16 disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading
            ? t.syncingButton
            : locker.isOpen
              ? t.closeLocker
              : t.openLocker}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onValidateAccess(locker, suggestedCredential)}
            disabled={!suggestedCredential}
            className="h-10 rounded-xl border border-[#b3806e]/25 bg-[#b3806e]/10 px-3 text-xs font-bold text-[#ffffff] transition hover:bg-[#b3806e]/20 disabled:opacity-40"
          >
            {t.validate}
          </button>
          <button
            type="button"
            onClick={() => onRelease(locker)}
            disabled={!canFinish}
            className="h-10 rounded-xl border border-[#b3806e]/25 bg-[#b3806e]/10 px-3 text-xs font-bold text-[#ffffff] transition hover:bg-[#b3806e]/20 disabled:opacity-40"
          >
            {t.expire}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onMaintenance(locker)}
          className="h-10 rounded-xl border border-[#ffffff]/10 bg-[#ffffff]/[0.045] px-3 text-xs font-bold text-[#ffffff]/85 transition hover:border-[#b3806e]/35 hover:bg-[#ffffff]/[0.1]"
        >
          {locker.status === 'MAINTENANCE' ? t.returnToService : t.maintenance}
        </button>
      </div>
    </article>
  );
}

function formatCustomerName(customerName: string | null | undefined, t: Translation) {
  if (!customerName) {
    return '-';
  }

  const demoMatch = customerName.match(/^(Demo customer|Customer)\s+(\d+)$/i);

  if (demoMatch) {
    return `${t.demoCustomer} ${demoMatch[2]}`;
  }

  if (customerName === 'Walk-in customer' || customerName === 'Terminal customer') {
    return t.demoCustomer;
  }

  return customerName;
}
