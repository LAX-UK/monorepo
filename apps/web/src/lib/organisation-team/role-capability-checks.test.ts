import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { canManagePurchaseDocuments, countsAsBiddingManager } from "./role-capability-checks";

const ROLES: LegalEntityMemberRole[] = [
  "owner",
  "admin",
  "finance",
  "consignor",
  "viewer",
  "buyer_agent",
];

function allowed(check: (role: LegalEntityMemberRole) => boolean): LegalEntityMemberRole[] {
  return ROLES.filter(check);
}

describe("role capability checks per call site", () => {
  it("purchase documents are managed by owners and admins only", () => {
    expect(allowed(canManagePurchaseDocuments)).toEqual(["owner", "admin"]);
  });

  it("the bidding managers count includes owners and admins only", () => {
    expect(allowed(countsAsBiddingManager)).toEqual(["owner", "admin"]);
  });
});
