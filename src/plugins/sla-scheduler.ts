import fp from "fastify-plugin";
import { SlaService } from "../modules/sla-policies/sla.service.js";

const SLA_INTERVAL_MS = 60_000;

export default fp(async (app) => {
    const slaService = new SlaService(app.prisma);

    let isRunning = false;
    let activeEvaluation: Promise<void> | undefined;

    const evaluateSlas = async (): Promise<void> => {
        if (isRunning) {
            app.log.warn("Evaluación de SLA omitida: ya hay una ejecución en curso");
            return;
        }

        isRunning = true;

        activeEvaluation = (async () => {
            try {
                const processed = await slaService.evaluateDueTicketSlas();

                app.log.info(
                    { processed },
                    "Evaluación periódica de SLA completada",
                );
            } catch (error) {
                app.log.error(error, "Error durante la evaluación periódica de SLA");
            } finally {
                isRunning = false;
                activeEvaluation = undefined;
            }
        })();

        await activeEvaluation;
    };

    const interval = setInterval(() => {
        void evaluateSlas();
    }, SLA_INTERVAL_MS);

    app.addHook("onClose", async () => {
        clearInterval(interval);

        if (activeEvaluation) {
            await activeEvaluation;
        }
    });

    void evaluateSlas();
});

