import type { FastifyRequest } from "fastify";

import { AppError } from "../errors/app-error.js";

import type { PermissionCode } from "../auth/permissions.js";

export function requirePermission(permissionCode: PermissionCode) {
  return async function permissionGuard(request: FastifyRequest) {
    const hasPermission =
      await request.server.authorizationService.hasPermission(
        request.user.id,
        request.user.organizationId,
        permissionCode,
      );

    if (!hasPermission) {
      throw new AppError(403, "Insufficient permissions");
    }
  };
}
