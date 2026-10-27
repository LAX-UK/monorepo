import type { BuyerAgentAuthorisationRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { BidAuthorityService } from "./bid-authority.service.js";

const NOW = new Date("2026-10-27T12:00:00Z");
const query = { userId: "user-1", legalEntityId: "le-1", saleId: "sale-1" };

function service(role: LegalEntityMemberRole | null, rows: BuyerAgentAuthorisationRow[] = []) {
  const findActiveAuthorisations = vi.fn().mockResolvedValue(rows);
  const svc = new BidAuthorityService(
    { findActiveMemberRole: vi.fn().mockResolvedValue(role) },
    { findActiveAuthorisations },
    () => NOW,
  );
  return { svc, findActiveAuthorisations };
}

describe("BidAuthorityService", () => {
  it("lets an owner bid without reading authorisations", async () => {
    const { svc, findActiveAuthorisations } = service("owner");
    await expect(svc.resolve(query)).resolves.toMatchObject({ allowed: true, role: "owner" });
    expect(findActiveAuthorisations).not.toHaveBeenCalled();
  });

  it("refuses a viewer without reading authorisations", async () => {
    const { svc, findActiveAuthorisations } = service("viewer");
    await expect(svc.resolve(query)).resolves.toEqual({
      allowed: false,
      role: "viewer",
      reason: "role_cannot_bid",
    });
    expect(findActiveAuthorisations).not.toHaveBeenCalled();
  });

  it("asks for a buyer agent's active authorisations at this moment and sale", async () => {
    const { svc, findActiveAuthorisations } = service("buyer_agent", [
      { saleId: "sale-1", bidLimit: "2500.00" },
    ]);
    await expect(svc.resolve(query)).resolves.toEqual({
      allowed: true,
      role: "buyer_agent",
      viaAuthorisation: true,
      bidLimit: 2500,
    });
    expect(findActiveAuthorisations).toHaveBeenCalledWith({
      legalEntityId: "le-1",
      userId: "user-1",
      saleId: "sale-1",
      now: NOW,
    });
  });

  it("refuses a buyer agent whose authorisations have all expired or been revoked", async () => {
    const { svc } = service("buyer_agent", []);
    await expect(svc.resolve(query)).resolves.toMatchObject({
      allowed: false,
      reason: "authorisation_required",
    });
  });

  it("treats a blank limit as no limit", async () => {
    const { svc } = service("buyer_agent", [{ saleId: null, bidLimit: null }]);
    await expect(svc.resolve(query)).resolves.toMatchObject({ allowed: true, bidLimit: null });
  });

  it("refuses someone who is not a member", async () => {
    const { svc } = service(null);
    await expect(svc.resolve(query)).resolves.toMatchObject({
      allowed: false,
      reason: "not_member",
    });
  });
});
