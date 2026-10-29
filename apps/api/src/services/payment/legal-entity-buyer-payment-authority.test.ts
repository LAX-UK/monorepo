import type { LegalEntity, LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { LegalEntityBuyerPaymentAuthority } from "./legal-entity-buyer-payment-authority.js";

const ACCOUNT = "acc-1";

function authority(
  account: Pick<LegalEntity, "kind" | "status"> | null,
  role: LegalEntityMemberRole | null,
  isImpersonation = false,
) {
  return new LegalEntityBuyerPaymentAuthority({
    findById: vi.fn(async () => (account ? ({ id: ACCOUNT, ...account } as LegalEntity) : null)),
    findActiveMembership: vi.fn(async (userId: string) =>
      role
        ? { userId, legalEntityId: ACCOUNT, role, isPrimaryAdmin: false, isImpersonation }
        : null,
    ),
  });
}

const lot = (winnerId: string | null) => ({ id: "lot-1", winnerId, buyerLegalEntityId: ACCOUNT });
const organisation = { kind: "organisation", status: "approved" } as const;

describe("LegalEntityBuyerPaymentAuthority", () => {
  it("lets an organisation's finance member pay a colleague's win", async () => {
    const decision = await authority(organisation, "finance").canPay({ userId: "u" }, lot("w"));
    expect(decision).toEqual({ allowed: true });
  });

  it("lets a restricted organisation pay what it owes", async () => {
    const restricted = { kind: "organisation", status: "restricted" } as const;
    const decision = await authority(restricted, "owner").canPay({ userId: "u" }, lot("w"));
    expect(decision).toEqual({ allowed: true });
  });

  it("refuses a removed member (no active membership)", async () => {
    const decision = await authority(organisation, null).canPay({ userId: "w" }, lot("w"));
    expect(decision).toEqual({ allowed: false, reason: "not_member" });
  });

  it("refuses support staff viewing as the organisation", async () => {
    const decision = await authority(organisation, "owner", true).canPay({ userId: "u" }, lot("w"));
    expect(decision).toEqual({ allowed: false, reason: "not_payer" });
  });

  it("lets only the winner pay a personal purchase", async () => {
    const personal = { kind: "individual", status: "approved" } as const;
    expect(await authority(personal, "owner").canPay({ userId: "w" }, lot("w"))).toEqual({
      allowed: true,
    });
    expect(await authority(personal, "owner").canPay({ userId: "u" }, lot("w"))).toEqual({
      allowed: false,
      reason: "not_winner",
    });
  });

  it("refuses a lot without a winner or account", async () => {
    const decision = await authority(organisation, "finance").canPay({ userId: "u" }, lot(null));
    expect(decision).toEqual({ allowed: false, reason: "lot_not_won" });
  });
});
