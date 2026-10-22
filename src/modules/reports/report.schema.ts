export const ticketSummarySchema = {
  tags: ["Reports"],
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
};
