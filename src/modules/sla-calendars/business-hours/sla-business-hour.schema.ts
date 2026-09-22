export const SlaBusinessHoursListSchema = {
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

export const SlaBusinessHoursUpdateSchema = {
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
    required: ["businessHours"],
    additionalProperties: false,
    properties: {
      businessHours: {
        type: "array",
        items: {
          type: "object",
          required: ["dayOfWeek", "startTime", "endTime"],
          additionalProperties: false,
          properties: {
            dayOfWeek: {
              type: "integer",
              minimum: 1,
              maximum: 7,
            },
            startTime: {
              type: "string",
              pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$",
            },
            endTime: {
              type: "string",
              pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$",
            },
          },
        },
      },
    },
  },
};
