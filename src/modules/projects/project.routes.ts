import type { FastifyInstance } from "fastify";
import { ProjectController } from "./project.controller.js";
import { ProjectService } from "./project.service.js";
import type {
  ProjectCreateBody,
  ProjectListQuery,
  ProjectShowParams,
  ProjectUpdateBody,
  ProjectUpdateParams,
} from "./projects.types.js";
import {
  projectCreateSchema,
  projectListSchema,
  projectShowSchema,
  projectUpdateSchema,
} from "./project.schema.js";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";

export async function projectRoutes(app: FastifyInstance) {
  const projectController = new ProjectController(
    new ProjectService(app.prisma, app.authorizationService),
  );

  app.get<{ Querystring: ProjectListQuery }>(
    "/projects",
    {
      schema: projectListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_VIEW)],
    },
    projectController.list.bind(projectController),
  );

  app.get<{ Params: ProjectShowParams }>(
    "/projects/:id",
    {
      schema: projectShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_VIEW)],
    },
    projectController.show.bind(projectController),
  );

  app.post<{ Body: ProjectCreateBody }>(
    "/projects",
    {
      schema: projectCreateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_CREATE)],
    },
    projectController.create.bind(projectController),
  );

  app.patch<{ Params: ProjectUpdateParams; Body: ProjectUpdateBody }>(
    "/projects/:id",
    {
      schema: projectUpdateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_UPDATE)],
    },
    projectController.update.bind(projectController),
  );

  app.patch<{ Params: ProjectShowParams }>(
    "/projects/:id/activate",
    {
      schema: projectShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_UPDATE)],
    },
    projectController.activate.bind(projectController),
  );

  app.patch<{ Params: ProjectShowParams }>(
    "/projects/:id/hold",
    {
      schema: projectShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_UPDATE)],
    },
    projectController.hold.bind(projectController),
  );

  app.patch<{ Params: ProjectShowParams }>(
    "/projects/:id/complete",
    {
      schema: projectShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_UPDATE)],
    },
    projectController.complete.bind(projectController),
  );

  app.patch<{ Params: ProjectShowParams }>(
    "/projects/:id/cancel",
    {
      schema: projectShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.PROJECTS_UPDATE)],
    },
    projectController.cancel.bind(projectController),
  );
}
