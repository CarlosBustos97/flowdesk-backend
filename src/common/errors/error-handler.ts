import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { AppError } from "./app-error.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(
    (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      // Errores de validación de Fastify
      if (error.validation) {
        return reply.status(400).send({
          success: false,
          error: {
            message: "Validation error",
            details: error.validation,
          },
        });
      }

      // Errores controlados de nuestra aplicación
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
          },
        });
      }

      if (
        typeof error.statusCode === "number" &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
          },
        });
      }

      // Errores inesperados
      app.log.error(error);

      return reply.status(500).send({
        success: false,
        error: {
          message: "Internal server error",
        },
      });
    },
  );
}
