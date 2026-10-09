import type { FastifyInstance } from "fastify";
import { SlaHolidayController } from "./sla-holiday.controller.js";
import { SlaHolidayService } from "./sla-holiday.service.js";
import type {
  SlaHolidayCreateBody,
  SlaHolidayCreateParams,
  SlaHolidayDeleteParams,
  SlaHolidayListParams,
} from "./sla-holiday.types.js";
import { authGuard } from "../../auth/auth.guard.js";
import { PERMISSIONS } from "../../../common/auth/permissions.js";
import { requirePermission } from "../../../common/guards/permission.guard.js";
import {
  slaHolidayCreateSchema,
  slaHolidayDeleteSchema,
  slaHolidayListSchema,
} from "./sla-holiday.schema.js";

export async function slaHolidayRoutes(app: FastifyInstance) {
  const slaHolidayController = new SlaHolidayController(
    new SlaHolidayService(app.prisma, app.authorizationService),
  );

  app.get<{ Params: SlaHolidayListParams }>(
    "/sla-calendars/:id/holidays",
    {
      schema: slaHolidayListSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_VIEW),
      ],
    },
    slaHolidayController.list.bind(slaHolidayController),
  );

  app.post<{ Params: SlaHolidayCreateParams; Body: SlaHolidayCreateBody }>(
    "/sla-calendars/:id/holidays",
    {
      schema: slaHolidayCreateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_CREATE),
      ],
    },
    slaHolidayController.create.bind(slaHolidayController),
  );

  app.delete<{ Params: SlaHolidayDeleteParams }>(
    "/sla-calendars/:id/holidays/:holidayId",
    {
      schema: slaHolidayDeleteSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_UPDATE),
      ],
    },
    slaHolidayController.delete.bind(slaHolidayController),
  );
}
