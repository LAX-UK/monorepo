"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

/** Marks the history entry pushed while dirty; Back from it stays on the page. */
const SENTINEL_KEY = "__unsavedChangesGuard";

function isSentinel(state: unknown): boolean {
  return typeof state === "object" && state !== null && SENTINEL_KEY in state;
}

function pushSentinel(): void {
  window.history.pushState({ ...window.history.state, [SENTINEL_KEY]: true }, "");
}

type Pending = { kind: "link"; href: string } | { kind: "history" };

/**
 * Guards leaving an editor with unsaved edits: the browser prompt for closing or reloading the
 * tab, a held destination for clicks on in-app links (breadcrumbs, navigation), and the browser
 * Back button. The App Router has no route blocker, so while dirty an extra history entry is
 * pushed: Back then pops that entry (the URL does not change) and is turned into the same
 * confirmation. The caller shows its own confirmation while `pending` is true, then calls
 * `leave` or `stay`.
 */
export function useUnsavedNavigationGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  // True while this hook owns a sentinel entry. A ref rather than history.state alone, so a
  // reload that restores a stale sentinel is never mistaken for one this mount pushed.
  const armed = useRef(false);
  // Set once the user has confirmed leaving, so the Back we trigger is not intercepted again.
  const leaving = useRef(false);
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    if (!dirty) return;
    // Capture phase, so the click is held before the framework's own link handling navigates.
    const hold = (event: MouseEvent) => {
      const href = leavingHref(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "link", href });
    };
    document.addEventListener("click", hold, true);
    return () => document.removeEventListener("click", hold, true);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) {
      // Saved or reverted: drop the extra entry so Back behaves normally again.
      if (armed.current && !leaving.current) {
        armed.current = false;
        if (isSentinel(window.history.state)) window.history.back();
      }
      return;
    }
    // Strict Mode mounts twice; never stack a second entry on top of ours.
    if (!armed.current || !isSentinel(window.history.state)) {
      pushSentinel();
      armed.current = true;
    }
    const onPopState = () => {
      if (leaving.current || isSentinel(window.history.state)) return;
      setPending({ kind: "history" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dirty]);

  const stay = useCallback(() => {
    if (pending?.kind === "history") pushSentinel();
    setPending(null);
  }, [pending]);

  const leave = useCallback(() => {
    if (pending?.kind === "history") {
      // Back already popped the sentinel; one more Back leaves the page for real.
      leaving.current = true;
      armed.current = false;
      window.history.back();
    } else if (pending?.kind === "link") {
      const { href } = pending;
      if (armed.current && isSentinel(window.history.state)) {
        // Step off the sentinel first so it does not linger behind the destination.
        leaving.current = true;
        armed.current = false;
        window.addEventListener("popstate", () => router.push(href), { once: true });
        window.history.back();
      } else {
        router.push(href);
      }
    }
    setPending(null);
  }, [pending, router]);

  /**
   * Removes the extra history entry and resolves once the browser has settled on the page's own
   * entry. A caller about to navigate on its own (for example to a record it just created) must
   * wait for this first: the entry is removed with an asynchronous Back, which would otherwise
   * cancel the navigation that follows it.
   */
  const release = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (!armed.current || !isSentinel(window.history.state)) {
          resolve();
          return;
        }
        leaving.current = true;
        armed.current = false;
        window.addEventListener(
          "popstate",
          () => {
            leaving.current = false;
            resolve();
          },
          { once: true },
        );
        window.history.back();
      }),
    [],
  );

  return { pending: pending !== null, stay, leave, release };
}
