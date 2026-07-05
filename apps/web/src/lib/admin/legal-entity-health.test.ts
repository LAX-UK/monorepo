import type { LegalEntity } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildLegalEntityHealthVM } from "./legal-entity-health";

function minimalEntity(overrides: Partial<LegalEntity> = {}): LegalEntity {
  return {
    id: "le-1",
    displayName: "Test Org",
    legalName: "Test Org Ltd",
    slug: null,
    kind: "organisation",
    subkind: "gallery",
    createdByUserId: "user-1",
    status: "approved",
    statusChangedAt: null,
    statusChangedByUserId: null,
    stripeConnectAccountId: "acct_123",
    stripeCustomerId: null,
    stripeConnectChargesEnabled: true,
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [],
    stripeConnectRequirementsErrors: [],
    stripeConnectDisabledReason: null,
    xeroContactId: null,
    vatNumber: null,
    marginSchemeEligible: false,
    isLaxManaged: false,
    platformFeeBps: 500,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildLegalEntityHealthVM", () => {
  it("reports ready when approved and Connect configured", () => {
    const vm = buildLegalEntityHealthVM(minimalEntity());
    expect(vm.canPublish).toBe(true);
    expect(vm.canReceivePayouts).toBe(true);
    expect(vm.blockers).toHaveLength(0);
  });

  it("includes lifecycle blocker when not approved", () => {
    const vm = buildLegalEntityHealthVM(
      minimalEntity({ status: "under_review", stripeConnectAccountId: null }),
    );
    expect(vm.canPublish).toBe(false);
    expect(vm.blockers.some((b) => b.key === "lifecycle_status")).toBe(true);
  });

  it("includes status reason in blockers", () => {
    const vm = buildLegalEntityHealthVM(
      minimalEntity({
        status: "restricted",
        statusReason: "Compliance review hold",
        stripeConnectPayoutsEnabled: false,
      }),
    );
    expect(vm.statusReason).toBe("Compliance review hold");
    expect(vm.blockers.some((b) => b.key === "status_reason")).toBe(true);
  });

  it("treats LAX-managed entities as payout-ready without Connect", () => {
    const vm = buildLegalEntityHealthVM(
      minimalEntity({
        isLaxManaged: true,
        stripeConnectAccountId: null,
        stripeConnectPayoutsEnabled: false,
      }),
    );
    expect(vm.canReceivePayouts).toBe(true);
    expect(vm.canPublish).toBe(true);
  });
});
