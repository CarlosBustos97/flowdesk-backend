export const ticketCategoryListSchema = {
  tags: ["Tickets"],
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
        maxLength: 100
      },
      isActive: {
        type: "boolean",
      },
    },
  },
};

export const ticketCategoryShowSchema = {
  tags: ["Tickets"],
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

export const ticketCategoryCreateSchema = {
  tags: ["Tickets"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  body: {
    type: "object",
    required: ["organizationId", "name"],
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
        maxLength: 2000
      },
    },
  },
};

export const ticketCategoryUpdateSchema = {
  tags: ["Tickets"],
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
        maxLength: 2000
      },
    },
  },
};
