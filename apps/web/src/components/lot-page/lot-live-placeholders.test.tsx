import { LotBidEntry } from "@/components/lot-page/bid/lot-bid-entry";
import { LotBidHistory } from "@/components/lot-page/lot-bid-history";
import { LotEyebrow } from "@/components/lot-page/lot-eyebrow";
import { LotPriceBlock } from "@/components/lot-page/lot-price-block";
import { buildLotPageView } from "@/lib/lot-page/build-lot-page-view";
import { NO_LOT_VIEWER } from "@/lib/lot-page/lot-viewer";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * CO-7: the lot page is built from cached reads and carries no live bid state. Until the first
 * live (no-store) read lands, the parts that show bid state draw placeholders at their final
 * size, and the bid button is shut.
 */

vi.mock("@/lib/time/use-clock", () => ({
  useCountdown: () => null,
  useClockNow: () => null,
  useCountdownTick: () => null,
}));
vi.mock("@/components/lot-page/lot-connection-notice", () => ({ LotConnectionNotice: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// A view that would show bid state if anything drew it.
const LIVE_VIEW = buildLotPageView({
  lifecycle: "live",
  now: new Date("2026-11-01T12:00:00Z"),
  msLeft: 3_600_000,
  startsAt: "2026-10-30T18:00:00Z",
  endsAt: "2026-11-01T13:00:00Z",
  amounts: { starting: "4200.00", current: "7000.00", hammer: null, soldForWithPremium: null },
  estimate: { low: "6000", high: "9000" },
  bidCount: 6,
  reserve: "met",
  nextBid: "7250.00",
  extendedByMs: null,
  saleroom: null,
  signedIn: false,
  viewer: NO_LOT_VIEWER,
});

const context = {
  live: false,
  view: LIVE_VIEW,
  history: {
    total: 6,
    entries: [{ amount: "7000.00", channel: "web", at: "2026-11-01T11:59:00Z", isViewer: false }],
  },
  nowMs: Date.parse("2026-11-01T12:00:00Z"),
  currentPrice: "7000.00",
  nextBid: "7250.00",
  viewer: NO_LOT_VIEWER,
};

vi.mock("@/components/lot-page/lot-page-view-context", () => ({
  useLotPageViewContext: () => context,
}));

const actions = {
  bidEntry: <span data-testid="bid-entry" />,
  lotId: "lot-1",
  artist: null,
  signedIn: false,
  lotPath: "/lot/a/lot-1",
  saleHref: "/sales/s/sale-1",
  saleLabel: "Back to the sale",
};

beforeEach(() => {
  context.live = false;
});

describe("before the first live read", () => {
  it("the price block shows no price, next bid, state or clock, only placeholders", () => {
    const { container } = render(<LotPriceBlock actions={actions} />);
    const section = screen.getByRole("region", { name: "Price and bidding" });
    expect(section.getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).not.toMatch(/7,000|7,250|£|left|Closes|Current bid/);
    // The bid area keeps its place.
    expect(screen.getByTestId("bid-entry")).toBeTruthy();
  });

  it("the badge is a placeholder, not the lot's status", () => {
    const { container } = render(<LotEyebrow lotNumber={4} />);
    expect(container.textContent).toBe("Lot 4");
  });

  it("the history shows its place with no count and no bids", () => {
    const { container } = render(<LotBidHistory />);
    expect(container.textContent).toBe("Bid history");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the bid button is disabled", () => {
    render(
      <LotBidEntry
        auction={{} as never}
        artistName={null}
        buyersPremium={null}
        gate={{} as never}
      />,
    );
    const button = screen.getByRole("button", { name: "Loading the latest bid" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("once the live read has landed", () => {
  it("the price block draws the live view", () => {
    context.live = true;
    render(<LotPriceBlock actions={actions} />);
    const section = screen.getByRole("region", { name: "Price and bidding" });
    expect(section.getAttribute("aria-busy")).toBeNull();
    expect(section.textContent).toMatch(/7,000/);
  });

  it("the badge shows the lot's status", () => {
    context.live = true;
    const { container } = render(<LotEyebrow lotNumber={4} />);
    expect(container.textContent).not.toBe("Lot 4");
  });
});
