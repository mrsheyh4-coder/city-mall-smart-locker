import { Module } from '@nestjs/common';
import { DatabaseSeederService } from './database-seeder.service';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService, DatabaseSeederService],
  exports: [PrismaService],
})
export class PrismaModule {}
