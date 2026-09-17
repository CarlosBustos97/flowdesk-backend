import {
  CustomerStatus,
  SlaStatus,
  TicketStatus,
  UserStatus,
  type PrismaClient,
} from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  TicketCreateBody,
  TicketListQuery,
  TicketUpdateBody,
} from "./ticket.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import { calculateSlaDueDates } from "../sla-policies/sla-policy.calculator.js";
import type { SlaService } from "../sla-policies/sla.service.js";

export class TicketService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
    private readonly slaService: SlaService,
  ) {}

  async list(
    query: TicketListQuery,
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
      ...(query.search
        ? {
            OR: [
              {
                subject: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
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
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    };

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          openedAt: true,
          resolvedAt: true,
          closedAt: true,
          slaDueAt: true,
          firstResponseAt: true,
          createdAt: true,
          updatedAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          slaPolicy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: ticketId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const ticket = await this.prisma.ticket.findFirst({
      where,
      select: {
        id: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
        slaDueAt: true,
        firstResponseAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        project: {
          select: { id: true, name: true, description: true, priority: true },
        },
        category: { select: { id: true, name: true } },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        },
        slaPolicy: { select: { id: true, name: true } },
      },
    });

    if (!ticket) throw new AppError(404, "Ticket not found");

    return ticket;
  }

  async create(
    data: TicketCreateBody,
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
          "You do not have permission to create a ticket for this organization",
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
     * 3. Verificar que el cliente exista y este activo
     */
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: organization.id },
    });

    if (!customer) throw new AppError(404, "Customer not found");

    if (customer.status === CustomerStatus.INACTIVE)
      throw new AppError(409, "Customer is not active");

    /**
     * 4. Si el project vien, verificar que exista, pertenezca a la organización y al cliente
     */
    if (data.projectId !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: { id: data.projectId, organizationId: organization.id },
      });

      if (!project) throw new AppError(404, "Project not found");
      if (project.customerId !== customer.id)
        throw new AppError(
          409,
          "The project does not belong to the entered customer.",
        );
    }

    /**
     * 5. Si la categoría viene, verificar que exista, pertenezca a la organización y este activa
     */
    if (data.categoryId !== undefined) {
      const category = await this.prisma.ticketCategory.findFirst({
        where: { id: data.categoryId, organizationId: organization.id },
      });

      if (!category) throw new AppError(404, "Category not found");
      if (!category.isActive) throw new AppError(409, "Category is not active");
    }

    /**
     * 6. Si viene el usuario asignado, verificar que exista, pertenezca a la organización y este activo
     */
    if (data.assignedToId !== undefined) {
      const user = await this.prisma.user.findFirst({
        where: { id: data.assignedToId, organizationId: organization.id },
      });

      if (!user) throw new AppError(404, "Assigned user does not exist");
      if (user.status !== UserStatus.ACTIVE)
        throw new AppError(409, "Assigned user is not active");
    }

    /**
     * 7. Verificar que exista SLA policy, pertenezca a la organización, este activa
     * y la prioridad coincida con la del ticket
     */
    const slaPolicy = await this.prisma.slaPolicy.findFirst({
      where: { id: data.slaPolicyId, organizationId: organization.id },
      select: {
        id: true,
        priority: true,
        firstResponseMinutes: true,
        resolutionMinutes: true,
        isActive: true,
        businessHours: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
        },
      },
    });

    if (!slaPolicy) throw new AppError(404, "SLA policy not found");
    if (!slaPolicy.isActive)
      throw new AppError(409, "SLA policy is not active");
    if (slaPolicy.priority !== data.priority)
      throw new AppError(
        409,
        "The priority defined for the ticket does not match the selected SLA policy",
      );

    /**
     * 8. Crear datos fechas y datos del ticket
     */
    const openedAt = new Date();
    const { firstResponseDueAt, resolutionDueAt } = calculateSlaDueDates(
      slaPolicy,
      openedAt,
      slaPolicy.businessHours
    );

    const ticketData = {
      organizationId: organization.id,
      customerId: customer.id,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      createdById: requesterUserId,
      status: TicketStatus.OPEN,
      openedAt,
      slaDueAt: resolutionDueAt,
      slaPolicyId: slaPolicy.id,
      ...(data.projectId ? { projectId: data.projectId } : {}),
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(data.assignedToId ? { assignedToId: data.assignedToId } : {}),
    };

    /**
     * 9. Crear ticket y ticket SLA
     */
    const ticket = await this.prisma.$transaction(async (tx) => {
      const ticketCreated = await tx.ticket.create({
        data: ticketData,
        select: {
          id: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          openedAt: true,
          resolvedAt: true,
          closedAt: true,
          slaDueAt: true,
          firstResponseAt: true,
          createdAt: true,
          updatedAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          slaPolicy: { select: { id: true, name: true } },
        },
      });

      /**
       * 9.1 Crear ticket SLA
       */
      await tx.ticketSla.create({
        data: {
          ticketId: ticketCreated.id,
          slaPolicyId: slaPolicy.id,
          firstResponseDueAt,
          firstResponseStatus: SlaStatus.WITHIN_SLA,
          resolutionDueAt,
          resolutionStatus: SlaStatus.WITHIN_SLA,
        },
      });

      return ticketCreated;
    });

    return ticket;
  }

  async update(
    ticketId: string,
    data: TicketUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el ticket exista
     */
    const existingTicket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingTicket) throw new AppError(404, "Ticket not found");

    /**
     * 2. Determinar los valores finales del ticket
     */
    const finalTicket = {
      customerId: data.customerId ?? existingTicket.customerId,
      subject: data.subject ?? existingTicket.subject,
      description: data.description ?? existingTicket.description,
      projectId: data.projectId ?? existingTicket.projectId,
      categoryId: data.categoryId ?? existingTicket.categoryId,
      assignedToId: data.assignedToId ?? existingTicket.assignedToId,
    };

    /**
     * 3. Si se modifica el cliente, verificar que exista,
     *    pertenezca a la organización y esté activo
     */
    if (data.customerId !== undefined) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: finalTicket.customerId,
          organizationId: existingTicket.organizationId,
        },
      });

      if (!customer) throw new AppError(404, "Customer not found");

      if (customer.status === CustomerStatus.INACTIVE)
        throw new AppError(409, "Customer is not active");
    }

    /**
     * 4. Si se modifica el proyecto, verificar que exista,
     *    pertenezca a la organización y al cliente final
     */
    if (data.projectId !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: finalTicket.projectId!,
          organizationId: existingTicket.organizationId,
        },
      });

      if (!project) throw new AppError(404, "Project not found");

      if (project.customerId !== finalTicket.customerId)
        throw new AppError(
          409,
          "The project does not belong to the entered customer.",
        );
    }

    /**
     * 5. Si cambia el cliente pero se mantiene un proyecto,
     *    verificar que el proyecto siga perteneciendo al nuevo cliente
     */
    if (
      data.customerId !== undefined &&
      data.projectId === undefined &&
      finalTicket.projectId
    ) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: finalTicket.projectId,
          organizationId: existingTicket.organizationId,
        },
      });

      if (!project) throw new AppError(404, "Project not found");

      if (project.customerId !== finalTicket.customerId)
        throw new AppError(
          409,
          "The existing project does not belong to the new customer.",
        );
    }

    /**
     * 6. Si se modifica la categoría, verificar que exista,
     *    pertenezca a la organización y esté activa
     */
    if (data.categoryId !== undefined) {
      const category = await this.prisma.ticketCategory.findFirst({
        where: {
          id: finalTicket.categoryId!,
          organizationId: existingTicket.organizationId,
        },
      });

      if (!category) throw new AppError(404, "Category not found");

      if (!category.isActive) throw new AppError(409, "Category is not active");
    }

    /**
     * 7. Si se modifica el usuario asignado, verificar que exista,
     *    pertenezca a la organización y esté activo
     */
    if (data.assignedToId !== undefined) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: finalTicket.assignedToId!,
          organizationId: existingTicket.organizationId,
        },
      });

      if (!user) throw new AppError(404, "Assigned user does not exist");

      if (user.status !== UserStatus.ACTIVE)
        throw new AppError(409, "Assigned user is not active");
    }

    /**
     * 8. Crear datos del ticket
     *
     * SLA y prioridad no se modifican después de la creación.
     */
    const ticketData = {
      ...(data.customerId !== undefined
        ? { customerId: finalTicket.customerId }
        : {}),
      ...(data.subject !== undefined ? { subject: finalTicket.subject } : {}),
      ...(data.description !== undefined
        ? { description: finalTicket.description }
        : {}),
      ...(data.projectId !== undefined
        ? { projectId: finalTicket.projectId }
        : {}),
      ...(data.categoryId !== undefined
        ? { categoryId: finalTicket.categoryId }
        : {}),
      ...(data.assignedToId !== undefined
        ? { assignedToId: finalTicket.assignedToId }
        : {}),
    };

    /**
     * 9. Actualizar ticket
     */
    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: ticketData,
      select: {
        id: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        openedAt: true,
        resolvedAt: true,
        closedAt: true,
        slaDueAt: true,
        firstResponseAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        slaPolicy: { select: { id: true, name: true } },
      },
    });

    return ticket;
  }

  async start(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.updateStatus(
      ticketId,
      TicketStatus.IN_PROGRESS,
      requesterUserId,
      requesterOrganizationId,
      [TicketStatus.OPEN, TicketStatus.WAITING_CUSTOMER],
    );
  }

  async pending(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.updateStatus(
      ticketId,
      TicketStatus.WAITING_CUSTOMER,
      requesterUserId,
      requesterOrganizationId,
      [TicketStatus.IN_PROGRESS],
    );
  }

  async resolve(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.updateStatus(
      ticketId,
      TicketStatus.RESOLVED,
      requesterUserId,
      requesterOrganizationId,
      [TicketStatus.OPEN, TicketStatus.IN_PROGRESS],
    );
  }

  async close(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.updateStatus(
      ticketId,
      TicketStatus.CLOSED,
      requesterUserId,
      requesterOrganizationId,
      [TicketStatus.RESOLVED],
    );
  }

  async reopen(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.updateStatus(
      ticketId,
      TicketStatus.IN_PROGRESS,
      requesterUserId,
      requesterOrganizationId,
      [TicketStatus.RESOLVED],
    );
  }

  private canTransition(from: TicketStatus, to: TicketStatus) {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
      IN_PROGRESS: [TicketStatus.WAITING_CUSTOMER, TicketStatus.RESOLVED],
      WAITING_CUSTOMER: [TicketStatus.IN_PROGRESS],
      RESOLVED: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
      CLOSED: [],
    };

    const status = validTransitions[from];
    return status.includes(to);
  }

  private updateTimeStamp(
    fromStatus: TicketStatus,
    toStatus: TicketStatus,
    date: Date,
  ) {
    const timeStamp: Record<TicketStatus, object> = {
      RESOLVED: { status: toStatus, resolvedAt: date },
      IN_PROGRESS: {
        status: toStatus,
        ...(fromStatus === TicketStatus.RESOLVED ? { resolvedAt: null } : {}),
      },
      CLOSED: { status: toStatus, closedAt: date },
      WAITING_CUSTOMER: { status: toStatus },
      OPEN: { status: toStatus },
    };

    return timeStamp[toStatus] ?? {};
  }

  private async updateStatus(
    ticketId: string,
    status: TicketStatus,
    requesterUserId: string,
    requesterOrganizationId: string,
    expectedFromStatus: TicketStatus[],
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el ticket exista
     */
    const existingTicket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingTicket) throw new AppError(404, "Ticket not found");
    if (!expectedFromStatus.includes(existingTicket.status))
      throw new AppError(
        409,
        "The ticket cannot perform this operation from its current status",
      );

    /**
     * 2. Verificar que el cambio de estado sea una transición valida
     */
    if (!this.canTransition(existingTicket.status, status))
      throw new AppError(409, "The state change is not valid");

    /**
     * 3. Actualizar el ticket
     */
    const ticket = await this.prisma.$transaction(async (tx) => {
      const date = new Date();
      const updateTicket = await tx.ticket.update({
        where: { id: ticketId },
        data: this.updateTimeStamp(existingTicket.status, status, date),
        select: {
          id: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          openedAt: true,
          resolvedAt: true,
          closedAt: true,
          slaDueAt: true,
          firstResponseAt: true,
          createdAt: true,
          updatedAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          slaPolicy: { select: { id: true, name: true } },
        },
      });

      /**
       * 3.1 Si el ticket fue resuelto actualizar ticket SLA
       */
      if (updateTicket.status === TicketStatus.RESOLVED) {
        await this.slaService.resolveTicketSla(updateTicket.id, date, tx);
      }

      await tx.ticketStatusHistory.create({
        data: {
          organizationId: existingTicket.organizationId,
          ticketId: existingTicket.id,
          changedById: requesterUserId,
          fromStatus: existingTicket.status,
          toStatus: status,
          changedAt: date,
        },
      });

      if (
        existingTicket.status === TicketStatus.IN_PROGRESS &&
        status === TicketStatus.WAITING_CUSTOMER
      )
        await this.slaService.startPause(ticketId, date, tx);

      if (
        existingTicket.status === TicketStatus.WAITING_CUSTOMER &&
        status === TicketStatus.IN_PROGRESS
      )
        await this.slaService.endPause(ticketId, date, tx);

      return updateTicket;
    });

    return ticket;
  }
}
