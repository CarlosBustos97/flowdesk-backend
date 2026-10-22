import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import type AuthorizationService from "../modules/auth/authorization.service.ts";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    authorizationService: AuthorizationService;
  }

  interface FastifyRequest {
    user: {
      id: string;
      organizationId: string;
      name: string;
      email: string;
    };
    auth: {
      sessionId?: string;
      apiKeyId?: string;
      scopes?: string[];
    };
  }
}
