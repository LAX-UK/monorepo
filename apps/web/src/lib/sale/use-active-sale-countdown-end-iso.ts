"use client";

import { useCountdownTick } from "@/lib/time/use-clock";
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
  const endMs = new Date(input.endTime).getTime();
  const nowMs = useCountdownTick([endMs], { surface: "card" });

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
