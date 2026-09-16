-- CreateTable
CREATE TABLE "ticket_sla_pauses" (
    "id" UUID NOT NULL,
    "ticketSlaId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_sla_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_sla_pauses_ticketSlaId_idx" ON "ticket_sla_pauses"("ticketSlaId");

-- AddForeignKey
ALTER TABLE "ticket_sla_pauses" ADD CONSTRAINT "ticket_sla_pauses_ticketSlaId_fkey" FOREIGN KEY ("ticketSlaId") REFERENCES "ticket_slas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
