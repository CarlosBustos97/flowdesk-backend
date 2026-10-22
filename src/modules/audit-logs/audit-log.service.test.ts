import { UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { UserService } from "../users/user.service.js";
import { AuditLogService } from "./audit-log.service.js";
import type { AuditLogRecordInput } from "./audit-log.types.js";

type AuditRow = {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: Date;
};

function listService(rows: AuditRow[], scope: string) {
  const whereOf = (where: { organizationId?: string }) =>
    rows.filter(
      (row) =>
        where.organizationId === undefined ||
        row.organizationId === where.organizationId,
    );

  const prisma = {
    auditLog: {
      findMany: async (args: { where: { organizationId?: string } }) =>
        whereOf(args.where),
      count: async (args: { where: { organizationId?: string } }) =>
        whereOf(args.where).length,
    },
    $transaction: async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  };

  return new AuditLogService(prisma as never, {
    getScope: async () => scope,
  } as never);
}

describe("AuditLogService", () => {
  const rows: AuditRow[] = [
    {
      id: "audit-1",
      organizationId: "org-1",
      userId: "admin-1",
      action: "user.updated",
      entityType: "user",
      entityId: "user-2",
      oldValues: { name: "Ana" },
      newValues: { name: "Ana López" },
      createdAt: new Date("2026-10-22T10:00:00.000Z"),
    },
    {
      id: "audit-2",
      organizationId: "org-2",
      userId: "admin-2",
      action: "ticket.created",
      entityType: "ticket",
      entityId: "ticket-9",
      oldValues: null,
      newValues: { subject: "Otro" },
      createdAt: new Date("2026-10-22T11:00:00.000Z"),
    },
  ];

  it("guarda organización, actor y acción, y no lista otra organización", async () => {
    const visible = await listService(rows, AUTH_SCOPES.ORGANIZATION).list(
      {},
      "admin-1",
      "org-1",
    );

    expect(visible.auditLogs).toEqual([rows[0]]);
    expect(visible.auditLogs[0]).toMatchObject({
      organizationId: "org-1",
      userId: "admin-1",
      action: "user.updated",
    });
    expect(visible.pagination.total).toBe(1);
  });

  it("un rol global ve las filas de todas las organizaciones", async () => {
    const visible = await listService(rows, AUTH_SCOPES.GLOBAL).list(
      {},
      "owner-1",
      "org-1",
    );

    expect(visible.auditLogs).toHaveLength(2);
  });
});

describe("alta de usuario y auditoría", () => {
  it("no guarda la contraseña ni su hash", async () => {
    const recorded: AuditLogRecordInput[] = [];
    const password = "Secreta12";

    const prisma = {
      organization: {
        findUnique: async () => ({ id: "org-1" }),
      },
      user: {
        findUnique: async () => null,
      },
      role: {
        findUnique: async () => ({
          id: "role-1",
          isGlobal: false,
          organizationId: "org-1",
        }),
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          user: {
            create: async () => ({
              id: "user-2",
              name: "Nuevo",
              email: "nuevo@acme.test",
              status: UserStatus.INVITED,
              organizationId: "org-1",
              createdAt: new Date(),
              updatedAt: new Date(),
              roles: [],
            }),
          },
        }),
    };

    const users = new UserService(
      prisma as never,
      {
        getScope: async () => AUTH_SCOPES.ORGANIZATION,
        canAssignRole: async () => true,
      } as never,
      {
        record: async (data: AuditLogRecordInput) => {
          recorded.push(data);
          return { id: "audit-1" };
        },
      } as never,
    );

    await users.create(
      {
        name: "Nuevo",
        email: "nuevo@acme.test",
        password,
        organizationId: "org-1",
        roleId: "role-1",
      },
      "admin-1",
      "org-1",
    );

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      organizationId: "org-1",
      userId: "admin-1",
      action: "user.created",
      entityType: "user",
      entityId: "user-2",
    });

    const stored = JSON.stringify(recorded[0]);
    expect(stored).not.toContain(password);
    expect(stored).not.toContain("passwordHash");
  });
});
