export type LockerStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'EXPIRED'
  | 'MAINTENANCE';

export type LockerSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface Locker {
  id: string;
  number: number;
  status: LockerStatus;
  size: LockerSize;
  isOpen: boolean;
  pinCode: string | null;
  qrCode?: string | null;
  customerName?: string | null;
  bookingStartAt?: string | null;
  bookingExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  lockerId: string;
  phone: string;
  customerName?: string | null;
  durationMinutes: number;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED';
  startTime: string;
  expiresAt: string;
  createdAt: string;
  locker?: Locker;
  accessCodes?: AccessCode[];
  payments?: DemoPayment[];
}

export interface LockerSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  expired: number;
  maintenance: number;
  open: number;
  active: number;
  activeSessions: number;
  demoRevenue: number;
  occupiedPercentage: number;
}

export interface LockersResponse {
  data: Locker[];
  meta: LockerSummary;
}

export interface DemoSession {
  id: string;
  lockerId: string;
  startTime: string;
  endTime: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'COMPLETED';
  createdAt: string;
}

export interface DemoPayment {
  id: string;
  amount: number;
  currency: string;
  provider: string;
  status: 'SUCCESS';
  paidAt: string;
}

export interface Tariff {
  id: string;
  name: string;
  lockerSize: LockerSize;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
}

export interface AccessCode {
  id: string;
  bookingId?: string | null;
  lockerId: string;
  pinCode: string;
  qrCode: string;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
  locker?: Locker;
  booking?: Booking;
}

export interface DemoPaymentResponse {
  data: Locker;
  session: DemoSession;
  payment: DemoPayment;
  access: {
    pinCode: string;
    qrCode: string;
  };
  sms?: {
    queued: boolean;
    provider: string;
    state: 'READY' | 'MOCK' | 'DISABLED';
    phone: string;
    preview: string;
  } | null;
}

export interface BookingResponse {
  data: Locker;
  booking: Booking;
  access: {
    pinCode: string;
    qrCode: string;
  };
}

export interface AdminStatistics {
  summary: LockerSummary;
  lockers: Locker[];
  bookings: Booking[];
  payments: DemoPayment[];
  logs: Array<{
    id: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    source: string;
    message: string;
    createdAt: string;
  }>;
  accessLogs: Array<{
    id: string;
    method: 'PIN' | 'QR' | 'ADMIN' | 'HARDWARE';
    success: boolean;
    message: string;
    createdAt: string;
    locker?: Locker;
  }>;
  tariffs: Tariff[];
  admins: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
  }>;
  revenueSeries: Array<{ date: string; amount: number }>;
  notifications: Array<{
    id: string;
    severity: 'INFO' | 'WARN' | 'ERROR';
    title: string;
    message: string;
    createdAt: string;
  }>;
  report: AdminReportSummary;
}

export interface AccessValidationResponse {
  valid: boolean;
  reason: string;
  data?: Locker;
}

export interface AdminReportSummary {
  revenue: number;
  payments: number;
  bookings: number;
  activeBookings: number;
  completedBookings: number;
  expiredBookings: number;
  cancelledBookings: number;
  averageDurationMinutes: number;
  accessSuccessRate: number;
  utilizationRate: number;
}

export interface AdminReport {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  summary: AdminReportSummary;
  revenueSeries: Array<{ date: string; amount: number }>;
  bookings: Booking[];
  payments: DemoPayment[];
  accessLogs: AdminStatistics['accessLogs'];
}
