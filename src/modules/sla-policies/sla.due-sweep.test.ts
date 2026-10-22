import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlaStatus, TicketStatus, type PrismaClient } from "@prisma/client";
import type { SlaBusinessHourForCalculation } from "./sla-business-hours.calculator.js";
import { SlaService } from "./sla.service.js";
import { SlaSweepError } from "./sla-sweep.error.js";

const WEEKDAY_HOURS: SlaBusinessHourForCalculation[] = [1, 2, 3, 4, 5].map(
  (dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
  }),
);

const NATIONAL_DAY = [{ date: new Date(Date.UTC(2026, 9, 12)) }];

const OPENED_AT = new Date("2026-10-09T14:00:00.000Z");
const EVALUATED_AT = new Date("2026-10-13T08:00:00.000Z");

const ELAPSED_WORK_MINUTES = 120;

type StoredSla = {
  id: string;
  ticketId: string;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  resolutionDueAt: Date | null;
  ticketStatus: TicketStatus;
  missingOnRead?: boolean;
};

type FindManyArgs = {
  where: {
    OR: [
      { firstResponseAt: null },
      { resolvedAt: null; resolutionDueAt: { not: null } },
    ];
    ticket: { is: { status: { not: TicketStatus } } };
  };
  orderBy: { id: "asc" };
  cursor?: { id: string };
  skip?: number;
  take: number;
};

function slaId(index: number) {
  return `e${String(index).padStart(4, "0")}`;
}

function pendingRow(index: number): StoredSla {
  return {
    id: slaId(index),
    ticketId: `ticket-${slaId(index)}`,
    firstResponseAt: null,
    resolvedAt: null,
    resolutionDueAt: EVALUATED_AT,
    ticketStatus: TicketStatus.OPEN,
  };
}

function isEligible(row: StoredSla, excludedStatus: TicketStatus) {
  const firstResponsePending = row.firstResponseAt === null;
  const resolutionPending =
    row.resolvedAt === null && row.resolutionDueAt !== null;
  return (
    (firstResponsePending || resolutionPending) &&
    row.ticketStatus !== excludedStatus
  );
}

