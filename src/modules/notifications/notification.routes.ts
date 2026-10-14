import type { FastifyInstance } from "fastify";
import { NotificationController } from "./notification.controller.js";
import { NotificationService } from "./notification.service.js";
import type {
  NotificationListQuery,
  NotificationReadParams,
} from "./notification.types.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import {
  notificationListSchema,
  notificationReadSchema,
} from "./notification.schema.js";
import { authGuard } from "../auth/auth.guard.js";

export async function notificationRoutes(app: FastifyInstance) {
  const notificationController = new NotificationController(
    new NotificationService(app.prisma),
  );

  app.get<{ Querystring: NotificationListQuery }>(
    "/notifications",
    {
      schema: notificationListSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.NOTIFICATIONS_LIST),
      ],
    },
    notificationController.list.bind(notificationController),
  );

  app.get(
    "/notifications/count-unread",
    {
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.NOTIFICATIONS_COUNT_UNREAD),
      ],
    },
    notificationController.countUnread.bind(notificationController),
  );

  app.patch<{ Params: NotificationReadParams }>(
    "/notifications/mark-as-read",
    {
      schema: notificationReadSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.NOTIFICATIONS_MARK_AS_READ),
      ],
    },
    notificationController.markAsRead.bind(notificationController),
  );

  app.patch(
    "/notifications/mark-all-as-read",
    {
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.NOTIFICATIONS_MARK_ALL_AS_READ),
      ],
    },
    notificationController.markAllAsRead.bind(notificationController),
  );
}
