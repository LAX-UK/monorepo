import { buildLegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import type { LegalEntity } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildLegalEntityOverviewViewModel } from "./legal-entity-overview.vm";

const baseEntity = {
  id: "le_1",
  displayName: "Test Gallery",
  legalName: "Test Gallery Ltd",
  kind: "organization",
  subkind: "gallery",
  status: "approved",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
  createdByUserId: "usr_1",
  isLaxManaged: false,
  platformFeeBps: 500,
  stripeConnectAccountId: null,
  stripeConnectPayoutsEnabled: false,
  stripeConnectChargesEnabled: false,
} as unknown as LegalEntity;

describe("buildLegalEntityOverviewViewModel", () => {
  it("maps entity health into KPI tiles and blocker rows", () => {
    const health = buildLegalEntityHealthVM(baseEntity);
    const vm = buildLegalEntityOverviewViewModel({
      entity: baseEntity,
      health,
      pendingDocCount: 2,
    });

    expect(vm.kpiTiles).toHaveLength(6);
    expect(vm.kpiTiles.find((tile) => tile.id === "documents")?.value).toBe("2");
    expect(vm.blockerRows.length).toBe(health.blockers.length);
  });
});
