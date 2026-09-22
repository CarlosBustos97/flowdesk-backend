import type { FastifyReply, FastifyRequest } from "fastify";
import type { SlaCalendarService } from "./sla-calendar.service.js";
import type {
  SlaCalendarCreateBody,
  SlaCalendarListQuery,
  SlaCalendarShowParams,
  SlaCalendarUpdateBody,
  SlaCalendarUpdateParams,
} from "./sla-calendar.types.js";

export class SlaCalendarController {
  constructor(private readonly slaCalendarService: SlaCalendarService) {}

  async list(
    request: FastifyRequest<{ Querystring: SlaCalendarListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaCalendarService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: SlaCalendarShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaCalendarService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: SlaCalendarCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaCalendarService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: SlaCalendarUpdateParams;
      Body: SlaCalendarUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaCalendarService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
