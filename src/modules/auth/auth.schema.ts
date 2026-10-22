import { successResponse } from "../../common/swagger-response.js";

export const loginSchema = {
  tags: ["Authentication"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  body: {
    type: 'object',
    required: ['email', 'password', 'organizationSlug'],
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 255,
      },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 100,
      },
      organizationSlug: {
        type: 'string',
        minLength: 1,
        maxLength: 150,
      },
    },
  },
} as const;

export const meSchema = {
  tags: ["Authentication"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
};

export const logoutSchema = {
  tags: ["Authentication"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
};