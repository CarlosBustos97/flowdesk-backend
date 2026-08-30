import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Verifica que la API esté funcionando correctamente.',
        response: {
          200: {
            description: 'API funcionando correctamente',
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
              },
              status: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        success: true,
        status: 'ok',
      };
    },
  );

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness check',
        description:
          'Verifica que la API y sus dependencias principales estén disponibles.',
        response: {
          200: {
            description: 'Todas las dependencias están disponibles',
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
              },
              status: {
                type: 'string',
              },
              checks: {
                type: 'object',
                properties: {
                  postgres: {
                    type: 'boolean',
                  },
                  redis: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
          503: {
            description: 'Una o más dependencias no están disponibles',
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
              },
              status: {
                type: 'string',
              },
              checks: {
                type: 'object',
                properties: {
                  postgres: {
                    type: 'boolean',
                  },
                  redis: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const checks = {
        postgres: false,
        redis: false,
      };

      try {
        await app.prisma.$queryRaw`SELECT 1`;

        checks.postgres = true;
      } catch (error) {
        request.log.error(
          error,
          'PostgreSQL health check failed',
        );
      }

      try {
        await app.redis.ping();

        checks.redis = true;
      } catch (error) {
        request.log.error(
          error,
          'Redis health check failed',
        );
      }

      const ready = checks.postgres && checks.redis;

      return reply
        .code(ready ? 200 : 503)
        .send({
          success: ready,
          status: ready ? 'ready' : 'not_ready',
          checks,
        });
    },
  );
}