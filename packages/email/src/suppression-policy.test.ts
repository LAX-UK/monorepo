import { describe, expect, it } from "vitest";
import {
  OPTIONAL_EMAIL_TEMPLATES,
  isOptionalEmailTemplate,
  suppressionBlocksTemplate,
} from "./suppression-policy.js";
import { templateNames } from "./types.js";

const TRANSACTIONAL = [
  "payment-invoice",
  "payment-receipt",
  "payment-refund-notice",
  "shop-order-receipt",
  "shop-refund-issued",
  "kyc-resubmission-required",
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
});
