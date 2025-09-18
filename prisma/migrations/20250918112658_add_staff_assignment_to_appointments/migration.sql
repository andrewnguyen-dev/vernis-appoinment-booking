-- AlterTable
ALTER TABLE "public"."appointment" ADD COLUMN     "assignedStaffId" TEXT;

-- CreateIndex
CREATE INDEX "appointment_assignedStaffId_idx" ON "public"."appointment"("assignedStaffId");

-- AddForeignKey
ALTER TABLE "public"."appointment" ADD CONSTRAINT "appointment_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "public"."staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
