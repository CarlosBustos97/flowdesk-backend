import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../common/errors/app-error.js";
import { TicketController } from "./ticket.controller.js";

function reply() {
  const send = vi.fn();

  return {
    status: vi.fn().mockReturnValue({ send }),
    send,
  };
}

describe("GET /tickets/:id/sla", () => {
  it("no evalúa el SLA si el ticket está fuera del alcance", async () => {
    const evaluateTicketSla = vi.fn();
    const controller = new TicketController(
      {
        findById: vi
          .fn()
          .mockRejectedValue(new AppError(404, "Ticket not found")),
      } as never,
      { evaluateTicketSla } as never,
    );

    await expect(
      controller.sla(
        {
          params: { id: "ticket-ajeno" },
          user: { id: "user-1", organizationId: "org-1" },
        } as never,
        reply() as never,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(evaluateTicketSla).not.toHaveBeenCalled();
  });

  it("evalúa el SLA cuando el ticket está en el alcance del solicitante", async () => {
    const evaluateTicketSla = vi.fn().mockResolvedValue({ id: "sla-1" });
    const findById = vi.fn().mockResolvedValue({ id: "ticket-1" });
    const response = reply();
    const controller = new TicketController(
      { findById } as never,
      { evaluateTicketSla } as never,
    );

    await controller.sla(
      {
        params: { id: "ticket-1" },
        user: { id: "user-1", organizationId: "org-1" },
      } as never,
      response as never,
    );

    expect(findById).toHaveBeenCalledWith("ticket-1", "user-1", "org-1");
    expect(evaluateTicketSla).toHaveBeenCalledOnce();
    expect(evaluateTicketSla).toHaveBeenCalledWith("ticket-1");
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
