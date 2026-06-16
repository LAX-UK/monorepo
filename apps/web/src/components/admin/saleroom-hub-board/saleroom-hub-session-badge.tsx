"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { fetchSaleroomStatus } from "@/lib/data/http/saleroom-status.client";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
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

  if (!session || session.status === "none") {
    return (
      <span className="font-body text-xs text-on-surface-variant" aria-label="Saleroom not live">
        Not live
      </span>
    );
  }

  return <AdminStatusBadge domain="saleroomSession" status={session.status} />;
}
