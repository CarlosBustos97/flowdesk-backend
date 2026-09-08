import type { FastifyInstance } from "fastify";
import { SlaPolicyController } from "./sla-policy.controller.js";
import { SlaPolicyService } from "./sla-policy.service.js";
import type {
  PolicyUpdateBody,
  PolicyCreateBody,
  PolicyListQuery,
  PolicyShowParams,
  PolicyUpdateParams,
} from "./sla-policy.types.js";
import {
  PolicyCreateSchema,
  PolicyListSchema,
  PolicyShowSchema,
  PolicyUpdateSchema,
} from "./sla-policy.schema.js";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";

export async function slaPolicyRoutes(app: FastifyInstance) {
  const slaPolicyController = new SlaPolicyController(
    new SlaPolicyService(app.prisma, app.authorizationService),
  );

  app.get<{ Querystring: PolicyListQuery }>(
    "/sla-policies",
    {
      schema: PolicyListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.SLA_POLICIES_VIEW)],
    },
    slaPolicyController.list.bind(slaPolicyController),
  );

  app.get<{ Params: PolicyShowParams }>(
    "/sla-policies/:id",
    {
      schema: PolicyShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.SLA_POLICIES_VIEW)],
    },
    slaPolicyController.show.bind(slaPolicyController),
  );

  app.post<{ Body: PolicyCreateBody }>(
    "/sla-policies",
    {
      schema: PolicyCreateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_POLICIES_CREATE),
      ],
    },
    slaPolicyController.create.bind(slaPolicyController),
  );

  app.patch<{ Params: PolicyUpdateParams; Body: PolicyUpdateBody}>(
    "/sla-policies/:id",
    {
      schema: PolicyUpdateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_POLICIES_UPDATE),
      ],
    },
    slaPolicyController.update.bind(slaPolicyController),
  );

  app.patch<{ Params: PolicyShowParams }>(
    "/sla-policies/:id/activate",
    {
      schema: PolicyShowSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_POLICIES_UPDATE),
      ],
    },
    slaPolicyController.activate.bind(slaPolicyController),
  );

  app.patch<{ Params: PolicyShowParams }>(
    "/sla-policies/:id/deactivate",
    {
      schema: PolicyShowSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_POLICIES_DELETE),
      ],
    },
    slaPolicyController.deactivate.bind(slaPolicyController),
  );
}
