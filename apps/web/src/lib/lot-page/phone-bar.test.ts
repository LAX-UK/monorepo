import type { LotLifecycleKind } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { type LotPageViewInput, buildLotPageView } from "./build-lot-page-view";
import { NO_LOT_VIEWER } from "./lot-viewer";
import { buildPhoneBarSummary, lotShowsPhoneBar } from "./phone-bar";

const NOW = new Date("2026-11-01T12:00:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function view(over: Partial<LotPageViewInput> = {}) {
  return buildLotPageView({
    lifecycle: "live",
    now: NOW,
    msLeft: 2 * DAY + 14 * HOUR,
    startsAt: "2026-10-30T18:00:00Z",
    endsAt: "2026-11-04T02:00:00Z",
    amounts: { starting: "4200.00", current: "7000.00", hammer: null, soldForWithPremium: null },
    estimate: { low: "6000", high: "9000" },
    bidCount: 6,
    reserve: "met",
    nextBid: "7250.00",
    extendedByMs: null,
    saleroom: null,
    signedIn: true,
    viewer: { ...NO_LOT_VIEWER, registration: "approved" },
    ...over,
  });
}

const summary = (over: Partial<LotPageViewInput> = {}) =>
  buildPhoneBarSummary(view(over), NOW.getTime());

describe("phone bar summary", () => {
  it("live: the current bid and the time left in words and as a short form", () => {
    expect(summary()).toMatchObject({
      label: "Current bid",
      labelTone: "neutral",
      amount: "£7,000",
      line: { words: "2d 14h 00m 00s left", compact: "2d 14h 00m 00s", tone: "calm", clock: true },
    });
  });

  it("the final hour reads as a clock with seconds, in the soon tone", () => {
    const line = summary({ msLeft: 42 * MINUTE + 9_000 })?.line;
    expect(line).toMatchObject({
      words: "42m 09s left",
      compact: "42m 09s",
      tone: "soon",
      clock: true,
    });
  });

  it("the final two minutes and an extension read as final", () => {
    expect(summary({ msLeft: 90_000 })?.line?.tone).toBe("final");
    expect(summary({ lifecycle: "extended", msLeft: 30 * MINUTE })?.line?.tone).toBe("final");
  });

  it("beyond a week it tells a date, the same in both widths", () => {
    const line = summary({ msLeft: 9 * DAY })?.line;
    expect(line?.words).toBe(line?.compact);
    expect(line?.words).toMatch(/^Closes \w{3} \d{1,2} \w{3}$/);
  });

  it("says where the viewer stands in place of the price label", () => {
    const at = (position: "leading" | "outbid" | "maximum_set") =>
      buildPhoneBarSummary(view(), NOW.getTime(), position);
    expect(at("outbid")).toMatchObject({ label: "Outbid", labelTone: "warning", amount: "£7,000" });
    expect(at("leading")).toMatchObject({ label: "You're leading", labelTone: "success" });
    expect(at("maximum_set")?.label).toBe("Maximum set");
  });

  it("a lot with no bids yet shows the starting bid", () => {
    const result = summary({
      amounts: { starting: "4200.00", current: "4200.00", hammer: null, soldForWithPremium: null },
      bidCount: 0,
    });
    expect(result?.label).toBe("Starting bid");
    expect(result?.amount).toBe("£4,200");
  });

  it("upcoming: starting bid and when it opens", () => {
    const result = summary({ lifecycle: "scheduled", msLeft: 9 * HOUR });
    expect(result).toMatchObject({
      label: "Starting bid",
      line: { words: "Opens in 9h 00m 00s", compact: "9h 00m 00s", clock: true },
    });
    expect(summary({ lifecycle: "scheduled", msLeft: 9 * DAY })?.line?.words).toMatch(/^Opens /);
  });

  it("in the room there is no clock", () => {
    expect(summary({ lifecycle: "liveSaleroom", msLeft: null })?.line).toEqual({
      words: "In the room",
      compact: "In the room",
      tone: "calm",
      clock: false,
    });
  });

  it("won and unpaid: the way to pay, with when", () => {
    const won = view({
      lifecycle: "endedSold",
      msLeft: null,
      amounts: {
        starting: "4200.00",
        current: "8000.00",
        hammer: "8000.00",
        soldForWithPremium: "10000.00",
      },
      viewer: {
        ...NO_LOT_VIEWER,
        registration: "approved",
        position: "won",
        purchase: { id: "p1", status: "due", dueAt: "2026-11-10T12:00:00Z" },
      },
    });
    expect(lotShowsPhoneBar(won)).toBe(true);
    const result = buildPhoneBarSummary(won, NOW.getTime());
    expect(result).toMatchObject({ label: "You won", amount: "£10,000" });
    expect(result?.line?.words).toMatch(/^Pay by /);
  });

  const HIDDEN: LotLifecycleKind[] = [
    "preLaunch",
    "endedSold",
    "endedNoSale",
    "cancelled",
    "withdrawn",
  ];
  it.each(HIDDEN)("%s has no bar", (lifecycle) => {
    expect(summary({ lifecycle, msLeft: null })).toBeNull();
  });
});
