import { SaleroomOverviewAbout } from "@/components/sections/saleroom/saleroom-overview-about";
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

describe("SaleroomOverviewAbout", () => {
  it("renders nothing when description and tags are empty", () => {
    const { container } = render(<SaleroomOverviewAbout overview={makeOverview()} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not show a placeholder when description is null but tags exist", () => {
    render(<SaleroomOverviewAbout overview={makeOverview({ tags: ["Contemporary"] })} />);
    expect(screen.getByRole("heading", { name: /About this sale/i })).toBeInTheDocument();
    expect(screen.getByText("Contemporary")).toBeInTheDocument();
    expect(screen.queryByText(/No description/i)).not.toBeInTheDocument();
  });

  it("renders description when present", () => {
    render(
      <SaleroomOverviewAbout
        overview={makeOverview({ description: "Curated highlights from the estate." })}
      />,
    );
    expect(screen.getByText("Curated highlights from the estate.")).toBeInTheDocument();
  });

  it("respects hideDescription and omits the block when only description would show", () => {
    const { container } = render(
      <SaleroomOverviewAbout
        hideDescription
        overview={makeOverview({ description: "Hidden copy" })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
