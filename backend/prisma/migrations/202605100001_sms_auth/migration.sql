CREATE TABLE IF NOT EXISTS "sms_verifications" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "userId" TEXT,
  "codeHash" TEXT NOT NULL,
  "token" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sms_verifications_phone_idx" ON "sms_verifications"("phone");
CREATE INDEX IF NOT EXISTS "sms_verifications_token_idx" ON "sms_verifications"("token");
CREATE INDEX IF NOT EXISTS "sms_verifications_expiresAt_idx" ON "sms_verifications"("expiresAt");

ALTER TABLE "sms_verifications"
  ADD CONSTRAINT "sms_verifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
