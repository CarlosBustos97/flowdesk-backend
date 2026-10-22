import type { PrismaClient } from "@prisma/client";
import type { MultipartFile } from "@fastify/multipart";

import type AuthorizationService from "../auth/authorization.service.js";
import { AUTH_SCOPES } from "../../common/auth/auth-scope.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  extensionForUpload,
  isAllowedMimeType,
  safeOriginalName,
} from "./attachment.constants.js";
import { LocalStorage } from "./storage/file-storage.js";

export class AttachmentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async create(
    ticketId: string,
    file: MultipartFile,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!ticket) {
      throw new AppError(404, "Ticket not found");
    }

    if (!isAllowedMimeType(file.mimetype)) {
      for await (const _ of file.file) {
        // Consume the stream before returning the error.
      }

      throw new AppError(400, "File type is not allowed");
    }

    const storage = new LocalStorage("storage/attachments");
    const originalName = safeOriginalName(file.filename);

    const { fileName, storagePath } = await storage.save(
      file.file,
      extensionForUpload(file.mimetype, originalName),
    );

    if (file.file.truncated) {
      await storage.delete(storagePath);

      throw new AppError(400, "File is too large");
    }

    const fileSize = file.file.bytesRead;

    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          organizationId: ticket.organizationId,
          ticketId: ticket.id,
          userId: requesterUserId,
          fileName,
          originalName,
          mimeType: file.mimetype,
          fileSize,
          storagePath,
        },
      });

      return {
        ...attachment,
        fileSize: Number(attachment.fileSize),
      };
    } catch (error) {
      await storage.delete(storagePath);

      console.error("Error creating attachment:", error);

      throw new AppError(
        500,
        "An error occurred while saving; please contact the administrator",
      );
    }
  }

  async list(
    ticketId: string,
    requesterUserId: string,
    requesterOrganizationId: string,
    page = 1,
    limit = 20,
    search?: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!ticket) {
      throw new AppError(404, "Ticket not found");
    }

    const skip = (page - 1) * limit;

    const where = {
      ticketId: ticket.id,
      ...(search
        ? {
            originalName: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const [attachments, total] = await Promise.all([
      this.prisma.attachment.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      this.prisma.attachment.count({
        where,
      }),
    ]);

    return {
      data: attachments.map((attachment) => ({
        ...attachment,
        fileSize: Number(attachment.fileSize),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async delete(
    id: string,
    requesterUserId: string,
    requesterOrganizationId: string,
  ) {
    const scope = await this.authorizationService.getScope(requesterUserId);

    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id,
        ...(scope === AUTH_SCOPES.ORGANIZATION
          ? { organizationId: requesterOrganizationId }
          : {}),
      },
    });

    if (!attachment) {
      throw new AppError(404, "Attachment not found");
    }

    const storage = new LocalStorage("storage/attachments");

    await storage.delete(attachment.storagePath);

    await this.prisma.attachment.delete({
      where: {
        id: attachment.id,
      },
    });

    return {
      message: "Attachment deleted successfully",
    };
  }
}
