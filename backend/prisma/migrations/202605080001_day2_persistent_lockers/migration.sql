-- CreateEnum
CREATE TYPE "LockerStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'COMPLETED');

-- CreateTable
CREATE TABLE "lockers" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "LockerStatus" NOT NULL DEFAULT 'FREE',
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "pinCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "lockerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lockers_number_key" ON "lockers"("number");

-- CreateIndex
CREATE INDEX "lockers_status_idx" ON "lockers"("status");

-- CreateIndex
CREATE INDEX "sessions_lockerId_idx" ON "sessions"("lockerId");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lockerId_fkey" FOREIGN KEY ("lockerId") REFERENCES "lockers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
