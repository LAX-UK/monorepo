"use client";

import { staffStatus } from "@/lib/admin/staff-kit-status";
import { fetchSaleroomStatus } from "@/lib/data/http/saleroom-status.client";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { StatusBadge } from "@auction/staff-ui";
import { useEffect, useState } from "react";

type Props = {
  saleId: string;
};

/** One-shot session label for the saleroom hub row (no per-row polling). */
export function SaleroomHubSessionBadge({ saleId }: Props) {
  const [session, setSession] = useState<PublicSaleroomSessionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const next = await fetchSaleroomStatus(saleId);
      if (!cancelled) setSession(next);
    }

    void load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [saleId]);

  const status = staffStatus("saleroomSession", session?.status ?? "none");
  return (
    <StatusBadge tone={status.tone} live={status.live ?? false}>
      {status.label}
    </StatusBadge>
  );
}
