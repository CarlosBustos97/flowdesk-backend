import type { FastifyInstance } from "fastify";
import { TicketController } from "./ticket.controller.js";
import { TicketService } from "./ticket.service.js";
import type {
  TicketCreateBody,
  TicketListQuery,
  TicketShowParams,
  TicketUpdateBody,
  TicketUpdateParams,
} from "./ticket.types.js";
import {
  ticketCreateSchema,
  ticketListSchema,
  ticketShowSchema,
  ticketUpdateSchema,
} from "./ticket.schema.js";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";

export async function ticketRoutes(app: FastifyInstance) {
  const ticketController = new TicketController(
    new TicketService(app.prisma, app.authorizationService),
  );

  app.get<{ Querystring: TicketListQuery }>(
    "/tickets",
    {
      schema: ticketListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_VIEW)],
    },
    ticketController.list.bind(ticketController),
  );

  app.get<{ Params: TicketShowParams }>(
    "/tickets/:id",
    {
      schema: ticketShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_VIEW)],
    },
    ticketController.show.bind(ticketController),
  );

  app.post<{ Body: TicketCreateBody }>(
    "/tickets",
    {
      schema: ticketCreateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_CREATE)],
    },
    ticketController.create.bind(ticketController),
  );

  app.patch<{ Params: TicketUpdateParams; Body: TicketUpdateBody }>(
    "/tickets/:id",
    {
      schema: ticketUpdateSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_UPDATE)],
    },
    ticketController.update.bind(ticketController),
  );

  app.patch<{ Params: TicketShowParams }>(
    "/tickets/:id/start",
    {
      schema: ticketShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_UPDATE)],
    },
    ticketController.start.bind(ticketController),
  );

  app.patch<{ Params: TicketShowParams }>(
    "/tickets/:id/pending",
    {
      schema: ticketShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_UPDATE)],
    },
    ticketController.pending.bind(ticketController),
  );

  app.patch<{ Params: TicketShowParams }>(
    "/tickets/:id/resolve",
    {
      schema: ticketShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_RESOLVE)],
    },
    ticketController.resolve.bind(ticketController),
  );

  app.patch<{ Params: TicketShowParams }>(
    "/tickets/:id/close",
    {
      schema: ticketShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_CLOSE)],
    },
    ticketController.close.bind(ticketController),
  );

  app.patch<{ Params: TicketShowParams }>(
    "/tickets/:id/reopen",
    {
      schema: ticketShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.TICKETS_UPDATE)],
    },
    ticketController.reopen.bind(ticketController),
  );
}
