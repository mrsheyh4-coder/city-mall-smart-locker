import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { HardwareService } from '../hardware/hardware.service';
import { OneCTariffDto } from './dto/integration.dto';

type IntegrationState = 'READY' | 'MOCK' | 'DISABLED';

type EskizLoginResponse = {
  data?: {
    token?: string;
  };
  token_type?: string;
};

type EskizSendResponse = {
  id?: string;
  message?: string;
  status?: string;
};

@Injectable()
export class IntegrationsService {
  private eskizToken?: {
    value: string;
    expiresAt: number;
  };

  constructor(
    private readonly hardware: HardwareService,
    private readonly prisma: PrismaService,
  ) {}

  async getStatus() {
    const hardwareHealth = await this.hardware.getHealth();

    return {
      payment: {
        mode: process.env.PAYMENT_MODE ?? 'MOCK',
        payme: this.hasAll('PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY')
          ? 'READY'
          : 'DISABLED',
        click: this.hasAll(
          'CLICK_SERVICE_ID',
          'CLICK_MERCHANT_ID',
          'CLICK_SECRET_KEY',
        )
          ? 'READY'
          : 'DISABLED',
      },
      hardware: {
        mode: this.hardware.getMode(),
        health: hardwareHealth,
      },
      sms: {
        mode: process.env.SMS_MODE ?? 'MOCK',
        delivery: this.isRealSmsDeliveryEnabled() ? 'REAL' : 'LOCAL_MOCK',
        eskiz: this.hasAll('ESKIZ_EMAIL', 'ESKIZ_PASSWORD')
          ? 'READY'
          : 'DISABLED',
      },
      oneC: {
        mode: process.env.ONE_C_MODE ?? 'FILE',
        state: this.hasAll('ONE_C_BASE_URL', 'ONE_C_API_TOKEN')
          ? 'READY'
          : 'MOCK',
        formats: ['JSON', 'XML'],
      },
      cctv: {
        mode: process.env.CCTV_MODE ?? 'MANUAL',
        state: this.hasAll('CCTV_BASE_URL', 'CCTV_API_TOKEN')
          ? 'READY'
          : 'MOCK',
      },
      server: {
        nodeEnv: process.env.NODE_ENV ?? 'development',
        frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
        port: process.env.PORT ?? '4000',
      },
    };
  }

  async handlePaymentWebhook(
    provider: 'PAYME' | 'CLICK',
    payload: Record<string, unknown>,
    signature?: string,
  ) {
    this.verifyPaymentSignature(provider, payload, signature);

    await this.createIntegrationLog(
      'payment',
      `${provider} webhook received (${signature ? 'signed' : 'unsigned'})`,
    );

    return {
      accepted: true,
      provider,
      mode: process.env.PAYMENT_MODE ?? 'MOCK',
      payloadKeys: Object.keys(payload),
      nextStep:
        'Map provider transaction id to internal payment.id after real credentials are issued.',
    };
  }

  async sendSms(phone: string, message: string) {
    const state: IntegrationState =
      this.isRealSmsDeliveryEnabled() &&
      this.hasAll('ESKIZ_EMAIL', 'ESKIZ_PASSWORD')
        ? 'READY'
        : (process.env.SMS_MODE ?? 'MOCK') === 'MOCK'
          ? 'MOCK'
          : 'DISABLED';

    if (state === 'READY') {
      const result = await this.sendEskizSms(phone, message);
      await this.createIntegrationLog(
        'sms',
        `SMS sent through Eskiz to ${this.maskPhone(phone)} (${result.status ?? result.message ?? 'accepted'})`,
      );

      return {
        queued: true,
        provider: 'ESKIZ',
        state,
        phone: this.maskPhone(phone),
        messageId: result.id ?? null,
        providerStatus: result.status ?? result.message ?? null,
      };
    }

    await this.createIntegrationLog(
      'sms',
      `SMS ${state} queued for ${this.maskPhone(phone)}`,
    );

    return {
      queued: true,
      provider: process.env.SMS_PROVIDER ?? 'ESKIZ',
      state,
      phone: this.maskPhone(phone),
      preview: message,
    };
  }

  async exportOneCReport(from?: string, to?: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        booking: {
          include: { locker: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const payload = {
      generatedAt: new Date().toISOString(),
      source: 'CITY_MALL_SMART_LOCKER',
      mode: process.env.ONE_C_MODE ?? 'FILE',
      totals: {
        payments: payments.length,
        revenue: payments.reduce((sum, payment) => sum + payment.amount, 0),
      },
      payments: payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt?.toISOString() ?? null,
        lockerNumber: payment.booking?.locker?.number ?? null,
        bookingId: payment.bookingId,
      })),
    };

