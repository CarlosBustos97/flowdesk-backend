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

describe("buildApp", () => {
  it("no registra el scheduler ni crea su temporizador", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    try {
      const app = await buildApp();
      const schedulerDelays = setIntervalSpy.mock.calls
        .map((call) => call[1])
        .filter((delay) => delay === 60_000);

      expect(schedulerDelays).toEqual([]);
      await app.close();
    } finally {
      setIntervalSpy.mockRestore();
    }
  });
});
