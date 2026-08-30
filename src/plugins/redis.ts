import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

import { env } from '../config/env.js';

const redis = new Redis(env.REDIS_URL);

redis.on('connect', () => {
  console.log('Redis conectado');
});

redis.on('error', (error) => {
  console.error('Error de Redis:', error);
});

export default fp(async (app) => {
  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    await redis.quit();
  });
});