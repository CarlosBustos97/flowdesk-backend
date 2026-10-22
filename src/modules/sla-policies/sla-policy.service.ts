import type { PrismaClient } from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  PolicyUpdateBody,
  PolicyCreateBody,
  PolicyListQuery,
} from "./sla-policy.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";

export class SlaPolicyService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(
    query: PolicyListQuery,
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
      ...(query.priority ? { priority: query.priority } : {}),
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

    const [slaPolicies, total] = await this.prisma.$transaction([
      this.prisma.slaPolicy.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          firstResponseMinutes: true,
          resolutionMinutes: true,
          isActive: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          slaCalendar: {
            select: { id: true, name: true, timezone: true, isActive: true },
          },
        },
      }),
      this.prisma.slaPolicy.count({ where }),
    ]);

    return {
      slaPolicies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    slaPolicyId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: slaPolicyId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const slaPolicy = await this.prisma.slaPolicy.findFirst({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        priority: true,
        firstResponseMinutes: true,
        resolutionMinutes: true,
        isActive: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        slaCalendar: {
          select: { id: true, name: true, timezone: true, isActive: true },
        },
      },
    });

    if (!slaPolicy) throw new AppError(404, "SLA policy not found");

    return slaPolicy;
  }

  async create(
    data: PolicyCreateBody,
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
          "You do not have permission to create a SLA policy for this organization",
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
     * 3. Validar que el calendario exista y pertenezca a la organización
     */
    const slaCalendar = await this.prisma.slaCalendar.findUnique({
      where: { id: data.slaCalendarId },
    });

    if (!slaCalendar) throw new AppError(404, "SLA calendar not found");

    if (slaCalendar.organizationId !== data.organizationId)
      throw new AppError(
        409,
        "The organization entered does not match the SLA calendar organization",
      );

    /**
     * 4. Verificar que no exista una SLA policy con el mismo nombre dentro de la organización
     */
    const normalizedName = data.name.trim();
    if (normalizedName === "")
      throw new AppError(400, "SLA policy with this name is invalid");

    const existingSlaPolicy = await this.prisma.slaPolicy.findFirst({
      where: {
        organizationId: data.organizationId,
        name: { equals: normalizedName, mode: "insensitive" as const },
      },
    });

    if (existingSlaPolicy)
      throw new AppError(409, "SLA policy with this name already exists");

    /**
     * 5. Crear SLA policy
     */
    const slaPolicy = await this.prisma.$transaction(async (tx) => {
      const slaPolicy = await tx.slaPolicy.create({
        data: {
          organizationId: data.organizationId,
          name: normalizedName,
          description: data.description ?? null,
          priority: data.priority,
          firstResponseMinutes: data.firstResponseMinutes,
          resolutionMinutes: data.resolutionMinutes,
          slaCalendarId: data.slaCalendarId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          priority: true,
          firstResponseMinutes: true,
          resolutionMinutes: true,
          isActive: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          slaCalendar: {
            select: {
              businessHours: {
                select: {
                  id: true,
                  dayOfWeek: true,
                  startTime: true,
                  endTime: true,
                },
              },
            },
          },
        },
      });

      return slaPolicy;
    });

    return slaPolicy;
  }

  async update(
    slaPolicyId: string,
    data: PolicyUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que la SLA policy exista
     */
    const existingSlaPolicy = await this.prisma.slaPolicy.findFirst({
      where: {
        id: slaPolicyId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingSlaPolicy) throw new AppError(404, "SLA policy not found");

    /**
     * 2. Si viene el nombre, verificar que no exista una SLA policy con el mismo nombre dentro de la organización
     */
    const normalizedName =
      data.name !== undefined ? data.name.trim() : undefined;

    if (normalizedName !== undefined) {
      if (normalizedName === "")
        throw new AppError(400, "SLA policy with this name is invalid");

      const existingSlaPolicyName = await this.prisma.slaPolicy.findFirst({
        where: {
          name: { equals: normalizedName, mode: "insensitive" as const },
          organizationId: existingSlaPolicy.organizationId,
          NOT: { id: slaPolicyId },
        },
      });

      if (existingSlaPolicyName)
        throw new AppError(409, "SLA policy with this name already exists");
    }

    /**
     * 3. Actualizar SLA policy
     */
    const slaPolicy = await this.prisma.slaPolicy.update({
      where: { id: slaPolicyId },
      data: {
        ...(normalizedName !== undefined ? { name: normalizedName } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.firstResponseMinutes !== undefined
          ? { firstResponseMinutes: data.firstResponseMinutes }
          : {}),
        ...(data.resolutionMinutes !== undefined
          ? { resolutionMinutes: data.resolutionMinutes }
          : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        priority: true,
        firstResponseMinutes: true,
        resolutionMinutes: true,
        isActive: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return slaPolicy;
  }

  async activate(
    slaPolicyId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return await this.updateSlaPolicyStatus(
      slaPolicyId,
      true,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  async deactivate(
    slaPolicyId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return await this.updateSlaPolicyStatus(
      slaPolicyId,
      false,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  private async updateSlaPolicyStatus(
    slaPolicyId: string,
    isActive: boolean,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que la SLA policy exista
     */
    const existingSlaPolicy = await this.prisma.slaPolicy.findFirst({
      where: {
        id: slaPolicyId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingSlaPolicy) throw new AppError(404, "SLA policy not found");

    /**
     * 2. Verificar que la SLA policy no esté ya en el estado solicitado
     */
    if (existingSlaPolicy.isActive === isActive)
      throw new AppError(
        409,
        `SLA policy is already ${isActive ? "active" : "inactive"}`,
      );

    /**
     * 3. Actualizar SLA policy
     */
    const slaPolicy = await this.prisma.slaPolicy.update({
      where: { id: slaPolicyId },
      data: {
        isActive: isActive,
      },
      select: {
        id: true,
        name: true,
        description: true,
        priority: true,
        firstResponseMinutes: true,
        resolutionMinutes: true,
        isActive: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return slaPolicy;
  }
}
