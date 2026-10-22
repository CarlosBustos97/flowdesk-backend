import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth/auth.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { AuditLogController } from "./audit-log.controller.js";
import { auditLogListSchema } from "./audit-log.schema.js";
import { AuditLogService } from "./audit-log.service.js";
import type { AuditLogListQuery } from "./audit-log.types.js";

export async function auditLogRoutes(app: FastifyInstance) {
  const auditLogController = new AuditLogController(
    new AuditLogService(app.prisma, app.authorizationService),
  );

  app.get<{ Querystring: AuditLogListQuery }>(
    "/audit-logs",
    {
      schema: auditLogListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW)],
    },
    auditLogController.list.bind(auditLogController),
  );
}
