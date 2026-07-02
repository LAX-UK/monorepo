"use client";

import { CountdownFadeSlot } from "@/components/marketing/countdown-fade-slot";
import { useActiveSaleCountdownEndIso } from "@/lib/sale/use-active-sale-countdown-end-iso";
import type { Sale } from "@auction/types";
import { Countdown } from "@auction/ui";

type Props = {
  status: Sale["status"];
  deliveryMode: Sale["deliveryMode"];
  endTimeIso: string;
  countdownEndIso?: string;
};

/** Inline live countdown for agenda rows — hides at saleroom past-end without showing "Ended". */
export function SaleAgendaLiveCountdown({
  status,
  deliveryMode,
  endTimeIso,
  countdownEndIso,
}: Props) {
  const reactiveEndIso = useActiveSaleCountdownEndIso({
    status,
    endTime: endTimeIso,
    deliveryMode,
    ...(countdownEndIso != null ? { initialEndIso: countdownEndIso } : {}),
  });

  if (reactiveEndIso == null) {
    return null;
  }

  return (
    <CountdownFadeSlot
      visible
      className="hidden font-label text-xs font-semibold tabular-nums text-cta-bg sm:inline"
    >
      <Countdown end={new Date(reactiveEndIso)} announce={false} />
    </CountdownFadeSlot>
  );
}
