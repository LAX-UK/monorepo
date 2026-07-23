"use client";

import { useCallback, useRef } from "react";

export const ADMIN_PEOPLE_LIST_HEADING_ID = "admin-people-list-heading";

type Options = {
  /** When preview opens from a deep link, focus this element on close. */
  listHeadingId?: string;
};

/**
 * Captures the row/card trigger before opening a URL-owned preview sheet and restores
 * focus when the sheet closes (with a list-heading fallback for deep links).
 */
export function useAdminListPreviewReturnFocus(options: Options = {}) {
  const listHeadingId = options.listHeadingId ?? ADMIN_PEOPLE_LIST_HEADING_ID;
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const captureReturnFocus = useCallback((target: EventTarget | null) => {
    if (target instanceof HTMLElement) {
      returnFocusRef.current = target;
    }
  }, []);

  const restoreReturnFocus = useCallback(() => {
    const trigger = returnFocusRef.current;
    if (trigger?.isConnected) {
      trigger.focus({ preventScroll: true });
      return;
    }
    const heading = document.getElementById(listHeadingId);
    if (heading instanceof HTMLElement) {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }
      heading.focus({ preventScroll: true });
    }
  }, [listHeadingId]);

  return { captureReturnFocus, restoreReturnFocus };
}
