/** Width assumed for the "More" button until it has been rendered and measured. */
export const ESTIMATED_MORE_WIDTH = 76;

/**
 * Which tabs fit on one line. The active tab always stays visible, taking the place of the last
 * one that fits; the rest go into "More", whose measured width (`moreWidth`) is kept free. Before
 * the first measurement (and where nothing can be measured) every tab shows.
 */
export function fitViewTabs(
  widths: readonly number[],
  available: number,
  activeIndex: number,
  gap = 2,
  moreWidth = ESTIMATED_MORE_WIDTH,
): { visible: number[]; overflow: number[] } {
  const all = widths.map((_, index) => index);
  const total = widths.reduce((sum, width) => sum + width + gap, 0);
  if (available <= 0 || total <= available) return { visible: all, overflow: [] };
  const room = available - moreWidth - gap;
  const visible: number[] = [];
  let used = 0;
  for (const index of all) {
    const width = (widths[index] ?? 0) + gap;
    if (used + width > room) break;
    visible.push(index);
    used += width;
  }
  if (activeIndex >= 0 && !visible.includes(activeIndex)) {
    const activeWidth = (widths[activeIndex] ?? 0) + gap;
    while (visible.length > 0 && used + activeWidth > room) {
      const dropped = visible.pop() as number;
      used -= (widths[dropped] ?? 0) + gap;
    }
    visible.push(activeIndex);
  }
  visible.sort((a, b) => a - b);
  return { visible, overflow: all.filter((index) => !visible.includes(index)) };
}
