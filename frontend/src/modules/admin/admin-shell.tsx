'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Bell,
  DoorOpen,
  FileDown,
  Gauge,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Wrench,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Language } from '@/lib/i18n';
import {
  cancelAdminBooking,
  completeAdminBooking,
  createAdminTariff,
  deleteAdminTariff,
  extendAdminBooking,
  fetchAdminReport,
  fetchAdminStatistics,
  reactivateAdminBooking,
  regenerateAccessCode,
  revokeAccessCode,
  sendLockerAdminCommand,
  sendLockerCommand,
  updateAdminTariff,
} from '@/services/locker-service';
import { useAuthStore } from '@/store/auth-store';
import { formatLockerNumber } from '@/lib/format';
import type { Booking, Locker, LockerSize, LockerStatus, Tariff } from '@/types/locker';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const LANGUAGE_KEY = 'city-mall-language';
const ACTION_NOTIFICATIONS_KEY = 'city-mall-admin-action-notifications';

type ActionNotification = {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  title: string;
  message: string;
  createdAt: string;
};

type AdminSection = 'lockers' | 'overview' | 'bookings' | 'tariffs' | 'access' | 'logs';

const languageOptions: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const adminText = {
  uz: {
    title: 'Smart Yashik boshqaruvi',
    terminal: 'Terminal',
    logout: 'Chiqish',
    totalLockers: 'Jami yashiklar',
    activeLockers: 'Faol yashiklar',
    occupancy: 'Bandlik',
    dailyRevenue: 'Kunlik tushum',
    expired: 'Muddati tugagan',
    staffAlerts: 'Xodim ogohlantirishlari',
    noAlerts: "Ogohlantirish yo'q. Tizim tinch ishlayapti.",
    financialReports: 'Moliyaviy hisobotlar',
    financialNote: 'TZ uchun tushum, buyurtma va kirish ko‘rsatkichlari',
    revenue: 'Tushum',
    bookings: 'Buyurtmalar',
    accessSuccess: 'Kirish muvaffaqiyati',
    utilization: 'Foydalanish',
    exportJson: 'JSON eksport',
    export: 'Eksport',
    revenueAnalytics: 'Tushum analitikasi',
    revenueNote: "Demo to'lov tushumi kunlar bo'yicha",
    tariffs: 'Tariflarni boshqarish',
    add: "Qo'shish",
    save: 'Saqlash',
    activeTariff: 'Aktiv tarif',
    bookingManagement: 'Buyurtmalar boshqaruvi',
    searchBookings: 'Buyurtma qidirish',
    noBookings: 'Buyurtmalar topilmadi.',
    lockerMonitoring: 'Yashik monitoringi',
    searchLocker: 'Yashik qidirish',
    logsSystem: 'Tizim loglari',
    accessManagement: 'PIN / QR kirish boshqaruvi',
    accessEmpty: "Kirish tarixi bo'sh.",
    adminUsers: 'Admin foydalanuvchilar',
    previous: 'Oldingi',
    next: 'Keyingi',
    all: 'Hammasi',
    available: "Bo'sh",
    reserved: 'Band qilingan',
    occupied: 'Band',
    completed: 'Tugallangan',
    cancelled: 'Bekor qilingan',
    maintenance: 'Texnik xizmat',
    active: 'aktiv',
    inactive: 'nofaol',
    activeAccess: 'FAOL',
    revokedOrUsed: 'BEKOR QILINGAN / ISHLATILGAN',
    accessOk: 'RUXSAT BERILDI',
    accessDenied: 'RAD ETILDI',
    lockerFallback: 'Yashik',
    accessGrantedMessage: 'Kirishga ruxsat berildi',
    accessExpiredMessage: 'Kirish kodi muddati tugagan yoki ishlatilgan',
    invalidAccessMessage: "Kirish ma'lumoti noto'g'ri",
    bookingExpiredMessage: 'Buyurtma muddati tugagan',
    lockerNotFoundMessage: 'Yashik topilmadi',
    accessTemporarilyLockedMessage: 'Kirish vaqtincha bloklangan, operatorga murojaat qiling',
    demoInvalidPinMessage: "Demo PIN urinishi noto'g'ri",
    demoAccessGrantedMessage: 'Demo mijoz kirishiga ruxsat berildi',
    expires: 'Tugash vaqti',
    extend: '+60 daqiqa',
    complete: 'Tugatish',
    cancel: 'Bekor qilish',
    regenerate: 'Qayta yaratish',
    revoke: 'Bekor qilish',
    openLocker: 'Yashikni ochish',
    closeLocker: 'Yashikni yopish',
    releaseLocker: "Bo'shatish",
    expireLocker: 'Muddati tugagan qilish',
    maintenanceOn: 'Texnik xizmatga olish',
    maintenanceOff: 'Ishga qaytarish',
    lockerDetails: 'Yashik boshqaruvi',
    lockerStatus: 'Holati',
    lockerSize: 'Hajmi',
    doorState: 'Eshik',
    doorOpen: 'Ochiq',
    doorClosed: 'Yopiq',
    closeModal: 'Yopish',
    checking: 'Admin sessiya tekshirilmoqda...',
  },
  ru: {
    title: 'Управление smart-ячейками',
    terminal: 'Терминал',
    logout: 'Выйти',
    totalLockers: 'Всего ячеек',
    activeLockers: 'Активные ячейки',
    occupancy: 'Занятость',
    dailyRevenue: 'Дневная выручка',
    expired: 'Истекшие',
    staffAlerts: 'Уведомления персонала',
    noAlerts: 'Уведомлений нет. Система работает спокойно.',
    financialReports: 'Финансовые отчеты',
    financialNote: 'Выручка, заказы и показатели доступа по ТЗ',
    revenue: 'Выручка',
    bookings: 'Заказы',
    accessSuccess: 'Успешный доступ',
    utilization: 'Использование',
    exportJson: 'Экспорт JSON',
    export: 'Экспорт',
    revenueAnalytics: 'Аналитика выручки',
    revenueNote: 'Демо-выручка по дням',
    tariffs: 'Управление тарифами',
    add: 'Добавить',
    save: 'Сохранить',
    activeTariff: 'Активный тариф',
    bookingManagement: 'Управление заказами',
    searchBookings: 'Поиск заказов',
    noBookings: 'Заказы не найдены.',
    lockerMonitoring: 'Мониторинг ячеек',
    searchLocker: 'Поиск ячейки',
    logsSystem: 'Логи системы',
    accessManagement: 'Управление PIN / QR доступом',
    accessEmpty: 'История доступа пуста.',
    adminUsers: 'Администраторы',
    previous: 'Назад',
    next: 'Вперед',
    all: 'Все',
    available: 'Свободно',
    reserved: 'Зарезервировано',
    occupied: 'Занято',
    completed: 'Завершено',
    cancelled: 'Отменено',
    maintenance: 'Обслуживание',
    active: 'активен',
    inactive: 'неактивен',
    activeAccess: 'АКТИВЕН',
    revokedOrUsed: 'ОТОЗВАН / ИСПОЛЬЗОВАН',
    accessOk: 'ДОСТУП РАЗРЕШЕН',
    accessDenied: 'ДОСТУП ЗАПРЕЩЕН',
    lockerFallback: 'Ячейка',
    accessGrantedMessage: 'Доступ разрешен',
    accessExpiredMessage: 'Код доступа истек или уже использован',
    invalidAccessMessage: 'Неверные данные доступа',
    bookingExpiredMessage: 'Срок бронирования истек',
    lockerNotFoundMessage: 'Ячейка не найдена',
    accessTemporarilyLockedMessage: 'Доступ временно заблокирован, обратитесь к оператору',
    demoInvalidPinMessage: 'Неверная попытка demo PIN',
    demoAccessGrantedMessage: 'Доступ demo-клиента разрешен',
    expires: 'Истекает',
    extend: '+60 мин',
    complete: 'Завершить',
    cancel: 'Отменить',
    regenerate: 'Создать заново',
    revoke: 'Отозвать',
    openLocker: 'Открыть ячейку',
    closeLocker: 'Закрыть ячейку',
    releaseLocker: 'Освободить',
    expireLocker: 'Пометить истекшей',
    maintenanceOn: 'На обслуживание',
    maintenanceOff: 'Вернуть в работу',
    lockerDetails: 'Управление ячейкой',
    lockerStatus: 'Статус',
    lockerSize: 'Размер',
    doorState: 'Дверь',
    doorOpen: 'Открыта',
    doorClosed: 'Закрыта',
    closeModal: 'Закрыть',
    checking: 'Проверка admin-сессии...',
  },
  en: {
    title: 'Smart Locker Operations',
    terminal: 'Terminal',
    logout: 'Logout',
    totalLockers: 'Total lockers',
    activeLockers: 'Active lockers',
    occupancy: 'Occupancy',
    dailyRevenue: 'Daily revenue',
    expired: 'Expired',
    staffAlerts: 'Staff alerts',
    noAlerts: 'No alerts. The system is running normally.',
    financialReports: 'Financial reports',
    financialNote: 'Revenue, booking and access KPIs for the specification',
    revenue: 'Revenue',
    bookings: 'Bookings',
    accessSuccess: 'Access success',
    utilization: 'Utilization',
    exportJson: 'JSON export',
    export: 'Export',
    revenueAnalytics: 'Revenue analytics',
    revenueNote: 'Demo payment revenue by day',
    tariffs: 'Tariffs management',
    add: 'Add',
    save: 'Save',
    activeTariff: 'Active tariff',
    bookingManagement: 'Booking management',
    searchBookings: 'Search bookings',
    noBookings: 'No bookings found.',
    lockerMonitoring: 'Locker monitoring',
    searchLocker: 'Search locker',
    logsSystem: 'System logs',
    accessManagement: 'PIN / QR access management',
    accessEmpty: 'Access history is empty.',
    adminUsers: 'Admin users',
    previous: 'Prev',
    next: 'Next',
    all: 'All',
    available: 'Available',
    reserved: 'Reserved',
    occupied: 'Occupied',
    completed: 'Completed',
    cancelled: 'Cancelled',
    maintenance: 'Maintenance',
    active: 'active',
    inactive: 'inactive',
    activeAccess: 'ACTIVE',
    revokedOrUsed: 'REVOKED / USED',
    accessOk: 'OK',
    accessDenied: 'DENIED',
    lockerFallback: 'Locker',
    accessGrantedMessage: 'Access granted',
    accessExpiredMessage: 'Access code expired or already used',
    invalidAccessMessage: 'Invalid access credential',
    bookingExpiredMessage: 'Booking expired',
    lockerNotFoundMessage: 'Locker not found',
    accessTemporarilyLockedMessage: 'Access temporarily locked, contact an operator',
    demoInvalidPinMessage: 'Demo invalid PIN attempt',
    demoAccessGrantedMessage: 'Demo customer access granted',
    expires: 'Expires',
    extend: '+60 min',
    complete: 'Complete',
    cancel: 'Cancel',
    regenerate: 'Regenerate',
    revoke: 'Revoke',
    openLocker: 'Open locker',
    closeLocker: 'Close locker',
    releaseLocker: 'Release locker',
    expireLocker: 'Mark expired',
    maintenanceOn: 'Move to maintenance',
    maintenanceOff: 'Return to service',
    lockerDetails: 'Locker control',
    lockerStatus: 'Status',
    lockerSize: 'Size',
    doorState: 'Door',
    doorOpen: 'Open',
    doorClosed: 'Closed',
    closeModal: 'Close',
    checking: 'Checking admin session...',
  },
} as const;