function createSweep(rows: StoredSla[]) {
  const queries: FindManyArgs[] = [];
  const pageSizes: number[] = [];
  const evaluated: string[] = [];

  const prisma = {
    ticketSla: {
      findMany: async (args: FindManyArgs) => {
        queries.push(args);
        const excludedStatus = args.where.ticket.is.status.not;
        let eligible = rows.filter((row) => isEligible(row, excludedStatus));
        eligible.sort((left, right) =>
          left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
        );
        if (args.cursor) {
          const cursorIndex = eligible.findIndex(
            (row) => row.id === args.cursor?.id,
          );
          if (cursorIndex < 0) {
            throw new Error(`Cursor desconocido: ${args.cursor.id}`);
          }
          eligible = eligible.slice(cursorIndex + (args.skip ?? 0));
        }
        const page = eligible.slice(0, args.take);
        pageSizes.push(page.length);
        return page.map((row) => ({ id: row.id, ticketId: row.ticketId }));
      },
      findUnique: async (args: { where: { ticketId: string } }) => {
        const row = rows.find((item) => item.ticketId === args.where.ticketId);
        if (!row || row.missingOnRead) return null;
        return {
          id: row.id,
          ticketId: row.ticketId,
          firstResponseAt: row.firstResponseAt,
          firstResponseStatus: SlaStatus.WITHIN_SLA,
          resolvedAt: row.resolvedAt,
          resolutionDueAt: row.resolutionDueAt,
          resolutionStatus: SlaStatus.WITHIN_SLA,
          ticketSlaPauses: [],
          slaPolicy: {
            firstResponseMinutes: 200,
            resolutionMinutes: 200,
            slaCalendar: {
              timezone: "Europe/Andorra",
              businessHours: WEEKDAY_HOURS,
              holidays: NATIONAL_DAY,
            },
          },
          ticket: {
            id: row.ticketId,
            organizationId: "org-1",
            status: row.ticketStatus,
            openedAt: OPENED_AT,
            firstResponseAt: row.firstResponseAt,
            resolvedAt: row.resolvedAt,
          },
        };
      },
      update: async (args: { where: { ticketId: string } }) => {
        evaluated.push(args.where.ticketId);
        return { ticketId: args.where.ticketId };
      },
    },
    slaAlertEvent: {
      createMany: async () => ({ count: 1 }),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
  };

  return {
    service: new SlaService(prisma as unknown as PrismaClient),
    queries,
    pageSizes,
    evaluated,
  };
}

function createDirectEvaluation(options: {
  firstResponseMinutes: number;
  resolutionMinutes: number;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
}) {
  const ticketSla = {
    id: "sla-1",
    ticketId: "ticket-1",
    firstResponseAt: options.firstResponseAt,
    firstResponseStatus: SlaStatus.WITHIN_SLA,
    resolvedAt: options.resolvedAt,
    resolutionDueAt: EVALUATED_AT,
    resolutionStatus: SlaStatus.WITHIN_SLA,
    ticketSlaPauses: [],
    slaPolicy: {
      firstResponseMinutes: options.firstResponseMinutes,
      resolutionMinutes: options.resolutionMinutes,
      slaCalendar: {
        timezone: "Europe/Andorra",
        businessHours: WEEKDAY_HOURS,
        holidays: NATIONAL_DAY,
      },
    },
    ticket: {
      id: "ticket-1",
      organizationId: "org-1",
      status: TicketStatus.OPEN,
      openedAt: OPENED_AT,
      firstResponseAt: options.firstResponseAt,
      resolvedAt: options.resolvedAt,
    },
  };

  const alertWrites: unknown[] = [];
  const prisma = {
    ticketSla: {
      findUnique: async () => ticketSla,
      update: async (args: {
        data: {
          firstResponseStatus: SlaStatus;
          resolutionStatus: SlaStatus;
        };
      }) => {
        Object.assign(ticketSla, args.data);
        return ticketSla;
      },
    },
    slaAlertEvent: {
      createMany: async (args: unknown) => {
        alertWrites.push(args);
        return { count: 1 };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
  };

  return {
    ticketSla,
    alertWrites,
    service: new SlaService(prisma as unknown as PrismaClient),
  };
}

describe("evaluateDueTicketSlas y evaluateTicketSla", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(EVALUATED_AT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca la primera respuesta pendiente como WITHIN_SLA cuando queda más del 20 %", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: 200,
      resolutionMinutes: 200,
      firstResponseAt: null,
      resolvedAt: OPENED_AT,
    });

    const updated = await evaluation.service.evaluateTicketSla("ticket-1");

    expect(ELAPSED_WORK_MINUTES).toBe(120);
    expect(updated.firstResponseStatus).toBe(SlaStatus.WITHIN_SLA);
    expect(updated.resolutionStatus).toBe(SlaStatus.WITHIN_SLA);
  });

  it("marca la primera respuesta pendiente como AT_RISK cuando queda el 20 %", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: 150,
      resolutionMinutes: 200,
      firstResponseAt: null,
      resolvedAt: OPENED_AT,
    });

    const updated = await evaluation.service.evaluateTicketSla("ticket-1");

    expect(updated.firstResponseStatus).toBe(SlaStatus.AT_RISK);
    expect(updated.resolutionStatus).toBe(SlaStatus.WITHIN_SLA);
  });

  it("marca la primera respuesta pendiente como BREACHED al agotar el plazo", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: ELAPSED_WORK_MINUTES,
      resolutionMinutes: 200,
      firstResponseAt: null,
      resolvedAt: OPENED_AT,
    });

    const updated = await evaluation.service.evaluateTicketSla("ticket-1");

    expect(updated.firstResponseStatus).toBe(SlaStatus.BREACHED);
    expect(updated.resolutionStatus).toBe(SlaStatus.WITHIN_SLA);
  });

  it("marca la resolución pendiente como WITHIN_SLA cuando queda más del 20 %", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: 30,
      resolutionMinutes: 200,
      firstResponseAt: OPENED_AT,
      resolvedAt: null,
    });

    const updated = await evaluation.service.evaluateTicketSla("ticket-1");

    expect(updated.firstResponseStatus).toBe(SlaStatus.WITHIN_SLA);
    expect(updated.resolutionStatus).toBe(SlaStatus.WITHIN_SLA);
  });

  it("marca la resolución pendiente como AT_RISK cuando queda el 20 %", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: 30,
      resolutionMinutes: 150,
      firstResponseAt: OPENED_AT,
      resolvedAt: null,
    });

    const updated = await evaluation.service.evaluateTicketSla("ticket-1");

    expect(updated.firstResponseStatus).toBe(SlaStatus.WITHIN_SLA);
    expect(updated.resolutionStatus).toBe(SlaStatus.AT_RISK);
  });

  it("marca la resolución pendiente como BREACHED al agotar el plazo", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: 30,
      resolutionMinutes: ELAPSED_WORK_MINUTES,
      firstResponseAt: OPENED_AT,
      resolvedAt: null,
    });

    const updated = await evaluation.service.evaluateTicketSla("ticket-1");

    expect(updated.firstResponseStatus).toBe(SlaStatus.WITHIN_SLA);
    expect(updated.resolutionStatus).toBe(SlaStatus.BREACHED);
  });

  it("una segunda evaluación en el mismo estado no crea otra alerta", async () => {
    const evaluation = createDirectEvaluation({
      firstResponseMinutes: 30,
      resolutionMinutes: ELAPSED_WORK_MINUTES,
      firstResponseAt: OPENED_AT,
      resolvedAt: null,
    });

    await evaluation.service.evaluateTicketSla("ticket-1");
    await evaluation.service.evaluateTicketSla("ticket-1");

    expect(evaluation.alertWrites).toHaveLength(1);
    expect(evaluation.ticketSla.resolutionStatus).toBe(SlaStatus.BREACHED);
  });

  it("procesa 205 SLA pendientes sin repetir el cursor ni omitir elegibles", async () => {
    const eligible = Array.from({ length: 205 }, (_item, index) =>
      pendingRow(index + 1),
    );
    const excluded: StoredSla[] = [
      {
        id: "c0001",
        ticketId: "ticket-closed",
        firstResponseAt: null,
        resolvedAt: null,
        resolutionDueAt: EVALUATED_AT,
        ticketStatus: TicketStatus.CLOSED,
      },
      {
        id: "d0001",
        ticketId: "ticket-done",
        firstResponseAt: OPENED_AT,
        resolvedAt: OPENED_AT,
        resolutionDueAt: EVALUATED_AT,
        ticketStatus: TicketStatus.OPEN,
      },
      {
        id: "n0001",
        ticketId: "ticket-without-resolution-due",
        firstResponseAt: OPENED_AT,
        resolvedAt: null,
        resolutionDueAt: null,
        ticketStatus: TicketStatus.RESOLVED,
      },
    ];
    const sweep = createSweep([...excluded, ...eligible]);

    const processed = await sweep.service.evaluateDueTicketSlas();

    expect(sweep.queries[0]?.where).toEqual({
      OR: [
        { firstResponseAt: null },
        { resolvedAt: null, resolutionDueAt: { not: null } },
      ],
      ticket: {
        is: {
          status: { not: TicketStatus.CLOSED },
        },
      },
    });
    expect(sweep.queries.map((query) => query.take)).toEqual([100, 100, 100]);
    expect(sweep.queries[0]?.cursor).toBeUndefined();
    expect(sweep.queries[0]?.skip).toBeUndefined();
    expect(sweep.queries[1]).toMatchObject({
      cursor: { id: slaId(100) },
      skip: 1,
    });
    expect(sweep.queries[2]).toMatchObject({
      cursor: { id: slaId(200) },
      skip: 1,
    });
    expect(sweep.pageSizes).toEqual([100, 100, 5]);
    expect(processed).toBe(205);
    expect(sweep.evaluated).toEqual(eligible.map((row) => row.ticketId));
    expect(new Set(sweep.evaluated).size).toBe(205);
    expect(sweep.evaluated).not.toContain("ticket-closed");
    expect(sweep.evaluated).not.toContain("ticket-done");
    expect(sweep.evaluated).not.toContain("ticket-without-resolution-due");
  });

  it("termina un lote corto sin pedir otra página", async () => {
    const sweep = createSweep(
      Array.from({ length: 37 }, (_item, index) => pendingRow(index + 1)),
    );

    const processed = await sweep.service.evaluateDueTicketSlas();

    expect(processed).toBe(37);
    expect(sweep.pageSizes).toEqual([37]);
    expect(sweep.queries).toHaveLength(1);
    expect(sweep.queries[0]?.cursor).toBeUndefined();
    expect(sweep.evaluated).toHaveLength(37);
  });

  it("después de un múltiplo de 100 pide el lote vacío y se detiene", async () => {
    const sweep = createSweep(
      Array.from({ length: 200 }, (_item, index) => pendingRow(index + 1)),
    );

    const processed = await sweep.service.evaluateDueTicketSlas();

    expect(processed).toBe(200);
    expect(sweep.pageSizes).toEqual([100, 100, 0]);
    expect(sweep.queries[2]).toMatchObject({
      cursor: { id: slaId(200) },
      skip: 1,
      take: 100,
    });
    expect(sweep.evaluated).toHaveLength(200);
    expect(new Set(sweep.evaluated).size).toBe(200);
  });

  it("evalúa el resto cuando falla un SLA intermedio", async () => {
    const rows = [pendingRow(1), pendingRow(2), pendingRow(3)];
    rows[1]!.missingOnRead = true;
    const sweep = createSweep(rows);

    const error: unknown = await sweep.service
      .evaluateDueTicketSlas()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SlaSweepError);
    expect(error).toMatchObject({
      processed: 2,
      failed: 1,
      failures: [
        {
          ticketId: "ticket-e0002",
          slaId: "e0002",
          error: expect.objectContaining({
            statusCode: 404,
            message: "Ticket SLA not found",
          }),
        },
      ],
    });
    expect(sweep.evaluated).toEqual(["ticket-e0001", "ticket-e0003"]);
    expect(sweep.pageSizes).toEqual([3]);
  });

  it("no resuelve el barrido cuando fallan todos los SLA", async () => {
    const rows = [pendingRow(1), pendingRow(2), pendingRow(3)];
    for (const row of rows) {
      row.missingOnRead = true;
    }
    const sweep = createSweep(rows);

    await expect(sweep.service.evaluateDueTicketSlas()).rejects.toMatchObject({
      processed: 0,
      failed: 3,
      failures: [
        { ticketId: "ticket-e0001", slaId: "e0001" },
        { ticketId: "ticket-e0002", slaId: "e0002" },
        { ticketId: "ticket-e0003", slaId: "e0003" },
      ],
    });
    expect(sweep.evaluated).toEqual([]);
    expect(sweep.pageSizes).toEqual([3]);
  });

  it("sigue paginando cuando falla un SLA del primer lote", async () => {
    const rows = Array.from({ length: 101 }, (_item, index) =>
      pendingRow(index + 1),
    );
    rows[1]!.missingOnRead = true;
    const sweep = createSweep(rows);

    await expect(sweep.service.evaluateDueTicketSlas()).rejects.toMatchObject({
      processed: 100,
      failed: 1,
      failures: [{ ticketId: "ticket-e0002", slaId: "e0002" }],
    });
    expect(sweep.pageSizes).toEqual([100, 1]);
    expect(sweep.queries[1]).toMatchObject({
      cursor: { id: slaId(100) },
      skip: 1,
    });
    expect(sweep.evaluated).toContain("ticket-e0001");
    expect(sweep.evaluated).toContain("ticket-e0101");
    expect(sweep.evaluated).not.toContain("ticket-e0002");
    expect(sweep.evaluated).toHaveLength(100);
  });
});
