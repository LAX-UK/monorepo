import { statfs } from "node:fs/promises";

/** Headroom kept beyond the archive cap for the zip's own overhead and anything else on the disk. */
export const EXPORT_DISK_SAFETY_MARGIN_BYTES = 256 * 1024 * 1024;

/** First wait before a deferred copy is looked at again; it doubles each time up to the cap. */
export const EXPORT_DEFERRAL_BASE_DELAY_MS = 5 * 60_000;
export const EXPORT_DEFERRAL_MAX_DELAY_MS = 60 * 60_000;

/** How much free space the temp disk must show before a copy may start staging. */
export function requiredFreeBytes(
  archiveCapBytes: number,
  marginBytes = EXPORT_DISK_SAFETY_MARGIN_BYTES,
): number {
  return archiveCapBytes + marginBytes;
}

export type PreflightDecision =
  | { action: "proceed" }
  | { action: "defer"; freeBytes: number; requiredBytes: number };

/** Pure rule: start only when free space covers the archive cap plus the safety margin. */
export function decidePreflight(input: {
  freeBytes: number;
  archiveCapBytes: number;
  marginBytes?: number;
}): PreflightDecision {
  const requiredBytes = requiredFreeBytes(input.archiveCapBytes, input.marginBytes);
  return input.freeBytes >= requiredBytes
    ? { action: "proceed" }
    : { action: "defer", freeBytes: input.freeBytes, requiredBytes };
}

/** Wait before the nth look again (0 = first deferral): doubling, capped. */
export function deferralDelayMs(deferrals: number): number {
  const doubled = EXPORT_DEFERRAL_BASE_DELAY_MS * 2 ** Math.max(0, deferrals);
  return Math.min(doubled, EXPORT_DEFERRAL_MAX_DELAY_MS);
}

/** Reads how much room is left on the disk holding a directory. */
export interface IFreeSpaceProbe {
  freeBytes(directory: string): Promise<number>;
}

/** Bytes available to an unprivileged process (`bavail`), which is what a copy can really use. */
export class NodeFreeSpaceProbe implements IFreeSpaceProbe {
  async freeBytes(directory: string): Promise<number> {
    const stats = await statfs(directory);
    return Number(stats.bavail) * Number(stats.bsize);
  }
}

/** The copy was put off, not failed: the temp disk is too full right now. */
export class SubjectExportDeferredError extends Error {
  constructor(
    readonly freeBytes: number,
    readonly requiredBytes: number,
  ) {
    super("temp_disk_low");
    this.name = "SubjectExportDeferredError";
  }
}
