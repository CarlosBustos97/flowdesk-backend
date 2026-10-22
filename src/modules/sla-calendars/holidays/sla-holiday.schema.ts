import { arrayResponse, objectResponse, successResponse } from "../../../common/swagger-response.js";

export const slaHolidayListSchema = {
  tags: ["SLA Calendars"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: arrayResponse,
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

export const slaHolidayCreateSchema = {
  tags: ["SLA Calendars"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    201: objectResponse,
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
  body: {
    type: "object",
    required: ["date", "name"],
    additionalProperties: false,
    properties: {
      date: {
        type: "string",
        format: "date",
      },
      name: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
    },
  },
};

export const slaHolidayDeleteSchema = {
  tags: ["SLA Calendars"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  params: {
    type: "object",
    required: ["id", "holidayId"],
    additionalProperties: false,
    properties: {
      id: {
        type: "string",
        format: "uuid",
      },
      holidayId: {
        type: "string",
        format: "uuid",
      },
    },
  },
};
