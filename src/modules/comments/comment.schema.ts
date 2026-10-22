export const commentListSchema = {
  tags: ["Comments"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  params: {
    type: "object",
    required: ["ticketId"],
    additionalProperties: false,
    properties: {
      ticketId: {
        type: "string",
        format: "uuid",
      },
    },
  },
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
    },
  },
};

export const commentCreateSchema = {
  tags: ["Comments"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  params: {
    type: "object",
    required: ["ticketId"],
    additionalProperties: false,
    properties: {
      ticketId: {
        type: "string",
        format: "uuid",
      },
    },
  },
  body: {
    type: "object",
    required: ["content"],
    additionalProperties: false,
    properties: {
      content: {
        type: "string",
        minLength: 1,
        maxLength: 5000,
      },
      isInternal: {
        type: "boolean",
      },
    },
  },
};

export const commentUpdateSchema = {
  tags: ["Comments"],
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
      content: {
        type: "string",
        minLength: 1,
        maxLength: 5000,
      },
    },
  },
};

export const commentDeleteSchema = {
  tags: ["Comments"],
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
