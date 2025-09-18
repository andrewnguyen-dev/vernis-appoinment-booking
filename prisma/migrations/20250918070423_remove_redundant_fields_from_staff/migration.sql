/*
  Warnings:

  - You are about to drop the column `email` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `staff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."staff" DROP COLUMN "email",
DROP COLUMN "name";
