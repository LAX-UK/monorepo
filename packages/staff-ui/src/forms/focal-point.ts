/** A point in a picture, each axis from 0 (left or top) to 1 (right or bottom). */
export type FocalPoint = { x: number; y: number };

/** An arrow key moves the point by this much of the picture; Shift moves it further. */
export const FOCAL_STEP = 0.01;
export const FOCAL_STEP_LARGE = 0.05;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** The point under a pointer, in the box it is over, kept inside the picture. */
export function focalFromPointer(
  pointer: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
): FocalPoint {
  if (box.width <= 0 || box.height <= 0) return { x: 0.5, y: 0.5 };
  return {
    x: round3(clamp01((pointer.clientX - box.left) / box.width)),
    y: round3(clamp01((pointer.clientY - box.top) / box.height)),
  };
}

/** The point after an arrow key, or null for any other key. */
export function focalFromKey(point: FocalPoint, key: string, large: boolean): FocalPoint | null {
  const step = large ? FOCAL_STEP_LARGE : FOCAL_STEP;
  const move = (dx: number, dy: number): FocalPoint => ({
    x: round3(clamp01(point.x + dx)),
    y: round3(clamp01(point.y + dy)),
  });
  switch (key) {
    case "ArrowLeft":
      return move(-step, 0);
    case "ArrowRight":
      return move(step, 0);
    case "ArrowUp":
      return move(0, -step);
    case "ArrowDown":
      return move(0, step);
    case "Home":
      return { x: 0.5, y: 0.5 };
    default:
      return null;
  }
}

/** "70% across, 40% down": what a screen reader hears and what the caption shows. */
export function describeFocal(point: FocalPoint): string {
  return `${Math.round(point.x * 100)}% across, ${Math.round(point.y * 100)}% down`;
}
