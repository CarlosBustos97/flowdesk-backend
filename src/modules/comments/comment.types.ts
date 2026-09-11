export type CommentListParams = {
  ticketId: string;
};
export type CommentListQuery = {
  page?: number;
  limit?: number;
};

export type CommentDeleteParams = {
  id: string;
};

export type CommentUpdateParams = {
  id: string;
};

export type CommentUpdateBody = {
  content?: string;
};

export type CommentCreateParams = {
  ticketId: string;
};

export type CommentCreateBody = {
  content: string;
  isInternal?: boolean;
};
