export type DesktopPickerPlacement = "above" | "below";

export type DesktopPickerPosition = {
  placement: DesktopPickerPlacement;
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

const ANCHOR_GAP_PX = 4;
const DEFAULT_VIEWPORT_PADDING_PX = 8;
/** Minimum scrollable panel height when viewport space is very tight. */
const MIN_PANEL_MAX_HEIGHT_PX = 120;

/** Fallback panel height before the overlay mounts and is measured. */
export const DESKTOP_PICKER_ESTIMATED_HEIGHT_PX = 400;

export type ComputeDesktopPickerPositionInput = {
  anchor: Pick<DOMRect, "top" | "bottom" | "left" | "width">;
  panelHeight: number;
  viewportHeight: number;
  viewportPadding?: number;
};

/**
 * Viewport-aware fixed positioning for desktop picker panels.
 * Flips above the anchor when there is insufficient space below.
 */
export function computeDesktopPickerPosition({
  anchor,
  panelHeight,
  viewportHeight,
  viewportPadding = DEFAULT_VIEWPORT_PADDING_PX,
}: ComputeDesktopPickerPositionInput): DesktopPickerPosition {
  const gap = ANCHOR_GAP_PX;
  const spaceBelow = viewportHeight - anchor.bottom - gap - viewportPadding;
  const spaceAbove = anchor.top - gap - viewportPadding;
  const measuredHeight = Math.max(panelHeight, 1);

  const preferBelow = spaceBelow >= measuredHeight || spaceBelow >= spaceAbove;

  if (preferBelow) {
    return {
      placement: "below",
      left: anchor.left,
      width: anchor.width,
      top: anchor.bottom + gap,
      maxHeight: Math.max(MIN_PANEL_MAX_HEIGHT_PX, spaceBelow),
    };
  }

  return {
    placement: "above",
    left: anchor.left,
    width: anchor.width,
    bottom: viewportHeight - anchor.top + gap,
    maxHeight: Math.max(MIN_PANEL_MAX_HEIGHT_PX, spaceAbove),
  };
}
