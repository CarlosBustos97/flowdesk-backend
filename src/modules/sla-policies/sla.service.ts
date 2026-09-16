import { type PrismaClient, type Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/app-error.js";
import {
  calculateElapsedTime,
  evaluateEffectiveSlaStatus,
} from "./sla-policy.calculator.js";

export class SlaService {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluateTicketSla(ticketId: string) {
    const ticketSla = await this.prisma.ticketSla.findUnique({
      where: {
        ticketId,
      },
      include: {
        ticketSlaPauses: {
          select: {
            durationSeconds: true,
            startedAt: true,
            endedAt: true,
          },
        },
        slaPolicy: {
          select: {
            resolutionMinutes: true,
            firstResponseMinutes: true,
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
     * Calcular tiempo total pausado.
     *
     * Incluimos:
     * - pausas ya finalizadas
     * - pausa actualmente activa
     */
    const totalPausedSeconds = ticketSla.ticketSlaPauses.reduce(
      (totalDurationSeconds, pause) => {
        if (pause.durationSeconds !== null) {
          return totalDurationSeconds + Number(pause.durationSeconds);
        }

        if (!pause.endedAt) {
          const activePauseSeconds = Math.floor(
            (now.getTime() - pause.startedAt.getTime()) / 1000,
          );

          return totalDurationSeconds + activePauseSeconds;
        }

        return totalDurationSeconds;
      },
      0,
    );

    /**
     * Calcular tiempo efectivo consumido por el SLA.
     */
    const effectiveElapsed = calculateElapsedTime(
      ticketSla.ticket.openedAt,
      now,
      totalPausedSeconds,
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
            durationSeconds: true,
            startedAt: true,
            endedAt: true,
          },
        },
        slaPolicy: {
          select: {
            resolutionMinutes: true,
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
     * Calcular tiempo total pausado.
     *
     * Incluimos:
     * - pausas ya finalizadas
     * - pausa actualmente activa
     */
    const totalPausedSeconds = ticketSla.ticketSlaPauses.reduce(
      (totalDurationSeconds, pause) => {
        if (pause.durationSeconds !== null) {
          return totalDurationSeconds + Number(pause.durationSeconds);
        }

        if (!pause.endedAt) {
          const activePauseSeconds = Math.floor(
            (resolvedAt.getTime() - pause.startedAt.getTime()) / 1000,
          );

          return totalDurationSeconds + activePauseSeconds;
        }

        return totalDurationSeconds;
      },
      0,
    );

    /**
     * Calcular tiempo efectivo consumido por el Resolution SLA.
     */
    const effectiveElapsed = calculateElapsedTime(
      ticketSla.ticket.openedAt,
      resolvedAt,
      totalPausedSeconds,
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
}
