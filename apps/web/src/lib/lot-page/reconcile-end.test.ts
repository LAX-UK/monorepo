import { describe, expect, it } from "vitest";
import { heardIsNewer, readsAsExtended, reconcileEnd } from "./reconcile-end";

const END = 1_000_000_000;

describe("reconcileEnd", () => {
  it("a later close on a live lot is an extension, capped at the standing 30 seconds", () => {
    expect(reconcileEnd(END, END + 20_000, "active")).toEqual({
      endMs: END + 20_000,
      extension: { addedMs: 20_000 },
    });
    expect(reconcileEnd(END, END + 5 * 60_000, "active").extension?.addedMs).toBe(30_000);
  });

  it("an older close never moves a live lot back, so a snapshot in flight cannot block bidding", () => {
    expect(reconcileEnd(END + 30_000, END, "active")).toEqual({
      endMs: END + 30_000,
      extension: null,
    });
  });

  it("the same close again, the second name of one event, is nothing", () => {
    expect(reconcileEnd(END, END, "active")).toEqual({ endMs: END, extension: null });
  });

  it("a lot that is not live follows what it is told, either way", () => {
    expect(reconcileEnd(END, END - 60_000, "scheduled")).toEqual({
      endMs: END - 60_000,
      extension: null,
    });
    expect(reconcileEnd(END, END + 60_000, "ended")).toEqual({
      endMs: END + 60_000,
      extension: null,
    });
  });

  it("ignores a close that is not a time", () => {
    expect(reconcileEnd(END, Number.NaN, "active")).toEqual({ endMs: END, extension: null });
  });
});

describe("reconcileEnd from a close known to be newer or older", () => {
  it("a newer earlier close is the staff shortening the close, and the page follows it", () => {
    expect(reconcileEnd(END + 30_000, END, "active", true)).toEqual({
      endMs: END,
      extension: null,
    });
  });

  it("a newer later one is still an extension, and the same one is nothing", () => {
    expect(reconcileEnd(END, END + 20_000, "active", true).extension?.addedMs).toBe(20_000);
    expect(reconcileEnd(END, END, "active", true)).toEqual({ endMs: END, extension: null });
  });

  it("an older close changes nothing either way: a read from before staff shortened it is stale", () => {
    expect(reconcileEnd(END, END + 10 * 60_000, "active", false)).toEqual({
      endMs: END,
      extension: null,
    });
    expect(reconcileEnd(END + 30_000, END, "active", false)).toEqual({
      endMs: END + 30_000,
      extension: null,
    });
  });
});

describe("heardIsNewer", () => {
  it("compares the server's stamps when both have one, strictly", () => {
    expect(heardIsNewer(100, 101, "snapshot")).toBe(true);
    expect(heardIsNewer(100, 100, "snapshot")).toBe(false);
    expect(heardIsNewer(100, 99, "event")).toBe(false);
  });

  it("without both stamps, an event is newer and a read is of unknown age", () => {
    expect(heardIsNewer(null, 100, "event")).toBe(true);
    expect(heardIsNewer(100, null, "event")).toBe(true);
    expect(heardIsNewer(null, 100, "snapshot")).toBeNull();
    expect(heardIsNewer(100, null, "snapshot")).toBeNull();
  });
});

describe("readsAsExtended", () => {
  const EXT = new Date(END).toISOString();

  it("a live lot whose close is the extended one reads as extended on first sight", () => {
    expect(readsAsExtended(END, EXT, "active")).toBe(true);
  });

  it("not when there was no extension, when staff moved the close since, or when it is not live", () => {
    expect(readsAsExtended(END, null, "active")).toBe(false);
    expect(readsAsExtended(END - 60_000, EXT, "active")).toBe(false);
    expect(readsAsExtended(END, EXT, "ended")).toBe(false);
    expect(readsAsExtended(END, "not a date", "active")).toBe(false);
  });
});
