/*
  Warnings:

  - You are about to drop the `membership` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[ownerId]` on the table `salon` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ownerId` to the `salon` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."membership" DROP CONSTRAINT "membership_salonId_fkey";

-- DropForeignKey
ALTER TABLE "public"."membership" DROP CONSTRAINT "membership_userId_fkey";

-- AlterTable
ALTER TABLE "public"."salon" ADD COLUMN     "ownerId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."membership";

-- DropEnum
DROP TYPE "public"."Role";

-- CreateIndex
CREATE UNIQUE INDEX "salon_ownerId_key" ON "public"."salon"("ownerId");

-- AddForeignKey
ALTER TABLE "public"."salon" ADD CONSTRAINT "salon_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
