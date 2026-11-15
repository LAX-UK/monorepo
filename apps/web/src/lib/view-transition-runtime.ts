/**
 * View Transitions API helper for page changes (lot navigation, admin router).
 *
 * `marketing-header.css` times every transition by its kind, read from
 * `<html data-view-transition="...">` while it runs. A transition started here is unmarked, which
 * the stylesheet times as the public page change (the lot image morph). A caller that needs other
 * timing marks its own kind from the transition it gets back (the admin router marks `"admin"`);
 * the theme toggle (`theme-toggle.tsx`) marks `"theme"` and does not import this module, so the
 * shared layout carries none of it.
 *
 * Marking order: a kind is set inside the update callback and cleared when that transition's
 * `finished` settles. When a new transition supersedes a running one, the browser settles the old
 * one's `finished` before it runs the new update callback (both are queued in that order), so the
 * old cleanup always runs before the new marker is set and needs no guard.
 */

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Runs `update` inside a view transition, or plainly when transitions are unsupported or motion is
 * reduced (motion.md: skip transitions under reduced motion). Reduced motion is resolved as
 * `useReducedMotion` does: the in-app switch (`data-reduce-motion`, set before paint and by the
 * settings page) wins, otherwise the OS preference applies. Returns the transition when one
 * started. Client-only: call it from event handlers.
 */
export function withViewTransition(update: () => void): { finished: Promise<void> } | undefined {
  const doc: ViewTransitionDocument = document;
  const override = doc.documentElement.dataset.reduceMotion;
  if (
    !doc.startViewTransition ||
    override === "force-reduce" ||
    (override !== "force-allow" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    update();
    return;
  }
  return doc.startViewTransition(update);
}
