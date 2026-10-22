import { successResponse } from "../../common/swagger-response.js";
import { CustomerStatus } from "@prisma/client";

export const customerListSchema = {
  tags: ["Customers"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  querystring: {
    type: "object",
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
      },
      status: {
        type: "string",
        enum: Object.values(CustomerStatus),
      },
    },
  },
};

export const customerShowSchema = {
  tags: ["Customers"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const customerCreateSchema = {
  tags: ["Customers"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    201: successResponse,
  },
  body: {
    type: "object",
    required: ["name", "organizationId"],
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        minLength: 2,
        maxLength: 100,
      },
      email: {
        type: "string",
        format: "email",
      },
      phone: {
        type: "string",
        minLength: 6,
        maxLength: 15,
      },
      company: {
        type: "string",
        minLength: 2,
        maxLength: 100,
      },
      address: {
        type: "string",
        minLength: 4,
        maxLength: 200,
      },
      notes: {
        type: "string",
        minLength: 4,
        maxLength: 200,
      },
      organizationId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const customerUpdateSchema = {
  tags: ["Customers"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  params: {
    type: "object",
    required: ["id"],
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
        minLength: 2,
        maxLength: 100,
      },
      email: {
        type: "string",
        format: "email",
      },
      phone: {
        type: "string",
        minLength: 6,
        maxLength: 15,
      },
      company: {
        type: "string",
        minLength: 2,
        maxLength: 100,
      },
      address: {
        type: "string",
        minLength: 4,
        maxLength: 200,
      },
      notes: {
        type: "string",
        minLength: 4,
        maxLength: 200,
      },
    },
  },
};
