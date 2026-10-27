import type { ReactNode } from "react";

/**
 * Where a context banner sits above the page. The banners render nothing most of the time, so the
 * gap under them exists only while one is showing; an empty slot must not push the page title
 * down from where it sits in LAX Admin.
 */
export function ContextBannerSlot({ children }: { children: ReactNode }) {
  return (
    <div data-context-banner-slot="" className="not-empty:mb-4">
      {children}
    </div>
  );
}
