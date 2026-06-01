import { SellerOverviewLayout } from "@/components/dashboard/overview/seller-overview-layout";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SellerOverviewLayout", () => {
  it("renders full-width sections without buyer 2-column grid", () => {
    const { container } = render(
      <SellerOverviewLayout
        slots={{
          kpis: <div data-testid="kpis">KPIs</div>,
          guides: (
            <section data-testid="guides" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>Submissions</div>
              <div>In sale</div>
              <div>Payouts</div>
            </section>
          ),
          secondary: <div data-testid="secondary">Artist</div>,
        }}
      />,
    );

    expect(screen.getByTestId("kpis")).toBeInTheDocument();
    expect(screen.getByTestId("guides")).toBeInTheDocument();
    expect(screen.getByTestId("secondary")).toBeInTheDocument();
    expect(
      container.querySelector(
        ".lg\\:grid-cols-\\[minmax\\(0\\,1\\.15fr\\)_minmax\\(280px\\,0\\.85fr\\)\\]",
      ),
    ).toBeNull();
  });

  it("omits activity section when not provided", () => {
    render(
      <SellerOverviewLayout
        slots={{
          kpis: <div>KPIs</div>,
          guides: <div>Guides</div>,
          secondary: <div>Artist</div>,
        }}
      />,
    );

    expect(screen.queryByText("Upcoming sales")).not.toBeInTheDocument();
  });
});
