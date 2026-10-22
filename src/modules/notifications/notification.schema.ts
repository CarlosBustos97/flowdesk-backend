import { successResponse } from "../../common/swagger-response.js";

export const notificationListSchema = {
  tags: ["Notifications"],
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
      isRead: {
        type: "boolean",
      },
    },
  },
};

export const notificationCountUnreadSchema = {
  tags: ["Notifications"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
};

export const notificationReadAllSchema = {
  tags: ["Notifications"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
};

export const notificationReadSchema = {
  tags: ["Notifications"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
};
