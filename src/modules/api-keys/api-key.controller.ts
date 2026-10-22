import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiKeyService } from "./api-key.service.js";
import type {
  ApiKeyCreateBody,
  ApiKeyListQuery,
  ApiKeyRevokeParams,
} from "./api-key.types.js";

export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async list(
    request: FastifyRequest<{ Querystring: ApiKeyListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.apiKeyService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: ApiKeyCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.apiKeyService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async revoke(
    request: FastifyRequest<{ Params: ApiKeyRevokeParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.apiKeyService.revoke(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
