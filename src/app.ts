import Fastify from 'fastify';
import prisma from './plugins/prisma.js';
import redis from './plugins/redis.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import swagger from './plugins/swagger.js';
import { registerErrorHandler } from './common/errors/error-handler.js';
import authorization from './plugins/authorization.js';


export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  registerErrorHandler(app);

  await app.register(prisma);
  await app.register(redis);
  await app.register(authorization);
  await app.register(swagger);
  await app.register(authRoutes);

  // Routes
  await app.register(healthRoutes);

  return app;
}