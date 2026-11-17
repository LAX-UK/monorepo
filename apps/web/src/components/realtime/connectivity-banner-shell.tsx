"use client";

import { CONNECTIVITY_BANNER_HEIGHT_VAR } from "@auction/marketing-ui/header/header-offset";
import { cn } from "@auction/ui/lib/utils";
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

/** Heights of the top banners on screen; the tallest is published (they share one slot). */
const topBannerHeights = new Map<Element, number>();

/**
 * Publishes the banner height that `--header-height` and `--header-offset` add, so the page and
 * every sticky bar move down by the banner instead of sliding under it. While scrolled, the view
 * then moves by however far the content under the reader moved, at once and again once the change
 * has landed (a reduced-motion transition delays it a frame), so the reader's place holds still.
 * Browser scroll anchoring cannot be relied on for this: WebKit has none and Chromium skips it here.
 */
function publishTopBannerHeight() {
  const root = document.documentElement;
  const height = Math.max(0, ...topBannerHeights.values());
  const anchor =
    window.scrollY > 0 ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
  const before = anchor?.getBoundingClientRect().top ?? 0;
  if (height) root.style.setProperty(CONNECTIVITY_BANNER_HEIGHT_VAR, `${height}px`);
  else root.style.removeProperty(CONNECTIVITY_BANNER_HEIGHT_VAR);
  if (!anchor) return;
  const holdPlace = () => {
    const moved = anchor.getBoundingClientRect().top - before;
    if (moved) window.scrollBy(0, moved);
  };
  holdPlace();
  requestAnimationFrame(() => requestAnimationFrame(holdPlace));
}

function measureTopBanner(el: HTMLDivElement | null) {
  if (!el) return;
  const observer = new ResizeObserver(() => {
    topBannerHeights.set(el, el.offsetHeight);
    publishTopBannerHeight();
  });
  observer.observe(el);
  return () => {
    observer.disconnect();
    topBannerHeights.delete(el);
    publishTopBannerHeight();
  };
}

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
      {...(variant === "fixed-top" ? { ref: measureTopBanner } : {})}
      className={cn(
        variant === "fixed-top"
          ? cn(
              // Overlays the page (no space in the flow); its measured height joins the header
              // offsets instead. Hosts without the marketing header set `--connectivity-banner-top`.
              "fixed inset-x-0 top-[var(--connectivity-banner-top,var(--header-bar-offset,var(--header-height,0px)))] z-[var(--z-banner,50)]",
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
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isError ? "text-error" : "text-warning-on-surface",
          )}
          aria-hidden
        />
      ) : null}
      {children ?? <p>{message}</p>}
    </div>
  );
}
