import { Counter, type Registry } from "prom-client";

export type DeliveryMetricOutcome = "success" | "retry" | "dead_letter";

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

export function bindDeliveryMetrics(reg: Registry): void {
  registry = reg;
  reg.registerMetric(deliveryAttemptsTotal);
  reg.registerMetric(deliveryDeadLetterTotal);
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
