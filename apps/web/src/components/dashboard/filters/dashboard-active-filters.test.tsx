import { DashboardActiveFilters } from "@/components/dashboard/filters/dashboard-active-filters";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("DashboardActiveFilters", () => {
  it("renders nothing when no filters are active", () => {
    const { container } = render(<DashboardActiveFilters filters={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders dismissible pills and clear all link", () => {
    render(
      <DashboardActiveFilters
        filters={[
          {
            id: "q",
            label: "Search: canvas",
            href: "/dashboard/bids",
          },
        ]}
        clearAllHref="/dashboard/bids"
      />,
    );
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Search: canvas/i })).toHaveAttribute(
      "href",
      "/dashboard/bids",
    );
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute(
      "href",
      "/dashboard/bids",
    );
  });
});
