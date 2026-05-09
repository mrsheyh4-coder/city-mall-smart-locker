-- Extend locker status values used by the Day 3 UI and future admin states.
ALTER TYPE "LockerStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "LockerStatus" ADD VALUE IF NOT EXISTS 'MAINTENANCE';

-- Create locker size enum if this migration is applied to a Day 2 database.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LockerSize') THEN
    CREATE TYPE "LockerSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');
  END IF;
END $$;

-- Add locker metadata expected by the current Prisma schema.
ALTER TABLE "lockers" ADD COLUMN IF NOT EXISTS "size" "LockerSize" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "lockers" ADD COLUMN IF NOT EXISTS "qrCode" TEXT;
ALTER TABLE "lockers" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "lockers" ADD COLUMN IF NOT EXISTS "bookingStartAt" TIMESTAMP(3);
ALTER TABLE "lockers" ADD COLUMN IF NOT EXISTS "bookingExpiresAt" TIMESTAMP(3);

-- Give the demo wall a realistic size distribution instead of one flat default.
UPDATE "lockers"
SET "size" = CASE
  WHEN "number" % 10 IN (0, 9) THEN 'LARGE'::"LockerSize"
  WHEN "number" % 3 = 0 THEN 'SMALL'::"LockerSize"
  ELSE 'MEDIUM'::"LockerSize"
END;

-- Store access credentials on sessions as well as lockers.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "accessPin" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "accessQr" TEXT;

-- Track access attempts for the admin logs view.
CREATE TABLE IF NOT EXISTS "access_logs" (
  "id" TEXT NOT NULL,
  "lockerId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lockers_size_idx" ON "lockers"("size");
CREATE INDEX IF NOT EXISTS "lockers_bookingExpiresAt_idx" ON "lockers"("bookingExpiresAt");
CREATE INDEX IF NOT EXISTS "access_logs_lockerId_idx" ON "access_logs"("lockerId");
CREATE INDEX IF NOT EXISTS "access_logs_success_idx" ON "access_logs"("success");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'access_logs_lockerId_fkey'
  ) THEN
    ALTER TABLE "access_logs"
      ADD CONSTRAINT "access_logs_lockerId_fkey"
      FOREIGN KEY ("lockerId") REFERENCES "lockers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
