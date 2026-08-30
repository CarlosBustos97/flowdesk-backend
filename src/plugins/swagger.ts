import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export default fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FlowDesk API',
        description:
          'API REST para la plataforma de gestión de tickets, proyectos y soporte de FlowDesk.',
        version: '1.0.0',
      },

      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],

      tags: [
        {
          name: 'Health',
          description: 'Application health checks',
        },
        {
          name: 'Authentication',
          description: 'Authentication and session management',
        },
        {
          name: 'Users',
          description: 'User management',
        },
        {
          name: 'Organizations',
          description: 'Organization management',
        },
        {
          name: 'Customers',
          description: 'Customer management',
        },
        {
          name: 'Projects',
          description: 'Project management',
        },
        {
          name: 'Tasks',
          description: 'Task management',
        },
        {
          name: 'Tickets',
          description: 'Ticket management',
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',

    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },

    staticCSP: true,
  });
});