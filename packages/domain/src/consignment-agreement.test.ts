import { legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  CONSIGNMENT_AGREEMENT_TERMS_VERSION,
  agreementAcceptanceHold,
  agreementAllowsCataloguing,
  agreementTermsComplete,
  canAcceptConsignmentAgreement,
  decideAgreementAcceptance,
  dueAgreementReminder,
  sellingActionsHold,
} from "./consignment-agreement.js";

const ENTITY = "entity-1";
const proposed = {
  legalEntityId: ENTITY,
  termsVersion: CONSIGNMENT_AGREEMENT_TERMS_VERSION,
  acceptedAt: null,
  estimateLow: "8000.00",
  estimateHigh: "12000.00",
  commissionPercent: "15.00",
};

function decide(overrides: Partial<Parameters<typeof decideAgreementAcceptance>[0]> = {}) {
  return decideAgreementAcceptance({
    agreement: proposed,
    actingLegalEntityId: ENTITY,
    actor: null,
    termsVersion: CONSIGNMENT_AGREEMENT_TERMS_VERSION,
    ...overrides,
  });
}

describe("who may accept the consignment agreement", () => {
  it("lets a person accept for their own profile", () => {
    expect(canAcceptConsignmentAgreement(null)).toBe(true);
    expect(decide()).toEqual({ kind: "accept" });
  });

  it.each(legalEntityMemberRoles)("decides for an organisation %s by the capability", (role) => {
    const allowed = role === "owner" || role === "admin";
    expect(canAcceptConsignmentAgreement({ role })).toBe(allowed);
    const decision = decide({ actor: { role } });
    expect(decision.kind).toBe(allowed ? "accept" : "refused");
  });

  it("never lets an impersonating admin accept", () => {
    expect(canAcceptConsignmentAgreement({ role: "owner", isImpersonation: true })).toBe(false);
  });

  it("refuses an agreement that belongs to another account as not found", () => {
    const decision = decide({ actingLegalEntityId: "entity-2" });
    expect(decision).toMatchObject({ kind: "refused", reason: "not_found" });
  });

  it("refuses before the specialist has proposed terms", () => {
    expect(decide({ agreement: null })).toMatchObject({ kind: "refused", reason: "not_proposed" });
  });
});

describe("incomplete terms", () => {
  it("never asks a seller to accept a proposal without an estimate and commission", () => {
    for (const blank of [
      { estimateLow: null },
      { estimateHigh: null },
      { commissionPercent: null },
    ]) {
      expect(decide({ agreement: { ...proposed, ...blank } })).toMatchObject({
        kind: "refused",
        reason: "incomplete_terms",
      });
    }
  });

  it("knows when the terms are complete", () => {
    expect(agreementTermsComplete(proposed)).toBe(true);
    expect(agreementTermsComplete({ ...proposed, estimateHigh: null })).toBe(false);
  });
});

describe("versioning and idempotence", () => {
  it("refuses a version other than the one proposed", () => {
    expect(decide({ termsVersion: "conditions-of-business-part-c-v0" })).toMatchObject({
      kind: "refused",
      reason: "stale_terms",
    });
  });

  it("treats a second acceptance as already done", () => {
    const accepted = { ...proposed, acceptedAt: new Date("2026-10-20") };
    expect(decide({ agreement: accepted })).toEqual({ kind: "already_accepted" });
    expect(decide({ agreement: accepted, termsVersion: "other" })).toEqual({
      kind: "already_accepted",
    });
  });

  it("still refuses a role that may not accept, even once accepted", () => {
    const accepted = { ...proposed, acceptedAt: new Date("2026-10-20") };
    expect(decide({ agreement: accepted, actor: { role: "consignor" } })).toMatchObject({
      reason: "forbidden_role",
    });
  });
});

describe("cataloguing gate", () => {
  it("allows cataloguing only after acceptance", () => {
    expect(agreementAllowsCataloguing(null)).toBe(false);
    expect(agreementAllowsCataloguing({ acceptedAt: null })).toBe(false);
    expect(agreementAllowsCataloguing({ acceptedAt: new Date() })).toBe(true);
  });
});

describe("reminders", () => {
  const proposedAt = new Date("2026-10-01T09:00:00Z");
  const day = (n: number) => new Date(proposedAt.getTime() + n * 24 * 60 * 60 * 1000);
  const base = {
    proposedAt,
    acceptedAt: null,
    reminderDay3SentAt: null,
    reminderDay7SentAt: null,
  };

  it("sends nothing before day 3", () => {
    expect(dueAgreementReminder(base, day(2.9))).toBeNull();
  });

  it("sends the day 3 reminder once", () => {
    expect(dueAgreementReminder(base, day(3))).toBe(3);
    expect(dueAgreementReminder({ ...base, reminderDay3SentAt: day(3) }, day(5))).toBeNull();
  });

  it("sends the day 7 reminder once", () => {
    const after3 = { ...base, reminderDay3SentAt: day(3) };
    expect(dueAgreementReminder(after3, day(7))).toBe(7);
    expect(dueAgreementReminder({ ...after3, reminderDay7SentAt: day(7) }, day(30))).toBeNull();
  });

  it("sends only the latest when both are overdue", () => {
    expect(dueAgreementReminder(base, day(8))).toBe(7);
  });

  it("never reminds after acceptance", () => {
    expect(dueAgreementReminder({ ...base, acceptedAt: day(1) }, day(3))).toBeNull();
    expect(dueAgreementReminder({ ...base, acceptedAt: day(4) }, day(7))).toBeNull();
  });
});

describe("agreementAcceptanceHold", () => {
  it("holds nothing for an approved organisation or a person's own account", () => {
    expect(agreementAcceptanceHold({ kind: "organisation", status: "approved" })).toBeNull();
    // A personal account starts as a lead and is never under an organisation's review.
    expect(agreementAcceptanceHold({ kind: "individual", status: "lead" })).toBeNull();
  });

  it("names why an organisation's state holds accepting", () => {
    expect(agreementAcceptanceHold({ kind: "organisation", status: "restricted" })).toBe("paused");
    expect(agreementAcceptanceHold({ kind: "organisation", status: "under_review" })).toBe(
      "checking",
    );
    expect(agreementAcceptanceHold({ kind: "organisation", status: "connect_pending" })).toBe(
      "payouts",
    );
    expect(agreementAcceptanceHold({ kind: "organisation", status: "archived" })).toBe("closed");
    expect(agreementAcceptanceHold({ kind: "individual", status: "archived" })).toBe("closed");
  });
});

describe("sellingActionsHold", () => {
  it("is the same rule accepting follows, for every status", () => {
    for (const status of [
      "lead",
      "under_review",
      "connect_pending",
      "approved",
      "restricted",
      "rejected",
      "archived",
    ] as const) {
      const account = { kind: "organisation", status } as const;
      expect(sellingActionsHold(account)).toBe(agreementAcceptanceHold(account));
    }
  });

  it("pauses a restricted organisation and holds nothing for an approved one", () => {
    expect(sellingActionsHold({ kind: "organisation", status: "restricted" })).toBe("paused");
    expect(sellingActionsHold({ kind: "organisation", status: "approved" })).toBeNull();
  });
});
