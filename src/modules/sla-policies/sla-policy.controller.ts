import type { FastifyReply, FastifyRequest } from "fastify";
import type { SlaPolicyService } from "./sla-policy.service.js";
import type {
  PolicyUpdateBody,
  PolicyCreateBody,
  PolicyListQuery,
  PolicyShowParams,
  PolicyUpdateParams,
} from "./sla-policy.types.js";

export class SlaPolicyController {
  constructor(private readonly slaPolicyService: SlaPolicyService) {}
  async list(
    request: FastifyRequest<{ Querystring: PolicyListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaPolicyService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: PolicyShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaPolicyService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: PolicyCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaPolicyService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: PolicyUpdateParams;
      Body: PolicyUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaPolicyService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async activate(
    request: FastifyRequest<{ Params: PolicyShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaPolicyService.activate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async deactivate(
    request: FastifyRequest<{ Params: PolicyShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaPolicyService.deactivate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
