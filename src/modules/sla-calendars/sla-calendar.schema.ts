export const SlaCalendarListSchema = {
  tags: ["SLA Calendars"],
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
    },
  },
};

export const SlaCalendarShowSchema = {
  tags: ["SLA Calendars"],
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

export const SlaCalendarCreateSchema = {
  tags: ["SLA Calendars"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  body: {
    type: "object",
    required: ["name", "timezone", "organizationId"],
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
      timezone: {
        type: "string",
        minLength: 1,
      },
      isActive: {
        type: "boolean",
      },
    },
  },
};

export const SlaCalendarUpdateSchema = {
  tags: ["SLA Calendars"],
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
      timezone: {
        type: "string",
        minLength: 1,
      },
      isActive: {
        type: "boolean",
      },
    },
  },
};
