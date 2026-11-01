import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AtgExternalBiddingPanel } from "./atg-external-bidding";

const liveSale = {
  status: "draft",
  sellingPlatform: "atg",
  atgDistribution: "public_marketplace",
  atgAuctionState: "live",
} as const;
const endedSale = { ...liveSale, atgAuctionState: "ended" } as const;

describe("AtgExternalBiddingPanel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nothing for ordinary draft sales", () => {
    const { container } = render(
      <AtgExternalBiddingPanel sale={{ status: "draft", sellingPlatform: "free" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("links live sales to the White Label in a new tab", () => {
    render(<AtgExternalBiddingPanel sale={liveSale} />);
    expect(screen.getByText("Live on ATG")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Bid on auctions\.lax\.bid/i });
    expect(link).toHaveAttribute("href", "https://auctions.lax.bid/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows ended copy and a view link once the ATG auction closes", () => {
    render(<AtgExternalBiddingPanel sale={endedSale} />);
    expect(screen.getByText("Ended on ATG")).toBeInTheDocument();
    expect(screen.getByText(/Bidding on this sale has closed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View on auctions\.lax\.bid/i })).toBeInTheDocument();
  });

  it.each([
    [true, "This lot sold on ATG."],
    [false, "This lot did not sell on ATG."],
    [undefined, "Bidding on this lot has closed."],
  ])("shows the lot result (sold=%s)", (sold, copy) => {
    render(<AtgExternalBiddingPanel sale={endedSale} lot={{ sold }} />);
    expect(screen.getByText(copy)).toBeInTheDocument();
  });

  it("derives the displayed host from the configured White Label URL", () => {
    vi.stubEnv("ATG_WHITE_LABEL_BASE_URL", "https://bid.example.com/catalogue");
    render(<AtgExternalBiddingPanel sale={liveSale} lot={{ sold: undefined }} />);
    expect(screen.getByText("Bidding on this lot takes place on bid.example.com.")).toBeVisible();
    expect(screen.getByRole("link", { name: /Bid on bid\.example\.com/i })).toHaveAttribute(
      "href",
      "https://bid.example.com/catalogue",
    );
  });

  it("falls back to the default URL when the configured one is invalid", () => {
    vi.stubEnv("ATG_WHITE_LABEL_BASE_URL", "not a url");
    render(<AtgExternalBiddingPanel sale={liveSale} />);
    expect(screen.getByRole("link", { name: /Bid on auctions\.lax\.bid/i })).toBeInTheDocument();
  });
});
