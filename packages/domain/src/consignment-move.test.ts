import type {
  ItemSubmissionStatus,
  LegalEntityMemberRole,
  LegalEntityStatus,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type ConsignmentMoveFacts,
  consignmentMoveAgreementEffect,
  decideConsignmentMove,
} from "./consignment-move.js";

const personal = "11111111-1111-4111-8111-111111111111";
const gallery = "22222222-2222-4222-8222-222222222222";

function facts(overrides: {
  status?: ItemSubmissionStatus;
  sourceKind?: "individual" | "organisation";
  targetKind?: "individual" | "organisation";
  targetStatus?: LegalEntityStatus;
  role?: LegalEntityMemberRole | null;
  targetId?: string;
  accepted?: boolean | null;
}): ConsignmentMoveFacts {
  return {
    submission: {
      status: overrides.status ?? "under_review",
      legalEntityKind: overrides.sourceKind ?? "individual",
    },
    target: {
      legalEntityId: overrides.targetId ?? gallery,
      kind: overrides.targetKind ?? "organisation",
      status: overrides.targetStatus ?? "approved",
      sellerRole: overrides.role === undefined ? "admin" : overrides.role,
    },
    sourceLegalEntityId: personal,
    agreement:
      overrides.accepted === undefined || overrides.accepted === null
        ? null
        : { acceptedAt: overrides.accepted ? new Date("2026-10-01T10:00:00Z") : null },
  };
}

describe("decideConsignmentMove", () => {
  it.each(["draft", "submitted", "under_review", "changes_requested", "approved"] as const)(
    "moves a %s personal consignment to an organisation the seller may submit for",
    (status) => {
      expect(decideConsignmentMove(facts({ status }))).toEqual({ kind: "move", agreement: "none" });
    },
  );

  it.each(["owner", "admin", "consignor"] as const)("accepts a seller who is a %s", (role) => {
    expect(decideConsignmentMove(facts({ role })).kind).toBe("move");
  });

  it.each(["finance", "viewer", "buyer_agent"] as const)(
    "refuses when the seller is only a %s there",
    (role) => {
      expect(decideConsignmentMove(facts({ role }))).toMatchObject({
        kind: "refused",
        reason: "role_cannot_submit",
      });
    },
  );

  it("refuses an organisation the seller does not belong to", () => {
    expect(decideConsignmentMove(facts({ role: null }))).toMatchObject({ reason: "not_member" });
  });

  it("keeps a catalogued work with the account it was catalogued for", () => {
    expect(decideConsignmentMove(facts({ status: "converted" }))).toMatchObject({
      reason: "catalogued",
    });
  });

  it.each(["rejected", "withdrawn"] as const)("has nothing to move once %s", (status) => {
    expect(decideConsignmentMove(facts({ status }))).toMatchObject({ reason: "closed" });
  });

  it("moves only personal consignments, and only into organisations", () => {
    expect(decideConsignmentMove(facts({ sourceKind: "organisation" }))).toMatchObject({
      reason: "not_personal",
    });
    expect(decideConsignmentMove(facts({ targetKind: "individual" }))).toMatchObject({
      reason: "not_found",
    });
    expect(decideConsignmentMove(facts({ targetId: personal }))).toMatchObject({
      reason: "same_account",
    });
  });

  it("moves only drafts into an organisation LAX is still checking", () => {
    expect(
      decideConsignmentMove(facts({ status: "draft", targetStatus: "under_review" })).kind,
    ).toBe("move");
    expect(
      decideConsignmentMove(facts({ status: "submitted", targetStatus: "under_review" })),
    ).toMatchObject({ reason: "organisation_cannot_submit" });
    expect(
      decideConsignmentMove(facts({ status: "draft", targetStatus: "archived" })),
    ).toMatchObject({ reason: "organisation_cannot_submit" });
  });

  it("carries an open proposal and resets a personal acceptance", () => {
    expect(decideConsignmentMove(facts({ status: "approved", accepted: false }))).toEqual({
      kind: "move",
      agreement: "carried",
    });
    expect(decideConsignmentMove(facts({ status: "approved", accepted: true }))).toEqual({
      kind: "move",
      agreement: "reset",
    });
  });
});

describe("consignmentMoveAgreementEffect", () => {
  it("names what happens to the agreement", () => {
    expect(consignmentMoveAgreementEffect(null)).toBe("none");
    expect(consignmentMoveAgreementEffect({ acceptedAt: null })).toBe("carried");
    expect(consignmentMoveAgreementEffect({ acceptedAt: new Date() })).toBe("reset");
  });
});
