import { ConnectivityBannerShell } from "@/components/realtime/connectivity-banner-shell";
import type { LiveConnectionState } from "@/lib/connection/merge-connection-status";

type Props = {
  state: LiveConnectionState;
  message: string | null;
  className?: string;
};

/** Persistent inline banner when live connectivity is not healthy. */
export function ConnectionStatusBanner({ state, message, className }: Props) {
  if (state === "live" || !message) return null;

  const isOffline = state === "offline";

  return (
    <ConnectivityBannerShell
      variant="inline"
      tone={isOffline ? "error" : "warning"}
      testId="connection-status-banner"
      message={message}
      showIcon
      {...(className !== undefined ? { className } : {})}
    />
  );
}
