import type { FastifyInstance } from "fastify";
import { PERMISSIONS } from "../../common/auth/permissions.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { authGuard } from "../auth/auth.guard.js";
import { ReportController } from "./report.controller.js";
import { ticketSummarySchema } from "./report.schema.js";
import { ReportService } from "./report.service.js";

export async function reportRoutes(app: FastifyInstance) {
  const reportController = new ReportController(new ReportService(app.prisma));

  app.get(
    "/reports/tickets-summary",
    {
      schema: ticketSummarySchema,
      preHandler: [authGuard, requirePermission(PERMISSIONS.REPORTS_VIEW)],
    },
    reportController.ticketsSummary.bind(reportController),
  );
}
