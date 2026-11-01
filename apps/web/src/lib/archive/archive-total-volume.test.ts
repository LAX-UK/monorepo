import { archiveTotalVolumeLabel } from "@/lib/archive/archive-total-volume";
import { describe, expect, it } from "vitest";

describe("archiveTotalVolumeLabel", () => {
  it("formats the sold total in pounds, never dollars", () => {
    expect(archiveTotalVolumeLabel("83750.00")).toBe("£83,750");
    expect(archiveTotalVolumeLabel("5638500.00")).toBe("£5.6m");
  });

  it("hides the figure when nothing has sold or the value is unreadable", () => {
    expect(archiveTotalVolumeLabel("0")).toBeNull();
    expect(archiveTotalVolumeLabel("")).toBeNull();
  });
});
