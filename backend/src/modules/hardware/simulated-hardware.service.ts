import { Injectable } from '@nestjs/common';
import {
  HardwareCommandResult,
  HardwareHealth,
  LockerHardwareAdapter,
} from './hardware-adapter.interface';

@Injectable()
export class SimulatedHardwareService implements LockerHardwareAdapter {
  async openLocker(lockerId: number): Promise<HardwareCommandResult> {
    await this.simulateRelayLatency();
    return this.buildResult(lockerId, 'OPEN', 'Simulated relay opened locker');
  }

  async closeLocker(lockerId: number): Promise<HardwareCommandResult> {
    await this.simulateRelayLatency();
    return this.buildResult(lockerId, 'CLOSE', 'Simulated relay closed locker');
  }

  async getHealth(): Promise<HardwareHealth> {
    await Promise.resolve();

    return {
      mode: 'MOCK',
      online: true,
      latencyMs: 35,
      checkedAt: new Date().toISOString(),
    };
  }

  private async simulateRelayLatency() {
    await Promise.resolve();
  }

  private buildResult(
    lockerId: number,
    command: 'OPEN' | 'CLOSE',
    message: string,
  ): HardwareCommandResult {
    return {
      success: true,
      lockerId,
      command,
      message,
      executedAt: new Date().toISOString(),
    };
  }
}
