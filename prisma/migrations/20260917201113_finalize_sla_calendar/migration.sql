/*
  Warnings:

  - You are about to drop the column `slaPolicyId` on the `sla_business_hours` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slaCalendarId,dayOfWeek]` on the table `sla_business_hours` will be added. If there are existing duplicate values, this will fail.
  - Made the column `slaCalendarId` on table `sla_business_hours` required. This step will fail if there are existing NULL values in that column.
  - Made the column `slaCalendarId` on table `sla_policies` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "sla_business_hours" DROP CONSTRAINT "sla_business_hours_slaPolicyId_fkey";

-- DropForeignKey
ALTER TABLE "sla_policies" DROP CONSTRAINT "sla_policies_slaCalendarId_fkey";

-- DropIndex
DROP INDEX "sla_business_hours_slaPolicyId_dayOfWeek_key";

-- DropIndex
DROP INDEX "sla_business_hours_slaPolicyId_idx";

-- AlterTable
ALTER TABLE "sla_business_hours" DROP COLUMN "slaPolicyId",
ALTER COLUMN "slaCalendarId" SET NOT NULL;

-- AlterTable
ALTER TABLE "sla_policies" ALTER COLUMN "slaCalendarId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "sla_business_hours_slaCalendarId_dayOfWeek_key" ON "sla_business_hours"("slaCalendarId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_slaCalendarId_fkey" FOREIGN KEY ("slaCalendarId") REFERENCES "sla_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
