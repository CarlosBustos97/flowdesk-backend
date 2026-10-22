import { UserStatus } from "@prisma/client";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { authGuard } from "./auth.guard.js";

function requestFor(status: UserStatus, expiresAt = new Date(Date.now() + 60_000)) {
  const token = "token-de-prueba";
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return {
    token,
    tokenHash,
    request: {
      headers: { authorization: `Bearer ${token}` },
      server: {
        prisma: {
          session: {
            findUnique: async (args: { where: { tokenHash: string } }) => {
              if (args.where.tokenHash !== tokenHash) return null;

              return {
                id: "session-1",
                expiresAt,
                user: {
                  id: "user-1",
                  organizationId: "org-1",
                  name: "Ana",
                  email: "ana@acme.test",
                  status,
                },
              };
            },
          },
        },
      },
    },
  };
}

describe("authGuard", () => {
  it("rechaza la sesión cuando el usuario ya no está ACTIVE", async () => {
    const { request } = requestFor(UserStatus.INACTIVE);

    await expect(authGuard(request as never)).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid or expired session",
    });
  });

  it("acepta la sesión de un usuario ACTIVE", async () => {
    const { request } = requestFor(UserStatus.ACTIVE);

    await authGuard(request as never);

    expect(request).toMatchObject({
      user: { id: "user-1", organizationId: "org-1" },
      auth: { sessionId: "session-1" },
    });
  });
});
