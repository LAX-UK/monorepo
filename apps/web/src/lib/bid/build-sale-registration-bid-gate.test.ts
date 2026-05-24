import { describe, expect, it } from "vitest";
import { buildSaleRegistrationBidGate } from "./build-sale-registration-bid-gate";

const agentActing = {
  id: "le-agent",
  displayName: "Agency Ltd",
  kind: "organisation" as const,
  subkind: "dealer" as const,
  status: "approved" as const,
  role: "buyer_agent" as const,
  isPrimaryAdmin: false,
};

const personalActing = {
  id: "le-personal",
  displayName: "Jane Doe",
  kind: "individual" as const,
  subkind: "private_collector" as const,
  status: "approved" as const,
  role: "owner" as const,
  isPrimaryAdmin: true,
};

describe("buildSaleRegistrationBidGate", () => {
  it("returns null for onsite sales", () => {
    expect(
      buildSaleRegistrationBidGate({
        saleId: "sale-1",
        saleDeliveryMode: "onsite",
        saleStatus: "active",
        acting: agentActing,
        memberships: [agentActing],
        myRegistrations: [],
        kycApproved: true,
      }),
    ).toBeNull();
  });

  it("returns null when acting as personal entity", () => {
    expect(
      buildSaleRegistrationBidGate({
        saleId: "sale-1",
        saleDeliveryMode: "online",
        saleStatus: "active",
        acting: personalActing,
        memberships: [personalActing, agentActing],
        myRegistrations: [],
        kycApproved: true,
      }),
    ).toBeNull();
  });

  it("requires registration when acting as buyer_agent without approval", () => {
    const gate = buildSaleRegistrationBidGate({
      saleId: "sale-1",
      saleDeliveryMode: "online",
      saleStatus: "active",
      acting: agentActing,
      memberships: [agentActing],
      myRegistrations: [],
      kycApproved: true,
    });
    expect(gate?.requiresRegistration).toBe(true);
    expect(gate?.registrationStatus).toBeNull();
  });

  it("allows when buyer_agent registration is approved", () => {
    const gate = buildSaleRegistrationBidGate({
      saleId: "sale-1",
      saleDeliveryMode: "online",
      saleStatus: "active",
      acting: agentActing,
      memberships: [agentActing],
      myRegistrations: [{ buyerLegalEntityId: "le-agent", status: "approved" }],
      kycApproved: true,
    });
    expect(gate?.registrationStatus).toBe("approved");
    expect(gate?.actingEntityId).toBe("le-agent");
    expect(gate?.approvedBidLimit).toBeNull();
  });

  it("parses approved bid limit from registration row", () => {
    const gate = buildSaleRegistrationBidGate({
      saleId: "sale-1",
      saleDeliveryMode: "online",
      saleStatus: "active",
      acting: agentActing,
      memberships: [agentActing],
      myRegistrations: [
        { buyerLegalEntityId: "le-agent", status: "approved", bidLimit: "50000.00" },
      ],
      kycApproved: true,
    });
    expect(gate?.approvedBidLimit).toBe(50000);
  });
});
