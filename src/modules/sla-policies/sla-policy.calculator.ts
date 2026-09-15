import type { Priority, SlaStatus } from "@prisma/client";

export type SlaPolicyForCalculation = {
  id: string;
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

export type SlaDueDates = {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
};

export function calculateSlaDueDates(
  slaPolicy: SlaPolicyForCalculation,
  openedAt: Date,
): SlaDueDates {
  const firstResponseDueAt = new Date(
    openedAt.getTime() + slaPolicy.firstResponseMinutes * 60 * 1000,
  );

  const resolutionDueAt = new Date(
    openedAt.getTime() + slaPolicy.resolutionMinutes * 60 * 1000,
  );

  return {
    firstResponseDueAt,
    resolutionDueAt,
  };
}

export function evaluateSlaStatus(
  openedAt: Date,
  dueAt: Date,
  now: Date = new Date(),
): SlaStatus {
  if (now >= dueAt) {
    return "BREACHED";
  }

  const totalDuration = dueAt.getTime() - openedAt.getTime();
  const remainingDuration = dueAt.getTime() - now.getTime();

  const remainingPercentage = remainingDuration / totalDuration;

  if (remainingPercentage <= 0.2) {
    return "AT_RISK";
  }

  return "WITHIN_SLA";
}
