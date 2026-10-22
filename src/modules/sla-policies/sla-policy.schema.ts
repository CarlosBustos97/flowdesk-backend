import { Priority } from "@prisma/client";

export const PolicyListSchema = {
  tags: ["SLA Policies"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
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
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
    },
  },
};

export const PolicyShowSchema = {
  tags: ["SLA Policies"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const PolicyCreateSchema = {
  tags: ["SLA Policies"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  body: {
    type: "object",
    required: [
      "organizationId",
      "name",
      "priority",
      "firstResponseMinutes",
      "resolutionMinutes",
      "slaCalendarId",
    ],
    additionalProperties: false,
    properties: {
      organizationId: {
        type: "string",
        format: "uuid",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      description: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
      firstResponseMinutes: {
        type: "integer",
        minimum: 1,
      },
      resolutionMinutes: {
        type: "integer",
        minimum: 1,
      },
      slaCalendarId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const PolicyUpdateSchema = {
  tags: ["SLA Policies"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
    },
  },
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      description: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
      firstResponseMinutes: {
        type: "integer",
        minimum: 1,
      },
      resolutionMinutes: {
        type: "integer",
        minimum: 1,
      },
    },
  },
};
