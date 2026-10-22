import {
  NotificationType,
  Prisma,
  Priority,
  TicketStatus,
  UserStatus,
  WorkflowActionType,
  WorkflowExecutionStatus,
  WorkflowOperator,
  type PrismaClient,
  type WorkflowAction,
  type WorkflowCondition,
} from "@prisma/client";

import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AuditLogService } from "../audit-logs/audit-log.service.js";
import type AuthorizationService from "../auth/authorization.service.js";
import type { NotificationService } from "../notifications/notification.service.js";
import {
  WORKFLOW_DEPTH_LIMIT,
  type TicketWorkflowActions,
  type WorkflowActionInput,
  type WorkflowConditionInput,
  type WorkflowCreateBody,
  type WorkflowDispatchContext,
  type WorkflowListQuery,
  type WorkflowTicketSnapshot,
  type WorkflowUpdateBody,
} from "./workflow.types.js";

const SUPPORTED_FIELDS = ["status", "priority", "assignedToId"] as const;
const SUPPORTED_OPERATORS = [
  WorkflowOperator.EQUALS,
  WorkflowOperator.NOT_EQUALS,
] as const;
const SUPPORTED_ACTIONS = [
  WorkflowActionType.ASSIGN_USER,
  WorkflowActionType.CHANGE_STATUS,
  WorkflowActionType.CREATE_NOTIFICATION,
] as const;

const workflowInclude = {
  conditions: true,
  actions: { orderBy: { executionOrder: "asc" as const } },
  executions: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    select: {
      id: true,
      status: true,
      error: true,
      triggerEntityType: true,
      triggerEntityId: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  },
  organization: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, name: true, email: true } },
};

type StoredWorkflow = {
  id: string;
  organizationId: string;
  name: string;
  createdById: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
};

