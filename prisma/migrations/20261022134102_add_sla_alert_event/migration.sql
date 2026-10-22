-- CreateEnum
CREATE TYPE "Metric" AS ENUM ('FIRST_RESPONSE', 'RESOLUTION');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('SLA_WARNING', 'SLA_BREACHED');

-- CreateTable
CREATE TABLE "sla_alert_events" (
    "id" UUID NOT NULL,
    "ticketSlaId" UUID NOT NULL,
    "metric" "Metric" NOT NULL,
    "type" "MetricType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sla_alert_events_ticketSlaId_idx" ON "sla_alert_events"("ticketSlaId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_alert_events_ticketSlaId_metric_type_key" ON "sla_alert_events"("ticketSlaId", "metric", "type");

-- AddForeignKey
ALTER TABLE "sla_alert_events" ADD CONSTRAINT "sla_alert_events_ticketSlaId_fkey" FOREIGN KEY ("ticketSlaId") REFERENCES "ticket_slas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
