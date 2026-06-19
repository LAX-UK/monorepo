import type { LiveConnectionState } from "@/lib/connection/merge-connection-status";
import { cn } from "@auction/ui";
import { WifiOff } from "lucide-react";

type Props = {
  state: LiveConnectionState;
  message: string | null;
  className?: string;
};

/** Persistent banner when live bidding connectivity is not healthy. */
export function ConnectionStatusBanner({ state, message, className }: Props) {
  if (state === "live" || !message) return null;

  const isOffline = state === "offline";

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: inline status banner; output is for form results
      role="status"
      aria-live="polite"
      data-testid="connection-status-banner"
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 font-body text-sm",
        isOffline
          ? "border-error/30 bg-error/10 text-on-surface"
          : "border-warning/40 bg-warning/10 text-on-surface",
        className,
      )}
    >
      <WifiOff
        className={cn("mt-0.5 size-4 shrink-0", isOffline ? "text-error" : "text-warning")}
        aria-hidden
      />
      <p>{message}</p>
    </div>
  );
}
