import { DEMO_JPEG_QUALITY, type DemoImageEntry } from "@auction/db";
import sharp from "sharp";
import type { UploadStorage } from "./upload-storage.js";

/** Resizes a museum original for how the demo uses it: a progressive JPEG with no metadata. */
export async function resizeDemoPicture(bytes: Buffer, longEdge: number): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
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
  resize?: (bytes: Buffer, longEdge: number) => Promise<Buffer>;
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
    const copy = await (deps.resize ?? resizeDemoPicture)(original, entry.longEdge);
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
