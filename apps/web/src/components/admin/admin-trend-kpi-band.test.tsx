import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("AdminTrendKpiBand", () => {
  it("renders six-tile values in full and uses 3 columns through xl, 6 at 2xl", () => {
    const { container } = render(
      <AdminTrendKpiBand
        ariaLabel="Lot overview"
        tiles={[
          { id: "estimate", label: "Estimate", value: "£1,200,000 – £1,800,000" },
          { id: "reserve", label: "Reserve", value: "£950,000" },
          { id: "current-bid", label: "Current bid", value: "£1,050,000" },
          { id: "bidders", label: "Bidders", value: "12" },
          { id: "views", label: "Views", value: "248" },
          { id: "buyer-premium", label: "Buyer premium", value: "26.4%" },
        ]}
      />,
    );

    expect(screen.getByText("£1,200,000 – £1,800,000")).toBeTruthy();
    expect(screen.getByText("£950,000")).toBeTruthy();
    expect(screen.getByText("26.4%")).toBeTruthy();

    const grid = container.querySelector(".grid");
    const classes = grid?.className.split(/\s+/) ?? [];
    expect(classes).toContain("md:grid-cols-2");
    expect(classes).toContain("lg:grid-cols-3");
    expect(classes).toContain("xl:grid-cols-3");
    expect(classes).toContain("2xl:grid-cols-6");
    expect(classes).not.toContain("xl:grid-cols-6");
  });

  it("does not apply the six-tile grid override for smaller bands", () => {
    const { container } = render(
      <AdminTrendKpiBand
        tiles={[
          { label: "Live lots", value: "8" },
          { label: "Sold lots", value: "3" },
          { label: "Withdrawn", value: "1" },
        ]}
      />,
    );

    const grid = container.querySelector(".grid");
    const classes = grid?.className.split(/\s+/) ?? [];
    expect(classes).toContain("xl:grid-cols-3");
    expect(classes).not.toContain("2xl:grid-cols-6");
    expect(classes).not.toContain("xl:grid-cols-6");
  });
});
