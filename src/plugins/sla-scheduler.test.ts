import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { PrismaClient } from "@prisma/client";
import slaScheduler from "./sla-scheduler.js";

const SLA_INTERVAL_MS = 60_000;

type LogEntry = {
  level: number;
  msg: string;
  processed?: number;
};

type FindManyResult = Array<{ id: string; ticketId: string }>;

function logStream(entries: LogEntry[]) {
  return new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString();
      for (const line of text.split(/\n+/)) {
        if (line.trim().length === 0) continue;
        entries.push(JSON.parse(line) as LogEntry);
      }
      callback();
    },
  });
}

async function flushMicrotasks() {
  for (let step = 0; step < 20; step += 1) {
    await Promise.resolve();
  }
}

function completed(entries: LogEntry[]) {
  return entries.filter(
    (entry) => entry.msg === "Evaluación periódica de SLA completada",
  );
}

function warnings(entries: LogEntry[]) {
  return entries.filter(
    (entry) =>
      entry.msg === "Evaluación de SLA omitida: ya hay una ejecución en curso",
  );
}

function errors(entries: LogEntry[]) {
  return entries.filter(
    (entry) => entry.msg === "Error durante la evaluación periódica de SLA",
  );
}

function evaluableTicketSla(ticketId: string) {
  const answeredAt = new Date("2026-10-09T14:00:00.000Z");
  return {
    id: ticketId,
    ticketId,
    firstResponseAt: answeredAt,
    firstResponseStatus: "WITHIN_SLA",
    resolvedAt: answeredAt,
    resolutionDueAt: answeredAt,
    resolutionStatus: "WITHIN_SLA",
    ticketSlaPauses: [],
    slaPolicy: {
      firstResponseMinutes: 120,
      resolutionMinutes: 180,
      slaCalendar: {
        timezone: "Europe/Andorra",
        businessHours: [],
        holidays: [],
      },
    },
    ticket: {
      id: ticketId,
      organizationId: "org-1",
      status: "OPEN",
      openedAt: answeredAt,
      firstResponseAt: answeredAt,
      resolvedAt: answeredAt,
    },
  };
}

