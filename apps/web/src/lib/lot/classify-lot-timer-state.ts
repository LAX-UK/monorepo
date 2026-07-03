import type { LotStatus } from "@auction/types";

export type LotTimerState =
  | { kind: "live"; msLeft: number }
  | { kind: "opensSoon"; msLeft: number }
  | { kind: "closed" }
  | { kind: "cancelled" }
  | { kind: "unknown" };

export type LotTimerInputs = {
  status: LotStatus;
  startTime: string | null;
  endTime: string | null;
};

function parseMs(s: string | null): number | null {
  if (s == null || s === "") return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/** Pure classifier: maps lot timing inputs + wall clock to a display state.
 * When `now` is null (SSR / first paint), only status-derived states are returned — no `msLeft`.
 */
export function classifyLotTimerState(i: LotTimerInputs, now: number | null): LotTimerState {
  if (i.status === "cancelled" || i.status === "voided") return { kind: "cancelled" };

  if (now == null) {
    if (i.status === "ended") return { kind: "closed" };
    return { kind: "unknown" };
  }

  const endMs = parseMs(i.endTime);
  const startMs = parseMs(i.startTime);

  if (i.status === "ended" || (endMs != null && endMs <= now)) {
    return { kind: "closed" };
  }

  if (startMs != null && startMs > now) {
    return { kind: "opensSoon", msLeft: startMs - now };
  }

  if (
    i.status === "active" &&
    endMs != null &&
    endMs > now &&
    (startMs == null || startMs <= now)
  ) {
    return { kind: "live", msLeft: endMs - now };
  }

  return { kind: "unknown" };
}
