import bcrypt from "bcryptjs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

type UserRow = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  status: "ACTIVE" | "INACTIVE";
};

describe("AuthService.login", () => {
  let anaHash = "";
  let otherHash = "";

  beforeAll(async () => {
    anaHash = await bcrypt.hash("AnaClave1", 4);
    otherHash = await bcrypt.hash("OtraClave1", 4);
  });

  function service() {
    const sessions: Array<{ userId: string }> = [];
    const users: UserRow[] = [
      {
        id: "user-acme",
        organizationId: "org-acme",
        name: "Ana Acme",
        email: "ana@acme.test",
        passwordHash: anaHash,
        status: "ACTIVE",
      },
      {
        id: "user-beta",
        organizationId: "org-beta",
        name: "Ana Beta",
        email: "ana@acme.test",
        passwordHash: otherHash,
        status: "ACTIVE",
      },
    ];
    const organizations = [
      { id: "org-acme", slug: "acme-corporation" },
      { id: "org-beta", slug: "beta-support" },
    ];

    const prisma = {
      organization: {
        findUnique: async (args: { where: { slug: string } }) =>
          organizations.find((organization) => organization.slug === args.where.slug) ??
          null,
      },
      user: {
        findFirst: async (args: {
          where: { email: string; organizationId: string; status: string };
        }) =>
          users.find(
            (user) =>
              user.email === args.where.email &&
              user.organizationId === args.where.organizationId &&
              user.status === args.where.status,
          ) ?? null,
      },
      session: {
        create: async (args: { data: { userId: string } }) => {
          sessions.push({ userId: args.data.userId });
          return { id: "session-1" };
        },
      },
    };

    return {
      sessions,
      auth: new AuthService(prisma as never, {} as never),
    };
  }

  it("entra en la organización indicada cuando el email existe en dos", async () => {
    const { auth, sessions } = service();

    const acme = await auth.login(
      "ana@acme.test",
      "AnaClave1",
      "acme-corporation",
    );
    const beta = await auth.login("ana@acme.test", "OtraClave1", "beta-support");

    expect(acme.user.id).toBe("user-acme");
    expect(beta.user.id).toBe("user-beta");
    expect(sessions.map((session) => session.userId)).toEqual([
      "user-acme",
      "user-beta",
    ]);
  });

  it("no acepta la contraseña de la otra organización", async () => {
    const { auth, sessions } = service();

    await expect(
      auth.login("ana@acme.test", "OtraClave1", "acme-corporation"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    });
    expect(sessions).toEqual([]);
  });

  it("compara el hash aunque el slug no exista", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    const { auth } = service();

    await expect(
      auth.login("ana@acme.test", "AnaClave1", "no-existe"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    });

    expect(compare).toHaveBeenCalledWith(
      "AnaClave1",
      expect.stringMatching(/^\$2[ab]\$/),
    );
    compare.mockRestore();
  });

  it("compara el hash aunque el usuario no exista", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    const { auth, sessions } = service();

    await expect(
      auth.login("nadie@acme.test", "AnaClave1", "acme-corporation"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials",
    });

    expect(sessions).toEqual([]);
    expect(compare).toHaveBeenCalledWith(
      "AnaClave1",
      expect.stringMatching(/^\$2[ab]\$/),
    );
    compare.mockRestore();
  });
});
