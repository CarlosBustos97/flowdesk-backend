import type { Priority } from "@prisma/client";

export type PolicyListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  priority?: Priority;
};

export type PolicyShowParams = {
  id: string;
};

export type PolicyCreateBody = {
  organizationId: string;
  name: string;
  description?: string;
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

export type PolicyUpdateParams = {
  id: string;
};

export type PolicyUpdateBody  = {
  name?: string;
  description?: string;
  priority?: Priority;
  firstResponseMinutes?: number;
  resolutionMinutes?: number;
};
