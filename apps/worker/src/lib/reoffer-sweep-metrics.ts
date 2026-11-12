import { Counter, type Registry } from "prom-client";

/** What each re-offer clock step did: `step` is the sweep, `outcome` what it did to one offer. */
export const reofferSweepTotal = new Counter({
  name: "auction_worker_reoffer_sweep_total",
  help: "Re-offer clock steps by sweep and outcome",
  labelNames: ["step", "outcome"] as const,
});

export function bindReofferSweepMetrics(reg: Registry): void {
  reg.registerMetric(reofferSweepTotal);
}
