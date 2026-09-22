import type { FastifyReply, FastifyRequest } from "fastify";
import type { SlaBusinessHourService } from "./sla-business-hour.service.js";
import type {
  SlaBusinessHoursParams,
  SlaBusinessHoursUpdateBody,
} from "./sla-business-hour.types.js";

export class SlaBusinessHourController {
  constructor(private readonly slaBusinessHourService: SlaBusinessHourService) {}

  async list(
    request: FastifyRequest<{ Params: SlaBusinessHoursParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaBusinessHourService.list(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: SlaBusinessHoursParams;
      Body: SlaBusinessHoursUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.slaBusinessHourService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
