import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CustomerStatus,
  SlaStatus,
  TicketStatus,
  type PrismaClient,
} from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import { AppError } from "../../common/errors/app-error.js";
import { CommentService } from "../comments/comment.service.js";
import { TicketService } from "../tickets/ticket.service.js";
import { SlaService } from "./sla.service.js";
import type { SlaBusinessHourForCalculation } from "./sla-business-hours.calculator.js";

const WEEKDAY_HOURS: SlaBusinessHourForCalculation[] = [1, 2, 3, 4, 5].map(
  (dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
  }),
);

const NATIONAL_DAY = [{ date: new Date(Date.UTC(2026, 9, 12)) }];

const FRIDAY_1600_ANDORRA = new Date("2026-10-09T14:00:00.000Z");
const TUESDAY_1000_ANDORRA = new Date("2026-10-13T08:00:00.000Z");
const FRIDAY_0900_ANDORRA = new Date("2026-10-09T07:00:00.000Z");

type PolicyRecord = {
  id: string;
  priority: "MEDIUM";
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isActive: boolean;
  slaCalendar: {
    timezone: string;
    businessHours: SlaBusinessHourForCalculation[];
    holidays: { date: Date }[];
  };
};

function policy(
  id: string,
  timezone: string,
  businessHours: SlaBusinessHourForCalculation[],
  firstResponseMinutes: number,
  resolutionMinutes: number,
): PolicyRecord {
  return {
    id,
    priority: "MEDIUM",
    firstResponseMinutes,
    resolutionMinutes,
    isActive: true,
    slaCalendar: {
      timezone,
      businessHours,
      holidays: NATIONAL_DAY,
    },
  };
}

