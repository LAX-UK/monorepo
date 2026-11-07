import { legalEntityStatuses } from "@auction/types";
import type { LegalEntityStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type OrganisationAbilityKey,
  type OrganisationRecoveryKind,
  organisationAbilities,
  organisationRecoveryKind,
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
