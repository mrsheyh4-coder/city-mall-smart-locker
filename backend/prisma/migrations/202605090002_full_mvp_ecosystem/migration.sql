-- Rename public API status FREE to AVAILABLE while preserving existing data.
ALTER TABLE "lockers" ALTER COLUMN "status" DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LockerStatus_new') THEN
    CREATE TYPE "LockerStatus_new" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'EXPIRED', 'MAINTENANCE');
  END IF;
END $$;

ALTER TABLE "lockers"
  ALTER COLUMN "status" TYPE "LockerStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'FREE' THEN 'AVAILABLE'
      ELSE "status"::text
    END
  )::"LockerStatus_new";

DROP TYPE IF EXISTS "LockerStatus";
ALTER TYPE "LockerStatus_new" RENAME TO "LockerStatus";
ALTER TABLE "lockers" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';

-- Enums for the full MVP ecosystem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
    CREATE TYPE "BookingStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessMethod') THEN
    CREATE TYPE "AccessMethod" AS ENUM ('PIN', 'QR', 'ADMIN', 'HARDWARE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LogLevel') THEN
    CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');
  END IF;
END $$;

ALTER TABLE "lockers" ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "phone" TEXT,
  "name" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");

CREATE TABLE IF NOT EXISTS "admins" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email");

CREATE TABLE IF NOT EXISTS "bookings" (
  "id" TEXT NOT NULL,
  "lockerId" TEXT NOT NULL,
  "userId" TEXT,
  "phone" TEXT NOT NULL,
  "customerName" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'ACTIVE',
  "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bookings_lockerId_idx" ON "bookings"("lockerId");
CREATE INDEX IF NOT EXISTS "bookings_userId_idx" ON "bookings"("userId");
CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings"("status");
CREATE INDEX IF NOT EXISTS "bookings_expiresAt_idx" ON "bookings"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_lockerId_fkey') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lockerId_fkey"
      FOREIGN KEY ("lockerId") REFERENCES "lockers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_userId_fkey') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "userId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "provider" TEXT NOT NULL DEFAULT 'CITY_MALL_MOCK',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payments_bookingId_idx" ON "payments"("bookingId");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_bookingId_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_userId_fkey') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tariffs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lockerSize" "LockerSize" NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tariffs_lockerSize_idx" ON "tariffs"("lockerSize");
CREATE INDEX IF NOT EXISTS "tariffs_isActive_idx" ON "tariffs"("isActive");

CREATE TABLE IF NOT EXISTS "access_codes" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "lockerId" TEXT NOT NULL,
  "userId" TEXT,
  "pinCode" TEXT NOT NULL,
  "qrCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "access_codes_bookingId_idx" ON "access_codes"("bookingId");
CREATE INDEX IF NOT EXISTS "access_codes_lockerId_idx" ON "access_codes"("lockerId");
CREATE INDEX IF NOT EXISTS "access_codes_pinCode_idx" ON "access_codes"("pinCode");
CREATE INDEX IF NOT EXISTS "access_codes_expiresAt_idx" ON "access_codes"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_codes_bookingId_fkey') THEN
    ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_codes_lockerId_fkey') THEN
    ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_lockerId_fkey"
      FOREIGN KEY ("lockerId") REFERENCES "lockers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_codes_userId_fkey') THEN
    ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "access_logs" ADD COLUMN IF NOT EXISTS "accessCodeId" TEXT;
ALTER TABLE "access_logs"
  ALTER COLUMN "method" TYPE "AccessMethod"
  USING (
    CASE
      WHEN "method" IN ('PIN', 'QR', 'ADMIN', 'HARDWARE') THEN "method"
      ELSE 'ADMIN'
    END
  )::"AccessMethod";

CREATE INDEX IF NOT EXISTS "access_logs_accessCodeId_idx" ON "access_logs"("accessCodeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_logs_accessCodeId_fkey') THEN
    ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_accessCodeId_fkey"
      FOREIGN KEY ("accessCodeId") REFERENCES "access_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "logs" (
  "id" TEXT NOT NULL,
  "level" "LogLevel" NOT NULL DEFAULT 'INFO',
  "source" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "lockerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "logs_level_idx" ON "logs"("level");
CREATE INDEX IF NOT EXISTS "logs_source_idx" ON "logs"("source");
CREATE INDEX IF NOT EXISTS "logs_lockerId_idx" ON "logs"("lockerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logs_lockerId_fkey') THEN
    ALTER TABLE "logs" ADD CONSTRAINT "logs_lockerId_fkey"
      FOREIGN KEY ("lockerId") REFERENCES "lockers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
