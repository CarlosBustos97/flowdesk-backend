import { type PrismaClient, type Prisma, TicketStatus } from "@prisma/client";

import { AppError } from "../../common/errors/app-error.js";
import {
  evaluateEffectiveSlaStatus,
} from "./sla-policy.calculator.js";
import { calculateElapsedWorkTime } from "./sla-business-hours.calculator.js";
import { SlaSweepError, type SlaSweepFailure } from "./sla-sweep.error.js";

export class SlaService {
  constructor(private readonly prisma: PrismaClient) { }

  async evaluateTicketSla(ticketId: string) {
    const ticketSla = await this.prisma.ticketSla.findUnique({
      where: {
        ticketId,
      },
      include: {
        ticketSlaPauses: {
          select: {
            startedAt: true,
            endedAt: true,
          },
        },
        slaPolicy: {
          select: {
            resolutionMinutes: true,
            firstResponseMinutes: true,
            slaCalendar: {
              select: {
                timezone: true,
                businessHours: {
                  select: {
                    dayOfWeek: true,
                    startTime: true,
                    endTime: true,
                  },
                },
                holidays: {
                  select: {
                    date: true,
                  },
                },
              },
            },
          },
        },
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

    /**
     * Calcular tiempo efectivo consumido por el SLA.
     */
    const effectiveElapsed = calculateElapsedWorkTime(
      ticketSla.ticket.openedAt,
      now,
      ticketSla.ticketSlaPauses,
      ticketSla.slaPolicy.slaCalendar.businessHours,
      ticketSla.slaPolicy.slaCalendar.holidays,
      ticketSla.slaPolicy.slaCalendar.timezone,
    );

    let firstResponseStatus = ticketSla.firstResponseStatus;
    let resolutionStatus = ticketSla.resolutionStatus;

    /**
     * First Response SLA
     *
     * Si el ticket ya recibió respuesta, no seguimos
     * evaluando este SLA.
     */
    if (!ticketSla.firstResponseAt) {
      firstResponseStatus = evaluateEffectiveSlaStatus(
        effectiveElapsed,
        ticketSla.slaPolicy.firstResponseMinutes,
      );
    }

    /**
     * Resolution SLA
     *
     * Si el ticket todavía no ha sido resuelto,
     * evaluamos utilizando el tiempo efectivo,
     * descontando las pausas.
     */
    if (!ticketSla.resolvedAt && ticketSla.resolutionDueAt) {
      resolutionStatus = evaluateEffectiveSlaStatus(
        effectiveElapsed,
        ticketSla.slaPolicy.resolutionMinutes,
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

  async startPause(
    ticketId: string,
    startedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const ticketSla = await tx.ticketSla.findUnique({
      where: {
        ticketId,
      },
    });

    if (!ticketSla) throw new AppError(404, "Ticket SLA not found");

    // Buscar si ya existe una pausa abierta
    const activePause = await tx.ticketSlaPause.findFirst({
      where: {
        ticketSlaId: ticketSla.id,
        endedAt: null,
      },
    });

    if (activePause) {
      return activePause;
    }

    return tx.ticketSlaPause.create({
      data: {
        ticketSlaId: ticketSla.id,
        startedAt,
      },
    });
  }

  async endPause(
    ticketId: string,
    endedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const ticketSla = await tx.ticketSla.findUnique({
      where: { ticketId },
    });

    if (!ticketSla) throw new AppError(404, "Ticket SLA not found");

    // Buscar si ya existe una pausa abierta
    const activePause = await tx.ticketSlaPause.findFirst({
      where: {
        ticketSlaId: ticketSla.id,
        endedAt: null,
      },
    });

    if (!activePause)
      throw new AppError(409, "Active ticket SLA pause not found");

    const startedAt = new Date(activePause.startedAt);
    const durationSecond = BigInt(
      Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
    );

    return tx.ticketSlaPause.update({
      where: { id: activePause.id },
      data: {
        durationSeconds: durationSecond,
        endedAt: endedAt,
      },
    });
  }

  async resolveTicketSla(
    ticketId: string,
    resolvedAt: Date,
    tx: Prisma.TransactionClient,
  ) {
    const ticketSla = await tx.ticketSla.findUnique({
      where: {
        ticketId,
      },
      include: {
        ticketSlaPauses: {
          select: {
            startedAt: true,
            endedAt: true,
          },
        },
        slaPolicy: {
          select: {
            resolutionMinutes: true,
            slaCalendar: {
              select: {
                timezone: true,
                businessHours: {
                  select: {
                    dayOfWeek: true,
                    startTime: true,
                    endTime: true,
                  },
                },
                holidays: {
                  select: {
                    date: true,
                  },
                },
              },
            },
          },
        },
        ticket: {
          select: {
            openedAt: true,
          },
        },
      },
    });

    if (!ticketSla) {
      throw new AppError(404, "Ticket SLA not found");
    }

    /**
     * Evitar resolver nuevamente un TicketSla
     * que ya fue marcado como resuelto.
     */
    if (ticketSla.resolvedAt) {
      return ticketSla;
    }

    /**
     * Calcular tiempo efectivo consumido por el Resolution SLA.
     */
    const effectiveElapsed = calculateElapsedWorkTime(
      ticketSla.ticket.openedAt,
      resolvedAt,
      ticketSla.ticketSlaPauses,
      ticketSla.slaPolicy.slaCalendar.businessHours,
      ticketSla.slaPolicy.slaCalendar.holidays,
      ticketSla.slaPolicy.slaCalendar.timezone,
    );

    /**
     * Evaluar Resolution SLA utilizando el tiempo efectivo,
     * descontando las pausas.
     */
    const resolutionStatus = evaluateEffectiveSlaStatus(
      effectiveElapsed,
      ticketSla.slaPolicy.resolutionMinutes,
    );

    return tx.ticketSla.update({
      where: {
        ticketId,
      },
      data: {
        resolvedAt,
        resolutionStatus,
      },
    });
  }



  async evaluateDueTicketSlas(): Promise<number> {
    let lastId: string | undefined;
    let processed = 0;
    const failures: SlaSweepFailure[] = [];

    while (true) {
      const ticketSlas = await this.prisma.ticketSla.findMany({
        where: {
          OR: [
            { firstResponseAt: null },
            {
              resolvedAt: null,
              resolutionDueAt: { not: null },
            },
          ],
          ticket: {
            is: {
              status: { not: TicketStatus.CLOSED },
            },
          },
        },
        orderBy: { id: "asc" },
        ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}),
        take: 100,
      });

      if (ticketSlas.length === 0) {
        break;
      }

      for (const ticketSla of ticketSlas) {
        try {
          await this.evaluateTicketSla(ticketSla.ticketId);
          processed++;
        } catch (error) {
          failures.push({
            ticketId: ticketSla.ticketId,
            slaId: ticketSla.id,
            error,
          });
        }
      }

      if (ticketSlas.length < 100) {
        break;
      }

      const lastTicketSla = ticketSlas.at(-1);
      if (!lastTicketSla) {
        break;
      }
      lastId = lastTicketSla.id;
    }

    if (failures.length > 0) {
      throw new SlaSweepError(processed, failures);
    }

    return processed;
  }


}
