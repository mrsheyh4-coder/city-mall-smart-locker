import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

type AdminSessionPayload = {
  sub: 'admin';
  role: 'ADMIN';
  exp: number;
};

@Injectable()
export class AuthService {
  validateAdminPin(pin: string) {
    return pin === (process.env.ADMIN_PIN ?? '2026');
  }

  issueAdminToken() {
    const payload: AdminSessionPayload = {
      sub: 'admin',
      role: 'ADMIN',
      exp: Math.floor(Date.now() / 1000) + this.getTtlSeconds(),
    };
    const encodedPayload = this.base64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  verifyAdminToken(token: string) {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      return false;
    }

    if (!this.safeEqual(signature, this.sign(encodedPayload))) {
      return false;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as AdminSessionPayload;

      return (
        payload.sub === 'admin' &&
        payload.role === 'ADMIN' &&
        payload.exp > Math.floor(Date.now() / 1000)
      );
    } catch {
      return false;
    }
  }

  private sign(value: string) {
    return createHmac('sha256', this.getSecret())
      .update(value)
      .digest('base64url');
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private base64Url(value: string) {
    return Buffer.from(value).toString('base64url');
  }

  private getSecret() {
    return (
      process.env.ADMIN_SESSION_SECRET ??
      'dev-only-change-this-admin-session-secret'
    );
  }

  private getTtlSeconds() {
    return Number(process.env.ADMIN_SESSION_TTL_SECONDS ?? 8 * 60 * 60);
  }
}
