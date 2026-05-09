import { Module } from '@nestjs/common';
import { Esp32HardwareService } from './esp32-hardware.service';
import { HardwareService } from './hardware.service';
import { SimulatedHardwareService } from './simulated-hardware.service';

@Module({
  providers: [Esp32HardwareService, HardwareService, SimulatedHardwareService],
  exports: [HardwareService],
})
export class HardwareModule {}
