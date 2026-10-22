import Fastify from "fastify";
import {
  Priority,
  SlaStatus,
  TicketStatus,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { registerErrorHandler } from "../../common/errors/error-handler.js";
import { reportRoutes } from "./report.routes.js";
import { ReportService } from "./report.service.js";

type Row = {
  organizationId: string;
  status: TicketStatus;
  priority: Priority;
  resolutionStatus: SlaStatus | null;
};

type TicketWhere = {
  organizationId?: string;
  status?: { not?: TicketStatus };
};

const rows: Row[] = [
  {
    organizationId: "org-1",
    status: TicketStatus.OPEN,
    priority: Priority.MEDIUM,
    resolutionStatus: SlaStatus.WITHIN_SLA,
  },
  {
    organizationId: "org-1",
    status: TicketStatus.IN_PROGRESS,
    priority: Priority.URGENT,
    resolutionStatus: SlaStatus.AT_RISK,
  },
  {
    organizationId: "org-1",
    status: TicketStatus.WAITING_CUSTOMER,
    priority: Priority.LOW,
    resolutionStatus: null,
  },
  {
    organizationId: "org-1",
    status: TicketStatus.RESOLVED,
    priority: Priority.HIGH,
    resolutionStatus: SlaStatus.BREACHED,
  },
  {
    organizationId: "org-1",
    status: TicketStatus.CLOSED,
    priority: Priority.LOW,
    resolutionStatus: SlaStatus.BREACHED,
  },
  {
    organizationId: "org-2",
    status: TicketStatus.OPEN,
    priority: Priority.URGENT,
    resolutionStatus: SlaStatus.BREACHED,
  },
];

function matches(row: Row, where: TicketWhere) {
  if (
    where.organizationId !== undefined &&
    row.organizationId !== where.organizationId
  ) {
    return false;
  }

  if (where.status?.not !== undefined && row.status === where.status.not) {
    return false;
  }

  return true;
}

function prismaFrom(source: Row[]) {
  return {
    ticket: {
      groupBy: async (args: { by: Array<"status" | "priority">; where: TicketWhere }) => {
        const key = args.by[0];
        if (!key) return [];
        const counts = new Map<string, number>();

        for (const row of source.filter((item) => matches(item, args.where))) {
          const value = row[key];
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }

        return [...counts.entries()].map(([value, count]) => ({
          [key]: value,
          _count: { _all: count },
        }));
      },
    },
    ticketSla: {
      groupBy: async (args: {
        where: {
          resolutionStatus: { in: SlaStatus[] };
          ticket: TicketWhere;
        };
      }) => {
        const counts = new Map<SlaStatus, number>();

        for (const row of source) {
          if (!row.resolutionStatus) continue;
          if (!args.where.resolutionStatus.in.includes(row.resolutionStatus)) continue;
          if (!matches(row, args.where.ticket)) continue;
          counts.set(
            row.resolutionStatus,
            (counts.get(row.resolutionStatus) ?? 0) + 1,
          );
        }

        return [...counts.entries()].map(([resolutionStatus, count]) => ({
          resolutionStatus,
          _count: { _all: count },
        }));
      },
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
}

describe("resumen de tickets", () => {
  const service = new ReportService(prismaFrom(rows) as unknown as PrismaClient);

  it("no cuenta los tickets de otra organización ni los cerrados", async () => {
    const summary = await service.ticketsSummary("org-1");

    expect(summary.byStatus).toEqual({
      OPEN: 1,
      IN_PROGRESS: 1,
      WAITING_CUSTOMER: 1,
      RESOLVED: 1,
    });
    expect(summary.byPriority).toEqual({
      LOW: 1,
      MEDIUM: 1,
      HIGH: 1,
      URGENT: 1,
    });
    expect(summary.resolutionSla).toEqual({
      AT_RISK: 1,
      BREACHED: 1,
    });
  });

  it("el resumen de la segunda organización solo cuenta lo suyo", async () => {
    const summary = await service.ticketsSummary("org-2");

    expect(summary.byStatus.OPEN).toBe(1);
    expect(summary.byStatus.IN_PROGRESS).toBe(0);
    expect(summary.byPriority.URGENT).toBe(1);
    expect(summary.byPriority.MEDIUM).toBe(0);
    expect(summary.resolutionSla).toEqual({
      AT_RISK: 0,
      BREACHED: 1,
    });
  });
});

describe("GET /reports/tickets-summary", () => {
  it("responde 403 si el usuario no tiene el permiso", async () => {
    const app = await buildApp(false);

    const response = await app.inject({
      method: "GET",
      url: "/reports/tickets-summary",
      headers: { authorization: "Bearer token-de-prueba" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: { message: "Insufficient permissions" },
    });

    await app.close();
  });

  it("responde 200 cuando el permiso está concedido", async () => {
    const app = await buildApp(true);

    const response = await app.inject({
      method: "GET",
      url: "/reports/tickets-summary",
      headers: { authorization: "Bearer token-de-prueba" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        byStatus: { OPEN: 0, RESOLVED: 0 },
        resolutionSla: { AT_RISK: 0, BREACHED: 0 },
      },
    });

    await app.close();
  });
});

async function buildApp(allowed: boolean) {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  app.decorate("prisma", {
    session: {
      findUnique: async () => ({
        id: "session-1",
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-1",
          organizationId: "org-1",
          name: "Agente",
          email: "agent@acme.test",
          status: UserStatus.ACTIVE,
        },
      }),
    },
    ticket: {
      groupBy: async () => [],
    },
    ticketSla: {
      groupBy: async () => [],
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  });
  app.decorate("authorizationService", {
    hasPermission: async () => allowed,
  });
  await app.register(reportRoutes);
  return app;
}
