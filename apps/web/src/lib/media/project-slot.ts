import type {
  ContainerBounds,
  ImageIntrinsic,
  NormalizedRect,
  ObjectFitMode,
  OverlayTone,
  ProjectSlotResult,
} from "./overlay-tone-types";

const DEFAULT_OPAQUE_TONE: OverlayTone = "light";
const MIN_OVERLAP_RATIO = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Visible image rect inside container (0–1), accounting for object-fit. */
export function visibleImageRect(
  container: ContainerBounds,
  image: ImageIntrinsic,
  objectFit: ObjectFitMode,
): NormalizedRect {
  const { width: cw, height: ch } = container;
  const { naturalWidth: iw, naturalHeight: ih } = image;

  if (cw <= 0 || ch <= 0 || iw <= 0 || ih <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  const containerAspect = cw / ch;
  const imageAspect = iw / ih;

  if (objectFit === "cover") {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  // object-contain: letterbox
  if (imageAspect > containerAspect) {
    const renderedH = containerAspect / imageAspect;
    const offsetY = (1 - renderedH) / 2;
    return { x: 0, y: offsetY, w: 1, h: renderedH };
  }

  const renderedW = imageAspect / containerAspect;
  const offsetX = (1 - renderedW) / 2;
  return { x: offsetX, y: 0, w: renderedW, h: 1 };
}

function intersectRects(a: NormalizedRect, b: NormalizedRect): NormalizedRect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);

  if (x2 <= x1 || y2 <= y1) return null;

  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function overlapRatio(slot: NormalizedRect, visible: NormalizedRect): number {
  const intersection = intersectRects(slot, visible);
  if (!intersection) return 0;
  const slotArea = slot.w * slot.h;
  if (slotArea <= 0) return 0;
  return (intersection.w * intersection.h) / slotArea;
}

/** Map container-space slot to clipped image-space rect, or opaque fallback. */
export function projectSlotToImageSpace(
  slot: NormalizedRect,
  container: ContainerBounds,
  image: ImageIntrinsic,
  objectFit: ObjectFitMode,
): ProjectSlotResult {
  const visible = visibleImageRect(container, image, objectFit);
  const ratio = overlapRatio(slot, visible);

  if (ratio < MIN_OVERLAP_RATIO) {
    return { kind: "opaque", tone: DEFAULT_OPAQUE_TONE };
  }

  const clipped = intersectRects(slot, visible);
  if (!clipped || clipped.w <= 0 || clipped.h <= 0) {
    return { kind: "opaque", tone: DEFAULT_OPAQUE_TONE };
  }

  // Normalize clipped rect to image-space (0–1 within visible image bounds)
  const imageSpace: NormalizedRect = {
    x: clamp01((clipped.x - visible.x) / visible.w),
    y: clamp01((clipped.y - visible.y) / visible.h),
    w: clamp01(clipped.w / visible.w),
    h: clamp01(clipped.h / visible.h),
  };

  return { kind: "sample", rect: imageSpace };
}

export function serializeRect(rect: NormalizedRect): string {
  const round = (n: number) => (Math.round(n * 10000) / 10000).toFixed(4);
  return `${round(rect.x)},${round(rect.y)},${round(rect.w)},${round(rect.h)}`;
}

/** True when re-extract is needed (material change). */
export function isMaterialRectChange(prev: NormalizedRect, next: NormalizedRect): boolean {
  const threshold = 0.02;
  return (
    Math.abs(prev.x - next.x) >= threshold ||
    Math.abs(prev.y - next.y) >= threshold ||
    Math.abs(prev.w - next.w) >= threshold ||
    Math.abs(prev.h - next.h) >= threshold
  );
}

/** True when visible image bounds shifted materially (≥2px). */
export function isMaterialBoundsChange(
  prev: { offsetX: number; offsetY: number; width: number; height: number },
  next: { offsetX: number; offsetY: number; width: number; height: number },
): boolean {
  const pxThreshold = 2;
  return (
    Math.abs(prev.offsetX - next.offsetX) >= pxThreshold ||
    Math.abs(prev.offsetY - next.offsetY) >= pxThreshold ||
    Math.abs(prev.width - next.width) >= pxThreshold ||
    Math.abs(prev.height - next.height) >= pxThreshold
  );
}

export function visibleImageBoundsPx(
  container: ContainerBounds,
  image: ImageIntrinsic,
  objectFit: ObjectFitMode,
): { offsetX: number; offsetY: number; width: number; height: number } {
  const visible = visibleImageRect(container, image, objectFit);
  return {
    offsetX: visible.x * container.width,
    offsetY: visible.y * container.height,
    width: visible.w * container.width,
    height: visible.h * container.height,
  };
}
