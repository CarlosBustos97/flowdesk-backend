import type AuthorizationService from "../../auth/authorization.service.js";
import { AUTH_SCOPES } from "../../../common/auth/auth-scope.js";
import type { SlaHolidayCreateBody } from "./sla-holiday.types.js";
import { AppError } from "../../../common/errors/app-error.js";
import { Prisma, type PrismaClient } from "@prisma/client";

export class SlaHolidayService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(id: string, requestUserId: string, requestOrganizationId: string) {
    const scope = await this.authorizationService.getScope(requestUserId);

    const slaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        id,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requestOrganizationId }
          : {}),
      },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    const slaHolidays = await this.prisma.slaHoliday.findMany({
      where: {
        slaCalendarId: id,
      },
      orderBy: {
        date: "asc",
      },
    });

    return slaHolidays;
  }

  async create(
    id: string,
    data: SlaHolidayCreateBody,
    requestUserId: string,
    requestOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requestUserId);

    /**
     * 1. Verificar que el calendario existe
     */
    const slaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        id,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requestOrganizationId }
          : {}),
      },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    /**
     * 2. Verificar que la fecha no exista ya en el calendario
     *    (no se pueden tener dos feriados en la misma fecha dentro del mismo calendario)
     */
    const date = this.parseHolidayDate(data.date);
    const existingHoliday = await this.prisma.slaHoliday.findFirst({
      where: {
        slaCalendarId: id,
        date,
      },
    });

    if (existingHoliday) {
      throw new AppError(409, "Holiday already exists for this date");
    }
    /**
     * 3. Crear el feriado
     */

    try {
      const slaHoliday = await this.prisma.slaHoliday.create({
        data: {
          date,
          name: data.name,
          slaCalendarId: id,
        },
      });

      return slaHoliday;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(409, "Holiday already exists for this date");
      }

      throw error;
    }
  }

  async delete(
    id: string,
    holidayId: string,
    requestUserId: string,
    requestOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requestUserId);

    /**
     * 1. Verificar que el calendario existe
     */
    const slaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        id,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requestOrganizationId }
          : {}),
      },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    /**
     * 2. Verificar que el feriado pertenece al calendario
     */
    const slaHoliday = await this.prisma.slaHoliday.findFirst({
      where: {
        id: holidayId,
        slaCalendarId: id,
      },
    });

    if (!slaHoliday) throw new AppError(404, "Holiday not found");

    /**
     * 3. Eliminar el feriado
     */
    await this.prisma.slaHoliday.delete({
      where: {
        id: holidayId,
      },
    });
  }

  private parseHolidayDate(date: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match)
      throw new AppError(400, "Invalid date format. Expected YYYY-MM-DD");

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    // Comprobar que la fecha realmente exista.
    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    )
      throw new AppError(400, "Invalid calendar date");

    return parsedDate;
  }
}
