import { evaluateBidPolicies } from "@/lib/bid/evaluate-bid-policies";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { biddingAccountPolicy } from "./bidding-account.policy";
import { defaultBidPolicies } from "./index";
import { policyContext } from "./policy-test-context";

vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  switchActingLegalEntity: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("biddingAccountPolicy", () => {
  it("allows personal bidding and allowed organisation accounts", () => {
    expect(
      biddingAccountPolicy.evaluate(
        policyContext({ biddingAccount: { kind: "personal", hasOrganisations: true } }),
      ),
    ).toEqual({ kind: "allow" });
    expect(
      biddingAccountPolicy.evaluate(
        policyContext({
          biddingAccount: {
            kind: "organisation",
            name: "Northbank Gallery",
            allowed: true,
            bidLimit: null,
          },
        }),
      ),
    ).toEqual({ kind: "allow" });
  });

  it("explains a refusal calmly, hides the form and offers the personal account", () => {
    const decision = biddingAccountPolicy.evaluate(
      policyContext({
        biddingAccount: {
          kind: "organisation",
          name: "Northbank Gallery",
          allowed: false,
          reason: "role_cannot_bid",
          canSwitchToPersonal: true,
        },
      }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.presentation.title).toBe("You can't bid for Northbank Gallery");
    expect(decision.presentation.detail).toBe(
      "Only owners, admins and authorised buyers can bid for Northbank Gallery. You can still bid in your own name.",
    );
    expect(decision.presentation.preview).toBeUndefined();
    render(decision.presentation.content as ReactElement);
    expect(screen.getByRole("button", { name: "Switch to personal" })).toBeTruthy();
  });

  it.each([
    [
      "documents_under_review",
      "Bidding for Northbank Gallery isn't open yet",
      "Bidding for Northbank Gallery opens once we've checked its documents. You can still bid in your own name.",
    ],
    [
      "documents_requested",
      "Bidding for Northbank Gallery isn't open yet",
      "It opens once Northbank Gallery has sent its documents and we've checked them. You can still bid in your own name.",
    ],
    [
      "restricted",
      "Bidding for Northbank Gallery is paused",
      "Contact us to find out more. You can still bid in your own name.",
    ],
  ] as const)("says why bidding is closed while the organisation is %s", (state, title, detail) => {
    const decision = biddingAccountPolicy.evaluate(
      policyContext({
        biddingAccount: {
          kind: "organisation",
          name: "Northbank Gallery",
          allowed: false,
          reason: "organisation_state",
          state,
          canSwitchToPersonal: true,
        },
      }),
    );
    expect(decision.kind).toBe("block");
    if (decision.kind !== "block") return;
    expect(decision.presentation).toMatchObject({ tone: "info", title, detail });
    expect(`${decision.presentation.title} ${decision.presentation.detail}`).not.toMatch(
      /can bid now/i,
    );
  });

  it("leaves out the switch when there is no personal account", () => {
    const decision = biddingAccountPolicy.evaluate(
      policyContext({
        biddingAccount: {
          kind: "organisation",
          name: "Northbank Gallery",
          allowed: false,
          reason: "authorisation_required",
          canSwitchToPersonal: false,
        },
      }),
    );
    expect(decision.kind === "block" && decision.presentation.content).toBeFalsy();
  });

  it("tells a buyer agent when the next bid is above their limit", () => {
    const decision = biddingAccountPolicy.evaluate(
      policyContext({
        minNextBid: 11000,
        biddingAccount: {
          kind: "organisation",
          name: "Northbank Gallery",
          allowed: true,
          bidLimit: 10000,
        },
      }),
    );
    expect(decision).toMatchObject({
      kind: "block",
      viewId: "bidding-account-over-limit",
      presentation: { title: "This lot is above your limit" },
    });
  });

  it("runs before identity checks, so the account problem is the one shown", () => {
    const decision = evaluateBidPolicies(
      defaultBidPolicies,
      policyContext({
        kycBidGate: { requiresKyc: true },
        biddingAccount: {
          kind: "organisation",
          name: "Northbank Gallery",
          allowed: false,
          reason: "role_cannot_bid",
          canSwitchToPersonal: true,
        },
      }),
    );
    expect(decision).toMatchObject({ kind: "block", viewId: "bidding-account-not-allowed" });
  });
});
