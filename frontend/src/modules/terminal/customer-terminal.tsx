'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import {
  CheckCircle2,
  CreditCard,
  DoorOpen,
  Globe2,
  Home,
  KeyRound,
  Maximize2,
  Phone,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createBooking, fetchLockers, fetchTariffs, mockPayment, requestSmsAuth, verifyAccess, verifySmsAuth } from '@/services/locker-service';
import type { Language } from '@/lib/i18n';
import type { BookingResponse, DemoPaymentResponse, Locker, LockerSize, Tariff } from '@/types/locker';

type Step = 'language' | 'size' | 'duration' | 'phone' | 'sms' | 'terms' | 'locker' | 'payment' | 'success' | 'access';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';
const IDLE_RESET_SECONDS = 60;

const text = {
  uz: {
    title: 'Tashkent City Mall yashik terminali',
    subtitle: 'Buyumlaringizni xavfsiz saqlash uchun yashik band qiling',
    language: 'Tilni tanlang',
    size: 'Yashik hajmini tanlang',
    duration: 'Saqlash muddatini tanlang',
    phone: 'Telefon raqamingiz',
    sms: 'SMS kodni kiriting',
    smsSent: '4 xonali kod telefon raqamingizga yuborildi.',
    smsCode: 'Tasdiqlash kodi',
    smsSend: 'SMS kod yuborish',
    smsVerify: 'Tasdiqlash',
    smsRequired: 'SMS kodni tasdiqlang',
    terms: 'Saqlash shartlari',
    termsIntro: 'Davom etish uchun saqlash shartlari va taqiqlarni tasdiqlang.',
    termsRule1: 'Maksimal saqlash muddati 24 soat.',
    termsRule2: 'Xavfli, yonuvchi, noqonuniy va tez buziladigan buyumlarni saqlash taqiqlanadi.',
    termsRule3: 'PIN/QR kodni boshqa shaxslarga bermang.',
    termsAccept: 'Shartlarga roziman',
    locker: 'Yashik tanlang',
    lockerCardNumber: 'Yashik raqami',
    payment: "To'lov tekshirilmoqda",
    success: 'Yashik tayyor',
    available: 'mavjud',
    continue: 'Davom etish',
    back: 'Ortga',
    home: 'Boshiga',
    fullscreen: "To'liq ekran",
    phoneHint: '+998901234567',
    pay: "To'lovni boshlash",
    pin: 'PIN kod',
    qr: 'QR kirish kodi',
    idle: 'Avtomatik reset',
    access: 'Yashikni ochish',
    accessTitle: 'Yashikni ochish',
    lockerNumber: 'Yashik raqami',
    credential: 'PIN yoki QR kodi',
    openAccess: 'Tekshirish va ochish',
    accessGranted: 'Yashik ochildi',
    accessExpired: 'Kirish kodi muddati tugagan yoki ishlatilgan',
    invalidAccess: "PIN yoki QR kodi noto'g'ri",
    bookingExpired: 'Buyurtma muddati tugagan',
    lockerNotFound: 'Yashik topilmadi',
    accessLocked: 'Kirish vaqtincha bloklangan, operatorga murojaat qiling',
    accessFailed: 'Kirish amalga oshmadi',
    sizeSmall: 'Kichik',
    sizeMedium: "O'rta",
    sizeLarge: 'Katta',
    capacitySmall: 'Ryukzak',
    capacityMedium: 'Xarid paketlari',
    capacityLarge: 'Chamodan',
    oneHour: '1 soat',
    twoHours: '2 soat',
    fourHours: '4 soat',
    phoneRequired: 'Telefon raqami kerak',
  },
  ru: {
    title: 'Терминал ячеек Tashkent City Mall',
    subtitle: 'Забронируйте безопасную ячейку для покупок и багажа',
    language: 'Выберите язык',
    size: 'Выберите размер ячейки',
    duration: 'Выберите срок хранения',
    phone: 'Ваш номер телефона',
    sms: 'Введите SMS код',
    smsSent: '4-значный код отправлен на ваш телефон.',
    smsCode: 'Код подтверждения',
    smsSend: 'Отправить SMS',
    smsVerify: 'Подтвердить',
    smsRequired: 'Подтвердите SMS код',
    terms: 'Условия хранения',
    termsIntro: 'Подтвердите условия хранения и ограничения, чтобы продолжить.',
    termsRule1: 'Максимальный срок хранения - 24 часа.',
    termsRule2: 'Запрещено хранить опасные, горючие, незаконные и скоропортящиеся предметы.',
    termsRule3: 'Не передавайте PIN/QR код третьим лицам.',
    termsAccept: 'Я принимаю условия',
    locker: 'Выберите ячейку',
    lockerCardNumber: 'Номер ячейки',
    payment: 'Проверка оплаты',
    success: 'Ячейка готова',
    available: 'доступно',
    continue: 'Продолжить',
    back: 'Назад',
    home: 'В начало',
    fullscreen: 'Полный экран',
    phoneHint: '+998901234567',
    pay: 'Начать оплату',
    pin: 'PIN код',
    qr: 'QR код доступа',
    idle: 'Автосброс',
    access: 'Открыть ячейку',
    accessTitle: 'Открыть ячейку',
    lockerNumber: 'Номер ячейки',
    credential: 'PIN или QR код',
    openAccess: 'Проверить и открыть',
    accessGranted: 'Ячейка открыта',
    accessExpired: 'Код доступа истек или уже использован',
    invalidAccess: 'Неверный PIN или QR код',
    bookingExpired: 'Срок бронирования истек',
    lockerNotFound: 'Ячейка не найдена',
    accessLocked: 'Доступ временно заблокирован, обратитесь к оператору',
    accessFailed: 'Не удалось выполнить вход',
    sizeSmall: 'Маленькая',
    sizeMedium: 'Средняя',
    sizeLarge: 'Большая',
    capacitySmall: 'Рюкзак',
    capacityMedium: 'Пакеты с покупками',
    capacityLarge: 'Чемодан',
    oneHour: '1 час',
    twoHours: '2 часа',
    fourHours: '4 часа',
    phoneRequired: 'Нужен номер телефона',
  },
  en: {
    title: 'Tashkent City Mall locker terminal',
    subtitle: 'Book a secure locker for your bags and shopping',
    language: 'Select language',
    size: 'Choose locker size',
    duration: 'Choose storage duration',
    phone: 'Your phone number',
    sms: 'Enter SMS code',
    smsSent: 'A 4-digit code was sent to your phone.',
    smsCode: 'Verification code',
    smsSend: 'Send SMS code',
    smsVerify: 'Verify',
    smsRequired: 'Verify the SMS code',
    terms: 'Storage terms',
    termsIntro: 'Confirm the storage terms and restrictions to continue.',
    termsRule1: 'Maximum storage duration is 24 hours.',
    termsRule2: 'Dangerous, flammable, illegal, and perishable items are prohibited.',
    termsRule3: 'Do not share your PIN/QR code with anyone.',
    termsAccept: 'I accept the terms',
    locker: 'Choose a locker',
    lockerCardNumber: 'Locker number',
    payment: 'Authorizing payment',
    success: 'Locker is ready',
    available: 'available',
    continue: 'Continue',
    back: 'Back',
    home: 'Home',
    fullscreen: 'Fullscreen',
    phoneHint: '+998901234567',
    pay: 'Start payment',
    pin: 'PIN code',
    qr: 'QR access code',
    idle: 'Auto reset',
    access: 'Open locker',
    accessTitle: 'Open locker',
    lockerNumber: 'Locker number',
    credential: 'PIN or QR code',
    openAccess: 'Verify and open',
    accessGranted: 'Locker opened',
    accessExpired: 'Access code expired or already used',
    invalidAccess: 'Invalid PIN or QR',
    bookingExpired: 'Booking expired',
    lockerNotFound: 'Locker not found',
    accessLocked: 'Access temporarily locked, contact an operator',
    accessFailed: 'Access failed',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    capacitySmall: 'Backpack',
    capacityMedium: 'Shopping bags',
    capacityLarge: 'Suitcase',
    oneHour: '1 hour',
    twoHours: '2 hours',
    fourHours: '4 hours',
    phoneRequired: 'Phone number is required',
  },
} as const;