export class WorkflowService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    query: WorkflowListQuery,
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
            name: { contains: query.search, mode: "insensitive" as const },
          }
        : {}),
    };

    const [workflows, total] = await this.prisma.$transaction([
      this.prisma.workflow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          triggerEvent: true,
          isActive: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return {
      workflows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    workflowId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.findInScope(
      workflowId,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  async create(
    data: WorkflowCreateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    if (
      scope === AUTH_SCOPES.ORGANIZATION &&
      data.organizationId !== requesterOrganizationId
    ) {
      throw new AppError(
        403,
        "You do not have permission to create a workflow for this organization",
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: data.organizationId },
      select: { id: true },
    });

    if (!organization) throw new AppError(404, "Organization not found");

    this.validateConditions(data.conditions ?? []);
    this.validateActions(data.actions);
    await this.assertNameAvailable(data.organizationId, data.name);

    return this.prisma.workflow.create({
      data: {
        organizationId: data.organizationId,
        name: data.name.trim(),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        triggerEvent: data.triggerEvent,
        createdById: requesterUserId,
        conditions: {
          create: (data.conditions ?? []).map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value: condition.value,
            logicalGroup: condition.logicalGroup ?? 0,
          })),
        },
        actions: {
          create: data.actions.map((action) => ({
            type: action.type,
            configuration: action.configuration as Prisma.InputJsonValue,
            executionOrder: action.executionOrder,
          })),
        },
      },
      include: workflowInclude,
    });
  }

  async update(
    workflowId: string,
    data: WorkflowUpdateBody,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const existing = await this.findInScope(
      workflowId,
      requesterUserId,
      requesterOrganizationId,
    );

    if (data.conditions) this.validateConditions(data.conditions);
    if (data.actions) this.validateActions(data.actions);
    if (data.name !== undefined) {
      await this.assertNameAvailable(
        existing.organizationId,
        data.name,
        existing.id,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id: existing.id },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.triggerEvent !== undefined
            ? { triggerEvent: data.triggerEvent }
            : {}),
        },
      });

      if (data.conditions) {
        await tx.workflowCondition.deleteMany({
          where: { workflowId: existing.id },
        });

        if (data.conditions.length > 0) {
          await tx.workflowCondition.createMany({
            data: data.conditions.map((condition) => ({
              workflowId: existing.id,
              field: condition.field,
              operator: condition.operator,
              value: condition.value,
              logicalGroup: condition.logicalGroup ?? 0,
            })),
          });
        }
      }

      if (data.actions) {
        await tx.workflowAction.deleteMany({
          where: { workflowId: existing.id },
        });
        await tx.workflowAction.createMany({
          data: data.actions.map((action) => ({
            workflowId: existing.id,
            type: action.type,
            configuration: action.configuration as Prisma.InputJsonValue,
            executionOrder: action.executionOrder,
          })),
        });
      }
    });

    return this.findById(
      existing.id,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  async activate(
    workflowId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.setActive(
      workflowId,
      true,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  async deactivate(
    workflowId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    return this.setActive(
      workflowId,
      false,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  /**
   * Corre las reglas activas del evento después de que el ticket ya se guardó.
   * Cada regla tiene su propia transacción de cierre. Un fallo no se relanza:
   * el ticket permanece y la ejecución queda en FAILED.
   */
  async run(
    trigger: WorkflowCreateBody["triggerEvent"],
    ticket: WorkflowTicketSnapshot,
    context: WorkflowDispatchContext,
    actions: TicketWorkflowActions,
  ) {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        organizationId: ticket.organizationId,
        isActive: true,
        triggerEvent: trigger,
      },
      include: {
        conditions: true,
        actions: { orderBy: { executionOrder: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const workflow of workflows) {
      if (context.executingIds.has(workflow.id)) continue;

      let matches = false;
      try {
        matches = this.matchesAll(workflow.conditions, ticket);
      } catch (error) {
        await this.recordFailed(
          workflow,
          ticket.id,
          error instanceof Error ? error.message : "Workflow condition failed",
        );
        continue;
      }

      if (!matches) continue;

      if (context.depth >= WORKFLOW_DEPTH_LIMIT) {
        await this.recordFailed(
          workflow,
          ticket.id,
          "Workflow depth limit reached",
        );
        continue;
      }

      await this.execute(workflow, ticket, context, actions);
    }
  }

  private async execute(
    workflow: StoredWorkflow,
    ticket: WorkflowTicketSnapshot,
    context: WorkflowDispatchContext,
    actions: TicketWorkflowActions,
  ) {
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        organizationId: workflow.organizationId,
        triggerEntityType: "ticket",
        triggerEntityId: ticket.id,
        status: WorkflowExecutionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    const executingIds = new Set(context.executingIds);
    executingIds.add(workflow.id);
    const nextContext: WorkflowDispatchContext = {
      executingIds,
      depth: context.depth + 1,
    };

    try {
      for (const action of workflow.actions) {
        await this.executeAction(action, workflow, ticket, nextContext, actions);
      }
    } catch (error) {
      await this.finish(
        execution.id,
        workflow,
        ticket.id,
        WorkflowExecutionStatus.FAILED,
        error instanceof Error ? error.message : "Workflow action failed",
      );
      return;
    }

    await this.finish(
      execution.id,
      workflow,
      ticket.id,
      WorkflowExecutionStatus.COMPLETED,
    );
  }

  private async executeAction(
    action: WorkflowAction,
    workflow: StoredWorkflow,
    ticket: WorkflowTicketSnapshot,
    context: WorkflowDispatchContext,
    actions: TicketWorkflowActions,
  ) {
    if (action.type === WorkflowActionType.ASSIGN_USER) {
      await actions.assign(
        ticket.id,
        readUserId(action.configuration),
        workflow.createdById,
        ticket.organizationId,
        context,
      );
      return;
    }

    if (action.type === WorkflowActionType.CHANGE_STATUS) {
      await actions.changeStatus(
        ticket.id,
        readStatus(action.configuration),
        workflow.createdById,
        ticket.organizationId,
        context,
      );
      return;
    }

    if (action.type === WorkflowActionType.CREATE_NOTIFICATION) {
      const userId = readUserId(action.configuration);
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          organizationId: ticket.organizationId,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!user) {
        throw new AppError(
          409,
          "Notification recipient is not an active user of the organization",
        );
      }

      await this.prisma.$transaction(async (tx) => {
        await this.notificationService.create(
          {
            organizationId: ticket.organizationId,
            userId,
            type: NotificationType.WORKFLOW_EXECUTED,
            title: "Regla ejecutada",
            message: `La regla ${workflow.name} se ha ejecutado sobre el ticket ${ticket.subject}.`,
            entityType: "ticket",
            entityId: ticket.id,
          },
          tx,
        );
      });
      return;
    }

    throw new AppError(400, "Workflow action is not supported");
  }

  private async finish(
    executionId: string,
    workflow: StoredWorkflow,
    ticketId: string,
    status: WorkflowExecutionStatus,
    error?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.workflowExecution.update({
        where: { id: executionId },
        data: {
          status,
          completedAt: new Date(),
          ...(error !== undefined ? { error } : {}),
        },
      });

      await this.auditLogService.record(
        {
          organizationId: workflow.organizationId,
          userId: workflow.createdById,
          action: "workflow.executed",
          entityType: "workflow",
          entityId: workflow.id,
          newValues: {
            status,
            ticketId,
            ...(error !== undefined ? { error } : {}),
          },
        },
        tx,
      );
    });
  }

  private async recordFailed(
    workflow: StoredWorkflow,
    ticketId: string,
    error: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.workflowExecution.create({
        data: {
          workflowId: workflow.id,
          organizationId: workflow.organizationId,
          triggerEntityType: "ticket",
          triggerEntityId: ticketId,
          status: WorkflowExecutionStatus.FAILED,
          error,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await this.auditLogService.record(
        {
          organizationId: workflow.organizationId,
          userId: workflow.createdById,
          action: "workflow.executed",
          entityType: "workflow",
          entityId: workflow.id,
          newValues: {
            status: WorkflowExecutionStatus.FAILED,
            ticketId,
            error,
          },
        },
        tx,
      );
    });
  }

  private matchesAll(
    conditions: WorkflowCondition[],
    ticket: WorkflowTicketSnapshot,
  ) {
    return conditions.every((condition) => this.matches(condition, ticket));
  }

  private matches(
    condition: WorkflowCondition,
    ticket: WorkflowTicketSnapshot,
  ) {
    if (
      !SUPPORTED_OPERATORS.includes(
        condition.operator as (typeof SUPPORTED_OPERATORS)[number],
      )
    ) {
      throw new AppError(400, "Workflow condition operator is not supported");
    }

    const actual = this.fieldValue(condition.field, ticket);
    const expected =
      condition.field === "assignedToId"
        ? normalizeAssignee(condition.value)
        : condition.value;
    const same = actual === expected;

    return condition.operator === WorkflowOperator.EQUALS ? same : !same;
  }

  private fieldValue(field: string, ticket: WorkflowTicketSnapshot) {
    if (field === "status") return ticket.status;
    if (field === "priority") return ticket.priority;
    if (field === "assignedToId") return ticket.assignedToId;
    throw new AppError(400, "Workflow condition field is not supported");
  }

  private validateConditions(conditions: WorkflowConditionInput[]) {
    for (const condition of conditions) {
      if (
        !SUPPORTED_FIELDS.includes(
          condition.field as (typeof SUPPORTED_FIELDS)[number],
        )
      ) {
        throw new AppError(400, "Workflow condition field is not supported");
      }

      if (
        !SUPPORTED_OPERATORS.includes(
          condition.operator as (typeof SUPPORTED_OPERATORS)[number],
        )
      ) {
        throw new AppError(400, "Workflow condition operator is not supported");
      }

      if (
        condition.field === "status" &&
        !Object.values(TicketStatus).includes(condition.value as TicketStatus)
      ) {
        throw new AppError(400, "Workflow condition value is not a valid status");
      }

      if (
        condition.field === "priority" &&
        !Object.values(Priority).includes(condition.value as Priority)
      ) {
        throw new AppError(
          400,
          "Workflow condition value is not a valid priority",
        );
      }
    }
  }

  private validateActions(actions: WorkflowActionInput[]) {
    if (actions.length === 0) {
      throw new AppError(400, "Workflow requires at least one action");
    }

    for (const action of actions) {
      if (
        !SUPPORTED_ACTIONS.includes(
          action.type as (typeof SUPPORTED_ACTIONS)[number],
        )
      ) {
        throw new AppError(400, "Workflow action is not supported");
      }

      if (
        action.type === WorkflowActionType.ASSIGN_USER ||
        action.type === WorkflowActionType.CREATE_NOTIFICATION
      ) {
        readUserId(action.configuration as Prisma.JsonValue);
      }

      if (action.type === WorkflowActionType.CHANGE_STATUS) {
        readStatus(action.configuration as Prisma.JsonValue);
      }
    }
  }

  private async assertNameAvailable(
    organizationId: string,
    name: string,
    currentId?: string,
  ) {
    const existing = await this.prisma.workflow.findFirst({
      where: {
        organizationId,
        name: { equals: name.trim(), mode: "insensitive" },
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      select: { id: true },
    });

    if (existing) throw new AppError(409, "Workflow name already exists");
  }

  private async setActive(
    workflowId: string,
    isActive: boolean,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const existing = await this.findInScope(
      workflowId,
      requesterUserId,
      requesterOrganizationId,
    );

    await this.prisma.workflow.update({
      where: { id: existing.id },
      data: { isActive },
    });

    return this.findById(
      existing.id,
      requesterUserId,
      requesterOrganizationId,
    );
  }

  private async findInScope(
    workflowId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
      include: workflowInclude,
    });

    if (!workflow) throw new AppError(404, "Workflow not found");

    return workflow;
  }
}

function readUserId(configuration: Prisma.JsonValue) {
  if (!isRecord(configuration) || typeof configuration.userId !== "string") {
    throw new AppError(400, "Workflow action configuration is invalid");
  }

  const userId = configuration.userId.trim();
  if (!userId) {
    throw new AppError(400, "Workflow action configuration is invalid");
  }

  return userId;
}

function readStatus(configuration: Prisma.JsonValue) {
  if (!isRecord(configuration) || typeof configuration.status !== "string") {
    throw new AppError(400, "Workflow action configuration is invalid");
  }

  if (!Object.values(TicketStatus).includes(configuration.status as TicketStatus)) {
    throw new AppError(400, "Workflow action configuration is invalid");
  }

  return configuration.status as TicketStatus;
}

function isRecord(
  value: Prisma.JsonValue,
): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAssignee(value: string) {
  if (value === "" || value === "null") return null;
  return value;
}
