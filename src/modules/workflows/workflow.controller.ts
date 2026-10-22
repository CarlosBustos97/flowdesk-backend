import type { FastifyReply, FastifyRequest } from "fastify";
import type { WorkflowService } from "./workflow.service.js";
import type {
  WorkflowCreateBody,
  WorkflowListQuery,
  WorkflowShowParams,
  WorkflowUpdateBody,
} from "./workflow.types.js";

export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  async list(
    request: FastifyRequest<{ Querystring: WorkflowListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.workflowService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: WorkflowShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.workflowService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: WorkflowCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.workflowService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: WorkflowShowParams;
      Body: WorkflowUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.workflowService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async activate(
    request: FastifyRequest<{ Params: WorkflowShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.workflowService.activate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async deactivate(
    request: FastifyRequest<{ Params: WorkflowShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.workflowService.deactivate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
