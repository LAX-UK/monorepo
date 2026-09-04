import { Counter, Registry, collectDefaultMetrics } from "prom-client";

export function createAuthMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "auction_auth_" });
  const counter = <T extends string>(name: string, help: string, labelNames: readonly T[]) =>
    new Counter({
      name,
      help,
      labelNames,
      registers: [registry],
    });
  return {
    registry,
    refreshRotationOutcomes: counter(
      "auction_auth_refresh_rotation_outcomes_total",
      "OIDC refresh rotation outcomes, including grace and reuse detection.",
      ["outcome"],
    ),
    issuerHttpOutcomes: counter(
      "auction_auth_issuer_http_outcomes_total",
      "Bounded authentication and token endpoint outcomes.",
      ["operation", "status"],
    ),
    identityLifecycleOperations: counter(
      "auction_auth_identity_lifecycle_operations_total",
      "Successful privileged Identity lifecycle operations.",
      ["operation"],
    ),
    tokenExchangeOutcomes: counter(
      "auction_auth_token_exchange_outcomes_total",
      "RFC 8693 token exchange outcomes.",
      ["outcome"],
    ),
    ssfDeliveryOutcomes: counter(
      "auction_auth_ssf_delivery_outcomes_total",
      "First-party SSF push delivery outcomes.",
      ["outcome"],
    ),
    backchannelDeliveryOutcomes: counter(
      "auction_auth_backchannel_delivery_outcomes_total",
      "OIDC back-channel logout delivery outcomes.",
      ["outcome"],
    ),
  };
}