type TerminalCopy = (typeof text)[Language];

function translateAccessReason(reason: string | undefined, labels: TerminalCopy) {
  if (!reason) {
    return labels.accessFailed;
  }

  const dictionary: Record<string, string> = {
    'Access granted': labels.accessGranted,
    'Access code expired or already used': labels.accessExpired,
    'Invalid access credential': labels.invalidAccess,
    'Invalid PIN or QR': labels.invalidAccess,
    'Booking expired': labels.bookingExpired,
    'Locker not found': labels.lockerNotFound,
    'Access temporarily locked, contact an operator': labels.accessLocked,
  };

  return dictionary[reason] ?? reason;
}

const sizes: Array<{
  id: LockerSize;
  labelKey: 'sizeSmall' | 'sizeMedium' | 'sizeLarge';
  capacityKey: 'capacitySmall' | 'capacityMedium' | 'capacityLarge';
}> = [
  { id: 'SMALL', labelKey: 'sizeSmall', capacityKey: 'capacitySmall' },
  { id: 'MEDIUM', labelKey: 'sizeMedium', capacityKey: 'capacityMedium' },
  { id: 'LARGE', labelKey: 'sizeLarge', capacityKey: 'capacityLarge' },
];

const lockerSizeLabelKeys: Record<LockerSize, 'sizeSmall' | 'sizeMedium' | 'sizeLarge'> = {
  SMALL: 'sizeSmall',
  MEDIUM: 'sizeMedium',
  LARGE: 'sizeLarge',
};

