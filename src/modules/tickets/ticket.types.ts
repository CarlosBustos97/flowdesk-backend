import type { Priority, TicketStatus } from "@prisma/client";

export type TicketListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  priority?: Priority;
  status?: TicketStatus;
  customerId?: string;
  projectId?: string;
  categoryId?: string;
  assignedToId?: string;
};

export type TicketShowParams = {
  id: string;
};

export type TicketCreateBody = {
  organizationId: string;
  customerId: string;
  subject: string;
  description: string;
  priority: Priority;
  slaPolicyId: string;
  projectId?: string;
  categoryId?: string;
  assignedToId?: string;
};

export type TicketUpdateParams = {
  id: string;
};

export type TicketUpdateBody = {
  customerId?: string;
  subject?: string;
  description?: string;
  projectId?: string;
  categoryId?: string;
  assignedToId?: string;
};
