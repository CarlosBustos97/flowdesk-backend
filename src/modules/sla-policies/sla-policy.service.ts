import type { PrismaClient } from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  PolicyUpdateBody,
  PolicyCreateBody,
  PolicyListQuery,
  PolicyShowParams,
} from "./sla-policy.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import { DEFAULT_SLA_BUSINESS_HOURS } from "./sla-business-hours.defaults.js";

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
     * 3. Verificar que no exista una SLA policy con el mismo nombre dentro de la organización
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
     * 4. Si viene businessHours, validar que sean correctos
     * sino dejar el que se definio por defecto
     */
    const businessHours =
      data.businessHours !== undefined
        ? data.businessHours
        : DEFAULT_SLA_BUSINESS_HOURS;

    if (businessHours.length === 0)
      throw new AppError(400, "Invalid business hours format");

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
          "The start time for business hours cannot be later than the end time",
        );

      days.add(businessHour.dayOfWeek);
    }

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
          businessHours: { create: businessHours },
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
          businessHours: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
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
