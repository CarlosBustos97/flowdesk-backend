import type { FastifyInstance } from "fastify";

import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";
import {
  userCreateSchema,
  userListSchema,
  userShowSchema,
  userUpdateSchema,
} from "./user.schema.js";

import { authGuard } from "../auth/auth.guard.js";

import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import { AuditLogService } from "../audit-logs/audit-log.service.js";
import type {
  UserCreateBody,
  UserListQuery,
  UserShowParams,
  UserUpdateBody,
  UserUpdateParams,
} from "./user.types.js";

export async function userRoutes(app: FastifyInstance) {
  const userController = new UserController(
    new UserService(
      app.prisma,
      app.authorizationService,
      new AuditLogService(app.prisma, app.authorizationService),
    ),
  );

  app.get<{ Querystring: UserListQuery }>(
    "/users",
    {
      schema: userListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.USERS_VIEW)],
    },
    userController.list.bind(userController),
  );

  app.get<{ Params: UserShowParams }>(
    "/users/:id",
    {
      schema: userShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.USERS_VIEW)],
    },
    userController.show.bind(userController),
  );

  app.post<{ Body: UserCreateBody }>(
    "/users",
    {
      schema: userCreateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.USERS_CREATE)],
    },
    userController.create.bind(userController),
  );

  app.patch<{ Params: UserUpdateParams; Body: UserUpdateBody }>(
    "/users/:id",
    {
      schema: userUpdateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.USERS_UPDATE)],
    },
    userController.update.bind(userController),
  );

  app.delete<{ Params: UserShowParams }>(
    "/users/:id",
    {
      schema: userShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.USERS_DELETE)],
    },
    userController.disable.bind(userController),
  );
}
