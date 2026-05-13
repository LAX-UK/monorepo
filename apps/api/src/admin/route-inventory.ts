/**
 * Inventory of admin HTTP surface (`/admin/*`) grouped by bounded context.
 * Handlers live in `routes/admin.ts`, `routes/admin-invitations.ts`,
 * `routes/admin-legal-entity-lifecycle.ts`, `routes/xero-admin.ts` (finance mount).
 *
 * Application logic for `admin.ts` is delegated to `container.admin.*` services.
 */
export const ADMIN_ROUTE_GROUPS = {
  submissions: ["/submissions/pending-count"],
  analytics: ["/analytics"],
  metrics: ["/metrics/today", "/metrics/live", "/metrics/finance-issues"],
  onboarding: ["/onboarding-issues"],
  legalEntities: [
    "/legal-entities/stripe-connect-requirements",
    "/legal-entities/browse",
    "/legal-entities/* (lifecycle module)",
  ],
  payments: [
    "/payments/manual-review",
    "/payments/:id/capture-and-process",
    "/payments/:id/refund-buyer",
    "/finance/dispute-domain-events (finance router)",
    "/payments/:id/xero-sync (finance router)",
  ],
  attention: ["/attention"],
  lots: [
    "/lots/artist-backfill-review",
    "/lots/withdrawal-requests",
    "/lots/:id/approve-withdrawal-request",
  ],
  audit: ["/audit/domain-events", "/audit/domain-events/export"],
  catalog: ["/categories", "/categories/:id", "/artists", "/artists/:id"],
  email: ["/email/outbox", "/email/events", "/email/suppressions", "/email/suppressions/bulk"],
  users: [
    "/users",
    "/users/bulk",
    "/users/:id",
    "/users/:id/role",
    "/users/:id/suspend",
    "/users/:id/unsuspend",
    "/users/:id/activity",
  ],
  impersonation: [
    "/impersonation/lookup",
    "/impersonation/record-failed-end",
    "/impersonation/start",
    "/impersonation/end",
  ],
  invitations: ["/invitations* (module)"],
  integrations: ["/integrations/xero/* (xero-admin module on finance router)"],
} as const;
