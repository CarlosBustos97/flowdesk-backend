import { describe, expect, it, vi } from "vitest";

const calendarId = "11111111-1111-4111-8111-111111111111";

const { prisma } = vi.hoisted(() => {
  const prisma = {
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
    permission: {
      findFirst: async () => ({ id: "perm-1" }),
    },
    customer: {
      findMany: async () => [
        {
          id: "customer-1",
          name: "Northwind",
          email: "northwind@acme.test",
          phone: null,
          company: null,
          status: "ACTIVE",
          address: null,
          notes: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          deletedAt: null,
          organization: { id: "org-1", name: "Acme", slug: "acme" },
        },
      ],
      count: async () => 1,
    },
    slaCalendar: {
      findFirst: async () => ({ id: calendarId }),
    },
    slaHoliday: {
      findMany: async () => [
        {
          id: "holiday-1",
          name: "Año nuevo",
          date: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };

  return { prisma };
});

vi.mock("./plugins/prisma.js", async () => {
  const { default: fp } = await import("fastify-plugin");

  return {
    default: fp(async (app: { decorate: (name: string, value: unknown) => void }) => {
      app.decorate("prisma", prisma);
    }),
  };
});

vi.mock("./plugins/redis.js", async () => {
  const { default: fp } = await import("fastify-plugin");

  return {
    default: fp(async (app: { decorate: (name: string, value: unknown) => void }) => {
      app.decorate("redis", {});
    }),
  };
});

vi.mock("./modules/auth/auth.guard.js", () => ({
  authGuard: async (request: { user: unknown; auth: unknown }) => {
    request.user = {
      id: "user-1",
      organizationId: "org-1",
      name: "Ada",
      email: "ada@acme.test",
    };
    request.auth = { sessionId: "session-1" };
  },
}));

import { buildApp } from "./app.js";

type Operation = {
  tags?: string[];
  security?: Array<Record<string, string[]>>;
  responses?: Record<string, unknown>;
};

type OpenApi = {
  tags?: Array<{ name: string }>;
  paths: Record<string, Record<string, Operation>>;
};

const httpMethods = ["get", "post", "put", "patch", "delete"];

describe("swagger", () => {
  it("agrupa cada ruta y pide bearer o api key, menos health", async () => {
    const app = await buildApp();
    await app.ready();
    const spec = app.swagger() as OpenApi;
    const tagNames = (spec.tags ?? []).map((tag) => tag.name);

    expect(tagNames).not.toContain("Organizations");
    expect(tagNames).not.toContain("Tasks");

    const operations = listOperations(spec);

    expect(operations.some((operation) => operation.path === "/auth/me")).toBe(
      true,
    );
    expect(
      operations.some((operation) => operation.path === "/auth/logout"),
    ).toBe(true);
    expect(
      operations.some(
        (operation) => operation.path === "/notifications/count-unread",
      ),
    ).toBe(true);
    expect(
      operations.some(
        (operation) => operation.path === "/notifications/read-all",
      ),
    ).toBe(true);

    for (const operation of operations) {
      expect(operation.tags?.length, operation.path).toBeGreaterThan(0);
      expect(
        operation.responses?.["200"] ?? operation.responses?.["201"],
        operation.path,
      ).toBeTruthy();

      if (operation.path === "/health" || operation.path === "/health/ready") {
        expect(operation.security, operation.path).toBeUndefined();
        continue;
      }

      expect(operation.security, operation.path).toEqual([
        { bearerAuth: [] },
        { apiKeyAuth: [] },
      ]);
    }

    await app.close();
  });

  it("no recorta el listado de clientes ni el de festivos", async () => {
    const app = await buildApp();

    const customers = await app.inject({
      method: "GET",
      url: "/customers",
    });
    const customerBody = customers.json();

    expect(customers.statusCode).toBe(200);
    expect(customerBody.success).toBe(true);
    expect(customerBody.data.customers[0].name).toBe("Northwind");
    expect(customerBody.data.customers[0].email).toBe("northwind@acme.test");
    expect(customerBody.data.pagination.total).toBe(1);

    const holidays = await app.inject({
      method: "GET",
      url: `/sla-calendars/${calendarId}/holidays`,
    });
    const holidayBody = holidays.json();

    expect(holidays.statusCode).toBe(200);
    expect(holidayBody[0].name).toBe("Año nuevo");
    expect(holidayBody[0].date).toBe("2026-01-01T00:00:00.000Z");

    await app.close();
  });
});

function listOperations(spec: OpenApi) {
  const operations: Array<Operation & { path: string; method: string }> = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    if (path.startsWith("/api/docs")) {
      continue;
    }

    for (const method of httpMethods) {
      const operation = methods[method];

      if (!operation) {
        continue;
      }

      operations.push({ path, method, ...operation });
    }
  }

  return operations;
}
