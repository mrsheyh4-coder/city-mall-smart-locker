import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface LockersResponseBody {
  data: Array<{ number: number }>;
  meta: { total: number };
}

describe('Lockers API (e2e)', () => {
  let app: INestApplication<App>;
  const mockLockers = Array.from({ length: 60 }, (_, index) => ({
    id: String(index + 1),
    number: index + 1,
    status: index % 4 === 0 ? 'OCCUPIED' : 'AVAILABLE',
    size: 'MEDIUM',
    isOpen: false,
    isOnline: true,
    pinCode: null,
    createdAt: new Date('2026-05-08T09:00:00.000Z'),
    updatedAt: new Date('2026-05-08T09:00:00.000Z'),
  }));
  const prismaMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    locker: {
      count: jest.fn().mockResolvedValue(60),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue(mockLockers),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      count: jest.fn().mockResolvedValue(12),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    payment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    log: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    tariff: {
      count: jest.fn().mockResolvedValue(3),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    admin: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    session: {
      count: jest.fn().mockResolvedValue(12),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/locker_system?schema=public';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/lockers (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/lockers')
      .expect(200)
      .expect(({ body }) => {
        const lockersBody = body as LockersResponseBody;

        expect(lockersBody.meta.total).toBe(60);
        expect(lockersBody.data[0]).toHaveProperty('number');
      });
  });

  afterEach(async () => {
    await app?.close();
  });
});
