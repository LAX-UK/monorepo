import {
  COVER_BOXES,
  type CoverBoxName,
  coverAnalysisHash,
  coverCrop,
  coverZoneRect,
  effectiveCoverSide,
  scrimSettingFor,
} from "@auction/domain";
import {
  COVER_TEXT_LINES,
  type CoverAnalysis,
  type CoverBreakpointName,
  type CoverScrimSetting,
  type CoverTextLine,
  type CoverTextSide,
  type CoverTextTone,
  type SaleCoverSlot,
  type SaleCoverSlotName,
  type UnitRect,
} from "@auction/types";
import type { SlotDraft } from "./cover-draft";
import type { CoverSlotView } from "./cover-view";

/** Previews in the order they are drawn: widest first. */
export const PREVIEW_BOXES: readonly CoverBoxName[] = ["wide", "desktop", "phone"];

export const PREVIEW_LABEL: Record<CoverBoxName, string> = {
  wide: "Wide",
  desktop: "Default",
  phone: "Phone",
};

/** The slot a box shows: its own slot when staff filled it, otherwise the default. */
export function slotServingBox(
  box: CoverBoxName,
  slots: Partial<Record<SaleCoverSlotName, unknown>>,
): SaleCoverSlotName {
  if (box === "wide" && slots.wide) return "wide";
  if (box === "phone" && slots.phone) return "phone";
  return "default";
}

/** The measured state of a slot against what is on screen. */
export type MeasureState =
  | { kind: "none" }
  /** Changed since it was saved: the picture is measured again once it is saved. */
  | { kind: "unsaved" }
  | { kind: "pending" }
  | { kind: "failed" }
  | { kind: "ready"; analysis: CoverAnalysis };

function storedSlotFor(draft: SlotDraft): Omit<SaleCoverSlot, "analysisHash"> | null {
  if (!draft.size) return null;
  const crop = draft.source.kind === "lot" ? draft.source.crop : undefined;
  return {
    ...(draft.source.kind === "upload"
      ? { key: draft.source.key }
      : {
          fromLot: {
            lotId: draft.source.lotId,
            imageKey: draft.pictureKey,
            ...(crop ? { crop } : {}),
          },
        }),
    width: draft.size.width,
    height: draft.size.height,
    focal: draft.focal,
    zoom: draft.zoom,
    alt: draft.alt,
    ...(draft.sideOverride ? { sideOverride: draft.sideOverride } : {}),
  };
}

/**
 * Whether the analysis on file describes what staff see now. The analysis depends on the picture,
 * crop, focal point, zoom and text side (not the tone), so any of those changing makes it stale.
 */
export function measureState(
  name: SaleCoverSlotName,
  draft: SlotDraft | undefined,
  saved: CoverSlotView | undefined,
): MeasureState {
  if (!draft) return { kind: "none" };
  const stored = saved?.slot;
  const candidate = storedSlotFor(draft);
  if (!stored || !candidate || coverAnalysisHash(name, candidate) !== stored.analysisHash) {
    return { kind: "unsaved" };
  }
  const { status, value } = saved.analysis;
  if (status === "failed") return { kind: "failed" };
  if (status === "ready" && value) return { kind: "ready", analysis: value };
  return { kind: "pending" };
}

export type ZoneBoxView = {
  line: CoverTextLine;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropPreview = {
  box: CoverBoxName;
  label: string;
  /** Which slot's picture the box shows. */
  slot: SaleCoverSlotName;
  width: number;
  height: number;
  crop: UnitRect;
  side: CoverTextSide | null;
  /** The five text lines in hero pixels; empty on the phone, where type sits below the picture. */
  zones: ZoneBoxView[];
};

/** The part of the picture each box shows, and where the text sits on it. */
export function cropPreview(
  box: CoverBoxName,
  slot: SaleCoverSlotName,
  draft: SlotDraft,
): CropPreview | null {
  if (!draft.size) return null;
  const side = box === "phone" ? null : effectiveCoverSide(draft);
  const { width, height } = COVER_BOXES[box];
  const crop = coverCrop({
    image: draft.size,
    box: COVER_BOXES[box],
    focal: draft.focal,
    zoom: draft.zoom,
    textSide: side,
  });
  const zones =
    box === "phone" || side === null
      ? []
      : COVER_TEXT_LINES.map((line) => ({ line, ...coverZoneRect(box, line, side) }));
  return { box, label: PREVIEW_LABEL[box], slot, width, height, crop, side, zones };
}

const BREAKPOINT_OF_BOX: Partial<Record<CoverBoxName, CoverBreakpointName>> = {
  desktop: "desktop",
  wide: "wide",
};

export type ToneReading =
  | { kind: "plate" }
  | { kind: "below" }
  | { kind: "unmeasured"; reason: MeasureState["kind"] }
  | {
      kind: "measured";
      tone: CoverTextTone;
      automatic: boolean;
      scrim: CoverScrimSetting;
      lowest: { line: CoverTextLine; ratio: number };
    };

/** The tone and lowest contrast measured for one preview, with the staff override applied. */
export function readTone(
  box: CoverBoxName,
  measure: MeasureState,
  toneOverride: CoverTextTone | undefined,
): ToneReading {
  if (box === "phone") return { kind: "below" };
  if (measure.kind !== "ready") return { kind: "unmeasured", reason: measure.kind };
  const breakpoint = BREAKPOINT_OF_BOX[box];
  const analysis = breakpoint ? measure.analysis.breakpoints[breakpoint] : undefined;
  const scrim = scrimSettingFor(analysis, toneOverride);
  if (!analysis || !scrim) return { kind: "plate" };
  const contrast = analysis[scrim.tone]?.contrast;
  if (!contrast) return { kind: "plate" };
  const lowest = COVER_TEXT_LINES.map((line) => ({ line, ratio: contrast[line] })).reduce((a, b) =>
    b.ratio < a.ratio ? b : a,
  );
  return {
    kind: "measured",
    tone: scrim.tone,
    automatic: toneOverride === undefined,
    scrim,
    lowest,
  };
}

/** "AA · 4.66:1 lowest" for a measured preview, else what to expect instead. */
export function toneBadge(reading: ToneReading): string {
  switch (reading.kind) {
    case "below":
      return "Type below the image";
    case "plate":
      return "Type on a plate";
    case "measured":
      return `AA · ${reading.lowest.ratio.toFixed(2)}:1 lowest`;
    case "unmeasured":
      if (reading.reason === "pending") return "Analysing…";
      if (reading.reason === "failed") return "Could not be measured";
      if (reading.reason === "unsaved") return "Measured after saving";
      return "Not measured";
  }
}

/** The tone the analysis recommends for the sizes a slot is measured at, or null when unknown. */
export function recommendedTone(analysis: CoverAnalysis): CoverTextTone | null {
  const desktop = analysis.breakpoints.desktop ?? analysis.breakpoints.wide;
  return desktop?.recommended ?? null;
}

/** The strength of the scrim at the text corner for the size the editor leads with. */
export function leadScrimStrength(
  analysis: CoverAnalysis,
  toneOverride: CoverTextTone | undefined,
): number | null {
  const lead = analysis.breakpoints.desktop ?? analysis.breakpoints.wide;
  return scrimSettingFor(lead, toneOverride)?.strength ?? null;
}
