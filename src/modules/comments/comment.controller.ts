import type { FastifyReply, FastifyRequest } from "fastify";
import type { CommentService } from "./comment.service.js";
import type {
  CommentCreateBody,
  CommentCreateParams,
  CommentDeleteParams,
  CommentListParams,
  CommentListQuery,
  CommentUpdateBody,
  CommentUpdateParams,
} from "./comment.types.js";

export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  async list(
    request: FastifyRequest<{
      Params: CommentListParams;
      Querystring: CommentListQuery;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.commentService.list(
      request.params.ticketId,
      request.query,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{
      Params: CommentCreateParams;
      Body: CommentCreateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.commentService.create(
      request.params.ticketId,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: CommentUpdateParams;
      Body: CommentUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.commentService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }

  async delete(
    request: FastifyRequest<{ Params: CommentDeleteParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.commentService.delete(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    return reply.status(200).send({ success: true, data: result });
  }
}
