import type { FastifyReply, FastifyRequest } from "fastify";
import type { CustomerService } from "./customer.service.js";
import type {
    CustomerCreateBody,
  CustomerListQuery,
  CustomerShowParams,
  CustomerUpdateBody,
  CustomerUpdateParams,
} from "./customer.types.js";

export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  async list(
    request: FastifyRequest<{ Querystring: CustomerListQuery }>,
    reply: FastifyReply,
  ) {
    const result = await this.customerService.list(
      request.query,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async show(
    request: FastifyRequest<{ Params: CustomerShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.customerService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async create(
    request: FastifyRequest<{ Body: CustomerCreateBody }>,
    reply: FastifyReply,
  ) {
    const result = await this.customerService.create(
      request.body,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(201).send({ success: true, data: result });
  }

  async update(
    request: FastifyRequest<{
      Params: CustomerUpdateParams;
      Body: CustomerUpdateBody;
    }>,
    reply: FastifyReply,
  ) {
    const result = await this.customerService.update(
      request.params.id,
      request.body,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async disable(
    request: FastifyRequest<{ Params: CustomerShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.customerService.disable(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }

  async enable(
    request: FastifyRequest<{ Params: CustomerShowParams }>,
    reply: FastifyReply,
  ) {
    const result = await this.customerService.enable(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );
    return reply.status(200).send({ success: true, data: result });
  }
}
