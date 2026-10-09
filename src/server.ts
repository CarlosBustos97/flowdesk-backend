import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import slaScheduler from "./plugins/sla-scheduler.js";

async function start() {
  const app = await buildApp();

  await app.register(slaScheduler);

  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    app.log.info({ signal }, "Cerrando aplicación");

    try {
      await app.close();
      app.log.info("Aplicación cerrada correctamente");
    } catch (error) {
      app.log.error(error, "Error al cerrar la aplicación");
      process.exitCode = 1;
    }
  };

  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    process.once("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error) {
    app.log.error(error, "Error al iniciar la aplicación");

    try {
      await app.close();
    } catch (closeError) {
      app.log.error(closeError, "Error al cerrar recursos tras el fallo");
    }

    process.exitCode = 1;
  }
}

void start();

