import { Priority, TicketStatus } from "@prisma/client";

export const ticketListSchema = {
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
      priority: {
        type: "string",
        enum: Object.values(Priority),
      },
      status: {
        type: "string",
        enum: Object.values(TicketStatus),
      },
      customerId: {
        type: "string",
        format: "uuid",
      },
      projectId: {
        type: "string",
        format: "uuid",
      },
      categoryId: {
        type: "string",
        format: "uuid",
      },
      assignedToId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const ticketShowSchema = {
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

export const ticketCreateSchema = {
  body: {
    type: "object",
    required: [
      "organizationId",
      "customerId",
      "subject",
      "description",
      "priority",
      "slaPolicyId",
    ],
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
      subject: {
        type: "string",
        minLength: 1,
        maxLength: 200,
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
      projectId: {
        type: "string",
        format: "uuid",
      },
      categoryId: {
        type: "string",
        format: "uuid",
      },
      assignedToId: {
        type: "string",
        format: "uuid",
      },
      slaPolicyId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const ticketUpdateSchema = {
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
      customerId: {
        type: "string",
        format: "uuid",
      },
      subject: {
        type: "string",
        minLength: 1,
        maxLength: 200,
      },
      description: {
        type: "string",
        minLength: 1,
        maxLength: 2000,
      },
      projectId: {
        type: "string",
        format: "uuid",
      },
      categoryId: {
        type: "string",
        format: "uuid",
      },
      assignedToId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};
