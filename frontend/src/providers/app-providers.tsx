'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

const APP_CACHE_VERSION_KEY = 'city-mall-app-cache-version';
const APP_CACHE_VERSION = '2026-05-10-alerts-v2';
const VERSIONED_DEMO_KEYS = [
  'city-mall-demo-lockers',
  'city-mall-demo-revenue',
  'city-mall-booking-history',
  'city-mall-locker-logs',
  'city-mall-demo-tariffs',
  'city-mall-demo-tariffs-version',
  'city-mall-bookings',
  'city-mall-logs',
];

function resetOutdatedBrowserCache() {
  const currentVersion = window.localStorage.getItem(APP_CACHE_VERSION_KEY);
  if (currentVersion === APP_CACHE_VERSION) {
    return;
  }

  VERSIONED_DEMO_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.setItem(APP_CACHE_VERSION_KEY, APP_CACHE_VERSION);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 10_000,
          },
        },
      }),
  );

  useEffect(() => {
    resetOutdatedBrowserCache();
    const saved = window.localStorage.getItem('city-mall-theme') ?? 'dark';
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
