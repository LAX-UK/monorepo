import { describe, expect, it } from "vitest";
import { kycEvidenceHeldForDeals } from "./party-record-hold.js";

const NOW = new Date("2031-06-15T00:00:00Z");
const yearsAgo = (years: number, days = 0) => {
  const d = new Date(NOW);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return new Date(d.getTime() + days * 86_400_000);
};
const settled = (endedAt: Date | null) => ({
  stage: "settled" as const,
  agreedAt: yearsAgo(6),
  endedAt,
  hasComplianceCase: true,
});

describe("kycEvidenceHeldForDeals", () => {
  it("holds nothing for someone on no deal", () => {
    expect(kycEvidenceHeldForDeals([], NOW, 5)).toBe(false);
  });

  it.each(["proposed", "offer", "agreed", "cleared", "invoiced", "paid", "released"] as const)(
    "holds the evidence while a deal is %s",
    (stage) => {
      const open = { stage, agreedAt: null, endedAt: null, hasComplianceCase: false };
      expect(kycEvidenceHeldForDeals([open], NOW, 5)).toBe(true);
    },
  );

  it("holds the evidence until the retention has run from the end of a settled deal", () => {
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(5, 1))], NOW, 5)).toBe(true);
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(5, -1))], NOW, 5)).toBe(false);
  });

  it("follows a longer configured retention", () => {
    const ended = settled(yearsAgo(6));
    expect(kycEvidenceHeldForDeals([ended], NOW, 5)).toBe(false);
    expect(kycEvidenceHeldForDeals([ended], NOW, 10)).toBe(true);
  });

  it("holds the evidence when a deal's end is not recorded", () => {
    expect(kycEvidenceHeldForDeals([settled(null)], NOW, 5)).toBe(true);
  });

  it("holds the evidence while any one of several deals is retained", () => {
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(9)), settled(yearsAgo(1))], NOW, 5)).toBe(
      true,
    );
    expect(kycEvidenceHeldForDeals([settled(yearsAgo(9)), settled(yearsAgo(8))], NOW, 5)).toBe(
      false,
    );
  });

  it("holds the evidence of a deal cancelled after agreement, as long as the retention", () => {
    const cancelled = (endedAt: Date) => ({
      stage: "cancelled" as const,
      agreedAt: yearsAgo(7),
      endedAt,
      hasComplianceCase: false,
    });
    expect(kycEvidenceHeldForDeals([cancelled(yearsAgo(2))], NOW, 5)).toBe(true);
    expect(kycEvidenceHeldForDeals([cancelled(yearsAgo(6))], NOW, 5)).toBe(false);
  });

  it("holds nothing for a deal withdrawn before agreement with no check since the enquiry", () => {
    const withdrawn = {
      stage: "cancelled" as const,
      agreedAt: null,
      endedAt: yearsAgo(1),
      hasComplianceCase: false,
    };
    expect(kycEvidenceHeldForDeals([withdrawn], NOW, 5)).toBe(false);
    expect(kycEvidenceHeldForDeals([{ ...withdrawn, hasComplianceCase: true }], NOW, 5)).toBe(true);
  });
});
