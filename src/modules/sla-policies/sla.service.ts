import { SlaStatus, TicketStatus, type PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/app-error.js";
import { evaluateSlaStatus } from "./sla-policy.calculator.js";

export class SlaService {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluateTicketSla(ticketId: string) {
    const ticketSla = await this.prisma.ticketSla.findUnique({
      where: {
        ticketId,
      },
      include: {
        ticket: {
          select: {
            id: true,
            organizationId: true,
            status: true,
            openedAt: true,
            firstResponseAt: true,
            resolvedAt: true,
          },
        },
      },
    });

    if (!ticketSla) {
      throw new AppError(404, "Ticket SLA not found");
    }

    const now = new Date();

    let firstResponseStatus = ticketSla.firstResponseStatus;
    let resolutionStatus = ticketSla.resolutionStatus;

    /**
     * First Response SLA
     *
     * Si el ticket ya recibió respuesta, no debemos seguir
     * evaluando el SLA de primera respuesta.
     */
    if (!ticketSla.firstResponseAt && ticketSla.firstResponseDueAt) {
      firstResponseStatus = evaluateSlaStatus(
        ticketSla.ticket.openedAt,
        ticketSla.firstResponseDueAt,
        now,
      );
    }

    /**
     * Resolution SLA
     *
     * Si el ticket todavía no ha sido resuelto, evaluamos
     * el estado actual.
     */
    if (!ticketSla.resolvedAt && ticketSla.resolutionDueAt) {
      resolutionStatus = evaluateSlaStatus(
        ticketSla.ticket.openedAt,
        ticketSla.resolutionDueAt,
        now,
      );
    }

    const updatedTicketSla = await this.prisma.ticketSla.update({
      where: {
        ticketId,
      },
      data: {
        firstResponseStatus,
        resolutionStatus,
      },
    });

    return updatedTicketSla;
  }
}
