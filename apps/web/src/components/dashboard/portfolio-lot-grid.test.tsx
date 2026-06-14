import { PortfolioLotGrid } from "@/components/dashboard/portfolio-lot-grid";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const sampleItem = {
  id: "l1",
  title: "Blue Canvas Study",
  artistName: "Jane Doe",
  image: null,
  hammerLabel: "£12,345.67",
  premiumLabel: "£2,469.13",
  totalLabel: "£14,814.80",
  dueLabel: "Total due",
  settlementLabel: "Due",
  settlementStageIndex: 1,
  medium: "Oil on canvas",
  dimensions: null,
  paymentStatus: "authorized",
  checkoutHref: "/dashboard/checkout/l1",
  conditionReportUrl: null,
  endYear: 2025,
  complianceReason: null,
};

describe("PortfolioLotGrid", () => {
  it("truncates long currency amounts in stacked variant price triplet", () => {
    render(<PortfolioLotGrid items={[sampleItem]} variant="stacked" />);

    const total = screen.getByTitle("£14,814.80");
    expect(total.className).toMatch(/truncate/);
  });
});
