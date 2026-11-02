/**
 * The layout solver for the hang: the works of a sale shown at their real relative size on one
 * wall. Pure arithmetic with no React or DOM, so every rule is tested on its own.
 *
 * One factor (pixels per centimetre) scales the whole wall, so a 40 cm work is visibly smaller
 * than a 120 cm one. When the sizes cannot be trusted the wall switches to salon mode: equal
 * heights and an honest "Not to scale".
 */

export type HangViewport = "desktop" | "phone";

/** One work as the solver sees it. */
export type HangWorkInput = {
  id: string;
  /** Picture width divided by height. */
  aspect: number;
  /**
   * The long side of the work in centimetres: the framed size when the photograph shows the
   * frame, otherwise the work's own size. `null` when the size is missing or unreadable.
   */
  longSideCm: number | null;
  /** Pixel height of the source picture, used to stop a small file being stretched. */
  sourceHeightPx?: number | null | undefined;
};

export type HangSolveOptions = {
  viewport: HangViewport;
  /** Hangs a quiet human figure beside a single work (the sale page). */
  figure?: boolean | undefined;
  /** Room the row must fit in. Omit for a scroll row, which may be wider than the screen. */
  fitWidth?: number | undefined;
  /** Narrowest a column gets, so a wall label never squeezes under a small work. */
  minColumnWidth?: number | undefined;
};

export type HangSalonReason = "missing-size" | "wide-range";

export type HangItem = { id: string; width: number; height: number };

export type HangScaleBar = { cm: number; widthPx: number };

export type HangLayout = {
  mode: "scale" | "salon";
  salonReason: HangSalonReason | null;
  /** Pixels per centimetre; `null` in salon mode. */
  pxPerCm: number | null;
  /** Height of the slot every work sits in, so labels share one line under the wall. */
  slotHeight: number;
  items: HangItem[];
  scaleBar: HangScaleBar | null;
  figure: { width: number; height: number } | null;
};

/** The tallest work on the wall, in pixels. */
export const HANG_TALLEST_PX: Record<HangViewport, number> = { desktop: 300, phone: 180 };
/** The height every work gets in salon mode. */
export const HANG_SALON_PX: Record<HangViewport, number> = { desktop: 220, phone: 150 };
export const HANG_GAP_PX: Record<HangViewport, number> = { desktop: 56, phone: 28 };
export const HANG_MIN_COLUMN_PX: Record<HangViewport, number> = { desktop: 168, phone: 140 };
/** The widest a 2 to 5 work row may be on desktop: the 1440 page less its gutters. */
export const HANG_DESKTOP_FIT_PX = 1360;

/** From this many works the row scrolls sideways; fewer sit in one centred row. */
export const HANG_SCROLL_FROM_COUNT = 6;
/** The most works a wall holds. */
export const HANG_MAX_WORKS = 12;

/** A work more than this many times the smallest turns the small one into a speck. */
export const HANG_MAX_SIZE_RATIO = 5;
export const HANG_FIGURE_CM = 170;
/** Width of the figure as a share of its height. */
export const HANG_FIGURE_ASPECT = 0.27;
/** Scale bar lengths in centimetres; the one nearest to the target width is drawn. */
export const HANG_SCALE_BAR_CHOICES = [10, 20, 25, 50, 100] as const;
export const HANG_SCALE_BAR_TARGET_PX = 120;
/** A work is drawn no taller than two thirds of its source picture's height in pixels. */
const MAX_RENDER_PER_SOURCE_PX = 1 / 1.5;
const FIT_SHRINK_STEP = 0.95;
const FIT_MAX_STEPS = 60;

const EMPTY_LAYOUT: HangLayout = {
  mode: "scale",
  salonReason: null,
  pxPerCm: null,
  slotHeight: 0,
  items: [],
  scaleBar: null,
  figure: null,
};

/** Why the wall cannot be drawn to scale, or `null` when it can. */
export function hangSalonReason(works: readonly HangWorkInput[]): HangSalonReason | null {
  const sizes: number[] = [];
  for (const work of works) {
    const cm = work.longSideCm;
    if (cm === null || !Number.isFinite(cm) || cm <= 0 || !(work.aspect > 0)) return "missing-size";
    sizes.push(cm);
  }
  if (sizes.length === 0) return null;
  return Math.max(...sizes) / Math.min(...sizes) > HANG_MAX_SIZE_RATIO ? "wide-range" : null;
}

/** Real-world width and height of a work in centimetres, from its long side and picture shape. */
function sizeInCm(aspect: number, longSideCm: number): { width: number; height: number } {
  return aspect >= 1
    ? { width: longSideCm, height: longSideCm / aspect }
    : { width: longSideCm * aspect, height: longSideCm };
}

export type HangFramedSize = {
  /** Staff ticked "the photograph includes the frame". */
  photoIncludesFrame: boolean;
  /** Long side of the framed work in centimetres, when staff entered one. */
  framedLongSideCm: number | null;
};

