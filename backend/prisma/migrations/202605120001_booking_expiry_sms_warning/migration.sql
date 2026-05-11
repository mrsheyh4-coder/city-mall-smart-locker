ALTER TABLE "bookings"
ADD COLUMN "expiresWarningSmsSentAt" TIMESTAMP(3);

CREATE INDEX "bookings_expiresWarningSmsSentAt_idx"
ON "bookings"("expiresWarningSmsSentAt");
