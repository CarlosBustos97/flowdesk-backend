import type { FastifyReply, FastifyRequest } from "fastify";

import { UserService } from "./user.service.js";

import type {
  UserCreateBody,
  UserListQuery,
  UserShowParams,
  UserUpdateBody,
  UserUpdateParams,
} from "./user.types.js";

export class UserController {
  constructor(private readonly userService: UserService) {}

  async list(
    request: FastifyRequest<{ Querystring: UserListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.userService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.send({
      success: true,
      data: result,
    });
  }

  async show(
    request: FastifyRequest<{ Params: UserShowParams }>,
    reply: FastifyReply,
  ) {
    const user = await this.userService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.send({
      success: true,
      data: {
        user,
      },
    });
  }

  async create(
    request: FastifyRequest<{ Body: UserCreateBody }>,
    reply: FastifyReply,
  ) {
    const user = await this.userService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.code(201).send({
      success: true,
      data: {
        user,
      },
    });
  }

  async update(
    request: FastifyRequest<{
      Params: UserUpdateParams;
      Body: UserUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const user = await this.userService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.send({
      success: true,
      data: {
        user,
      },
    });
  }

  async disable(
    request: FastifyRequest<{ Params: UserShowParams }>,
    reply: FastifyReply,
  ) {
    const user = await this.userService.disable(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.send({
      success: true,
      data: { user },
    });
  }
}
