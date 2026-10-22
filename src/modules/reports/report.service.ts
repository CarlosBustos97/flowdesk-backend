import {
  Priority,
  SlaStatus,
  TicketStatus,
  type PrismaClient,
} from "@prisma/client";

import type { TicketSummary } from "./report.types.js";

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * El informe es de la organización del solicitante.
   * Un rol global no amplía este resumen a otras organizaciones.
   * Los tickets CLOSED quedan fuera. ReportJob no interviene.
   */
  async ticketsSummary(requesterOrganizationId: string): Promise<TicketSummary> {
    const summary = emptySummary();

    if (!requesterOrganizationId) return summary;

    const openTickets = {
      organizationId: requesterOrganizationId,
      status: { not: TicketStatus.CLOSED },
    };

    const [statusGroups, priorityGroups, slaGroups] = await this.prisma.$transaction([
      this.prisma.ticket.groupBy({
        by: ["status"],
        where: openTickets,
        _count: { _all: true },
      }),
      this.prisma.ticket.groupBy({
        by: ["priority"],
        where: openTickets,
        _count: { _all: true },
      }),
      this.prisma.ticketSla.groupBy({
        by: ["resolutionStatus"],
        where: {
          resolutionStatus: {
            in: [SlaStatus.AT_RISK, SlaStatus.BREACHED],
          },
          ticket: openTickets,
        },
        _count: { _all: true },
      }),
    ]);

    for (const group of statusGroups) {
      if (group.status === TicketStatus.CLOSED) continue;
      summary.byStatus[group.status] = group._count._all;
    }

    for (const group of priorityGroups) {
      summary.byPriority[group.priority] = group._count._all;
    }

    for (const group of slaGroups) {
      if (
        group.resolutionStatus === SlaStatus.AT_RISK ||
        group.resolutionStatus === SlaStatus.BREACHED
      ) {
        summary.resolutionSla[group.resolutionStatus] = group._count._all;
      }
    }

    return summary;
  }
}

function emptySummary(): TicketSummary {
  return {
    byStatus: {
      [TicketStatus.OPEN]: 0,
      [TicketStatus.IN_PROGRESS]: 0,
      [TicketStatus.WAITING_CUSTOMER]: 0,
      [TicketStatus.RESOLVED]: 0,
    },
    byPriority: {
      [Priority.LOW]: 0,
      [Priority.MEDIUM]: 0,
      [Priority.HIGH]: 0,
      [Priority.URGENT]: 0,
    },
    resolutionSla: {
      [SlaStatus.AT_RISK]: 0,
      [SlaStatus.BREACHED]: 0,
    },
  };
}
