export interface HardwareCommandResult {
  success: boolean;
  lockerId: number;
  command: 'OPEN' | 'CLOSE';
  message: string;
  executedAt: string;
}

export interface HardwareHealth {
  mode: 'MOCK' | 'ESP32';
  online: boolean;
  latencyMs: number;
  checkedAt: string;
}

export interface LockerHardwareAdapter {
  openLocker(lockerId: number): Promise<HardwareCommandResult>;
  closeLocker(lockerId: number): Promise<HardwareCommandResult>;
  getHealth(): Promise<HardwareHealth>;
}