function createFlow() {
  const policies = new Map<string, PolicyRecord>([
    [
      "policy-andorra",
      policy("policy-andorra", "Europe/Andorra", WEEKDAY_HOURS, 120, 180),
    ],
    ["policy-utc", policy("policy-utc", "UTC", WEEKDAY_HOURS, 120, 180)],
    ["policy-empty", policy("policy-empty", "Europe/Andorra", [], 120, 180)],
  ]);

  const slaQueries: { id: string; organizationId: string }[] = [];
  let ticketSlaFindCount = 0;
  let pauseCreates = 0;

  const ticket = {
    id: "ticket-1",
    organizationId: "org-1",
    subject: "Impresora",
    description: "Se atasca",
    status: TicketStatus.OPEN,
    priority: "MEDIUM" as const,
    openedAt: FRIDAY_1600_ANDORRA,
    resolvedAt: null as Date | null,
    closedAt: null as Date | null,
    slaDueAt: null as Date | null,
    firstResponseAt: null as Date | null,
    createdAt: FRIDAY_1600_ANDORRA,
    updatedAt: FRIDAY_1600_ANDORRA,
  };

  const ticketSla = {
    id: "ticket-sla-1",
    ticketId: ticket.id,
    slaPolicyId: "policy-andorra",
    firstResponseDueAt: TUESDAY_1000_ANDORRA as Date | null,
    firstResponseAt: null as Date | null,
    firstResponseStatus: SlaStatus.WITHIN_SLA,
    resolutionDueAt: TUESDAY_1000_ANDORRA as Date | null,
    resolutionStatus: SlaStatus.WITHIN_SLA,
    resolvedAt: null as Date | null,
    ticketSlaPauses: [] as {
      id: string;
      startedAt: Date;
      endedAt: Date | null;
      durationSeconds?: bigint;
    }[],
    get slaPolicy() {
      const selected = policies.get(ticketSla.slaPolicyId);
      if (!selected) throw new Error("Missing policy");
      return selected;
    },
    ticket: {
      id: ticket.id,
      organizationId: ticket.organizationId,
      status: ticket.status,
      openedAt: ticket.openedAt,
      firstResponseAt: ticket.firstResponseAt,
      resolvedAt: ticket.resolvedAt,
    },
  };

  let createdTicket: { slaPolicyId?: string; slaDueAt?: Date; openedAt?: Date } =
    {};
  let createdTicketSla: {
    slaPolicyId?: string;
    firstResponseDueAt?: Date;
    resolutionDueAt?: Date;
    firstResponseStatus?: SlaStatus;
    resolutionStatus?: SlaStatus;
  } = {};
  let slaUpdate: {
    firstResponseStatus?: SlaStatus;
    resolutionStatus?: SlaStatus;
    resolvedAt?: Date;
    firstResponseAt?: Date;
  } | null = null;
  let slaUpdateCount = 0;

  const db = {
    organization: {
      findUnique: async () => ({ id: "org-1" }),
    },
    customer: {
      findFirst: async () => ({
        id: "customer-1",
        status: CustomerStatus.ACTIVE,
        organizationId: "org-1",
      }),
    },
    slaPolicy: {
      findFirst: async (args: {
        where: { id: string; organizationId: string };
      }) => {
        slaQueries.push(args.where);
        return policies.get(args.where.id) ?? null;
      },
    },
    ticket: {
      findFirst: async () => ({ ...ticket }),
      create: async (args: { data: typeof createdTicket }) => {
        createdTicket = args.data;
        ticket.openedAt = args.data.openedAt ?? ticket.openedAt;
        ticket.slaDueAt = args.data.slaDueAt ?? null;
        ticketSla.ticket.openedAt = ticket.openedAt;
        return { ...ticket, id: ticket.id };
      },
      update: async (args: { data: Partial<typeof ticket> }) => {
        Object.assign(ticket, args.data);
        ticketSla.ticket.status = ticket.status;
        ticketSla.ticket.resolvedAt = ticket.resolvedAt;
        ticketSla.ticket.firstResponseAt = ticket.firstResponseAt;
        return { ...ticket };
      },
    },
    ticketSla: {
      create: async (args: { data: typeof createdTicketSla }) => {
        createdTicketSla = args.data;
        return args.data;
      },
      findUnique: async () => {
        ticketSlaFindCount += 1;
        return ticketSla;
      },
      update: async (args: { data: NonNullable<typeof slaUpdate> }) => {
        slaUpdate = args.data;
        slaUpdateCount += 1;
        Object.assign(ticketSla, args.data);
        return ticketSla;
      },
      updateMany: async (args: { data: NonNullable<typeof slaUpdate> }) => {
        slaUpdate = args.data;
        slaUpdateCount += 1;
        Object.assign(ticketSla, args.data);
        ticket.firstResponseAt = args.data.firstResponseAt ?? ticket.firstResponseAt;
        return { count: 1 };
      },
    },
    ticketSlaPause: {
      findFirst: async () =>
        ticketSla.ticketSlaPauses.find((pause) => pause.endedAt === null) ??
        null,
      create: async (args: {
        data: { ticketSlaId: string; startedAt: Date };
      }) => {
        pauseCreates += 1;
        const pause = {
          id: `pause-${pauseCreates}`,
          startedAt: args.data.startedAt,
          endedAt: null,
        };
        ticketSla.ticketSlaPauses.push(pause);
        return pause;
      },
      update: async (args: {
        where: { id: string };
        data: { endedAt: Date; durationSeconds: bigint };
      }) => {
        const pause = ticketSla.ticketSlaPauses.find(
          (item) => item.id === args.where.id,
        );
        if (!pause) throw new Error("Pause not found");
        pause.endedAt = args.data.endedAt;
        pause.durationSeconds = args.data.durationSeconds;
        return pause;
      },
    },
    ticketStatusHistory: {
      create: async () => ({ id: "history-1" }),
    },
    comment: {
      create: async (args: {
        data: {
          content: string;
          isInternal: boolean;
          createdAt: Date;
          userId: string;
        };
      }) => ({
        id: "comment-1",
        ticketId: ticket.id,
        userId: args.data.userId,
        content: args.data.content,
        isInternal: args.data.isInternal,
        createdAt: args.data.createdAt,
        updatedAt: args.data.createdAt,
        user: { id: args.data.userId, name: "Agent", email: "agent@acme.test" },
      }),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(db),
  };

  const authorization = {
    getScope: async () => "GLOBAL",
    canCreateInternalComment: async () => true,
  } as unknown as AuthorizationService;

  const prisma = db as unknown as PrismaClient;
  const tx = db as unknown as Parameters<SlaService["endPause"]>[2];
  const slaService = new SlaService(prisma);
  const ticketService = new TicketService(prisma, authorization, slaService);
  const commentService = new CommentService(prisma, authorization);

  return {
    tx,
    policies,
    slaQueries,
    ticket,
    ticketSla,
    slaService,
    ticketService,
    commentService,
    created: () => ({ ticket: createdTicket, ticketSla: createdTicketSla }),
    slaUpdate: () => slaUpdate,
    slaUpdateCount: () => slaUpdateCount,
    ticketSlaFindCount: () => ticketSlaFindCount,
    pauseCreates: () => pauseCreates,
  };
}

describe("integración del calendario SLA en los servicios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FRIDAY_1600_ANDORRA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calcula los vencimientos con el calendario de la política seleccionada", async () => {
    const flow = createFlow();

    await flow.ticketService.create(
      {
        organizationId: "org-1",
        customerId: "customer-1",
        subject: "Impresora",
        description: "Se atasca",
        priority: "MEDIUM",
        slaPolicyId: "policy-andorra",
      },
      "user-1",
      "org-1",
    );

    expect(flow.slaQueries).toEqual([
      { id: "policy-andorra", organizationId: "org-1" },
    ]);
    expect(flow.created().ticket.slaPolicyId).toBe("policy-andorra");
    expect(flow.created().ticket.slaDueAt?.toISOString()).toBe(
      "2026-10-13T09:00:00.000Z",
    );
    expect(flow.created().ticketSla).toMatchObject({
      slaPolicyId: "policy-andorra",
      firstResponseStatus: SlaStatus.WITHIN_SLA,
      resolutionStatus: SlaStatus.WITHIN_SLA,
    });
    expect(flow.created().ticketSla.firstResponseDueAt?.toISOString()).toBe(
      "2026-10-13T08:00:00.000Z",
    );
    expect(flow.created().ticketSla.resolutionDueAt?.toISOString()).toBe(
      "2026-10-13T09:00:00.000Z",
    );
  });

  it("no reutiliza el calendario de otra política", async () => {
    const flow = createFlow();

    await flow.ticketService.create(
      {
        organizationId: "org-1",
        customerId: "customer-1",
        subject: "Impresora",
        description: "Se atasca",
        priority: "MEDIUM",
        slaPolicyId: "policy-utc",
      },
      "user-1",
      "org-1",
    );

    expect(flow.created().ticketSla.firstResponseDueAt?.toISOString()).toBe(
      "2026-10-09T16:00:00.000Z",
    );
    expect(flow.created().ticketSla.resolutionDueAt?.toISOString()).toBe(
      "2026-10-09T17:00:00.000Z",
    );
  });

  it("un calendario sin franjas suma minutos de reloj e ignora festivos y zona", async () => {
    const flow = createFlow();

    await flow.ticketService.create(
      {
        organizationId: "org-1",
        customerId: "customer-1",
        subject: "Impresora",
        description: "Se atasca",
        priority: "MEDIUM",
        slaPolicyId: "policy-empty",
      },
      "user-1",
      "org-1",
    );

    expect(flow.created().ticketSla.firstResponseDueAt?.toISOString()).toBe(
      "2026-10-09T16:00:00.000Z",
    );
    expect(flow.created().ticketSla.resolutionDueAt?.toISOString()).toBe(
      "2026-10-09T17:00:00.000Z",
    );
  });

  it("no registra la primera respuesta cuando el comentario es interno", async () => {
    const flow = createFlow();

    await flow.commentService.create(
      "ticket-1",
      { content: "Nota interna", isInternal: true },
      "user-1",
      "org-1",
    );

    expect(flow.ticketSlaFindCount()).toBe(0);
    expect(flow.slaUpdateCount()).toBe(0);
    expect(flow.ticket.firstResponseAt).toBeNull();
  });

  it("calcula la primera respuesta pública con la zona y los festivos de la política del ticket", async () => {
    const flow = createFlow();
    flow.ticketSla.slaPolicyId = "policy-andorra";
    flow.policies.get("policy-andorra")!.firstResponseMinutes = 180;
    vi.setSystemTime(TUESDAY_1000_ANDORRA);

    await flow.commentService.create(
      "ticket-1",
      { content: "Ya está resuelto", isInternal: false },
      "user-1",
      "org-1",
    );

    expect(flow.slaUpdate()?.firstResponseAt?.toISOString()).toBe(
      "2026-10-13T08:00:00.000Z",
    );
    expect(flow.slaUpdate()?.firstResponseStatus).toBe(SlaStatus.WITHIN_SLA);
    expect(flow.ticket.firstResponseAt?.toISOString()).toBe(
      "2026-10-13T08:00:00.000Z",
    );
  });

  it("mantiene una sola pausa abierta y guarda su duración en tiempo de reloj", async () => {
    const flow = createFlow();
    flow.ticket.status = TicketStatus.IN_PROGRESS;

    await flow.ticketService.pending("ticket-1", "user-1", "org-1");
    await flow.slaService.startPause("ticket-1", FRIDAY_1600_ANDORRA, flow.tx);

    expect(flow.pauseCreates()).toBe(1);
    expect(flow.ticketSla.ticketSlaPauses[0]?.startedAt.toISOString()).toBe(
      "2026-10-09T14:00:00.000Z",
    );

    vi.setSystemTime(TUESDAY_1000_ANDORRA);
    flow.ticket.status = TicketStatus.WAITING_CUSTOMER;
    await flow.ticketService.start("ticket-1", "user-1", "org-1");

    expect(flow.ticketSla.ticketSlaPauses[0]?.endedAt?.toISOString()).toBe(
      "2026-10-13T08:00:00.000Z",
    );
    expect(flow.ticketSla.ticketSlaPauses[0]?.durationSeconds).toBe(324000n);
    expect(flow.ticket.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it("rechaza reanudar un ticket que no tiene una pausa abierta", async () => {
    const flow = createFlow();

    await expect(
      flow.slaService.endPause("ticket-1", TUESDAY_1000_ANDORRA, flow.tx),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      flow.slaService.endPause("ticket-1", TUESDAY_1000_ANDORRA, flow.tx),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Active ticket SLA pause not found",
    });
  });

  it("evalúa el estado con el horario, el festivo y la pausa laborable", async () => {
    const flow = createFlow();
    flow.ticket.openedAt = FRIDAY_0900_ANDORRA;
    flow.ticketSla.ticket.openedAt = FRIDAY_0900_ANDORRA;
    flow.policies.get("policy-andorra")!.firstResponseMinutes = 1000;
    flow.policies.get("policy-andorra")!.resolutionMinutes = 400;
    flow.ticketSla.ticketSlaPauses.push({
      id: "pause-1",
      startedAt: FRIDAY_1600_ANDORRA,
      endedAt: TUESDAY_1000_ANDORRA,
    });
    vi.setSystemTime(TUESDAY_1000_ANDORRA);

    const updated = await flow.slaService.evaluateTicketSla("ticket-1");

    expect(updated.firstResponseStatus).toBe(SlaStatus.WITHIN_SLA);
    expect(updated.resolutionStatus).toBe(SlaStatus.BREACHED);
  });

  it("resuelve el ticket con el tiempo laborable de su calendario", async () => {
    const flow = createFlow();
    flow.ticket.status = TicketStatus.IN_PROGRESS;
    flow.ticket.openedAt = FRIDAY_1600_ANDORRA;
    flow.ticketSla.ticket.openedAt = FRIDAY_1600_ANDORRA;
    flow.policies.get("policy-andorra")!.resolutionMinutes = 150;
    vi.setSystemTime(TUESDAY_1000_ANDORRA);

    await flow.ticketService.resolve("ticket-1", "user-1", "org-1");

    expect(flow.ticket.status).toBe(TicketStatus.RESOLVED);
    expect(flow.slaUpdate()?.resolvedAt?.toISOString()).toBe(
      "2026-10-13T08:00:00.000Z",
    );
    expect(flow.slaUpdate()?.resolutionStatus).toBe(SlaStatus.AT_RISK);
  });

  it("no vuelve a resolver un SLA que ya está resuelto", async () => {
    const flow = createFlow();
    flow.ticketSla.resolvedAt = FRIDAY_1600_ANDORRA;

    const result = await flow.slaService.resolveTicketSla(
      "ticket-1",
      TUESDAY_1000_ANDORRA,
      flow.tx,
    );

    expect(result.resolvedAt?.toISOString()).toBe("2026-10-09T14:00:00.000Z");
    expect(flow.slaUpdateCount()).toBe(0);
  });
});
