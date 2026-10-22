import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type AuthorizationService from "../auth/authorization.service.js";
import { ApiKeyService } from "../api-keys/api-key.service.js";
import { AttachmentService } from "../attachments/attachment.service.js";
import { AuditLogService } from "../audit-logs/audit-log.service.js";
import { CommentService } from "../comments/comment.service.js";
import { CustomerService } from "../customers/customer.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import { ReportService } from "../reports/report.service.js";
import { TicketService } from "../tickets/ticket.service.js";
import { WorkflowService } from "../workflows/workflow.service.js";

const authorization = {
  getScope: async () => "ORGANIZATION",
} as unknown as AuthorizationService;

function missesOtherOrganization(resourceId: string) {
  return async (args: {
    where: { id?: string; organizationId?: string; userId?: string };
  }) => {
    if (args.where.id && args.where.id !== resourceId) return null;
    if (args.where.userId && args.where.userId !== "user-a") return null;
    if (args.where.organizationId && args.where.organizationId !== "org-b") {
      return null;
    }

    return {
      id: resourceId,
      organizationId: "org-b",
      isRead: true,
      revokedAt: null,
    };
  };
}

describe("aislamiento por organización", () => {
  it("un ticket de otra organización responde 404", async () => {
    const tickets = new TicketService(
      { ticket: { findFirst: missesOtherOrganization("ticket-b") } } as unknown as PrismaClient,
      authorization,
      {} as never,
      {} as never,
      {} as never,
      { run: async () => undefined } as never,
    );

    await expect(tickets.findById("ticket-b", "user-a", "org-a")).rejects.toMatchObject({
      statusCode: 404,
      message: "Ticket not found",
    });
  });

  it("un comentario de otra organización responde 404", async () => {
    const comments = new CommentService(
      { comment: { findFirst: missesOtherOrganization("comment-b") } } as unknown as PrismaClient,
      authorization,
      {} as never,
      {} as never,
    );

    await expect(
      comments.delete("comment-b", "user-a", "org-a"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Comment not found",
    });
  });

  it("un adjunto de otra organización responde 404", async () => {
    const attachments = new AttachmentService(
      {
        attachment: { findFirst: missesOtherOrganization("file-b") },
      } as unknown as PrismaClient,
      authorization,
    );

    await expect(
      attachments.delete("file-b", "user-a", "org-a"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Attachment not found",
    });
  });

  it("un cliente de otra organización responde 404", async () => {
    const customers = new CustomerService(
      {
        customer: { findFirst: missesOtherOrganization("customer-b") },
      } as unknown as PrismaClient,
      authorization,
    );

    await expect(
      customers.findById("customer-b", "user-a", "org-a"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Customer not found",
    });
  });

  it("una notificación de otra organización responde 404", async () => {
    const notifications = new NotificationService({
      notification: { findFirst: missesOtherOrganization("notif-b") },
    } as unknown as PrismaClient);

    await expect(
      notifications.markAsRead("notif-b", "user-a", "org-a"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Notification not found",
    });
  });

  it("un workflow de otra organización responde 404", async () => {
    const workflows = new WorkflowService(
      { workflow: { findFirst: missesOtherOrganization("workflow-b") } } as unknown as PrismaClient,
      authorization,
      {} as never,
      {} as never,
    );

    await expect(
      workflows.findById("workflow-b", "user-a", "org-a"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Workflow not found" });
  });

  it("el audit de una organización no incluye el de otra", async () => {
    const rows = [
      { id: "audit-a", organizationId: "org-a" },
      { id: "audit-b", organizationId: "org-b" },
    ];
    const audits = new AuditLogService(
      {
        auditLog: {
          findMany: async (args: { where: { organizationId?: string } }) =>
            rows.filter(
              (row) =>
                !args.where.organizationId ||
                row.organizationId === args.where.organizationId,
            ),
          count: async (args: { where: { organizationId?: string } }) =>
            rows.filter(
              (row) =>
                !args.where.organizationId ||
                row.organizationId === args.where.organizationId,
            ).length,
        },
        $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
      } as unknown as PrismaClient,
      authorization,
    );

    const result = await audits.list({}, "user-a", "org-a");

    expect(result.auditLogs.map((row) => row.id)).toEqual(["audit-a"]);
  });

  it("el informe de una organización no cuenta tickets de otra", async () => {
    const rows = [
      { organizationId: "org-a", status: "OPEN", priority: "LOW" },
      { organizationId: "org-b", status: "OPEN", priority: "URGENT" },
    ];
    const reports = new ReportService({
      ticket: {
        groupBy: async (args: {
          by: Array<"status" | "priority">;
          where: { organizationId?: string; status?: { not?: string } };
        }) => {
          const key = args.by[0];
          const matched = rows.filter((row) => {
            if (
              args.where.organizationId &&
              row.organizationId !== args.where.organizationId
            ) {
              return false;
            }
            if (args.where.status?.not && row.status === args.where.status.not) {
              return false;
            }
            return true;
          });
          const counts = new Map<string, number>();
          for (const row of matched) {
            const value = row[key];
            counts.set(value, (counts.get(value) ?? 0) + 1);
          }
          return [...counts.entries()].map(([value, count]) => ({
            [key]: value,
            _count: { _all: count },
          }));
        },
      },
      ticketSla: {
        groupBy: async () => [],
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    } as unknown as PrismaClient);

    const summary = await reports.ticketsSummary("org-a");

    expect(summary.byStatus.OPEN).toBe(1);
    expect(summary.byPriority.URGENT).toBe(0);
    expect(summary.byPriority.LOW).toBe(1);
  });

  it("una clave de otra organización responde 404", async () => {
    const keys = new ApiKeyService(
      {
        apiKey: { findFirst: missesOtherOrganization("key-b") },
      } as unknown as PrismaClient,
      authorization,
      { record: async () => ({ id: "audit-1" }) } as never,
    );

    await expect(keys.revoke("key-b", "user-a", "org-a")).rejects.toMatchObject({
      statusCode: 404,
      message: "API key not found",
    });
  });
});
