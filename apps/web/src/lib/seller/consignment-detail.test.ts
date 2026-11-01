import type { ItemSubmission } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildConsignmentDetailVm } from "./consignment-detail.vm";

function submission(overrides: Partial<ItemSubmission> = {}): ItemSubmission {
  return {
    id: "s1",
    title: "Figure in a summer landscape",
    status: "approved",
    medium: "Oil on board",
    dimensions: "60 × 60 cm",
    yearOfWork: "Circa 1960",
    images: ["/fig.jpg"],
    convertedLotId: null,
    createdAt: new Date("2026-10-14T10:00:00Z"),
    updatedAt: new Date("2026-10-20T10:00:00Z"),
    ...overrides,
  } as ItemSubmission;
}

describe("buildConsignmentDetailVm", () => {
  it("shows the agreement as the current step and lists only known facts", () => {
    const vm = buildConsignmentDetailVm({
      submission: submission(),
      lot: null,
      agreement: "open",
      listingHref: null,
    });
    expect(vm.meta).toBe("Oil on board · 60 × 60 cm");
    expect(vm.steps?.find((step) => step.progress === "current")?.label).toBe("Agreement");
    expect(vm.facts).toEqual([
      { label: "Medium", value: "Oil on board" },
      { label: "Size", value: "60 × 60 cm" },
      { label: "Date", value: "Circa 1960" },
      { label: "Submitted", value: "14 Oct 2026" },
    ]);
  });

  it("names the lot once catalogued and drops the steps for rejected work", () => {
    const listed = buildConsignmentDetailVm({
      submission: submission({ status: "converted", yearOfWork: null }),
      lot: { status: "scheduled", winnerId: null, lotNumber: 3 },
      agreement: "accepted",
      listingHref: "/lot/x",
    });
    expect(listed.meta).toBe("Oil on board · 60 × 60 cm · Lot 3");
    expect(listed.steps?.find((step) => step.progress === "current")?.label).toBe("In sale");
    const rejected = buildConsignmentDetailVm({
      submission: submission({ status: "rejected" }),
      lot: null,
      agreement: "open",
      listingHref: null,
    });
    expect(rejected.steps).toBeNull();
  });
});
