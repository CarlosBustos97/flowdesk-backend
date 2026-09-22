import { UserStatus } from "@prisma/client";

export const userListSchema = {
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
    },
  },
};

export const userShowSchema = {
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

export const userCreateSchema = {
  body: {
    type: "object",
    required: ["name", "email", "password", "organizationId", "roleId"],
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
      password: {
        type: "string",
        minLength: 8,
        maxLength: 100,
      },
      organizationId: {
        type: "string",
        format: "uuid",
      },
      roleId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};

export const userUpdateSchema = {
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
      status: {
        type: "string",
        enum: Object.values(UserStatus),
      },
      roleId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};
