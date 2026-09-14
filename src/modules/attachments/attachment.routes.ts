import type { FastifyInstance } from "fastify";
import { AttachmentController } from "./attachment.controller.js";
import { AttachmentService } from "./attachment.service.js";
import {
  attachmentCreateSchema,
  attachmentDeleteSchema,
  attachmentListSchema,
} from "./attachment.schema.js";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import type {
  AttachmentCreateParams,
  AttachmentDeleteParams,
  AttachmentListParams,
  AttachmentListQuery,
} from "./attachment.types.js";

export async function attachmentRoutes(app: FastifyInstance) {
  const attachmentController = new AttachmentController(
    new AttachmentService(app.prisma, app.authorizationService),
  );
  app.post<{ Params: AttachmentCreateParams }>(
    "/tickets/:ticketId/attachments",
    {
      schema: attachmentCreateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.ATTACHMENTS_CREATE),
      ],
    },
    attachmentController.create.bind(attachmentController),
  );

  app.get<{
    Params: AttachmentListParams;
    Querystring: AttachmentListQuery;
  }>(
    "/tickets/:ticketId/attachments",
    {
      schema: attachmentListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.ATTACHMENTS_VIEW)],
    },
    attachmentController.list.bind(attachmentController),
  );

  app.delete<{ Params: AttachmentDeleteParams }>(
    "/attachments/:id",
    {
      schema: attachmentDeleteSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.ATTACHMENTS_DELETE),
      ],
    },
    attachmentController.delete.bind(attachmentController),
  );
}
