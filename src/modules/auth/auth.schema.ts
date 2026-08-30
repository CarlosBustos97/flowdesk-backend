export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
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
    },
  },
} as const;