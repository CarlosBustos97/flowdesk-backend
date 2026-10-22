import {
  type PrismaClient,
} from "@prisma/client";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { hashSecret } from "../../common/auth/hash-secret.js";
import {
  bindOrganization,
  isOrganizationBound,
  requestScope,
} from "../../common/auth/request-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import AuthorizationService from "../auth/authorization.service.js";
import { authGuard } from "../auth/auth.guard.js";
import { TicketService } from "../tickets/ticket.service.js";
import { ApiKeyService } from "./api-key.service.js";

type StoredKey = {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdById: string;
  createdAt: Date;
};

function harness() {
  const keys: StoredKey[] = [];
  const audits: Array<{ action: string; newValues?: Record<string, unknown> }> = [];

  const db = {
    organization: {
      findUnique: async () => ({ id: "org-1" }),
    },
    apiKey: {
      create: async (args: { data: Omit<StoredKey, "id" | "createdAt" | "lastUsedAt" | "revokedAt">; select?: object }) => {
        const row: StoredKey = {
          id: "key-1",
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date("2026-10-22T12:00:00.000Z"),
          expiresAt: null,
          ...args.data,
        };
        keys.push(row);
        return project(row, args.select);
      },
      findMany: async (args: { select?: object }) => keys.map((row) => project(row, args.select)),
      count: async () => keys.length,
      findFirst: async (args: { where: { id: string } }) =>
        keys.find((row) => row.id === args.where.id) ?? null,
      update: async (args: { where: { id: string }; data: { revokedAt: Date }; select?: object }) => {
        const row = keys.find((item) => item.id === args.where.id);
        if (!row) throw new Error("key missing");
        row.revokedAt = args.data.revokedAt;
        return project(row, args.select);
      },
    },
    $transaction: async (argument: unknown) => {
      if (typeof argument === "function") {
        return (argument as (tx: typeof db) => Promise<unknown>)(db);
      }
      return Promise.all(argument as Promise<unknown>[]);
    },
  };

  const service = new ApiKeyService(
    db as unknown as PrismaClient,
    {
      getScope: async () => "ORGANIZATION",
      hasPermission: async (_userId: string, _orgId: string, code: string) =>
        code === "tickets.view",
    } as unknown as AuthorizationService,
    {
      record: async (data: { action: string; newValues?: Record<string, unknown> }) => {
        audits.push(data);
        return { id: "audit-1" };
      },
    } as never,
  );

  return { service, keys, audits };
}

function project(row: StoredKey, select?: object) {
  if (!select) return row;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(select)) {
    if (value === true) output[key] = row[key as keyof StoredKey];
    if (value && typeof value === "object") output[key] = { id: row.organizationId };
  }

  return output;
}

describe("claves de API", () => {
  it("devuelve el secreto al crearla y no lo guarda ni lo lista", async () => {
    const { service, keys, audits } = harness();

    const created = await service.create(
      {
        organizationId: "org-1",
        name: "Integración",
        scopes: ["tickets.view"],
      },
      "user-1",
      "org-1",
    );

    expect(created.secret.startsWith("fdk_")).toBe(true);
    expect(keys[0]?.keyHash).toBe(hashSecret(created.secret));
    expect(JSON.stringify(keys[0])).not.toContain(created.secret);
    expect(JSON.stringify(audits)).not.toContain(created.secret);
    expect(JSON.stringify(audits)).not.toContain(keys[0]?.keyHash);
    expect(audits[0]?.action).toBe("api_key.created");

    const listed = await service.list({}, "user-1", "org-1");
    const serialized = JSON.stringify(listed);

    expect(serialized).not.toContain(created.secret);
    expect(serialized).not.toContain(keys[0]?.keyHash ?? "");
    expect(listed.apiKeys[0]).not.toHaveProperty("secret");
    expect(listed.apiKeys[0]).not.toHaveProperty("keyHash");
  });

  it("revoca la clave y lo deja en el audit", async () => {
    const { service, keys, audits } = harness();
    await service.create(
      {
        organizationId: "org-1",
        name: "Integración",
        scopes: ["tickets.view"],
      },
      "user-1",
      "org-1",
    );

    const revoked = await service.revoke("key-1", "user-1", "org-1");

    expect(keys[0]?.revokedAt).toBeInstanceOf(Date);
    expect(revoked).not.toHaveProperty("secret");
    expect(audits.map((item) => item.action)).toContain("api_key.revoked");
  });

  it("rechaza un scope que no existe y uno que el usuario no tiene", async () => {
    const { service } = harness();

    await expect(
      service.create(
        {
          organizationId: "org-1",
          name: "Rara",
          scopes: ["not.a.scope"],
        },
        "user-1",
        "org-1",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.create(
        {
          organizationId: "org-1",
          name: "Usuarios",
          scopes: ["users.delete"],
        },
        "user-1",
        "org-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You cannot grant a permission you do not have",
    });
  });

  it("una clave de la org A no abre un ticket de la org B", async () => {
    const secret = "fdk_org-a";
    const keyHash = hashSecret(secret);
    let queriedOrganizationId: string | undefined;
    const request = {
      headers: { "x-api-key": secret },
      server: {
        prisma: {
          apiKey: {
            findUnique: async (args: { where: { keyHash: string } }) => {
              if (args.where.keyHash !== keyHash) return null;
              return {
                id: "key-1",
                organizationId: "org-a",
                revokedAt: null,
                expiresAt: null,
                scopes: ["tickets.view"],
                createdBy: {
                  id: "user-owner",
                  name: "Olga",
                  email: "olga@acme.test",
                  status: "ACTIVE",
                },
              };
            },
            update: async () => ({}),
          },
        },
      },
    };

    const authorization = new AuthorizationService({
      user: {
        findUnique: async () => ({
          roles: [
            {
              role: {
                name: "OWNER",
                organizationId: null,
                isGlobal: true,
              },
            },
          ],
        }),
      },
    } as unknown as PrismaClient);

    const tickets = new TicketService(
      {
        ticket: {
          findFirst: async (args: { where: { id: string; organizationId?: string } }) => {
            queriedOrganizationId = args.where.organizationId;
            if (args.where.organizationId) return null;
            return { id: args.where.id };
          },
        },
      } as unknown as PrismaClient,
      authorization,
      {} as never,
      {} as never,
      {} as never,
      { run: async () => undefined } as never,
    );

    await requestScope.run({ organizationBound: false }, async () => {
      await authGuard(request as never);

      await expect(
        tickets.findById("ticket-b", request.user?.id ?? "", "org-a"),
      ).rejects.toBeInstanceOf(AppError);

      await expect(
        tickets.findById("ticket-b", "user-owner", "org-a"),
      ).rejects.toMatchObject({ statusCode: 404, message: "Ticket not found" });
    });

    expect(queriedOrganizationId).toBe("org-a");
  });

  it("mantiene el alcance dentro de la petición HTTP", async () => {
    const app = Fastify({ logger: false });
    app.addHook("onRequest", (_request, _reply, done) => {
      requestScope.run({ organizationBound: false }, done);
    });
    app.get("/probe", async () => {
      bindOrganization(true);
      return { bound: isOrganizationBound() };
    });

    const response = await app.inject({ method: "GET", url: "/probe" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ bound: true });
    await app.close();
  });
});
