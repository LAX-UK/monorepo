import type { LegalEntitySummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import { EnquirerOrganisationsService } from "./enquirer-organisations.service.js";

const summary = (over: Partial<LegalEntitySummary>): LegalEntitySummary =>
  ({
    id: "e1",
    displayName: "Marlow Collection Ltd",
    kind: "organisation",
    subkind: "company",
    status: "active",
    role: "owner",
    isPrimaryAdmin: true,
    ...over,
  }) as LegalEntitySummary;

const service = (rows: LegalEntitySummary[]) =>
  new EnquirerOrganisationsService({
    memberships: { listActiveMembershipsForUser: async () => rows },
  });

describe("EnquirerOrganisationsService", () => {
  it("lists the organisations a person belongs to, with what each role may enquire", async () => {
    const result = await service([
      summary({ id: "a", displayName: "Marlow Collection Ltd", role: "owner" }),
      summary({ id: "b", displayName: "Hale Advisory", role: "consignor" }),
    ]).listFor("user-1");
    expect(result).toEqual([
      { id: "a", name: "Marlow Collection Ltd", role: "owner", canBuy: true, canSell: true },
      { id: "b", name: "Hale Advisory", role: "consignor", canBuy: false, canSell: true },
    ]);
  });

  it("leaves out the person's own account, and organisations they cannot enquire for at all", async () => {
    const result = await service([
      summary({ id: "me", kind: "individual", displayName: "Charlotte Hale" }),
      summary({ id: "v", role: "viewer", displayName: "Viewer only" }),
    ]).listFor("user-1");
    expect(result).toEqual([]);
  });

  it("returns nothing for a person with no organisations", async () => {
    expect(await service([]).listFor("user-1")).toEqual([]);
  });
});
