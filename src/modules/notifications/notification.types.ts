import type { NotificationType } from "@prisma/client";

export interface NotificationCreateInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

export type NotificationReadParams = {
  id: string;
};
