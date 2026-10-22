import type { FastifyRequest } from "fastify";

import { AppError } from "../errors/app-error.js";

import type { PermissionCode } from "../auth/permissions.js";

export function requirePermission(permissionCode: PermissionCode) {
  return async function permissionGuard(request: FastifyRequest) {
    if (request.auth.apiKeyId) {
      const scopes = request.auth.scopes ?? [];
      if (!scopes.includes(permissionCode)) {
        throw new AppError(403, "Insufficient permissions");
      }
      return;
    }

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
