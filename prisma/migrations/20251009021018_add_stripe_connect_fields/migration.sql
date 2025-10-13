/*
  Warnings:

  - A unique constraint covering the columns `[stripeSessionId]` on the table `payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripePaymentIntentId]` on the table `payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `salon` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."payment" ADD COLUMN     "connectedAccountId" TEXT,
ADD COLUMN     "netAmount" INTEGER,
ADD COLUMN     "platformFeeAmount" INTEGER,
ADD COLUMN     "stripeChargeId" TEXT,
ADD COLUMN     "stripeFeeAmount" INTEGER,
ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "stripeRefundId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT;

-- AlterTable
ALTER TABLE "public"."salon" ADD COLUMN     "platformFeeMinCents" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "platformFeePercent" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeAccountStatus" TEXT,
ADD COLUMN     "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeOnboardedAt" TIMESTAMP(3),
ADD COLUMN     "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeRequirementsDue" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "payment_stripeSessionId_key" ON "public"."payment"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_stripePaymentIntentId_key" ON "public"."payment"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "salon_stripeAccountId_key" ON "public"."salon"("stripeAccountId");
