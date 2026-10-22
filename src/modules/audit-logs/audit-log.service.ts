import type { Prisma, PrismaClient } from "@prisma/client";

import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import type AuthorizationService from "../auth/authorization.service.js";
import type {
  AuditLogListQuery,
  AuditLogRecordInput,
} from "./audit-log.types.js";

export class AuditLogService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async record(data: AuditLogRecordInput, tx: Prisma.TransactionClient) {
    return tx.auditLog.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        ...(data.oldValues !== undefined ? { oldValues: data.oldValues } : {}),
        ...(data.newValues !== undefined ? { newValues: data.newValues } : {}),
      },
    });
  }

  async list(
    query: AuditLogListQuery,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = {
      ...(scope === AUTH_SCOPES.ORGANIZATION
        ? { organizationId: requesterOrganizationId }
        : {}),
    };

    const [auditLogs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      auditLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
