import { unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import type { MultipartFile } from "@fastify/multipart";
import { describe, expect, it } from "vitest";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import { extensionForUpload } from "./attachment.constants.js";
import { AttachmentService } from "./attachment.service.js";

function upload(mimetype: string, filename: string): MultipartFile {
  const stream = Object.assign(Readable.from([Buffer.from("abc")]), {
    truncated: false,
    bytesRead: 3,
  });

  return {
    mimetype,
    filename,
    file: stream,
  } as unknown as MultipartFile;
}

function service() {
  let created:
    | {
        fileName: string;
        originalName: string;
        mimeType: string;
        storagePath: string;
      }
    | undefined;

  const prisma = {
    ticket: {
      findFirst: async () => ({
        id: "ticket-1",
        organizationId: "org-1",
      }),
    },
    attachment: {
      create: async (args: {
        data: {
          fileName: string;
          originalName: string;
          mimeType: string;
          storagePath: string;
        };
      }) => {
        created = args.data;

        return {
          ...args.data,
          id: "att-1",
          fileSize: 3n,
        };
      },
    },
  };
  const authorization = {
    getScope: async () => AUTH_SCOPES.ORGANIZATION,
  };

  return {
    attachments: new AttachmentService(
      prisma as never,
      authorization as never,
    ),
    created: () => created,
  };
}

describe("adjuntos", () => {
  it("guarda png aunque el nombre termine en html", async () => {
    const built = service();

    const result = await built.attachments.create(
      "ticket-1",
      upload("image/png", "evil.html"),
      "user-1",
      "org-1",
    );

    const row = built.created();

    expect(row?.fileName.endsWith(".png")).toBe(true);
    expect(row?.originalName).toBe("evil.html");
    expect(result.mimeType).toBe("image/png");

    await unlink(row!.storagePath);
  });

  it("rechaza un tipo que no está permitido", async () => {
    const built = service();

    await expect(
      built.attachments.create(
        "ticket-1",
        upload("text/html", "nota.txt"),
        "user-1",
        "org-1",
      ),
    ).rejects.toEqual(new AppError(400, "File type is not allowed"));

    expect(built.created()).toBeUndefined();
  });

  it("elige la extensión según el tipo permitido", () => {
    expect(extensionForUpload("image/jpeg", "foto.jpeg")).toBe(".jpeg");
    expect(extensionForUpload("image/jpeg", "foto.jpg")).toBe(".jpg");
    expect(extensionForUpload("image/jpeg", "foto.html")).toBe(".jpg");
    expect(extensionForUpload("application/pdf", "C:\\temp\\a.pdf")).toBe(
      ".pdf",
    );
  });
});
