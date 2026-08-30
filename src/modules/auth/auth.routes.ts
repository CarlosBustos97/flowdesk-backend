import type { FastifyInstance } from "fastify";
import { AuthService } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";
import { AuthController } from "./auth.controller.js";
import { authGuard } from "./auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";

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
    { preHandler: authGuard },
    authController.me.bind(authController),
  );

  app.post(
    "/auth/logout",
    { preHandler: authGuard },
    authController.logout.bind(authController),
  );

  app.get(
    "/users",
    {
      preHandler: [authGuard, requirePermission(PERMISSIONS.USERS_VIEW)],
    },
    async () => {
      return {
        success: true,
        data: {
          message: "You can view users",
        },
      };
    },
  );
}
