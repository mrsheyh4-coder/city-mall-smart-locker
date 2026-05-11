import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, createSign, timingSafeEqual } from 'crypto';
import { LockerSize } from '@prisma/client';
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

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleSheetsValuesResponse = {
  values?: string[][];
};

type GoogleApiErrorResponse = {
  error?: {
    message?: string;
  };
};

@Injectable()
export class IntegrationsService {
  private eskizToken?: {
    value: string;
    expiresAt: number;
  };
  private googleAccessToken?: {
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
      googleSheets: {
        mode: process.env.GOOGLE_SHEETS_MODE ?? 'DISABLED',
        state: this.isGoogleSheetsReady() ? 'READY' : 'DISABLED',
        spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID
          ? 'CONFIGURED'
          : 'MISSING',
        paymentsSheet: process.env.GOOGLE_SHEETS_PAYMENTS_SHEET ?? 'Payments',
        tariffsSheet: process.env.GOOGLE_SHEETS_TARIFFS_SHEET ?? 'Tariffs',
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
    const smsMode = process.env.SMS_MODE ?? 'MOCK';
    const realDeliveryEnabled = this.isRealSmsDeliveryEnabled();
    const hasEskizCredentials = this.hasAll('ESKIZ_EMAIL', 'ESKIZ_PASSWORD');

    if (smsMode === 'ESKIZ' && realDeliveryEnabled && !hasEskizCredentials) {
      throw new ServiceUnavailableException(
        'Eskiz SMS is enabled but ESKIZ_EMAIL or ESKIZ_PASSWORD is missing.',
      );
    }

    const state: IntegrationState =
      realDeliveryEnabled && hasEskizCredentials
        ? 'READY'
        : smsMode === 'MOCK'
          ? 'MOCK'
          : 'DISABLED';

    if (smsMode === 'ESKIZ' && state === 'DISABLED') {
      throw new ServiceUnavailableException(
        'Eskiz SMS delivery is disabled for this environment.',
      );
    }

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

  async syncGoogleSheetsPayments(from?: string, to?: string) {
    this.assertGoogleSheetsReady();

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
          include: { locker: true, accessCodes: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = payments.map((payment) => [
      payment.createdAt.toISOString(),
      payment.bookingId ?? '',
      payment.booking?.locker?.number ?? '',
      payment.booking?.phone ?? '',
      payment.booking?.durationMinutes ?? '',
      payment.amount,
      payment.currency,
      payment.provider,
      payment.status,
      payment.paidAt?.toISOString() ?? '',
      payment.booking?.accessCodes?.[0]?.pinCode ?? '',
      'CITY_MALL_SMART_LOCKER',
    ]);

    if (rows.length > 0) {
      await this.appendGoogleSheetRows(
        process.env.GOOGLE_SHEETS_PAYMENTS_SHEET ?? 'Payments',
        rows,
      );
    }

    await this.createIntegrationLog(
      'google-sheets',
      `Google Sheets payment sync completed: ${rows.length} rows`,
    );

    return {
      synced: rows.length,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      sheet: process.env.GOOGLE_SHEETS_PAYMENTS_SHEET ?? 'Payments',
    };
  }

  async syncGoogleSheetsPayment(paymentId: string) {
    if (!this.isGoogleSheetsEnabled()) {
      return { skipped: true, reason: 'GOOGLE_SHEETS_MODE is not ENABLED' };
    }

    this.assertGoogleSheetsReady();

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { locker: true, accessCodes: true },
        },
      },
    });

    if (!payment) {
      return { skipped: true, reason: `Payment ${paymentId} was not found` };
    }

