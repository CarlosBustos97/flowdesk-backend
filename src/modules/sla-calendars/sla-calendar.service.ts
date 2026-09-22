import type { PrismaClient } from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  SlaCalendarCreateBody,
  SlaCalendarListQuery,
  SlaCalendarUpdateBody,
} from "./sla-calendar.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";

export class SlaCalendarService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(
    query: SlaCalendarListQuery,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
      ...(query.isActive !== undefined
        ? { isActive: query.isActive }
        : { isActive: true }),
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" as const },
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [slaCalendars, total] = await this.prisma.$transaction([
      this.prisma.slaCalendar.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          timezone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.slaCalendar.count({ where }),
    ]);

    return {
      slaCalendars,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    slaCalendarId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: slaCalendarId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const slaCalendar = await this.prisma.slaCalendar.findFirst({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    return slaCalendar;
  }

  async create(
    data: SlaCalendarCreateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Determinar la organización a la que pertenece el usuario
     */
    if (scope === AUTH_SCOPES.ORGANIZATION) {
      if (data.organizationId !== requesterOrganizationId)
        throw new AppError(
          403,
          "You do not have permission to create a SLA calendar for this organization",
        );
    }

    /**
     * 2. Verificar que la organización exista
     */
    const organization = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) throw new AppError(404, "Organization not found");

    /**
     * 3. Verificar que no exista una SLA calendar con el mismo nombre dentro de la organización
     */
    const normalizedName = data.name.trim();
    if (normalizedName === "")
      throw new AppError(400, "SLA calendar with this name is invalid");

    const existingSlaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        organizationId: data.organizationId,
        name: { equals: normalizedName, mode: "insensitive" as const },
      },
    });

    if (existingSlaCalendar)
      throw new AppError(409, "SLA calendar with this name already exists");

    /**
     * 4. Crear SLA calendar
     */
    const slaCalendar = await this.prisma.slaCalendar.create({
      data: {
        organizationId: data.organizationId,
        name: normalizedName,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        timezone: data.timezone,
      },
      select: {
        id: true,
        name: true,
        description: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return slaCalendar;
  }

  async update(
    slaCalendarId: string,
    data: SlaCalendarUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Veriricar que SLA calendar exista
     */
    const existingSlaCalendar = await this.prisma.slaCalendar.findFirst({
      where: {
        id: slaCalendarId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingSlaCalendar) throw new AppError(404, "SLA calendar not found");

    /**
     * 2. Si viene el nombre, verificar que no exista un registro con el mismo nombre dentro de la organización
     */
    const normalizedName =
      data.name !== undefined ? data.name.trim() : undefined;

    if (normalizedName !== undefined) {
      if (normalizedName === "")
        throw new AppError(400, "SLA calendar with this name is invalid");

      const existingSlaCalendarName = await this.prisma.slaCalendar.findFirst({
        where: {
          name: { equals: normalizedName, mode: "insensitive" as const },
          organizationId: existingSlaCalendar.organizationId,
          NOT: { id: slaCalendarId },
        },
      });

      if (existingSlaCalendarName)
        throw new AppError(409, "SLA calendar with this name already exists");
    }

    /**
     * 3. Actualizar SLA calendar
     */
    const slaCalendar = await this.prisma.slaCalendar.update({
      where: { id: slaCalendarId },
      data: {
        ...(normalizedName !== undefined ? { name: normalizedName } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        timezone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return slaCalendar;
  }
}
