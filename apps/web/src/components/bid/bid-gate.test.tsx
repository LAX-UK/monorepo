import type { BidPolicy, BidPolicyContext, BidPolicyDecision } from "@/lib/bid/policies/types";
import type { Lot } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BidGate } from "./bid-gate";

const lot = {
  id: "l1",
  saleId: null,
  lotNumber: 1,
  sellerId: "s1",
  title: "Art",
  description: null,
  medium: null,
  dimensions: null,
  images: [],
  categoryId: "c",
  auctionType: "english" as const,
  startingPrice: "1",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "1",
  buyerPremiumRate: "0.25",
  minBidIncrement: "1",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 0,
  dutchLastDecrementAt: null,
  startTime: new Date(),
  endTime: new Date(),
  status: "active" as Lot["status"],
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {},
};

describe("BidGate", () => {
  it("renders children when decision is allow", () => {
    const allowOnly: BidPolicy[] = [{ id: "a", evaluate: () => ({ kind: "allow" }) }];
    render(
      <BidGate
        user={{ id: "u", email: "e", name: "n", role: "client" }}
        lot={lot}
        lotStatus="active"
        loginNextPath="/lot/test-lot/l1"
        policies={allowOnly}
      >
        {({ decision }) =>
          decision.kind === "allow" ? <button type="button">Bid here</button> : null
        }
      </BidGate>,
    );
    expect(screen.getByRole("button", { name: /bid here/i })).toBeInTheDocument();
  });

  it("renders block view from first blocking policy", () => {
    const policies: BidPolicy[] = [
      {
        id: "block",
        evaluate: (_ctx: BidPolicyContext): BidPolicyDecision => ({
          kind: "block",
          viewId: "test-block",
          presentation: {
            tone: "neutral",
            title: "Policy blocked",
            detail: "Test blocker",
          },
          render: () => <p>Policy blocked</p>,
        }),
      },
    ];
    render(
      <BidGate
        user={{ id: "u", email: "e", name: "n", role: "client" }}
        lot={lot}
        lotStatus="active"
        loginNextPath="/x"
        policies={policies}
      >
        {({ decision }) => (decision.kind === "block" ? decision.render() : <span>child</span>)}
      </BidGate>,
    );
    expect(screen.getByText("Policy blocked")).toBeInTheDocument();
  });
});
