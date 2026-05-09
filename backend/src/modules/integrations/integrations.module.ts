import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { HardwareModule } from '../hardware/hardware.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [HardwareModule, PrismaModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, RateLimitGuard],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
