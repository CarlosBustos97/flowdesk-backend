import fp from "fastify-plugin";

import AuthorizationService from "../modules/auth/authorization.service.js";

export default fp(async (app) => {
  const authorizationService = new AuthorizationService(app.prisma);

  app.decorate("authorizationService", authorizationService);
});
