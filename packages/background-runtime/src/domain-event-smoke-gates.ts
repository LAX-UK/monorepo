/**
 * Pre-Xero-go-live checks beyond runtime ownership (finance/lifecycle).
 * Each gate maps to a vitest suite in CI.
 */
export const DOMAIN_EVENT_SMOKE_GATES = [
  "domain_event.financial_contracts",
  "domain_event.publish_guard",
  "domain_event.consumer_contract_fatal",
  "xero.api_writes_barrier",
] as const;

export type DomainEventSmokeGate = (typeof DOMAIN_EVENT_SMOKE_GATES)[number];
