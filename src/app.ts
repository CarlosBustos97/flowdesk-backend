import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import prisma from "./plugins/prisma.js";
import redis from "./plugins/redis.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import swagger from "./plugins/swagger.js";
import { registerErrorHandler } from "./common/errors/error-handler.js";
import { requestScope } from "./common/auth/request-scope.js";
import authorization from "./plugins/authorization.js";
import { userRoutes } from "./modules/users/user.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { projectRoutes } from "./modules/projects/project.routes.js";
import { ticketCategoryRoutes } from "./modules/ticket-categories/ticket-category.routes.js";
import { slaPolicyRoutes } from "./modules/sla-policies/sla-policy.routes.js";
import { ticketRoutes } from "./modules/tickets/ticket.routes.js";
import { commentRoutes } from "./modules/comments/comment.routes.js";
import multipartPlugin from "./plugins/multipart.js";
import { attachmentRoutes } from "./modules/attachments/attachment.routes.js";
import { slaCalendarRoutes } from "./modules/sla-calendars/sla-calendar.routes.js";
import { slaBusinessHourRoutes } from "./modules/sla-calendars/business-hours/sla-business-hour.routes.js";
import { slaHolidayRoutes } from "./modules/sla-calendars/holidays/sla-holiday.routes.js";
import { notificationRoutes } from "./modules/notifications/notification.routes.js";
import { auditLogRoutes } from "./modules/audit-logs/audit-log.routes.js";
import { workflowRoutes } from "./modules/workflows/workflow.routes.js";
import { reportRoutes } from "./modules/reports/report.routes.js";
import { apiKeyRoutes } from "./modules/api-keys/api-key.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    global: false,
  });

  app.addHook("onRequest", (_request, _reply, done) => {
    requestScope.run({ organizationBound: false }, done);
  });

  // Pulgins
  await app.register(prisma);
  await app.register(redis);
  await app.register(authorization);
  await app.register(swagger);
  await app.register(multipartPlugin);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(customerRoutes);
  await app.register(projectRoutes);
  await app.register(ticketCategoryRoutes);
  await app.register(slaPolicyRoutes);
  await app.register(ticketRoutes);
  await app.register(commentRoutes);
  await app.register(attachmentRoutes);
  await app.register(slaCalendarRoutes);
  await app.register(slaBusinessHourRoutes);
  await app.register(slaHolidayRoutes);
  await app.register(notificationRoutes);
  await app.register(auditLogRoutes);
  await app.register(workflowRoutes);
  await app.register(reportRoutes);
  await app.register(apiKeyRoutes);

  return app;
}
