'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

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
    const saved = window.localStorage.getItem('city-mall-theme') ?? 'dark';
    document.documentElement.classList.toggle('dark', saved === 'dark');
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
