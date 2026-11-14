/*
 * A row that is a link: the title cell is a real <a> to the record, and the rest of the row
 * follows it, with the browser's own conventions for new tabs (staff design standard, TBL-8).
 */

type ClickLike = {
  metaKey: boolean;
  ctrlKey: boolean;
  button?: number;
};

/** Cmd- or Ctrl-click, or the middle button: the person wants a new tab. */
export function wantsNewTab(event: ClickLike): boolean {
  return event.metaKey || event.ctrlKey || event.button === 1;
}

export function openInNewTab(href: string): void {
  window.open(href, "_blank", "noopener");
}

/** The row's own link: the anchor whose href is the row's, else one marked as the row link. */
export function findRowLink(container: Element, href: string): HTMLAnchorElement | null {
  const anchors = [...container.querySelectorAll<HTMLAnchorElement>("a[href]")];
  return (
    anchors.find((anchor) => anchor.getAttribute("href") === href) ??
    container.querySelector<HTMLAnchorElement>("a[data-staff-row-link]")
  );
}

/** True when the anchor is the row's link rather than another link in a cell. */
export function isRowLink(anchor: Element, href: string): boolean {
  return anchor.getAttribute("href") === href || anchor.hasAttribute("data-staff-row-link");
}

/** True when the person was selecting text in the row, which should never open it. */
export function selectingTextIn(element: Element): boolean {
  const selection = typeof window === "undefined" ? null : window.getSelection?.();
  if (!selection || selection.isCollapsed || selection.toString().trim() === "") return false;
  return element.contains(selection.anchorNode);
}
