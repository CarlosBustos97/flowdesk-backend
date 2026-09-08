export type TicketCategoryListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

export type TicketCategoryShowParams = {
  id: string;
};

export type TicketCategoryCreateBody = {
  organizationId: string;
  name: string;
  description?: string;
};

export type TicketCategoryUpdateParams = {
  id: string;
};

export type TicketcategoryUpdateBody = {
  name?: string;
  description?: string;
};
