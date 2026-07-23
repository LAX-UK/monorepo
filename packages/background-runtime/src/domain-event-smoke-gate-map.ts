import type { DOMAIN_EVENT_SMOKE_GATES } from "./domain-event-smoke-gates.js";

/** Vitest suite paths (repo-root relative) for domain-event / Xero contract gates. */
export const DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP: Record<
  (typeof DOMAIN_EVENT_SMOKE_GATES)[number],
  string
> = {
  "domain_event.financial_contracts":
    "packages/types/src/domain-event-catalog/financial-contracts.test.ts",
  "domain_event.publish_guard":
    "packages/types/src/domain-event-catalog/financial-contracts.test.ts",
  "domain_event.consumer_contract_fatal": "apps/worker/src/lib/delivery-retry.contract.test.ts",
  "xero.api_writes_barrier": "apps/api/src/lib/xero-api-writes-guard.test.ts",
};

export function listDomainEventSmokeGateSuitePaths(): string[] {
  return [...new Set(Object.values(DOMAIN_EVENT_SMOKE_GATE_SUITE_MAP))];
}
