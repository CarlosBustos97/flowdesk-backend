import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { authGuard } from "../auth/auth.guard.js";
import { AuditLogService } from "../audit-logs/audit-log.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import { WorkflowController } from "./workflow.controller.js";
import {
  workflowCreateSchema,
  workflowListSchema,
  workflowShowSchema,
  workflowUpdateSchema,
} from "./workflow.schema.js";
import { WorkflowService } from "./workflow.service.js";
import type {
  WorkflowCreateBody,
  WorkflowListQuery,
  WorkflowShowParams,
  WorkflowUpdateBody,
} from "./workflow.types.js";

export async function workflowRoutes(app: FastifyInstance) {
  const workflowController = new WorkflowController(
    new WorkflowService(
      app.prisma,
      app.authorizationService,
      new NotificationService(app.prisma),
      new AuditLogService(app.prisma, app.authorizationService),
    ),
  );

  app.get<{ Querystring: WorkflowListQuery }>(
    "/workflows",
    {
      schema: workflowListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.WORKFLOWS_VIEW)],
    },
    workflowController.list.bind(workflowController),
  );

  app.get<{ Params: WorkflowShowParams }>(
    "/workflows/:id",
    {
      schema: workflowShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.WORKFLOWS_VIEW)],
    },
    workflowController.show.bind(workflowController),
  );

  app.post<{ Body: WorkflowCreateBody }>(
    "/workflows",
    {
      schema: workflowCreateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.WORKFLOWS_CREATE)],
    },
    workflowController.create.bind(workflowController),
  );

  app.patch<{ Params: WorkflowShowParams; Body: WorkflowUpdateBody }>(
    "/workflows/:id",
    {
      schema: workflowUpdateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.WORKFLOWS_UPDATE)],
    },
    workflowController.update.bind(workflowController),
  );

  app.patch<{ Params: WorkflowShowParams }>(
    "/workflows/:id/activate",
    {
      schema: workflowShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.WORKFLOWS_UPDATE)],
    },
    workflowController.activate.bind(workflowController),
  );

  app.patch<{ Params: WorkflowShowParams }>(
    "/workflows/:id/deactivate",
    {
      schema: workflowShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.WORKFLOWS_DELETE)],
    },
    workflowController.deactivate.bind(workflowController),
  );
}
