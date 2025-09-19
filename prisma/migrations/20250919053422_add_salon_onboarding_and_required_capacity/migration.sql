/*
  Warnings:

  - Made the column `capacity` on table `salon` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."salon" ADD COLUMN     "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "capacity" SET NOT NULL;
