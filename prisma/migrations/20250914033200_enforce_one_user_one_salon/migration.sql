/*
  Warnings:

  - A unique constraint covering the columns `[userId,role]` on the table `membership` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "membership_userId_role_key" ON "public"."membership"("userId", "role");
