import Fastify from 'fastify';
import prisma from './plugins/prisma.js';
import redis from './plugins/redis.js';
import { healthRoutes } from './modules/health/health.routes.js';
import swagger from './plugins/swagger.js';

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(prisma);
  await app.register(redis);
  await app.register(swagger);

  // Routes
  await app.register(healthRoutes);

  return app;
}