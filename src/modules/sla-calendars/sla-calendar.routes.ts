import type { FastifyInstance } from "fastify";
import { SlaCalendarController } from "./sla-calendar.controller.js";
import { SlaCalendarService } from "./sla-calendar.service.js";
import type {
  SlaCalendarCreateBody,
  SlaCalendarListQuery,
  SlaCalendarShowParams,
  SlaCalendarUpdateBody,
  SlaCalendarUpdateParams,
} from "./sla-calendar.types.js";
import {
  SlaCalendarCreateSchema,
  SlaCalendarListSchema,
  SlaCalendarShowSchema,
  SlaCalendarUpdateSchema,
} from "./sla-calendar.schema.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { authGuard } from "../auth/auth.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";

export async function slaCalendarRoutes(app: FastifyInstance) {
  const slaCalendarController = new SlaCalendarController(
    new SlaCalendarService(app.prisma, app.authorizationService),
  );

  app.get<{ Querystring: SlaCalendarListQuery }>(
    "/sla-calendars",
    {
      schema: SlaCalendarListSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.SLA_CALENDARS_VIEW)],
    },
    slaCalendarController.list.bind(slaCalendarController),
  );

  app.get<{ Params: SlaCalendarShowParams }>(
    "/sla-calendars/:id",
    {
      schema: SlaCalendarShowSchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.SLA_CALENDARS_VIEW)],
    },
    slaCalendarController.show.bind(slaCalendarController),
  );

  app.post<{ Body: SlaCalendarCreateBody }>(
    "/sla-calendars",
    {
      schema: SlaCalendarCreateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_CREATE),
      ],
    },
    slaCalendarController.create.bind(slaCalendarController),
  );

  app.patch<{ Params: SlaCalendarUpdateParams; Body: SlaCalendarUpdateBody }>(
    "/sla-calendars/:id",
    {
      schema: SlaCalendarUpdateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_UPDATE),
      ],
    },
    slaCalendarController.update.bind(slaCalendarController),
  );
}