const defaultDurations = [
  { id: 'SMALL-15', name: 'SMALL 15min', lockerSize: 'SMALL' as LockerSize, durationMinutes: 15, price: 5000, currency: 'UZS', isActive: true },
  { id: 'SMALL-60', name: 'SMALL 1h', lockerSize: 'SMALL' as LockerSize, durationMinutes: 60, price: 15000, currency: 'UZS', isActive: true },
  { id: 'SMALL-120', name: 'SMALL 2h', lockerSize: 'SMALL' as LockerSize, durationMinutes: 120, price: 25000, currency: 'UZS', isActive: true },
  { id: 'SMALL-240', name: 'SMALL 4h', lockerSize: 'SMALL' as LockerSize, durationMinutes: 240, price: 45000, currency: 'UZS', isActive: true },
  { id: 'MEDIUM-15', name: 'MEDIUM 15min', lockerSize: 'MEDIUM' as LockerSize, durationMinutes: 15, price: 8000, currency: 'UZS', isActive: true },
  { id: 'MEDIUM-60', name: 'MEDIUM 1h', lockerSize: 'MEDIUM' as LockerSize, durationMinutes: 60, price: 20000, currency: 'UZS', isActive: true },
  { id: 'MEDIUM-120', name: 'MEDIUM 2h', lockerSize: 'MEDIUM' as LockerSize, durationMinutes: 120, price: 35000, currency: 'UZS', isActive: true },
  { id: 'MEDIUM-240', name: 'MEDIUM 4h', lockerSize: 'MEDIUM' as LockerSize, durationMinutes: 240, price: 60000, currency: 'UZS', isActive: true },
  { id: 'LARGE-15', name: 'LARGE 15min', lockerSize: 'LARGE' as LockerSize, durationMinutes: 15, price: 12000, currency: 'UZS', isActive: true },
  { id: 'LARGE-60', name: 'LARGE 1h', lockerSize: 'LARGE' as LockerSize, durationMinutes: 60, price: 30000, currency: 'UZS', isActive: true },
  { id: 'LARGE-120', name: 'LARGE 2h', lockerSize: 'LARGE' as LockerSize, durationMinutes: 120, price: 50000, currency: 'UZS', isActive: true },
  { id: 'LARGE-240', name: 'LARGE 4h', lockerSize: 'LARGE' as LockerSize, durationMinutes: 240, price: 90000, currency: 'UZS', isActive: true },
];

