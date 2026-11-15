/**
 * Shared View Transitions API helper (theme toggle, lot navigation, admin router).
 *
 * A transition declares its kind on the root while it runs (`<html data-view-transition="theme|lot|admin">`).
 * `marketing-header.css` keys its timing off that attribute, so the theme wipe never plays for a
 * navigation and a navigation never inherits the wipe.
 */

export type ViewTransitionKind = "theme" | "lot" | "admin";

/** The latest transition's root marker; an older one that ends late must not clear a newer one's state. */
let latest: object | undefined;

/**
 * Runs `update` inside a view transition of the given kind, or plainly when transitions are
 * unsupported or motion is reduced. Client-only: call it from event handlers. `onFinished` runs
 * when the latest transition ends (completed, skipped or aborted); a transition superseded by a
 * newer one leaves the cleanup to the newer one.
 */
export function withViewTransition(
  kind: ViewTransitionKind,
  update: () => void,
  onFinished?: () => void,
): void {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  };
  const root = doc.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const done = (mine: object) => {
    if (mine !== latest) return;
    delete root.dataset.viewTransition;
    onFinished?.();
  };
  if (reduced || !doc.startViewTransition) {
    update();
    onFinished?.();
    return;
  }
  const mine = {};
  latest = mine;
  root.dataset.viewTransition = kind;
  try {
    // `finished` rejects when a duplicate view-transition-name aborts it; the update has run.
    void doc
      .startViewTransition(update)
      .finished.catch(() => undefined)
      .finally(() => done(mine));
  } catch {
    update();
    done(mine);
  }
}
