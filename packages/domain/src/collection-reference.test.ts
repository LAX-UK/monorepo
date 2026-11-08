import { describe, expect, it } from "vitest";
import { formatCollectionReference, parseCollectionReference } from "./collection-reference.js";

describe("collection reference", () => {
  it("pads to four digits and grows past them", () => {
    expect(formatCollectionReference(1)).toBe("COL-0001");
    expect(formatCollectionReference(4821)).toBe("COL-4821");
    expect(formatCollectionReference(9999)).toBe("COL-9999");
    expect(formatCollectionReference(10000)).toBe("COL-10000");
  });

  it("refuses a sequence that is not a positive whole number", () => {
    for (const bad of [0, -3, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => formatCollectionReference(bad)).toThrow(RangeError);
    }
  });

  it("reads back what it writes", () => {
    for (const n of [1, 42, 4821, 10000]) {
      expect(parseCollectionReference(formatCollectionReference(n))).toBe(n);
    }
  });

  it("reads a reference typed at the desk", () => {
    expect(parseCollectionReference(" col-4821 ")).toBe(4821);
  });

  it("rejects anything that is not a reference", () => {
    for (const bad of ["4821", "COL4821", "COL-12", "COL-0000", "COL-48 21", "ORD-4821", ""]) {
      expect(parseCollectionReference(bad)).toBeNull();
    }
  });
});
