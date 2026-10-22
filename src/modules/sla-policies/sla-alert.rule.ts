import { Metric, MetricType, SlaStatus } from "@prisma/client";

export type AlertSlaStatus =
  typeof SlaStatus.AT_RISK | typeof SlaStatus.BREACHED;

const METRIC_LABEL: Record<Metric, string> = {
  [Metric.FIRST_RESPONSE]: "primera respuesta",
  [Metric.RESOLUTION]: "resolución",
};

const STATE_LABEL: Record<MetricType, string> = {
  [MetricType.SLA_WARNING]: "en riesgo",
  [MetricType.SLA_BREACHED]: "incumplido",
};

export function isActionableSlaTransition(
  previousStatus: SlaStatus | null,
  nextStatus: SlaStatus | null,
): nextStatus is AlertSlaStatus {
  return (
    previousStatus !== nextStatus &&
    (nextStatus === SlaStatus.AT_RISK || nextStatus === SlaStatus.BREACHED)
  );
}

export function metricTypeForStatus(status: AlertSlaStatus): MetricType {
  return status === SlaStatus.BREACHED
    ? MetricType.SLA_BREACHED
    : MetricType.SLA_WARNING;
}

export function slaAlertCopy(
  metric: Metric,
  type: MetricType,
  ticketId: string,
): { title: string; message: string } {
  const metricLabel = METRIC_LABEL[metric];
  const stateLabel = STATE_LABEL[type];

  return {
    title: `SLA de ${metricLabel} ${stateLabel}`,
    message: `El SLA de ${metricLabel} está ${stateLabel} para el ticket ${ticketId}`,
  };
}
