import type { FastifyInstance } from "fastify";
import { SlaBusinessHourController } from "./sla-business-hour.controller.js";
import { SlaBusinessHourService } from "./sla-business-hour.service.js";
import type {
  SlaBusinessHoursParams,
  SlaBusinessHoursUpdateBody,
} from "./sla-business-hour.types.js";
import {
  SlaBusinessHoursListSchema,
  SlaBusinessHoursUpdateSchema,
} from "./sla-business-hour.schema.js";
import { authGuard } from "../../auth/auth.guard.js";
import { requirePermission } from "../../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../../common/auth/permissions.js";

export async function slaBusinessHourRoutes(app: FastifyInstance) {
  const slaBusinessHourController = new SlaBusinessHourController(
    new SlaBusinessHourService(app.prisma, app.authorizationService),
  );

  app.get<{ Params: SlaBusinessHoursParams }>(
    "/sla-calendars/:id/business-hours",
    {
      schema: SlaBusinessHoursListSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_VIEW),
      ],
    },
    slaBusinessHourController.list.bind(slaBusinessHourController),
  );

  app.put<{ Params: SlaBusinessHoursParams; Body: SlaBusinessHoursUpdateBody }>(
    "/sla-calendars/:id/business-hours",
    {
      schema: SlaBusinessHoursUpdateSchema,
      preHandler: [
        authGuard,
        requirePermission(PERMISSIONS.SLA_CALENDARS_UPDATE),
      ],
    },
    slaBusinessHourController.update.bind(slaBusinessHourController),
  );
}
