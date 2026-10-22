import { describe, expect, it, vi } from "vitest";

vi.mock("./plugins/prisma.js", async () => {
  const { default: fp } = await import("fastify-plugin");

  return {
    default: fp(async (app: { decorate: (name: string, value: unknown) => void }) => {
      app.decorate("prisma", {
        organization: {
          findUnique: async () => null,
        },
      });
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

import { buildApp } from "./app.js";

describe("login limitado", () => {
  it("la petición 11 responde 429 y health sigue libre", async () => {
    const app = await buildApp();
    const login = {
      method: "POST" as const,
      url: "/auth/login",
      payload: {
        email: "ana@acme.test",
        password: "AnaClave1",
        organizationSlug: "no-existe",
      },
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await app.inject(login);

      expect(response.statusCode).toBe(401);
    }

    const limited = await app.inject(login);

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      success: false,
    });

    const health = await app.inject({ method: "GET", url: "/health" });

    expect(health.statusCode).toBe(200);
    expect(health.headers["x-content-type-options"]).toBe("nosniff");

    const docs = await app.inject({ method: "GET", url: "/api/docs/" });

    expect(docs.statusCode).toBe(200);

    await app.close();
  }, 20_000);
});
