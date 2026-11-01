import { describe, expect, it } from "vitest";
import { cataloguePreparingCopy, resolveSalePageState } from "./sale-page-state";

describe("resolveSalePageState", () => {
  it.each([
    ["cancelled", 0, "cancelled"],
    ["cancelled", 40, "cancelled"],
    ["scheduled", 0, "preparing"],
    ["scheduled", 1, "catalogue"],
    ["active", 0, "catalogue"],
    ["ended", 0, "catalogue"],
    ["active", 12, "catalogue"],
  ] as const)("a %s sale with %i lots is %s", (status, lotCount, expected) => {
    expect(resolveSalePageState({ status, lotCount })).toBe(expected);
  });
});

describe("cataloguePreparingCopy", () => {
  const now = new Date("2026-01-05T12:00:00Z");

  it("gives the lots-online date and the consignment deadline", () => {
    const copy = cataloguePreparingCopy(
      {
        startTime: new Date("2026-02-22T10:00:00Z"),
        previewStartTime: null,
        consignmentDeadline: new Date("2026-01-15T12:00:00Z"),
      },
      now,
    );
    expect(copy.title).toBe("The catalogue is being prepared");
    expect(copy.description).toBe(
      "Lots go online from Sun 22 Feb. Consignments for this sale are open until Thu 15 Jan.",
    );
  });

  it("puts lots online from the preview when there is one", () => {
    const copy = cataloguePreparingCopy(
      {
        startTime: new Date("2026-02-22T10:00:00Z"),
        previewStartTime: new Date("2026-02-16T10:00:00Z"),
        consignmentDeadline: null,
      },
      now,
    );
    expect(copy.description).toBe("Lots go online from Mon 16 Feb.");
  });

  it("leaves out a consignment window that has closed", () => {
    const copy = cataloguePreparingCopy(
      {
        startTime: new Date("2026-02-22T10:00:00Z"),
        previewStartTime: null,
        consignmentDeadline: new Date("2026-01-01T12:00:00Z"),
      },
      now,
    );
    expect(copy.description).not.toContain("Consignments");
  });

  it("does not promise a date that has passed", () => {
    const copy = cataloguePreparingCopy(
      {
        startTime: new Date("2026-01-02T10:00:00Z"),
        previewStartTime: null,
        consignmentDeadline: null,
      },
      now,
    );
    expect(copy.description).toBe("Lots will appear here as soon as they are published.");
  });

  it("shows the year when the date is in another year", () => {
    const copy = cataloguePreparingCopy(
      {
        startTime: new Date("2027-02-22T10:00:00Z"),
        previewStartTime: null,
        consignmentDeadline: null,
      },
      now,
    );
    expect(copy.description).toBe("Lots go online from Mon 22 Feb 2027.");
  });
});
