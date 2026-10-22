"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Asks the browser to confirm before the tab is closed, reloaded or navigated away while there
 * are unsaved edits. Browsers show their own generic wording, so there is no message to supply.
 * Navigation inside the app is not covered; `useUnsavedNavigationGuard` adds that.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The in-page destination of a click on a link that would leave this page, or null when the
 * click stays on the page, opens elsewhere or is not a link.
 */
function leavingHref(event: MouseEvent): string | null {
  if (event.defaultPrevented || !isPlainLeftClick(event)) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Guards leaving an editor with unsaved edits: the browser prompt for closing or reloading the
 * tab, plus a held destination for clicks on in-app links (breadcrumbs, navigation). The caller
 * shows its own confirmation while `pendingHref` is set, then calls `leave` or `stay`.
 */
export function useUnsavedNavigationGuard(dirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    if (!dirty) return;
    // Capture phase, so the click is held before the framework's own link handling navigates.
    const hold = (event: MouseEvent) => {
      const href = leavingHref(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    document.addEventListener("click", hold, true);
    return () => document.removeEventListener("click", hold, true);
  }, [dirty]);

  const stay = useCallback(() => setPendingHref(null), []);
  const leave = useCallback(() => {
    if (pendingHref) router.push(pendingHref);
    setPendingHref(null);
  }, [pendingHref, router]);

  return { pendingHref, stay, leave };
}
