import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { AuditLogService } from "../audit-logs/audit-log.service.js";
import { authGuard } from "../auth/auth.guard.js";
import { ApiKeyController } from "./api-key.controller.js";
import {
  apiKeyCreateSchema,
  apiKeyListSchema,
  apiKeyRevokeSchema,
} from "./api-key.schema.js";
import { ApiKeyService } from "./api-key.service.js";
import type {
  ApiKeyCreateBody,
  ApiKeyListQuery,
  ApiKeyRevokeParams,
} from "./api-key.types.js";

export async function apiKeyRoutes(app: FastifyInstance) {
  const apiKeyController = new ApiKeyController(
    new ApiKeyService(
      app.prisma,
      app.authorizationService,
      new AuditLogService(app.prisma, app.authorizationService),
    ),
  );

  app.get<{ Querystring: ApiKeyListQuery }>(
    "/api-keys",
    {
      schema: apiKeyListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.API_KEYS_VIEW)],
    },
    apiKeyController.list.bind(apiKeyController),
  );

  app.post<{ Body: ApiKeyCreateBody }>(
    "/api-keys",
    {
      schema: apiKeyCreateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.API_KEYS_CREATE)],
    },
    apiKeyController.create.bind(apiKeyController),
  );

  app.patch<{ Params: ApiKeyRevokeParams }>(
    "/api-keys/:id/revoke",
    {
      schema: apiKeyRevokeSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.API_KEYS_REVOKE)],
    },
    apiKeyController.revoke.bind(apiKeyController),
  );
}
