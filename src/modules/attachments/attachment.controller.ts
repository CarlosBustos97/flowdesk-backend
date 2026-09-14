import type { FastifyReply, FastifyRequest } from "fastify";
import type { AttachmentService } from "./attachment.service.js";
import { AppError } from "../../common/errors/app-error.js";
import type {
  AttachmentCreateParams,
  AttachmentDeleteParams,
  AttachmentListParams,
  AttachmentListQuery,
} from "./attachment.types.js";

export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  async create(
    request: FastifyRequest<{ Params: AttachmentCreateParams }>,
    reply: FastifyReply,
  ) {
    let fileFound = false;

    for await (const part of request.parts()) {
      if (part.type !== "file") {
        continue;
      }

      if (fileFound) {
        for await (const _ of part.file) {
          // Consume el segundo archivo antes de rechazar.
        }

        throw new AppError(400, "Only one file is allowed");
      }

      fileFound = true;

      await this.attachmentService.create(
        request.params.ticketId,
        part,
        request.user.id,
        request.user.organizationId,
      );
    }

    if (!fileFound) {
      throw new AppError(400, "File is required");
    }

    return reply.code(201).send({
      message: "File uploaded successfully",
    });
  }

  async list(
    request: FastifyRequest<{
      Params: AttachmentListParams;
      Querystring: AttachmentListQuery;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.attachmentService.list(
      request.params.ticketId,
      request.user.id,
      request.user.organizationId,
      request.query.page,
      request.query.limit,
      request.query.search,
    );

    return reply.code(200).send(result);
  }

  async delete(
    request: FastifyRequest<{ Params: AttachmentDeleteParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.attachmentService.delete(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.code(200).send(result);
  }
}
