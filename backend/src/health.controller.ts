import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      service: 'city-mall-smart-locker-api',
      timestamp: new Date().toISOString(),
    };
  }
}
