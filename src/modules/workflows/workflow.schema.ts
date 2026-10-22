import {
  WorkflowActionType,
  WorkflowOperator,
  WorkflowTriggerEvent,
} from "@prisma/client";

const conditionSchema = {
  type: "object",
  required: ["field", "operator", "value"],
  additionalProperties: false,
  properties: {
    field: {
      type: "string",
      enum: ["status", "priority", "assignedToId"],
    },
    operator: {
      type: "string",
      enum: [WorkflowOperator.EQUALS, WorkflowOperator.NOT_EQUALS],
    },
    value: {
      type: "string",
      maxLength: 200,
    },
    logicalGroup: {
      type: "integer",
      minimum: 0,
    },
  },
};

const actionSchema = {
  type: "object",
  required: ["type", "configuration", "executionOrder"],
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: [
        WorkflowActionType.ASSIGN_USER,
        WorkflowActionType.CHANGE_STATUS,
        WorkflowActionType.CREATE_NOTIFICATION,
      ],
    },
    configuration: {
      type: "object",
      additionalProperties: true,
    },
    executionOrder: {
      type: "integer",
      minimum: 0,
    },
  },
};

const idParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      format: "uuid",
    },
  },
};

export const workflowListSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      page: {
        type: "integer",
        minimum: 1,
        default: 1,
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      search: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      isActive: {
        type: "boolean",
      },
    },
  },
};

export const workflowShowSchema = {
  params: idParams,
};

export const workflowCreateSchema = {
  body: {
    type: "object",
    required: ["organizationId", "name", "triggerEvent", "actions"],
    additionalProperties: false,
    properties: {
      organizationId: {
        type: "string",
        format: "uuid",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 150,
      },
      description: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
      triggerEvent: {
        type: "string",
        enum: Object.values(WorkflowTriggerEvent),
      },
      conditions: {
        type: "array",
        items: conditionSchema,
      },
      actions: {
        type: "array",
        minItems: 1,
        items: actionSchema,
      },
    },
  },
};

export const workflowUpdateSchema = {
  params: idParams,
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 150,
      },
      description: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
      triggerEvent: {
        type: "string",
        enum: Object.values(WorkflowTriggerEvent),
      },
      conditions: {
        type: "array",
        items: conditionSchema,
      },
      actions: {
        type: "array",
        minItems: 1,
        items: actionSchema,
      },
    },
  },
};
