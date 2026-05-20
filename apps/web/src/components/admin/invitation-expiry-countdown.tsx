"use client";

import { formatDateTime } from "@/lib/ui/format";
import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins % 60}m`;
  return `${Math.max(1, mins)}m`;
}

type Props = {
  expiresAt: Date;
  /** When false, show static copy instead of ticking countdown (terminal invitations). */
  active: boolean;
};

export function InvitationExpiryCountdown({ expiresAt, active }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [active]);

  const ms = expiresAt.getTime() - now;
  const absolute = formatDateTime(expiresAt);

  if (!active) {
    return <p className="font-body text-sm text-on-surface-variant tabular-nums">{absolute}</p>;
  }

  return (
    <div className="space-y-0.5">
      <p className="font-body text-sm tabular-nums text-on-surface">{formatRemaining(ms)}</p>
      <p className="font-body text-[11px] text-on-surface-variant">{absolute}</p>
    </div>
  );
}
