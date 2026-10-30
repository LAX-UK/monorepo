/**
 * The element focus should go back to when an overlay closes. A menu item that opened the
 * overlay disappears with its menu, so focus goes back to the button that opened the menu.
 */
export function returnFocusTarget(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === active.ownerDocument.body) return null;
  const menu = active.closest<HTMLElement>('[role="menu"]');
  if (menu?.id) {
    const menuTrigger = active.ownerDocument.querySelector<HTMLElement>(
      `[aria-controls="${CSS.escape(menu.id)}"]`,
    );
    if (menuTrigger) return menuTrigger;
  }
  return active;
}
