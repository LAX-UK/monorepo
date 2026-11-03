import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import type { LotCardStateRead } from "@/lib/lot-card/use-lot-card-state";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() => ({
  value: { signedIn: false, loading: false, state: null } as LotCardStateRead,
}));
vi.mock("@/lib/lot-card/use-lot-card-state", () => ({ useLotCardState: () => read.value }));

function draw(value: LotCardStateRead) {
  read.value = value;
  return render(<LotCardBidderState lotId="lot-1" />);
}

describe("LotCardBidderState", () => {
  it("shows a visitor nothing at all", () => {
    draw({ signedIn: false, loading: false, state: null });
    expect(screen.queryByTestId("lot-card-bidder-state")).toBeNull();
  });

  it("reserves the row for a signed-in viewer while the reading loads", () => {
    draw({ signedIn: true, loading: true, state: null });
    expect(screen.getByTestId("lot-card-bidder-state")).toHaveAttribute("aria-busy", "true");
  });

  it("leaves the row empty for a lot with no bid", () => {
    draw({ signedIn: true, loading: false, state: null });
    expect(screen.getByTestId("lot-card-bidder-state")).toBeEmptyDOMElement();
  });

  it.each([
    ["leading", "You're leading"],
    ["outbid", "Outbid"],
    ["maximum_set", "Maximum set"],
  ] as const)("says %s in words", (position, text) => {
    draw({
      signedIn: true,
      loading: false,
      state: { lotId: "lot-1", position, nextBidAmount: null },
    });
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
