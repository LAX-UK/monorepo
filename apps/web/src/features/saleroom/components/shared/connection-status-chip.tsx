import type { SaleroomConnectionStatus } from "@/features/saleroom/types/staff-saleroom.vm";
import { formatRelativeTime } from "@/lib/ui/format";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  status: SaleroomConnectionStatus;
  lastEventAt?: string | null;
  className?: string;
  /** When true, hide the chip while connected (less noise on hub cards). */
  hideWhenConnected?: boolean;
};

const STATUS_COPY: Record<SaleroomConnectionStatus, { label: string; dotClass: string }> = {
  connected: { label: "Connected", dotClass: "bg-success" },
  reconnecting: { label: "Reconnecting", dotClass: "bg-warning animate-pulse" },
  disconnected: { label: "Stale", dotClass: "bg-error" },
};

export function ConnectionStatusChip({
  status,
  lastEventAt,
  className,
  hideWhenConnected = false,
}: Props) {
  if (hideWhenConnected && status === "connected") return null;
  const copy = STATUS_COPY[status];
  const updatedLabel =
    lastEventAt != null
      ? `Updated ${formatRelativeTime(new Date(lastEventAt))}`
      : status === "connected"
        ? "Listening"
        : "Waiting for events";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-body text-xs text-on-surface-variant",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", copy.dotClass)} aria-hidden />
        <span>{copy.label}</span>
      </span>
      <span className="text-on-surface-variant/80">· {updatedLabel}</span>
    </span>
  );
}
