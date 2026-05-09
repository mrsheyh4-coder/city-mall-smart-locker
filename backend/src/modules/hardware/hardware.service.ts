import { Injectable } from '@nestjs/common';
import {
  HardwareCommandResult,
  HardwareHealth,
  LockerHardwareAdapter,
} from './hardware-adapter.interface';
import { Esp32HardwareService } from './esp32-hardware.service';
import { SimulatedHardwareService } from './simulated-hardware.service';

@Injectable()
export class HardwareService implements LockerHardwareAdapter {
  constructor(
    private readonly esp32: Esp32HardwareService,
    private readonly simulated: SimulatedHardwareService,
  ) {}

  openLocker(lockerId: number): Promise<HardwareCommandResult> {
    return this.adapter.openLocker(lockerId);
  }

  closeLocker(lockerId: number): Promise<HardwareCommandResult> {
    return this.adapter.closeLocker(lockerId);
  }

  getHealth(): Promise<HardwareHealth> {
    return this.adapter.getHealth();
  }

  getMode() {
    return this.mode;
  }

  private get adapter(): LockerHardwareAdapter {
    return this.mode === 'ESP32' ? this.esp32 : this.simulated;
  }

  private get mode(): 'MOCK' | 'ESP32' {
    return process.env.HARDWARE_MODE === 'ESP32' ? 'ESP32' : 'MOCK';
  }
}
