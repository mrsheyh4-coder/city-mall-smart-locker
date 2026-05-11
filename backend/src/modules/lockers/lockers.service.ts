import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import {
  AccessMethod,
  BookingStatus,
  Locker,
  LockerSize,
  LockerStatus,
  PaymentStatus,
  SessionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { HardwareService } from '../hardware/hardware.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { CreateBookingDto } from './dto/locker-action.dto';
import { LockersGateway } from './lockers.gateway';

@Injectable()
export class LockersService implements OnModuleInit, OnModuleDestroy {
  private readonly commandQueues = new Map<number, Promise<void>>();
  private expirationTimer?: NodeJS.Timeout;

  constructor(
    private readonly hardware: HardwareService,
    private readonly integrations: IntegrationsService,
    private readonly prisma: PrismaService,
    private readonly gateway: LockersGateway,
  ) {}

  onModuleInit() {
    this.expirationTimer = setInterval(() => {
      void this.expireOverdueBookings();
    }, 15_000);
  }

  onModuleDestroy() {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
    }
  }

  async findAll() {
    await this.expireOverdueBookings();

    const [lockers, activeBookings] = await Promise.all([
      this.prisma.locker.findMany({
        orderBy: { number: 'asc' },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.ACTIVE },
      }),
    ]);

    return {
      data: lockers,
      meta: await this.buildSummary(lockers, activeBookings),
    };
  }

  async findOne(id: string) {
    const numericId = Number(id);
    const locker = await this.prisma.locker.findFirst({
      where: Number.isInteger(numericId)
        ? { OR: [{ id }, { number: numericId }] }
        : { id },
    });

    if (!locker) {
      throw new NotFoundException(`Locker ${id} was not found`);
    }

    return { data: locker };
  }

  async getStatus(size?: LockerSize) {
    const response = await this.findAll();

    return {
      ...response,
      data: size
        ? response.data.filter((locker) => locker.size === size)
        : response.data,
      hardware: {
        mode: 'MOCK',
        online: true,
        adapter: 'SimulatedHardwareService',
      },
    };
  }

  async findPublicTariffs() {
    return this.prisma.tariff.findMany({
      where: { isActive: true },
      orderBy: [{ lockerSize: 'asc' }, { durationMinutes: 'asc' }],
    });
  }

  async open(lockerId: number) {
    return this.runWithLockerQueue(lockerId, async () => {
      const locker = await this.findByNumber(lockerId);

      if (
        locker.status !== LockerStatus.AVAILABLE &&
        locker.status !== LockerStatus.RESERVED &&
        locker.status !== LockerStatus.OCCUPIED
      ) {
        throw new BadRequestException(
          `Locker ${lockerId} cannot be opened from ${locker.status} status`,
        );
      }

      if (locker.isOpen) {
        throw new BadRequestException(`Locker ${lockerId} is already open`);
      }

      const hardware = await this.hardware.openLocker(lockerId);
      const result = await this.prisma.locker.updateMany({
        where: {
          id: locker.id,
          isOpen: false,
          status: {
            in: [
              LockerStatus.AVAILABLE,
              LockerStatus.RESERVED,
              LockerStatus.OCCUPIED,
            ],
          },
        },
        data: {
          isOpen: true,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          `Locker ${lockerId} state changed before open command completed`,
        );
      }

      const updated = await this.findByNumber(lockerId);
      await this.createLog(
        'INFO',
        'hardware',
        `Locker ${lockerId} opened`,
        updated.id,
      );
      this.gateway.emitLockersUpdated(await this.findAll());

      return { data: updated, hardware };
    });
  }

  async close(lockerId: number) {
    return this.runWithLockerQueue(lockerId, async () => {
      const locker = await this.findByNumber(lockerId);

      if (!locker.isOpen) {
        throw new BadRequestException(`Locker ${lockerId} is already closed`);
      }

      const hardware = await this.hardware.closeLocker(lockerId);
      const updated = await this.prisma.locker.update({
        where: { id: locker.id },
        data: { isOpen: false },
      });

      await this.createLog(
        'INFO',
        'hardware',
        `Locker ${lockerId} closed`,
        updated.id,
      );
      this.gateway.emitLockersUpdated(await this.findAll());

      return { data: updated, hardware };
    });
  }

  async release(lockerId: number) {
    return this.runWithLockerQueue(lockerId, async () => {
      const locker = await this.findByNumber(lockerId);

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.booking.updateMany({
          where: {
            lockerId: locker.id,
            status: BookingStatus.ACTIVE,
          },
          data: {
            status: BookingStatus.CANCELLED,
            completedAt: new Date(),
          },
        });

        await tx.session.updateMany({
          where: {
            lockerId: locker.id,
            status: SessionStatus.ACTIVE,
          },
          data: {
            status: SessionStatus.COMPLETED,
            endTime: new Date(),
          },
        });

        return tx.locker.update({
          where: { id: locker.id },
          data: {
            status: LockerStatus.AVAILABLE,
            isOpen: false,
            pinCode: null,
            qrCode: null,
            customerName: null,
            bookingStartAt: null,
            bookingExpiresAt: null,
          },
        });
      });

      await this.createLog(
        'INFO',
        'admin',
        `Locker ${lockerId} released by admin`,
        updated.id,
      );
      this.gateway.emitLockersUpdated(await this.findAll());

      return { data: updated };
    });
  }

  async expire(lockerId: number) {
    return this.runWithLockerQueue(lockerId, async () => {
      const locker = await this.findByNumber(lockerId);
      const updated = await this.prisma.locker.update({
        where: { id: locker.id },
        data: {
          status: LockerStatus.EXPIRED,
          isOpen: false,
        },
      });

      await this.prisma.booking.updateMany({
        where: {
          lockerId: locker.id,
          status: BookingStatus.ACTIVE,
        },
        data: { status: BookingStatus.EXPIRED },
      });

      await this.createLog(
        'WARN',
        'admin',
        `Locker ${lockerId} marked expired by admin`,
        updated.id,
      );
      this.gateway.emitLockersUpdated(await this.findAll());

      return { data: updated };
    });
  }

  async setMaintenance(lockerId: number) {
    return this.runWithLockerQueue(lockerId, async () => {
      const locker = await this.findByNumber(lockerId);
      const enteringMaintenance = locker.status !== LockerStatus.MAINTENANCE;
      const updated = await this.prisma.locker.update({
        where: { id: locker.id },
        data: enteringMaintenance
          ? {
              status: LockerStatus.MAINTENANCE,
              isOpen: false,
              pinCode: null,
              qrCode: null,
              customerName: null,
              bookingStartAt: null,
              bookingExpiresAt: null,
            }
          : {
              status: LockerStatus.AVAILABLE,
              isOpen: false,
            },
      });

      await this.createLog(
        'INFO',
        'admin',
        `Locker ${lockerId} moved to ${updated.status}`,
        updated.id,
      );
      this.gateway.emitLockersUpdated(await this.findAll());

      return { data: updated };
    });
  }

  async createBooking(dto: CreateBookingDto) {
    await this.expireOverdueBookings();

    return this.runWithLockerQueue(dto.lockerId, async () => {
      if (!dto.termsAccepted) {
        throw new BadRequestException(
          'Storage terms must be accepted before booking',
        );
      }

      await this.assertSmsVerified(dto.phone, dto.smsVerificationToken);

      const locker = await this.findByNumber(dto.lockerId);

      if (locker.size !== dto.lockerSize) {
        throw new BadRequestException(
          `Locker ${dto.lockerId} is ${locker.size}, not ${dto.lockerSize}`,
        );
      }

      if (locker.status !== LockerStatus.AVAILABLE || locker.isOpen) {
        throw new BadRequestException(
          `Locker ${dto.lockerId} is not available for booking`,
        );
      }

      const startedAt = new Date();
      const expiresAt = new Date(
        startedAt.getTime() + dto.durationMinutes * 60_000,
      );
      const pinCode = this.generatePin();
      const qrCode = this.buildQrPayload(locker.number, pinCode, expiresAt);

      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { phone: dto.phone },
          update: { name: dto.customerName },
          create: {
            phone: dto.phone,
            name: dto.customerName,
          },
        });

        const booking = await tx.booking.create({
          data: {
            lockerId: locker.id,
            userId: user.id,
            phone: dto.phone,
            customerName: dto.customerName,
            durationMinutes: dto.durationMinutes,
            startTime: startedAt,
            expiresAt,
          },
        });

        const accessCode = await tx.accessCode.create({
          data: {
            bookingId: booking.id,
            lockerId: locker.id,
            userId: user.id,
            pinCode,
            qrCode,
            expiresAt,
          },
        });

        const updatedLocker = await tx.locker.update({
          where: { id: locker.id },
          data: {
            status: LockerStatus.RESERVED,
            pinCode,
            qrCode,
            customerName: dto.customerName ?? dto.phone,
            bookingStartAt: startedAt,
            bookingExpiresAt: expiresAt,
          },
        });

        return { booking, accessCode, locker: updatedLocker };
      });

      await this.createLog(
        'INFO',
        'booking',
        `Booking ${result.booking.id} created for locker ${locker.number}; storage terms accepted`,
        locker.id,
      );
      this.gateway.emitBookingUpdated(result);
      this.gateway.emitLockersUpdated(await this.findAll());

      return {
        data: result.locker,
        booking: result.booking,
        access: {
          pinCode: result.accessCode.pinCode,
          qrCode: result.accessCode.qrCode,
        },
      };
    });
  }

  async requestSmsAuth(phone: string) {
    await this.prisma.smsVerification.deleteMany({
      where: {
        phone,
        verifiedAt: null,
        expiresAt: { lt: new Date() },
      },
    });

    const recentRequests = await this.prisma.smsVerification.count({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
      },
    });

    if (recentRequests >= 5) {
      throw new BadRequestException('Too many SMS requests. Try again later.');
    }

    const code = this.buildSmsAuthCode();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    await this.prisma.smsVerification.create({
      data: {
        phone,
        userId: user.id,
        codeHash: this.hashSmsCode(phone, code),
        expiresAt,
      },
    });

    const sms = await this.queueAccessSms(
      phone,
      this.buildSmsAuthMessage(code),
    );

    if (
      !sms.queued &&
      ['ESKIZ', 'DEVSMS'].includes(process.env.SMS_MODE ?? 'MOCK')
    ) {
      const error =
        'error' in sms && typeof sms.error === 'string' ? sms.error : undefined;

      throw new BadRequestException(
        error ??
          'SMS delivery failed. Check SMS provider account status and approved message templates.',
      );
    }

    await this.createLog(
      'INFO',
      'sms-auth',
      `SMS auth code ${sms.state} for ${this.maskPhone(phone)}`,
    );

    return {
      sent: true,
      expiresAt: expiresAt.toISOString(),
      sms,
      devCode: this.shouldExposeMockSmsCode(sms.state) ? code : undefined,
    };
  }

  async verifySmsAuth(phone: string, code: string) {
    const verification = await this.prisma.smsVerification.findFirst({
      where: {
        phone,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new BadRequestException('SMS code expired. Request a new code.');
    }

    if (verification.attempts >= 5) {
      throw new BadRequestException('Too many invalid SMS code attempts.');
    }

    const normalizedCode = this.normalizeSmsCode(code);
    const validCodeHashes = this.getAcceptedSmsAuthCodeHashes(
      phone,
      verification.codeHash,
    );

    if (!validCodeHashes.includes(this.hashSmsCode(phone, normalizedCode))) {
      await this.prisma.smsVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid SMS code.');
    }

    const token = randomBytes(24).toString('base64url');
    const updated = await this.prisma.smsVerification.update({
      where: { id: verification.id },
      data: {
        token,
        verifiedAt: new Date(),
      },
    });

    await this.createLog(
      'INFO',
      'sms-auth',
      `Phone verified: ${this.maskPhone(phone)}`,
    );

    return {
      verified: true,
      token,
      expiresAt: updated.expiresAt.toISOString(),
    };
  }

  async mockPayment(bookingId: string) {
    if ((process.env.PAYMENT_MODE ?? 'MOCK') !== 'MOCK') {
      throw new BadRequestException(
        'Mock payments are disabled outside PAYMENT_MODE=MOCK',
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { locker: true, user: true, accessCodes: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} was not found`);
    }

    if (booking.status !== BookingStatus.ACTIVE) {
      throw new BadRequestException(`Booking ${bookingId} is not active`);
    }

    const tariff = await this.getBestTariff(
      booking.locker.size,
      booking.durationMinutes,
    );
    const amount =
      tariff?.price ?? this.calculateAmount(booking.durationMinutes);
    const hardware = await this.hardware.openLocker(booking.locker.number);

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          userId: booking.userId,
          amount,
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
        },
      });

      const session = await tx.session.create({
        data: {
          lockerId: booking.lockerId,
          startTime: booking.startTime,
          endTime: booking.expiresAt,
          status: SessionStatus.ACTIVE,
          accessPin: booking.accessCodes[0]?.pinCode,
          accessQr: booking.accessCodes[0]?.qrCode,
        },
      });

      const locker = await tx.locker.update({
        where: { id: booking.lockerId },
        data: {
          status: LockerStatus.OCCUPIED,
          isOpen: true,
        },
      });

      return { payment, session, locker };
    });

    const pinCode = booking.accessCodes[0]?.pinCode ?? '';
    const sms = pinCode
      ? await this.queueAccessSms(
          booking.phone,
          `Tashkent City Mall locker ${booking.locker.number} PIN: ${pinCode}`,
        )
      : null;

    await this.createLog(
      'INFO',
      'payment',
      `Mock payment approved for booking ${booking.id}; SMS ${sms?.state ?? 'SKIPPED'}`,
      booking.lockerId,
    );
    await this.integrations
      .syncGoogleSheetsPayment(result.payment.id)
      .catch((error: unknown) =>
        this.createLog(
          'WARN',
          'google-sheets',
          `Google Sheets payment sync skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
          booking.lockerId,
        ),
      );
    this.gateway.emitBookingUpdated({ booking, payment: result.payment });
    this.gateway.emitLockersUpdated(await this.findAll());

    return {
      data: result.locker,
      session: result.session,
      payment: {
        id: result.payment.id,
        amount: result.payment.amount,
        currency: result.payment.currency,
        provider: result.payment.provider,
        status: result.payment.status,
        paidAt:
          result.payment.paidAt?.toISOString() ?? new Date().toISOString(),
      },
      access: {
        pinCode,
        qrCode: booking.accessCodes[0]?.qrCode ?? '',
      },
      sms,
      hardware,
    };
  }

  async activateDemoPayment(lockerId: number, durationMinutes: number) {
    const locker = await this.findByNumber(lockerId);
    const phone = '+998900000000';
    const smsAuth = await this.requestSmsAuth(phone);
    if (!smsAuth.devCode) {
      throw new BadRequestException(
        'Demo payment requires local SMS mock mode',
      );
    }
    const verified = await this.verifySmsAuth(phone, smsAuth.devCode);
    const booking = await this.createBooking({
      lockerId,
      lockerSize: locker.size,
      durationMinutes,
      phone,
      customerName: 'Walk-in customer',
      termsAccepted: true,
      smsVerificationToken: verified.token,
    });

    return this.mockPayment(booking.booking.id);
  }

  async verifyAccess(lockerId: number, credential: string) {
    await this.expireOverdueBookings();
    const locker = await this.findByNumber(lockerId);
    const recentFailures = await this.prisma.accessLog.count({
      where: {
        lockerId: locker.id,
        success: false,
        createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
      },
    });

    if (recentFailures >= 8) {
      await this.createLog(
        'WARN',
        'access',
        `Locker ${lockerId} access temporarily locked after repeated failures`,
        locker.id,
      );
      throw new BadRequestException(
        'Access temporarily locked, contact an operator',
      );
    }

    const accessCode = await this.prisma.accessCode.findFirst({
      where: {
        lockerId: locker.id,
        OR: [{ pinCode: credential }, { qrCode: credential }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const lockerCredentialMatches =
      credential === locker.pinCode || credential === locker.qrCode;
    const lockerAccessIsFresh =
      !locker.bookingExpiresAt ||
      locker.bookingExpiresAt.getTime() > now.getTime();
    const lockerAccessFallback = Boolean(
      !accessCode &&
      lockerCredentialMatches &&
      lockerAccessIsFresh &&
      (locker.status === LockerStatus.RESERVED ||
        locker.status === LockerStatus.OCCUPIED),
    );
    const accessCodeValid = Boolean(
      accessCode &&
      !accessCode.usedAt &&
      accessCode.expiresAt.getTime() > now.getTime() &&
      (locker.status === LockerStatus.RESERVED ||
        locker.status === LockerStatus.OCCUPIED),
    );
    const valid = accessCodeValid || lockerAccessFallback;
    const method = /^\d{4}$/.test(credential)
      ? AccessMethod.PIN
      : AccessMethod.QR;
    const message = valid
      ? 'Access granted'
      : accessCode || lockerCredentialMatches
        ? 'Access code expired or already used'
        : 'Invalid access credential';

    await this.prisma.accessLog.create({
      data: {
        lockerId: locker.id,
        accessCodeId: accessCode?.id,
        method,
        success: valid,
        message,
      },
    });

    let updatedLocker = locker;

    if (valid) {
      await this.hardware.openLocker(locker.number);
      updatedLocker = await this.prisma.$transaction(async (tx) => {
        if (accessCode) {
          await tx.accessCode.update({
            where: { id: accessCode.id },
            data: { usedAt: now },
          });
        }

        await tx.booking.updateMany({
          where: {
            ...(accessCode?.bookingId
              ? { id: accessCode.bookingId }
              : { lockerId: locker.id }),
            status: BookingStatus.ACTIVE,
          },
          data: { status: BookingStatus.COMPLETED, completedAt: now },
        });

        await tx.session.updateMany({
          where: { lockerId: locker.id, status: SessionStatus.ACTIVE },
          data: { status: SessionStatus.COMPLETED, endTime: now },
        });

        return tx.locker.update({
          where: { id: locker.id },
          data: {
            status: LockerStatus.AVAILABLE,
            isOpen: false,
            pinCode: null,
            qrCode: null,
            customerName: null,
            bookingStartAt: null,
            bookingExpiresAt: null,
          },
        });
      });
    }

    await this.createLog(valid ? 'INFO' : 'WARN', 'access', message, locker.id);

    if (valid) {
      this.gateway.emitLockersUpdated(await this.findAll());
      this.gateway.emitBookingUpdated({
        locker: updatedLocker,
        source: 'access',
      });
    }

    return { valid, reason: message, data: updatedLocker };
  }

  async adminStatistics() {
    await this.expireOverdueBookings();

    const [lockers, bookings, payments, logs, tariffs, admins, accessLogs] =
      await Promise.all([
        this.prisma.locker.findMany({ orderBy: { number: 'asc' } }),
        this.prisma.booking.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { locker: true, payments: true, accessCodes: true },
        }),
        this.prisma.payment.findMany({
          where: { status: PaymentStatus.SUCCESS },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.prisma.log.findMany({ orderBy: { createdAt: 'desc' }, take: 80 }),
        this.prisma.tariff.findMany({
          orderBy: [{ createdAt: 'desc' }],
        }),
        this.prisma.admin.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.accessLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { locker: true },
        }),
      ]);

    return {
      summary: await this.buildSummary(lockers),
      lockers,
      bookings,
      payments,
      logs,
      accessLogs,
      tariffs,
      admins,
      notifications: this.buildAdminNotifications(lockers, bookings, logs),
      revenueSeries: this.buildRevenueSeries(payments),
      report: this.buildAdminReport(lockers, bookings, payments, accessLogs),
    };
  }

  async findAdminBookings(query: {
    status?: BookingStatus;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.BookingWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const search = query.search?.trim();
    if (search) {
      const lockerNumber = Number(search.replace(/\D/g, ''));
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        ...(Number.isFinite(lockerNumber) && lockerNumber > 0
          ? [{ locker: { number: lockerNumber } }]
          : []),
      ];
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { locker: true, payments: true, accessCodes: true },
    });
  }

  async completeBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { locker: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} was not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.COMPLETED, completedAt: new Date() },
        include: { locker: true, payments: true, accessCodes: true },
      });

      await tx.session.updateMany({
        where: { lockerId: booking.lockerId, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.COMPLETED, endTime: new Date() },
      });

      await tx.locker.update({
        where: { id: booking.lockerId },
        data: {
          status: LockerStatus.AVAILABLE,
          isOpen: false,
          pinCode: null,
          qrCode: null,
          customerName: null,
          bookingStartAt: null,
          bookingExpiresAt: null,
        },
      });

      return updatedBooking;
    });

    await this.createLog(
      'INFO',
      'admin',
      `Booking ${id} completed by admin`,
      booking.lockerId,
    );
    this.gateway.emitBookingUpdated(result);
    this.gateway.emitLockersUpdated(await this.findAll());

    return result;
  }

  async cancelBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { locker: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} was not found`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED, completedAt: new Date() },
        include: { locker: true, payments: true, accessCodes: true },
      });

      await tx.session.updateMany({
        where: { lockerId: booking.lockerId, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.COMPLETED, endTime: new Date() },
      });

      await tx.locker.update({
        where: { id: booking.lockerId },
        data: {
          status: LockerStatus.AVAILABLE,
          isOpen: false,
          pinCode: null,
          qrCode: null,
          customerName: null,
          bookingStartAt: null,
          bookingExpiresAt: null,
        },
      });

      return updatedBooking;
    });

    await this.createLog(
      'WARN',
      'admin',
      `Booking ${id} cancelled by admin`,
      booking.lockerId,
    );
    this.gateway.emitBookingUpdated(result);
    this.gateway.emitLockersUpdated(await this.findAll());

    return result;
  }

  async reactivateBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { locker: true, accessCodes: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} was not found`);
    }

    if (booking.status !== BookingStatus.EXPIRED) {
      throw new BadRequestException(`Booking ${id} is not expired`);
    }

    const expiresAt = new Date(Date.now() + 60 * 60_000);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.ACTIVE,
          completedAt: null,
          durationMinutes: booking.durationMinutes + 60,
          expiresAt,
        },
        include: { locker: true, payments: true, accessCodes: true },
      });

      await tx.accessCode.updateMany({
        where: { bookingId: id, usedAt: null },
        data: { expiresAt },
      });

      await tx.session.updateMany({
        where: { lockerId: booking.lockerId, status: SessionStatus.ACTIVE },
        data: { endTime: expiresAt },
      });

      const activeSession = await tx.session.findFirst({
        where: { lockerId: booking.lockerId, status: SessionStatus.ACTIVE },
      });

      if (!activeSession) {
        await tx.session.create({
          data: {
            lockerId: booking.lockerId,
            startTime: new Date(),
            endTime: expiresAt,
            status: SessionStatus.ACTIVE,
            accessPin: booking.locker.pinCode,
            accessQr: booking.locker.qrCode,
          },
        });
      }

      await tx.locker.update({
        where: { id: booking.lockerId },
        data: {
          status: LockerStatus.OCCUPIED,
          isOpen: false,
          bookingExpiresAt: expiresAt,
        },
      });

      return updatedBooking;
    });

    await this.createLog(
      'INFO',
      'admin',
      `Booking ${id} reactivated by admin`,
      booking.lockerId,
    );
    this.gateway.emitBookingUpdated(result);
    this.gateway.emitLockersUpdated(await this.findAll());

    return result;
  }

  async extendBooking(id: string, durationMinutes: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { locker: true, accessCodes: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} was not found`);
    }

    if (
      booking.status !== BookingStatus.ACTIVE &&
      booking.status !== BookingStatus.EXPIRED
    ) {
      throw new BadRequestException(`Booking ${id} cannot be extended`);
    }

    const expiresAt = new Date(
      Math.max(Date.now(), booking.expiresAt.getTime()) +
        durationMinutes * 60_000,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.ACTIVE,
          completedAt: null,
          durationMinutes: booking.durationMinutes + durationMinutes,
          expiresAt,
        },
        include: { locker: true, payments: true, accessCodes: true },
      });

      await tx.accessCode.updateMany({
        where: { bookingId: id, usedAt: null },
        data: { expiresAt },
      });

      await tx.session.updateMany({
        where: { lockerId: booking.lockerId, status: SessionStatus.ACTIVE },
        data: { endTime: expiresAt },
      });

      const activeSession = await tx.session.findFirst({
        where: { lockerId: booking.lockerId, status: SessionStatus.ACTIVE },
      });

      if (!activeSession) {
        await tx.session.create({
          data: {
            lockerId: booking.lockerId,
            startTime: new Date(),
            endTime: expiresAt,
            status: SessionStatus.ACTIVE,
            accessPin:
              booking.accessCodes[0]?.pinCode ?? booking.locker.pinCode,
            accessQr: booking.accessCodes[0]?.qrCode ?? booking.locker.qrCode,
          },
        });
      }

      await tx.locker.update({
        where: { id: booking.lockerId },
        data: { bookingExpiresAt: expiresAt, status: LockerStatus.OCCUPIED },
      });

      return updatedBooking;
    });

    await this.createLog(
      'INFO',
      'admin',
      `Booking ${id} extended by ${durationMinutes} minutes`,
      booking.lockerId,
    );
    this.gateway.emitBookingUpdated(result);
    this.gateway.emitLockersUpdated(await this.findAll());

    return result;
  }

  async createTariff(data: {
    name: string;
    lockerSize: LockerSize;
    durationMinutes: number;
    price: number;
    currency?: string;
    isActive?: boolean;
  }) {
    const tariff = await this.prisma.tariff.create({ data });
    await this.createLog('INFO', 'admin', `Tariff ${tariff.name} created`);
    this.gateway.emitBookingUpdated({ source: 'tariff', tariff });
    await this.syncTariffsToGoogleSheets('created');
    return tariff;
  }

  async updateTariff(
    id: string,
    data: {
      name: string;
      lockerSize: LockerSize;
      durationMinutes: number;
      price: number;
      currency?: string;
      isActive?: boolean;
    },
  ) {
    const tariff = await this.prisma.tariff.update({
      where: { id },
      data,
    });
    await this.createLog('INFO', 'admin', `Tariff ${tariff.name} updated`);
    this.gateway.emitBookingUpdated({ source: 'tariff', tariff });
    await this.syncTariffsToGoogleSheets('updated');
    return tariff;
  }

  async deleteTariff(id: string) {
    const tariff = await this.prisma.tariff.delete({ where: { id } });
    await this.createLog('WARN', 'admin', `Tariff ${tariff.name} deleted`);
    this.gateway.emitBookingUpdated({ source: 'tariff', tariff });
    await this.syncTariffsToGoogleSheets('deleted');
    return tariff;
  }

  private async syncTariffsToGoogleSheets(action: string) {
    try {
      const result =
        await this.integrations.syncGoogleSheetsTariffsFromDatabase();
      if ('skipped' in result && result.skipped) {
        return;
      }

      await this.createLog(
        'INFO',
        'google-sheets',
        `Tariffs ${action}; Google Sheets tariff export synced`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      await this.createLog(
        'WARN',
        'google-sheets',
        `Tariffs ${action}; Google Sheets tariff export failed: ${reason}`,
      );
    }
  }

  async revokeAccessCode(id: string) {
    const accessCode = await this.prisma.accessCode.findUnique({
      where: { id },
      include: { locker: true },
    });

    if (!accessCode) {
      throw new NotFoundException(`Access code ${id} was not found`);
    }

    const updated = await this.prisma.accessCode.update({
      where: { id },
      data: { usedAt: new Date() },
      include: { locker: true },
    });

    await this.createLog(
      'WARN',
      'admin',
      `Access code revoked for locker ${accessCode.locker.number}`,
      accessCode.lockerId,
    );

    return updated;
  }

  async regenerateAccessCode(id: string) {
    const accessCode = await this.prisma.accessCode.findUnique({
      where: { id },
      include: { locker: true, booking: true },
    });

    if (!accessCode) {
      throw new NotFoundException(`Access code ${id} was not found`);
    }

    const pinCode = this.generatePin();
    const qrCode = this.buildQrPayload(
      accessCode.locker.number,
      pinCode,
      accessCode.expiresAt,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.accessCode.update({
        where: { id },
        data: { pinCode, qrCode, usedAt: null },
        include: { locker: true, booking: true },
      });

      await tx.locker.update({
        where: { id: accessCode.lockerId },
        data: { pinCode, qrCode },
      });

      return next;
    });

    await this.createLog(
      'INFO',
      'admin',
      `Access code regenerated for locker ${accessCode.locker.number}`,
      accessCode.lockerId,
    );
    this.gateway.emitLockersUpdated(await this.findAll());

    return updated;
  }

  async buildReport(query: { from?: string; to?: string }) {
    const where: Prisma.PaymentWhereInput = { status: PaymentStatus.SUCCESS };
    const bookingWhere: Prisma.BookingWhereInput = {};

    if (query.from || query.to) {
      const range = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
      where.createdAt = range;
      bookingWhere.createdAt = range;
    }

    const [lockers, bookings, payments, accessLogs] = await Promise.all([
      this.prisma.locker.findMany({ orderBy: { number: 'asc' } }),
      this.prisma.booking.findMany({
        where: bookingWhere,
        orderBy: { createdAt: 'desc' },
        include: { locker: true, payments: true, accessCodes: true },
      }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { booking: { include: { locker: true } } },
      }),
      this.prisma.accessLog.findMany({
        where:
          query.from || query.to
            ? {
                createdAt: {
                  gte: query.from ? new Date(query.from) : undefined,
                  lte: query.to ? new Date(query.to) : undefined,
                },
              }
            : undefined,
        include: { locker: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: query.from ?? null,
        to: query.to ?? null,
      },
      summary: this.buildAdminReport(lockers, bookings, payments, accessLogs),
      revenueSeries: this.buildRevenueSeries(payments),
      bookings,
      payments,
      accessLogs,
    };
  }

  async resetDemo() {
    await this.prisma.$transaction(async (tx) => {
      await tx.accessLog.deleteMany();
      await tx.accessCode.deleteMany();
      await tx.payment.deleteMany();
      await tx.booking.deleteMany();
      await tx.session.deleteMany();
      await tx.log.deleteMany();

      const lockers = await tx.locker.findMany({
        select: { id: true, number: true },
      });

      await Promise.all(
        lockers.map((locker) => {
          const status = this.getDemoStatus(locker.number);
          const active = status !== LockerStatus.AVAILABLE;
          const startAt = active
            ? new Date(Date.now() - locker.number * 60_000)
            : null;
          const expiresAt = active ? new Date(Date.now() + 120 * 60_000) : null;

          return tx.locker.update({
            where: { id: locker.id },
            data: {
              status,
              size: this.getDemoSize(locker.number),
              isOpen: false,
              isOnline: true,
              pinCode: active ? this.generateSeedPin(locker.number) : null,
              qrCode: active ? this.buildSeedQr(locker.number) : null,
              customerName: active ? `Demo customer ${locker.number}` : null,
              bookingStartAt: startAt,
              bookingExpiresAt: expiresAt,
            },
          });
        }),
      );
    });

    await this.createLog('INFO', 'admin', 'Demo state reset');
    const response = await this.findAll();
    this.gateway.emitLockersUpdated(response);

    return response;
  }

  private async findByNumber(lockerId: number) {
    const locker = await this.prisma.locker.findUnique({
      where: { number: lockerId },
    });

    if (!locker) {
      throw new NotFoundException(`Locker ${lockerId} was not found`);
    }

    return locker;
  }

  private async buildSummary(lockers: Locker[], activeBookings?: number) {
    const total = lockers.length;
    const available = lockers.filter(
      (locker) => locker.status === LockerStatus.AVAILABLE,
    ).length;
    const occupied = lockers.filter(
      (locker) => locker.status === LockerStatus.OCCUPIED,
    ).length;
    const reserved = lockers.filter(
      (locker) => locker.status === LockerStatus.RESERVED,
    ).length;
    const expired = lockers.filter(
      (locker) => locker.status === LockerStatus.EXPIRED,
    ).length;
    const maintenance = lockers.filter(
      (locker) => locker.status === LockerStatus.MAINTENANCE,
    ).length;
    const open = lockers.filter((locker) => locker.isOpen).length;
    const active = occupied + reserved;
    const [resolvedActiveBookings, revenue] = await Promise.all([
      activeBookings ??
        this.prisma.booking.count({ where: { status: BookingStatus.ACTIVE } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS },
        _sum: { amount: true },
      }),
    ]);

    return {
      total,
      available,
      free: available,
      occupied,
      reserved,
      expired,
      maintenance,
      open,
      active,
      activeSessions: resolvedActiveBookings,
      demoRevenue: revenue._sum.amount ?? 0,
      occupiedPercentage: total === 0 ? 0 : Math.round((active / total) * 100),
    };
  }

  private async expireOverdueBookings() {
    const now = new Date();
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      select: { id: true, lockerId: true },
    });

    if (expiredBookings.length === 0) {
      return;
    }

    const lockerIds = expiredBookings.map((booking) => booking.lockerId);

    await this.prisma.$transaction([
      this.prisma.booking.updateMany({
        where: { id: { in: expiredBookings.map((booking) => booking.id) } },
        data: { status: BookingStatus.EXPIRED },
      }),
      this.prisma.locker.updateMany({
        where: {
          id: { in: lockerIds },
          status: { not: LockerStatus.MAINTENANCE },
        },
        data: { status: LockerStatus.EXPIRED, isOpen: false },
      }),
    ]);

    this.gateway.emitLockersUpdated(await this.findAll());
  }

  private async getBestTariff(size: LockerSize, durationMinutes: number) {
    return this.prisma.tariff.findFirst({
      where: {
        lockerSize: size,
        durationMinutes,
        isActive: true,
      },
    });
  }

  private calculateAmount(durationMinutes: number) {
    return Math.ceil(durationMinutes / 60) * 15000;
  }

  private getDemoStatus(number: number) {
    if (number % 11 === 0) {
      return LockerStatus.RESERVED;
    }

    if (number % 4 === 0 || number % 7 === 0) {
      return LockerStatus.OCCUPIED;
    }

    return LockerStatus.AVAILABLE;
  }

  private getDemoSize(number: number) {
    if (number % 10 === 0 || number % 10 === 9) {
      return LockerSize.LARGE;
    }

    if (number % 3 === 0) {
      return LockerSize.SMALL;
    }

    return LockerSize.MEDIUM;
  }

  private generateSeedPin(lockerNumber: number) {
    return String(100000 + ((lockerNumber * 137) % 900000));
  }

  private buildSeedQr(lockerNumber: number) {
    return `CITY-MALL-DEMO-${lockerNumber}`;
  }

  private generatePin() {
    return String(randomInt(100000, 1000000));
  }

  private async assertSmsVerified(phone: string, token?: string) {
    if (!token) {
      throw new BadRequestException('Phone number must be verified by SMS');
    }

    const verification = await this.prisma.smsVerification.findFirst({
      where: {
        phone,
        token,
        verifiedAt: { not: null },
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new BadRequestException('SMS verification is missing or expired');
    }
  }

  private hashSmsCode(phone: string, code: string) {
    return createHash('sha256')
      .update(
        `${this.normalizePhone(phone)}:${code}:${process.env.ADMIN_SESSION_SECRET ?? 'dev-secret'}`,
      )
      .digest('hex');
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '').replace(/^0+/, '');
  }

  private maskPhone(phone: string) {
    const normalized = this.normalizePhone(phone);
    if (normalized.length <= 6) {
      return normalized;
    }

    return `${normalized.slice(0, 5)}***${normalized.slice(-3)}`;
  }

  private shouldExposeMockSmsCode(state?: string) {
    return process.env.NODE_ENV !== 'production' || state === 'MOCK';
  }

  private buildSmsAuthCode() {
    const template = process.env.SMS_AUTH_MESSAGE;
    if (template && !template.includes('{code}') && this.isSmsAuthTestMode()) {
      return template;
    }

    return String(randomInt(0, 10_000)).padStart(4, '0');
  }

  private buildSmsAuthMessage(code: string) {
    const template = process.env.SMS_AUTH_MESSAGE;
    if (!template) {
      return `Tashkent City Mall tasdiqlash kodi: ${code}`;
    }

    return template.replaceAll('{code}', code);
  }

  private normalizeSmsCode(code: string) {
    return code.trim();
  }

  private getAcceptedSmsAuthCodeHashes(phone: string, storedCodeHash: string) {
    const hashes = [storedCodeHash];

    if (this.isSmsAuthTestMode()) {
      hashes.push(
        ...this.getEskizTestMessages().map((acceptedCode) =>
          this.hashSmsCode(phone, acceptedCode),
        ),
      );
    }

    return hashes;
  }

  private isSmsAuthTestMode() {
    const template = process.env.SMS_AUTH_MESSAGE;
    return (
      process.env.NODE_ENV !== 'production' &&
      typeof template === 'string' &&
      !template.includes('{code}') &&
      this.getEskizTestMessages().includes(template)
    );
  }

  private getEskizTestMessages() {
    return [
      'Bu Eskiz dan test',
      '\u042d\u0442\u043e \u0442\u0435\u0441\u0442 \u043e\u0442 Eskiz',
      'This is test from Eskiz',
    ];
  }

  private buildQrPayload(
    lockerNumber: number,
    pinCode: string,
    expiresAt: Date,
  ) {
    const token = randomBytes(24).toString('base64url');
    return `CITY-MALL-ACCESS:${lockerNumber}:${token}:${expiresAt.getTime()}`;
  }

  private buildRevenueSeries(
    payments: Array<{ amount: number; createdAt: Date }>,
  ) {
    const buckets = new Map<string, number>();

    payments.forEach((payment) => {
      const label = payment.createdAt.toISOString().slice(0, 10);
      buckets.set(label, (buckets.get(label) ?? 0) + payment.amount);
    });

    return Array.from(buckets.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private buildAdminReport(
    lockers: Locker[],
    bookings: Array<{
      status: BookingStatus;
      durationMinutes: number;
      createdAt: Date;
    }>,
    payments: Array<{ amount: number; status: PaymentStatus; createdAt: Date }>,
    accessLogs: Array<{ success: boolean }>,
  ) {
    const successfulPayments = payments.filter(
      (payment) => payment.status === PaymentStatus.SUCCESS,
    );
    const revenue = successfulPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const completed = bookings.filter(
      (booking) => booking.status === BookingStatus.COMPLETED,
    ).length;
    const active = bookings.filter(
      (booking) => booking.status === BookingStatus.ACTIVE,
    ).length;

    return {
      revenue,
      payments: successfulPayments.length,
      bookings: bookings.length,
      activeBookings: active,
      completedBookings: completed,
      expiredBookings: bookings.filter(
        (booking) => booking.status === BookingStatus.EXPIRED,
      ).length,
      cancelledBookings: bookings.filter(
        (booking) => booking.status === BookingStatus.CANCELLED,
      ).length,
      averageDurationMinutes:
        bookings.length === 0
          ? 0
          : Math.round(
              bookings.reduce(
                (sum, booking) => sum + booking.durationMinutes,
                0,
              ) / bookings.length,
            ),
      accessSuccessRate:
        accessLogs.length === 0
          ? 100
          : Math.round(
              (accessLogs.filter((log) => log.success).length /
                accessLogs.length) *
                100,
            ),
      utilizationRate:
        lockers.length === 0
          ? 0
          : Math.round(
              (lockers.filter(
                (locker) =>
                  locker.status === LockerStatus.RESERVED ||
                  locker.status === LockerStatus.OCCUPIED,
              ).length /
                lockers.length) *
                100,
            ),
    };
  }

  private buildAdminNotifications(
    lockers: Locker[],
    bookings: Array<{
      id: string;
      status: BookingStatus;
      expiresAt: Date;
      locker?: Locker | null;
    }>,
    logs: Array<{
      level: string;
      source: string;
      message: string;
      createdAt: Date;
    }>,
  ) {
    const now = Date.now();
    const notifications = [
      ...lockers
        .filter(
          (locker) =>
            !locker.isOnline || locker.status === LockerStatus.MAINTENANCE,
        )
        .map((locker) => ({
          id: `locker-${locker.id}`,
          severity: locker.isOnline ? 'WARN' : 'ERROR',
          title: locker.isOnline ? 'Maintenance mode' : 'Hardware offline',
          message: `Locker ${locker.number} requires staff attention`,
          createdAt: locker.updatedAt.toISOString(),
        })),
      ...bookings
        .filter(
          (booking) =>
            booking.status === BookingStatus.ACTIVE &&
            booking.expiresAt.getTime() - now <= 15 * 60_000,
        )
        .map((booking) => ({
          id: `booking-${booking.id}`,
          severity: 'WARN',
          title: 'Booking ending soon',
          message: `Locker ${booking.locker?.number ?? '-'} expires within 15 minutes`,
          createdAt: new Date().toISOString(),
        })),
      ...logs
        .filter((log) => log.level === 'ERROR')
        .slice(0, 4)
        .map((log, index) => ({
          id: `log-${index}-${log.createdAt.getTime()}`,
          severity: 'ERROR',
          title: log.source,
          message: log.message,
          createdAt: log.createdAt.toISOString(),
        })),
    ];

    return notifications.slice(0, 12);
  }

  private async createLog(
    level: 'INFO' | 'WARN' | 'ERROR',
    source: string,
    message: string,
    lockerId?: string,
  ) {
    await this.prisma.log.create({
      data: { level, source, message, lockerId },
    });
  }

  private async queueAccessSms(phone: string, message: string) {
    try {
      return await this.integrations.sendSms(phone, message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'SMS failed';
      await this.createLog('WARN', 'sms', `SMS delivery failed: ${reason}`);

      return {
        queued: false,
        provider: process.env.SMS_PROVIDER ?? 'ESKIZ',
        state: 'DISABLED' as const,
        phone,
        preview: message,
        error: reason,
      };
    }
  }

  private async runWithLockerQueue<T>(
    lockerId: number,
    action: () => Promise<T>,
  ) {
    const previous = this.commandQueues.get(lockerId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(action);
    const queued = run.then(
      () => undefined,
      () => undefined,
    );

    this.commandQueues.set(lockerId, queued);

    try {
      return await run;
    } finally {
      if (this.commandQueues.get(lockerId) === queued) {
        this.commandQueues.delete(lockerId);
      }
    }
  }
}
