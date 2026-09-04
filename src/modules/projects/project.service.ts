import { Priority, ProjectStatus, type PrismaClient } from "@prisma/client";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  ProjectCreateBody,
  ProjectListQuery,
  ProjectUpdateBody,
} from "./projects.types.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";

export class ProjectService {
  constructor(
    private prisma: PrismaClient,
    private authorizationService: AuthorizationService,
  ) {}

  async list(query: ProjectListQuery, userId: string, organizationId: string) {
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
      ...(query.startDate ? { startDate: new Date(query.startDate) } : {}),
      ...(query.dueDate ? { dueDate: new Date(query.dueDate) } : {}),
    };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          startDate: true,
          dueDate: true,
          status: true,
          priority: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.project.count({ where }),
    ]);
    
    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    projectId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const where = {
      id: projectId,
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const project = await this.prisma.project.findFirst({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!project) throw new AppError(404, "Project not found");

    return project;
  }

  async create(
    data: ProjectCreateBody,
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
          "You do not have permission to create a project for this organization",
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
     * 3. Verificar que el cliente exista y pertenezca a la misma organización
     */
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: data.customerId,
        organizationId: data.organizationId,
      },
    });

    if (!customer) throw new AppError(404, "Customer not found");

    /**
     * 4. Verificar que no exista un proyecto con el mismo nombre dentro de la organización
     */
    const existingProject = await this.prisma.project.findFirst({
      where: {
        organizationId: data.organizationId,
        name: { contains: data.name, mode: "insensitive" as const },
      },
    });

    if (existingProject)
      throw new AppError(409, "Project with this name already exists");

    /**
     * 5. Verificar que la fecha de finalización del proyecto no sea menor a la de inicio
     */
    if (data.startDate !== undefined && data.dueDate !== undefined)
      if (new Date(data.startDate) > new Date(data.dueDate))
        throw new AppError(
          400,
          "The start date cannot exceed the project's due date.",
        );

    /**
     * 6. Crear el proyecto
     */
    const project = await this.prisma.project.create({
      data: {
        organizationId: data.organizationId,
        customerId: data.customerId,
        name: data.name,
        description: data.description ?? null,
        priority: data.priority ?? Priority.MEDIUM,
        status: ProjectStatus.PLANNED,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdById: requesterUserId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return project;
  }

  async update(
    projectId: string,
    data: ProjectUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el proyecto exista
     */
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingProject) throw new AppError(404, "Project not found");

    /**
     * 2. Si viene el cliente, verificar que exista y que pertenezca a la organización según scope
     */
    if (data.customerId !== undefined) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          id: data.customerId,
          organizationId: existingProject.organizationId
        },
      });

      if (!customer) throw new AppError(404, "Customer not found");
    }

    /**
     * 3. Si viene el nombre, verificar que no exista un proyecto con el mismo nombre dentro de la organización
     */
    if (data.name !== undefined) {
      const existingProjectName = await this.prisma.project.findFirst({
        where: {
          name: { contains: data.name, mode: "insensitive" as const },
          organizationId: existingProject.organizationId,
          NOT: { id: projectId },
        },
      });

      if (existingProjectName)
        throw new AppError(409, "Project with this name already exists");
    }

    /**
     * 4. Si viene fecha de inicio y de vencimiento, verificar que la fecha de finalización del proyecto no sea menor a la de inicio
     */
    if (data.startDate !== undefined && data.dueDate !== undefined)
      if (new Date(data.startDate) > new Date(data.dueDate))
        throw new AppError(
          400,
          "The start date cannot exceed the project's due date.",
        );

    /**
     * 5. Si viene solo fecha de inicio, verificar que no sea mayor a la fecha de finalización
     */
    if (data.startDate !== undefined && existingProject.dueDate)
      if (new Date(data.startDate) > new Date(existingProject.dueDate))
        throw new AppError(
          400,
          "The start date cannot exceed the project's due date.",
        );

    /**
     * 6. Si viene solo fecha de finalización, verificar que no sea menor a la fecha de inicio
     */
    if (data.dueDate !== undefined && existingProject.startDate)
      if (new Date(data.dueDate) < new Date(existingProject.startDate))
        throw new AppError(
          400,
          "The start date cannot exceed the project's due date.",
        );

    /** 
     * 7. Actualizar los datos del proyecto
    */
   const project = await this.prisma.project.update({
    where: {id: projectId},
    data: {
        ...(data.customerId !== undefined ? { customerId: data.customerId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.startDate !== undefined ? { startDate: new Date(data.startDate) } : {}),
        ...(data.dueDate !== undefined ? { dueDate: new Date(data.dueDate) } : {}),
    },
    select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
   });

   return project;
  }

  async activate(
    projectId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el proyecto exista
     */
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingProject) throw new AppError(404, "Project not found");

    /**
     * 2. Verificar el estado del proyecto (On hold o planned)
     */
    const status: ProjectStatus[] = [
      ProjectStatus.PLANNED,
      ProjectStatus.ON_HOLD,
    ];

    if (!status.includes(existingProject.status))
      throw new AppError(409, "Invalid project status transition");

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return project;
  }

  async hold(
    projectId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el proyecto exista
     */
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingProject) throw new AppError(404, "Project not found");

    /**
     * 2. Verificar el estado del proyecto (Active)
     */
    if (existingProject.status !== ProjectStatus.ACTIVE)
      throw new AppError(409, "Invalid project status transition");

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.ON_HOLD },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return project;
  }

  async complete(
    projectId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el proyecto exista
     */
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingProject) throw new AppError(404, "Project not found");

    /**
     * 2. Verificar el estado del proyecto (on hold o active)
     */
    const status: ProjectStatus[] = [
      ProjectStatus.ACTIVE,
      ProjectStatus.ON_HOLD,
    ];

    if (!status.includes(existingProject.status))
      throw new AppError(409, "Invalid project status transition");

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.COMPLETED },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return project;
  }

  async cancel(
    projectId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    /**
     * 1. Verificar que el proyecto exista
     */
    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!existingProject) throw new AppError(404, "Project not found");

    /**
     * 2. Verificar el estado del proyecto (on hold o active)
     */
    const status: ProjectStatus[] = [
      ProjectStatus.PLANNED,
      ProjectStatus.ACTIVE,
      ProjectStatus.ON_HOLD,
    ];

    if (!status.includes(existingProject.status))
      throw new AppError(409, "Invalid project status transition");

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.CANCELLED },
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        dueDate: true,
        status: true,
        priority: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
        customer: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return project;
  }
}
