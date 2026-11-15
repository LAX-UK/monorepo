/**
 * Shared View Transitions API helpers (theme toggle, lot navigation, admin router).
 *
 * Every transition declares its kind on the root element while it runs
 * (`<html data-view-transition="theme|lot|admin">`). The CSS in `marketing-header.css` keys its
 * timing off that attribute, so the theme wipe never plays for a navigation and a navigation never
 * inherits the wipe.
 */

export type ViewTransitionKind = "theme" | "lot" | "admin";

export const VIEW_TRANSITION_ATTR = "data-view-transition";

const REDUCE_MOTION_KEY = "reduceMotion";

/** True when motion is reduced by the OS or by Bid's in-app motion switch (`force-reduce`). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const override = document.documentElement.dataset[REDUCE_MOTION_KEY];
  if (override === "force-reduce") return true;
  if (override === "force-allow") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Whether a transition will actually play (supported and motion allowed). */
export function canPlayViewTransition(): boolean {
  if (prefersReducedMotion()) return false;
  return typeof (document as TransitionDocument).startViewTransition === "function";
}

/**
 * Runs `update` inside a view transition of the given kind, or plainly when transitions are
 * unsupported or motion is reduced (content swaps). `onFinished` runs once the transition ends,
 * whether it completed, was skipped or was aborted.
 */
export function withViewTransition(
  kind: ViewTransitionKind,
  update: () => void,
  onFinished?: () => void,
): void {
  if (!canPlayViewTransition()) {
    update();
    onFinished?.();
    return;
  }
  const root = document.documentElement;
  root.setAttribute(VIEW_TRANSITION_ATTR, kind);
  const done = () => {
    if (root.getAttribute(VIEW_TRANSITION_ATTR) === kind)
      root.removeAttribute(VIEW_TRANSITION_ATTR);
    onFinished?.();
  };
  try {
    const transition = (document as TransitionDocument).startViewTransition?.(update);
    if (!transition) {
      update();
      done();
      return;
    }
    // Aborted when a duplicate view-transition-name exists on the page; the update has run.
    void transition.finished.catch(() => undefined).finally(done);
  } catch {
    update();
    done();
  }
}
