import { SaleroomOverviewStream } from "@/components/sections/saleroom/saleroom-overview-stream";
import type { SaleOverviewVM } from "@/components/sections/saleroom/view-models";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const YOUTUBE = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

function makeOverview(
  streamUrl: string | null,
  status: "scheduled" | "active" | "ended" | "cancelled",
  deliveryMode: "onsite" | "hybrid" | "online" = "onsite",
): SaleOverviewVM {
  const ctx = resolveSaleStreamContext({
    streamUrl,
    status,
    deliveryMode,
    saleTitle: "Evening Sale",
    endTime: new Date("2026-06-14T18:00:00Z"),
  });
  return {
    status,
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
    streamUrl,
    showSalePageStream: ctx.showOnSalePage,
    streamPresentation: ctx.presentation,
    saleTitle: "Evening Sale",
    streamPosterUrl: "/poster.jpg",
    terms: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLines: [],
    resolvedMapUrl: null,
    locationEmbedUrl: null,
    showLocation: false,
  };
}

describe("SaleroomOverviewStream", () => {
  it("renders nothing when showSalePageStream is false (no stream URL)", () => {
    const { container } = render(
      <SaleroomOverviewStream overview={makeOverview(null, "active")} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when cancelled", () => {
    const { container } = render(
      <SaleroomOverviewStream overview={makeOverview(YOUTUBE, "cancelled")} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("active sale — shows 'Live stream' heading with pulse icon", () => {
    const { container } = render(
      <SaleroomOverviewStream overview={makeOverview(YOUTUBE, "active")} />,
    );
    expect(screen.getByRole("heading", { name: /Live stream/i })).toBeInTheDocument();
    // pulse icon on the heading svg
    expect(container.querySelector("h3 .animate-pulse")).toBeTruthy();
  });

  it("scheduled sale — shows 'Live stream' heading, no pulse icon", () => {
    const { container } = render(
      <SaleroomOverviewStream overview={makeOverview(YOUTUBE, "scheduled")} />,
    );
    expect(screen.getByRole("heading", { name: /Live stream/i })).toBeInTheDocument();
    expect(container.querySelector("h3 .animate-pulse")).toBeNull();
  });

  it("ended sale — shows 'Saleroom recording' heading, no pulse icon", () => {
    const { container } = render(
      <SaleroomOverviewStream overview={makeOverview(YOUTUBE, "ended")} />,
    );
    expect(screen.getByRole("heading", { name: /Saleroom recording/i })).toBeInTheDocument();
    expect(container.querySelector("h3 .animate-pulse")).toBeNull();
  });

  it("ended sale — section body includes sale title", () => {
    render(<SaleroomOverviewStream overview={makeOverview(YOUTUBE, "ended")} />);
    expect(screen.getByText(/Evening Sale/)).toBeInTheDocument();
  });
});
