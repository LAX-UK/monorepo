import { SaleroomOverviewPlanVisit } from "@/components/sections/saleroom/saleroom-overview-plan-visit";
import type { Sale } from "@auction/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const baseSale: Sale = {
  id: "sale-1",
  title: "Evening Sale",
  description: null,
  coverImages: [],
  categoryId: null,
  deliveryMode: "onsite",
  allowOnlineBidsBeforeGoLive: false,
  streamUrl: null,
  locationName: "TheLax Saleroom",
  locationAddress: "12 King Street, London",
  locationMapUrl: null,
  locationAddressLine1: null,
  locationAddressLine2: null,
  locationCity: null,
  locationCounty: null,
  locationPostcode: null,
  locationCountry: null,
  status: "scheduled",
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  previewStartTime: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("SaleroomOverviewPlanVisit", () => {
  it("renders plan visit actions for onsite sales", () => {
    render(<SaleroomOverviewPlanVisit sale={baseSale} />);
    expect(screen.getByRole("heading", { name: /Plan your visit/i })).toBeInTheDocument();
  });

  it("shows venue address with link to map section", () => {
    render(<SaleroomOverviewPlanVisit sale={baseSale} />);
    expect(screen.getByText(/TheLax Saleroom/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View map/i })).toHaveAttribute("href", "#venue");
  });

  it("does not render catalogue highlights teaser", () => {
    render(<SaleroomOverviewPlanVisit sale={baseSale} />);
    expect(screen.queryByText(/Catalogue highlights/i)).not.toBeInTheDocument();
  });

  it("returns null for online-only sales", () => {
    const { container } = render(
      <SaleroomOverviewPlanVisit sale={{ ...baseSale, deliveryMode: "online" }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
