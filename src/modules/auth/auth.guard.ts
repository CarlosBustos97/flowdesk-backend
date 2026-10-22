import crypto from "node:crypto";

import { UserStatus } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { AppError } from "../../common/errors/app-error.js";

export async function authGuard(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (!authorization)
    throw new AppError(401, "Authorization header is missing");

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token)
    throw new AppError(401, "Invalid authorization header");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

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
    throw new AppError(401, "Session expired");

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
