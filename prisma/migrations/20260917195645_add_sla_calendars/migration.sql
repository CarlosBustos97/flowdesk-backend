-- AlterTable
ALTER TABLE "sla_business_hours" ADD COLUMN     "slaCalendarId" UUID;

-- AlterTable
ALTER TABLE "sla_policies" ADD COLUMN     "slaCalendarId" UUID;

-- CreateTable
CREATE TABLE "sla_calendars" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sla_calendars_organizationId_idx" ON "sla_calendars"("organizationId");

-- CreateIndex
CREATE INDEX "sla_calendars_organizationId_isActive_idx" ON "sla_calendars"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sla_calendars_organizationId_name_key" ON "sla_calendars"("organizationId", "name");

-- CreateIndex
CREATE INDEX "sla_business_hours_slaCalendarId_idx" ON "sla_business_hours"("slaCalendarId");

-- CreateIndex
CREATE INDEX "sla_policies_slaCalendarId_idx" ON "sla_policies"("slaCalendarId");

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_slaCalendarId_fkey" FOREIGN KEY ("slaCalendarId") REFERENCES "sla_calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_business_hours" ADD CONSTRAINT "sla_business_hours_slaCalendarId_fkey" FOREIGN KEY ("slaCalendarId") REFERENCES "sla_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_calendars" ADD CONSTRAINT "sla_calendars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
