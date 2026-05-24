import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { LegalEntityMemberRole, LegalEntitySummary } from "@auction/types";

type SaleRegistrationRow = {
  buyerLegalEntityId: string;
  status: string;
  bidLimit?: string | null;
};

type Input = {
  saleId: string | null | undefined;
  saleDeliveryMode: "online" | "onsite" | undefined;
  saleStatus: string | undefined;
  acting: LegalEntitySummary | null;
  memberships: LegalEntitySummary[];
  myRegistrations: SaleRegistrationRow[];
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
};

function toBuyerEntities(
  memberships: LegalEntitySummary[],
): SaleRegistrationBidGateContext["buyerEntities"] {
  return memberships
    .filter((m) => m.status === "approved" || m.status === "restricted")
    .map((m) => ({
      id: m.id,
      displayName: m.displayName,
      memberRole: m.role,
    }));
}

function parseBidLimit(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Derives bid-gate context when the user is acting as buyer_agent on an online sale. */
export function buildSaleRegistrationBidGate(input: Input): SaleRegistrationBidGateContext | null {
  const {
    saleId,
    saleDeliveryMode,
    saleStatus,
    acting,
    memberships,
    myRegistrations,
    kycApproved,
    kycFeedback = null,
  } = input;

  if (
    !saleId ||
    saleDeliveryMode !== "online" ||
    (saleStatus !== "scheduled" && saleStatus !== "active")
  ) {
    return null;
  }

  const buyerEntities = toBuyerEntities(memberships);
  const agentEntities = buyerEntities.filter((e) => e.memberRole === "buyer_agent");
  if (agentEntities.length === 0) {
    return null;
  }

  const actingRole = acting?.role as LegalEntityMemberRole | undefined;
  const requiresRegistration = actingRole === "buyer_agent";
  if (!requiresRegistration) {
    return null;
  }

  const actingEntityId = acting?.id ?? null;
  const regRow =
    actingEntityId != null
      ? myRegistrations.find((r) => r.buyerLegalEntityId === actingEntityId)
      : undefined;
  const registrationStatus = regRow?.status ?? null;
  const approvedBidLimit =
    registrationStatus === "approved" ? parseBidLimit(regRow?.bidLimit) : null;

  return {
    saleId,
    requiresRegistration: true,
    actingEntityId,
    registrationStatus,
    approvedBidLimit,
    buyerEntities,
    myRegistrations,
    kycApproved,
    kycFeedback,
  };
}
