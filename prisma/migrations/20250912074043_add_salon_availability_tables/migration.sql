-- CreateEnum
CREATE TYPE "public"."DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "public"."business_hours" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "dayOfWeek" "public"."DayOfWeek" NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."salon_closure" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salon_closure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_hours_salonId_idx" ON "public"."business_hours"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_salonId_dayOfWeek_key" ON "public"."business_hours"("salonId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "salon_closure_salonId_startDate_endDate_idx" ON "public"."salon_closure"("salonId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "public"."business_hours" ADD CONSTRAINT "business_hours_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."salon_closure" ADD CONSTRAINT "salon_closure_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
