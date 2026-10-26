import type { SaleroomConnectionStatus } from "@/features/saleroom/types/staff-saleroom.vm";
import { cn, formatStaffRelative } from "@auction/staff-ui";

type Props = {
  status: SaleroomConnectionStatus;
  lastEventAt?: string | null;
  className?: string;
  /** When true, hide the chip while connected (less noise on hub cards). */
  hideWhenConnected?: boolean;
};

const STATUS_COPY: Record<SaleroomConnectionStatus, { label: string; dotClass: string }> = {
  connected: { label: "Connected", dotClass: "bg-staff-success-dot" },
  reconnecting: { label: "Reconnecting", dotClass: "animate-pulse bg-staff-warning-dot" },
  disconnected: { label: "Connection lost", dotClass: "bg-staff-danger-dot" },
};

/** Whether the live feed is arriving: the state in words, and when it last heard something. */
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
      ? `Updated ${formatStaffRelative(lastEventAt)}`
      : status === "connected"
        ? "Listening"
        : "Waiting for events";

  return (
    <output
      className={cn("inline-flex items-center gap-2 text-staff-sm text-staff-muted", className)}
    >
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className={cn("size-2 rounded-full", copy.dotClass)} />
        <span className="font-medium text-staff-fg">{copy.label}</span>
      </span>
      <span>· {updatedLabel}</span>
    </output>
  );
}
