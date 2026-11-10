import { describe, expect, it } from "vitest";
import { reconcileEnd } from "./reconcile-end";

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
