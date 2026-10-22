import { successResponse } from "../../common/swagger-response.js";

export const apiKeyListSchema = {
  tags: ["API Keys"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
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

export const apiKeyCreateSchema = {
  tags: ["API Keys"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    201: successResponse,
  },
  body: {
    type: "object",
    required: ["organizationId", "name", "scopes"],
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
      scopes: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "string",
          minLength: 1,
          maxLength: 100,
        },
      },
      expiresAt: {
        type: "string",
        format: "date-time",
      },
    },
  },
};

export const apiKeyRevokeSchema = {
  tags: ["API Keys"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
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
