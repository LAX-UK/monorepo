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
