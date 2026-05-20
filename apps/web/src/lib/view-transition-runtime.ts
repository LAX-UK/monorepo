/** Shared View Transitions API helpers (theme toggle, lot navigation, admin router). */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function withViewTransition(cb: () => void): void {
  if (prefersReducedMotion()) {
    cb();
    return;
  }
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  };
  if (typeof doc.startViewTransition !== "function") {
    cb();
    return;
  }
  try {
    const transition = doc.startViewTransition(cb);
    void transition.finished.catch(() => {
      /* Aborted when duplicate view-transition-name exists on the page */
    });
  } catch {
    cb();
  }
}
