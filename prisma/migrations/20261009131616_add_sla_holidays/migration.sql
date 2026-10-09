-- CreateTable
CREATE TABLE "sla_holidays" (
    "id" UUID NOT NULL,
    "slaCalendarId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sla_holidays_slaCalendarId_idx" ON "sla_holidays"("slaCalendarId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_holidays_slaCalendarId_date_key" ON "sla_holidays"("slaCalendarId", "date");

-- AddForeignKey
ALTER TABLE "sla_holidays" ADD CONSTRAINT "sla_holidays_slaCalendarId_fkey" FOREIGN KEY ("slaCalendarId") REFERENCES "sla_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
