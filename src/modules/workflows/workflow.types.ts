import type {
  Priority,
  TicketStatus,
  WorkflowActionType,
  WorkflowOperator,
  WorkflowTriggerEvent,
} from "@prisma/client";

export const WORKFLOW_DEPTH_LIMIT = 3;

export type WorkflowDispatchContext = {
  executingIds: ReadonlySet<string>;
  depth: number;
};

export function rootWorkflowContext(): WorkflowDispatchContext {
  return { executingIds: new Set<string>(), depth: 0 };
}

export type WorkflowTicketSnapshot = {
  id: string;
  organizationId: string;
  status: TicketStatus;
  priority: Priority;
  assignedToId: string | null;
  subject: string;
};

export type TicketWorkflowActions = {
  assign(
    ticketId: string,
    assignedToId: string,
    actorUserId: string,
    organizationId: string,
    context: WorkflowDispatchContext,
  ): Promise<void>;

  changeStatus(
    ticketId: string,
    status: TicketStatus,
    actorUserId: string,
    organizationId: string,
    context: WorkflowDispatchContext,
  ): Promise<void>;
};

export type WorkflowConditionInput = {
  field: string;
  operator: WorkflowOperator;
  value: string;
  logicalGroup?: number;
};

export type WorkflowActionInput = {
  type: WorkflowActionType;
  configuration: Record<string, unknown>;
  executionOrder: number;
};

export type WorkflowCreateBody = {
  organizationId: string;
  name: string;
  description?: string;
  triggerEvent: WorkflowTriggerEvent;
  conditions?: WorkflowConditionInput[];
  actions: WorkflowActionInput[];
};

export type WorkflowUpdateBody = {
  name?: string;
  description?: string;
  triggerEvent?: WorkflowTriggerEvent;
  conditions?: WorkflowConditionInput[];
  actions?: WorkflowActionInput[];
};

export type WorkflowListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

export type WorkflowShowParams = {
  id: string;
};

export type { Priority };
