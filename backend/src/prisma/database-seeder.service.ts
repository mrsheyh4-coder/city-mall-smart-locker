import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { LockerSize, LockerStatus, UserRole } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class DatabaseSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.seedLockers();
    await this.healLegacyLockerBookings();
    await this.seedTariffs();
    await this.seedAdmins();
  }

  private async seedLockers() {
    const existingLockers = await this.prisma.locker.findMany({
      select: { number: true },
    });
    const existingNumbers = new Set(
      existingLockers.map((locker) => locker.number),
    );
    const missingLockers = Array.from({ length: 60 }, (_, index) => {
      const number = index + 1;
      const status = this.getDemoStatus(number);

      return {
        number,
        status,
        size: this.getDemoSize(number),
        isOpen: false,
        pinCode:
          status === LockerStatus.AVAILABLE ? null : this.generatePin(number),
        customerName:
          status === LockerStatus.AVAILABLE ? null : `Demo customer ${number}`,
        bookingStartAt:
          status === LockerStatus.AVAILABLE
            ? null
            : new Date(Date.now() - number * 60_000),
        bookingExpiresAt:
          status === LockerStatus.AVAILABLE
            ? null
            : new Date(Date.now() + 120 * 60_000),
      };
    }).filter((locker) => !existingNumbers.has(locker.number));

    if (missingLockers.length === 0) {
      this.logger.log(
        `Locker seed skipped, ${existingLockers.length} lockers already exist`,
      );
      return;
    }

    await this.prisma.locker.createMany({
      data: missingLockers,
      skipDuplicates: true,
    });

    this.logger.log(
      `Seeded ${missingLockers.length} missing demo lockers for City Mall presentation`,
    );
  }

  private getDemoStatus(number: number) {
    if (number % 11 === 0) {
      return LockerStatus.RESERVED;
    }

    if (number % 4 === 0 || number % 7 === 0) {
      return LockerStatus.OCCUPIED;
    }

    return LockerStatus.AVAILABLE;
  }

  private getDemoSize(number: number) {
    if (number % 10 === 0 || number % 10 === 9) {
      return LockerSize.LARGE;
    }

    if (number % 3 === 0) {
      return LockerSize.SMALL;
    }

    return LockerSize.MEDIUM;
  }

  private generatePin(lockerNumber: number) {
    return String(100000 + ((lockerNumber * 137) % 900000));
  }

  private async healLegacyLockerBookings() {
    const legacyLockers = await this.prisma.locker.findMany({
      where: {
        status: { in: [LockerStatus.RESERVED, LockerStatus.OCCUPIED] },
        bookingExpiresAt: null,
      },
      select: { id: true, number: true, pinCode: true },
    });

    if (legacyLockers.length === 0) {
      return;
    }

    await Promise.all(
      legacyLockers.map((locker) =>
        this.prisma.locker.update({
          where: { id: locker.id },
          data: {
            pinCode: locker.pinCode ?? this.generatePin(locker.number),
            customerName: `Demo customer ${locker.number}`,
            bookingStartAt: new Date(Date.now() - locker.number * 60_000),
            bookingExpiresAt: new Date(Date.now() + 120 * 60_000),
          },
        }),
      ),
    );

    this.logger.log(
      `Backfilled booking timers for ${legacyLockers.length} legacy lockers`,
    );
  }

  private async seedTariffs() {
    const demoTariffs: Record<LockerSize, Record<number, number>> = {
      SMALL: {
        15: 5000,
        60: 15000,
        120: 25000,
        240: 45000,
      },
      MEDIUM: {
        15: 8000,
        60: 20000,
        120: 35000,
        240: 60000,
      },
      LARGE: {
        15: 12000,
        60: 30000,
        120: 50000,
        240: 90000,
      },
    };
    const legacyPrices: Record<LockerSize, Record<number, number>> = {
      SMALL: {
        60: 15000,
        120: 30000,
        240: 60000,
      },
      MEDIUM: {
        60: 20250,
        120: 40500,
        240: 81000,
      },
      LARGE: {
        60: 27000,
        120: 54000,
        240: 108000,
      },
    };
    let changed = 0;

    for (const lockerSize of Object.values(LockerSize)) {
      for (const [duration, price] of Object.entries(demoTariffs[lockerSize])) {
        const durationMinutes = Number(duration);
        const name = `${lockerSize} ${this.formatTariffDurationName(durationMinutes)}`;
        const existing = await this.prisma.tariff.findFirst({
          where: { lockerSize, durationMinutes },
        });

        if (!existing) {
          await this.prisma.tariff.create({
            data: { name, lockerSize, durationMinutes, price },
          });
          changed += 1;
          continue;
        }

        const oldDefault = legacyPrices[lockerSize][durationMinutes];
        if (existing.price === oldDefault || existing.name !== name) {
          await this.prisma.tariff.update({
            where: { id: existing.id },
            data: { name, price, isActive: true },
          });
          changed += 1;
        }
      }
    }

    if (changed > 0) {
      this.logger.log(`Seeded or updated ${changed} demo mall locker tariffs`);
    }
  }

  private formatTariffDurationName(minutes: number) {
    if (minutes < 60) {
      return `${minutes}min`;
    }

    return `${minutes / 60}h`;
  }

  private async seedAdmins() {
    await this.prisma.admin.upsert({
      where: { email: 'admin@tashkentcitymall.local' },
      update: {},
      create: {
        email: 'admin@tashkentcitymall.local',
        name: 'City Mall Admin',
        role: UserRole.SUPER_ADMIN,
      },
    });
  }
}
