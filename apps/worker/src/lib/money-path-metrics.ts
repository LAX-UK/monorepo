import type { IMoneyPathMetrics } from "@auction/finance-runtime";
import { Counter, type Registry } from "prom-client";

const moneyPathEvents = new Counter({
  name: "auction_worker_money_path_events_total",
  help: "Money-path events counted in the worker (payout transfers and settlement)",
  labelNames: ["event"] as const,
});

export function bindMoneyPathMetrics(reg: Registry): void {
  reg.registerMetric(moneyPathEvents);
}

/** Counts the finance runtime's money-path events on the worker's metrics endpoint. */
export const workerMoneyPathMetrics: IMoneyPathMetrics = {
  record: (event) => moneyPathEvents.inc({ event }),
};
