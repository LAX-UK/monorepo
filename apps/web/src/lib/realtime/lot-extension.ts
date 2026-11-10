import { DEFAULT_ANTI_SNIPING_EXTENSION_MS } from "@auction/validators";

/** A late bid moved the close. */
export type LotExtension = {
  /** The new end time, in epoch milliseconds. */
  endTimeMs: number;
  /** The server's clock when it made the event, when it said. */
  serverNowMs: number | null;
};

function msOf(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Reads a lot-extended event from either of its two shapes: the page-level `lot.extended`
 * (`extendedUntil`, `serverNow`) and the older `lotExtended` (`newEndTime`).
 */
export function parseLotExtension(payload: unknown): LotExtension | null {
  if (typeof payload !== "object" || payload === null) return null;
  const o = payload as Record<string, unknown>;
  const endTimeMs = msOf(o.extendedUntil) ?? msOf(o.newEndTime);
  if (endTimeMs === null) return null;
  return { endTimeMs, serverNowMs: msOf(o.serverNow) };
}

/**
 * How much a late bid added: the move in the close, never more than the standing extension, so a
 * page that was waiting at "Closing…" says "30 seconds", not the time since the old close.
 */
export function extensionAddedMs(previousEndMs: number, extension: LotExtension): number {
  const moved = extension.endTimeMs - previousEndMs;
  return Math.max(0, Math.min(moved, DEFAULT_ANTI_SNIPING_EXTENSION_MS));
}
