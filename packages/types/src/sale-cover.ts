/**
 * Named cover slots on a sale. Each slot is one art-directed image: where the subject sits,
 * what must stay in frame, how far to zoom in, and the text-over-image settings measured from
 * the picture. The slot names replace the old positional `cover_images` array.
 */
export const SALE_COVER_SLOT_NAMES = ["default", "wide", "phone"] as const;
export type SaleCoverSlotName = (typeof SALE_COVER_SLOT_NAMES)[number];

/** A point in the image, each axis from 0 (left or top) to 1 (right or bottom). */
export type UnitPoint = { x: number; y: number };

/** A rectangle in the image in the same 0 to 1 units. */
export type UnitRect = { x: number; y: number; width: number; height: number };

export type CoverTextTone = "light" | "dark";
export type CoverTextSide = "left" | "right";

/** A detail of one lot photograph used as the cover. */
export type SaleCoverFromLot = {
  lotId: string;
  /** Storage key of the lot photograph. */
  imageKey: string;
  /** Optional pre-crop of the photograph, for example to cut the frame away. */
  crop?: UnitRect;
};

export type SaleCoverSlot = {
  /** Storage key of an uploaded picture. Absent when the slot is taken from a lot. */
  key?: string;
  fromLot?: SaleCoverFromLot;
  /** Pixel size of the source after any lot crop. Set by the server from the stored file. */
  width: number;
  height: number;
  focal: UnitPoint;
  keep?: UnitRect;
  /** 1 shows the whole picture; up to 2.5 shows a detail. */
  zoom: number;
  alt: string;
  toneOverride?: CoverTextTone;
  sideOverride?: CoverTextSide;
  /** Identifies the inputs the analysis was measured from; see `coverAnalysisHash`. */
  analysisHash: string;
};

export type SaleCoverSlots = Partial<Record<SaleCoverSlotName, SaleCoverSlot>>;

export const SALE_FEATURED_LOTS_MAX = 12;
export const SALE_HOME_PINS_MAX = 3;
export const SALE_SUBTITLE_MAX_LENGTH = 160;

// ─── Measured analysis ────────────────────────────────────────────────────────

/** Hero sizes the text sits on. A phone has no text over the picture, so no scrim is measured. */
export const COVER_BREAKPOINT_NAMES = ["desktop", "wide"] as const;
export type CoverBreakpointName = (typeof COVER_BREAKPOINT_NAMES)[number];

/** The lines of text over the picture, each checked on its own. */
export const COVER_TEXT_LINES = ["eyebrow", "title", "sub", "link", "credit"] as const;
export type CoverTextLine = (typeof COVER_TEXT_LINES)[number];

/** The lightest and darkest colour seen in a text zone (hex), used to solve the scrim. */
export type CoverZoneSample = { brightest: string; darkest: string };

/** A scrim solved for one text tone. */
export type CoverToneSolution = {
  /** Scrim opacity at the text corner, between 0.45 and 0.85. */
  strength: number;
  /** Opacity of the band behind the credit line, between 0 and 0.9. */
  creditBand: number;
  /** The strength before it was held to the 0.45 floor. */
  rawStrength: number;
  /** Contrast ratio reached by each line at the stored strength. */
  contrast: Record<CoverTextLine, number>;
};

export type CoverBreakpointAnalysis = {
  zones: Record<CoverTextLine, CoverZoneSample>;
  light: CoverToneSolution | null;
  dark: CoverToneSolution | null;
  /** The tone chosen automatically, or null when neither tone passes (the cover uses the plate). */
  recommended: CoverTextTone | null;
};

export type CoverAnalysis = {
  version: number;
  dominant: string;
  deepest: string;
  /** The deepest colour, darkened until white passes 13:1 on it. */
  field: string;
  /** A 24px blurred preview as a data URL. */
  blurDataURL: string;
  breakpoints: Partial<Record<CoverBreakpointName, CoverBreakpointAnalysis>>;
};

export type CoverAnalysisStatus = "ready" | "failed";

/** The scrim for one hero size once the tone is decided. */
export type CoverScrimSetting = {
  tone: CoverTextTone;
  strength: number;
  creditBand: number;
};

/** A cover slot as the public reads return it. */
export type SaleCoverSlotAsset = {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
  focal: UnitPoint;
  keep?: UnitRect;
  zoom: number;
  alt: string;
  /** Set when the cover is a detail of a lot, so the credit can link to it. */
  lotId?: string;
  side: CoverTextSide;
  analysisStatus: "pending" | CoverAnalysisStatus;
  colours: { dominant: string; deepest: string; field: string } | null;
  /** Null for a size when no analysis is ready or the chosen tone cannot reach contrast. */
  scrim: Partial<Record<CoverBreakpointName, CoverScrimSetting | null>>;
};

export type SaleCoverSlotAssets = Partial<Record<SaleCoverSlotName, SaleCoverSlotAsset>>;
