import { Priority, ProjectStatus } from "@prisma/client";

export const projectListSchema = {
  tags: ["Projects"],
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
      },
      status: {
        type: "string",
        enum: Object.values(ProjectStatus),
      },
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
      customerId: {
        type: "string",
        format: "uuid",
      },
      startDate: {
        type: "string",
        format: "date"
      },
      dueDate: {
        type: "string",
        format: "date"
      }
    },
  },
};

export const projectShowSchema = {
  tags: ["Projects"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const projectCreateSchema = {
  tags: ["Projects"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  body: {
    type: "object",
    required: ["organizationId", "customerId", "name"],
    additionalProperties: false,
    properties: {
      organizationId: {
        type: "string",
        format: "uuid",
      },
      customerId: {
        type: "string",
        format: "uuid",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 200,
      },
      description: {
        type: "string",
        minLength: 1,
      },
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
      startDate: {
        type: "string",
        format: "date",
      },
      dueDate: {
        type: "string",
        format: "date",
      },
    },
  },
};

export const projectUpdateSchema = {
  tags: ["Projects"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
     params: {
    type: "object",
    required: ["id"],
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
      customerId: {
        type: "string",
        format: "uuid",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 200,
      },
      description: {
        type: "string",
        minLength: 1,
      },
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
      startDate: {
        type: "string",
        format: "date",
      },
      dueDate: {
        type: "string",
        format: "date",
      },
    },
  },
};
