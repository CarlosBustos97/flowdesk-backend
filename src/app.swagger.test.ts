import { describe, expect, it, vi } from "vitest";

vi.mock("./plugins/prisma.js", () => ({
  default: async (app: { decorate: (name: string, value: unknown) => void }) => {
    app.decorate("prisma", {});
  },
}));

vi.mock("./plugins/redis.js", () => ({
  default: async (app: { decorate: (name: string, value: unknown) => void }) => {
    app.decorate("redis", {});
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
