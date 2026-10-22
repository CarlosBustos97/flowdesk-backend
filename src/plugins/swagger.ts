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

      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Api-Key',
          },
        },
      },

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
          name: 'Customers',
          description: 'Customer management',
        },
        {
          name: 'Projects',
          description: 'Project management',
        },
        {
          name: 'Tickets',
          description: 'Ticket management',
        },
        {
          name: 'Comments',
          description: 'Ticket comments',
        },
        {
          name: 'Attachments',
          description: 'Ticket attachments',
        },
        {
          name: 'Notifications',
          description: 'User notifications',
        },
        {
          name: 'SLA Calendars',
          description: 'SLA calendars, business hours and holidays',
        },
        {
          name: 'SLA Policies',
          description: 'SLA policies',
        },
        {
          name: 'Workflows',
          description: 'Ticket workflows',
        },
        {
          name: 'Audit Logs',
          description: 'Audit log',
        },
        {
          name: 'Reports',
          description: 'Ticket reports',
        },
        {
          name: 'API Keys',
          description: 'Organization API keys',
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