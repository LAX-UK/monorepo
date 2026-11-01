import { LotPriceBlockView } from "@/components/lot-page/lot-price-block";
import { type LotPageViewInput, buildLotPageView } from "@/lib/lot-page/build-lot-page-view";
import { type LotViewerView, NO_LOT_VIEWER } from "@/lib/lot-page/lot-viewer";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const NOW = new Date("2026-11-01T12:00:00Z");

function input(over: Partial<LotPageViewInput> = {}): LotPageViewInput {
  return {
    lifecycle: "live",
    now: NOW,
    msLeft: 62 * 3_600_000,
    startsAt: "2026-10-30T18:00:00Z",
    endsAt: "2026-11-03T21:06:00Z",
    amounts: { starting: "4200.00", current: "7000.00", hammer: null, soldForWithPremium: null },
    estimate: { low: "6000", high: "9000" },
    bidCount: 6,
    reserve: "met",
    nextBid: "7250.00",
    extendedByMs: null,
    saleroom: null,
    signedIn: true,
    viewer: { ...NO_LOT_VIEWER, registration: "approved" },
    ...over,
  };
}

const actions = {
  bidEntry: <button type="button">Bid entry</button>,
  artist: { id: "a1", name: "Anna Whitcombe" },
  signedIn: true,
  lotPath: "/lot/x/1",
  saleHref: "/sales/modern",
  saleLabel: "Back to the sale",
};

function draw(over: Partial<LotPageViewInput>) {
  return render(<LotPriceBlockView view={buildLotPageView(input(over))} actions={actions} />);
}

function viewer(over: Partial<LotViewerView>): LotViewerView {
  return { ...NO_LOT_VIEWER, registration: "approved", ...over };
}

describe("LotPriceBlockView", () => {
  it("live: the figure, the clock and the bid entry", () => {
    draw({});
    expect(screen.getByText("Current bid")).toBeInTheDocument();
    expect(screen.getByText("£7,000")).toBeInTheDocument();
    expect(screen.getByText("Time left")).toBeInTheDocument();
    expect(screen.getByText("2 days 14 hours")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bid entry" })).toBeInTheDocument();
  });

  it("closing soon words the clock differently from calm", () => {
    draw({ msLeft: 42 * 60_000 });
    expect(screen.getByText("Closing soon")).toBeInTheDocument();
    expect(screen.queryByText("Time left")).toBeNull();
  });

  it("outbid names the position and the next bid", () => {
    draw({ viewer: viewer({ position: "outbid" }) });
    expect(screen.getByText("You've been outbid")).toBeInTheDocument();
    expect(screen.getByText("The next bid is £7,250")).toBeInTheDocument();
  });

  it("sold: price with premium, hammer beneath, alerts instead of a bid entry", () => {
    draw({
      lifecycle: "endedSold",
      msLeft: null,
      amounts: {
        starting: "4200.00",
        current: "7000.00",
        hammer: "7000.00",
        soldForWithPremium: "8750.00",
      },
    });
    expect(screen.getByText("Sold for")).toBeInTheDocument();
    expect(screen.getByText("£8,750")).toBeInTheDocument();
    expect(screen.getByText("Hammer £7,000 plus 25% buyer's premium")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bid entry" })).toBeNull();
    expect(screen.getByRole("button", { name: /alerts for Anna Whitcombe/ })).toBeInTheDocument();
  });

  it("not sold: enquire, no price figure beyond the estimate", () => {
    draw({ lifecycle: "endedNoSale", msLeft: null });
    expect(screen.getByText("£6,000–£9,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enquire about this work" })).toHaveAttribute(
      "href",
      "/contact",
    );
  });

  it("withdrawn: a notice and the way back, no figures", () => {
    draw({ lifecycle: "withdrawn", msLeft: null });
    expect(screen.getByText("This lot was withdrawn from the sale")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the sale" })).toHaveAttribute(
      "href",
      "/sales/modern",
    );
    expect(screen.queryByText(/£/)).toBeNull();
  });
});
