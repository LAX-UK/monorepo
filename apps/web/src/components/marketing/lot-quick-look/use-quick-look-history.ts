"use client";

import { useCallback, useEffect, useRef } from "react";

/** Key set on the one history entry an open quick look adds; its value identifies that entry. */
export const QUICK_LOOK_HISTORY_KEY = "__laxQuickLook";

let entrySeq = 0;

function currentEntryId(): unknown {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null
    ? (state as Record<string, unknown>)[QUICK_LOOK_HISTORY_KEY]
    : undefined;
}

/**
 * Lets the browser Back button close the quick look instead of leaving the lot list.
 *
 * Opening adds one history entry at the same address (no query, no hash), carrying the router's
 * own state so the app router treats it as its own. Back pops it and closes the quick look, which
 * leaves the list where it was. Closing any other way (X, Escape, backdrop, "Back to results")
 * steps back over that entry so none is left behind. Moving lot to lot inside the deck changes
 * nothing here, so it never adds entries.
 *
 * Lives in the lazily loaded dialog, so the page's first load does not carry it.
 *
 * Returns `releaseForNavigation`: call it when a link inside the quick look is about to navigate
 * with `replace`, so the new page takes the quick look's entry and closing does not step back.
 */
export function useQuickLookHistory(open: boolean, close: () => void): () => void {
  /** True while the entry this quick look added is the current one. */
  const pushedRef = useRef(false);
  const entryIdRef = useRef(0);
  /** True between a `history.back()` this hook made and the popstate that answers it. */
  const steppingBackRef = useRef(false);
  const openRef = useRef(open);
  const closeRef = useRef(close);
  openRef.current = open;
  closeRef.current = close;

  const push = useCallback(() => {
    const current: unknown = window.history.state;
    const base = typeof current === "object" && current !== null ? current : {};
    entrySeq += 1;
    entryIdRef.current = entrySeq;
    window.history.pushState({ ...base, [QUICK_LOOK_HISTORY_KEY]: entrySeq }, "");
    pushedRef.current = true;
  }, []);

  useEffect(() => {
    if (open) {
      // Wait for a pending step back to land before adding the entry again.
      if (!pushedRef.current && !steppingBackRef.current) push();
      return;
    }
    if (!pushedRef.current) return;
    pushedRef.current = false;
    if (currentEntryId() === entryIdRef.current) {
      steppingBackRef.current = true;
      window.history.back();
    }
  }, [open, push]);

  useEffect(() => {
    function onPopState() {
      if (steppingBackRef.current) {
        steppingBackRef.current = false;
        if (openRef.current && !pushedRef.current) push();
        return;
      }
      if (!pushedRef.current || currentEntryId() === entryIdRef.current) return;
      // The visitor pressed Back: the browser already removed the entry.
      pushedRef.current = false;
      closeRef.current();
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [push]);

  return useCallback(() => {
    pushedRef.current = false;
  }, []);
}
