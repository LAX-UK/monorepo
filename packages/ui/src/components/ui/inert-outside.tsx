"use client";

import { useEffect } from "react";

/** The attribute Radix's modal layers (through `aria-hidden`) put on everything they hide. */
const HIDDEN_BY_LAYER = '[data-aria-hidden="true"]';

/**
 * Makes the page behind an open modal select or menu inert, not only hidden from readers.
 *
 * Radix hides the rest of the page with `aria-hidden` while a select or modal menu is open, but
 * leaves its links and buttons focusable: a hidden region with focusable content, which screen
 * readers can still land in (axe `aria-hidden-focus`). Rendered inside the open content, this
 * marks the same regions `inert` once Radix has hidden them, and gives them back on close. Only
 * regions it marked itself are restored, so another layer's `inert` is left alone.
 */
export function InertOutside() {
  useEffect(() => {
    const marked: Element[] = [];
    let cancelled = false;
    // Radix hides the page in its own effect, which runs after this child's: wait for it.
    queueMicrotask(() => {
      if (cancelled) return;
      for (const el of document.querySelectorAll(HIDDEN_BY_LAYER)) {
        if (el.hasAttribute("inert")) continue;
        el.setAttribute("inert", "");
        marked.push(el);
      }
    });
    return () => {
      cancelled = true;
      for (const el of marked) el.removeAttribute("inert");
    };
  }, []);
  return null;
}
