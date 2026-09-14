export const PERMISSIONS = {
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",

  TICKETS_VIEW: "tickets.view",
  TICKETS_CREATE: "tickets.create",
  TICKETS_UPDATE: "tickets.update",
  TICKETS_ASSIGN: "tickets.assign",
  TICKETS_RESOLVE: "tickets.resolve",
  TICKETS_CLOSE: "tickets.close",

  PROJECTS_VIEW: "projects.view",
  PROJECTS_CREATE: "projects.create",
  PROJECTS_UPDATE: "projects.update",
  PROJECTS_DELETE: "projects.delete",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_CREATE: "customers.create",
  CUSTOMERS_UPDATE: "customers.update",
  CUSTOMERS_DELETE: "customers.delete",

  TASKS_VIEW: "tasks.view",
  TASKS_CREATE: "tasks.create",
  TASKS_UPDATE: "tasks.update",
  TASKS_ASSIGN: "tasks.assign",
  TASKS_DELETE: "tasks.delete",

  ROLES_VIEW: "roles.view",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",

  TICKET_CATEGORIES_VIEW: "ticket_categories.view",
  TICKET_CATEGORIES_CREATE: "ticket_categories.create",
  TICKET_CATEGORIES_UPDATE: "ticket_categories.update",
  TICKET_CATEGORIES_DELETE: "ticket_categories.delete",

  SLA_POLICIES_VIEW: "sla_policies.view",
  SLA_POLICIES_CREATE: "sla_policies.create",
  SLA_POLICIES_UPDATE: "sla_policies.update",
  SLA_POLICIES_DELETE: "sla_policies.delete",

  COMMENTS_VIEW: "comments.view",
  COMMENTS_CREATE: "comments.create",
  COMMENTS_UPDATE: "comments.update",
  COMMENTS_DELETE: "comments.delete",

  ATTACHMENTS_VIEW: "attachments.view",
  ATTACHMENTS_CREATE: "attachments.create",
  ATTACHMENTS_DELETE: "attachments.delete",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
