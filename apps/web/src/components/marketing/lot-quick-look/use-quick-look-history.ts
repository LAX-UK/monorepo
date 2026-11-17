"use client";

import { useCallback, useEffect, useRef } from "react";

/** Key set on the one history entry an open quick look adds. Its value is a `QuickLookEntry`. */
export const QUICK_LOOK_HISTORY_KEY = "__laxQuickLook";

/** What the quick look's history entry records, so the entry can be recognised and reopened. */
export type QuickLookEntry = {
  /** Unique across page loads, so an entry left over from before a reload never matches. */
  id: string;
  /** The lot shown when the entry was added; Forward onto the entry reopens it. */
  lotId: string;
  /** The address the entry was added at; an entry is only reused or reopened at that address. */
  href: string;
};

/** Differs on every page load; module state alone restarts at the same values after a reload. */
const pageLoadId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
let entrySeq = 0;

function stateObject(): Record<string, unknown> {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null ? (state as Record<string, unknown>) : {};
}

/** The quick-look entry the browser is on, if the current history entry is one. */
export function currentQuickLookEntry(): QuickLookEntry | null {
  const value = stateObject()[QUICK_LOOK_HISTORY_KEY];
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<QuickLookEntry>;
  return typeof entry.id === "string" &&
    typeof entry.lotId === "string" &&
    typeof entry.href === "string"
    ? (entry as QuickLookEntry)
    : null;
}

type Options = {
  open: boolean;
  /** The lot on show; recorded on the entry. */
  lotId: string | undefined;
  /** Close the quick look because the visitor pressed Back. */
  close: () => void;
  /** Show the given lot again (Forward onto the entry). Returns false when it can't. */
  reopen: (lotId: string) => boolean;
  /** The router's pathname. A change while open means a link inside the quick look navigated. */
  pathname: string | null;
  /**
   * True when the list that opened the quick look has gone, e.g. Back was pressed while the dialog
   * was still loading. The quick look then closes instead of opening over another page.
   */
  isStale: () => boolean;
};

/**
 * Lets the browser Back button close the quick look instead of leaving the lot list.
 *
 * Opening adds one history entry at the same address (no query, no hash), carrying the router's
 * own state so the app router treats it as its own. Back pops it and closes the quick look, which
 * leaves the list where it was. Closing any other way (X, Escape, backdrop, "Back to results")
 * steps back over that entry so none is left behind. Moving lot to lot inside the deck changes
 * nothing here, so it never adds entries.
 *
 * Entries that outlive the quick look that added them are put back to use rather than left as a
 * step that does nothing:
 * - after a reload, the next quick look opened on that page takes over the leftover entry instead
 *   of adding a second one;
 * - Forward (or Back from a later page) onto a quick-look entry reopens that lot, or steps back
 *   over the entry when the lot is no longer to hand.
 *
 * Next's refresh and server-action updates rewrite the current entry without our key. Closing
 * then still steps back as long as the address is the one the entry was added at.
 *
 * Lives in the lazily loaded dialog, so the page's first load does not carry it.
 *
 * Returns `releaseForNavigation`: call it when the quick look is about to navigate in place with
 * `replace`, so the new page takes the quick look's entry and closing does not step back.
 */
export function useQuickLookHistory({
  open,
  lotId,
  close,
  reopen,
  pathname,
  isStale,
}: Options): () => void {
  /** True while the entry this quick look added is the current one. */
  const pushedRef = useRef(false);
  const entryRef = useRef<QuickLookEntry | null>(null);
  /** Where the list was scrolled when the quick look opened; Back puts it there again. */
  const scrollYRef = useRef(0);
  /** True between a `history.back()` this hook made and the popstate that answers it. */
  const steppingBackRef = useRef(false);
  const latest = useRef({ open, lotId, close, reopen, isStale });
  latest.current = { open, lotId, close, reopen, isStale };

  const claim = useCallback(() => {
    entrySeq += 1;
    const entry: QuickLookEntry = {
      id: `${pageLoadId}:${entrySeq}`,
      lotId: latest.current.lotId ?? "",
      href: window.location.href,
    };
    const state = { ...stateObject(), [QUICK_LOOK_HISTORY_KEY]: entry };
    const leftover = currentQuickLookEntry();
    // An entry left over from before a reload sits on top of this same list already: reuse it.
    if (leftover && leftover.href === entry.href) window.history.replaceState(state, "");
    else window.history.pushState(state, "");
    entryRef.current = entry;
    scrollYRef.current = window.scrollY;
    pushedRef.current = true;
  }, []);

  useEffect(() => {
    if (open) {
      // Wait for a pending step back to land before adding the entry again.
      if (pushedRef.current || steppingBackRef.current) return;
      if (latest.current.isStale()) latest.current.close();
      else claim();
      return;
    }
    if (!pushedRef.current) return;
    pushedRef.current = false;
    const current = currentQuickLookEntry();
    const ours = entryRef.current;
    const onOurEntry = current
      ? current.id === ours?.id
      : // A router refresh dropped the key; the address says we have not moved.
        window.location.href === ours?.href;
    if (onOurEntry) {
      steppingBackRef.current = true;
      window.history.back();
    }
  }, [open, claim]);

  useEffect(() => {
    // Keep the entry pointing at the lot on show, so Forward reopens the lot last seen.
    const ours = entryRef.current;
    if (!pushedRef.current || !lotId || !ours || ours.lotId === lotId) return;
    if (currentQuickLookEntry()?.id !== ours.id) return;
    entryRef.current = { ...ours, lotId };
    window.history.replaceState(
      { ...stateObject(), [QUICK_LOOK_HISTORY_KEY]: entryRef.current },
      "",
    );
  }, [lotId]);

  useEffect(() => {
    // A link inside the quick look navigated without going through `releaseForNavigation`. The
    // new page owns the current entry now; close without stepping back from it.
    const ours = entryRef.current;
    if (!pushedRef.current || pathname == null || !ours) return;
    if (new URL(ours.href).pathname === pathname) return;
    pushedRef.current = false;
    latest.current.close();
  }, [pathname]);

  useEffect(() => {
    function onPopState() {
      const current = currentQuickLookEntry();
      if (steppingBackRef.current) {
        steppingBackRef.current = false;
        if (latest.current.open && !pushedRef.current) claim();
        return;
      }
      if (pushedRef.current) {
        if (current?.id === entryRef.current?.id) return;
        // The visitor pressed Back: the browser already removed the entry.
        pushedRef.current = false;
        latest.current.close();
        // The browser then restores the scroll it saved for the list entry, which after a reload
        // is from before it. Put the list back where it was when the quick look opened.
        const scrollY = scrollYRef.current;
        window.requestAnimationFrame(() => {
          if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY, behavior: "instant" });
        });
        return;
      }
      if (!current || latest.current.open || current.href !== window.location.href) return;
      // Forward (or Back from a later page) onto a quick-look entry with nothing open.
      entryRef.current = current;
      scrollYRef.current = window.scrollY;
      pushedRef.current = true;
      if (latest.current.reopen(current.lotId)) return;
      pushedRef.current = false;
      steppingBackRef.current = true;
      window.history.back();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [claim]);

  return useCallback(() => {
    pushedRef.current = false;
  }, []);
}
