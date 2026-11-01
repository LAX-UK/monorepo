import type {
  CoverAnalysis,
  CoverBreakpointName,
  CoverTextLine,
  CoverTextSide,
  CoverZoneSample,
} from "@auction/types";
import { type Rgb, plateFieldColour, toHex } from "./cover-colour.js";
import { solveCoverScrim } from "./cover-scrim.js";
import { COVER_ANALYSIS_VERSION } from "./sale-cover.js";

/** What the image adapter measures from the pixels; the rest is decided here, without any I/O. */
export type CoverImageMeasurements = {
  dominant: Rgb;
  deepest: Rgb;
  blurDataURL: string;
  /** Per measured hero size: the lightest and darkest colour in each text zone. */
  zones: Partial<Record<CoverBreakpointName, Record<CoverTextLine, CoverZoneSample>>>;
};

export function assembleCoverAnalysis(
  measurements: CoverImageMeasurements,
  side: CoverTextSide,
): CoverAnalysis {
  const breakpoints: CoverAnalysis["breakpoints"] = {};
  for (const name of Object.keys(measurements.zones) as CoverBreakpointName[]) {
    const zones = measurements.zones[name];
    if (zones) breakpoints[name] = solveCoverScrim(name, side, zones);
  }
  return {
    version: COVER_ANALYSIS_VERSION,
    dominant: toHex(measurements.dominant),
    deepest: toHex(measurements.deepest),
    field: toHex(plateFieldColour(measurements.deepest)),
    blurDataURL: measurements.blurDataURL,
    breakpoints,
  };
}
