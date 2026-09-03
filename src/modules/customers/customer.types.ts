import type { CustomerStatus } from "@prisma/client";

export type CustomerListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus;
};

export type CustomerShowParams = {
  id: string;
};

export type CustomerCreateBody = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  organizationId: string;
};

export type CustomerUpdateParams = {
  id: string;
};

export type CustomerUpdateBody = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
};