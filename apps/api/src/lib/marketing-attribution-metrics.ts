import { Counter } from "prom-client";

const marketingAttributionOperationsTotal = new Counter({
  name: "marketing_attribution_operations_total",
  help: "Value-free operational outcomes for marketing attribution",
  labelNames: ["operation", "outcome", "flag_state"] as const,
});

export function recordMarketingAttributionOperation(
  operation: "delete" | "enrich" | "sync",
  outcome: "accepted" | "disabled" | "failed" | "missing" | "rejected" | "store_unavailable",
  enabled: boolean,
): void {
  marketingAttributionOperationsTotal.inc({
    operation,
    outcome,
    flag_state: enabled ? "enabled" : "disabled",
  });
}
