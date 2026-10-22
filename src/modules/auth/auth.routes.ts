import type { FastifyInstance } from "fastify";
import { AuthService } from "./auth.service.js";
import { loginSchema, logoutSchema, meSchema } from "./auth.schema.js";
import { AuthController } from "./auth.controller.js";
import { authGuard } from "./auth.guard.js";

export async function authRoutes(app: FastifyInstance) {
  const authController = new AuthController(
    new AuthService(app.prisma, app.redis),
  );

  app.post(
    "/auth/login",
    { schema: loginSchema },
    authController.login.bind(authController),
  );

  app.get(
    "/auth/me",
    { schema: meSchema, preHandler: authGuard },
    authController.me.bind(authController),
  );

  app.post(
    "/auth/logout",
    { schema: logoutSchema, preHandler: authGuard },
    authController.logout.bind(authController),
  );
}
