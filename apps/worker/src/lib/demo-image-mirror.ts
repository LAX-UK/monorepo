import { DEMO_JPEG_QUALITY, type DemoImageEntry } from "@auction/db";
import sharp from "sharp";
import type { UploadStorage } from "./upload-storage.js";

/** Cuts `share` of the picture's width and height from each side; 0 returns it unchanged. */
async function trimSides(bytes: Buffer, share: number): Promise<Buffer> {
  const upright = await sharp(bytes).rotate().toBuffer();
  if (share <= 0) return upright;
  const { width = 0, height = 0 } = await sharp(upright).metadata();
  const dx = Math.round(width * share);
  const dy = Math.round(height * share);
  return sharp(upright)
    .extract({ left: dx, top: dy, width: width - 2 * dx, height: height - 2 * dy })
    .toBuffer();
}

/**
 * Resizes a museum original for how the demo uses it: a progressive JPEG with no metadata, after
 * trimming a scan's frame when the catalogue asks for it.
 */
export async function resizeDemoPicture(
  bytes: Buffer,
  longEdge: number,
  trim = 0,
): Promise<Buffer> {
  return sharp(await trimSides(bytes, trim))
    .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: DEMO_JPEG_QUALITY, progressive: true, mozjpeg: true })
    .toBuffer();
}

export type MirrorOutcome =
  | { key: string; status: "uploaded" | "unchanged"; bytes: number }
  | { key: string; status: "failed"; reason: string };

export type DemoMirrorDeps = {
  storage: Pick<UploadStorage, "putObject" | "headObject">;
  fetchPicture: (url: string) => Promise<Buffer>;
  resize?: (bytes: Buffer, longEdge: number, trim: number) => Promise<Buffer>;
};

/**
 * Mirrors one picture. The copy is built every time and uploaded only when the stored object is
 * missing or a different size, so a second run changes nothing.
 */
export async function mirrorDemoPicture(
  entry: DemoImageEntry,
  deps: DemoMirrorDeps,
): Promise<MirrorOutcome> {
  try {
    const original = await deps.fetchPicture(entry.source);
    const copy = await (deps.resize ?? resizeDemoPicture)(original, entry.longEdge, entry.trim);
    const stored = await deps.storage.headObject(entry.key);
    if (stored && stored.byteSize === copy.byteLength) {
      return { key: entry.key, status: "unchanged", bytes: copy.byteLength };
    }
    await deps.storage.putObject(entry.key, copy, "image/jpeg");
    return { key: entry.key, status: "uploaded", bytes: copy.byteLength };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { key: entry.key, status: "failed", reason };
  }
}

export async function mirrorDemoPictures(
  entries: readonly DemoImageEntry[],
  deps: DemoMirrorDeps,
): Promise<MirrorOutcome[]> {
  const outcomes: MirrorOutcome[] = [];
  for (const entry of entries) outcomes.push(await mirrorDemoPicture(entry, deps));
  return outcomes;
}
