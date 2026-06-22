import { SaleroomOverviewFacts } from "@/components/sections/saleroom/saleroom-overview-facts";
import type { SaleOverviewVM } from "@/components/sections/saleroom/view-models";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function makeOverview(overrides: Partial<SaleOverviewVM> = {}): SaleOverviewVM {
  return {
    status: "scheduled",
    description: null,
    startLabel: "01 Jun 2026 · 18:00",
    endLabel: "01 Jun 2026 · 21:00",
    previewLabel: null,
    formatLabel: "In-person",
    buyerPremiumLabel: "25%",
    buyerPremiumTiers: null,
    categoryLabel: null,
    categoryLabels: [],
    tags: [],
    streamUrl: null,
    showSalePageStream: false,
    streamPresentation: null,
    saleTitle: "Evening Sale",
    streamPosterUrl: null,
    terms: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLines: [],
    resolvedMapUrl: null,
    locationEmbedUrl: null,
    showLocation: false,
    ...overrides,
  };
}

describe("SaleroomOverviewFacts", () => {
  it("shows Starts row for scheduled sales", () => {
    render(<SaleroomOverviewFacts overview={makeOverview({ status: "scheduled" })} />);
    expect(screen.getByText("Starts")).toBeInTheDocument();
    expect(screen.getByText("01 Jun 2026 · 18:00")).toBeInTheDocument();
  });

  it("hides Starts row for active and ended sales", () => {
    const { rerender } = render(
      <SaleroomOverviewFacts overview={makeOverview({ status: "active" })} />,
    );
    expect(screen.queryByText("Starts")).not.toBeInTheDocument();

    rerender(<SaleroomOverviewFacts overview={makeOverview({ status: "ended" })} />);
    expect(screen.queryByText("Starts")).not.toBeInTheDocument();
  });

  it("labels the end row as Ended for ended sales", () => {
    render(<SaleroomOverviewFacts overview={makeOverview({ status: "ended" })} />);
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.queryByText(/^Ends$/)).not.toBeInTheDocument();
  });

  it("labels the end row as Cancelled or Voided for terminal non-ended statuses", () => {
    const { rerender } = render(
      <SaleroomOverviewFacts overview={makeOverview({ status: "cancelled" })} />,
    );
    expect(screen.getByText("Cancelled")).toBeInTheDocument();

    rerender(<SaleroomOverviewFacts overview={makeOverview({ status: "voided" })} />);
    expect(screen.getByText("Voided")).toBeInTheDocument();
  });

  it("does not show Lots or Registered bidders rows", () => {
    render(<SaleroomOverviewFacts overview={makeOverview()} />);
    expect(screen.queryByText("Lots")).not.toBeInTheDocument();
    expect(screen.queryByText(/Registered/i)).not.toBeInTheDocument();
  });
});
