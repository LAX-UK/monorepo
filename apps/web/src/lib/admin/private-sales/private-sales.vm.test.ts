import { dealRecord } from "@/components/admin/private-sales/deal.fixture";
import { PRIVATE_SALE_DEAL_STAGES } from "@auction/types";
import { STAFF_DEAL_ACTIONS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  DEAL_ACTION_COPY,
  DEAL_STAGE_BADGES,
  DEAL_STAGE_LABELS,
  dealDeadline,
  dealHref,
  dealNextStep,
  formatBps,
  policyGapSentence,
} from "./private-sales.vm";

describe("vocabularies", () => {
  it("has words and a tone for every stage, sentence case", () => {
    for (const stage of PRIVATE_SALE_DEAL_STAGES) {
      expect(DEAL_STAGE_LABELS[stage]).toMatch(/^[A-Z][a-z]+$/);
      expect(DEAL_STAGE_BADGES[stage].tone).toBeTruthy();
    }
  });

  it("has an effect, a confirm label and money flag for every move", () => {
    for (const action of STAFF_DEAL_ACTIONS) {
      const copy = DEAL_ACTION_COPY[action];
      expect(copy.effect(dealRecord()).length).toBeGreaterThan(20);
      expect(copy.confirm).not.toMatch(/[A-Z]{2,}/);
    }
    expect(DEAL_ACTION_COPY.issue_invoice.money).toBe(true);
    expect(DEAL_ACTION_COPY.refund.money).toBe(true);
    expect(DEAL_ACTION_COPY.agree.money).toBe(false);
  });

  it("asks for a reason only to cancel, to release the work and to record a bank transfer", () => {
    const asked = ["cancel", "release", "record_bank_transfer"];
    for (const action of asked) {
      expect(DEAL_ACTION_COPY[action as keyof typeof DEAL_ACTION_COPY].reason?.required).toBe(true);
    }
    for (const action of STAFF_DEAL_ACTIONS.filter((a) => !asked.includes(a))) {
      expect(DEAL_ACTION_COPY[action].reason).toBeNull();
    }
  });

  it("asks for an amount only to refund (optional) and to record a bank transfer (required)", () => {
    expect(DEAL_ACTION_COPY.refund.amount.required).toBe(false);
    expect(DEAL_ACTION_COPY.record_bank_transfer.amount.required).toBe(true);
    expect(DEAL_ACTION_COPY.record_bank_transfer.money).toBe(true);
    for (const action of STAFF_DEAL_ACTIONS.filter(
      (a) => a !== "refund" && a !== "record_bank_transfer",
    )) {
      expect("amount" in DEAL_ACTION_COPY[action]).toBe(false);
    }
  });

  it("says how much of a part-refunded payment is left to return", () => {
    const effect = DEAL_ACTION_COPY.refund.effect(
      dealRecord({
        payment: {
          status: "paid",
          rail: "card",
          amountMinor: 4_800_000,
          paidAt: null,
          refundedMinor: 1_000_000,
          recordedTransfer: false,
        },
      }),
    );
    expect(effect).toMatch(/£38,000\.00/);
    expect(effect).toMatch(/£10,000\.00 has already gone back/);
  });

  it("warns that cancelling a paid deal needs the refund first", () => {
    expect(DEAL_ACTION_COPY.cancel.effect(dealRecord({ stage: "paid" }))).toMatch(/refunded first/);
    expect(DEAL_ACTION_COPY.cancel.effect(dealRecord({ stage: "invoiced" }))).toMatch(
      /ends the buyer's open payment/,
    );
  });
});

describe("dealNextStep", () => {
  it("names the next step for each stage", () => {
    expect(dealNextStep("proposed", false)).toBe("Name the buyer");
    expect(dealNextStep("proposed", true)).toBe("Record an offer");
    expect(dealNextStep("agreed", true)).toBe("Waiting on checks");
    expect(dealNextStep("cleared", true)).toBe("Issue the invoice");
    expect(dealNextStep("paid", true)).toBe("Release the work");
  });
});

describe("dealDeadline", () => {
  const dates = {
    offerExpiresAt: "2026-11-12T17:00:00.000Z",
    paymentDueAt: "2026-11-19T17:00:00.000Z",
    collectionDueAt: "2026-12-03T17:00:00.000Z",
  };
  it("shows the date the stage is waiting for", () => {
    expect(dealDeadline({ stage: "offer", ...dates })?.label).toBe("Offer expires");
    expect(dealDeadline({ stage: "invoiced", ...dates })?.label).toBe("Payment due");
    expect(dealDeadline({ stage: "paid", ...dates })?.label).toBe("Collection due");
  });
  it("shows nothing once a stage has no deadline", () => {
    expect(dealDeadline({ stage: "settled", ...dates })).toBeNull();
    expect(dealDeadline({ stage: "offer", ...dates, offerExpiresAt: null })).toBeNull();
  });
});

describe("policyGapSentence", () => {
  it("lists what is missing in plain words", () => {
    expect(policyGapSentence(["vat_treatments"])).toBe("the VAT treatments");
    expect(policyGapSentence(["terms_version", "commission_rate"])).toBe(
      "the private sale terms and the commission rate",
    );
    expect(
      policyGapSentence(["terms_version", "commission_rate", "vat_treatments", "payment_due_days"]),
    ).toBe(
      "the private sale terms, the commission rate, the VAT treatments and the payment deadline",
    );
  });
});

describe("formatBps", () => {
  it.each([
    [1500, "15%"],
    [250, "2.5%"],
    [0, "0%"],
    [125, "1.25%"],
  ])("%i is %s", (bps, text) => {
    expect(formatBps(bps)).toBe(text);
  });
});

it("links to a deal by its reference", () => {
  expect(dealHref("PS-0012")).toBe("/admin/private-sales/PS-0012");
});
