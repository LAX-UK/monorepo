/**
 * The list keys for every workspace list, read from the page rather than wired per list: each
 * record row (`data-record-row`, from the shared RecordRow) is a stop, its link the focus target.
 * J and K move between rows, Enter follows the focused link (the browser does that), and X ticks
 * the row's checkbox where the list offers one. A new list gets the keys by using RecordRow.
 */

const ROW = "[data-record-row]";
const ROW_LINK = "[data-record-link]";
const ROW_CHECKBOX =
  'input[type="checkbox"]:not(:disabled), [role="checkbox"]:not(:disabled):not([aria-disabled="true"])';
const OPEN_LAYER =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]';

function isShown(element: HTMLElement): boolean {
  return !element.closest('[hidden], [aria-hidden="true"], [inert]');
}

/** The rows' links in reading order, skipping rows that do not open anything. */
export function recordRowTargets(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(ROW)]
    .map((row) => row.querySelector<HTMLElement>(ROW_LINK))
    .filter((link): link is HTMLElement => link !== null && isShown(link));
}

/**
 * Moves focus to the next (1) or previous (-1) row from the one holding focus, or to the first
 * row when focus is elsewhere. Stops at either end rather than wrapping. Returns the row's link,
 * or null when the page has no list.
 */
export function moveRecordFocus(
  root: ParentNode,
  direction: 1 | -1,
  active: Element | null,
): HTMLElement | null {
  const targets = recordRowTargets(root);
  if (targets.length === 0) return null;
  const current = targets.findIndex(
    (target) => target === active || (active !== null && target.closest(ROW)?.contains(active)),
  );
  const index = current === -1 ? 0 : Math.min(Math.max(current + direction, 0), targets.length - 1);
  const target = targets[index] ?? null;
  if (target) {
    target.focus({ preventScroll: true });
    target.closest(ROW)?.scrollIntoView?.({ block: "nearest" });
  }
  return target;
}

/** Ticks or clears the focused row's checkbox; false when the row has none to tick. */
export function toggleRecordSelection(active: Element | null): boolean {
  const row = active?.closest(ROW);
  const checkbox = row?.querySelector<HTMLElement>(ROW_CHECKBOX);
  if (!checkbox) return false;
  checkbox.click();
  return true;
}

/** Whether a dialog, sheet or menu is open, so single-key shortcuts leave the page alone. */
export function isLayerOpen(doc: Document = document): boolean {
  return doc.querySelector(OPEN_LAYER) !== null;
}
