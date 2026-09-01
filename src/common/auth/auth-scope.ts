export const AUTH_SCOPES = {
  GLOBAL: "GLOBAL",
  ORGANIZATION: "ORGANIZATION",
} as const;

export type AuthScope = (typeof AUTH_SCOPES)[keyof typeof AUTH_SCOPES];