    await this.createIntegrationLog('1c', '1C JSON export generated');
    return payload;
  }

  async importOneCTariffs(tariffs: OneCTariffDto[]) {
    const result = {
      imported: 0,
      updated: 0,
      created: 0,
      skipped: 0,
    };

    for (const tariff of tariffs) {
      const existing = await this.prisma.tariff.findFirst({
        where: {
          lockerSize: tariff.lockerSize,
          durationMinutes: tariff.durationMinutes,
          currency: tariff.currency ?? 'UZS',
        },
      });

      if (existing) {
        await this.prisma.tariff.update({
          where: { id: existing.id },
          data: tariff,
        });
        result.updated += 1;
      } else {
        await this.prisma.tariff.create({ data: tariff });
        result.created += 1;
      }

      result.imported += 1;
    }

    await this.createIntegrationLog(
      '1c',
      `1C tariff import completed: ${result.imported} imported`,
    );

    return {
      ...result,
      mode: process.env.ONE_C_MODE ?? 'FILE',
      acceptedFormats: ['JSON', 'XML'],
    };
  }

  async registerCctvEvent(lockerId: string, event: string, cameraId?: string) {
    await this.createIntegrationLog(
      'cctv',
      `CCTV event ${event} registered for locker ${lockerId}`,
    );

    return {
      registered: true,
      lockerId,
      event,
      cameraId: cameraId ?? process.env.CCTV_DEFAULT_CAMERA_ID ?? null,
      state: this.hasAll('CCTV_BASE_URL', 'CCTV_API_TOKEN') ? 'READY' : 'MOCK',
      archive: {
        retentionDays: Number(process.env.CCTV_RETENTION_DAYS ?? 30),
        reference:
          process.env.CCTV_BASE_URL && cameraId
            ? `${process.env.CCTV_BASE_URL}/archive/${cameraId}`
            : null,
      },
    };
  }

  private hasAll(...keys: string[]) {
    return keys.every((key) => Boolean(process.env[key]));
  }

  private isRealSmsDeliveryEnabled() {
    if ((process.env.SMS_MODE ?? 'MOCK') !== 'ESKIZ') {
      return false;
    }

    return (
      process.env.NODE_ENV === 'production' ||
      process.env.SMS_ALLOW_LOCAL_SEND === 'true'
    );
  }

  private async sendEskizSms(phone: string, message: string) {
    const token = await this.getEskizToken();
    const form = new FormData();
    form.set('mobile_phone', this.normalizePhone(phone));
    form.set('message', message);
    form.set('from', process.env.ESKIZ_SENDER ?? '4546');

    const response = await fetch(
      'https://notify.eskiz.uz/api/message/sms/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      },
    );

    const body = (await response.json().catch(() => ({}))) as EskizSendResponse;

    if (!response.ok) {
      throw new UnauthorizedException(
        body.message ?? `Eskiz SMS failed with ${response.status}`,
      );
    }

    return body;
  }

  private async getEskizToken() {
    if (this.eskizToken && this.eskizToken.expiresAt > Date.now()) {
      return this.eskizToken.value;
    }

    const form = new FormData();
    form.set('email', process.env.ESKIZ_EMAIL ?? '');
    form.set('password', process.env.ESKIZ_PASSWORD ?? '');

    const response = await fetch('https://notify.eskiz.uz/api/auth/login', {
      method: 'POST',
      body: form,
    });

    const body = (await response
      .json()
      .catch(() => ({}))) as EskizLoginResponse;
    const token = body.data?.token;

    if (!response.ok || !token) {
      throw new UnauthorizedException('Eskiz authentication failed');
    }

    this.eskizToken = {
      value: token,
      expiresAt: Date.now() + 29 * 24 * 60 * 60 * 1000,
    };

    return token;
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

  private verifyPaymentSignature(
    provider: 'PAYME' | 'CLICK',
    payload: Record<string, unknown>,
    signature?: string,
  ) {
    if ((process.env.PAYMENT_MODE ?? 'MOCK') === 'MOCK') {
      return;
    }

    const secret =
      provider === 'PAYME'
        ? process.env.PAYME_SECRET_KEY
        : process.env.CLICK_SECRET_KEY;

    if (!secret || !signature) {
      throw new UnauthorizedException(
        `${provider} webhook signature is required`,
      );
    }

    const expected = createHmac('sha256', secret)
      .update(this.stableStringify(payload))
      .digest('hex');

    if (!this.safeEqual(signature, expected)) {
      throw new UnauthorizedException(`${provider} webhook signature mismatch`);
    }
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(
          ([key, item]) =>
            `${JSON.stringify(key)}:${this.stableStringify(item)}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private async createIntegrationLog(source: string, message: string) {
    await this.prisma.log.create({
      data: {
        level: 'INFO',
        source,
        message,
      },
    });
  }
}
