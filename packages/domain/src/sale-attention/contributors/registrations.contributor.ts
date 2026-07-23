import { SALES_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const registrationsContributor: SaleAttentionContributor = {
  id: "registrations",
  requiredCapability: SALES_ACCESS,
  needs: ["registrations", "pendingRegistrationCount"],
  appliesTo: (status) => status === "scheduled" || status === "active",
  evaluate(signals) {
    const items = [];
    const regs = signals.registrations ?? [];
    const pending = regs.filter((r) => r.status === "pending");
    const awaitingPaddle = regs.filter((r) => r.status === "approved" && r.paddleNumber == null);
    const kycBlocked = regs.filter(
      (r) => r.status === "approved" && r.kycStatus != null && r.kycStatus !== "approved",
    );

    if (pending.length > 0) {
      items.push({
        id: "pending-regs",
        kind: "pending_registrations" as const,
        category: "Bidders" as const,
        severity: "critical" as const,
        count: pending.length,
        target: { tab: "registrations" as const },
      });
    } else if ((signals.pendingRegistrationCount ?? 0) > 0) {
      items.push({
        id: "pending-regs",
        kind: "pending_registrations" as const,
        category: "Bidders" as const,
        severity: "critical" as const,
        count: signals.pendingRegistrationCount ?? 0,
        target: { tab: "registrations" as const },
      });
    }

    if (awaitingPaddle.length > 0) {
      items.push({
        id: "awaiting-paddle",
        kind: "awaiting_paddle" as const,
        category: "Bidders" as const,
        severity: "high" as const,
        count: awaitingPaddle.length,
        target: { tab: "registrations" as const },
      });
    }

    if (kycBlocked.length > 0) {
      items.push({
        id: "kyc-blocked",
        kind: "kyc_blocked" as const,
        category: "Bidders" as const,
        severity: "high" as const,
        count: kycBlocked.length,
        target: { tab: "registrations" as const },
      });
    }

    return items;
  },
};
