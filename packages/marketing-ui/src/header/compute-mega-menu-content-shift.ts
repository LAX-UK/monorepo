type MegaMenuShiftInput = {
  panelLeft: number;
  panelWidth: number;
  triggerLeft: number;
  triggerWidth: number;
  triggerHeight: number;
  contentWidth: number;
};

/** Keep mega-menu links under the open trigger without overflowing the shelf. */
export function computeMegaMenuContentShift({
  panelLeft,
  panelWidth,
  triggerLeft,
  triggerWidth,
  triggerHeight,
  contentWidth,
}: MegaMenuShiftInput): number {
  if (triggerWidth <= 0 && triggerHeight <= 0) return 0;
  const maxLeft = Math.max(0, Math.floor(panelWidth - contentWidth - 16));
  return Math.min(Math.max(0, Math.round(triggerLeft - panelLeft)), maxLeft);
}
