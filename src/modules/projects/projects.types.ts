import type { Priority, ProjectStatus } from "@prisma/client";

export type ProjectListQuery = {
    page?: number;
    limit?: number;
    search?: string;
    status?: ProjectStatus;
    priority?: Priority;
    customerId?: string;
    startDate?: string;
    dueDate?: string;
};

export type ProjectShowParams = {
    id: string;
};

export type ProjectCreateBody = {
    organizationId: string;
    customerId: string;
    name: string;
    description?: string;
    priority?: Priority;
    startDate?: string;
    dueDate?: string;
};

export type ProjectUpdateParams = {
    id: string;
};

export type ProjectUpdateBody = {
    customerId?: string;
    name?: string;
    description? : string;
    priority? : Priority;
    startDate?: string;
    dueDate?: string;
};