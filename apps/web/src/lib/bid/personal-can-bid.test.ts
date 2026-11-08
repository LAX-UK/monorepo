import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { describe, expect, it } from "vitest";
import { personalCanBid } from "./personal-can-bid";

const summary = (
  status: KycStatusSummaryDto["status"],
  requiresKyc: boolean,
): KycStatusSummaryDto => ({ status, requiresKyc }) as KycStatusSummaryDto;

describe("personalCanBid", () => {
  it("is true when no identity check is required, even if unverified", () => {
    expect(personalCanBid({ summary: summary("unverified", false) })).toBe(true);
    expect(personalCanBid({ summary: summary("pending", false) })).toBe(true);
  });

  it("is true once the check is approved", () => {
    expect(personalCanBid({ summary: summary("approved", true) })).toBe(true);
  });

  it("is false while a check is required and not approved", () => {
    expect(personalCanBid({ summary: summary("unverified", true) })).toBe(false);
    expect(personalCanBid({ summary: summary("pending", true) })).toBe(false);
  });

  it("is false when the check was refused, whatever else is said", () => {
    expect(personalCanBid({ summary: summary("rejected", false) })).toBe(false);
    expect(personalCanBid({ summary: summary("rejected", true) })).toBe(false);
  });

  it("is false when the status could not be read", () => {
    expect(personalCanBid({ summary: null, unavailable: true })).toBe(false);
    expect(personalCanBid({ summary: null })).toBe(false);
    expect(personalCanBid({ summary: undefined })).toBe(false);
  });
});
