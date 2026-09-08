import Fastify from 'fastify';
import prisma from './plugins/prisma.js';
import redis from './plugins/redis.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import swagger from './plugins/swagger.js';
import { registerErrorHandler } from './common/errors/error-handler.js';
import authorization from './plugins/authorization.js';
import { userRoutes } from './modules/users/user.routes.js';
import { customerRoutes } from './modules/customers/customer.routes.js';
import { projectRoutes } from './modules/projects/project.routes.js';
import { ticketCategoryRoutes } from './modules/ticket-categories/ticket-category.routes.js';


export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);

  // Pulgins
  await app.register(prisma);
  await app.register(redis);
  await app.register(authorization);
  await app.register(swagger);
  
  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(customerRoutes);
  await app.register(projectRoutes);
  await app.register(ticketCategoryRoutes);


  return app;
}