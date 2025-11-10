-- CreateEnum
CREATE TYPE "public"."PaymentKind" AS ENUM ('BOOKING_DEPOSIT', 'REMAINING_BALANCE', 'FULL_PAYMENT', 'SETUP_ONLY', 'OTHER');

-- AlterTable
ALTER TABLE "public"."appointment" ADD COLUMN     "capturePercentage" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "public"."client" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeDefaultPaymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "public"."payment" ADD COLUMN     "kind" "public"."PaymentKind" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "public"."salon" ADD COLUMN     "capturePercentage" INTEGER NOT NULL DEFAULT 100,
ALTER COLUMN "platformFeeMinCents" SET DEFAULT 300,
ALTER COLUMN "platformFeePercent" SET DEFAULT 3;
