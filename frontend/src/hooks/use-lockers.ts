'use client';

import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import type { DemoPaymentResponse, Locker, LockerSummary } from '@/types/locker';
import {
  fetchLockers,
  getEmptyLockerState,
  resetDemoSystem,
  sendLockerAdminCommand,
  sendLockerCommand,
  setLockerMaintenance,
  simulateDemoPayment,
  verifyAccess,
} from '@/services/locker-service';

type PaymentStage = 'idle' | 'processing' | 'authorizing' | 'success';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

function translateAccessReasonUz(reason: string | undefined) {
  const dictionary: Record<string, string> = {
    'Access granted': 'Kirishga ruxsat berildi',
    'Access code expired or already used': 'Kirish kodi muddati tugagan yoki ishlatilgan',
    'Invalid access credential': "Kirish ma'lumoti noto'g'ri",
    'Invalid PIN or QR': "PIN yoki QR kodi noto'g'ri",
    'Booking expired': 'Buyurtma muddati tugagan',
    'Locker not found': 'Yashik topilmadi',
    'Access temporarily locked, contact an operator': 'Kirish vaqtincha bloklangan, operatorga murojaat qiling',
  };

  return reason ? dictionary[reason] ?? reason : 'Kirish amalga oshmadi';
}

export function useLockers() {
  const emptyState = getEmptyLockerState();
  const [lockers, setLockers] = useState<Locker[]>(() => emptyState.data);
  const [serverSummary, setServerSummary] = useState<LockerSummary>(
    () => emptyState.meta,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadingLockers, setLoadingLockers] = useState<Set<number>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [paymentStage, setPaymentStage] = useState<PaymentStage>('idle');
  const [paymentResult, setPaymentResult] =
    useState<DemoPaymentResponse | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  async function refreshLockers(options: { quiet?: boolean } = {}) {
    if (!options.quiet) {
      setIsLoading(true);
    }

    try {
      const response = await fetchLockers();
      setLockers(response.data);
      setServerSummary(response.meta);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Locker refresh failed',
      );
    } finally {
      if (!options.quiet) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshLockers();

    const interval = window.setInterval(() => {
      void refreshLockers({ quiet: true });
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    socket.on('lockers:updated', (payload?: { data?: Locker[]; meta?: LockerSummary }) => {
      if (payload?.data && payload.meta) {
        setLockers(payload.data);
        setServerSummary(payload.meta);
        setIsLoading(false);
        return;
      }

      void refreshLockers({ quiet: true });
    });

    socket.on('booking:updated', () => {
      void refreshLockers({ quiet: true });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const summary = useMemo(
    () => {
      const active = lockers.filter(
        (locker) => locker.status !== 'AVAILABLE' && locker.status !== 'MAINTENANCE',
      ).length;

      return {
        total: lockers.length,
        available: lockers.filter((locker) => locker.status === 'AVAILABLE').length,
        occupied: lockers.filter((locker) => locker.status === 'OCCUPIED').length,
        reserved: lockers.filter((locker) => locker.status === 'RESERVED').length,
        expired: lockers.filter((locker) => locker.status === 'EXPIRED').length,
        maintenance: lockers.filter((locker) => locker.status === 'MAINTENANCE').length,
        open: lockers.filter((locker) => locker.isOpen).length,
        active,
        activeSessions: serverSummary.activeSessions,
        demoRevenue: serverSummary.demoRevenue,
        occupiedPercentage:
          lockers.length === 0 ? 0 : Math.round((active / lockers.length) * 100),
      };
    },
    [lockers, serverSummary.activeSessions, serverSummary.demoRevenue],
  );

  async function toggleLocker(locker: Locker) {
    const command = locker.isOpen ? 'close' : 'open';
    const previousLocker = locker;

    setLoadingLockers((current) => new Set(current).add(locker.number));
    setError(null);

    setLockers((current) =>
      current.map((item) =>
        item.number === locker.number
          ? {
              ...item,
              isOpen: !item.isOpen,
            }
          : item,
      ),
    );

    try {
      const response = await sendLockerCommand(locker.number, command);
      setLockers((current) =>
        current.map((item) =>
          item.number === response.data.number ? response.data : item,
        ),
      );
    } catch (requestError) {
      setLockers((current) =>
        current.map((item) =>
          item.number === previousLocker.number ? previousLocker : item,
        ),
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Locker command failed',
      );
    } finally {
      setLoadingLockers((current) => {
        const next = new Set(current);
        next.delete(locker.number);
        return next;
      });
    }
  }

  async function setMaintenance(locker: Locker) {
    const previousLocker = locker;

    setLoadingLockers((current) => new Set(current).add(locker.number));
    setError(null);

    try {
      const response = await setLockerMaintenance(locker.number);
      setLockers((current) =>
        current.map((item) =>
          item.number === response.data.number ? response.data : item,
        ),
      );
      void refreshLockers({ quiet: true });
    } catch (requestError) {
      setLockers((current) =>
        current.map((item) =>
          item.number === previousLocker.number ? previousLocker : item,
        ),
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Maintenance command failed',
      );
    } finally {
      setLoadingLockers((current) => {
        const next = new Set(current);
        next.delete(locker.number);
        return next;
      });
    }
  }

  async function expireLocker(locker: Locker) {
    const previousLocker = locker;

    setLoadingLockers((current) => new Set(current).add(locker.number));
    setError(null);

    try {
      const response = await sendLockerAdminCommand(locker.number, 'expire');
      setLockers((current) =>
        current.map((item) =>
          item.number === response.data.number ? response.data : item,
        ),
      );
      void refreshLockers({ quiet: true });
    } catch (requestError) {
      setLockers((current) =>
        current.map((item) =>
          item.number === previousLocker.number ? previousLocker : item,
        ),
      );
      setError(
        requestError instanceof Error ? requestError.message : 'Expire failed',
      );
    } finally {
      setLoadingLockers((current) => {
        const next = new Set(current);
        next.delete(locker.number);
        return next;
      });
    }
  }

  async function releaseLocker(locker: Locker) {
    const previousLocker = locker;

    setLoadingLockers((current) => new Set(current).add(locker.number));
    setError(null);

    setLockers((current) =>
      current.map((item) =>
        item.number === locker.number
          ? {
              ...item,
              status: 'AVAILABLE',
              isOpen: false,
              pinCode: null,
              qrCode: null,
              customerName: null,
              bookingStartAt: null,
              bookingExpiresAt: null,
            }
          : item,
      ),
    );

    try {
      const response = await sendLockerAdminCommand(locker.number, 'release');
      setLockers((current) =>
        current.map((item) =>
          item.number === response.data.number ? response.data : item,
        ),
      );
      void refreshLockers({ quiet: true });
    } catch (requestError) {
      setLockers((current) =>
        current.map((item) =>
          item.number === previousLocker.number ? previousLocker : item,
        ),
      );
      setError(
        requestError instanceof Error ? requestError.message : 'Release failed',
      );
    } finally {
      setLoadingLockers((current) => {
        const next = new Set(current);
        next.delete(locker.number);
        return next;
      });
    }
  }

  function validateAccess(locker: Locker, credential: string) {
    void (async () => {
      const result = await verifyAccess(locker.number, credential);
      setAccessMessage(
        `${locker.number}: ${result.valid ? translateAccessReasonUz('Access granted') : translateAccessReasonUz(result.reason)}`,
      );
      void refreshLockers({ quiet: true });
    })();
  }

  async function payForLocker(locker: Locker) {
    const previousLocker = locker;

    setPaymentResult(null);
    setPaymentStage('processing');
    setLoadingLockers((current) => new Set(current).add(locker.number));
    setError(null);

    await delay(900);
    setPaymentStage('authorizing');
    await delay(900);

    setLockers((current) =>
      current.map((item) =>
        item.number === locker.number
          ? {
              ...item,
              status: 'OCCUPIED',
              isOpen: true,
              pinCode: item.pinCode ?? String(100000 + ((item.number * 137) % 900000)),
            }
          : item,
      ),
    );

    try {
      const response = await simulateDemoPayment(locker.number);
      setPaymentResult(response);
      setPaymentStage('success');
      setLockers((current) =>
        current.map((item) =>
          item.number === response.data.number ? response.data : item,
        ),
      );
      void refreshLockers({ quiet: true });
    } catch (requestError) {
      setPaymentStage('idle');
      setLockers((current) =>
        current.map((item) =>
          item.number === previousLocker.number ? previousLocker : item,
        ),
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Demo payment failed',
      );
    } finally {
      setLoadingLockers((current) => {
        const next = new Set(current);
        next.delete(locker.number);
        return next;
      });
    }
  }

  async function runDemoSale() {
    const availableLocker = lockers.find((locker) => locker.status === 'AVAILABLE');

    if (!availableLocker) {
      setError('No available box is available for the demo sale');
      return;
    }

    await payForLocker(availableLocker);
  }

  async function resetDemo() {
    setIsLoading(true);
    setPaymentStage('idle');
    setPaymentResult(null);
    setError(null);

    try {
      const response = await resetDemoSystem();
      setLockers(response.data);
      setServerSummary(response.meta);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Reset failed',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  function closePaymentResult() {
    setPaymentStage('idle');
    setPaymentResult(null);
  }

  return {
    lockers,
    summary,
    isLoading,
    loadingLockers,
    error,
    accessMessage,
    paymentStage,
    paymentResult,
    clearError,
    closePaymentResult,
    payForLocker,
    refreshLockers,
    resetDemo,
    runDemoSale,
    setMaintenance,
    expireLocker,
    releaseLocker,
    toggleLocker,
    validateAccess,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
