import type { UserStatus } from "@prisma/client";

export type UserListQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export type UserShowParams = {
  id: string;
};

export type UserCreateBody = {
  name: string;
  email: string;
  password: string;
  organizationId: string;
  roleId: string;
};

export type UserUpdateParams = {
  id: string;
};

export type UserUpdateBody = {
  name?: string;
  email?: string;
  status?: UserStatus;
  roleId?: string;
};