import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaleFormatExplainerPanel } from "./sale-type-explainer";

vi.mock("@/lib/hooks/use-hydrated", () => ({ useHydrated: () => true }));

describe("SaleFormatExplainerPanel", () => {
  it("renders a single mode panel for online — no other mode titles", () => {
    render(<SaleFormatExplainerPanel context={{ deliveryMode: "online" }} />);
    expect(screen.getByRole("heading", { name: "Online Auction" })).toBeInTheDocument();
    expect(screen.queryByText("In-person Auction")).not.toBeInTheDocument();
    expect(screen.queryByText("Hybrid Auction")).not.toBeInTheDocument();
  });

  it("renders a single mode panel for onsite", () => {
    render(<SaleFormatExplainerPanel context={{ deliveryMode: "onsite" }} />);
    expect(screen.getByRole("heading", { name: "In-person Auction" })).toBeInTheDocument();
    expect(screen.queryByText("Online Auction")).not.toBeInTheDocument();
    expect(screen.queryByText("Hybrid Auction")).not.toBeInTheDocument();
  });

  it("shows participation steps", () => {
    render(<SaleFormatExplainerPanel context={{ deliveryMode: "online" }} />);
    expect(screen.getByText(/Register to Bid/)).toBeInTheDocument();
    expect(screen.getByText(/Place Max Bids/)).toBeInTheDocument();
    expect(screen.getByText(/Timed Lot Close/)).toBeInTheDocument();
  });

  it("shows stream footnote for onsite when no streamUrl", () => {
    render(<SaleFormatExplainerPanel context={{ deliveryMode: "onsite" }} />);
    expect(screen.getByText(/not listed for this sale/i)).toBeInTheDocument();
  });

  it("shows stream step and no footnote for onsite with streamUrl", () => {
    render(
      <SaleFormatExplainerPanel
        context={{ deliveryMode: "onsite", streamUrl: "https://stream.example.com" }}
      />,
    );
    expect(screen.getByText(/Watch the Broadcast/)).toBeInTheDocument();
    expect(screen.queryByText(/not listed for this sale/i)).not.toBeInTheDocument();
  });

  it("shows on-block copy for hybrid gated sale", () => {
    render(
      <SaleFormatExplainerPanel
        context={{ deliveryMode: "hybrid", allowOnlineBidsBeforeGoLive: false }}
      />,
    );
    const matches = screen.getAllByText(/on the block/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows tagline", () => {
    render(<SaleFormatExplainerPanel context={{ deliveryMode: "online" }} />);
    expect(screen.getByText("Bid online from anywhere")).toBeInTheDocument();
  });
});
