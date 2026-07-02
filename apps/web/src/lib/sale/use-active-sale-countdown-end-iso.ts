"use client";

import { useClientClock } from "@/lib/time/use-client-clock";
import type { SaleDeliveryMode } from "@auction/types";
import { toSaleCountdownEndIso } from "@auction/validators";

export type ActiveSaleCountdownInput = {
  status: string;
  endTime: Date | string;
  deliveryMode?: SaleDeliveryMode;
  /** Server-rendered ISO for SSR-stable first paint. */
  initialEndIso?: string;
};

/** Re-evaluates sale countdown visibility every second (saleroom past-end self-heal). */
export function useActiveSaleCountdownEndIso(input: ActiveSaleCountdownInput): string | undefined {
  const nowMs = useClientClock(1000);

  if (nowMs == null) {
    return input.initialEndIso;
  }

  return toSaleCountdownEndIso(
    {
      status: input.status as "draft" | "scheduled" | "active" | "ended" | "cancelled",
      endTime: input.endTime,
      ...(input.deliveryMode != null ? { deliveryMode: input.deliveryMode } : {}),
    },
    { now: new Date(nowMs) },
  );
}
