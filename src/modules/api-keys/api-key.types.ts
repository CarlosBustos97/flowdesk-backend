export type ApiKeyCreateBody = {
  organizationId: string;
  name: string;
  scopes: string[];
  expiresAt?: string;
};

export type ApiKeyListQuery = {
  page?: number;
  limit?: number;
};

export type ApiKeyRevokeParams = {
  id: string;
};
