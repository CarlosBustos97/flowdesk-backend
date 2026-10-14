import type { FastifyReply, FastifyRequest } from "fastify";
import type { NotificationService } from "./notification.service.js";
import type {
  NotificationListQuery,
  NotificationReadParams,
} from "./notification.types.js";

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  async list(
    request: FastifyRequest<{ Querystring: NotificationListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.notificationService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async countUnread(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.notificationService.countUnread(
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async markAsRead(
    request: FastifyRequest<{ Params: NotificationReadParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.notificationService.markAsRead(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.notificationService.markAllAsRead(
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
