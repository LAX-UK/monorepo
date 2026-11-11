import { describe, expect, it } from "vitest";
import { invoiceDueAt } from "./purchase-invoice-state.js";
import {
  invoiceDueAfterAcceptance,
  isValidOfferDays,
  offerEndsAt,
  sellerConsentWindow,
} from "./reoffer-windows.js";

const iso = (date: Date) => date.toISOString();
const window = (askedAt: string) => {
  const result = sellerConsentWindow(new Date(askedAt));
  return { reminderAt: iso(result.reminderAt), dueAt: iso(result.dueAt) };
};

describe("sellerConsentWindow", () => {
  it("ends at 17:00 on the 3rd working day, with the reminder at 17:00 on the 2nd", () => {
    expect(window("2026-11-11T10:00:00Z")).toEqual({
      reminderAt: "2026-11-13T17:00:00.000Z",
      dueAt: "2026-11-16T17:00:00.000Z",
    });
  });

  it("skips the weekend for a Friday request", () => {
    expect(window("2026-11-13T15:00:00Z")).toEqual({
      reminderAt: "2026-11-17T17:00:00.000Z",
      dueAt: "2026-11-18T17:00:00.000Z",
    });
  });

  it("starts counting on Monday for a request made on a Saturday or Sunday", () => {
    const expected = {
      reminderAt: "2026-11-17T17:00:00.000Z",
      dueAt: "2026-11-18T17:00:00.000Z",
    };
    expect(window("2026-11-14T10:00:00Z")).toEqual(expected);
    expect(window("2026-11-15T10:00:00Z")).toEqual(expected);
  });

  it("does not count bank holidays (Christmas and the substitute Boxing Day)", () => {
    expect(window("2026-12-23T10:00:00Z")).toEqual({
      reminderAt: "2026-12-29T17:00:00.000Z",
      dueAt: "2026-12-30T17:00:00.000Z",
    });
  });

  it("is 17:00 BST after clocks go forward (late March)", () => {
    expect(window("2026-03-27T12:00:00Z")).toEqual({
      reminderAt: "2026-03-31T16:00:00.000Z",
      dueAt: "2026-04-01T16:00:00.000Z",
    });
  });

  it("is 17:00 GMT after clocks go back (late October)", () => {
    expect(window("2026-10-23T11:00:00Z")).toEqual({
      reminderAt: "2026-10-27T17:00:00.000Z",
      dueAt: "2026-10-28T17:00:00.000Z",
    });
  });

  it("does not depend on the time of day of the request", () => {
    expect(window("2026-11-11T00:05:00Z")).toEqual(window("2026-11-11T23:50:00Z"));
  });

  it("reminds before it is due", () => {
    const { reminderAt, dueAt } = sellerConsentWindow(new Date("2026-06-01T09:30:00Z"));
    expect(reminderAt.getTime()).toBeLessThan(dueAt.getTime());
  });
});

describe("offerEndsAt", () => {
  it("ends at 17:00 London three days later by default", () => {
    expect(iso(offerEndsAt(new Date("2026-11-10T14:00:00Z")))).toBe("2026-11-13T17:00:00.000Z");
  });

  it("ends at 17:00 BST in summer", () => {
    expect(iso(offerEndsAt(new Date("2026-07-01T09:00:00Z"), 2))).toBe("2026-07-03T16:00:00.000Z");
  });

  it("counts calendar days, so a Friday offer can end at the weekend", () => {
    expect(iso(offerEndsAt(new Date("2026-11-13T10:00:00Z"), 1))).toBe("2026-11-14T17:00:00.000Z");
  });

  it("is DST-correct when clocks go forward on the last day (late March)", () => {
    expect(iso(offerEndsAt(new Date("2026-03-26T10:00:00Z"), 3))).toBe("2026-03-29T16:00:00.000Z");
    expect(iso(offerEndsAt(new Date("2026-03-28T10:00:00Z"), 1))).toBe("2026-03-29T16:00:00.000Z");
  });

  it("is DST-correct when clocks go back on the last day (late October)", () => {
    expect(iso(offerEndsAt(new Date("2026-10-23T11:00:00Z"), 3))).toBe("2026-10-26T17:00:00.000Z");
    expect(iso(offerEndsAt(new Date("2026-10-24T10:00:00Z"), 1))).toBe("2026-10-25T17:00:00.000Z");
  });

  it("goes by the London day of the send time, not the UTC day", () => {
    // 00:30 BST on Sun 25 Oct is still Sat 24 Oct in UTC.
    expect(iso(offerEndsAt(new Date("2026-10-24T23:30:00Z"), 1))).toBe("2026-10-26T17:00:00.000Z");
  });

  it("counts the days from the next day when sent after 17:00 London", () => {
    // 17:30 GMT on Tue 10 Nov: a 1-day offer ends Thu 12 Nov, not 23.5 hours later.
    expect(iso(offerEndsAt(new Date("2026-11-10T17:30:00Z"), 1))).toBe("2026-11-12T17:00:00.000Z");
    // 16:30Z is 17:30 BST, also after 17:00 London.
    expect(iso(offerEndsAt(new Date("2026-07-01T16:30:00Z"), 1))).toBe("2026-07-03T16:00:00.000Z");
    // Exactly 17:00 still counts from the same day.
    expect(iso(offerEndsAt(new Date("2026-11-10T17:00:00Z"), 1))).toBe("2026-11-11T17:00:00.000Z");
  });

  it("allows 1 to 7 days and refuses anything else", () => {
    for (const days of [1, 2, 3, 4, 5, 6, 7]) expect(isValidOfferDays(days)).toBe(true);
    for (const days of [0, 8, -1, 2.5, Number.NaN]) {
      expect(isValidOfferDays(days)).toBe(false);
      expect(() => offerEndsAt(new Date("2026-11-10T14:00:00Z"), days)).toThrow(RangeError);
    }
  });
});

describe("invoiceDueAfterAcceptance", () => {
  it("is the one invoice due rule", () => {
    for (const at of ["2026-03-26T14:00:00Z", "2026-10-22T23:30:00Z", "2026-11-10T00:10:00Z"]) {
      expect(invoiceDueAfterAcceptance(new Date(at))).toEqual(invoiceDueAt(new Date(at)));
    }
  });

  it("is due 7 days after acceptance, at the end of that London day", () => {
    expect(iso(invoiceDueAfterAcceptance(new Date("2026-11-10T14:00:00Z")))).toBe(
      "2026-11-17T23:59:59.999Z",
    );
  });

  it("follows the clock change", () => {
    expect(iso(invoiceDueAfterAcceptance(new Date("2026-03-26T14:00:00Z")))).toBe(
      "2026-04-02T22:59:59.999Z",
    );
    expect(iso(invoiceDueAfterAcceptance(new Date("2026-10-22T14:00:00Z")))).toBe(
      "2026-10-29T23:59:59.999Z",
    );
  });
});
