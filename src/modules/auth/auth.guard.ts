import { UserStatus, type Prisma } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { hashSecret } from "../../common/auth/hash-secret.js";
import { bindOrganization } from "../../common/auth/request-scope.js";
import { AppError } from "../../common/errors/app-error.js";

const INVALID_API_KEY = "Invalid or revoked API key";

export async function authGuard(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (authorization) {
    await authenticateSession(request, authorization);
    return;
  }

  const apiKey = request.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.length > 0) {
    await authenticateApiKey(request, apiKey);
    return;
  }

  throw new AppError(401, "Authorization header is missing");
}

async function authenticateSession(
  request: FastifyRequest,
  authorization: string,
) {
  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token)
    throw new AppError(401, "Invalid authorization header");

  const tokenHash = hashSecret(token);

  const session = await request.server.prisma.session.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!session) throw new AppError(401, "Invalid or expired session");

  if (session.expiresAt <= new Date())
    throw new AppError(401, "Invalid or expired session");

  if (session.user.status !== UserStatus.ACTIVE)
    throw new AppError(401, "Invalid or expired session");

  request.user = {
    id: session.user.id,
    organizationId: session.user.organizationId,
    name: session.user.name,
    email: session.user.email,
  };

  request.auth = {
    sessionId: session.id,
  };
}

async function authenticateApiKey(request: FastifyRequest, secret: string) {
  const apiKey = await request.server.prisma.apiKey.findUnique({
    where: { keyHash: hashSecret(secret) },
    include: { createdBy: true },
  });

  if (!apiKey || apiKey.revokedAt) throw new AppError(401, INVALID_API_KEY);

  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
    throw new AppError(401, INVALID_API_KEY);
  }

  if (apiKey.createdBy.status !== UserStatus.ACTIVE) {
    throw new AppError(401, INVALID_API_KEY);
  }

  await request.server.prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  bindOrganization(true);

  request.user = {
    id: apiKey.createdBy.id,
    organizationId: apiKey.organizationId,
    name: apiKey.createdBy.name,
    email: apiKey.createdBy.email,
  };

  request.auth = {
    apiKeyId: apiKey.id,
    scopes: readScopes(apiKey.scopes),
  };
}

function readScopes(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
