import { BadGatewayException, Injectable } from '@nestjs/common';
import {
  HardwareCommandResult,
  HardwareHealth,
  LockerHardwareAdapter,
} from './hardware-adapter.interface';

@Injectable()
export class Esp32HardwareService implements LockerHardwareAdapter {
  private readonly baseUrl = process.env.ESP32_BASE_URL;
  private readonly token = process.env.ESP32_API_TOKEN;

  async openLocker(lockerId: number): Promise<HardwareCommandResult> {
    return this.sendCommand(lockerId, 'OPEN');
  }

  async closeLocker(lockerId: number): Promise<HardwareCommandResult> {
    return this.sendCommand(lockerId, 'CLOSE');
  }

  async getHealth(): Promise<HardwareHealth> {
    const startedAt = Date.now();

    if (!this.baseUrl) {
      return {
        mode: 'ESP32',
        online: false,
        latencyMs: 0,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.buildHeaders(),
      });

      return {
        mode: 'ESP32',
        online: response.ok,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    } catch {
      return {
        mode: 'ESP32',
        online: false,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private async sendCommand(
    lockerId: number,
    command: 'OPEN' | 'CLOSE',
  ): Promise<HardwareCommandResult> {
    if (!this.baseUrl) {
      throw new BadGatewayException('ESP32_BASE_URL is not configured');
    }

    const endpoint = command === 'OPEN' ? 'open' : 'close';
    const response = await fetch(
      `${this.baseUrl}/lockers/${lockerId}/${endpoint}`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        `ESP32 command failed with status ${response.status}`,
      );
    }

    return {
      success: true,
      lockerId,
      command,
      message: `ESP32 relay accepted ${command.toLowerCase()} command`,
      executedAt: new Date().toISOString(),
    };
  }

  private buildHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }
}
