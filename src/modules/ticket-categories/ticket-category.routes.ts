import type { FastifyInstance } from "fastify";
import type {
  TicketCategoryCreateBody,
  TicketCategoryListQuery,
  TicketCategoryShowParams,
  TicketCategoryUpdateParams,
  TicketcategoryUpdateBody,
} from "./ticket-category.types.js";
import {
  ticketCategoryCreateSchema,
  ticketCategoryListSchema,
  ticketCategoryShowSchema,
  ticketCategoryUpdateSchema,
} from "./ticket-category.schema.js";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import { TicketCategoryController } from "./ticket-category.controller.js";
import { TicketCategoryService } from "./ticket-category.service.js";

export async function ticketCategoryRoutes(app: FastifyInstance) {
  const ticketCategoryController = new TicketCategoryController(
    new TicketCategoryService(app.prisma, app.authorizationService),
  );

  app.get<{ Querystring: TicketCategoryListQuery }>(
    "/ticket-categories",
    {
      schema: ticketCategoryListSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.TICKET_CATEGORIES_VIEW),
      ],
    },
    ticketCategoryController.list.bind(ticketCategoryController),
  );

  app.get<{ Params: TicketCategoryShowParams }>(
    "/ticket-categories/:id",
    {
      schema: ticketCategoryShowSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.TICKET_CATEGORIES_VIEW),
      ],
    },
    ticketCategoryController.show.bind(ticketCategoryController),
  );

  app.post<{ Body: TicketCategoryCreateBody }>(
    "/ticket-categories",
    {
      schema: ticketCategoryCreateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.TICKET_CATEGORIES_CREATE),
      ],
    },
    ticketCategoryController.create.bind(ticketCategoryController),
  );

  app.patch<{
    Params: TicketCategoryUpdateParams;
    Body: TicketcategoryUpdateBody;
  }>(
    "/ticket-categories/:id",
    {
      schema: ticketCategoryUpdateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.TICKET_CATEGORIES_UPDATE),
      ],
    },
    ticketCategoryController.update.bind(ticketCategoryController),
  );

  app.patch<{ Params: TicketCategoryUpdateParams }>(
    "/ticket-categories/:id/activate",
    {
      schema: ticketCategoryShowSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.TICKET_CATEGORIES_UPDATE),
      ],
    },
    ticketCategoryController.activate.bind(ticketCategoryController),
  );

  app.patch<{ Params: TicketCategoryUpdateParams }>(
    "/ticket-categories/:id/deactivate",
    {
      schema: ticketCategoryShowSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.TICKET_CATEGORIES_DELETE),
      ],
    },
    ticketCategoryController.deactivate.bind(ticketCategoryController),
  );
}