type AdminCopy = (typeof adminText)[Language];

function translateAccessMessage(message: string, labels: AdminCopy) {
  const dictionary: Record<string, string> = {
    'Access granted': labels.accessGrantedMessage,
    'Access code expired or already used': labels.accessExpiredMessage,
    'Invalid access credential': labels.invalidAccessMessage,
    'Booking expired': labels.bookingExpiredMessage,
    'Locker not found': labels.lockerNotFoundMessage,
    'Access temporarily locked, contact an operator': labels.accessTemporarilyLockedMessage,
    'Demo invalid PIN attempt': labels.demoInvalidPinMessage,
    'Demo customer access granted': labels.demoAccessGrantedMessage,
  };

  return dictionary[message] ?? message;
}

export function AdminShell() {
  const [language, setLanguage] = useState<Language>('uz');
  const [bookingSearch, setBookingSearch] = useState('');
  const [lockerSearch, setLockerSearch] = useState('');
  const [lockerStatus, setLockerStatus] = useState<'ALL' | LockerStatus>('ALL');
  const [bookingStatus, setBookingStatus] = useState<'ALL' | Booking['status']>('ALL');
  const [bookingPage, setBookingPage] = useState(1);
  const [lockerPage, setLockerPage] = useState(1);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('lockers');
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [notice, setNotice] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);
  const [actionNotifications, setActionNotifications] = useState<ActionNotification[]>([]);
  const [tariffForm, setTariffForm] = useState<Omit<Tariff, 'id'>>({
    name: 'MEDIUM 2h',
    lockerSize: 'MEDIUM',
    durationMinutes: 120,
    price: 20000,
    currency: 'UZS',
    isActive: true,
  });
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, hydrate, logout } = useAuthStore();
  const t = adminText[language];
  const { data, error: adminError, isLoading } = useQuery({
    queryKey: ['admin-statistics'],
    queryFn: fetchAdminStatistics,
    refetchInterval: 10000,
    retry: false,
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const stored = window.localStorage.getItem(ACTION_NOTIFICATIONS_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as ActionNotification[];
      if (Array.isArray(parsed)) {
        setActionNotifications(parsed.slice(0, 20));
      }
    } catch {
      window.localStorage.removeItem(ACTION_NOTIFICATIONS_KEY);
    }
  }, []);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage === 'uz' || savedLanguage === 'ru' || savedLanguage === 'en') {
      setLanguage(savedLanguage);
    }
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }

  useEffect(() => {
    const token = window.localStorage.getItem('city-mall-admin-token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (adminError instanceof Error && adminError.message.includes('Admin authentication')) {
      logout();
      router.replace('/login');
    }
  }, [adminError, logout, router]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('lockers:updated', () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    });
    socket.on('booking:updated', () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  useEffect(() => {
    setBookingPage(1);
  }, [bookingSearch, bookingStatus]);

  useEffect(() => {
    setLockerPage(1);
  }, [lockerSearch, lockerStatus]);

  const latestAccessLogs = useMemo(() => (data?.accessLogs ?? []).slice(0, 6), [data?.accessLogs]);
  const accessCodes = useMemo(
    () =>
      (data?.bookings ?? [])
        .flatMap((booking) =>
          (booking.accessCodes ?? []).map((accessCode) => ({
            ...accessCode,
            booking,
            locker: booking.locker,
          })),
        )
        .slice(0, 12),
    [data?.bookings],
  );

  if (!user) {
    return (
      <main className="luxury-bg grid min-h-screen place-items-center text-[#ffffff]/70">
        {t.checking}
      </main>
    );
  }

  const summary = data?.summary;
  const bookings = data?.bookings ?? [];
  const bookingQuery = bookingSearch.trim().toLowerCase();
  const lockerQuery = lockerSearch.trim().toLowerCase();
  const bookingPageSize = 6;
  const lockerPageSize = 18;
  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = bookingStatus === 'ALL' || booking.status === bookingStatus;
    const haystack = [
      booking.phone,
      booking.customerName,
      booking.status,
      booking.locker ? formatLockerNumber(booking.locker.number) : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return matchesStatus && haystack.includes(bookingQuery);
  });
  const filteredLogs = (data?.logs ?? []).filter((log) => logFilter === 'ALL' || log.level === logFilter);
  const filteredLockers = (data?.lockers ?? []).filter((locker) => {
    const matchesStatus = lockerStatus === 'ALL' || locker.status === lockerStatus;
    const haystack = `${formatLockerNumber(locker.number)} ${locker.number} ${locker.size} ${locker.status}`.toLowerCase();
    return matchesStatus && haystack.includes(lockerQuery);
  });
  const pagedBookings = filteredBookings.slice(
    (bookingPage - 1) * bookingPageSize,
    bookingPage * bookingPageSize,
  );
  const pagedLockers = filteredLockers.slice(
    (lockerPage - 1) * lockerPageSize,
    lockerPage * lockerPageSize,
  );
  const bookingPages = Math.max(1, Math.ceil(filteredBookings.length / bookingPageSize));
  const lockerPages = Math.max(1, Math.ceil(filteredLockers.length / lockerPageSize));
  const statusFilters: Array<'ALL' | LockerStatus> = ['ALL', 'AVAILABLE', 'RESERVED', 'OCCUPIED', 'EXPIRED', 'MAINTENANCE'];
  const bookingStatusFilters: Array<'ALL' | Booking['status']> = ['ALL', 'ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED'];
  const visibleNotifications = [
    ...actionNotifications,
    ...(data?.notifications ?? []).map((item) => ({
      id: item.id,
      level: item.severity,
      title: item.title,
      message: item.message,
      createdAt: item.createdAt,
    })),
  ].slice(0, 8);
  const adminSections: Array<{
    id: AdminSection;
    label: string;
    description: string;
    icon: ReactNode;
  }> = [
    {
      id: 'lockers',
      label: t.lockerMonitoring,
      description: `${filteredLockers.length} / ${summary?.total ?? 0}`,
      icon: <DoorOpen size={18} />,
    },
    {
      id: 'overview',
      label: 'Dashboard',
      description: t.financialReports,
      icon: <BarChart3 size={18} />,
    },
    {
      id: 'bookings',
      label: t.bookingManagement,
      description: `${filteredBookings.length} ${t.bookings.toLowerCase()}`,
      icon: <ReceiptText size={18} />,
    },
    {
      id: 'tariffs',
      label: t.tariffs,
      description: `${data?.tariffs.length ?? 0} ${t.activeTariff.toLowerCase()}`,
      icon: <Gauge size={18} />,
    },
    {
      id: 'access',
      label: t.accessManagement,
      description: 'PIN / QR',
      icon: <ShieldCheck size={18} />,
    },
    {
      id: 'logs',
      label: t.logsSystem,
      description: `${filteredLogs.length} log`,
      icon: <Bell size={18} />,
    },
  ];

  function addActionNotification(
    level: ActionNotification['level'],
    title: string,
    message: string,
  ) {
    const notification = {
      id: `admin-action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      level,
      title,
      message,
      createdAt: new Date().toISOString(),
    };

    setActionNotifications((current) => {
      const next = [notification, ...current].slice(0, 20);
      window.localStorage.setItem(ACTION_NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function runAdminAction(label: string, action: () => Promise<unknown>) {
    setNotice(`${label} bajarilmoqda...`);
    try {
      await action();
      const message = `${label} muvaffaqiyatli bajarildi`;
      setNotice(message);
      addActionNotification('INFO', label, message);
      await queryClient.invalidateQueries({ queryKey: ['admin-statistics'] });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} bajarilmadi`;
      setNotice(message);
      addActionNotification('ERROR', label, message);
    }
  }

  function startEditTariff(tariff: Tariff) {
    setEditingTariffId(tariff.id);
    setTariffForm({
      name: tariff.name,
      lockerSize: tariff.lockerSize,
      durationMinutes: tariff.durationMinutes,
      price: tariff.price,
      currency: tariff.currency,
      isActive: tariff.isActive,
    });
  }

  async function submitTariff() {
    await runAdminAction(editingTariffId ? 'Tariff yangilash' : 'Tariff yaratish', async () => {
      if (editingTariffId) {
        await updateAdminTariff(editingTariffId, tariffForm);
      } else {
        await createAdminTariff(tariffForm);
      }
      setEditingTariffId(null);
    });
  }

  async function downloadReport() {
    await runAdminAction('Hisobot tayyorlash', async () => {
      const report = await fetchAdminReport({
        from: reportFrom ? new Date(reportFrom).toISOString() : undefined,
        to: reportTo ? new Date(reportTo).toISOString() : undefined,
      });
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `city-mall-report-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  async function runLockerAction(label: string, action: () => Promise<{ data: Locker }>) {
    await runAdminAction(label, async () => {
      const result = await action();
      setSelectedLocker(result.data);
    });
  }

  async function cancelOrReactivateBooking(booking: Booking) {
    if (booking.status === 'EXPIRED') {
      await runAdminAction(t.cancel, () => reactivateAdminBooking(booking.id));
      setBookingStatus('ACTIVE');
      return;
    }

    await runAdminAction(t.cancel, () => cancelAdminBooking(booking.id));
  }

  return (
    <main className="luxury-bg min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(179,128,110,0.20),transparent_30%),radial-gradient(circle_at_82%_0%,rgba(255,255,255,0.10),transparent_28%)]" />
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 py-6 sm:px-8 lg:px-10">
        <header className="luxury-card-strong flex flex-col gap-6 rounded-[2rem] p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-[#b3806e]/35 bg-[#b3806e]/12 px-4 py-2 text-xs font-semibold uppercase text-white shadow-[0_0_28px_rgba(179,128,110,0.20)]">
              City Mall Smart Yashik MVP
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-white sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              API tayyor admin boshqaruv, realtime monitoring, buyurtma, tarif va PIN/QR nazorati.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-[#b3806e]/25 bg-[#1a212f]/55 p-4 text-sm text-white/72">
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.055] p-1">
              {languageOptions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => changeLanguage(item.code)}
                  className={`min-h-9 rounded-full px-3 text-xs font-semibold transition ${
                    language === item.code
                      ? 'bg-[#b3806e] text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="font-semibold text-white">Tizim rejimi</p>
            <p className="mt-1">Admin panel faol</p>
            <p className="mt-3 text-xs text-white/65">
              Baza holati: {isLoading ? 'sinxronlanmoqda' : 'jonli'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/terminal">
                <Button variant="secondary" className="w-full">
                  <DoorOpen size={17} />
                  {t.terminal}
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="text-white/70 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
              >
                <LogOut size={17} />
                {t.logout}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label={t.totalLockers} value={summary?.total ?? 0} tone="bronze" />
          <Metric label={t.activeLockers} value={summary?.active ?? 0} tone="glass" />
          <Metric label={t.occupancy} value={summary?.occupiedPercentage ?? 0} suffix="%" tone="solid" />
          <Metric label={t.expired} value={summary?.expired ?? 0} tone="light" />
          <Metric label={t.dailyRevenue} value={summary?.demoRevenue ?? 0} suffix=" UZS" tone="bronze" compact />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {adminSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`min-h-[116px] rounded-[1.65rem] border p-4 text-left transition duration-300 hover:-translate-y-1 ${
                activeSection === section.id
                  ? 'border-[#b3806e]/60 bg-[#b3806e]/18 text-white shadow-[0_24px_80px_rgba(179,128,110,0.18)]'
                  : 'luxury-card text-white/72 hover:border-[#b3806e]/50 hover:bg-white/[0.09]'
              }`}
            >
              <span className="flex items-center gap-2 text-[#b3806e]">{section.icon}</span>
              <span className="mt-3 block text-sm font-bold">{section.label}</span>
              <span className="mt-1 block text-xs font-semibold text-white/48">{section.description}</span>
            </button>
          ))}
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-[#C8A96B]/35 bg-[#C8A96B]/12 px-4 py-3 text-sm font-semibold text-white">
            {notice}
          </div>
        ) : null}

        {activeSection === 'overview' ? (
          <>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric icon={<DoorOpen />} label={t.totalLockers} value={summary?.total ?? 0} />
          <Metric icon={<Gauge />} label={t.activeLockers} value={summary?.active ?? 0} />
          <Metric
            icon={<BarChart3 />}
            label={t.occupancy}
            value={summary?.occupiedPercentage ?? 0}
            suffix="%"
          />
          <Metric
            icon={<ReceiptText />}
            label={t.dailyRevenue}
            value={summary?.demoRevenue ?? 0}
            suffix=" UZS"
            compact
          />
          <Metric icon={<ShieldCheck />} label={t.expired} value={summary?.expired ?? 0} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              <Bell className="text-[#C8A96B]" />
              <h2 className="text-xl font-semibold">{t.staffAlerts}</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {visibleNotifications.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-3">
                  <p className={`text-xs font-bold ${item.level === 'ERROR' ? 'text-[#ffffff]' : 'text-[#C8A96B]'}`}>
                    {item.level} | {item.title}
                  </p>
                  <p className="mt-1 text-sm text-[#ffffff]/70">{item.message}</p>
                  <p className="mt-2 text-xs text-[#ffffff]/38">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {!isLoading && visibleNotifications.length === 0 ? (
                <p className="text-sm text-[#ffffff]/55">{t.noAlerts}</p>
              ) : null}
            </div>
          </Card>

          <Card className="border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{t.financialReports}</h2>
                <p className="mt-1 text-sm text-[#ffffff]/58">{t.financialNote}</p>
              </div>
              <Button onClick={downloadReport}>
                <FileDown size={17} />
                {t.exportJson}
              </Button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MiniMetric label={t.revenue} value={`${(data?.report.revenue ?? 0).toLocaleString('uz-UZ')} UZS`} />
              <MiniMetric label={t.bookings} value={String(data?.report.bookings ?? 0)} />
              <MiniMetric label={t.accessSuccess} value={`${data?.report.accessSuccessRate ?? 100}%`} />
              <MiniMetric label={t.utilization} value={`${data?.report.utilizationRate ?? 0}%`} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                type="datetime-local"
                value={reportFrom}
                onChange={(event) => setReportFrom(event.target.value)}
                className="min-h-11 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 px-3 text-sm text-[#ffffff] outline-none"
              />
              <input
                type="datetime-local"
                value={reportTo}
                onChange={(event) => setReportTo(event.target.value)}
                className="min-h-11 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 px-3 text-sm text-[#ffffff] outline-none"
              />
              <Button variant="secondary" onClick={downloadReport}>
                <FileDown size={17} />
                {t.export}
              </Button>
            </div>
          </Card>
        </div>
          </>
        ) : null}

        {activeSection === 'overview' || activeSection === 'tariffs' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-1">
          {activeSection === 'overview' ? (
          <Card className="border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{t.revenueAnalytics}</h2>
                <p className="mt-1 text-sm text-[#ffffff]/58">{t.revenueNote}</p>
              </div>
              <BarChart3 className="text-[#C8A96B]" />
            </div>
            <div className="mt-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.revenueSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="date" stroke="#ffffff" opacity={0.62} />
                  <YAxis stroke="#ffffff" opacity={0.62} />
                  <Tooltip
                    cursor={{ fill: 'rgba(179,128,110,0.10)' }}
                    contentStyle={{
                      background: '#1a212f',
                      border: '1px solid rgba(179,128,110,0.45)',
                      borderRadius: '16px',
                      color: '#ffffff',
                    }}
                    labelStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="amount" fill="#C8A96B" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          ) : null}

          {activeSection === 'tariffs' ? (
          <Card className="border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t.tariffs}</h2>
              <Button onClick={submitTariff}>
                <Plus size={16} />
                {editingTariffId ? t.save : t.add}
              </Button>
            </div>
            <div className="mt-5 grid gap-2">
              <input
                value={tariffForm.name}
                onChange={(event) => setTariffForm((form) => ({ ...form, name: event.target.value }))}
                className="min-h-10 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 px-3 text-sm text-[#ffffff] outline-none"
                placeholder="Tariff nomi"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={tariffForm.lockerSize}
                  onChange={(event) => setTariffForm((form) => ({ ...form, lockerSize: event.target.value as LockerSize }))}
                  className="min-h-10 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f] px-3 text-sm text-[#ffffff] outline-none"
                >
                  <option value="SMALL">SMALL</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LARGE">LARGE</option>
                </select>
                <input
                  type="number"
                  min={15}
                  max={1440}
                  value={tariffForm.durationMinutes}
                  onChange={(event) => setTariffForm((form) => ({ ...form, durationMinutes: Number(event.target.value) }))}
                  className="min-h-10 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 px-3 text-sm text-[#ffffff] outline-none"
                />
                <input
                  type="number"
                  min={1}
                  value={tariffForm.price}
                  onChange={(event) => setTariffForm((form) => ({ ...form, price: Number(event.target.value) }))}
                  className="min-h-10 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 px-3 text-sm text-[#ffffff] outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#ffffff]/70">
                <input
                  type="checkbox"
                  checked={tariffForm.isActive}
                  onChange={(event) => setTariffForm((form) => ({ ...form, isActive: event.target.checked }))}
                />
                {t.activeTariff}
              </label>
            </div>
            <div className="mt-5 grid gap-3">
              {(data?.tariffs ?? []).slice(0, 9).map((tariff) => (
                <div key={tariff.id} className="flex items-center justify-between rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-3">
                  <div>
                    <p className="font-semibold">{tariff.name}</p>
                    <p className="text-xs text-[#ffffff]/55">
                      {tariff.lockerSize} | {tariff.durationMinutes} min | {tariff.isActive ? t.active : t.inactive}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#C8A96B]">
                      {tariff.price.toLocaleString('uz-UZ')} {tariff.currency}
                    </p>
                    <button type="button" onClick={() => startEditTariff(tariff)} className="rounded-xl border border-[#ffffff]/10 p-2 text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => runAdminAction('Tariff o‘chirish', () => deleteAdminTariff(tariff.id))} className="rounded-xl border border-[#ffffff]/10 p-2 text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          ) : null}
        </div>
        ) : null}

        {activeSection === 'bookings' || activeSection === 'lockers' || activeSection === 'logs' ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-1">
          {activeSection === 'bookings' ? (
          <Card className="border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{t.bookingManagement}</h2>
              <SearchBox value={bookingSearch} onChange={setBookingSearch} placeholder={t.searchBookings} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {bookingStatusFilters.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setBookingStatus(status)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    bookingStatus === status
                      ? 'border-[#C8A96B] bg-[#C8A96B] text-[#171b26]'
                      : 'border-[#ffffff]/10 bg-[#ffffff]/[0.05] text-[#ffffff]/70 hover:border-[#C8A96B]/45'
                  }`}
                >
                  {getBookingStatusLabel(status, t)}
                </button>
              ))}
            </div>
            <div className="mt-5 grid max-h-[32rem] gap-3 overflow-y-auto">
              {pagedBookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4 transition hover:border-[#C8A96B]/45">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {booking.locker ? formatLockerNumber(booking.locker.number) : 'Yashik'}
                    </p>
                    <p className="rounded-full border border-[#C8A96B]/35 px-2.5 py-1 text-xs font-bold text-[#C8A96B]">
                      {booking.status}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[#ffffff]/60">{booking.phone}</p>
                  <p className="mt-1 text-sm text-[#ffffff]/60">
                    {t.expires} {new Date(booking.expiresAt).toLocaleString()}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => runAdminAction('Booking extend', () => extendAdminBooking(booking.id, 60))} className="rounded-xl border border-[#ffffff]/10 px-2 py-2 text-xs font-bold text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                      {t.extend}
                    </button>
                    <button type="button" onClick={() => runAdminAction('Booking complete', () => completeAdminBooking(booking.id))} className="rounded-xl border border-[#ffffff]/10 px-2 py-2 text-xs font-bold text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                      {t.complete}
                    </button>
                    <button type="button" onClick={() => void cancelOrReactivateBooking(booking)} className="rounded-xl border border-[#ffffff]/10 px-2 py-2 text-xs font-bold text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ))}
              {!isLoading && filteredBookings.length === 0 ? (
                <p className="text-sm text-[#ffffff]/55">{t.noBookings}</p>
              ) : null}
            </div>
            <Pager labels={t} page={bookingPage} pages={bookingPages} onPrev={() => setBookingPage((page) => Math.max(1, page - 1))} onNext={() => setBookingPage((page) => Math.min(bookingPages, page + 1))} />
          </Card>
          ) : null}

          {activeSection === 'lockers' ? (
          <Card className="rounded-[24px] border-[#C8A96B]/20 bg-[#484d59]/82 p-5 shadow-[0_36px_110px_rgba(0,0,0,0.34)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{t.lockerMonitoring}</h2>
              <SearchBox value={lockerSearch} onChange={setLockerSearch} placeholder={t.searchLocker} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {statusFilters.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setLockerStatus(status)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    lockerStatus === status
                      ? 'border-[#C8A96B] bg-[#C8A96B] text-[#171b26]'
                      : 'border-white/10 bg-white/[0.08] text-white/70 hover:border-[#C8A96B]/45'
                  }`}
                >
                  {getLockerStatusLabel(status, t)}
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {pagedLockers.map((locker) => (
                <button
                  key={locker.id}
                  type="button"
                  onClick={() => setSelectedLocker(locker)}
                  className={`group relative overflow-hidden rounded-[1.85rem] border p-5 text-left transition duration-300 hover:-translate-y-1 ${statusClass(locker.status)}`}
                >
                  <div className="bronze-line absolute inset-x-8 top-0 h-px opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase text-white/42">Smart yashik</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{formatLockerNumber(locker.number)}</p>
                      <p className="mt-1 text-xs font-semibold uppercase text-white/70">
                        Yashik hajmi: {getLockerSizeLabel(locker.size)}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {getLockerStatusLabel(locker.status, t)}
                    </span>
                  </div>

                  <div className="mt-7 flex items-center justify-center">
                    <div
                      className={`relative grid h-24 w-20 place-items-center rounded-2xl border transition duration-500 ${
                        locker.isOpen
                          ? 'rotate-2 border-[#b3806e]/70 bg-[#b3806e]/15 shadow-[0_0_38px_rgba(179,128,110,0.34)]'
                          : 'border-white/10 bg-[#1a212f]/80'
                      }`}
                    >
                      <div className="absolute inset-y-4 right-3 w-1 rounded-full bg-[#b3806e]/80 shadow-[0_0_18px_rgba(179,128,110,0.65)]" />
                      <div className={`h-5 w-5 rounded-full border border-white/20 transition ${locker.isOpen ? 'bg-[#b3806e]' : 'bg-white/10'}`} />
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/8 bg-[#1a212f]/55 p-3">
                      <p className="text-white/42">{t.doorState}</p>
                      <p className="mt-1 font-semibold text-white">{locker.isOpen ? t.doorOpen : t.doorClosed}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#1a212f]/55 p-3">
                      <p className="text-white/42">PIN</p>
                      <p className="mt-1 font-semibold text-white">{locker.pinCode ?? 'Tayyor'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#1a212f]/55 p-3">
                      <p className="text-white/42">Mijoz</p>
                      <p className="mt-1 truncate font-semibold text-white">{locker.customerName ?? '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#1a212f]/55 p-3">
                      <p className="text-white/42">{t.expires}</p>
                      <p className="mt-1 font-semibold text-white">
                        {locker.bookingExpiresAt ? new Date(locker.bookingExpiresAt).toLocaleTimeString() : '-'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Pager labels={t} page={lockerPage} pages={lockerPages} onPrev={() => setLockerPage((page) => Math.max(1, page - 1))} onNext={() => setLockerPage((page) => Math.min(lockerPages, page + 1))} />
          </Card>
          ) : null}

          {activeSection === 'logs' ? (
          <Card className="border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{t.logsSystem}</h2>
              <div className="flex gap-2">
                {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLogFilter(level)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      logFilter === level
                        ? 'border-[#C8A96B] bg-[#C8A96B] text-[#171b26]'
                        : 'border-[#ffffff]/10 bg-[#ffffff]/[0.05] text-[#ffffff]/70 hover:border-[#C8A96B]/45'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 grid max-h-[32rem] gap-3 overflow-y-auto">
              {filteredLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-3">
                  <p className="text-xs font-bold text-[#C8A96B]">
                    {log.level} | {log.source}
                  </p>
                  <p className="mt-1 text-sm text-[#ffffff]/72">{log.message}</p>
                  <p className="mt-2 text-xs text-[#ffffff]/42">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
          ) : null}
        </div>
        ) : null}

        {activeSection === 'access' ? (
        <>
        <Card className="mt-6 border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-3">
            <KeyBadge />
            <h2 className="text-xl font-semibold">{t.accessManagement}</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accessCodes.map((accessCode) => (
              <div key={accessCode.id} className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{accessCode.locker ? formatLockerNumber(accessCode.locker.number) : t.lockerFallback}</p>
                  <p className="text-xs font-bold text-[#C8A96B]">{accessCode.usedAt ? t.revokedOrUsed : t.activeAccess}</p>
                </div>
                <p className="mt-2 text-sm text-[#ffffff]/70">PIN: {accessCode.pinCode}</p>
                <p className="mt-1 text-xs text-[#ffffff]/45">{t.expires} {new Date(accessCode.expiresAt).toLocaleString()}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => runAdminAction('PIN/QR regenerate', () => regenerateAccessCode(accessCode.id))} className="rounded-xl border border-[#ffffff]/10 px-2 py-2 text-xs font-bold text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                    {t.regenerate}
                  </button>
                  <button type="button" onClick={() => runAdminAction('PIN/QR revoke', () => revokeAccessCode(accessCode.id))} className="rounded-xl border border-[#ffffff]/10 px-2 py-2 text-xs font-bold text-[#ffffff]/75 transition hover:border-[#C8A96B]/45">
                    {t.revoke}
                  </button>
                </div>
              </div>
            ))}
            {latestAccessLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{log.locker ? formatLockerNumber(log.locker.number) : t.lockerFallback}</p>
                  <p className="text-xs font-bold text-[#C8A96B]">{log.method} | {log.success ? t.accessOk : t.accessDenied}</p>
                </div>
                <p className="mt-2 text-sm text-[#ffffff]/70">{translateAccessMessage(log.message, t)}</p>
                <p className="mt-3 text-xs text-[#ffffff]/45">{new Date(log.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!isLoading && latestAccessLogs.length === 0 ? (
              <p className="text-sm text-[#ffffff]/55">{t.accessEmpty}</p>
            ) : null}
          </div>
        </Card>

        <Card className="mt-6 border-[#C8A96B]/18 bg-[#3d424e]/78 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-3">
            <Users className="text-[#C8A96B]" />
            <h2 className="text-xl font-semibold">{t.adminUsers}</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {(data?.admins ?? []).map((admin) => (
              <div key={admin.id} className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4 transition hover:border-[#C8A96B]/45">
                <p className="font-semibold">{admin.name}</p>
                <p className="mt-1 text-sm text-[#ffffff]/58">{admin.email}</p>
                <p className="mt-3 text-xs font-bold text-[#C8A96B]">{admin.role}</p>
              </div>
            ))}
          </div>
        </Card>
        </>
        ) : null}
      </section>

      {selectedLocker ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#1a212f]/78 px-4 backdrop-blur-sm"
          onClick={() => setSelectedLocker(null)}
        >
          <div
            className="luxury-card w-full max-w-lg rounded-[1.65rem] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.36)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase text-[#C8A96B]">{t.lockerDetails}</p>
                <h2 className="mt-2 text-3xl font-semibold">{formatLockerNumber(selectedLocker.number)}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLocker(null)}
                className="rounded-full border border-[#ffffff]/10 px-4 py-2 text-sm font-bold text-[#ffffff]/70 transition hover:border-[#C8A96B]/45 hover:text-[#ffffff]"
              >
                {t.closeModal}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <p className="text-xs font-bold uppercase text-[#ffffff]/45">{t.lockerStatus}</p>
                <p className="mt-2 font-semibold">{getLockerStatusLabel(selectedLocker.status, t)}</p>
              </div>
              <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <p className="text-xs font-bold uppercase text-[#ffffff]/45">{t.lockerSize}</p>
                <p className="mt-2 font-semibold">{selectedLocker.size}</p>
              </div>
              <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
                <p className="text-xs font-bold uppercase text-[#ffffff]/45">{t.doorState}</p>
                <p className="mt-2 font-semibold">{selectedLocker.isOpen ? t.doorOpen : t.doorClosed}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                onClick={() =>
                  void runLockerAction(t.openLocker, () => sendLockerCommand(selectedLocker.number, 'open'))
                }
              >
                <DoorOpen size={17} />
                {t.openLocker}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void runLockerAction(t.closeLocker, () => sendLockerCommand(selectedLocker.number, 'close'))
                }
              >
                <DoorOpen size={17} />
                {t.closeLocker}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void runLockerAction(t.releaseLocker, () => sendLockerAdminCommand(selectedLocker.number, 'release'))
                }
              >
                <ShieldCheck size={17} />
                {t.releaseLocker}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void runLockerAction(t.expireLocker, () => sendLockerAdminCommand(selectedLocker.number, 'expire'))
                }
              >
                <ReceiptText size={17} />
                {t.expireLocker}
              </Button>
              <Button
                variant={selectedLocker.status === 'MAINTENANCE' ? 'secondary' : 'danger'}
                className="sm:col-span-2"
                onClick={() =>
                  void runLockerAction(
                    selectedLocker.status === 'MAINTENANCE' ? t.maintenanceOff : t.maintenanceOn,
                    () => sendLockerAdminCommand(selectedLocker.number, 'maintenance'),
                  )
                }
              >
                <Wrench size={17} />
                {selectedLocker.status === 'MAINTENANCE' ? t.maintenanceOff : t.maintenanceOn}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
  compact,
  tone = 'glass',
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  compact?: boolean;
  tone?: 'bronze' | 'light' | 'glass' | 'solid';
}) {
  const toneClass = {
    bronze: 'from-white/[0.10] to-[#b3806e]/[0.12] ring-[#b3806e]/28',
    light: 'from-white/[0.11] to-white/[0.04] ring-white/18',
    glass: 'from-white/[0.09] to-[#1a212f]/[0.18] ring-[#b3806e]/22',
    solid: 'from-[#4b505b]/80 to-[#2b303b]/80 ring-white/12',
  };

  return (
    <Card className={`group overflow-hidden bg-gradient-to-br ${toneClass[tone]} ring-1`}>
      <div className="flex min-h-[6.25rem] flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-white/60">{label}</p>
          {icon ? (
            <div className="text-[#b3806e] transition group-hover:scale-110">{icon}</div>
          ) : (
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#b3806e] shadow-[0_0_22px_rgba(179,128,110,0.8)]" />
          )}
        </div>
        <p className={`${compact ? 'text-3xl' : 'text-4xl'} font-semibold tracking-normal text-white`}>
          <AnimatedNumber value={value} />
          {suffix ? <span className="text-2xl text-white/70">{suffix}</span> : null}
        </p>
      </div>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.055] p-4">
      <p className="text-xs font-bold uppercase text-[#ffffff]/45">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#ffffff]">{value}</p>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const start = displayRef.current;
    const delta = value - start;
    const startedAt = performance.now();
    const duration = 520;
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const next = Math.round(start + delta * progress);
      displayRef.current = next;
      setDisplay(next);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toLocaleString('uz-UZ')}</>;
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 px-3 text-sm text-[#ffffff]/65">
      <Search size={16} className="text-[#C8A96B]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-40 bg-transparent text-[#ffffff] outline-none placeholder:text-[#ffffff]/40"
      />
    </label>
  );
}

function Pager({
  labels,
  page,
  pages,
  onPrev,
  onNext,
}: {
  labels: (typeof adminText)[Language];
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between text-sm text-[#ffffff]/60">
      <button type="button" onClick={onPrev} className="rounded-full border border-[#ffffff]/10 px-3 py-1.5 transition hover:border-[#C8A96B]/45">
        {labels.previous}
      </button>
      <span>
        {page} / {pages}
      </span>
      <button type="button" onClick={onNext} className="rounded-full border border-[#ffffff]/10 px-3 py-1.5 transition hover:border-[#C8A96B]/45">
        {labels.next}
      </button>
    </div>
  );
}

function getLockerSizeLabel(size: LockerSize) {
  const map = {
    SMALL: 'KICHIK',
    MEDIUM: "O'RTA",
    LARGE: 'KATTA',
  };

  return map[size];
}

function statusClass(status: LockerStatus) {
  const base = 'bg-[#ffffff]/[0.055]';

  if (status === 'OCCUPIED') {
    return 'border-[#C8A96B]/70 bg-[#C8A96B]/16 shadow-[0_0_24px_rgba(200,169,107,0.20)]';
  }

  if (status === 'RESERVED') {
    return 'border-[#C8A96B]/45 bg-[#C8A96B]/10';
  }

  if (status === 'EXPIRED') {
    return 'border-[#ffffff]/28 bg-[#ffffff]/[0.075]';
  }

  if (status === 'MAINTENANCE') {
    return 'border-[#C8A96B]/25 bg-[#1a212f]/65';
  }

  return `border-[#ffffff]/10 ${base}`;
}

function getLockerStatusLabel(status: 'ALL' | LockerStatus, labels: (typeof adminText)[Language]) {
  const map = {
    ALL: labels.all,
    AVAILABLE: labels.available,
    RESERVED: labels.reserved,
    OCCUPIED: labels.occupied,
    EXPIRED: labels.expired,
    MAINTENANCE: labels.maintenance,
  };

  return map[status];
}

function getBookingStatusLabel(status: 'ALL' | Booking['status'], labels: (typeof adminText)[Language]) {
  const map = {
    ALL: labels.all,
    ACTIVE: labels.active,
    EXPIRED: labels.expired,
    COMPLETED: labels.completed,
    CANCELLED: labels.cancelled,
  };

  return map[status];
}

function KeyBadge() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[#C8A96B]/35 bg-[#C8A96B]/12 text-[#C8A96B]">
      <ShieldCheck size={18} />
    </div>
  );
}
