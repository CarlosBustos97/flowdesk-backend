-- CreateTable
CREATE TABLE "sla_business_hours" (
    "id" UUID NOT NULL,
    "slaPolicyId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,

    CONSTRAINT "sla_business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sla_business_hours_slaPolicyId_idx" ON "sla_business_hours"("slaPolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_business_hours_slaPolicyId_dayOfWeek_key" ON "sla_business_hours"("slaPolicyId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "sla_business_hours" ADD CONSTRAINT "sla_business_hours_slaPolicyId_fkey" FOREIGN KEY ("slaPolicyId") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
