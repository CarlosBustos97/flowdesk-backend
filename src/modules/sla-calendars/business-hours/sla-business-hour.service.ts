import type { PrismaClient } from "@prisma/client";
import type AuthorizationService from "../../auth/authorization.service.js";
import { AUTH_SCOPES } from "../../../common/auth/auth-scope.js";
import { AppError } from "../../../common/errors/app-error.js";
import { DEFAULT_SLA_BUSINESS_HOURS } from "../../sla-policies/sla-business-hours.defaults.js";
import type { SlaBusinessHoursUpdateBody } from "./sla-business-hour.types.js";

export class SlaBusinessHourService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(
    slaCalendarId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const slaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        id: slaCalendarId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    const slaBusinessHour = await this.prisma.slaBusinessHour.findMany({
      where: {
        slaCalendarId: slaCalendarId,
      },
      orderBy: { dayOfWeek: "asc" },
    });

    return slaBusinessHour;
  }

  async update(
    slaCalendarId: string,
    data: SlaBusinessHoursUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el calendario existe
     */
    const slaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        id: slaCalendarId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    /**
     * 2. Verificar que businessHours sea valido
     */
    const businessHours =
      data.businessHours.length === 0
        ? DEFAULT_SLA_BUSINESS_HOURS
        : data.businessHours;

    const days = new Set();

    for (const businessHour of businessHours) {
      if (days.has(businessHour.dayOfWeek))
        throw new AppError(
          409,
          "The business hours must be unique; they cannot be repeated",
        );

      if (businessHour.startTime >= businessHour.endTime)
        throw new AppError(
          409,
          "The start time must be earlier than the end time",
        );

      days.add(businessHour.dayOfWeek);
    }

    /**
     * 3. Agregar el id de SLA calendar
     */
    const businessHourData = businessHours.map((businessHour) => ({
      ...businessHour,
      slaCalendarId,
    }));

    /**
     * 3. Actualizar businessHours
     */
    const slaBusinessHours = await this.prisma.$transaction(async (tx) => {
      await tx.slaBusinessHour.deleteMany({
        where: { slaCalendarId },
      });

      await tx.slaBusinessHour.createMany({
        data: businessHourData,
      });

      return tx.slaBusinessHour.findMany({
        where: { slaCalendarId },
        orderBy: { dayOfWeek: "asc" },
      });
    });

    return slaBusinessHours;
  }
}
