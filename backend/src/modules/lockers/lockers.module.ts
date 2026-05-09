import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { HardwareModule } from '../hardware/hardware.module';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LockersController } from './lockers.controller';
import { LockersService } from './lockers.service';
import { LockersGateway } from './lockers.gateway';

@Module({
  imports: [AuthModule, HardwareModule, IntegrationsModule, PrismaModule],
  controllers: [LockersController],
  providers: [LockersService, LockersGateway, AdminGuard, RateLimitGuard],
})
export class LockersModule {}
