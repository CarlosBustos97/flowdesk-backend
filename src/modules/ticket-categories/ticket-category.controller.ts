import type { FastifyReply, FastifyRequest } from "fastify";
import type { TicketCategoryService } from "./ticket-category.service.js";
import type {
  TicketCategoryCreateBody,
  TicketCategoryListQuery,
  TicketCategoryShowParams,
  TicketCategoryUpdateParams,
  TicketcategoryUpdateBody,
} from "./ticket-category.types.js";

export class TicketCategoryController {
  constructor(private readonly  ticketCategoryService: TicketCategoryService) {}

  async list(
    request: FastifyRequest<{ Querystring: TicketCategoryListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketCategoryService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: TicketCategoryShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketCategoryService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: TicketCategoryCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketCategoryService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: TicketCategoryUpdateParams;
      Body: TicketcategoryUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketCategoryService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async activate(
    request: FastifyRequest<{ Params: TicketCategoryShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketCategoryService.activate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async deactivate(
    request: FastifyRequest<{ Params: TicketCategoryShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketCategoryService.deactivate(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
