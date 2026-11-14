import { describe, expect, it } from "vitest";
import {
  MARKETING_OPT_OUT_EMAIL_TEMPLATES,
  OPTIONAL_EMAIL_TEMPLATES,
  isOptionalEmailTemplate,
  suppressionBlocksTemplate,
} from "./suppression-policy.js";
import { templateNames } from "./types.js";

const TRANSACTIONAL = [
  "payment-invoice",
  "bid-invoice-issued",
  "payment-receipt",
  "payment-refund-notice",
  "shop-order-receipt",
  "shop-invoice-issued",
  "shop-refund-issued",
  "kyc-resubmission-required",
  "kyc-approved",
  "kyc-declined",
  "source-of-funds-documents-requested",
  "payout-initiated-notice",
  "payout-transfer-failed-notice",
  "lot-won",
  "reset-password",
  "new-device-login",
] as const;

describe("suppression policy", () => {
  it("lets a global unsubscribe stop optional notifications", () => {
    for (const template of OPTIONAL_EMAIL_TEMPLATES) {
      expect(suppressionBlocksTemplate("unsubscribe", template)).toBe(true);
    }
  });

  it("never lets an unsubscribe stop invoices, receipts, refunds, KYC, payouts or security mail", () => {
    for (const template of TRANSACTIONAL) {
      expect(isOptionalEmailTemplate(template)).toBe(false);
      expect(suppressionBlocksTemplate("unsubscribe", template)).toBe(false);
    }
  });

  it("lets hard bounces, complaints, soft-bounce thresholds and manual blocks stop everything", () => {
    for (const reason of ["hard_bounce", "complaint", "soft_bounce_threshold", "manual"] as const) {
      for (const template of [...TRANSACTIONAL, ...OPTIONAL_EMAIL_TEMPLATES]) {
        expect(suppressionBlocksTemplate(reason, template)).toBe(true);
      }
    }
  });

  it("treats an unknown template as transactional so it cannot be silenced by mistake", () => {
    expect(suppressionBlocksTemplate("unsubscribe", "a-future-template")).toBe(false);
  });

  it("only lists templates that exist", () => {
    for (const template of OPTIONAL_EMAIL_TEMPLATES) {
      expect(templateNames).toContain(template);
    }
  });

  describe("marketing opt-out from Zoho Campaigns", () => {
    it("stops alert and marketing mail", () => {
      for (const template of MARKETING_OPT_OUT_EMAIL_TEMPLATES) {
        expect(suppressionBlocksTemplate("unsubscribed_marketing", template)).toBe(true);
      }
    });

    it("does not stop an alert confirmation, which answers the person's own request", () => {
      expect(MARKETING_OPT_OUT_EMAIL_TEMPLATES).not.toContain("alert-confirm");
      expect(suppressionBlocksTemplate("unsubscribed_marketing", "alert-confirm")).toBe(false);
    });

    it("does not block a receipt, an invoice, security mail or any other transactional mail", () => {
      expect(suppressionBlocksTemplate("unsubscribed_marketing", "payment-receipt")).toBe(false);
      for (const template of TRANSACTIONAL) {
        expect(suppressionBlocksTemplate("unsubscribed_marketing", template)).toBe(false);
      }
    });

    it("is narrower than a global unsubscribe and leaves other product notices alone", () => {
      expect(suppressionBlocksTemplate("unsubscribed_marketing", "bid-outbid")).toBe(false);
      expect(suppressionBlocksTemplate("unsubscribe", "bid-outbid")).toBe(true);
    });

    it("treats an unknown template as not blocked", () => {
      expect(suppressionBlocksTemplate("unsubscribed_marketing", "a-future-template")).toBe(false);
    });
  });
});
