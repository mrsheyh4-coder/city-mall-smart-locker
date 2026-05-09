import { create } from 'zustand';
import type { Locker } from '@/types/locker';

export type Booking = {
  id: string;
  lockerNumber: number;
  customer: string;
  durationMinutes: number;
  pinCode: string;
  qrCode: string;
  amount: number;
  createdAt: string;
};

export type SystemLog = {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  createdAt: string;
};

type SystemState = {
  bookings: Booking[];
  logs: SystemLog[];
  addBooking: (locker: Locker, customer: string, durationMinutes: number) => Booking;
  addLog: (message: string, level?: SystemLog['level']) => void;
  clearDemoData: () => void;
};

const BOOKINGS_KEY = 'city-mall-bookings';
const LOGS_KEY = 'city-mall-logs';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : fallback;
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const useSystemStore = create<SystemState>((set, get) => ({
  bookings: readJson<Booking[]>(BOOKINGS_KEY, []),
  logs: readJson<SystemLog[]>(LOGS_KEY, [
    {
      id: 'seed-log',
      level: 'INFO',
      message: 'Demo system initialized for Tashkent City Mall.',
      createdAt: new Date().toISOString(),
    },
  ]),
  addBooking: (locker, customer, durationMinutes) => {
    const amount = Math.max(1, Math.round(durationMinutes / 60)) * 15000;
    const booking: Booking = {
      id: crypto.randomUUID(),
      lockerNumber: locker.number,
      customer,
      durationMinutes,
      pinCode: locker.pinCode ?? `${locker.number}${1000 + locker.number * 137}`,
      qrCode: `TCM-${locker.number}-${Date.now()}`,
      amount,
      createdAt: new Date().toISOString(),
    };
    const bookings = [booking, ...get().bookings].slice(0, 30);
    writeJson(BOOKINGS_KEY, bookings);
    set({ bookings });
    get().addLog(`Booking created for locker L-${String(locker.number).padStart(2, '0')}`);
    return booking;
  },
  addLog: (message, level = 'INFO') => {
    const logs = [
      { id: crypto.randomUUID(), level, message, createdAt: new Date().toISOString() },
      ...get().logs,
    ].slice(0, 80);
    writeJson(LOGS_KEY, logs);
    set({ logs });
  },
  clearDemoData: () => {
    writeJson(BOOKINGS_KEY, []);
    writeJson(LOGS_KEY, []);
    set({ bookings: [], logs: [] });
  },
}));
