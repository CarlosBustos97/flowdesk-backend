import type { Priority, SlaStatus } from "@prisma/client";
import { addBusinessTime } from "./sla-business-hours.calculator.js";

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

export type SlaBusinessHourForCalculation = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export function calculateSlaDueDates(
  slaPolicy: SlaPolicyForCalculation,
  openedAt: Date,
  businessHours?: SlaBusinessHourForCalculation[],
): SlaDueDates {
  const firstResponseDueAt =
    businessHours != undefined && businessHours.length > 0
      ? addBusinessTime(openedAt, slaPolicy.firstResponseMinutes, businessHours)
      : new Date(
          openedAt.getTime() + slaPolicy.firstResponseMinutes * 60 * 1000,
        );

  const resolutionDueAt =
    businessHours != undefined && businessHours.length > 0
      ? addBusinessTime(openedAt, slaPolicy.resolutionMinutes, businessHours)
      : new Date(openedAt.getTime() + slaPolicy.resolutionMinutes * 60 * 1000);

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
  if (now >= dueAt) return "BREACHED";

  const totalDuration = dueAt.getTime() - openedAt.getTime();
  const remainingDuration = dueAt.getTime() - now.getTime();
  const remainingPercentage = remainingDuration / totalDuration;

  if (remainingPercentage <= 0.2) return "AT_RISK";

  return "WITHIN_SLA";
}

export function calculateElapsedTime(
  openedAt: Date,
  now: Date,
  pausedDurationSeconds: number,
): number {
  const elapsed = now.getTime() - openedAt.getTime();
  const paused = pausedDurationSeconds * 1000;

  const effectiveElapsed = elapsed - paused;

  return Math.max(0, effectiveElapsed);
}

export function evaluateEffectiveSlaStatus(
  effectiveElapsedMs: number,
  allowedMinutes: number,
): SlaStatus {
  const allowedMs = allowedMinutes * 60 * 1000;

  if (effectiveElapsedMs >= allowedMs) {
    return "BREACHED";
  }

  const remainingMs = allowedMs - effectiveElapsedMs;
  const remainingPercentage = remainingMs / allowedMs;

  if (remainingPercentage <= 0.2) {
    return "AT_RISK";
  }

  return "WITHIN_SLA";
}
