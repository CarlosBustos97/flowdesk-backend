import { TicketStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { TicketService } from "./ticket.service.js";

describe("TicketService.reopen", () => {
  it("limpia la resolución del SLA y conserva la primera respuesta", async () => {
    const slaUpdates: Array<{ data: { resolvedAt: null } }> = [];
    const resolveTicketSla = vi.fn();
    const existingTicket = {
      id: "ticket-1",
      organizationId: "org-1",
      status: TicketStatus.RESOLVED,
      assignedToId: null,
      createdById: "user-1",
    };

    const prisma = {
      ticket: {
        findFirst: async () => existingTicket,
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          ticket: {
            update: async () => ({
              id: existingTicket.id,
              organizationId: existingTicket.organizationId,
              status: TicketStatus.IN_PROGRESS,
              subject: "Pantalla en blanco",
              description: "No carga",
              priority: "MEDIUM",
              openedAt: new Date(),
              resolvedAt: null,
              closedAt: null,
              slaDueAt: new Date(),
              firstResponseAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              assignedToId: null,
            }),
          },
          ticketSla: {
            updateMany: async (args: { data: { resolvedAt: null } }) => {
              slaUpdates.push(args);
              return { count: 1 };
            },
          },
          ticketStatusHistory: {
            create: async () => ({ id: "history-1" }),
          },
        }),
    };

    const tickets = new TicketService(
      prisma as never,
      { getScope: async () => AUTH_SCOPES.ORGANIZATION } as never,
      {
        resolveTicketSla,
        startPause: vi.fn(),
        endPause: vi.fn(),
      } as never,
      { create: vi.fn() } as never,
    );

    await tickets.reopen("ticket-1", "user-1", "org-1");

    expect(slaUpdates).toEqual([
      {
        where: { ticketId: "ticket-1" },
        data: { resolvedAt: null },
      },
    ]);
    expect(resolveTicketSla).not.toHaveBeenCalled();
  });
});
