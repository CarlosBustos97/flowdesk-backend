import type { Priority, SlaStatus, TicketStatus } from "@prisma/client";

export type TicketSummary = {
  byStatus: Record<
    Exclude<TicketStatus, "CLOSED">,
    number
  >;
  byPriority: Record<Priority, number>;
  resolutionSla: Record<Extract<SlaStatus, "AT_RISK" | "BREACHED">, number>;
};
