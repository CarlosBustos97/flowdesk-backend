import { successResponse } from "../../common/swagger-response.js";

export const ticketSummarySchema = {
  tags: ["Reports"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  response: {
    200: successResponse,
  },
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
};