describe("scheduler periódico de SLA", () => {
  let app: FastifyInstance | undefined;
  let releaseEvaluation: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T08:00:00.000Z"));
  });

  afterEach(async () => {
    releaseEvaluation?.();
    releaseEvaluation = undefined;
    const current = app;
    app = undefined;
    if (current) {
      await current.close();
    }
    vi.useRealTimers();
  });

  it("evalúa al arrancar y registra cuántos SLA procesó", async () => {
    const entries: LogEntry[] = [];
    const evaluated: string[] = [];
    app = Fastify({
      logger: { level: "info", stream: logStream(entries) },
    });
    app.decorate(
      "prisma",
      {
        ticketSla: {
          findMany: async (): Promise<FindManyResult> => [
            { id: "sla-1", ticketId: "ticket-1" },
            { id: "sla-2", ticketId: "ticket-2" },
          ],
          findUnique: async (args: { where: { ticketId: string } }) =>
            evaluableTicketSla(args.where.ticketId),
          update: async (args: { where: { ticketId: string } }) => {
            evaluated.push(args.where.ticketId);
            return { ticketId: args.where.ticketId };
          },
        },
      } as unknown as PrismaClient,
    );

    await app.register(slaScheduler);
    await flushMicrotasks();

    expect(evaluated).toEqual(["ticket-1", "ticket-2"]);
    expect(completed(entries)).toEqual([
      expect.objectContaining({ processed: 2 }),
    ]);
  });

  it("repite la evaluación a los 60 segundos y no a los 59", async () => {
    const entries: LogEntry[] = [];
    let queries = 0;
    app = Fastify({
      logger: { level: "info", stream: logStream(entries) },
    });
    app.decorate(
      "prisma",
      {
        ticketSla: {
          findMany: async () => {
            queries += 1;
            return [];
          },
        },
      } as unknown as PrismaClient,
    );

    await app.register(slaScheduler);
    await flushMicrotasks();
    expect(queries).toBe(1);
    expect(completed(entries)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(SLA_INTERVAL_MS - 1_000);
    await flushMicrotasks();
    expect(queries).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();
    expect(queries).toBe(2);
    expect(completed(entries)).toEqual([
      expect.objectContaining({ processed: 0 }),
      expect.objectContaining({ processed: 0 }),
    ]);
  });

  it("omite una evaluación mientras hay otra activa y continúa al terminar", async () => {
    const entries: LogEntry[] = [];
    let queries = 0;
    const gate = new Promise<void>((resolve) => {
      releaseEvaluation = resolve;
    });
    app = Fastify({
      logger: { level: "info", stream: logStream(entries) },
    });
    app.decorate(
      "prisma",
      {
        ticketSla: {
          findMany: async () => {
            queries += 1;
            if (queries === 1) {
              await gate;
            }
            return [];
          },
        },
      } as unknown as PrismaClient,
    );

    await app.register(slaScheduler);
    await flushMicrotasks();
    expect(queries).toBe(1);
    expect(completed(entries)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(SLA_INTERVAL_MS);
    await flushMicrotasks();
    expect(queries).toBe(1);
    expect(warnings(entries)).toHaveLength(1);

    releaseEvaluation?.();
    releaseEvaluation = undefined;
    await flushMicrotasks();
    expect(completed(entries)).toEqual([
      expect.objectContaining({ processed: 0 }),
    ]);

    await vi.advanceTimersByTimeAsync(SLA_INTERVAL_MS);
    await flushMicrotasks();
    expect(queries).toBe(2);
    expect(warnings(entries)).toHaveLength(1);
    expect(completed(entries)).toHaveLength(2);
  });

  it("registra un error de evaluación y la siguiente ejecución continúa", async () => {
    const entries: LogEntry[] = [];
    let queries = 0;
    app = Fastify({
      logger: { level: "info", stream: logStream(entries) },
    });
    app.decorate(
      "prisma",
      {
        ticketSla: {
          findMany: async () => {
            queries += 1;
            if (queries === 1) {
              throw new Error("fallo controlado de prueba");
            }
            return [];
          },
        },
      } as unknown as PrismaClient,
    );

    await app.register(slaScheduler);
    await flushMicrotasks();
    expect(errors(entries)).toHaveLength(1);
    expect(completed(entries)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(SLA_INTERVAL_MS);
    await flushMicrotasks();
    expect(queries).toBe(2);
    expect(errors(entries)).toHaveLength(1);
    expect(completed(entries)).toEqual([
      expect.objectContaining({ processed: 0 }),
    ]);
  });

  it("al cerrar espera la evaluación activa, cierra después Prisma y detiene el temporizador", async () => {
    const entries: LogEntry[] = [];
    const events: string[] = [];
    let queries = 0;
    const gate = new Promise<void>((resolve) => {
      releaseEvaluation = resolve;
    });
    app = Fastify({
      logger: { level: "info", stream: logStream(entries) },
    });
    await app.register(
      fp(async (instance) => {
        instance.addHook("onClose", async () => {
          events.push("prisma-close");
        });
      }),
    );
    app.decorate(
      "prisma",
      {
        ticketSla: {
          findMany: async () => {
            queries += 1;
            await gate;
            events.push("query-finished");
            return [];
          },
        },
      } as unknown as PrismaClient,
    );
    await app.register(slaScheduler);
    await flushMicrotasks();
    expect(queries).toBe(1);

    let closed = false;
    const closing = app.close().then(() => {
      closed = true;
    });
    await flushMicrotasks();
    expect(closed).toBe(false);
    expect(events).not.toContain("prisma-close");

    releaseEvaluation?.();
    releaseEvaluation = undefined;
    await closing;

    expect(events).toEqual(["query-finished", "prisma-close"]);
    expect(completed(entries)).toEqual([
      expect.objectContaining({ processed: 0 }),
    ]);

    const queriesAtClose = queries;
    await vi.advanceTimersByTimeAsync(SLA_INTERVAL_MS * 3);
    await flushMicrotasks();
    expect(queries).toBe(queriesAtClose);
  });
});
