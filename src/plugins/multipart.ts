import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";

async function multipartPlugin(app: FastifyInstance) {
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });
}

export default fp(multipartPlugin);