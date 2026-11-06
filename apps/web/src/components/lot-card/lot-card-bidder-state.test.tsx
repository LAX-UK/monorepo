import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import type { LotCardStateRead } from "@/lib/lot-card/use-lot-card-state";
import type { LotLifecycleKind } from "@auction/domain";
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

  describe("the outbid bid button", () => {
    const outbid = (nextBidAmount: string | null): LotCardStateRead => ({
      signedIn: true,
      loading: false,
      state: { lotId: "lot-1", position: "outbid", nextBidAmount },
    });
    const card = (props: { lifecycle?: LotLifecycleKind; lotHref?: string }) => {
      const { lotHref = "/lot/night-piece/lot-1", ...rest } = props;
      return render(
        <LotCardBidderState lotId="lot-1" lotTitle="Night piece" lotHref={lotHref} {...rest} />,
      );
    };

    it("offers the next bid and opens the lot page with the bid dialog open", () => {
      read.value = outbid("1250.00");
      card({});
      const link = screen.getByRole("link", { name: "Bid £1,250 on Night piece" });
      expect(link).toHaveAttribute("href", "/lot/night-piece/lot-1?bid=open");
    });

    it("keeps the catalogue's own query on the way to the lot", () => {
      read.value = outbid("1250.00");
      card({ lotHref: "/lot/night-piece/lot-1?sale=s1" });
      expect(screen.getByRole("link", { name: /^Bid £1,250/ })).toHaveAttribute(
        "href",
        "/lot/night-piece/lot-1?sale=s1&bid=open",
      );
    });

    it.each(["endedSold", "endedNoSale", "cancelled", "withdrawn"] as const)(
      "offers nothing on a lot in the %s state",
      (lifecycle) => {
        read.value = outbid("1250.00");
        card({ lifecycle });
        expect(screen.getByText("Outbid")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /^Bid/ })).toBeNull();
      },
    );

    it("still offers the bid when the close has been extended", () => {
      read.value = outbid("1250.00");
      card({ lifecycle: "extended" });
      expect(screen.getByRole("link", { name: /^Bid £1,250/ })).toBeInTheDocument();
    });

    it("offers nothing when the server gave no next bid", () => {
      read.value = outbid(null);
      card({});
      expect(screen.queryByRole("link", { name: /^Bid/ })).toBeNull();
    });

    it("offers nothing to a visitor", () => {
      read.value = { signedIn: false, loading: false, state: null };
      card({});
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("offers nothing to someone who is leading", () => {
      read.value = {
        signedIn: true,
        loading: false,
        state: { lotId: "lot-1", position: "leading", nextBidAmount: "1250.00" },
      };
      card({});
      expect(screen.queryByRole("link", { name: /^Bid/ })).toBeNull();
    });
  });
});
