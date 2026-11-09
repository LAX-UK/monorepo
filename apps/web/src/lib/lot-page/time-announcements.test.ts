import { describe, expect, it } from "vitest";
import {
  newTimeAnnouncementState,
  nextAnnouncementWake,
  nextTimeAnnouncements,
} from "./time-announcements";

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const END = 1_000_000_000;

const at = (remaining: number) => END - remaining;
const input = (
  remaining: number,
  over: Partial<Parameters<typeof nextTimeAnnouncements>[1]> = {},
) => ({
  nowMs: at(remaining),
  endMs: END,
  lifecycle: "live" as const,
  extensions: 0,
  visible: true,
  ...over,
});

function run(
  remainings: number[],
  over: Partial<Parameters<typeof nextTimeAnnouncements>[1]> = {},
) {
  const state = newTimeAnnouncementState();
  return remainings.flatMap((r) => nextTimeAnnouncements(state, input(r, over)));
}

describe("time marks", () => {
  it("says an hour, ten, five, two and one minute once each as the clock crosses them", () => {
    const readings = [
      2 * H,
      H + S,
      H - S,
      20 * M,
      10 * M + S,
      10 * M - S,
      5 * M - S,
      2 * M - S,
      M - S,
      30 * S,
      10 * S,
    ];
    expect(run(readings)).toEqual([
      "1 hour left",
      "10 minutes left",
      "5 minutes left",
      "2 minutes left",
      "1 minute left",
    ]);
  });

  it("says nothing for a mark already passed when the page opened", () => {
    expect(run([4 * M, 4 * M - S, 3 * M])).toEqual([]);
  });

  it("does not say a mark crossed while the tab was hidden", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(20 * M));
    // the tab was hidden through the 10 and 5 minute marks and comes back at 3 minutes
    expect(nextTimeAnnouncements(state, input(3 * M))).toEqual([]);
  });

  it("says only the tightest mark when several are crossed together", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(11 * M));
    expect(nextTimeAnnouncements(state, input(5 * M - S))).toEqual(["5 minutes left"]);
  });

  it("says nothing while the tab is hidden, and an extension that moves back over a mark does not repeat it", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(3 * M));
    expect(nextTimeAnnouncements(state, input(2 * M - S, { visible: false }))).toEqual([]);
    expect(nextTimeAnnouncements(state, input(2 * M + 29 * S))).toEqual([]);
    expect(nextTimeAnnouncements(state, input(2 * M - S))).toEqual([]);
  });
});

describe("extensions, the close and the result", () => {
  it("says each extension with the time left, at most once in fifteen seconds", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(90 * S));
    const extended = (remaining: number, count: number) =>
      nextTimeAnnouncements(state, input(remaining, { extensions: count, lifecycle: "extended" }));
    expect(extended(80 * S, 1)).toEqual(["Extended. 1 minute left."]);
    expect(extended(70 * S, 2)).toEqual([]);
    expect(extended(64 * S, 3)).toEqual(["Extended. 1 minute left."]);
  });

  it("says the close, then the result", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(10 * S));
    expect(nextTimeAnnouncements(state, input(0, { lifecycle: "closing" }))).toEqual([
      "Bidding has closed",
    ]);
    expect(nextTimeAnnouncements(state, input(-S, { lifecycle: "endedSold" }))).toEqual([
      "This lot sold.",
    ]);
  });

  it("a lot that ends with no close seen says both", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(10 * S));
    expect(nextTimeAnnouncements(state, input(0, { lifecycle: "endedNoSale" }))).toEqual([
      "Bidding has closed. This lot did not sell.",
    ]);
  });

  it("says nothing for a lot that was already ended when the page opened", () => {
    expect(run([0], { lifecycle: "endedSold" })).toEqual([]);
  });
});

describe("nextAnnouncementWake", () => {
  it("wakes at the next unsaid mark, and at the close", () => {
    const state = newTimeAnnouncementState();
    nextTimeAnnouncements(state, input(3 * H));
    expect(nextAnnouncementWake(state, input(3 * H))).toBe(2 * H);
    nextTimeAnnouncements(state, input(M + 30 * S));
    expect(nextAnnouncementWake(state, input(M + 30 * S))).toBe(30 * S);
    nextTimeAnnouncements(state, input(30 * S));
    expect(nextAnnouncementWake(state, input(30 * S))).toBe(30 * S + 1);
  });

  it("has no wake for a lot that is not counting", () => {
    expect(
      nextAnnouncementWake(newTimeAnnouncementState(), input(M, { lifecycle: "endedSold" })),
    ).toBeNull();
  });
});
