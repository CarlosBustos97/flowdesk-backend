import type { Prisma } from "@prisma/client";

export type AuditLogRecordInput = {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
};

export type AuditLogListQuery = {
  page?: number;
  limit?: number;
};
