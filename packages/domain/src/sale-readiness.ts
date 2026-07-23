import type { Sale } from "@auction/types";
import { evaluateLotReadiness } from "./lot-readiness.js";

export type SaleReadinessCheckId =
  | "lots"
  | "schedule"
  | "registrations"
  | "venue"
  | "sale_start_future";

export type SaleReadinessCheck = {
  id: SaleReadinessCheckId;
  severity: "required" | "warning";
  ok: boolean;
};

export type SalePublishReadinessInput = {
  sale: Pick<Sale, "status" | "deliveryMode" | "startTime" | "endTime">;
  lotCount: number;
  pendingRegistrationCount: number | null;
  venueReady: boolean;
  startInFuture: boolean;
};

export function evaluateSalePublishReadiness(
  input: SalePublishReadinessInput,
): SaleReadinessCheck[] {
  const { sale, lotCount, pendingRegistrationCount, venueReady, startInFuture } = input;
  const hasLots = lotCount >= 1;
  const scheduleValid = sale.endTime.getTime() > sale.startTime.getTime();
  const liveish = sale.status === "scheduled" || sale.status === "active";
  const isOnsite = sale.deliveryMode === "onsite";
  const isHybrid = sale.deliveryMode === "hybrid";

  const checks: SaleReadinessCheck[] = [
    { id: "lots", severity: "required", ok: hasLots },
    { id: "schedule", severity: "required", ok: scheduleValid },
    {
      id: "registrations",
      severity: "warning",
      ok: !liveish || pendingRegistrationCount === 0,
    },
    {
      id: "venue",
      severity: isOnsite || isHybrid ? "required" : "warning",
      ok: isOnsite || isHybrid ? venueReady : true,
    },
  ];

  if (sale.status === "draft") {
    checks.push({ id: "sale_start_future", severity: "required", ok: startInFuture });
  }

  return checks;
}

export type LotReadinessFailureRollup = {
  checkId: string;
  count: number;
};

export function rollupLotReadinessFailures(
  lots: (Parameters<typeof evaluateLotReadiness>[0] & { id: string })[],
  connectRequiredByLotId: Record<string, boolean> = {},
): LotReadinessFailureRollup[] {
  const counts = new Map<string, number>();

  for (const lot of lots) {
    const connectRequired = connectRequiredByLotId[lot.id] ?? false;
    const result = evaluateLotReadiness({ ...lot, connectRequired });
    for (const check of result.checks) {
      if (check.ok || check.id === "sale") continue;
      counts.set(check.id, (counts.get(check.id) ?? 0) + 1);
    }
  }

  return [...counts.entries()].map(([checkId, count]) => ({ checkId, count }));
}
