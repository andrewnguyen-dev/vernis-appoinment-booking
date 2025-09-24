/*
  Warnings:

  - A unique constraint covering the columns `[stripeAccountId]` on the table `salon` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `totalAmountCents` to the `payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DepositType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'AUTHORIZATION_ONLY');

-- AlterTable
ALTER TABLE "public"."payment" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "isDeposit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundAmount" INTEGER,
ADD COLUMN     "totalAmountCents" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."salon" ADD COLUMN     "depositDescription" TEXT NOT NULL DEFAULT 'Booking deposit',
ADD COLUMN     "depositType" "public"."DepositType" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN     "depositValue" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "requireDeposit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "stripeAccountId" TEXT;

-- CreateIndex
CREATE INDEX "payment_providerRef_idx" ON "public"."payment"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "salon_stripeAccountId_key" ON "public"."salon"("stripeAccountId");
