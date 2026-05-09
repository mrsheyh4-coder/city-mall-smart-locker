import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { HardwareModule } from './modules/hardware/hardware.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { LockersModule } from './modules/lockers/lockers.module';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    HardwareModule,
    IntegrationsModule,
    LockersModule,
  ],
})
export class AppModule {}
