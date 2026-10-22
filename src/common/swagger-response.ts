export const successResponse = {
  type: "object",
  additionalProperties: true,
  properties: {
    success: { type: "boolean" },
  },
};

export const objectResponse = {
  type: "object",
  additionalProperties: true,
};

export const arrayResponse = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: true,
  },
};
