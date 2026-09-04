import type { FastifyReply, FastifyRequest } from "fastify";
import type { ProjectService } from "./project.service.js";
import type {
  ProjectCreateBody,
  ProjectListQuery,
  ProjectShowParams,
  ProjectUpdateBody,
  ProjectUpdateParams,
} from "./projects.types.js";

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  async list(
    request: FastifyRequest<{ Querystring: ProjectListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: ProjectShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: ProjectCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: ProjectUpdateParams;
      Body: ProjectUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async activate(
    request: FastifyRequest<{ Params: ProjectShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.activate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async hold(
    request: FastifyRequest<{ Params: ProjectShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.hold(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async complete(
    request: FastifyRequest<{ Params: ProjectShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.complete(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async cancel(
    request: FastifyRequest<{ Params: ProjectShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.projectService.cancel(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
