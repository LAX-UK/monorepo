import { cn } from "@auction/ui";
import { WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export type ConnectivityBannerVariant = "fixed-top" | "inline";
export type ConnectivityBannerTone = "error" | "warning";

type Props = {
  variant: ConnectivityBannerVariant;
  tone: ConnectivityBannerTone;
  message: string;
  testId: string;
  className?: string;
  /** When true (inline only), show the wifi-off icon beside the message. */
  showIcon?: boolean;
  children?: ReactNode;
};

/** Shared a11y shell for browser-offline and live-connectivity banners. */
export function ConnectivityBannerShell({
  variant,
  tone,
  message,
  testId,
  className,
  showIcon = false,
  children,
}: Props) {
  const isError = tone === "error";

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: status banner; output is for form results
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={cn(
        variant === "fixed-top"
          ? cn(
              "fixed inset-x-0 top-[var(--header-height,0px)] z-[var(--z-banner,50)]",
              "border-b px-4 py-2 text-center font-body text-xs",
              isError
                ? "border-error/30 bg-error/95 text-on-error"
                : "border-warning/30 bg-warning/95 text-on-warning",
            )
          : cn(
              "flex items-start gap-3 rounded-md border px-4 py-3 font-body text-sm",
              isError
                ? "border-error/30 bg-error/10 text-on-surface"
                : "border-warning/40 bg-warning/10 text-on-surface",
            ),
        className,
      )}
    >
      {showIcon ? (
        <WifiOff
          className={cn("mt-0.5 size-4 shrink-0", isError ? "text-error" : "text-warning")}
          aria-hidden
        />
      ) : null}
      {children ?? <p>{message}</p>}
    </div>
  );
}
