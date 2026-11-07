import { legalEntityStatuses } from "@auction/types";
import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type OrganisationAbilityKey,
  type OrganisationRecoveryKind,
  organisationAbilities,
  organisationRecoveryKind,
  organisationReviewOverdue,
} from "./organisation-recovery.js";

const KIND: Record<LegalEntityStatus, OrganisationRecoveryKind | null> = {
  lead: "documents_requested",
  docs_requested: "documents_requested",
  docs_received: "documents_under_review",
  under_review: "documents_under_review",
  connect_pending: null,
  approved: null,
  restricted: "restricted",
  rejected: "not_approved",
  archived: null,
};

describe("organisationRecoveryKind", () => {
  it.each(legalEntityStatuses)("%s", (status) => {
    expect(organisationRecoveryKind(status)).toBe(KIND[status]);
  });
});

describe("organisationAbilities", () => {
  const open = (status: LegalEntityStatus): OrganisationAbilityKey[] =>
    organisationAbilities(status)
      .filter((ability) => ability.open)
      .map((ability) => ability.key);

  it("lists history, paying and trading in a fixed order", () => {
    expect(organisationAbilities("restricted").map((a) => a.key)).toEqual([
      "history",
      "pay",
      "trade",
    ]);
  });

  it("lets a restricted organisation read its history and pay, but not trade", () => {
    expect(open("restricted")).toEqual(["history", "pay"]);
  });

  it("keeps history only while documents are asked for or checked, and after a refusal", () => {
    for (const status of ["docs_requested", "docs_received", "under_review", "rejected"] as const) {
      expect(open(status)).toEqual(["history"]);
    }
  });

  it("opens everything for an approved organisation", () => {
    expect(open("approved")).toEqual(["history", "pay", "trade"]);
  });
});

describe("organisationReviewOverdue", () => {
  // Wed 4 Nov 2026 10:00 London is the start; three working days of 9 hours is 27 office hours.
  const received = new Date("2026-11-04T10:00:00Z");

  it("is not overdue the same day or the next", () => {
    expect(organisationReviewOverdue(received, new Date("2026-11-04T17:00:00Z"))).toBe(false);
    expect(organisationReviewOverdue(received, new Date("2026-11-05T12:00:00Z"))).toBe(false);
  });

  it("is overdue once three working days have passed", () => {
    expect(organisationReviewOverdue(received, new Date("2026-11-09T12:00:00Z"))).toBe(true);
  });

  it("does not count the weekend", () => {
    // Friday 6th afternoon to Sunday: only a little over two working days have gone.
    expect(organisationReviewOverdue(received, new Date("2026-11-08T12:00:00Z"))).toBe(false);
    expect(organisationReviewOverdue(received, new Date("2026-11-09T09:30:00Z"))).toBe(false);
  });

  it("is not overdue before it was received", () => {
    expect(organisationReviewOverdue(received, new Date("2026-11-01T00:00:00Z"))).toBe(false);
  });
});
