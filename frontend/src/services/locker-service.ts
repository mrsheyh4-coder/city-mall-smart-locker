import type {
  AdminStatistics,
  AdminReport,
  BookingResponse,
  DemoPaymentResponse,
  AccessValidationResponse,
  Locker,
  LockerSize,
  LockersResponse,
  Tariff,
  Booking,
} from '@/types/locker';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const API_HEADERS = {
  'X-API-Version': '1',
};
const SMS_REQUEST_TIMEOUT_MS = 8000;
const ADMIN_TOKEN_KEY = 'city-mall-admin-token';
const DEMO_LOCKERS_KEY = 'city-mall-demo-lockers';
const DEMO_REVENUE_KEY = 'city-mall-demo-revenue';
const DEMO_HISTORY_KEY = 'city-mall-booking-history';
const DEMO_LOGS_KEY = 'city-mall-locker-logs';
const DEMO_TARIFFS_KEY = 'city-mall-demo-tariffs';
const DEMO_TARIFFS_VERSION_KEY = 'city-mall-demo-tariffs-version';
const DEMO_TARIFFS_VERSION = '2026-05-09-size-based-v1';

type DemoHistoryItem = {
  id: string;
  lockerNumber: number;
  phone?: string;
  customerName?: string | null;
  startAt: string;
  expiresAt: string;
  amount?: number;
  pinCode?: string | null;
  qrCode?: string | null;
  status?: Booking['status'];
  durationMinutes?: number;
  createdAt?: string;
};

function summarize(lockers: Locker[]) {
  const active = lockers.filter((locker) => locker.status !== 'AVAILABLE').length;

  return {
    total: lockers.length,
    available: lockers.filter((locker) => locker.status === 'AVAILABLE').length,
    occupied: lockers.filter((locker) => locker.status === 'OCCUPIED').length,
    reserved: lockers.filter((locker) => locker.status === 'RESERVED').length,
    expired: lockers.filter((locker) => locker.status === 'EXPIRED').length,
    maintenance: lockers.filter((locker) => locker.status === 'MAINTENANCE').length,
    open: lockers.filter((locker) => locker.isOpen).length,
    active,
    activeSessions: 0,
    demoRevenue: 0,
    occupiedPercentage:
      lockers.length === 0 ? 0 : Math.round((active / lockers.length) * 100),
  };
}

export function getEmptyLockerState(): LockersResponse {
  return {
    data: [],
    meta: summarize([]),
  };
}

