import type { FastifyReply, FastifyRequest } from "fastify";
import type { ReportService } from "./report.service.js";

export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  async ticketsSummary(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.reportService.ticketsSummary(
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
