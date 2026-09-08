import type { PrismaClient } from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  TicketCategoryCreateBody,
  TicketCategoryListQuery,
  TicketcategoryUpdateBody,
} from "./ticket-category.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";

export class TicketCategoryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(
    query: TicketCategoryListQuery,
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

    const [ticketCategories, total] = await this.prisma.$transaction([
      this.prisma.ticketCategory.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          isActive: true,
          description: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.ticketCategory.count({ where }),
    ]);

    return {
      ticketCategories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    ticketCategoryId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: ticketCategoryId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const ticketCategory = await this.prisma.ticketCategory.findFirst({
      where,
      select: {
        id: true,
        name: true,
        isActive: true,
        description: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!ticketCategory) throw new AppError(404, "Category not found");

    return ticketCategory;
  }

  async create(
    data: TicketCategoryCreateBody,
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
          "You do not have permission to create a Category for this organization",
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
     * 3. Verificar que no exista una categoría con el mismo nombre dentro de la organización
     */
    const normalizedName = data.name.trim();
    if (normalizedName === "")
      throw new AppError(400, "Category with this name is invalid");

    const existingTicketCategory = await this.prisma.ticketCategory.findFirst({
      where: {
        organizationId: data.organizationId,
        name: { equals: normalizedName, mode: "insensitive" as const },
      },
    });

    if (existingTicketCategory)
      throw new AppError(409, "Category with this name already exists");

    /**
     * 4. Crear categoría
     */
    const ticketCategory = await this.prisma.ticketCategory.create({
      data: {
        organizationId: data.organizationId,
        name: normalizedName,
        description: data.description ?? null,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        description: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return ticketCategory;
  }

  async update(
    ticketCategoryId: string,
    data: TicketcategoryUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que la categoría exista
     */
    const existingTicketCategory = await this.prisma.ticketCategory.findFirst({
      where: {
        id: ticketCategoryId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingTicketCategory) throw new AppError(404, "Category not found");

    /**
     * 2. Si viene el nombre, verificar que no exista una categoría con el mismo nombre dentro de la organización
     */
    const normalizedName =
      data.name !== undefined ? data.name.trim() : undefined;
    if (normalizedName !== undefined) {
      if (normalizedName === "")
        throw new AppError(400, "Category with this name is invalid");

      const existingTicketCategoryName =
        await this.prisma.ticketCategory.findFirst({
          where: {
            name: { equals: normalizedName, mode: "insensitive" as const },
            organizationId: existingTicketCategory.organizationId,
            NOT: { id: ticketCategoryId },
          },
        });

      if (existingTicketCategoryName)
        throw new AppError(409, "Category with this name already exists");
    }

    /**
     * 3. Actualizar categoría
     */
    const ticketCategory = await this.prisma.ticketCategory.update({
      where: { id: ticketCategoryId },
      data: {
        ...(normalizedName !== undefined ? { name: normalizedName } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        description: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return ticketCategory;
  }

  async activate(
    ticketCategoryId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return await this.updateTicketCategoryStatus(
      ticketCategoryId,
      true,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  async deactivate(
    ticketCategoryId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return await this.updateTicketCategoryStatus(
      ticketCategoryId,
      false,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  private async updateTicketCategoryStatus(
    ticketCategoryId: string,
    isActive: boolean,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que la categoría exista
     */
    const existingTicketCategory = await this.prisma.ticketCategory.findFirst({
      where: {
        id: ticketCategoryId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingTicketCategory) throw new AppError(404, "Category not found");

    /**
     * 2. Verificar que la categoría no esté ya en el estado solicitado
     */
    if (existingTicketCategory.isActive === isActive)
      throw new AppError(
        409,
        `Category is already ${isActive ? "active" : "inactive"}`,
      );

    /**
     * 3. Actualizar categoría
     */
    const ticketCategory = await this.prisma.ticketCategory.update({
      where: { id: ticketCategoryId },
      data: {
        isActive: isActive,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        description: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return ticketCategory;
  }
}
