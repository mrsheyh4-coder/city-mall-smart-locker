'use client';

import { useEffect, useState } from 'react';
import { useLockers } from '@/hooks/use-lockers';
import { languages, type Language, translations } from '@/lib/i18n';
import { ErrorToast } from './error-toast';
import { LockerCard } from './locker-card';
import { PaymentModal } from './payment-modal';
import { StatCard } from './stat-card';

export function Dashboard() {
  const [language, setLanguage] = useState<Language>('uz');
  const [filter, setFilter] = useState<
    'all' | 'available' | 'occupied' | 'reserved' | 'expired' | 'maintenance' | 'open'
  >('all');
  const [, setTimerTick] = useState(0);
  const t = translations[language];
  const {
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
    releaseLocker,
    toggleLocker,
    validateAccess,
  } = useLockers();

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem('city-mall-language');

    if (savedLanguage === 'uz' || savedLanguage === 'ru' || savedLanguage === 'en') {
      setLanguage(savedLanguage);
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTimerTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem('city-mall-language', nextLanguage);
    document.documentElement.lang = nextLanguage;
  }

  const filteredLockers = lockers.filter((locker) => {
    if (filter === 'available') {
      return locker.status === 'AVAILABLE';
    }

    if (filter === 'occupied') {
      return locker.status === 'OCCUPIED';
    }

    if (filter === 'reserved') {
      return locker.status === 'RESERVED';
    }

    if (filter === 'expired') {
      return locker.status === 'EXPIRED';
    }

    if (filter === 'maintenance') {
      return locker.status === 'MAINTENANCE';
    }

    if (filter === 'open') {
      return locker.isOpen;
    }

    return true;
  });

  const filters = [
    { id: 'all', label: t.filterAll, count: lockers.length },
    { id: 'available', label: t.filterAvailable, count: summary.available },
    { id: 'occupied', label: t.filterOccupied, count: summary.occupied },
    { id: 'reserved', label: t.filterReserved, count: summary.reserved },
    { id: 'expired', label: t.filterExpired, count: summary.expired },
    { id: 'maintenance', label: t.filterMaintenance, count: summary.maintenance },
    { id: 'open', label: t.filterOpen, count: summary.open },
  ] as const;

  return (
    <main className="luxury-bg min-h-screen overflow-hidden text-[#ffffff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(179,128,110,0.20),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.10),transparent_28%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="luxury-card-strong flex flex-col gap-6 rounded-[2rem] p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-[#b3806e]/35 bg-[#b3806e]/12 px-4 py-2 text-xs font-semibold uppercase text-[#ffffff] shadow-[0_0_28px_rgba(179,128,110,0.20)]">
              {t.badge}
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-[#ffffff] sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#ffffff]/70">
              {t.subtitle}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[#b3806e]/25 bg-[#1a212f]/55 p-4 text-sm text-[#ffffff]/72">
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-full border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-1">
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => changeLanguage(item.code)}
                  className={`min-h-9 rounded-full px-3 text-xs font-semibold transition ${
                    language === item.code
                      ? 'bg-[#b3806e] text-[#ffffff]'
                      : 'text-[#ffffff]/70 hover:bg-[#ffffff]/10 hover:text-[#ffffff]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="font-semibold text-[#ffffff]">{t.systemMode}</p>
            <p className="mt-1">{t.demoActive}</p>
            <p className="mt-3 text-xs text-[#ffffff]/65">
              {t.databaseState}: {isLoading ? t.syncing : t.live}
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label={t.totalLockers} value={summary.total} tone="bronze" />
          <StatCard label={t.activeSessions} value={summary.activeSessions} tone="glass" />
          <StatCard label={t.occupiedLockers} value={summary.occupied} tone="solid" />
          <StatCard label={t.availableLockers} value={summary.available} tone="light" />
          <StatCard
            label={t.demoRevenue}
            value={summary.demoRevenue}
            suffix=" UZS"
            tone="bronze"
          />
        </section>

        {accessMessage ? (
          <section className="rounded-2xl border border-[#b3806e]/30 bg-[#b3806e]/10 p-4 text-sm font-semibold text-[#ffffff]">
            {t.accessCheck}: {accessMessage}
          </section>
        ) : null}

        <section className="luxury-card rounded-[1.85rem] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-lg font-semibold text-white">{t.adminConsole}</p>
              <p className="mt-1 text-sm text-[#ffffff]/68">{t.adminConsoleNote}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => void refreshLockers()}
                className="min-h-11 rounded-xl border border-[#ffffff]/15 bg-[#ffffff]/[0.07] px-4 text-sm font-bold text-[#ffffff] transition hover:border-[#b3806e]/55 hover:bg-[#b3806e]/16"
              >
                {t.refresh}
              </button>
              <button
                type="button"
                onClick={() => void runDemoSale()}
                className="min-h-11 rounded-xl border border-[#b3806e]/70 bg-[#b3806e] px-4 text-sm font-bold text-[#ffffff] shadow-[0_0_28px_rgba(179,128,110,0.30)] transition hover:bg-[#ffffff] hover:text-[#1a212f]"
              >
                {t.demoSale}
              </button>
              <button
                type="button"
                onClick={() => void resetDemo()}
                className="min-h-11 rounded-xl border border-[#b3806e]/35 bg-[#b3806e]/10 px-4 text-sm font-bold text-[#ffffff] transition hover:bg-[#b3806e]/22"
              >
                {t.resetDemo}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${
                  filter === item.id
                    ? 'border-[#b3806e] bg-[#b3806e] text-[#ffffff]'
                    : 'border-[#ffffff]/10 bg-[#1a212f]/45 text-[#ffffff]/75 hover:border-[#b3806e]/45 hover:text-[#ffffff]'
                }`}
              >
                {item.label} <span className="ml-1 opacity-70">{item.count}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#ffffff]/55">
            {t.showing}: {filteredLockers.length}
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLockers.map((locker) => (
            <LockerCard
              key={locker.id}
              locker={locker}
              isLoading={loadingLockers.has(locker.number)}
              isDisabled={loadingLockers.has(locker.number)}
              t={t}
              onPay={payForLocker}
              onToggle={toggleLocker}
              onMaintenance={setMaintenance}
              onRelease={releaseLocker}
              onValidateAccess={validateAccess}
            />
          ))}
        </section>

        {!isLoading && filteredLockers.length === 0 ? (
          <div className="luxury-card rounded-2xl p-5 text-sm text-[#ffffff]/75">
            {t.noLockers}
          </div>
        ) : null}

        {isLoading ? (
          <div className="luxury-card rounded-2xl p-5 text-sm text-[#ffffff]/75">
            {t.loadingState}
          </div>
        ) : null}
      </div>
      <PaymentModal
        stage={paymentStage}
        result={paymentResult}
        t={t}
        onClose={closePaymentResult}
      />
      {error ? <ErrorToast message={error} t={t} onDismiss={clearError} /> : null}
    </main>
  );
}
