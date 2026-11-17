"use client";

import { cn } from "@auction/ui/lib/utils";

type Props = {
  tone: "error" | "warning";
  message: string;
  testId: string;
};

/**
 * Publishes the banner's height as `--connectivity-banner-height`, which `--header-height` and
 * `--header-offset` add (see `publishHeaderVars`), so the page and every sticky bar under the header
 * move down by the banner instead of sliding beneath it. Only one top banner shows at a time (the
 * live notices hide while the browser is offline).
 *
 * While scrolled, the view then moves by however far the content under the reader moved, at once
 * and again once the change has landed (a reduced-motion transition delays it a frame), so the
 * reader's place holds still. Browser scroll anchoring cannot be relied on for this: WebKit has
 * none and Chromium skips it here.
 */
function publishBannerHeight(height: number) {
  const anchor = scrollY > 0 ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
  const before = anchor?.getBoundingClientRect().top ?? 0;
  document.documentElement.style.setProperty("--connectivity-banner-height", `${height}px`);
  const holdPlace = () => {
    const moved = (anchor?.getBoundingClientRect().top ?? before) - before;
    if (moved) scrollBy(0, moved);
  };
  holdPlace();
  requestAnimationFrame(() => requestAnimationFrame(holdPlace));
}

function measureBanner(el: HTMLDivElement | null) {
  if (!el) return;
  const observer = new ResizeObserver(() => publishBannerHeight(el.offsetHeight));
  observer.observe(el);
  return () => {
    observer.disconnect();
    publishBannerHeight(0);
  };
}

/**
 * Shared a11y shell for the browser-offline and live-connectivity banners: fixed where the visible
 * header ends (the header offset less the banner it includes), overlaying the page (no space in
 * the flow) while its measured height joins the header offsets. Staff pages, which have no
 * marketing header, set `--connectivity-banner-top` (the staff top bar).
 */
export function ConnectivityBannerShell({ tone, message, testId }: Props) {
  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: status banner; output is for form results
      role="status"
      aria-live="polite"
      data-testid={testId}
      ref={measureBanner}
      className={cn(
        "fixed inset-x-0 top-[var(--connectivity-banner-top,calc(var(--header-offset,var(--header-height,0px))-var(--connectivity-banner-height,0px)))] z-[var(--z-banner,50)]",
        "border-b px-4 py-2 text-center font-body text-xs",
        tone === "error"
          ? "border-error/30 bg-error/95 text-on-error"
          : "border-warning/30 bg-warning/95 text-on-warning",
      )}
    >
      <p>{message}</p>
    </div>
  );
}
