import { describe, expect, it } from "vitest";
import { Metric, MetricType, SlaStatus } from "@prisma/client";
import {
  isActionableSlaTransition,
  metricTypeForStatus,
  slaAlertCopy,
} from "./sla-alert.rule.js";

describe("isActionableSlaTransition", () => {
  it("no alerta si el estado no cambia", () => {
    expect(
      isActionableSlaTransition(SlaStatus.WITHIN_SLA, SlaStatus.WITHIN_SLA),
    ).toBe(false);
    expect(
      isActionableSlaTransition(SlaStatus.AT_RISK, SlaStatus.AT_RISK),
    ).toBe(false);
    expect(
      isActionableSlaTransition(SlaStatus.BREACHED, SlaStatus.BREACHED),
    ).toBe(false);
  });

  it("alerta al salir de un estado ausente y no alerta si el nuevo estado es nulo", () => {
    expect(isActionableSlaTransition(null, SlaStatus.AT_RISK)).toBe(true);
    expect(isActionableSlaTransition(SlaStatus.AT_RISK, null)).toBe(false);
  });

  it("no alerta cuando el estado vuelve a WITHIN_SLA", () => {
    expect(
      isActionableSlaTransition(SlaStatus.AT_RISK, SlaStatus.WITHIN_SLA),
    ).toBe(false);
    expect(
      isActionableSlaTransition(SlaStatus.BREACHED, SlaStatus.WITHIN_SLA),
    ).toBe(false);
  });

  it("alerta al entrar en AT_RISK", () => {
    expect(
      isActionableSlaTransition(SlaStatus.WITHIN_SLA, SlaStatus.AT_RISK),
    ).toBe(true);
    expect(metricTypeForStatus(SlaStatus.AT_RISK)).toBe(MetricType.SLA_WARNING);
  });

  it("alerta al saltar directo a BREACHED, sin fabricar un warning", () => {
    expect(
      isActionableSlaTransition(SlaStatus.WITHIN_SLA, SlaStatus.BREACHED),
    ).toBe(true);
    expect(metricTypeForStatus(SlaStatus.BREACHED)).toBe(
      MetricType.SLA_BREACHED,
    );
  });

  it("alerta al pasar de AT_RISK a BREACHED", () => {
    expect(
      isActionableSlaTransition(SlaStatus.AT_RISK, SlaStatus.BREACHED),
    ).toBe(true);
    expect(metricTypeForStatus(SlaStatus.BREACHED)).toBe(
      MetricType.SLA_BREACHED,
    );
  });
});

describe("slaAlertCopy", () => {
  it("redacta primera respuesta en riesgo y resolución incumplida", () => {
    expect(
      slaAlertCopy(Metric.FIRST_RESPONSE, MetricType.SLA_WARNING, "ticket-1"),
    ).toEqual({
      title: "SLA de primera respuesta en riesgo",
      message:
        "El SLA de primera respuesta está en riesgo para el ticket ticket-1",
    });

    expect(
      slaAlertCopy(Metric.RESOLUTION, MetricType.SLA_BREACHED, "ticket-9"),
    ).toEqual({
      title: "SLA de resolución incumplido",
      message: "El SLA de resolución está incumplido para el ticket ticket-9",
    });
  });

  it("redacta primera respuesta incumplida y resolución en riesgo", () => {
    expect(
      slaAlertCopy(Metric.FIRST_RESPONSE, MetricType.SLA_BREACHED, "ticket-2"),
    ).toEqual({
      title: "SLA de primera respuesta incumplido",
      message:
        "El SLA de primera respuesta está incumplido para el ticket ticket-2",
    });

    expect(
      slaAlertCopy(Metric.RESOLUTION, MetricType.SLA_WARNING, "ticket-3"),
    ).toEqual({
      title: "SLA de resolución en riesgo",
      message: "El SLA de resolución está en riesgo para el ticket ticket-3",
    });
  });
});
