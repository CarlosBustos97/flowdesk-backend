import { objectResponse } from "../../common/swagger-response.js";

export const attachmentListSchema = {
  tags: ["Attachments"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: objectResponse,
  },
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
  tags: ["Attachments"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: objectResponse,
  },
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
  tags: ["Attachments"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    201: objectResponse,
  },
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
