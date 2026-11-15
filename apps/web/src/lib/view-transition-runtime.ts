/**
 * View Transitions API helper for page changes (lot navigation, admin router).
 *
 * A transition declares its kind on the root while it runs (`<html data-view-transition="lot|admin">`).
 * `marketing-header.css` keys its timing off that attribute, so a navigation never inherits the
 * theme wipe. The theme toggle marks its own `"theme"` transition with the same attribute and the
 * same rules (see `theme-toggle.tsx`); it does not import this module, so the helper ships only in
 * the chunks that navigate and the shared layout stays the same size.
 */

export type ViewTransitionKind = "lot" | "admin";

/** The latest transition started here; an older one that ends late must not clear a newer one's marker. */
let latest: object | undefined;

/**
 * Reduced motion as `useReducedMotion` resolves it: the in-app switch (`data-reduce-motion`, set
 * before paint and by the settings page) wins, otherwise the OS preference applies.
 */
function motionReduced(root: HTMLElement): boolean {
  const override = root.dataset.reduceMotion;
  if (override === "force-reduce") return true;
  if (override === "force-allow") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs `update` inside a view transition of the given kind, or plainly when transitions are
 * unsupported or motion is reduced (motion.md: skip transitions under reduced motion). Client-only:
 * call it from event handlers. The marker is cleared when this transition ends, unless a newer
 * transition has replaced it by then.
 */
export function withViewTransition(kind: ViewTransitionKind, update: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  };
  const root = doc.documentElement;
  if (!doc.startViewTransition || motionReduced(root)) {
    update();
    return;
  }
  const mine = {};
  latest = mine;
  root.dataset.viewTransition = kind;
  const done = () => {
    if (mine === latest && root.dataset.viewTransition === kind) delete root.dataset.viewTransition;
  };
  try {
    // `finished` rejects when a duplicate view-transition-name aborts it; the update has run.
    void doc.startViewTransition(update).finished.then(done, done);
  } catch {
    update();
    done();
  }
}
