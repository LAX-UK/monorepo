import { describe, expect, it } from "vitest";
import { CONFIRMING_POLL, TRANSFER_POLL, nextPollDelay, pollPolicyFor } from "./pay-poll";

/** Plays the schedule out the way the page does, returning each wait. */
function schedule(policy: typeof CONFIRMING_POLL): number[] {
  const waits: number[] = [];
  let elapsed = 0;
  for (let attempt = 0; ; attempt += 1) {
    const wait = nextPollDelay(policy, attempt, elapsed);
    if (wait === null) return waits;
    waits.push(wait);
    elapsed += wait;
  }
}

describe("nextPollDelay", () => {
  it("backs off from 2 seconds and levels off at 8", () => {
    expect(schedule(CONFIRMING_POLL).slice(0, 6)).toEqual([2000, 4000, 8000, 8000, 8000, 8000]);
  });

  it("stops asking once three minutes have gone, never later", () => {
    const waits = schedule(CONFIRMING_POLL);
    const total = waits.reduce((sum, wait) => sum + wait, 0);
    expect(total).toBeLessThanOrEqual(180_000);
    expect(total + (waits.at(-1) ?? 0)).toBeGreaterThan(180_000);
    expect(nextPollDelay(CONFIRMING_POLL, 30, 180_000)).toBeNull();
  });

  it("asks a bank transfer slowly and stops after fifteen minutes", () => {
    const waits = schedule(TRANSFER_POLL);
    expect(waits.slice(0, 4)).toEqual([15_000, 30_000, 60_000, 60_000]);
    expect(waits.reduce((sum, wait) => sum + wait, 0)).toBeLessThanOrEqual(900_000);
  });

  it("gives a card payment the quick policy and a transfer the slow one", () => {
    expect(pollPolicyFor("confirming")).toBe(CONFIRMING_POLL);
    expect(pollPolicyFor("awaiting_transfer")).toBe(TRANSFER_POLL);
    expect(pollPolicyFor("part_received")).toBe(TRANSFER_POLL);
  });
});
