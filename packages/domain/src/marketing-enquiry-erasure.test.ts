import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRIVATE_SALE_RECORD_RETENTION_YEARS,
  ENQUIRY_ERASURE_HOLD_STATUSES,
  ERASED_ENQUIRY,
  type EnquiryDealRecord,
  isEnquiryHeldFromErasure,
} from "./marketing-enquiry-erasure.js";
import { ENQUIRY_STATUSES } from "./marketing-enquiry-vocabulary.js";
import { OPEN_DEAL_STAGES } from "./private-sale-deal/views.js";

describe("enquiry erasure policy", () => {
  it("holds a converted enquiry, which belongs to its deal, and no other", () => {
    expect(ENQUIRY_ERASURE_HOLD_STATUSES).toEqual(["converted"]);
    for (const status of ENQUIRY_STATUSES) {
      expect(isEnquiryHeldFromErasure(status)).toBe(status === "converted");
    }
  });

  describe("a converted enquiry and the record of its deal", () => {
    const ENDED = new Date("2026-03-01T12:00:00Z");
    const AGREED = new Date("2026-02-01T12:00:00Z");
    const deal = (over: Partial<EnquiryDealRecord> = {}): EnquiryDealRecord => ({
      stage: "settled",
      agreedAt: AGREED,
      endedAt: ENDED,
      hasComplianceCase: true,
      ...over,
    });
    const at = (iso: string) => new Date(iso);
    const held = (deals: EnquiryDealRecord[], now: string, years?: number) =>
      isEnquiryHeldFromErasure("converted", deals, at(now), years);

    it("is held while any deal made from it is open", () => {
      for (const stage of OPEN_DEAL_STAGES) {
        expect(held([deal({ stage, endedAt: null })], "2040-01-01T00:00:00Z")).toBe(true);
      }
      // An open deal keeps it, even next to one that ended long ago.
      expect(
        held(
          [
            deal({ stage: "cancelled", agreedAt: null, hasComplianceCase: false }),
            deal({ stage: "paid", endedAt: null }),
          ],
          "2040-01-01T00:00:00Z",
        ),
      ).toBe(true);
    });

    it("is held after the deal settles, until five years have passed", () => {
      expect(held([deal()], "2026-03-02T00:00:00Z")).toBe(true);
      expect(held([deal()], "2031-02-28T23:59:59Z")).toBe(true);
      expect(held([deal()], "2031-03-01T12:00:00Z")).toBe(false);
      expect(held([deal()], "2031-03-02T00:00:00Z")).toBe(false);
    });

    it("keeps the record for as long as the retention setting says", () => {
      expect(held([deal()], "2031-03-02T00:00:00Z", 7)).toBe(true);
      expect(held([deal()], "2033-03-02T00:00:00Z", 7)).toBe(false);
      expect(held([deal()], "2027-03-02T00:00:00Z", 1)).toBe(false);
    });

    it("is held when a deal cancelled after agreement, until the same period has passed", () => {
      const cancelledAfterAgreement = deal({ stage: "cancelled" });
      expect(held([cancelledAfterAgreement], "2028-01-01T00:00:00Z")).toBe(true);
      expect(held([cancelledAfterAgreement], "2031-03-02T00:00:00Z")).toBe(false);
    });

    it("is held when a deal cancelled before agreement had a screening or source-of-funds case", () => {
      const cancelledAfterCheck = deal({ stage: "cancelled", agreedAt: null });
      expect(held([cancelledAfterCheck], "2028-01-01T00:00:00Z")).toBe(true);
      expect(held([cancelledAfterCheck], "2031-03-02T00:00:00Z")).toBe(false);
    });

    it("is released when a deal was cancelled before agreement and no check was opened", () => {
      const withdrawn = deal({ stage: "cancelled", agreedAt: null, hasComplianceCase: false });
      expect(held([withdrawn], "2026-03-02T00:00:00Z")).toBe(false);
    });

    it("is held when a settled or cancelled deal has no known end date", () => {
      expect(held([deal({ endedAt: null })], "2040-01-01T00:00:00Z")).toBe(true);
      expect(held([deal({ stage: "cancelled", endedAt: null })], "2040-01-01T00:00:00Z")).toBe(
        true,
      );
    });

    it("stays held when it has no deal at all, because nothing shows its deal is finished", () => {
      expect(held([], "2040-01-01T00:00:00Z")).toBe(true);
      expect(isEnquiryHeldFromErasure("converted")).toBe(true);
    });

    it("uses five years unless told otherwise", () => {
      expect(DEFAULT_PRIVATE_SALE_RECORD_RETENTION_YEARS).toBe(5);
    });

    it("never holds an enquiry that was not converted, whatever deals exist", () => {
      expect(isEnquiryHeldFromErasure("closed", [deal()], at("2026-04-01T00:00:00Z"))).toBe(false);
    });
  });

  it("replaces the email with an address that can never receive mail", () => {
    expect(ERASED_ENQUIRY.email.endsWith(".invalid")).toBe(true);
  });
});
