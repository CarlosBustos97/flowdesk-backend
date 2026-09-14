export type AttachmentListQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export type AttachmentListParams = {
  ticketId: string;
};

export type AttachmentDeleteParams = {
  id: string;
};

export type AttachmentCreateParams = {
  ticketId: string;
};