import type {
  CoverAnalysis,
  CoverBreakpointName,
  CoverScrimSetting,
  CoverTextSide,
  SaleCoverSlot,
  SaleCoverSlotName,
  SaleCoverSlots,
} from "@auction/types";
import {
  COVER_BOXES,
  type CoverBoxName,
  boxesServedBySlot,
  breakpointsMeasuredForSlot,
  coverCrop,
  cropKeepsArea,
  suggestCoverSide,
} from "./cover-crop.js";
import { scrimSettingFor } from "./cover-scrim.js";

/** Bump when the measuring changes, so every stored analysis is measured again. */
export const COVER_ANALYSIS_VERSION = 1;

export const COVER_ZOOM_MIN = 1;
export const COVER_ZOOM_MAX = 2.5;

/**
 * The smallest picture each slot accepts, at twice the CSS size so it stays sharp on a retina
 * screen. Anything smaller is never stretched: the next source in the order is used.
 */
export const COVER_SLOT_FLOORS: Record<SaleCoverSlotName, { minWidth: number; minHeight: number }> =
  {
    default: { minWidth: 2400, minHeight: 0 },
    wide: { minWidth: 2880, minHeight: 1080 },
    phone: { minWidth: 1200, minHeight: 1200 },
  };

/** The old array held the slots by position: the desktop master, then the phone, then the wide crop. */
const LEGACY_POSITION: Record<SaleCoverSlotName, number> = { default: 0, phone: 1, wide: 2 };

export type CoverSlotSource =
  | { kind: "slot"; slot: SaleCoverSlot }
  | { kind: "legacy"; key: string };

/**
 * Each named slot with its source: the stored slot when there is one, otherwise the picture the
 * old positional array holds for that slot. Reads stay correct before and after staff move to
 * named slots, and a stored slot always wins.
 */
export function resolveCoverSlotSources(
  stored: SaleCoverSlots | undefined,
  legacyCoverImages: readonly string[],
): Partial<Record<SaleCoverSlotName, CoverSlotSource>> {
  const out: Partial<Record<SaleCoverSlotName, CoverSlotSource>> = {};
  for (const name of Object.keys(LEGACY_POSITION) as SaleCoverSlotName[]) {
    const slot = stored?.[name];
    if (slot) {
      out[name] = { kind: "slot", slot };
      continue;
    }
    const key = legacyCoverImages[LEGACY_POSITION[name]]?.trim();
    if (key) out[name] = { kind: "legacy", key };
  }
  return out;
}

/** The side the text sits on: staff's choice, otherwise away from the subject. */
export function effectiveCoverSide(
  slot: Pick<SaleCoverSlot, "focal" | "sideOverride">,
): CoverTextSide {
  return slot.sideOverride ?? suggestCoverSide(slot.focal);
}

/** The picture's pixel size once the zoom has chosen the detail: what the screen really shows. */
export function effectiveCoverSize(slot: Pick<SaleCoverSlot, "width" | "height" | "zoom">): {
  width: number;
  height: number;
} {
  return { width: Math.floor(slot.width / slot.zoom), height: Math.floor(slot.height / slot.zoom) };
}

export type CoverSlotIssue =
  | {
      code: "below_floor";
      need: { width: number; height: number };
      have: { width: number; height: number };
    }
  | { code: "keep_area_cut"; box: CoverBoxName };

/** What is wrong with a slot, if anything. Staff are told before publishing; reads fall back. */
export function validateCoverSlot(
  name: SaleCoverSlotName,
  slot: SaleCoverSlot,
  context: { phoneSlotPresent: boolean },
): CoverSlotIssue[] {
  const issues: CoverSlotIssue[] = [];

  const floor = COVER_SLOT_FLOORS[name];
  const have = effectiveCoverSize(slot);
  if (have.width < floor.minWidth || have.height < floor.minHeight) {
    issues.push({
      code: "below_floor",
      need: { width: floor.minWidth, height: floor.minHeight },
      have,
    });
  }

  if (slot.keep) {
    const side = effectiveCoverSide(slot);
    for (const box of boxesServedBySlot(name, context.phoneSlotPresent)) {
      const crop = coverCrop({
        image: slot,
        box: COVER_BOXES[box],
        focal: slot.focal,
        zoom: slot.zoom,
        textSide: box === "phone" ? null : side,
      });
      if (!cropKeepsArea(crop, slot.keep)) issues.push({ code: "keep_area_cut", box });
    }
  }

  return issues;
}

// ─── What the measuring depends on ────────────────────────────────────────────

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;

function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * FNV_PRIME) & FNV_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/**
 * A fingerprint of everything the measuring depends on: the picture, the crop and the side the
 * text sits on. Slots with the same fingerprint share one analysis, and changing the focal
 * point, zoom, crop or side makes a new one. Tone overrides are not part of it, because both
 * tones are always solved.
 */
export function coverAnalysisHash(
  name: SaleCoverSlotName,
  slot: Omit<SaleCoverSlot, "analysisHash">,
): string {
  const source = slot.fromLot
    ? [
        "lot",
        slot.fromLot.imageKey,
        slot.fromLot.crop
          ? [
              slot.fromLot.crop.x,
              slot.fromLot.crop.y,
              slot.fromLot.crop.width,
              slot.fromLot.crop.height,
            ].map(round4)
          : null,
      ]
    : ["upload", slot.key ?? ""];
  const canonical = JSON.stringify([
    COVER_ANALYSIS_VERSION,
    name,
    source,
    round4(slot.focal.x),
    round4(slot.focal.y),
    round4(slot.zoom),
    effectiveCoverSide(slot),
  ]);
  return fnv1a64(canonical);
}

/** The text-bearing hero sizes a slot's analysis covers. */
export function measuredBreakpoints(name: SaleCoverSlotName): readonly CoverBreakpointName[] {
  return breakpointsMeasuredForSlot(name);
}

/** The scrim to paint at each measured size for a slot with a ready analysis. */
export function slotScrimSettings(
  name: SaleCoverSlotName,
  slot: Pick<SaleCoverSlot, "toneOverride">,
  analysis: CoverAnalysis,
): Partial<Record<CoverBreakpointName, CoverScrimSetting | null>> {
  const out: Partial<Record<CoverBreakpointName, CoverScrimSetting | null>> = {};
  for (const breakpoint of measuredBreakpoints(name)) {
    out[breakpoint] = scrimSettingFor(analysis.breakpoints[breakpoint], slot.toneOverride);
  }
  return out;
}
