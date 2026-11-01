import {
  COVER_BOXES,
  type CoverImageMeasurements,
  coverCrop,
  coverZoneRect,
} from "@auction/domain";
import { COVER_TEXT_LINES, type CoverBreakpointName, type CoverZoneSample } from "@auction/types";
import type { CoverTextLine, UnitRect } from "@auction/types";
import sharp from "sharp";
import type { CoverImageAnalyser, CoverMeasureRequest } from "./cover-image-analyser.js";
import { extractPalette, sampleZone } from "./cover-pixels.js";

/** The largest side worked on: a cover is never shown wider than this, so more detail is wasted. */
const WORKING_WIDTH = 2880;
const PALETTE_SIZE = 64;
const PREVIEW_WIDTH = 24;
const PREVIEW_QUALITY = 45;
/** Zones are measured at half the CSS size, which is plenty for a percentile. */
const MEASURE_SCALE = 0.5;

type Raw = { data: Buffer; width: number; height: number };

async function toRaw(pipeline: sharp.Sharp): Promise<Raw> {
  const { data, info } = await pipeline
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function rawInput(raw: Raw) {
  return sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: 3 } });
}

function pixelRect(rect: UnitRect, width: number, height: number) {
  const left = Math.min(width - 1, Math.max(0, Math.round(rect.x * width)));
  const top = Math.min(height - 1, Math.max(0, Math.round(rect.y * height)));
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round(rect.width * width))),
    height: Math.max(1, Math.min(height - top, Math.round(rect.height * height))),
  };
}

/** Reads a cover picture with sharp: its colours, a small preview and the light behind each line of text. */
export class SharpCoverImageAnalyser implements CoverImageAnalyser {
  async measure(request: CoverMeasureRequest): Promise<CoverImageMeasurements> {
    let working = await toRaw(
      sharp(request.bytes).rotate().resize({ width: WORKING_WIDTH, withoutEnlargement: true }),
    );
    if (request.preCrop) {
      const area = pixelRect(request.preCrop, working.width, working.height);
      working = await toRaw(rawInput(working).extract(area));
    }

    const palette = extractPalette(await this.palette(working));
    const blurDataURL = await this.preview(working);

    const zones: CoverImageMeasurements["zones"] = {};
    for (const breakpoint of request.breakpoints) {
      zones[breakpoint] = await this.measureZones(working, breakpoint, request);
    }
    return { dominant: palette.dominant, deepest: palette.deepest, blurDataURL, zones };
  }

  private async palette(working: Raw) {
    const small = await toRaw(
      rawInput(working).resize(PALETTE_SIZE, PALETTE_SIZE, { fit: "inside" }),
    );
    return { data: small.data, width: small.width, height: small.height };
  }

  private async preview(working: Raw): Promise<string> {
    const jpeg = await rawInput(working)
      .resize(PREVIEW_WIDTH, undefined, { withoutEnlargement: true })
      .jpeg({ quality: PREVIEW_QUALITY })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  }

  private async measureZones(
    working: Raw,
    breakpoint: CoverBreakpointName,
    request: CoverMeasureRequest,
  ): Promise<Record<CoverTextLine, CoverZoneSample>> {
    const box = COVER_BOXES[breakpoint];
    const crop = coverCrop({
      image: working,
      box,
      focal: request.focal,
      zoom: request.zoom,
      textSide: request.textSide,
    });
    const shown = await toRaw(
      rawInput(working)
        .extract(pixelRect(crop, working.width, working.height))
        .resize(Math.round(box.width * MEASURE_SCALE), Math.round(box.height * MEASURE_SCALE), {
          fit: "fill",
        }),
    );
    const zones = {} as Record<CoverTextLine, CoverZoneSample>;
    for (const line of COVER_TEXT_LINES) {
      const rect = coverZoneRect(breakpoint, line, request.textSide);
      zones[line] = sampleZone(
        { data: shown.data, width: shown.width, height: shown.height },
        {
          x: rect.x * MEASURE_SCALE,
          y: rect.y * MEASURE_SCALE,
          width: rect.width * MEASURE_SCALE,
          height: rect.height * MEASURE_SCALE,
        },
      );
    }
    return zones;
  }
}
