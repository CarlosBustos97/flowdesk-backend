import { CustomerStatus, type PrismaClient } from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  CustomerCreateBody,
  CustomerListQuery,
  CustomerUpdateBody,
} from "./customer.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";

export class CustomerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async list(query: CustomerListQuery, userId: string, organizationId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const scope = await this.authorizationService.getScope(userId);

    const where = {
      ...(scope === AUTH_SCOPES.ORGANIZATION ? { organizationId } : {}),

      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" as const },
              },
              {
                email: { contains: query.search, mode: "insensitive" as const },
              },
              {
                phone: { contains: query.search, mode: "insensitive" as const },
              },
              {
                company: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          status: true,
          address: true,
          notes: true,
          createdAt: true,
          deletedAt: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    targetCustomerId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: targetCustomerId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const customer = await this.prisma.customer.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        address: true,
        notes: true,
        createdAt: true,
        deletedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!customer) throw new AppError(404, "Customer not found");

    return customer;
  }

  async create(
    data: CustomerCreateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Determinar la organización a la que pertenece el usuario solicitante..
     */

    let organizationId = data.organizationId;

    if (scope === AUTH_SCOPES.ORGANIZATION) {
      if (data.organizationId !== requesterOrganizationId) {
        throw new AppError(
          403,
          "You do not have permission to create a customer for this organization",
        );
      }
    }

    /*
     * 2. Verificar que la organización exista.
     */
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
    });

    if (!organization) throw new AppError(404, "Organization not found");

    /*
     * 3. Verificar que el cliente no exista en la organziación.
     */
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        name: data.name,
        organizationId: organizationId,
      },
    });

    if (existingCustomer) throw new AppError(409, "Customer already exists");

    /**
     * 4. Crear el cliente.
     */

    const customer = await this.prisma.customer.create({
      data: {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        company: data.company ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        organizationId: organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        address: true,
        notes: true,
        createdAt: true,
        deletedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return customer;
  }

  async update(
    customerId: string,
    data: CustomerUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el cliente exista.
     */
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingCustomer) throw new AppError(404, "Customer not found");

    /**
     * 2. Si viene el nombre del cliente, verificar que no exista otro cliente con el mismo nombre en la organización.
     */
    if (data.name !== undefined) {
      const existingCustomerName = await this.prisma.customer.findFirst({
        where: {
          name: data.name,
          organizationId: existingCustomer.organizationId,
          NOT: {
            id: customerId,
          },
        },
      });

      if (existingCustomerName) {
        throw new AppError(409, "Customer with this name already exists");
      }
    }

    /**
     * 3. Actualizar el cliente.
     */
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.company !== undefined ? { company: data.company } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        address: true,
        notes: true,
        createdAt: true,
        deletedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return customer;
  }

  async disable(
    customerId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el cliente exista.
     */
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingCustomer) throw new AppError(404, "Customer not found");
    if (existingCustomer.status === CustomerStatus.INACTIVE)
      throw new AppError(409, "Customer is already inactive");

    /**
     * 2. Deshabilitar el cliente.
     */
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { status: CustomerStatus.INACTIVE, deletedAt: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        address: true,
        notes: true,
        createdAt: true,
        deletedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return customer;
  }

  async enable(
    customerId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el cliente exista.
     */
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingCustomer) throw new AppError(404, "Customer not found");
    if (existingCustomer.status === CustomerStatus.ACTIVE)
      throw new AppError(409, "Customer is already active");

    /**
     * 2. Habilitar el cliente.
     */
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { status: CustomerStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        status: true,
        address: true,
        notes: true,
        createdAt: true,
        deletedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return customer;
  }
}
