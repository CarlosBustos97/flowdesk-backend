import { AsyncLocalStorage } from "node:async_hooks";

type RequestScopeStore = {
  organizationBound: boolean;
};

export const requestScope = new AsyncLocalStorage<RequestScopeStore>();

export function bindOrganization(bound: boolean) {
  const store = requestScope.getStore();
  if (store) store.organizationBound = bound;
}

export function isOrganizationBound() {
  return requestScope.getStore()?.organizationBound === true;
}
