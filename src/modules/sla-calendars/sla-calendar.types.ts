export type SlaCalendarListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

export type SlaCalendarShowParams = {
  id: string;
};

export type SlaCalendarCreateBody = {
  organizationId: string;
  name: string;
  description?: string;
  timezone: string;
  isActive?: boolean;
};

export type SlaCalendarUpdateParams = {
  id: string;
};

export type SlaCalendarUpdateBody = {
  name?: string;
  description?: string;
  timezone?: string;
  isActive?: boolean;
};
