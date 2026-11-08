import { Registry } from "prom-client";
import { describe, expect, it } from "vitest";
import { bindMoneyPathMetrics, workerMoneyPathMetrics } from "./money-path-metrics.js";

describe("worker money-path metrics", () => {
  it("counts each event by name on the registry it is bound to", async () => {
    const registry = new Registry();
    bindMoneyPathMetrics(registry);

    workerMoneyPathMetrics.record("payout_transfer_status_cas_miss");
    workerMoneyPathMetrics.record("payout_transfer_status_cas_miss");
    workerMoneyPathMetrics.record("stripe_connect_transfer_failed");

    const text = await registry.metrics();
    expect(text).toContain(
      'auction_worker_money_path_events_total{event="payout_transfer_status_cas_miss"} 2',
    );
    expect(text).toContain(
      'auction_worker_money_path_events_total{event="stripe_connect_transfer_failed"} 1',
    );
  });
});
