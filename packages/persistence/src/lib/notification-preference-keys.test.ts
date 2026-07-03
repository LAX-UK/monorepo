import { describe, expect, it } from "vitest";
import {
  emailPreferenceKey,
  inAppPreferenceKey,
  notificationTypeToTemplate,
  pushPreferenceKey,
  whatsappPreferenceKey,
} from "./notification-preference-keys.js";

/** All types from packages/db notification_type_check constraint. */
const NOTIFICATION_TYPES = [
  "outbid",
  "lot_cancelled",
  "lot_won",
  "lot_lost",
  "lot_ending_soon",
  "watchlist_starting",
  "watchlist_ending_soon",
  "payment_received",
  "payment_due",
  "lot_ended_seller",
  "kyc_resubmission_required",
  "submission_received_for_review",
  "submission_approved",
  "submission_rejected",
  "submission_converted",
  "submission_draft_reminder",
  "condition_report_ready",
  "condition_report_declined",
  "source_of_funds_documents_requested",
  "source_of_funds_approved",
  "source_of_funds_rejected",
] as const;

type ExpectedRow = {
  email: ReturnType<typeof emailPreferenceKey>;
  whatsapp: ReturnType<typeof whatsappPreferenceKey>;
  inApp: ReturnType<typeof inAppPreferenceKey>;
  push: ReturnType<typeof pushPreferenceKey>;
  template: ReturnType<typeof notificationTypeToTemplate>;
};

const EXPECTED: Record<(typeof NOTIFICATION_TYPES)[number], ExpectedRow> = {
  outbid: {
    email: "outbidEmail",
    whatsapp: "outbidWhatsapp",
    inApp: "outbidInApp",
    push: "outbidPush",
    template: "bid-outbid",
  },
  lot_cancelled: {
    email: "outbidEmail",
    whatsapp: "outbidWhatsapp",
    inApp: "outbidInApp",
    push: "outbidPush",
    template: null,
  },
  lot_won: {
    email: "wonEmail",
    whatsapp: "wonWhatsapp",
    inApp: "wonInApp",
    push: "wonPush",
    template: "lot-won",
  },
  lot_lost: {
    email: "lostEmail",
    whatsapp: "lostWhatsapp",
    inApp: "lostInApp",
    push: null,
    template: null,
  },
  lot_ending_soon: {
    email: "endingSoonEmail",
    whatsapp: "endingSoonWhatsapp",
    inApp: "endingSoonInApp",
    push: "endingSoonPush",
    template: null,
  },
  watchlist_starting: {
    email: "watchlistEmail",
    whatsapp: "watchlistWhatsapp",
    inApp: "watchlistInApp",
    push: null,
    template: null,
  },
  watchlist_ending_soon: {
    email: "endingSoonEmail",
    whatsapp: "endingSoonWhatsapp",
    inApp: "endingSoonInApp",
    push: "endingSoonPush",
    template: null,
  },
  payment_received: {
    email: "paymentEmail",
    whatsapp: "paymentWhatsapp",
    inApp: "paymentInApp",
    push: null,
    template: "payment-receipt",
  },
  payment_due: {
    email: "paymentEmail",
    whatsapp: "paymentWhatsapp",
    inApp: "paymentInApp",
    push: null,
    template: "payment-invoice",
  },
  lot_ended_seller: {
    email: "lotEndedSellerEmail",
    whatsapp: "lotEndedSellerWhatsapp",
    inApp: null,
    push: null,
    template: "lot-ended-seller",
  },
  kyc_resubmission_required: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
  submission_received_for_review: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
  submission_approved: {
    email: "submissionUpdatesEmail",
    whatsapp: null,
    inApp: null,
    push: "submissionUpdatesPush",
    template: "submission-approved",
  },
  submission_rejected: {
    email: "submissionUpdatesEmail",
    whatsapp: null,
    inApp: null,
    push: "submissionUpdatesPush",
    template: "submission-rejected",
  },
  submission_converted: {
    email: "submissionUpdatesEmail",
    whatsapp: null,
    inApp: null,
    push: "submissionUpdatesPush",
    template: "submission-converted",
  },
  submission_draft_reminder: {
    email: "submissionUpdatesEmail",
    whatsapp: null,
    inApp: null,
    push: "submissionUpdatesPush",
    template: "submission-draft-reminder",
  },
  condition_report_ready: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
  condition_report_declined: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
  source_of_funds_documents_requested: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
  source_of_funds_approved: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
  source_of_funds_rejected: {
    email: null,
    whatsapp: null,
    inApp: null,
    push: null,
    template: null,
  },
};

describe("notification-preference-keys", () => {
  it.each(NOTIFICATION_TYPES)("maps %s consistently across all channels", (type) => {
    const row = EXPECTED[type];
    expect(emailPreferenceKey(type)).toBe(row.email);
    expect(whatsappPreferenceKey(type)).toBe(row.whatsapp);
    expect(inAppPreferenceKey(type)).toBe(row.inApp);
    expect(pushPreferenceKey(type)).toBe(row.push);
    expect(notificationTypeToTemplate(type)).toBe(row.template);
  });

  it("returns null for unknown types", () => {
    expect(emailPreferenceKey("not_a_real_type")).toBeNull();
    expect(whatsappPreferenceKey("not_a_real_type")).toBeNull();
    expect(inAppPreferenceKey("not_a_real_type")).toBeNull();
    expect(pushPreferenceKey("not_a_real_type")).toBeNull();
    expect(notificationTypeToTemplate("not_a_real_type")).toBeNull();
  });
});
