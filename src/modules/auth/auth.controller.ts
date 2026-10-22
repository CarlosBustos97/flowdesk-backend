import type { FastifyReply, FastifyRequest } from "fastify";
import type { LoginBody } from "./auth.types.js";
import type { AuthService } from "./auth.service.js";
import { AppError } from "../../common/errors/app-error.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async login(
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply,
  ) {
    const { email, password, organizationSlug } = request.body;

    const result = await this.authService.login(
      email,
      password,
      organizationSlug,
    );

    return reply.send({
      success: true,
      data: result,
    });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      success: true,
      data: {
        user: request.user,
      },
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    if (!request.auth.sessionId) {
      throw new AppError(401, "Invalid or expired session");
    }

    await this.authService.logout(request.auth.sessionId);

    return reply.send({
      success: true,
      data: {
        message: "Logged out successfully",
      },
    });
  }
}
