import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EXPORT_DEFERRAL_BASE_DELAY_MS,
  EXPORT_DEFERRAL_MAX_DELAY_MS,
  EXPORT_DISK_SAFETY_MARGIN_BYTES,
  NodeFreeSpaceProbe,
  decidePreflight,
  deferralDelayMs,
} from "./export-disk-guard.js";
import { ZipFileWriter } from "./zip-file-writer.js";

describe("decidePreflight", () => {
  const cap = 1000;
  const margin = 100;
  it("proceeds at exactly the cap plus margin", () => {
    expect(decidePreflight({ freeBytes: 1100, archiveCapBytes: cap, marginBytes: margin })).toEqual(
      { action: "proceed" },
    );
  });
  it("defers just below it, saying what was needed", () => {
    expect(decidePreflight({ freeBytes: 1099, archiveCapBytes: cap, marginBytes: margin })).toEqual(
      { action: "defer", freeBytes: 1099, requiredBytes: 1100 },
    );
  });
  it("uses the default margin", () => {
    expect(decidePreflight({ freeBytes: cap, archiveCapBytes: cap })).toMatchObject({
      action: "defer",
      requiredBytes: cap + EXPORT_DISK_SAFETY_MARGIN_BYTES,
    });
  });
});

describe("deferralDelayMs", () => {
  it("doubles from the base and stops at the cap", () => {
    expect(deferralDelayMs(0)).toBe(EXPORT_DEFERRAL_BASE_DELAY_MS);
    expect(deferralDelayMs(1)).toBe(EXPORT_DEFERRAL_BASE_DELAY_MS * 2);
    expect(deferralDelayMs(50)).toBe(EXPORT_DEFERRAL_MAX_DELAY_MS);
  });
});

describe("NodeFreeSpaceProbe", () => {
  it("reports a positive size for a real directory", async () => {
    expect(await new NodeFreeSpaceProbe().freeBytes(tmpdir())).toBeGreaterThan(0);
  });
});

describe("peak temp disk use while zipping", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "zip-peak-test-"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function dirBytes(): Promise<number> {
    let total = 0;
    for (const name of await readdir(dir)) total += (await stat(join(dir, name))).size;
    return total;
  }

  it("stays near 1x the staged bytes when sources are consumed, against 2x when kept", async () => {
    const fileBytes = 400_000;
    const count = 5;
    const measure = async (consume: boolean) => {
      const sources: string[] = [];
      for (let i = 0; i < count; i += 1) {
        // Pseudo-random bytes do not compress, like the PDFs and JPEGs that make up the bulk.
        const body = Buffer.alloc(fileBytes);
        for (let j = 0; j < fileBytes; j += 1) body[j] = (j * 2654435761 + i * 40503) >>> 24;
        const path = join(dir, `part-${i}`);
        await writeFile(path, body);
        sources.push(path);
      }
      const zip = ZipFileWriter.open(join(dir, `archive-${consume}.zip`), "root", new Date());
      let peak = await dirBytes();
      for (const [i, path] of sources.entries()) {
        await zip.addFile(`f${i}`, path, false, { consume });
        peak = Math.max(peak, await dirBytes());
      }
      await zip.finish();
      peak = Math.max(peak, await dirBytes());
      return peak;
    };
    const staged = fileBytes * count;
    const consumed = await measure(true);
    expect(consumed).toBeLessThan(staged * 1.05);
    await rm(dir, { recursive: true, force: true });
    dir = await mkdtemp(join(tmpdir(), "zip-peak-test-"));
    const kept = await measure(false);
    expect(kept).toBeGreaterThan(staged * 1.9);
  });
});
