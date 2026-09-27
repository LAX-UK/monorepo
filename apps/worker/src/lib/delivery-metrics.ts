import { Counter, Gauge, type Registry } from "prom-client";

export type DeliveryMetricOutcome = "success" | "retry" | "dead_letter" | "skipped";

let registry: Registry | null = null;

const deliveryAttemptsTotal = new Counter({
  name: "auction_delivery_attempts_total",
  help: "Domain event / webhook delivery attempts by consumer and outcome",
  labelNames: ["consumer", "outcome"] as const,
});

const deliveryDeadLetterTotal = new Counter({
  name: "auction_delivery_dead_letter_total",
  help: "Deliveries moved to dead-letter state",
  labelNames: ["consumer"] as const,
});

const zohoCrmApiCreditsRemaining = new Gauge({
  name: "auction_zoho_crm_api_credits_remaining",
  help: "Last observed Zoho CRM API credits remaining (X-API-CREDITS-REMAINING)",
});

const deliveryOldestPendingAgeSeconds = new Gauge({
  name: "auction_delivery_oldest_pending_age_seconds",
  help: "Age in seconds of the oldest undelivered domain_event_delivery row for a consumer",
  labelNames: ["consumer"] as const,
});

export function bindDeliveryMetrics(reg: Registry): void {
  registry = reg;
  reg.registerMetric(deliveryAttemptsTotal);
  reg.registerMetric(deliveryDeadLetterTotal);
  reg.registerMetric(zohoCrmApiCreditsRemaining);
  reg.registerMetric(deliveryOldestPendingAgeSeconds);
}

export function recordZohoCrmApiCreditsRemaining(remaining: number | null): void {
  if (remaining == null) return;
  zohoCrmApiCreditsRemaining.set(remaining);
}

export function recordDeliveryOldestPendingAgeSeconds(
  consumer: string,
  oldestPendingAt: Date | null,
  now: Date = new Date(),
): void {
  if (oldestPendingAt == null) {
    deliveryOldestPendingAgeSeconds.set({ consumer }, 0);
    return;
  }
  const ageSeconds = Math.max(0, (now.getTime() - oldestPendingAt.getTime()) / 1000);
  deliveryOldestPendingAgeSeconds.set({ consumer }, ageSeconds);
}

export function recordDeliveryOutcome(consumer: string, outcome: DeliveryMetricOutcome): void {
  deliveryAttemptsTotal.inc({ consumer, outcome });
  if (outcome === "dead_letter") {
    deliveryDeadLetterTotal.inc({ consumer });
  }
}

export function getDeliveryMetricsRegistry(): Registry | null {
  return registry;
}
