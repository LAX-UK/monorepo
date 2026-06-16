import type { OnsiteEventCheckInResult } from "@auction/types";

export const SCAN_COOLDOWN_MS = 2500;

export function checkInInputKey(input: { token?: string; rsvpId?: string }): string | null {
  if (input.rsvpId) return `rsvp:${input.rsvpId}`;
  if (input.token?.trim()) return `token:${input.token.trim()}`;
  return null;
}

/** Only debounce repeat scans after a successful admit (not for already-checked-in rescans). */
export function shouldDebounceSuccessfulScan(
  status: OnsiteEventCheckInResult["status"] | null,
): boolean {
  return status === "VALID" || status === "DRY_RUN_VALID";
}

/** Suppress rapid rescans of the same pass while staff holds the QR in frame. */
export function shouldSuppressRepeatScan(args: {
  inputKey: string | null;
  lastKey: string | null;
  lastAt: number;
  lastStatus: OnsiteEventCheckInResult["status"] | null;
  now?: number;
}): boolean {
  const now = args.now ?? Date.now();
  if (!args.inputKey || args.inputKey !== args.lastKey) return false;
  if (now - args.lastAt >= SCAN_COOLDOWN_MS) return false;
  if (shouldDebounceSuccessfulScan(args.lastStatus)) return true;
  if (args.lastStatus === "INVALID" || args.lastStatus === "WRONG_EVENT") return true;
  return false;
}
