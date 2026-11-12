"use client";

import { useAnnounce } from "@/components/lot-page/lot-announcer";
import { useConnectionNotice } from "@/lib/connection/use-connection-notice";
import { CONNECTION_NOTICES, type ConnectionNoticeKind, type LotStatusTone } from "@auction/domain";
import { Button } from "@auction/ui/lax/button";
import { cn } from "@auction/ui/lib/utils";
import { Check, Loader2, RefreshCw, WifiLow, WifiOff } from "lucide-react";
import { type ComponentType, useEffect } from "react";

/** Tone never stands alone: every notice also has words and a shape. */
const TONE_CLASS: Readonly<Record<LotStatusTone, string>> = {
  neutral: "bg-lax-neutral-bg text-lax-neutral-fg",
  info: "bg-lax-info-bg text-lax-info-fg",
  success: "bg-lax-success-bg text-lax-success-fg",
  warning: "bg-lax-warning-bg text-lax-warning-fg",
  danger: "bg-lax-danger-bg text-lax-danger-fg",
};

const ICONS: Readonly<Record<ConnectionNoticeKind, ComponentType<{ className?: string }>>> = {
  reconnecting: ({ className }) => (
    <Loader2 aria-hidden className={cn(className, "motion-safe:animate-spin")} />
  ),
  slow: WifiLow,
  paused: WifiOff,
  restored: Check,
};

/** The notice for one state: a calm line with a shape, words and, when paused, a way forward. */
export function ConnectionNoticeView({
  kind,
  onRefresh,
  className,
}: {
  kind: ConnectionNoticeKind;
  onRefresh?: () => void;
  className?: string;
}) {
  const copy = CONNECTION_NOTICES[kind];
  const Icon = ICONS[kind];
  return (
    <div
      data-testid="connection-notice"
      data-kind={kind}
      className={cn(
        "flex items-center gap-2 rounded-lg py-2 pr-2 pl-3 text-lax-13 leading-5",
        TONE_CLASS[copy.tone],
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{copy.text}</span>
      {copy.offersRefresh && onRefresh ? (
        <Button variant="secondary" size="sm" icon={<RefreshCw aria-hidden />} onClick={onRefresh}>
          Refresh
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Tells the bidder when live updates drop, and nothing while they are healthy. The words go to the
 * page's polite live region once, when the notice changes; the visible line is the same sentence.
 */
export function LotConnectionNotice({ className }: { className?: string }) {
  const kind = useConnectionNotice();
  const announce = useAnnounce();

  useEffect(() => {
    if (kind) announce(CONNECTION_NOTICES[kind].announcement);
  }, [kind, announce]);

  if (!kind) return null;
  return (
    <ConnectionNoticeView
      kind={kind}
      onRefresh={() => window.location.reload()}
      {...(className ? { className } : {})}
    />
  );
}
