import type { FastifyReply, FastifyRequest } from "fastify";
import type { TicketService } from "./ticket.service.js";
import type {
  TicketCreateBody,
  TicketListQuery,
  TicketShowParams,
  TicketUpdateBody,
  TicketUpdateParams,
} from "./ticket.types.js";

export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  async list(
    request: FastifyRequest<{ Querystring: TicketListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: TicketCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: TicketUpdateParams;
      Body: TicketUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async start(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.start(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async pending(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.pending(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async resolve(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.resolve(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async close(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.close(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async reopen(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.ticketService.reopen(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
