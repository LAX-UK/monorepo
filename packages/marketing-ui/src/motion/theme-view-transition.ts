/**
 * The LAX theme switch: one circular reveal from the pressed toggle, shared by LAX Bid, LAX Shop
 * and lax.art (docs/design/motion.md, MO4/MO7).
 *
 * `marketing-header.css` plays the wipe (`theme-reveal`, from `--theme-toggle-at`) only while
 * `<html data-view-transition="theme">` is set; an unmarked transition is the Bid lot-image morph.
 * The marker and the origin are set inside the update callback and cleared when `finished`
 * settles, so a superseded switch or page change has always cleaned up before the next marker is
 * set (the browser settles the old `finished` before it runs the new update).
 *
 * Switches at once without View Transitions or under reduced motion, resolved as Bid's
 * `useReducedMotion` does: the in-app switch (`data-reduce-motion`) wins over the OS preference.
 * Shop and lax.art never set that attribute, so the OS preference decides there.
 *
 * Kept tiny and dependency-free on purpose: it ships in every layout's header chunk.
 */

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Runs `apply` (the theme change) inside the theme wipe, grown from `button`'s centre. */
export function revealThemeFromToggle(button: Element | null, apply: () => void): void {
  const doc: ViewTransitionDocument = document;
  const root = doc.documentElement;
  const override = root.dataset.reduceMotion;
  if (
    !doc.startViewTransition ||
    override === "force-reduce" ||
    (override !== "force-allow" && matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    apply();
    return;
  }

  // A keyboard press clicks the same button, so its centre is always the origin.
  const rect = button?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : innerWidth - 32;
  const y = rect ? rect.top + rect.height / 2 : 32;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const cleanup = () => {
    delete root.dataset.viewTransition;
    root.style.removeProperty("--theme-toggle-at");
    root.style.removeProperty("--theme-toggle-radius");
  };
  // `finished` rejects only if the update throws; clean up either way.
  doc
    .startViewTransition(() => {
      root.dataset.viewTransition = "theme";
      root.style.setProperty("--theme-toggle-at", `${x}px ${y}px`);
      root.style.setProperty("--theme-toggle-radius", `${radius}px`);
      apply();
    })
    .finished.then(cleanup, cleanup);
}
