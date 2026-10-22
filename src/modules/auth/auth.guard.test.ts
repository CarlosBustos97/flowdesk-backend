import { UserStatus } from "@prisma/client";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashSecret } from "../../common/auth/hash-secret.js";
import { requestScope } from "../../common/auth/request-scope.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";
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

function apiKeyRequest(options: {
  secret: string;
  organizationId?: string;
  scopes?: string[];
  revokedAt?: Date | null;
  expiresAt?: Date | null;
}) {
  let wasUpdated = false;
  const keyHash = hashSecret(options.secret);
  const request = {
    headers: { "x-api-key": options.secret },
    server: {
      prisma: {
        apiKey: {
          findUnique: async (args: { where: { keyHash: string } }) => {
            if (args.where.keyHash !== keyHash) return null;

            return {
              id: "key-1",
              organizationId: options.organizationId ?? "org-a",
              revokedAt: options.revokedAt ?? null,
              expiresAt: options.expiresAt ?? null,
              scopes: options.scopes ?? ["tickets.view"],
              createdBy: {
                id: "user-owner",
                organizationId: "org-owner",
                name: "Olga",
                email: "olga@acme.test",
                status: UserStatus.ACTIVE,
              },
            };
          },
          update: async () => {
            wasUpdated = true;
            return {};
          },
        },
      },
    },
  };

  return { request, updated: () => wasUpdated };
}

describe("authGuard", () => {
  it("rechaza la sesión cuando el usuario ya no está ACTIVE", async () => {
    const { request } = requestFor(UserStatus.INACTIVE);

    await expect(authGuard(request as never)).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid or expired session",
    });
  });

  it("usa el mismo mensaje si la sesión caducó", async () => {
    const { request } = requestFor(
      UserStatus.ACTIVE,
      new Date(Date.now() - 60_000),
    );

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

  it("con bearer no consulta la clave de API", async () => {
    let lookups = 0;
    const { request } = requestFor(UserStatus.ACTIVE);
    const headers = request.headers as { authorization: string; "x-api-key"?: string };
    headers["x-api-key"] = "fdk_otra";
    (request.server.prisma as { apiKey?: { findUnique: () => Promise<null> } }).apiKey = {
      findUnique: async () => {
        lookups += 1;
        return null;
      },
    };

    await authGuard(request as never);

    expect(lookups).toBe(0);
    expect(request).toMatchObject({
      auth: { sessionId: "session-1" },
    });
  });

  it("acepta una clave vigente y la ata a su organización", async () => {
    const secret = "fdk_clave-valida";
    const { request, updated } = apiKeyRequest({
      secret,
      organizationId: "org-a",
      scopes: ["tickets.view"],
    });

    await requestScope.run({ organizationBound: false }, async () => {
      await authGuard(request as never);

      expect(updated()).toBe(true);
      expect(request).toMatchObject({
        user: { id: "user-owner", organizationId: "org-a" },
        auth: { apiKeyId: "key-1", scopes: ["tickets.view"] },
      });
    });
  });

  it("rechaza una clave revocada", async () => {
    const { request, updated } = apiKeyRequest({
      secret: "fdk_revocada",
      revokedAt: new Date(),
    });

    await expect(authGuard(request as never)).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid or revoked API key",
    });
    expect(updated()).toBe(false);
  });

  it("rechaza una clave caducada", async () => {
    const { request } = apiKeyRequest({
      secret: "fdk_caducada",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(authGuard(request as never)).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid or revoked API key",
    });
  });
});

describe("permiso de una clave", () => {
  it("responde 403 cuando el scope no está en la clave", async () => {
    const guard = requirePermission(PERMISSIONS.TICKETS_VIEW);
    const hasPermission = async () => true;

    await expect(
      guard({
        auth: { apiKeyId: "key-1", scopes: ["reports.view"] },
        user: { id: "user-1", organizationId: "org-1" },
        server: { authorizationService: { hasPermission } },
      } as never),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Insufficient permissions",
    });
  });
});
