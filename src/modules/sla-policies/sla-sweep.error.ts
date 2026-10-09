export type SlaSweepFailure = {
    ticketId: string;
    slaId: string;
    error: unknown;
};

export class SlaSweepError extends Error {
    readonly processed: number;
    readonly failed: number;
    readonly failures: SlaSweepFailure[];

    constructor(processed: number, failures: SlaSweepFailure[]) {
        const cause = failures[0]?.error;

        super(
            `No se pudieron evaluar ${failures.length} SLA de ${processed + failures.length
            }`,
            cause instanceof Error ? { cause } : undefined,
        );

        this.name = "SlaSweepError";
        this.processed = processed;
        this.failed = failures.length;
        this.failures = failures;

    }
}
