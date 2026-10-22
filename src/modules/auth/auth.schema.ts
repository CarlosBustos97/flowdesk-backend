export const loginSchema = {
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