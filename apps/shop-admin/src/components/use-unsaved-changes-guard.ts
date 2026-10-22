"use client";

import { useEffect } from "react";

/**
 * Asks the browser to confirm before the tab is closed, reloaded or navigated away while there
 * are unsaved edits. Browsers show their own generic wording, so there is no message to supply.
 * In-app navigation is not covered; the editors guard their own Close and switch actions.
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
