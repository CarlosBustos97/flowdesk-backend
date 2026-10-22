import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuditLogService } from "./audit-log.service.js";
import type { AuditLogListQuery } from "./audit-log.types.js";

export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  async list(
    request: FastifyRequest<{ Querystring: AuditLogListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.auditLogService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