    await this.appendGoogleSheetRows(
      process.env.GOOGLE_SHEETS_PAYMENTS_SHEET ?? 'Payments',
      [
        [
          payment.createdAt.toISOString(),
          payment.bookingId ?? '',
          payment.booking?.locker?.number ?? '',
          payment.booking?.phone ?? '',
          payment.booking?.durationMinutes ?? '',
          payment.amount,
          payment.currency,
          payment.provider,
          payment.status,
          payment.paidAt?.toISOString() ?? '',
          payment.booking?.accessCodes?.[0]?.pinCode ?? '',
          'CITY_MALL_SMART_LOCKER',
        ],
      ],
    );

    await this.createIntegrationLog(
      'google-sheets',
      `Payment ${payment.id} appended to Google Sheets`,
    );

    return { synced: 1, paymentId: payment.id };
  }

  async importGoogleSheetsTariffs() {
    this.assertGoogleSheetsReady();

    const rows = await this.getGoogleSheetRows(
      process.env.GOOGLE_SHEETS_TARIFFS_SHEET ?? 'Tariffs',
    );
    const tariffs = this.parseGoogleTariffRows(rows);
    const result = await this.importOneCTariffs(tariffs);

    await this.createIntegrationLog(
      'google-sheets',
      `Google Sheets tariff import completed: ${result.imported} imported`,
    );

    return {
      ...result,
      source: 'GOOGLE_SHEETS',
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      sheet: process.env.GOOGLE_SHEETS_TARIFFS_SHEET ?? 'Tariffs',
    };
  }

  async syncGoogleSheetsTariffsFromDatabase() {
    if (!this.isGoogleSheetsEnabled()) {
      return { skipped: true, reason: 'GOOGLE_SHEETS_MODE is not ENABLED' };
    }

    this.assertGoogleSheetsReady();

    const tariffs = await this.prisma.tariff.findMany({
      orderBy: [
        { lockerSize: 'asc' },
        { durationMinutes: 'asc' },
        { price: 'asc' },
      ],
    });
    const rows = [
      ['Name', 'Size', 'Duration Minutes', 'Price', 'Currency', 'Active'],
      ...tariffs.map((tariff) => [
        tariff.name,
        tariff.lockerSize,
        tariff.durationMinutes,
        tariff.price,
        tariff.currency,
        tariff.isActive ? 'TRUE' : 'FALSE',
      ]),
    ];
    const sheet = process.env.GOOGLE_SHEETS_TARIFFS_SHEET ?? 'Tariffs';

    await this.replaceGoogleSheetRows(sheet, rows, 'A:F');
    await this.createIntegrationLog(
      'google-sheets',
      `Google Sheets tariff export completed: ${tariffs.length} tariff(s) synced`,
    );

    return {
      synced: tariffs.length,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      sheet,
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

  private isGoogleSheetsEnabled() {
    return (process.env.GOOGLE_SHEETS_MODE ?? 'DISABLED') === 'ENABLED';
  }

  private isGoogleSheetsReady() {
    return (
      this.isGoogleSheetsEnabled() &&
      this.hasAll(
        'GOOGLE_SHEETS_SPREADSHEET_ID',
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      )
    );
  }

  private assertGoogleSheetsReady() {
    if (!this.isGoogleSheetsReady()) {
      throw new UnauthorizedException(
        'Google Sheets integration is not configured. Set GOOGLE_SHEETS_MODE=ENABLED, spreadsheet id, service account email, and private key.',
      );
    }
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

  private async appendGoogleSheetRows(sheetName: string, rows: unknown[][]) {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const token = await this.getGoogleAccessToken();
    const range = encodeURIComponent(`${sheetName}!A:L`);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      },
    );

    await this.assertGoogleResponse(response, 'Google Sheets append failed');
  }

  private async replaceGoogleSheetRows(
    sheetName: string,
    rows: unknown[][],
    columns = 'A:Z',
  ) {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const token = await this.getGoogleAccessToken();
    const clearRange = encodeURIComponent(`${sheetName}!${columns}`);
    const updateRange = encodeURIComponent(`${sheetName}!A1`);

    const clearResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
    await this.assertGoogleResponse(
      clearResponse,
      'Google Sheets clear failed',
    );

    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      },
    );
    await this.assertGoogleResponse(
      updateResponse,
      'Google Sheets update failed',
    );
  }

  private async getGoogleSheetRows(sheetName: string) {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const token = await this.getGoogleAccessToken();
    const range = encodeURIComponent(`${sheetName}!A:Z`);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const body = (await this.assertGoogleResponse(
      response,
      'Google Sheets read failed',
    )) as GoogleSheetsValuesResponse;

    return body.values ?? [];
  }

  private parseGoogleTariffRows(rows: string[][]): OneCTariffDto[] {
    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0].map((header) =>
      header.trim().toLowerCase().replace(/\s+/g, ''),
    );
    const indexOf = (...names: string[]) =>
      names
        .map((name) => headers.indexOf(name))
        .find((index) => index !== -1) ?? -1;

    const nameIndex = indexOf('name', 'tariff', 'tariffname');
    const sizeIndex = indexOf('size', 'lockersize');
    const durationIndex = indexOf('durationminutes', 'duration', 'minutes');
    const priceIndex = indexOf('price', 'amount');
    const currencyIndex = indexOf('currency');
    const activeIndex = indexOf('active', 'isactive');

    const tariffs = rows.slice(1).map((row, index): OneCTariffDto | null => {
      const lockerSize = String(row[sizeIndex] ?? '').toUpperCase();
      if (!['SMALL', 'MEDIUM', 'LARGE'].includes(lockerSize)) {
        return null;
      }

      const durationMinutes = Number(row[durationIndex]);
      const price = Number(row[priceIndex]);
      if (!Number.isInteger(durationMinutes) || !Number.isInteger(price)) {
        return null;
      }

      const isActiveValue = String(row[activeIndex] ?? 'TRUE').toUpperCase();

      return {
        name:
          row[nameIndex] ??
          `Google Sheets tariff ${lockerSize} ${durationMinutes}m ${index + 1}`,
        lockerSize: lockerSize as LockerSize,
        durationMinutes,
        price,
        currency: row[currencyIndex] || 'UZS',
        isActive: !['FALSE', '0', 'NO', 'N'].includes(isActiveValue),
      };
    });

    return tariffs.filter((tariff): tariff is OneCTariffDto => Boolean(tariff));
  }

  private async getGoogleAccessToken() {
    if (
      this.googleAccessToken &&
      this.googleAccessToken.expiresAt > Date.now()
    ) {
      return this.googleAccessToken.value;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const jwtHeader = this.base64UrlEncode(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    );
    const jwtClaim = this.base64UrlEncode(
      JSON.stringify({
        iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: nowSeconds + 3600,
        iat: nowSeconds,
      }),
    );
    const unsignedJwt = `${jwtHeader}.${jwtClaim}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsignedJwt);
    signer.end();

    const signature = signer.sign(this.getGooglePrivateKey(), 'base64url');
    const assertion = `${unsignedJwt}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    const body = (await response
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;

    if (!response.ok || !body.access_token) {
      throw new UnauthorizedException(
        body.error_description ??
          body.error ??
          `Google token request failed with ${response.status}`,
      );
    }

    this.googleAccessToken = {
      value: body.access_token,
      expiresAt:
        Date.now() + Math.max((body.expires_in ?? 3600) - 60, 60) * 1000,
    };

    return body.access_token;
  }

  private getGooglePrivateKey() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '';
    return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  }

  private base64UrlEncode(value: string) {
    return Buffer.from(value).toString('base64url');
  }

  private async assertGoogleResponse(
    response: Response,
    fallback: string,
  ): Promise<unknown> {
    const body = (await response
      .json()
      .catch(() => ({}))) as GoogleApiErrorResponse;

    if (!response.ok) {
      const message =
        body.error?.message ?? `${fallback} with ${response.status}`;

      throw new UnauthorizedException(message);
    }

    return body;
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
