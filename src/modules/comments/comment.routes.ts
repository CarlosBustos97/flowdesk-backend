import type { FastifyInstance } from "fastify";
import { CommentController } from "./comment.controller.js";
import { CommentService } from "./comment.service.js";
import type {
  CommentCreateBody,
  CommentCreateParams,
  CommentDeleteParams,
  CommentListParams,
  CommentListQuery,
  CommentUpdateBody,
  CommentUpdateParams,
} from "./comment.types.js";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import {
  commentCreateSchema,
  commentDeleteSchema,
  commentListSchema,
  commentUpdateSchema,
} from "./comment.schema.js";
import { NotificationService } from "../notifications/notification.service.js";
import { AuditLogService } from "../audit-logs/audit-log.service.js";

export async function commentRoutes(app: FastifyInstance) {
  const commentController = new CommentController(
    new CommentService(
      app.prisma,
      app.authorizationService,
      new NotificationService(app.prisma),
      new AuditLogService(app.prisma, app.authorizationService),
    ),
  );

  app.get<{ Params: CommentListParams; Querystring: CommentListQuery }>(
    "/tickets/:ticketId/comments",
    {
      schema: commentListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.COMMENTS_VIEW)],
    },
    commentController.list.bind(commentController),
  );

  app.post<{ Params: CommentCreateParams; Body: CommentCreateBody }>(
    "/tickets/:ticketId/comments",
    {
      schema: commentCreateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.COMMENTS_CREATE)],
    },
    commentController.create.bind(commentController),
  );

  app.patch<{ Params: CommentUpdateParams; Body: CommentUpdateBody }>(
    "/comments/:id",
    {
      schema: commentUpdateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.COMMENTS_UPDATE)],
    },
    commentController.update.bind(commentController),
  );

  app.delete<{ Params: CommentDeleteParams }>(
    "/comments/:id",
    {
      schema: commentDeleteSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.COMMENTS_DELETE)],
    },
    commentController.delete.bind(commentController),
  );
}