export type HangLongSide = {
  longSideCm: number | null;
  /** The photograph shows a frame we have no size for: the label says "shown framed". */
  shownFramed: boolean;
};

/**
 * Which size the wall scales by. With the frame ticked and a framed size entered, the framed
 * size, because the picture shows the frame. Ticked without one, the work's own size, flagged so
 * the label can say the photograph is framed.
 */
export function resolveHangLongSide(
  ownLongSideCm: number | null,
  framed: HangFramedSize,
): HangLongSide {
  if (!framed.photoIncludesFrame) return { longSideCm: ownLongSideCm, shownFramed: false };
  const framedCm = framed.framedLongSideCm;
  if (framedCm !== null && Number.isFinite(framedCm) && framedCm > 0) {
    return { longSideCm: framedCm, shownFramed: false };
  }
  return { longSideCm: ownLongSideCm, shownFramed: true };
}

/** The scale bar length closest to the target width at this factor. */
export function chooseScaleBar(pxPerCm: number): HangScaleBar {
  const distance = (cm: number) => Math.abs(cm * pxPerCm - HANG_SCALE_BAR_TARGET_PX);
  let best: number = HANG_SCALE_BAR_CHOICES[0];
  for (const cm of HANG_SCALE_BAR_CHOICES) {
    if (distance(cm) < distance(best)) best = cm;
  }
  return { cm: best, widthPx: Math.round(best * pxPerCm) };
}

function rowWidth(
  widths: readonly number[],
  minColumn: number,
  gap: number,
  extra: number,
): number {
  const columns = widths.reduce((sum, w) => sum + Math.max(w, minColumn), 0);
  return columns + gap * Math.max(0, widths.length - 1) + extra;
}

function solveSalon(
  works: readonly HangWorkInput[],
  reason: HangSalonReason,
  viewport: HangViewport,
  minColumn: number,
  fitWidth: number | undefined,
): HangLayout {
  const gap = HANG_GAP_PX[viewport];
  let height = HANG_SALON_PX[viewport];
  if (fitWidth !== undefined) {
    for (let step = 0; step < FIT_MAX_STEPS; step++) {
      const total = rowWidth(
        works.map((w) => w.aspect * height),
        minColumn,
        gap,
        0,
      );
      if (total <= fitWidth) break;
      height = Math.floor(height * FIT_SHRINK_STEP);
    }
  }
  return {
    mode: "salon",
    salonReason: reason,
    pxPerCm: null,
    slotHeight: height,
    items: works.map((w) => ({ id: w.id, width: Math.round(w.aspect * height), height })),
    scaleBar: null,
    figure: null,
  };
}

export function solveHangLayout(
  works: readonly HangWorkInput[],
  options: HangSolveOptions,
): HangLayout {
  if (works.length === 0) return EMPTY_LAYOUT;
  const { viewport, fitWidth } = options;
  const minColumn = options.minColumnWidth ?? HANG_MIN_COLUMN_PX[viewport];

  const reason = hangSalonReason(works);
  if (reason) return solveSalon(works, reason, viewport, minColumn, fitWidth);

  const gap = HANG_GAP_PX[viewport];
  const sizes = works.map((w) => sizeInCm(w.aspect, w.longSideCm as number));
  const withFigure = options.figure === true && works.length === 1;
  const tallestCm = Math.max(...sizes.map((s) => s.height), withFigure ? HANG_FIGURE_CM : 0);
  let k = HANG_TALLEST_PX[viewport] / tallestCm;

  if (fitWidth !== undefined) {
    for (let step = 0; step < FIT_MAX_STEPS; step++) {
      const extra = withFigure ? HANG_FIGURE_CM * k * HANG_FIGURE_ASPECT + gap : 0;
      const total = rowWidth(
        sizes.map((s) => s.width * k),
        minColumn,
        gap,
        extra,
      );
      if (total <= fitWidth) break;
      k *= FIT_SHRINK_STEP;
    }
  }

  works.forEach((work, i) => {
    const size = sizes[i];
    if (work.sourceHeightPx && size) {
      k = Math.min(k, (work.sourceHeightPx * MAX_RENDER_PER_SOURCE_PX) / size.height);
    }
  });

  return {
    mode: "scale",
    salonReason: null,
    pxPerCm: k,
    slotHeight: Math.round(tallestCm * k),
    items: works.map((w, i) => ({
      id: w.id,
      width: Math.round((sizes[i]?.width ?? 0) * k),
      height: Math.round((sizes[i]?.height ?? 0) * k),
    })),
    scaleBar: chooseScaleBar(k),
    figure: withFigure
      ? {
          width: Math.round(HANG_FIGURE_CM * k * HANG_FIGURE_ASPECT),
          height: Math.round(HANG_FIGURE_CM * k),
        }
      : null,
  };
}
