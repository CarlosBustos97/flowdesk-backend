import { Priority } from "@prisma/client";

export const PolicyListSchema = {
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
  body: {
    type: "object",
    required: [
      "organizationId",
      "name",
      "priority",
      "firstResponseMinutes",
      "resolutionMinutes",
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
      businessHours: {
        type: "array",
        items: {
          type: "object",
          required: ["dayOfWeek", "startTime", "endTime"],
          additionalProperties: false,
          properties: {
            dayOfWeek: {
              type: "integer",
              minimum: 1,
              maximum: 7,
            },
            startTime: {
              type: "string",
              pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$",
            },
            endTime: {
              type: "string",
              pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$",
            },
          },
        },
      },
    },
  },
};

export const PolicyUpdateSchema = {
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
