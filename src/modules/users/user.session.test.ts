import { UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { UserService } from "./user.service.js";

function service() {
  const deletedSessionUserIds: string[] = [];
  const existingUser = {
    id: "user-2",
    email: "agent@acme.test",
    organizationId: "org-1",
    status: UserStatus.ACTIVE,
  };

  const prisma = {
    user: {
      findFirst: async () => existingUser,
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: {
          update: async (args: { data: { status?: UserStatus } }) => ({
            id: existingUser.id,
            name: "Agent",
            email: existingUser.email,
            status: args.data.status ?? existingUser.status,
            organizationId: existingUser.organizationId,
            createdAt: new Date(),
            updatedAt: new Date(),
            roles: [],
          }),
        },
        session: {
          deleteMany: async (args: { where: { userId: string } }) => {
            deletedSessionUserIds.push(args.where.userId);
            return { count: 1 };
          },
        },
      }),
  };

  const authorization = {
    getScope: async () => AUTH_SCOPES.ORGANIZATION,
  };

  return {
    deletedSessionUserIds,
    users: new UserService(prisma as never, authorization as never),
  };
}

describe("UserService.update y las sesiones", () => {
  it("borra las sesiones cuando el status deja de ser ACTIVE", async () => {
    const { users, deletedSessionUserIds } = service();

    await users.update(
      "user-2",
      { status: UserStatus.SUSPENDED },
      "admin-1",
      "org-1",
    );

    expect(deletedSessionUserIds).toEqual(["user-2"]);
  });

  it("conserva las sesiones si solo cambia el nombre", async () => {
    const { users, deletedSessionUserIds } = service();

    await users.update("user-2", { name: "Nuevo nombre" }, "admin-1", "org-1");

    expect(deletedSessionUserIds).toEqual([]);
  });
});