const languageButtons: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export function CustomerTerminal() {
  const [language, setLanguage] = useState<Language>('uz');
  const [step, setStep] = useState<Step>('language');
  const [size, setSize] = useState<LockerSize>('MEDIUM');
  const [duration, setDuration] = useState<Tariff>(defaultDurations[5]);
  const [phone, setPhone] = useState('+998');
  const [smsCode, setSmsCode] = useState('');
  const [smsToken, setSmsToken] = useState<string | null>(null);
  const [smsDevCode, setSmsDevCode] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentResult, setPaymentResult] = useState<DemoPaymentResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [idleLeft, setIdleLeft] = useState(IDLE_RESET_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [accessLockerId, setAccessLockerId] = useState('');
  const [credential, setCredential] = useState('');
  const [accessResult, setAccessResult] = useState<string | null>(null);
  const [accessResetLeft, setAccessResetLeft] = useState<number | null>(null);
  const [isVerifyingAccess, setIsVerifyingAccess] = useState(false);
  const t: TerminalCopy = text[language];

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['terminal-lockers'],
    queryFn: fetchLockers,
    refetchInterval: 5000,
  });
  const { data: tariffs, refetch: refetchTariffs } = useQuery({
    queryKey: ['terminal-tariffs'],
    queryFn: fetchTariffs,
    refetchInterval: 5000,
  });

  const availableLockers = useMemo(
    () =>
      data?.data.filter((locker) => locker.status === 'AVAILABLE' && locker.size === size).slice(0, 24) ?? [],
    [data, size],
  );
  const durationOptions = useMemo(() => {
    const uniqueOptions = new Map<string, Tariff>();

    for (const tariff of tariffs ?? defaultDurations) {
      if (!tariff.isActive || tariff.lockerSize !== size) {
        continue;
      }

      const key = `${tariff.lockerSize}-${tariff.durationMinutes}-${tariff.currency}`;
      const existing = uniqueOptions.get(key);
      if (!existing || tariff.price < existing.price) {
        uniqueOptions.set(key, tariff);
      }
    }

    const options = Array.from(uniqueOptions.values())
      .filter((tariff) => tariff.isActive && tariff.lockerSize === size)
      .sort((first, second) => first.durationMinutes - second.durationMinutes);

    return options.length ? options : defaultDurations.filter((tariff) => tariff.lockerSize === size);
  }, [size, tariffs]);

  useEffect(() => {
    const stillExists = durationOptions.some((item) => item.id === duration.id);
    if (!stillExists && durationOptions[0]) {
      setDuration(durationOptions[0]);
    }
  }, [duration.id, durationOptions]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socket.on('lockers:updated', () => void refetch());
    socket.on('booking:updated', () => {
      void refetch();
      void refetchTariffs();
    });

    return () => {
      socket.disconnect();
    };
  }, [refetch, refetchTariffs]);

  function resetTerminal() {
    setStep('language');
    setSize('MEDIUM');
    setDuration(defaultDurations[5]);
    setPhone('+998');
    setSmsCode('');
    setSmsToken(null);
    setSmsDevCode(null);
    setIsSendingSms(false);
    setIsVerifyingSms(false);
    setSelectedLocker(null);
    setBooking(null);
    setTermsAccepted(false);
    setPaymentResult(null);
    setIsPaying(false);
    setError(null);
    setAccessLockerId('');
    setCredential('');
    setAccessResult(null);
    setAccessResetLeft(null);
    setIsVerifyingAccess(false);
    setIdleLeft(IDLE_RESET_SECONDS);
  }

  function goBack() {
    if (step === 'access' || step === 'size') {
      setStep('language');
      return;
    }

    if (step === 'duration') {
      setStep('size');
      return;
    }

    if (step === 'phone') {
      setStep('duration');
      return;
    }

    if (step === 'sms') {
      setStep('phone');
      return;
    }

    if (step === 'terms') {
      setStep('sms');
      return;
    }

    if (step === 'locker') {
      setStep('terms');
      return;
    }

    if (step === 'payment') {
      setStep('locker');
    }
  }

  useEffect(() => {
    const resetIdle = () => setIdleLeft(IDLE_RESET_SECONDS);
    window.addEventListener('pointerdown', resetIdle);
    window.addEventListener('keydown', resetIdle);
    return () => {
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIdleLeft((current) => {
        if (current <= 1) {
          resetTerminal();
          return IDLE_RESET_SECONDS;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function startPayment() {
    if (!selectedLocker || phone.length < 9) {
      setError(t.phoneRequired);
      return;
    }

    if (!smsToken) {
      setError(t.smsRequired);
      setStep('sms');
      return;
    }

    setError(null);
    setIsPaying(true);
    setStep('payment');

    try {
      const created = await createBooking({
          lockerId: selectedLocker.number,
          lockerSize: selectedLocker.size,
          durationMinutes: duration.durationMinutes,
        phone,
        customerName: 'Terminal customer',
        termsAccepted,
        smsVerificationToken: smsToken,
      });
      setBooking(created);
      await new Promise((resolve) => window.setTimeout(resolve, 1300));
      const paid = await mockPayment(created.booking.id);
      setPaymentResult(paid);
      setStep('success');
      await refetch();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Payment failed');
      setStep('locker');
    } finally {
      setIsPaying(false);
    }
  }

  async function sendSmsCode() {
    if (phone.length < 9) {
      setError(t.phoneRequired);
      return;
    }

    setError(null);
    setSmsToken(null);
    setSmsCode('');
    setSmsDevCode(null);
    setIsSendingSms(true);

    try {
      const result = await requestSmsAuth(phone);
      setSmsDevCode(result.devCode ?? null);
      setStep('sms');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'SMS failed');
    } finally {
      setIsSendingSms(false);
    }
  }

  async function submitSmsCode() {
    if (smsCode.trim().length < 4) {
      setError(t.smsRequired);
      return;
    }

    setError(null);
    setIsVerifyingSms(true);

    try {
      const result = await verifySmsAuth(phone, smsCode.trim());
      setSmsToken(result.token);
      setStep('terms');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'SMS failed');
    } finally {
      setIsVerifyingSms(false);
    }
  }

  async function submitAccess() {
    const lockerNumber = parseLockerNumber(accessLockerId);

    if (!lockerNumber || !credential.trim()) {
      setError(`${t.lockerNumber} / ${t.credential}`);
      return;
    }

    setError(null);
    setAccessResult(null);
    setIsVerifyingAccess(true);

    try {
      const result = await verifyAccess(lockerNumber, credential.trim());
      setAccessResult(result.valid ? t.accessGranted : translateAccessReason(result.reason, t));
      setAccessResetLeft(result.valid ? 10 : null);
      await refetch();
    } catch (requestError) {
      setError(requestError instanceof Error ? translateAccessReason(requestError.message, t) : t.accessFailed);
    } finally {
      setIsVerifyingAccess(false);
    }
  }

  useEffect(() => {
    if (accessResetLeft === null) {
      return;
    }

    if (accessResetLeft <= 0) {
      resetTerminal();
      return;
    }

    const timer = window.setTimeout(() => {
      setAccessResetLeft((current) => (current === null ? null : current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [accessResetLeft]);

  function requestFullscreen() {
    void document.documentElement.requestFullscreen?.();
  }

  return (
    <main className="luxury-bg min-h-screen overflow-y-auto overflow-x-hidden text-[#ffffff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(179,128,110,0.24),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(255,255,255,0.10),transparent_24%)]" />
      <div className="terminal-shell relative flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-10 lg:py-8 2xl:px-14">
        <header className="grid gap-5 lg:flex lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-full">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#b3806e]/35 bg-[#b3806e]/12 px-5 py-3 text-sm font-bold uppercase text-[#ffffff]">
              <DoorOpen size={18} />
              Tashkent City Mall
            </div>
            <h1 className="terminal-title mt-5 max-w-full break-words text-3xl font-semibold tracking-normal sm:max-w-5xl sm:text-5xl 2xl:text-6xl">{t.title}</h1>
            <p className="mt-3 max-w-3xl text-lg text-[#ffffff]/72 sm:text-xl">{t.subtitle}</p>
          </div>
          <div className="terminal-actions grid w-full grid-cols-2 gap-3 lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end">
            <div className="min-w-0 rounded-2xl border border-[#ffffff]/10 bg-[#ffffff]/[0.06] px-4 py-3 text-right text-sm text-[#ffffff]/70 sm:px-5">
              <p>{t.idle}</p>
              <p className="mt-1 text-2xl font-bold text-[#ffffff]">{idleLeft}s</p>
            </div>
            <Button variant="secondary" className="min-h-14 min-w-0 whitespace-normal px-3 text-sm leading-tight sm:px-6 sm:text-base lg:min-h-16" onClick={requestFullscreen}>
              <Maximize2 size={22} />
              {t.fullscreen}
            </Button>
            {step === 'language' ? (
              <Button variant="secondary" className="col-span-2 min-h-18 min-w-0 whitespace-normal px-5 text-xl leading-tight sm:px-8 sm:text-2xl lg:col-span-1 lg:min-h-20" onClick={() => setStep('access')}>
                <KeyRound size={22} />
                {t.access}
              </Button>
            ) : (
              <Button variant="secondary" className="col-span-2 min-h-14 min-w-0 whitespace-normal px-3 text-sm leading-tight sm:px-6 sm:text-base lg:col-span-1 lg:min-h-16" onClick={resetTerminal}>
                <Home size={22} />
                {t.home}
              </Button>
            )}
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-2xl border border-[#b3806e]/35 bg-[#b3806e]/12 px-5 py-3 font-semibold text-[#ffffff]">
            {error}
          </div>
        ) : null}

        {!['language', 'success'].includes(step) ? (
          <div className="mt-5">
            <Button variant="secondary" className="min-h-14 px-6 text-base" onClick={goBack}>
              {t.back}
            </Button>
          </div>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          {step === 'language' ? (
            <Panel key="language">
              <div className="mx-auto w-full max-w-5xl min-w-0 text-center">
                <Globe2 className="mx-auto text-[#b3806e]" size={72} />
                <h2 className="mt-6 text-5xl font-semibold">{t.language}</h2>
                <div className="mt-10 grid gap-5 md:grid-cols-3">
                  {languageButtons.map((item) => (
                    <button
                      key={item.code}
                      onClick={() => {
                        setLanguage(item.code);
                        setStep('size');
                      }}
                    className="terminal-choice-card luxury-card min-h-44 min-w-0 rounded-[2rem] p-8 text-3xl font-semibold transition hover:-translate-y-1 hover:border-[#b3806e]/55 hover:bg-[#b3806e]/14 sm:text-4xl"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          ) : null}

          {step === 'access' ? (
            <Panel key="access">
              <div className="mx-auto w-full max-w-5xl px-4">
                <Card className="overflow-hidden p-10">
                  <KeyRound className="text-[#b3806e]" size={64} />
                  <h2 className="mt-6 text-5xl font-semibold">{t.accessTitle}</h2>
                  <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                    <input
                      value={accessLockerId}
                      onChange={(event) => setAccessLockerId(event.target.value)}
                      inputMode="numeric"
                      placeholder={t.lockerNumber}
                      className="min-h-20 min-w-0 rounded-[1.6rem] border border-[#ffffff]/10 bg-[#1a212f]/70 px-6 text-3xl font-semibold text-[#ffffff] outline-none ring-[#b3806e]/40 placeholder:text-[#ffffff]/48 focus:ring-4"
                    />
                    <input
                      value={credential}
                      onChange={(event) => setCredential(event.target.value)}
                      placeholder={t.credential}
                      className="min-h-20 min-w-0 rounded-[1.6rem] border border-[#ffffff]/10 bg-[#1a212f]/70 px-6 text-2xl font-semibold text-[#ffffff] outline-none ring-[#b3806e]/40 placeholder:text-[#ffffff]/48 focus:ring-4"
                    />
                  </div>
                  {accessResult ? (
                    <p className="mt-6 rounded-2xl border border-[#b3806e]/35 bg-[#b3806e]/12 px-5 py-4 text-xl font-semibold text-[#ffffff]">
                      {accessResult}
                      {accessResetLeft !== null ? ` · ${accessResetLeft}s` : ''}
                    </p>
                  ) : null}
                  <div className="mt-8">
                    <Button className="min-h-20 w-full text-xl" disabled={isVerifyingAccess} onClick={() => void submitAccess()}>
                      <DoorOpen size={28} />
                      {t.openAccess}
                    </Button>
                  </div>
                </Card>
              </div>
            </Panel>
          ) : null}

          {step === 'size' ? (
            <Panel key="size">
              <ChoiceShell title={t.size}>
                {sizes.map((item) => {
                  const count = data?.data.filter(
                    (locker) => locker.status === 'AVAILABLE' && locker.size === item.id,
                  ).length ?? 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSize(item.id);
                        setStep('duration');
                      }}
                      className="terminal-choice-card luxury-card min-h-56 rounded-[2rem] p-8 text-left transition hover:-translate-y-1 hover:border-[#b3806e]/55 hover:bg-[#b3806e]/14"
                    >
                      <p className="text-4xl font-semibold">{t[item.labelKey]}</p>
                      <p className="mt-4 text-xl text-[#ffffff]/70">{t[item.capacityKey]}</p>
                      <p className="mt-8 text-2xl font-bold text-[#ffffff]">
                        {count} {t.available}
                      </p>
                    </button>
                  );
                })}
              </ChoiceShell>
            </Panel>
          ) : null}

          {step === 'duration' ? (
            <Panel key="duration">
              <ChoiceShell title={t.duration}>
                {durationOptions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setDuration(item);
                      setStep('phone');
                    }}
                    className="terminal-choice-card luxury-card min-h-52 rounded-[2rem] p-8 text-left transition hover:-translate-y-1 hover:border-[#b3806e]/55 hover:bg-[#b3806e]/14"
                  >
                    <p className="text-5xl font-semibold">{formatDuration(item.durationMinutes, language)}</p>
                    <p className="mt-8 text-3xl font-bold text-[#ffffff]">
                      {item.price.toLocaleString('uz-UZ')} UZS
                    </p>
                  </button>
                ))}
              </ChoiceShell>
            </Panel>
          ) : null}

          {step === 'phone' ? (
            <Panel key="phone">
              <div className="mx-auto w-full max-w-3xl">
                <Card className="p-10">
                  <Phone className="text-[#b3806e]" size={60} />
                  <h2 className="mt-6 text-5xl font-semibold">{t.phone}</h2>
                  <input
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setSmsToken(null);
                      setSmsCode('');
                      setSmsDevCode(null);
                    }}
                    inputMode="tel"
                    placeholder={t.phoneHint}
                    className="mt-8 min-h-24 w-full rounded-[2rem] border border-[#ffffff]/10 bg-[#1a212f]/70 px-8 text-5xl font-semibold text-[#ffffff] outline-none ring-[#b3806e]/40 focus:ring-4"
                  />
                  <div className="mt-8">
                    <Button className="min-h-20 w-full text-xl" disabled={isSendingSms} onClick={() => void sendSmsCode()}>
                      {isSendingSms ? getSmsSendingLabel(language) : t.smsSend}
                    </Button>
                  </div>
                </Card>
              </div>
            </Panel>
          ) : null}

          {step === 'sms' ? (
            <Panel key="sms">
              <div className="mx-auto w-full max-w-3xl">
                <Card className="p-10">
                  <Phone className="text-[#b3806e]" size={60} />
                  <h2 className="mt-6 text-5xl font-semibold">{t.sms}</h2>
                  <p className="mt-4 text-xl text-[#ffffff]/70">{t.smsSent}</p>
                  <p className="mt-2 text-lg font-semibold text-[#ffffff]/80">{phone}</p>
                  {smsDevCode ? (
                    <p className="mt-5 rounded-2xl border border-[#b3806e]/35 bg-[#b3806e]/12 px-5 py-4 text-xl font-bold">
                      Demo kod: {smsDevCode}
                    </p>
                  ) : null}
                  <input
                    value={smsCode}
                    onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={t.smsCode}
                    className="mt-8 min-h-24 w-full rounded-[2rem] border border-[#ffffff]/10 bg-[#1a212f]/70 px-8 text-center text-6xl font-semibold tracking-[0.28em] text-[#ffffff] outline-none ring-[#b3806e]/40 focus:ring-4"
                  />
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    <Button variant="secondary" className="min-h-20 text-xl" disabled={isSendingSms} onClick={() => void sendSmsCode()}>
                      {isSendingSms ? getSmsSendingLabel(language) : t.smsSend}
                    </Button>
                    <Button className="min-h-20 text-xl" disabled={isVerifyingSms || smsCode.length !== 4} onClick={() => void submitSmsCode()}>
                      {t.smsVerify}
                    </Button>
                  </div>
                </Card>
              </div>
            </Panel>
          ) : null}

          {step === 'terms' ? (
            <Panel key="terms">
              <div className="mx-auto w-full max-w-4xl">
                <Card className="p-10">
                  <ShieldCheck className="text-[#b3806e]" size={64} />
                  <h2 className="mt-6 text-5xl font-semibold">{t.terms}</h2>
                  <p className="mt-4 text-xl text-[#ffffff]/70">{t.termsIntro}</p>
                  <div className="mt-8 grid gap-4 text-lg text-[#ffffff]/78">
                    {[t.termsRule1, t.termsRule2, t.termsRule3].map((rule) => (
                      <div key={rule} className="rounded-2xl border border-[#ffffff]/10 bg-[#1a212f]/55 p-5">
                        {rule}
                      </div>
                    ))}
                  </div>
                  <label className="mt-8 flex cursor-pointer items-center gap-4 rounded-2xl border border-[#b3806e]/30 bg-[#b3806e]/12 p-5 text-xl font-semibold">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      className="h-7 w-7 accent-[#b3806e]"
                    />
                    {t.termsAccept}
                  </label>
                  <div className="mt-8">
                    <Button className="min-h-20 w-full text-xl" disabled={!termsAccepted} onClick={() => setStep('locker')}>
                      {t.continue}
                    </Button>
                  </div>
                </Card>
              </div>
            </Panel>
          ) : null}

          {step === 'locker' ? (
            <Panel key="locker">
              <div className="w-full">
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <h2 className="text-4xl font-semibold">{t.locker}</h2>
                    <p className="mt-2 text-xl text-[#ffffff]/70">
                      {isLoading ? '...' : `${availableLockers.length} ${t.available}`}
                    </p>
                  </div>
                  <Button variant="secondary" className="min-h-14 text-base" onClick={() => void refetch()}>
                    {t.available}
                  </Button>
                </div>
                <div className="grid max-h-[52vh] auto-rows-[10.5rem] gap-4 overflow-y-auto pr-2 pb-3 md:grid-cols-3 xl:grid-cols-6 2xl:auto-rows-[11.25rem]">
                  {availableLockers.map((locker, index) => (
                    <motion.button
                      key={locker.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => setSelectedLocker(locker)}
                      className={`flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-[1.5rem] border p-5 text-left transition hover:-translate-y-1 ${
                        selectedLocker?.id === locker.id
                          ? 'border-[#b3806e] bg-[#b3806e]/18 bronze-glow'
                          : 'border-[#ffffff]/10 bg-[#1a212f]/55 hover:border-[#b3806e]/45 hover:bg-[#b3806e]/10'
                      }`}
                    >
                      <span className="text-sm font-bold uppercase text-[#ffffff]/55">
                        {t.lockerCardNumber}
                      </span>
                      <span className="block text-4xl font-semibold leading-none">{locker.number}</span>
                      <span className="text-sm font-bold uppercase text-[#ffffff]/80">
                        {t[lockerSizeLabelKeys[locker.size]]}
                      </span>
                    </motion.button>
                  ))}
                </div>
                <div className="mt-6">
                  <Button className="min-h-20 w-full text-xl" disabled={!selectedLocker} onClick={() => void startPayment()}>
                    <CreditCard size={28} />
                    {t.pay}
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          {step === 'payment' ? (
            <Panel key="payment">
              <div className="text-center">
                <div className="mx-auto grid h-32 w-32 place-items-center rounded-full border border-[#b3806e]/35 bg-[#b3806e]/12">
                  <CreditCard className="animate-pulse text-[#b3806e]" size={56} />
                </div>
                <h2 className="mt-8 text-5xl font-semibold">{t.payment}</h2>
                <p className="mt-4 text-2xl text-[#ffffff]/70">
                  {isPaying ? `${duration.price.toLocaleString('uz-UZ')} UZS` : ''}
                </p>
              </div>
            </Panel>
          ) : null}

          {step === 'success' && paymentResult ? (
            <Panel key="success">
              <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <Card className="grid place-items-center p-10">
                  <QrPreview value={paymentResult.access.qrCode} />
                  <p className="mt-5 flex items-center gap-2 text-xl font-bold text-[#ffffff]">
                    <QrCode />
                    {t.qr}
                  </p>
                </Card>
                <Card className="p-10">
                  <CheckCircle2 className="text-[#b3806e]" size={64} />
                  <h2 className="mt-6 text-5xl font-semibold">{t.success}</h2>
                  <div className="mt-8 rounded-[2rem] border border-[#b3806e]/25 bg-[#1a212f]/60 p-8">
                    <p className="text-lg font-bold uppercase text-[#ffffff]/55">{t.pin}</p>
                    <p className="mt-3 text-7xl font-semibold tracking-[0.22em] text-[#ffffff]">
                      {paymentResult.access.pinCode}
                    </p>
                  </div>
                  <p className="mt-6 text-2xl text-[#ffffff]/75">
                    {t.locker}: {paymentResult.data.number}
                  </p>
                  <p className="mt-3 text-lg text-[#ffffff]/55">
                    {booking?.booking.expiresAt ? new Date(booking.booking.expiresAt).toLocaleString() : ''}
                  </p>
                  <Button className="mt-10 min-h-20 w-full text-xl" onClick={resetTerminal}>
                    {t.home}
                  </Button>
                </Card>
              </div>
            </Panel>
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -28 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="terminal-panel flex min-h-0 flex-1 items-center justify-center py-5 lg:py-6"
    >
      {children}
    </motion.section>
  );
}

function ChoiceShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <h2 className="terminal-section-title break-words text-center text-4xl font-semibold sm:text-5xl">{title}</h2>
      <div className="terminal-choice-grid mt-8 grid gap-5 md:grid-cols-3 lg:mt-10">{children}</div>
    </div>
  );
}

function QrPreview({ value }: { value: string }) {
  return (
    <div className="rounded-[2rem] border border-[#b3806e]/35 bg-[#ffffff] p-6 shadow-[0_0_36px_rgba(179,128,110,0.25)]">
      <QRCodeSVG value={value} size={288} bgColor="#ffffff" fgColor="#1a212f" level="M" />
    </div>
  );
}

function formatDuration(minutes: number, language: Language) {
  if (minutes < 60) {
    if (language === 'ru') {
      return `${minutes} мин`;
    }
    if (language === 'en') {
      return `${minutes} min`;
    }
    return `${minutes} daqiqa`;
  }

  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    if (language === 'ru') {
      return `${hours} ${hours === 1 ? 'час' : 'часа'}`;
    }
    if (language === 'en') {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${hours} soat`;
  }

  if (language === 'ru') {
    return `${minutes} мин`;
  }
  if (language === 'en') {
    return `${minutes} min`;
  }
  return `${minutes} daqiqa`;
}

function getSmsSendingLabel(language: Language) {
  if (language === 'ru') {
    return 'Sending...';
  }

  if (language === 'en') {
    return 'Sending...';
  }

  return 'Yuborilmoqda...';
}

function parseLockerNumber(value: string) {
  const normalized = value.trim().toUpperCase().replace(/^L-?/, '');
  const lockerNumber = Number(normalized.replace(/\D/g, ''));

  return Number.isInteger(lockerNumber) && lockerNumber > 0 ? lockerNumber : null;
}
