import type { PrismaClient } from "@prisma/client";

import { AppError } from "../../common/errors/app-error.js";
import type {
  NotificationCreateInput,
  NotificationListQuery,
} from "./notification.types.js";

export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NotificationCreateInput) {
    return this.prisma.notification.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        ...(data.entityType !== undefined
          ? { entityType: data.entityType }
          : {}),
        ...(data.entityId !== undefined ? { entityId: data.entityId } : {}),
      },
    });
  }

  async list(
    query: NotificationListQuery,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (!requesterOrganizationId) {
      return {
        notifications: [],
        pagination: {
          page: page,
          limit: limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where = {
      userId: requesterUserId,
      organizationId: requesterOrganizationId,
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
    };

    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async countUnread(requesterUserId: string, requesterOrganizationId: string) {
    if (!requesterOrganizationId) {
      return {
        count: 0,
      };
    }

    const where = {
      userId: requesterUserId,
      organizationId: requesterOrganizationId,
      isRead: false,
    };

    const notificationsUnreadCount = await this.prisma.notification.count({
      where,
    });

    return {
      count: notificationsUnreadCount,
    };
  }

  async markAsRead(
    notificationId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    if (!requesterOrganizationId)
      throw new AppError(404, "Organization is required");

    const where = {
      id: notificationId,
      userId: requesterUserId,
      organizationId: requesterOrganizationId,
    };

    const notificationExists = await this.prisma.notification.findFirst({
      where,
    });
    if (!notificationExists) throw new AppError(404, "Notification not found");

    if (notificationExists.isRead) return notificationExists;

    return await this.prisma.notification.update({
      where: {
        ...where,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    if (!requesterOrganizationId) {
      return {
        updatedCount: 0,
      };
    }
    const where = {
      userId: requesterUserId,
      organizationId: requesterOrganizationId,
      isRead: false,
    };

    const notifications = await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });

    return {
      updatedCount: notifications.count,
    };
  }
}