export async function fetchLockers(): Promise<LockersResponse> {
  try {
    const response = await fetch(`${API_URL}/lockers`, {
      cache: 'no-store',
      headers: API_HEADERS,
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    if (shouldDisableDemoFallback()) {
      throw error;
    }

    return getDemoLockerState();
  }
}

export async function fetchAdminStatistics(): Promise<AdminStatistics> {
  try {
    const response = await fetch(`${API_URL}/admin/statistics`, {
      cache: 'no-store',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        if (hasAdminToken() || shouldDisableDemoFallback()) {
          throw new Error('Admin authentication is required');
        }

        return buildDemoAdminStatistics();
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return buildDemoAdminStatistics();
  }
}

export async function fetchTariffs(): Promise<Tariff[]> {
  try {
    const response = await fetch(`${API_URL}/tariffs`, {
      cache: 'no-store',
      headers: API_HEADERS,
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return buildLocalTariffs().filter((tariff) => tariff.isActive);
  }
}

export async function sendLockerCommand(
  lockerId: number,
  command: 'open' | 'close',
): Promise<{ data: Locker }> {
  if (isDemoAdminSession()) {
    return { data: updateDemoLocker(lockerId, command) };
  }

  try {
    const response = await fetch(`${API_URL}/locker/${command}`, {
      method: 'POST',
      headers: getAdminHeaders(true),
      body: JSON.stringify({ lockerId }),
    });

    if (!response.ok) {
      if (shouldUseDemoFallback(response)) {
        return { data: updateDemoLocker(lockerId, command) };
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return { data: updateDemoLocker(lockerId, command) };
  }
}

export async function sendLockerAdminCommand(
  lockerId: number,
  command: 'release' | 'expire' | 'maintenance',
): Promise<{ data: Locker }> {
  if (isDemoAdminSession()) {
    return { data: runDemoLockerAdminCommand(lockerId, command) };
  }

  try {
    const response = await fetch(`${API_URL}/locker/${command}`, {
      method: 'POST',
      headers: getAdminHeaders(true),
      body: JSON.stringify({ lockerId }),
    });

    if (!response.ok) {
      if (shouldUseDemoFallback(response)) {
        return { data: runDemoLockerAdminCommand(lockerId, command) };
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return { data: runDemoLockerAdminCommand(lockerId, command) };
  }
}

export async function setLockerMaintenance(
  lockerId: number,
): Promise<{ data: Locker }> {
  return sendLockerAdminCommand(lockerId, 'maintenance');
}

export async function createBooking(input: {
  lockerId: number;
  lockerSize: LockerSize;
  durationMinutes: number;
  phone: string;
  customerName?: string;
  language?: 'uz' | 'ru' | 'en';
  termsAccepted: boolean;
  smsVerificationToken?: string;
}): Promise<BookingResponse> {
  const response = await fetch(`${API_URL}/booking/create`, {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return response.json();
}

export async function requestSmsAuth(phone: string, language?: 'uz' | 'ru' | 'en'): Promise<{
  sent: boolean;
  expiresAt: string;
  devCode?: string;
}> {
  assertProductionApiUrl();

  try {
    const response = await fetchWithTimeout(`${API_URL}/sms/auth/request`, {
      method: 'POST',
      headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, language }),
    }, SMS_REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    if (shouldDisableDemoFallback()) {
      throw error;
    }

    const devCode = createLocalSmsCode(phone);
    return {
      sent: true,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      devCode,
    };
  }
}

export async function verifySmsAuth(phone: string, code: string): Promise<{
  verified: boolean;
  token: string;
  expiresAt: string;
}> {
  assertProductionApiUrl();

  try {
    const response = await fetchWithTimeout(`${API_URL}/sms/auth/verify`, {
      method: 'POST',
      headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    }, SMS_REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    if (shouldDisableDemoFallback()) {
      throw error;
    }

    if (code !== getLocalSmsCode(phone)) {
      throw new Error('Invalid SMS code.');
    }

    return {
      verified: true,
      token: `demo-sms-${Date.now()}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
  }
}

export async function mockPayment(bookingId: string): Promise<DemoPaymentResponse> {
  const response = await fetch(`${API_URL}/payment/mock`, {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId }),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response));
  }

  return response.json();
}

export async function simulateDemoPayment(
  lockerId: number,
  durationMinutes = 120,
): Promise<DemoPaymentResponse> {
  try {
    const response = await fetch(`${API_URL}/locker/demo-payment`, {
      method: 'POST',
      headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lockerId, durationMinutes }),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return simulateLocalDemoPayment(lockerId, durationMinutes);
  }
}

export async function verifyAccess(
  lockerId: number,
  credential: string,
): Promise<AccessValidationResponse> {
  try {
    const response = await fetch(`${API_URL}/access/verify`, {
      method: 'POST',
      headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lockerId, credential }),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return validateDemoAccess(lockerId, credential);
  }
}

export function resetDemoLockerState() {
  const lockers = createDemoLockers();
  saveDemoLockers(lockers);
  setDemoRevenue(0);
  saveJson(DEMO_HISTORY_KEY, []);
  saveJson(DEMO_LOGS_KEY, []);

  return getDemoLockerState();
}

export async function resetDemoSystem(): Promise<LockersResponse> {
  try {
    const response = await fetch(`${API_URL}/demo/reset`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return resetDemoLockerState();
  }
}

export async function createAdminTariff(input: Omit<Tariff, 'id'>): Promise<Tariff> {
  if (isDemoAdminSession()) {
    return createDemoTariff(input);
  }

  try {
    const response = await fetch(`${API_URL}/admin/tariffs`, {
      method: 'POST',
      headers: getAdminHeaders(true),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return createDemoTariff(input);
  }
}

export async function updateAdminTariff(id: string, input: Omit<Tariff, 'id'>): Promise<Tariff> {
  if (isDemoAdminSession()) {
    return updateDemoTariff(id, input);
  }

  try {
    const response = await fetch(`${API_URL}/admin/tariffs/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(true),
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return updateDemoTariff(id, input);
  }
}

export async function deleteAdminTariff(id: string): Promise<Tariff> {
  if (isDemoAdminSession()) {
    return deleteDemoTariff(id);
  }

  try {
    const response = await fetch(`${API_URL}/admin/tariffs/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return deleteDemoTariff(id);
  }
}

export async function completeAdminBooking(id: string): Promise<Booking> {
  return postAdminBookingAction(id, 'complete');
}

export async function cancelAdminBooking(id: string): Promise<Booking> {
  return postAdminBookingAction(id, 'cancel');
}

export async function reactivateAdminBooking(id: string): Promise<Booking> {
  if (isDemoAdminSession()) {
    return updateDemoBooking(id, 'ACTIVE', 60);
  }

  try {
    const response = await fetch(`${API_URL}/admin/bookings/${id}/reactivate`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      if (shouldUseDemoFallback(response)) {
        return updateDemoBooking(id, 'ACTIVE', 60);
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return updateDemoBooking(id, 'ACTIVE', 60);
  }
}

export async function extendAdminBooking(id: string, durationMinutes: number): Promise<Booking> {
  if (isDemoAdminSession()) {
    return updateDemoBooking(id, 'ACTIVE', durationMinutes);
  }

  try {
    const response = await fetch(`${API_URL}/admin/bookings/${id}/extend`, {
      method: 'POST',
      headers: getAdminHeaders(true),
      body: JSON.stringify({ durationMinutes }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        return updateDemoBooking(id, 'ACTIVE', durationMinutes);
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return updateDemoBooking(id, 'ACTIVE', durationMinutes);
  }
}

export async function revokeAccessCode(id: string) {
  if (isDemoAdminSession()) {
    return revokeDemoAccessCode(id);
  }

  try {
    const response = await fetch(`${API_URL}/admin/access-codes/${id}/revoke`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      if (shouldUseDemoFallback(response)) {
        return revokeDemoAccessCode(id);
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return revokeDemoAccessCode(id);
  }
}

export async function regenerateAccessCode(id: string) {
  if (isDemoAdminSession()) {
    return regenerateDemoAccessCode(id);
  }

  try {
    const response = await fetch(`${API_URL}/admin/access-codes/${id}/regenerate`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      if (shouldUseDemoFallback(response)) {
        return regenerateDemoAccessCode(id);
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return regenerateDemoAccessCode(id);
  }
}

export async function fetchAdminReport(params: { from?: string; to?: string } = {}): Promise<AdminReport> {
  if (isDemoAdminSession()) {
    return buildDemoAdminReport(params);
  }

  const query = new URLSearchParams();
  if (params.from) {
    query.set('from', params.from);
  }
  if (params.to) {
    query.set('to', params.to);
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const response = await fetch(`${API_URL}/admin/reports${suffix}`, {
      cache: 'no-store',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        return buildDemoAdminReport(params);
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return buildDemoAdminReport(params);
  }
}

async function postAdminBookingAction(id: string, action: 'complete' | 'cancel'): Promise<Booking> {
  if (isDemoAdminSession()) {
    return updateDemoBooking(id, action === 'complete' ? 'COMPLETED' : 'CANCELLED');
  }

  try {
    const response = await fetch(`${API_URL}/admin/bookings/${id}/${action}`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });

    if (!response.ok) {
      if (shouldUseDemoFallback(response)) {
        return updateDemoBooking(id, action === 'complete' ? 'COMPLETED' : 'CANCELLED');
      }

      throw new Error(await getApiErrorMessage(response));
    }

    return response.json();
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error;
    }

    return updateDemoBooking(id, action === 'complete' ? 'COMPLETED' : 'CANCELLED');
  }
}

export function setDemoLockerMaintenance(lockerId: number, enabled: boolean) {
  const locker = patchDemoLocker(lockerId, {
    status: enabled ? 'MAINTENANCE' : 'AVAILABLE',
    isOpen: false,
    pinCode: null,
    qrCode: null,
    customerName: null,
    bookingStartAt: null,
    bookingExpiresAt: null,
  });
  addDemoLog(`Locker ${lockerId} moved to ${locker.status}`);
  return locker;
}

export function expireDemoLocker(lockerId: number) {
  const locker = patchDemoLocker(lockerId, {
    status: 'EXPIRED',
    isOpen: false,
  });
  addDemoLog(`Locker ${lockerId} manually expired`, 'WARN');
  return locker;
}

export function releaseDemoLocker(lockerId: number) {
  const locker = patchDemoLocker(lockerId, {
    status: 'AVAILABLE',
    isOpen: false,
    pinCode: null,
    qrCode: null,
    customerName: null,
    bookingStartAt: null,
    bookingExpiresAt: null,
  });
  addDemoLog(`Locker ${lockerId} released and returned to available state`);
  return locker;
}

export function validateDemoAccess(
  lockerId: number,
  credential: string,
): AccessValidationResponse {
  expireDemoLockers();
  const locker = getDemoLockers().find((item) => item.number === lockerId);

  if (!locker) {
    return { valid: false, reason: 'Locker not found' };
  }

  if (locker.status === 'EXPIRED') {
    addDemoLog(`Expired access rejected for locker ${lockerId}`, 'WARN');
    return { valid: false, reason: 'Booking expired', data: locker };
  }

  const valid = credential === locker.pinCode || credential === locker.qrCode;
  const updatedLocker = valid ? releaseDemoLocker(lockerId) : locker;

  addDemoLog(
    `${valid ? 'Access granted' : 'Access denied'} for locker ${lockerId}`,
    valid ? 'INFO' : 'WARN',
  );

  return {
    valid,
    reason: valid ? 'Access granted' : 'Invalid PIN or QR',
    data: updatedLocker,
  };
}

async function getApiErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = body.message;

    return Array.isArray(message)
      ? message.join(', ')
      : message || 'Locker API request failed';
  } catch {
    return 'Locker API request failed';
  }
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function assertProductionApiUrl() {
  if (!IS_PRODUCTION) {
    return;
  }

  const isLocalDemo =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (isLocalDemo) {
    return;
  }

  if (!process.env.NEXT_PUBLIC_API_URL || API_URL.includes('localhost')) {
    throw new Error(
      'Production API URL is not configured. Set NEXT_PUBLIC_API_URL to the deployed backend URL and redeploy the frontend.',
    );
  }
}

function shouldUseDemoFallback(response: Response) {
  return response.status === 401 || response.status === 403 || response.status === 404;
}

function getAdminHeaders(json = false) {
  const token =
    typeof window === 'undefined'
      ? ''
      : window.localStorage.getItem(ADMIN_TOKEN_KEY);

  return {
    ...API_HEADERS,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function hasAdminToken() {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(ADMIN_TOKEN_KEY));
}

function isDemoAdminSession() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    !shouldDisableDemoFallback() &&
    (window.localStorage.getItem(ADMIN_TOKEN_KEY)?.startsWith('demo-admin-') ?? false)
  );
}

function shouldDisableDemoFallback() {
  if (!IS_PRODUCTION || typeof window === 'undefined') {
    return false;
  }

  return !['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function runDemoLockerAdminCommand(
  lockerId: number,
  command: 'release' | 'expire' | 'maintenance',
) {
  if (command === 'release') {
    return releaseDemoLocker(lockerId);
  }

  if (command === 'expire') {
    return expireDemoLocker(lockerId);
  }

  const current = getDemoLockers().find((locker) => locker.number === lockerId);
  return setDemoLockerMaintenance(lockerId, current?.status !== 'MAINTENANCE');
}

function buildDemoAdminStatistics(): AdminStatistics {
  const state = getDemoLockerState();
  const bookings = getDemoBookings();
  const payments = bookings.flatMap((booking) => booking.payments ?? []);
  const logs = getDemoLogs();
  const accessLogs = getDemoAccessLogs(bookings);
  const revenue = Math.max(
    state.meta.demoRevenue,
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  const report = buildDemoAdminReportSummary(
    bookings,
    revenue,
    state.meta.occupiedPercentage,
  );

  return {
    summary: {
      ...state.meta,
      demoRevenue: revenue,
    },
    lockers: state.data,
    bookings,
    payments,
    logs,
    accessLogs,
    tariffs: buildLocalTariffs(),
    admins: [
      {
        id: 'demo-admin',
        email: 'admin@tashkentcitymall.local',
        name: 'City Mall Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
      {
        id: 'demo-operator',
        email: 'operator@tashkentcitymall.local',
        name: 'Mall Operator',
        role: 'OPERATOR',
        isActive: true,
      },
    ],
    revenueSeries: buildDemoRevenueSeries(bookings),
    notifications: [
      {
        id: 'demo-notification-expiring',
        severity: 'WARN',
        title: 'Demo alert',
        message: 'Several demo lockers are reserved or occupied.',
        createdAt: new Date().toISOString(),
      },
    ],
    report,
  };
}

function buildDemoAdminReport(params: { from?: string; to?: string } = {}): AdminReport {
  const statistics = buildDemoAdminStatistics();

  return {
    generatedAt: new Date().toISOString(),
    period: {
      from: params.from ?? null,
      to: params.to ?? null,
    },
    summary: statistics.report,
    revenueSeries: statistics.revenueSeries,
    bookings: statistics.bookings,
    payments: statistics.payments,
    accessLogs: statistics.accessLogs,
  };
}

function buildDemoAdminReportSummary(
  bookings: Booking[],
  revenue: number,
  utilizationRate: number,
) {
  const completedBookings = bookings.filter((booking) => booking.status === 'COMPLETED').length;
  const expiredBookings = bookings.filter((booking) => booking.status === 'EXPIRED').length;
  const cancelledBookings = bookings.filter((booking) => booking.status === 'CANCELLED').length;
  const activeBookings = bookings.filter((booking) => booking.status === 'ACTIVE').length;

  return {
    revenue,
    payments: bookings.flatMap((booking) => booking.payments ?? []).length,
    bookings: bookings.length,
    activeBookings,
    completedBookings,
    expiredBookings,
    cancelledBookings,
    averageDurationMinutes:
      bookings.length === 0
        ? 0
        : Math.round(
            bookings.reduce((sum, booking) => sum + booking.durationMinutes, 0) /
              bookings.length,
          ),
    accessSuccessRate: 96,
    utilizationRate,
  };
}

function getDemoLockerState(): LockersResponse {
  expireDemoLockers();
  const lockers = getDemoLockers();

  return {
    data: lockers,
    meta: {
      ...summarize(lockers),
      activeSessions: lockers.filter((locker) => locker.status === 'OCCUPIED').length,
      demoRevenue: getDemoRevenue(),
    },
  };
}

function getDemoBookings(): Booking[] {
  let history = readJson<DemoHistoryItem[]>(DEMO_HISTORY_KEY, []);
  const lockers = getDemoLockers();
  const now = Date.now();

  if (history.length === 0) {
    history = createDemoHistoryFromLockers(lockers);
    saveJson(DEMO_HISTORY_KEY, history);
  }

  return history.map((item, index) => {
    const locker = lockers.find((candidate) => candidate.number === item.lockerNumber);
    const expiresAt = item.expiresAt ?? new Date().toISOString();
    const status =
      item.status ??
      (new Date(expiresAt).getTime() <= now
        ? 'EXPIRED'
        : locker?.status === 'AVAILABLE'
          ? 'COMPLETED'
          : 'ACTIVE');

    return {
      id: item.id,
      lockerId: locker?.id ?? `demo-locker-${item.lockerNumber}`,
      phone: item.phone ?? `+99891${String(item.lockerNumber).padStart(7, '0')}`,
      customerName: item.customerName ?? 'Demo customer',
      durationMinutes:
        item.durationMinutes ??
        Math.max(60, Math.round((new Date(expiresAt).getTime() - new Date(item.startAt).getTime()) / 60_000)),
      status,
      startTime: item.startAt,
      expiresAt,
      createdAt: item.createdAt ?? item.startAt,
      locker,
      accessCodes: [
        {
          id: `${item.id}-access`,
          bookingId: item.id,
          lockerId: locker?.id ?? `demo-locker-${item.lockerNumber}`,
          pinCode: item.pinCode ?? getDemoPin(item.lockerNumber),
          qrCode: item.qrCode ?? `CITY-MALL-DEMO-${item.lockerNumber}`,
          expiresAt,
          usedAt: null,
          createdAt: item.createdAt ?? item.startAt,
          locker,
        },
      ],
      payments: [
        {
          id: `${item.id}-payment-${index}`,
          amount: item.amount ?? 0,
          currency: 'UZS',
          provider: 'Demo Terminal',
          status: 'SUCCESS',
          paidAt: item.createdAt ?? item.startAt,
        },
      ],
    };
  });
}

function createDemoHistoryFromLockers(lockers: Locker[]): DemoHistoryItem[] {
  return lockers
    .filter((locker) => locker.status === 'OCCUPIED' || locker.status === 'RESERVED')
    .slice(0, 14)
    .map((locker, index) => {
      const startAt =
        locker.bookingStartAt ??
        new Date(Date.now() - (index + 1) * 18 * 60_000).toISOString();
      const expiresAt =
        locker.bookingExpiresAt ??
        new Date(new Date(startAt).getTime() + 120 * 60_000).toISOString();
      const amount =
        buildLocalTariffs().find(
          (tariff) =>
            tariff.lockerSize === locker.size &&
            tariff.durationMinutes === 120 &&
            tariff.isActive,
        )?.price ?? 25000;

      return {
        id: `demo-booking-${locker.number}-${Date.now()}-${index}`,
        lockerNumber: locker.number,
        phone: `+99890${String(1000000 + locker.number).slice(-7)}`,
        customerName: locker.customerName ?? `Demo customer ${index + 1}`,
        startAt,
        expiresAt,
        amount,
        pinCode: locker.pinCode ?? getDemoPin(locker.number),
        qrCode: locker.qrCode ?? `CITY-MALL-DEMO-${locker.number}`,
        status: 'ACTIVE',
        durationMinutes: 120,
        createdAt: startAt,
      };
    });
}

function getDemoLogs(): AdminStatistics['logs'] {
  const logs = readJson<AdminStatistics['logs']>(DEMO_LOGS_KEY, []);
  if (logs.length > 0) {
    return logs;
  }

  return [
    {
      id: 'demo-log-payment',
      level: 'INFO',
      source: 'payment',
      message: 'Demo payment approved and locker opened',
      createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    },
    {
      id: 'demo-log-hardware',
      level: 'INFO',
      source: 'hardware',
      message: 'Mock hardware adapter is online',
      createdAt: new Date(Date.now() - 24 * 60_000).toISOString(),
    },
    {
      id: 'demo-log-expiry',
      level: 'WARN',
      source: 'booking',
      message: 'One demo booking expires soon',
      createdAt: new Date(Date.now() - 35 * 60_000).toISOString(),
    },
  ];
}

function getDemoAccessLogs(bookings: Booking[]): AdminStatistics['accessLogs'] {
  return bookings.slice(0, 8).map((booking, index) => ({
    id: `demo-access-${booking.id}`,
    method: index % 2 === 0 ? 'PIN' : 'QR',
    success: index % 5 !== 0,
    message:
      index % 5 === 0
        ? 'Demo invalid PIN attempt'
        : 'Demo customer access granted',
    createdAt: new Date(Date.now() - (index + 1) * 9 * 60_000).toISOString(),
    locker: booking.locker,
  }));
}

function buildDemoRevenueSeries(bookings: Booking[]) {
  const buckets = new Map<string, number>();

  bookings.forEach((booking) => {
    const date = booking.createdAt.slice(0, 10);
    const amount = booking.payments?.[0]?.amount ?? 0;
    buckets.set(date, (buckets.get(date) ?? 0) + amount);
  });

  const today = new Date().toISOString().slice(0, 10);
  if (!buckets.has(today)) {
    buckets.set(today, 0);
  }

  return Array.from(buckets.entries()).map(([date, amount]) => ({
    date,
    amount,
  }));
}

function updateDemoBooking(
  id: string,
  status: Booking['status'],
  extendMinutes = 0,
): Booking {
  const history = readJson<DemoHistoryItem[]>(DEMO_HISTORY_KEY, []);
  const current = history.find((item) => item.id === id);

  if (!current) {
    throw new Error('Demo booking not found');
  }

  const expiresAt =
    extendMinutes > 0
      ? new Date(Math.max(Date.now(), new Date(current.expiresAt).getTime()) + extendMinutes * 60_000).toISOString()
      : current.expiresAt;
  const nextHistory = history.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          expiresAt,
          durationMinutes: (item.durationMinutes ?? 120) + extendMinutes,
        }
      : item,
  );

  saveJson(DEMO_HISTORY_KEY, nextHistory);

  if (status === 'ACTIVE') {
    patchDemoLocker(current.lockerNumber, {
      status: 'OCCUPIED',
      isOpen: false,
      pinCode: current.pinCode ?? getDemoPin(current.lockerNumber),
      qrCode: current.qrCode ?? `CITY-MALL-DEMO-${current.lockerNumber}`,
      customerName: current.customerName ?? 'Demo customer',
      bookingStartAt: current.startAt,
      bookingExpiresAt: expiresAt,
    });
  } else {
    releaseDemoLocker(current.lockerNumber);
  }

  addDemoLog(`Demo booking ${id} moved to ${status}`);

  const booking = getDemoBookings().find((item) => item.id === id);
  if (!booking) {
    throw new Error('Demo booking not found');
  }

  return booking;
}

function revokeDemoAccessCode(id: string) {
  const history = readJson<DemoHistoryItem[]>(DEMO_HISTORY_KEY, []);
  const bookingId = id.replace(/-access$/, '');
  const nextHistory = history.map((item) =>
    item.id === bookingId ? { ...item, status: 'CANCELLED' as const } : item,
  );

  saveJson(DEMO_HISTORY_KEY, nextHistory);
  addDemoLog(`Demo access code revoked: ${id}`, 'WARN');

  return {
    id,
    usedAt: new Date().toISOString(),
  };
}

function regenerateDemoAccessCode(id: string) {
  const history = readJson<DemoHistoryItem[]>(DEMO_HISTORY_KEY, []);
  const bookingId = id.replace(/-access$/, '');
  let nextCode = '';

  const nextHistory = history.map((item) => {
    if (item.id !== bookingId) {
      return item;
    }

    nextCode = String(Math.floor(100000 + Math.random() * 900000));
    patchDemoLocker(item.lockerNumber, {
      pinCode: nextCode,
      qrCode: `CITY-MALL-DEMO-${item.lockerNumber}-${Date.now()}`,
    });

    return {
      ...item,
      pinCode: nextCode,
      qrCode: `CITY-MALL-DEMO-${item.lockerNumber}-${Date.now()}`,
    };
  });

  saveJson(DEMO_HISTORY_KEY, nextHistory);
  addDemoLog(`Demo access code regenerated: ${id}`);

  return {
    id,
    pinCode: nextCode,
  };
}

function simulateLocalDemoPayment(lockerId: number, durationMinutes = 120) {
  const existingLocker = getDemoLockers().find((item) => item.number === lockerId);
  const amount =
    buildLocalTariffs().find(
      (tariff) =>
        tariff.isActive &&
        tariff.durationMinutes === durationMinutes &&
        tariff.lockerSize === existingLocker?.size,
    )?.price ?? Math.max(1, Math.round(durationMinutes / 60)) * 15000;
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
  const pinCode = getDemoPin(lockerId);
  const qrCode = `CITY-MALL-DEMO-${lockerId}-${Date.now()}`;
  const locker = patchDemoLocker(lockerId, {
    status: 'OCCUPIED',
    isOpen: true,
    pinCode,
    qrCode,
    customerName: 'Walk-in customer',
    bookingStartAt: startedAt.toISOString(),
    bookingExpiresAt: expiresAt.toISOString(),
  });
  const revenue = getDemoRevenue() + amount;
  setDemoRevenue(revenue);

  addDemoHistory({
    id: `demo-booking-${lockerId}-${Date.now()}`,
    lockerNumber: locker.number,
    phone: '+998910000002',
    customerName: locker.customerName ?? 'Walk-in customer',
    startAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    amount,
    pinCode,
    qrCode,
    status: 'ACTIVE',
    durationMinutes,
    createdAt: new Date().toISOString(),
  });
  addDemoLog(`Payment approved and booking started for locker ${lockerId}`);

  return {
    data: locker,
    session: {
      id: `demo-session-${lockerId}-${Date.now()}`,
      lockerId: locker.id,
        startTime: startedAt.toISOString(),
        endTime: expiresAt.toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    },
    payment: {
      id: `demo-payment-${lockerId}-${Date.now()}`,
      amount,
      currency: 'UZS',
      provider: 'Demo Terminal',
      status: 'SUCCESS',
      paidAt: new Date().toISOString(),
    },
    access: {
        pinCode,
        qrCode,
    },
    sms: {
      queued: true,
      provider: 'LOCAL_DEMO',
      state: 'MOCK',
      phone: '+998900000000',
      preview: `Tashkent City Mall locker ${lockerId} PIN: ${pinCode}`,
    },
  } satisfies DemoPaymentResponse;
}

function getDemoLockers() {
  if (typeof window === 'undefined') {
    return createDemoLockers();
  }

  const stored = window.localStorage.getItem(DEMO_LOCKERS_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Locker>[];
      if (Array.isArray(parsed) && parsed.length >= 12) {
        const lockers = parsed.map(normalizeDemoLocker);
        if (lockers.some((locker) => locker.status === 'AVAILABLE')) {
          saveDemoLockers(lockers);
          return lockers;
        }
      }
    } catch {
      window.localStorage.removeItem(DEMO_LOCKERS_KEY);
    }
  }

  const lockers = createDemoLockers();
  saveDemoLockers(lockers);

  return lockers;
}

function normalizeDemoLocker(locker: Partial<Locker>, index: number): Locker {
  const number = locker.number ?? index + 1;
  const now = new Date().toISOString();

  return {
    id: locker.id ?? `demo-locker-${number}`,
    number,
    status: locker.status ?? 'AVAILABLE',
    size: locker.size ?? (number % 5 === 0 ? 'LARGE' : number % 2 === 0 ? 'MEDIUM' : 'SMALL'),
    isOpen: locker.isOpen ?? false,
    pinCode: locker.pinCode ?? null,
    qrCode: locker.qrCode ?? null,
    customerName: locker.customerName ?? null,
    bookingStartAt: locker.bookingStartAt ?? null,
    bookingExpiresAt: locker.bookingExpiresAt ?? null,
    createdAt: locker.createdAt ?? now,
    updatedAt: locker.updatedAt ?? now,
  };
}

function createDemoLockers() {
  const now = new Date().toISOString();

  return Array.from({ length: 60 }, (_, index): Locker => {
    const number = index + 1;
    const occupied = number % 11 === 0;
    const reserved = !occupied && number % 8 === 0;
    const startedAt = occupied || reserved ? new Date(Date.now() - number * 60_000) : null;
    const expiresAt = startedAt ? new Date(startedAt.getTime() + 120 * 60_000) : null;

    return {
      id: `demo-locker-${number}`,
      number,
      status: occupied
          ? 'OCCUPIED'
          : reserved
            ? 'RESERVED'
            : 'AVAILABLE',
      size: number % 5 === 0 ? 'LARGE' : number % 2 === 0 ? 'MEDIUM' : 'SMALL',
      isOpen: false,
      pinCode: occupied || reserved ? getDemoPin(number) : null,
      qrCode: occupied || reserved ? `CITY-MALL-DEMO-${number}` : null,
      customerName: occupied || reserved ? `Customer ${number}` : null,
      bookingStartAt: startedAt?.toISOString() ?? null,
      bookingExpiresAt: expiresAt?.toISOString() ?? null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

function updateDemoLocker(
  lockerId: number,
  command: 'open' | 'close',
  nextStatus?: Locker['status'],
) {
  let updatedLocker: Locker | undefined;
  const lockers = getDemoLockers().map((locker) => {
    if (locker.number !== lockerId) {
      return locker;
    }

    updatedLocker = {
      ...locker,
      isOpen: command === 'open',
      status: nextStatus ?? locker.status,
      updatedAt: new Date().toISOString(),
    };

    return updatedLocker;
  });

  saveDemoLockers(lockers);

  return updatedLocker ?? createDemoLockers()[lockerId - 1];
}

function patchDemoLocker(lockerId: number, patch: Partial<Locker>) {
  let updatedLocker: Locker | undefined;
  const lockers = getDemoLockers().map((locker) => {
    if (locker.number !== lockerId) {
      return locker;
    }

    updatedLocker = {
      ...locker,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return updatedLocker;
  });
  saveDemoLockers(lockers);
  return updatedLocker ?? createDemoLockers()[lockerId - 1];
}

function expireDemoLockers() {
  if (typeof window === 'undefined') {
    return;
  }

  const lockers = getDemoLockers();
  let changed = false;
  const now = Date.now();
  const next = lockers.map((locker) => {
    if (
      locker.bookingExpiresAt &&
      ['OCCUPIED', 'RESERVED'].includes(locker.status) &&
      new Date(locker.bookingExpiresAt).getTime() <= now
    ) {
      changed = true;
      addDemoLog(`Locker ${locker.number} expired automatically`, 'WARN');
      return { ...locker, status: 'EXPIRED' as const, isOpen: false };
    }

    return locker;
  });

  if (changed) {
    saveDemoLockers(next);
  }
}

function saveDemoLockers(lockers: Locker[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_LOCKERS_KEY, JSON.stringify(lockers));
  }
}

function getDemoRevenue() {
  if (typeof window === 'undefined') {
    return 0;
  }

  return Number(window.localStorage.getItem(DEMO_REVENUE_KEY) ?? 0);
}

function setDemoRevenue(value: number) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_REVENUE_KEY, String(value));
  }
}

function createLocalSmsCode(phone: string) {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`city-mall-sms-code-${normalizePhone(phone)}`, code);
  }

  return code;
}

function getLocalSmsCode(phone: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(`city-mall-sms-code-${normalizePhone(phone)}`);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').replace(/^0+/, '');
}

function buildLocalTariffs() {
  const storedVersion =
    typeof window === 'undefined'
      ? DEMO_TARIFFS_VERSION
      : window.localStorage.getItem(DEMO_TARIFFS_VERSION_KEY);
  const stored = readJson<Tariff[] | null>(DEMO_TARIFFS_KEY, null);
  if (storedVersion === DEMO_TARIFFS_VERSION && stored?.length) {
    return stored;
  }

  const prices: Record<LockerSize, Record<number, number>> = {
    SMALL: {
      15: 5000,
      60: 15000,
      120: 25000,
      240: 45000,
    },
    MEDIUM: {
      15: 8000,
      60: 20000,
      120: 35000,
      240: 60000,
    },
    LARGE: {
      15: 12000,
      60: 30000,
      120: 50000,
      240: 90000,
    },
  };

  const tariffs = (['SMALL', 'MEDIUM', 'LARGE'] as LockerSize[]).flatMap((lockerSize) =>
    [15, 60, 120, 240].map((durationMinutes) => ({
      id: `${lockerSize}-${durationMinutes}`,
      name: `${lockerSize} ${formatTariffDurationName(durationMinutes)}`,
      lockerSize,
      durationMinutes,
      price: prices[lockerSize][durationMinutes],
      currency: 'UZS',
      isActive: true,
    })),
  );

  saveJson(DEMO_TARIFFS_KEY, tariffs);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_TARIFFS_VERSION_KEY, DEMO_TARIFFS_VERSION);
  }
  return tariffs;
}

function createDemoTariff(input: Omit<Tariff, 'id'>): Tariff {
  const tariffs = buildLocalTariffs();
  const tariff = {
    ...input,
    id: `demo-tariff-${Date.now()}`,
  };

  saveJson(DEMO_TARIFFS_KEY, [tariff, ...tariffs]);
  addDemoLog(`Demo tariff created: ${tariff.name}`);

  return tariff;
}

function updateDemoTariff(id: string, input: Omit<Tariff, 'id'>): Tariff {
  const tariffs = buildLocalTariffs();
  const tariff = { ...input, id };
  saveJson(
    DEMO_TARIFFS_KEY,
    tariffs.map((item) => (item.id === id ? tariff : item)),
  );
  addDemoLog(`Demo tariff updated: ${tariff.name}`);

  return tariff;
}

function deleteDemoTariff(id: string): Tariff {
  const tariffs = buildLocalTariffs();
  const tariff = tariffs.find((item) => item.id === id);

  if (!tariff) {
    throw new Error('Demo tariff not found');
  }

  saveJson(
    DEMO_TARIFFS_KEY,
    tariffs.filter((item) => item.id !== id),
  );
  addDemoLog(`Demo tariff deleted: ${tariff.name}`, 'WARN');

  return tariff;
}

function getDemoPin(number: number) {
  return String(100000 + ((number * 137) % 900000));
}

function formatTariffDurationName(minutes: number) {
  if (minutes < 60) {
    return `${minutes}min`;
  }

  return `${minutes / 60}h`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : fallback;
}

function saveJson(key: string, value: unknown) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function addDemoHistory(item: Record<string, unknown>) {
  const history = readJson<Record<string, unknown>[]>(DEMO_HISTORY_KEY, []);
  saveJson(DEMO_HISTORY_KEY, [item, ...history].slice(0, 80));
}

function addDemoLog(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const logs = readJson<Record<string, unknown>[]>(DEMO_LOGS_KEY, []);
  saveJson(DEMO_LOGS_KEY, [
    { id: crypto.randomUUID(), level, message, createdAt: new Date().toISOString() },
    ...logs,
  ].slice(0, 100));
}
