ALTER TABLE "bookings"
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru';

ALTER TABLE "sms_verifications"
ADD COLUMN "code" TEXT,
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru';
