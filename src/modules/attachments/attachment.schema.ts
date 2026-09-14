export const attachmentListSchema = {
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
      search: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
    },
  },
};

export const attachmentDeleteSchema = {
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

export const attachmentCreateSchema = {
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
};
