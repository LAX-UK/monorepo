import { type LegalEntityMemberRole, legalEntityMemberRoles } from "@auction/types";
import { describe, expect, it } from "vitest";
import { accountBidScope, accountPurchaseScope } from "./account-buying-scope.js";
import {
  type BuyerPaymentAuthorityInput,
  type PaymentAuthorityDecision,
  type PaymentRefusal,
  buyerPaymentAuthority,
  purchasePaymentRole,
} from "./buyer-payment-authority.js";

const PAYER = "user-payer";
const OTHER = "user-other";

const allowed: PaymentAuthorityDecision = { allowed: true };
const refused = (reason: PaymentRefusal): PaymentAuthorityDecision => ({ allowed: false, reason });

/** Who pays an organisation's purchase, by role, when someone else won it. */
const ORGANISATION_PAYERS: Record<LegalEntityMemberRole, PaymentAuthorityDecision> = {
  owner: allowed,
  admin: allowed,
  finance: allowed,
  buyer_agent: refused("not_payer"),
  consignor: refused("not_payer"),
  viewer: refused("not_payer"),
  specialist: refused("not_payer"),
  staff: refused("not_payer"),
};

function organisationLot(
  role: LegalEntityMemberRole | null,
  options: { winner?: string | null; impersonation?: boolean } = {},
): BuyerPaymentAuthorityInput {
  return {
    payerUserId: PAYER,
    lot: {
      winnerId: options.winner === undefined ? OTHER : options.winner,
      buyerAccountKind: "organisation",
    },
    membership: role ? { role, isImpersonation: options.impersonation } : null,
  };
}

describe("buyerPaymentAuthority: an organisation's purchase", () => {
  it.each(legalEntityMemberRoles)("an active %s, when a colleague won", (role) => {
    expect(buyerPaymentAuthority(organisationLot(role))).toEqual(ORGANISATION_PAYERS[role]);
  });

  it.each(legalEntityMemberRoles)("an active %s, when they won it themselves", (role) => {
    expect(buyerPaymentAuthority(organisationLot(role, { winner: PAYER }))).toEqual(
      ORGANISATION_PAYERS[role],
    );
  });

  it("refuses a removed member, even the one who won", () => {
    expect(buyerPaymentAuthority(organisationLot(null))).toEqual(refused("not_member"));
    expect(buyerPaymentAuthority(organisationLot(null, { winner: PAYER }))).toEqual(
      refused("not_member"),
    );
  });

  it("refuses a platform admin viewing as the organisation", () => {
    expect(buyerPaymentAuthority(organisationLot("owner", { impersonation: true }))).toEqual(
      refused("not_payer"),
    );
  });

  it("refuses a lot without a winner", () => {
    expect(buyerPaymentAuthority(organisationLot("finance", { winner: null }))).toEqual(
      refused("lot_not_won"),
    );
  });
});

describe("buyerPaymentAuthority: a personal purchase", () => {
  const personal = (winner: string | null): BuyerPaymentAuthorityInput => ({
    payerUserId: PAYER,
    lot: { winnerId: winner, buyerAccountKind: "individual" },
    membership: { role: "owner" },
  });

  it.each([
    ["the winner pays", PAYER, allowed],
    ["anyone else is refused", OTHER, refused("not_winner")],
    ["a lot without a winner is refused", null, refused("lot_not_won")],
  ] as const)("%s", (_name, winner, expected) => {
    expect(buyerPaymentAuthority(personal(winner))).toEqual(expected);
  });
});

describe("purchasePaymentRole", () => {
  it.each([
    ["finance pays a colleague's win", "finance", OTHER, "payer"],
    ["an owner pays their own win", "owner", PAYER, "payer"],
    ["the buyer agent who won is told", "buyer_agent", PAYER, "informed"],
    ["another buyer agent has no part", "buyer_agent", OTHER, "none"],
    ["a viewer has no part", "viewer", OTHER, "none"],
  ] as const)("%s", (_name, role, winner, expected) => {
    expect(purchasePaymentRole(organisationLot(role, { winner }))).toBe(expected);
  });

  it("a removed member who won is still told, never asked to pay", () => {
    expect(purchasePaymentRole(organisationLot(null, { winner: PAYER }))).toBe("informed");
  });
});

describe("buying record scopes", () => {
  const BIDS: Record<LegalEntityMemberRole, string | null> = {
    owner: "all",
    admin: "all",
    buyer_agent: "own",
    finance: null,
    consignor: null,
    viewer: null,
    specialist: null,
    staff: null,
  };
  const PURCHASES: Record<LegalEntityMemberRole, string | null> = {
    owner: "all",
    admin: "all",
    finance: "all",
    buyer_agent: "own",
    consignor: null,
    viewer: null,
    specialist: null,
    staff: null,
  };

  it.each(legalEntityMemberRoles)("%s reads the bids and purchases the table gives", (role) => {
    expect(accountBidScope({ role })).toBe(BIDS[role]);
    expect(accountPurchaseScope({ role })).toBe(PURCHASES[role]);
  });

  it("lets an impersonating admin read what the role reads", () => {
    expect(accountBidScope({ role: "owner", isImpersonation: true })).toBe("all");
    expect(accountPurchaseScope({ role: "finance", isImpersonation: true })).toBe("all");
  });
});
