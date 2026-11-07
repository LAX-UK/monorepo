/**
 * Moves focus to the page's own heading (its first `h1`), so someone who has just changed account
 * with a keyboard or a screen reader starts reading the new page instead of the top of the document.
 * The heading is made focusable for the purpose and is not tabbable. Returns whether it found one.
 */
export function focusPageHeading(root: ParentNode = document): boolean {
  const heading =
    root.querySelector<HTMLElement>("main h1") ?? root.querySelector<HTMLElement>("h1");
  if (!heading) return false;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
  return true;
}

/** When to look again: a page that is still streaming in can replace the heading just focused. */
const SETTLE_DELAYS_MS = [100, 300, 700, 1500] as const;

/** Nothing has focus: the document itself is where focus rests. */
function nothingFocused(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

/**
 * Focuses the page's heading now and again as the page settles, but only while nothing else has
 * focus and `stop()` says the person has not started using the page. A heading that is replaced
 * while the page streams in drops focus to the document; this puts it back. It never takes focus
 * from a control the person has reached, and an open menu or popover keeps it: pulling focus out
 * of one closes it under their hand.
 */
export function focusPageHeadingWhenSettled(stop: () => boolean = () => false): void {
  const attempt = () => {
    if (stop() || !nothingFocused()) return;
    focusPageHeading();
  };
  attempt();
  for (const delay of SETTLE_DELAYS_MS) window.setTimeout(attempt, delay);
}
