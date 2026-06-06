"use client";

import { useBrowserOnline } from "@/lib/connection/use-browser-online";
import { cn } from "@auction/ui";

/** Slim global banner when the browser reports no network connectivity. */
export function BrowserOfflineBanner() {
  const online = useBrowserOnline();
  if (online) return null;

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: fixed status banner; output is for form results
      role="status"
      aria-live="polite"
      data-testid="browser-offline-banner"
      className={cn(
        "fixed inset-x-0 top-[var(--header-height,0px)] z-[var(--z-banner,50)]",
        "border-b border-error/30 bg-error/95 px-4 py-2 text-center font-body text-xs text-on-error",
      )}
    >
      You are offline. Some features may be unavailable until your connection returns.
    </div>
  );
}
