import type { LegalEntity } from "@auction/types";
import { describe, expect, it } from "vitest";
import { toMemberLegalEntity } from "./member-legal-entity.js";

const entity: LegalEntity = {
  id: "e1",
  displayName: "Acme",
  legalName: "Acme Ltd",
  slug: "acme",
  kind: "organisation",
  subkind: "gallery",
  createdByUserId: "u-created",
  status: "restricted",
  statusChangedAt: new Date("2026-11-01T00:00:00Z"),
  statusChangedByUserId: "u-changed",
  statusReason: "staff note",
  stripeConnectAccountId: "acct_1",
  stripeCustomerId: "cus_1",
  stripeConnectChargesEnabled: true,
  stripeConnectPayoutsEnabled: true,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectRequirementsErrors: [],
  stripeConnectDisabledReason: null,
  xeroContactId: "xero_1",
  vatNumber: "GB1",
  marginSchemeEligible: true,
  isLaxManaged: false,
  platformFeeBps: 900,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-11-02T00:00:00Z"),
};

describe("toMemberLegalEntity", () => {
  it("keeps exactly the listed fields", () => {
    expect(Object.keys(toMemberLegalEntity(entity)).sort()).toEqual(
      [
        "id",
        "displayName",
        "legalName",
        "slug",
        "kind",
        "subkind",
        "status",
        "statusChangedAt",
        "stripeConnectChargesEnabled",
        "stripeConnectPayoutsEnabled",
        "stripeConnectRequirementsCurrentlyDue",
        "stripeConnectRequirementsErrors",
        "stripeConnectDisabledReason",
        "vatNumber",
        "isLaxManaged",
        "createdAt",
        "updatedAt",
        "stripeConnectAccountLinked",
      ].sort(),
    );
  });

  it("tells whether a payout account is linked without its id", () => {
    expect(toMemberLegalEntity(entity).stripeConnectAccountLinked).toBe(true);
    expect(
      toMemberLegalEntity({ ...entity, stripeConnectAccountId: null }).stripeConnectAccountLinked,
    ).toBe(false);
    expect(JSON.stringify(toMemberLegalEntity(entity))).not.toContain("acct_1");
  });
});
