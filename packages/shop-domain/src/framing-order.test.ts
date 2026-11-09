import { describe, expect, it } from "vitest";
import { computeOrderTotal } from "./basket-totals.js";
import {
  FRAMING_TASK_STATUSES,
  type FramingTaskStatus,
  addWorkingDaysUtc,
  canMoveFramingTask,
  framingDueAt,
  framingLineVat,
  framingRefundBlock,
  framingStageStamp,
  framingTaskFinished,
  framingTaskNextSteps,
  framingTaskStarted,
  parseFramingOrderSnapshot,
} from "./framing-order.js";
import { pence } from "./money.js";

describe("a framing line's VAT", () => {
  it("is the standard rate, taken out of the price", () => {
    expect(framingLineVat({ standardRateBp: 2000 }, 21000)).toEqual({
      ok: true,
      vatTreatment: "standard",
      vatRateBp: 2000,
      vatPence: 3500,
    });
  });

  it("is not recorded without a VAT policy", () => {
    expect(framingLineVat(null, 21000)).toEqual({ ok: false, reason: "policy_not_configured" });
  });
});

describe("the framing task's steps", () => {
  it("runs queued, framing, framed, completed", () => {
    expect(canMoveFramingTask("queued", "framing")).toBe(true);
    expect(canMoveFramingTask("framing", "framed")).toBe(true);
    expect(canMoveFramingTask("framed", "completed")).toBe(true);
  });

  it("does not skip a step or go back", () => {
    expect(canMoveFramingTask("queued", "framed")).toBe(false);
    expect(canMoveFramingTask("framed", "framing")).toBe(false);
    expect(canMoveFramingTask("completed", "framing")).toBe(false);
  });

  it("can be cancelled until it is complete, and then has no next step", () => {
    for (const status of ["queued", "framing", "framed"] as const) {
      expect(framingTaskNextSteps(status)).toContain("cancelled");
    }
    expect(framingTaskNextSteps("completed")).toEqual([]);
    expect(framingTaskNextSteps("cancelled")).toEqual([]);
  });

  it("knows when it is finished and when work has started", () => {
    const finished = FRAMING_TASK_STATUSES.filter((s: FramingTaskStatus) => framingTaskFinished(s));
    expect(finished).toEqual(["completed", "cancelled"]);
    const started = FRAMING_TASK_STATUSES.filter((s: FramingTaskStatus) => framingTaskStarted(s));
    expect(started).toEqual(["framing", "framed", "completed"]);
  });
});

describe("refunding a framing line on its own", () => {
  it("is allowed before the frame is started, or with no task", () => {
    expect(framingRefundBlock("queued")).toBeNull();
    expect(framingRefundBlock("cancelled")).toBeNull();
    expect(framingRefundBlock(null)).toBeNull();
  });

  it("is blocked once the frame is being made or made", () => {
    for (const status of ["framing", "framed", "completed"] as const) {
      expect(framingRefundBlock(status)).toBe("production_started");
    }
  });
});

describe("when the frame is due", () => {
  it("counts the longest lead time in working days from payment", () => {
    // Monday 2 November 2026, plus 15 working days, is Monday 23 November.
    const due = framingDueAt(new Date("2026-11-02T10:00:00.000Z"), { leadTimeMaxDays: 15 });
    expect(due.toISOString()).toBe("2026-11-23T10:00:00.000Z");
  });

  it("skips weekends", () => {
    expect(addWorkingDaysUtc(new Date("2026-11-06T10:00:00.000Z"), 1).toISOString()).toBe(
      "2026-11-09T10:00:00.000Z",
    );
    expect(addWorkingDaysUtc(new Date("2026-11-06T10:00:00.000Z"), 0).toISOString()).toBe(
      "2026-11-06T10:00:00.000Z",
    );
  });
});

describe("an order total with framing", () => {
  it("adds the framing subtotal, which is kept apart from the goods", () => {
    expect(
      computeOrderTotal({
        merchandiseSubtotalPence: pence(18000),
        framingSubtotalPence: pence(21000),
        fulfilment: "uk_insured_delivery",
      }),
    ).toBe(40500);
  });

  it("is unchanged without framing", () => {
    expect(
      computeOrderTotal({
        merchandiseSubtotalPence: pence(18000),
        fulfilment: "uk_insured_delivery",
      }),
    ).toBe(19500);
  });
});

describe("parseFramingOrderSnapshot", () => {
  const whole = {
    optionId: "opt-1",
    name: "Natural oak frame",
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    pricePence: 21_000,
  };

  it("reads a whole snapshot", () => {
    expect(parseFramingOrderSnapshot(whole)).toEqual(whole);
  });

  it("fails loudly on a missing lead time rather than defaulting it", () => {
    const { leadTimeMaxDays: _gone, ...partial } = whole;
    expect(() => parseFramingOrderSnapshot(partial)).toThrowError("missing leadTimeMaxDays");
    expect(() => parseFramingOrderSnapshot(null)).toThrowError("no snapshot");
    expect(() => parseFramingOrderSnapshot({ ...whole, name: "" })).toThrowError("missing name");
    expect(() => parseFramingOrderSnapshot({ ...whole, pricePence: 1.5 })).toThrowError(
      "missing pricePence",
    );
  });
});

describe("framingStageStamp", () => {
  const now = new Date("2026-11-10T09:00:00.000Z");

  it("records when each step began", () => {
    expect(framingStageStamp("framing", now)).toEqual({ framingStartedAt: now });
    expect(framingStageStamp("framed", now)).toEqual({ framedAt: now });
    expect(framingStageStamp("completed", now)).toEqual({ completedAt: now });
  });

  it("stamps nothing for queued or cancelled", () => {
    expect(framingStageStamp("queued", now)).toEqual({});
    expect(framingStageStamp("cancelled", now)).toEqual({});
  });
});
