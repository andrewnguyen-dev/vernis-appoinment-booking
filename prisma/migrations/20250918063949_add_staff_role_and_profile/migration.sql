-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'STAFF';

-- CreateTable
CREATE TABLE "public"."staff" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_salonId_idx" ON "public"."staff"("salonId");

-- CreateIndex
CREATE INDEX "staff_userId_idx" ON "public"."staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_salonId_userId_key" ON "public"."staff"("salonId", "userId");

-- AddForeignKey
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
