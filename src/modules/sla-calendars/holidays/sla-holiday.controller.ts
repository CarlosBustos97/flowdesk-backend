import type { FastifyReply, FastifyRequest } from "fastify";
import type {
  SlaHolidayCreateBody,
  SlaHolidayCreateParams,
  SlaHolidayDeleteParams,
  SlaHolidayListParams,
} from "./sla-holiday.types.js";
import type { SlaHolidayService } from "./sla-holiday.service.js";

export class SlaHolidayController {
  constructor(private readonly slaHolidayService: SlaHolidayService) {}

  async list(
    request: FastifyRequest<{ Params: SlaHolidayListParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaHolidayService.list(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );
    return reply.send(result);
  }

  async create(
    request: FastifyRequest<{
      Params: SlaHolidayCreateParams;
      Body: SlaHolidayCreateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaHolidayService.create(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(201).send(result);
  }

  async delete(
    request: FastifyRequest<{ Params: SlaHolidayDeleteParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaHolidayService.delete(
      request.params.id,
      request.params.holidayId,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }
}
