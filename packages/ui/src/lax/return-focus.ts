"use client";

import * as React from "react";

/**
 * The element focus should go back to when an overlay closes. A menu item that opened the
 * overlay disappears with its menu, so focus goes back to the button that opened the menu.
 */
export function returnFocusTarget(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === active.ownerDocument.body) return null;
  const menu = active.closest<HTMLElement>('[role="menu"]');
  if (menu?.id) {
    const menuTrigger = active.ownerDocument.querySelector<HTMLElement>(
      `[aria-controls="${CSS.escape(menu.id)}"]`,
    );
    if (menuTrigger) return menuTrigger;
  }
  return active;
}

/**
 * Returns focus to whatever opened an overlay once it closes. Dialogs and sheets open from
 * state rather than from a trigger element, so without this focus would fall back to the page
 * body and keyboard users would lose their place. Pass the result as `onCloseAutoFocus`.
 */
export function useReturnFocus(
  open: boolean,
  /**
   * Where focus goes when the element that opened the overlay is gone or nothing was focused,
   * e.g. the overlay opened from a keyboard shortcut or the list re-rendered its rows.
   */
  fallback?: () => HTMLElement | null,
): (event: Event) => void {
  const target = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);
  const fallbackRef = React.useRef(fallback);
  fallbackRef.current = fallback;
  // Read during render, before the overlay mounts and moves focus inside itself.
  if (open && !wasOpen.current && typeof document !== "undefined") {
    target.current = returnFocusTarget(document.activeElement);
  }
  wasOpen.current = open;

  return React.useCallback((event: Event) => {
    const captured = target.current;
    target.current = null;
    const element = captured?.isConnected ? captured : (fallbackRef.current?.() ?? null);
    if (!element?.isConnected) return;
    event.preventDefault();
    element.focus({ preventScroll: true });
  }, []);
}
