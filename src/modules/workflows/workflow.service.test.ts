import {
  Priority,
  TicketStatus,
  WorkflowActionType,
  WorkflowExecutionStatus,
  WorkflowOperator,
  WorkflowTriggerEvent,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { AppError } from "../../common/errors/app-error.js";
import type { AuditLogService } from "../audit-logs/audit-log.service.js";
import type AuthorizationService from "../auth/authorization.service.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { WorkflowService } from "./workflow.service.js";
import {
  rootWorkflowContext,
  type TicketWorkflowActions,
  type WorkflowDispatchContext,
  type WorkflowTicketSnapshot,
} from "./workflow.types.js";

type StoredWorkflow = {
  id: string;
  organizationId: string;
  name: string;
  createdById: string;
  isActive: boolean;
  triggerEvent: WorkflowTriggerEvent;
  createdAt: string;
  conditions: Array<{
    field: string;
    operator: WorkflowOperator;
    value: string;
    logicalGroup: number;
  }>;
  actions: Array<{
    type: WorkflowActionType;
    configuration: Record<string, unknown>;
    executionOrder: number;
  }>;
};

type StoredExecution = {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  error?: string;
};

function ticket(
  overrides: Partial<WorkflowTicketSnapshot> = {},
): WorkflowTicketSnapshot {
  return {
    id: "ticket-1",
    organizationId: "org-1",
    status: TicketStatus.OPEN,
    priority: Priority.URGENT,
    assignedToId: null,
    subject: "Impresora",
    ...overrides,
  };
}

function workflow(overrides: Partial<StoredWorkflow> = {}): StoredWorkflow {
  return {
    id: "workflow-1",
    organizationId: "org-1",
    name: "Urgentes",
    createdById: "user-1",
    isActive: true,
    triggerEvent: WorkflowTriggerEvent.TICKET_RESOLVED,
    createdAt: "2026-01-01T00:00:00.000Z",
    conditions: [],
    actions: [
      {
        type: WorkflowActionType.ASSIGN_USER,
        configuration: { userId: "user-2" },
        executionOrder: 1,
      },
    ],
    ...overrides,
  };
}

function harness(stored: StoredWorkflow[]) {
  const executions: StoredExecution[] = [];
  const audits: Array<{ action: string; newValues?: { status?: string } }> = [];
  const assignments: string[] = [];

  const db = {
    workflow: {
      findMany: async (args: {
        where: {
          organizationId: string;
          isActive: boolean;
          triggerEvent: WorkflowTriggerEvent;
        };
      }) =>
        stored
          .filter(
            (item) =>
              item.organizationId === args.where.organizationId &&
              item.isActive === args.where.isActive &&
              item.triggerEvent === args.where.triggerEvent,
          )
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      findFirst: async () => null,
    },
    organization: {
      findUnique: async () => ({ id: "org-1" }),
    },
    workflowExecution: {
      create: async (args: { data: StoredExecution }) => {
        const row = {
          id: `exec-${executions.length + 1}`,
          ...args.data,
        };
        executions.push(row);
        return row;
      },
      update: async (args: {
        where: { id: string };
        data: { status: WorkflowExecutionStatus; error?: string };
      }) => {
        const row = executions.find((item) => item.id === args.where.id);
        if (!row) throw new Error("execution missing");
        row.status = args.data.status;
        row.error = args.data.error;
        return row;
      },
    },
    $transaction: async (
      callback: (tx: typeof db) => Promise<unknown>,
    ) => callback(db),
  };

  const service = new WorkflowService(
    db as unknown as PrismaClient,
    { getScope: async () => "GLOBAL" } as unknown as AuthorizationService,
    { create: async () => ({ id: "notification-1" }) } as unknown as NotificationService,
    {
      record: async (data: { action: string; newValues?: { status?: string } }) => {
        audits.push(data);
        return { id: "audit-1" };
      },
    } as unknown as AuditLogService,
  );

  return { service, executions, audits, assignments };
}

describe("workflows", () => {
  it("no actúa cuando la condición no coincide", async () => {
    const { service, executions, assignments } = harness([
      workflow({
        conditions: [
          {
            field: "priority",
            operator: WorkflowOperator.EQUALS,
            value: Priority.URGENT,
            logicalGroup: 0,
          },
        ],
      }),
    ]);

    await service.run(
      WorkflowTriggerEvent.TICKET_RESOLVED,
      ticket({ priority: Priority.MEDIUM }),
      rootWorkflowContext(),
      actions(assignments),
    );

    expect(assignments).toEqual([]);
    expect(executions).toEqual([]);
  });

  it("exige que todas las condiciones se cumplan aunque el grupo lógico sea distinto", async () => {
    const { service, assignments } = harness([
      workflow({
        conditions: [
          {
            field: "priority",
            operator: WorkflowOperator.EQUALS,
            value: Priority.URGENT,
            logicalGroup: 0,
          },
          {
            field: "status",
            operator: WorkflowOperator.EQUALS,
            value: TicketStatus.RESOLVED,
            logicalGroup: 1,
          },
        ],
      }),
    ]);

    await service.run(
      WorkflowTriggerEvent.TICKET_RESOLVED,
      ticket({ status: TicketStatus.IN_PROGRESS }),
      rootWorkflowContext(),
      actions(assignments),
    );

    expect(assignments).toEqual([]);
  });

  it("asigna al usuario cuando la condición se cumple", async () => {
    const { service, executions, audits, assignments } = harness([
      workflow({
        conditions: [
          {
            field: "priority",
            operator: WorkflowOperator.EQUALS,
            value: Priority.URGENT,
            logicalGroup: 0,
          },
        ],
      }),
    ]);

    await service.run(
      WorkflowTriggerEvent.TICKET_RESOLVED,
      ticket(),
      rootWorkflowContext(),
      actions(assignments),
    );

    expect(assignments).toEqual(["user-2"]);
    expect(executions[0]?.status).toBe(WorkflowExecutionStatus.COMPLETED);
    expect(audits[0]?.action).toBe("workflow.executed");
    expect(audits[0]?.newValues?.status).toBe(WorkflowExecutionStatus.COMPLETED);
  });

  it("deja la ejecución en FAILED si el cambio de estado no es válido", async () => {
    const { service, executions, assignments } = harness([
      workflow({
        actions: [
          {
            type: WorkflowActionType.CHANGE_STATUS,
            configuration: { status: TicketStatus.CLOSED },
            executionOrder: 1,
          },
        ],
      }),
    ]);

    await service.run(
      WorkflowTriggerEvent.TICKET_RESOLVED,
      ticket(),
      rootWorkflowContext(),
      {
        assign: async () => {
          assignments.push("no");
        },
        changeStatus: async () => {
          throw new AppError(409, "The state change is not valid");
        },
      },
    );

    expect(assignments).toEqual([]);
    expect(executions[0]?.status).toBe(WorkflowExecutionStatus.FAILED);
    expect(executions[0]?.error).toBe("The state change is not valid");
  });

  it("no vuelve a ejecutar el mismo workflow cuando la acción reentra", async () => {
    let calls = 0;
    const { service, executions } = harness([
      workflow({
        id: "workflow-loop",
        triggerEvent: WorkflowTriggerEvent.TICKET_STATUS_CHANGED,
        actions: [
          {
            type: WorkflowActionType.CHANGE_STATUS,
            configuration: { status: TicketStatus.WAITING_CUSTOMER },
            executionOrder: 1,
          },
        ],
      }),
    ]);

    const reentrant: TicketWorkflowActions = {
      assign: async () => undefined,
      changeStatus: async (_ticketId, status, _actor, _org, context) => {
        calls += 1;
        await service.run(
          WorkflowTriggerEvent.TICKET_STATUS_CHANGED,
          ticket({ status }),
          context,
          reentrant,
        );
      },
    };

    await service.run(
      WorkflowTriggerEvent.TICKET_STATUS_CHANGED,
      ticket(),
      rootWorkflowContext(),
      reentrant,
    );

    expect(calls).toBe(1);
    expect(executions).toHaveLength(1);
    expect(executions[0]?.status).toBe(WorkflowExecutionStatus.COMPLETED);
  });

  it("sigue con la siguiente regla cuando la primera falla", async () => {
    const { service, executions, assignments } = harness([
      workflow({
        id: "workflow-falla",
        createdAt: "2026-01-01T00:00:00.000Z",
        actions: [
          {
            type: WorkflowActionType.CHANGE_STATUS,
            configuration: { status: TicketStatus.CLOSED },
            executionOrder: 1,
          },
        ],
      }),
      workflow({
        id: "workflow-sigue",
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
    ]);

    await service.run(
      WorkflowTriggerEvent.TICKET_RESOLVED,
      ticket(),
      rootWorkflowContext(),
      {
        assign: async (_ticketId, userId) => {
          assignments.push(userId);
        },
        changeStatus: async () => {
          throw new AppError(409, "The state change is not valid");
        },
      },
    );

    expect(executions.map((item) => item.status)).toEqual([
      WorkflowExecutionStatus.FAILED,
      WorkflowExecutionStatus.COMPLETED,
    ]);
    expect(assignments).toEqual(["user-2"]);
  });

  it("corta a profundidad 3 sin ejecutar la acción", async () => {
    const { service, executions, assignments } = harness([workflow()]);
    const context: WorkflowDispatchContext = {
      executingIds: new Set(),
      depth: 3,
    };

    await service.run(
      WorkflowTriggerEvent.TICKET_RESOLVED,
      ticket(),
      context,
      actions(assignments),
    );

    expect(assignments).toEqual([]);
    expect(executions[0]?.status).toBe(WorkflowExecutionStatus.FAILED);
    expect(executions[0]?.error).toBe("Workflow depth limit reached");
  });

  it("rechaza al crear una acción que esta versión no ejecuta", async () => {
    const { service } = harness([]);

    await expect(
      service.create(
        {
          organizationId: "org-1",
          name: "Correo",
          triggerEvent: WorkflowTriggerEvent.TICKET_CREATED,
          actions: [
            {
              type: WorkflowActionType.SEND_EMAIL,
              configuration: {},
              executionOrder: 1,
            },
          ],
        },
        "user-1",
        "org-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Workflow action is not supported",
    });
  });
});

function actions(assignments: string[]): TicketWorkflowActions {
  return {
    assign: async (_ticketId, userId) => {
      assignments.push(userId);
    },
    changeStatus: async () => undefined,
  };
}
