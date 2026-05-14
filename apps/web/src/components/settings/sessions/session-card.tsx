"use client";

import type { SessionView } from "@/lib/auth/sessions/session-view";
import { Button } from "@auction/ui/components/button";
import { Monitor, Smartphone, Tablet } from "lucide-react";

export function SessionCard({
  view,
  revoking,
  onRevoke,
}: {
  view: SessionView;
  revoking: boolean;
  onRevoke: (id: string) => void;
}) {
  const ua = view.userAgent ?? "";
  const DeviceIcon = /Mobile|iPhone|Android.*Mobile/i.test(ua)
    ? Smartphone
    : /iPad|Tablet/i.test(ua)
      ? Tablet
      : Monitor;

  return (
    <div
      className={
        view.isCurrent
          ? "flex items-start justify-between gap-4 rounded-xl border-2 border-primary/35 bg-surface-container-lowest p-4 ring-1 ring-primary/20"
          : "flex items-start justify-between gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4"
      }
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-start gap-2">
          <DeviceIcon className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
          <div className="min-w-0">
            <p
              className="truncate font-body text-sm font-medium text-on-surface"
              title={view.rawUserAgent ?? undefined}
            >
              {view.deviceLabel}
              {view.isCurrent ? (
                <span className="ml-2 rounded-full bg-primary-container/50 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-primary">
                  This device
                </span>
              ) : null}
            </p>
            {view.ipAddress ? (
              <p className="font-body text-xs text-on-surface-variant">{view.ipAddress}</p>
            ) : null}
            <p className="font-body text-xs text-on-surface-variant" suppressHydrationWarning>
              Signed in {view.relativeSignedIn} · Expires {view.expiresDisplay}
            </p>
          </div>
        </div>
      </div>
      {!view.isCurrent ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={revoking}
          onClick={() => onRevoke(view.id)}
        >
          {revoking ? "Revoking…" : "Revoke"}
        </Button>
      ) : null}
    </div>
  );
}
