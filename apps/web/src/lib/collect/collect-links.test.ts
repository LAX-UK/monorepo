import { describe, expect, it } from "vitest";
import {
  changeCollectionHref,
  collectHref,
  collectionCalendarHref,
  parseCollectLink,
} from "./collect-links";

const A = "5d1b4c5e-7f0e-4c8e-9a54-2b7f3c1a9e01";
const B = "0c9e2a33-1d54-4f6b-8a7c-3e5d9b2f1a02";

describe("parseCollectLink", () => {
  it("reads one or several lots, once each", () => {
    expect(parseCollectLink({ lots: `${A},${B},${A}` })).toEqual({ kind: "lots", ids: [A, B] });
  });

  it("shows the visits when nothing is asked for", () => {
    expect(parseCollectLink({})).toEqual({ kind: "visits" });
    expect(parseCollectLink({ lots: "  " })).toEqual({ kind: "visits" });
  });

  it("reads a visit to change", () => {
    expect(parseCollectLink({ booking: A })).toEqual({ kind: "change", bookingId: A });
  });

  it("refuses anything that is not an id, rather than guessing", () => {
    expect(parseCollectLink({ lots: `${A},nope` })).toEqual({
      kind: "invalid",
      reason: "malformed",
    });
    expect(parseCollectLink({ booking: "x" })).toEqual({ kind: "invalid", reason: "malformed" });
  });

  it("refuses more than 20 lots", () => {
    const many = Array.from(
      { length: 21 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(parseCollectLink({ lots: many.join(",") })).toEqual({
      kind: "invalid",
      reason: "too_many",
    });
  });
});

describe("links", () => {
  it("builds the booking, change and calendar addresses", () => {
    expect(collectHref([A, B])).toBe(`/purchases/collect?lots=${A},${B}`);
    expect(collectHref([])).toBe("/purchases/collect");
    expect(changeCollectionHref(A)).toBe(`/purchases/collect?booking=${A}`);
    expect(collectionCalendarHref(A)).toBe(`/purchases/collect/${A}/calendar.ics`);
  });
});
