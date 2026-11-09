import { describe, expect, it } from "vitest";
import { collectionHandoverCutoff } from "./purge-collection-handover-records.js";

describe("collectionHandoverCutoff", () => {
  const now = new Date("2038-01-01T12:00:00Z");

  it("is the retention period before now, to the moment", () => {
    expect(collectionHandoverCutoff(now, 6).toISOString()).toBe("2032-01-01T12:00:00.000Z");
    expect(collectionHandoverCutoff(now, 3).toISOString()).toBe("2035-01-01T12:00:00.000Z");
    expect(collectionHandoverCutoff(now, 30).toISOString()).toBe("2008-01-01T12:00:00.000Z");
  });

  it("does not change the date it is given", () => {
    const before = now.getTime();
    collectionHandoverCutoff(now, 6);
    expect(now.getTime()).toBe(before);
  });

  it("lands on 1 March when 29 February has no counterpart", () => {
    expect(collectionHandoverCutoff(new Date("2032-02-29T00:00:00Z"), 3).toISOString()).toBe(
      "2029-03-01T00:00:00.000Z",
    );
  });

  it("refuses a retention under three years, or one that is not a whole number", () => {
    for (const years of [0, 1, 2, -1, 2.5, Number.NaN]) {
      expect(() => collectionHandoverCutoff(now, years)).toThrow(RangeError);
    }
  });
});
