import type { FastifyInstance } from "fastify";
import { authGuard } from "../auth/auth.guard.js";
import { requirePermission } from "../../common/guards/permission.guard.js";
import { PERMISSIONS } from "../../common/auth/permissions.js";


import {
  customerCreateSchema,
  customerListSchema,
  customerShowSchema,
  customerUpdateSchema,
} from "./customer.schema.js";

import type {
  CustomerCreateBody,
  CustomerListQuery,
  CustomerShowParams,
  CustomerUpdateBody,
  CustomerUpdateParams,
} from "./customer.types.js";
import { CustomerController } from "./customer.controller.js";
import { CustomerService } from "./customer.service.js";

export async function customerRoutes(app: FastifyInstance) {
    const customerController = new CustomerController(
        new CustomerService(app.prisma, app.authorizationService),
    );

    app.get<{ Querystring: CustomerListQuery }>(
        "/customers",
        {
            schema: customerListSchema,
            preHandler: [authGuard, requirePermission(PERMISSIONS.CUSTOMERS_VIEW)],
        },
        customerController.list.bind(customerController),
    );
    
    app.get<{ Params: CustomerShowParams }>(
        "/customers/:id",
        {
            schema: customerShowSchema,
            preHandler: [authGuard, requirePermission(PERMISSIONS.CUSTOMERS_VIEW)],
        },
        customerController.show.bind(customerController),
    );

    app.post<{ Body: CustomerCreateBody }>(
        "/customers",
        {
            schema: customerCreateSchema,
            preHandler: [authGuard, requirePermission(PERMISSIONS.CUSTOMERS_CREATE)],
        },
        customerController.create.bind(customerController),
    );

    app.patch<{ Params: CustomerUpdateParams; Body: CustomerUpdateBody }>(
        "/customers/:id",
        {
            schema: customerUpdateSchema,
            preHandler: [authGuard, requirePermission(PERMISSIONS.CUSTOMERS_UPDATE)],
        },
        customerController.update.bind(customerController),
    );

    app.delete<{ Params: CustomerShowParams }>(
        "/customers/:id",
        {
            schema: customerUpdateSchema,
            preHandler: [authGuard, requirePermission(PERMISSIONS.CUSTOMERS_DELETE)],
        },
        customerController.disable.bind(customerController),
    );

    app.patch<{ Params: CustomerShowParams }>(
        "/customers/:id/enable",
        {
            schema: customerUpdateSchema,
            preHandler: [authGuard, requirePermission(PERMISSIONS.CUSTOMERS_UPDATE)],
        },
        customerController.enable.bind(customerController),
    );
}