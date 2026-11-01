import { SalesPrimaryTabs } from "@/components/sections/sales/sales-primary-tabs";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const baseState: CalendarSalesUrlState = {
  tab: "upcoming",
  deliveryMode: "all",
  location: "all",
  sort: "startAsc",
  view: "grid",
};

describe("SalesPrimaryTabs", () => {
  it("renders all five section tabs in sentence case", () => {
    render(<SalesPrimaryTabs state={baseState} />);
    expect(screen.getByRole("link", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Live now" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Auction results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New lots" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Private sales" })).toBeInTheDocument();
  });

  it("is a labelled navigation", () => {
    render(<SalesPrimaryTabs state={baseState} />);
    expect(screen.getByRole("navigation", { name: "Calendar sections" })).toBeInTheDocument();
  });

  it("marks the active tab with aria-current=page", () => {
    render(<SalesPrimaryTabs state={{ ...baseState, tab: "live" }} />);
    expect(screen.getByRole("link", { name: "Live now" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Upcoming" })).not.toHaveAttribute("aria-current");
  });

  it("puts Live now first when hasLiveSales is true", () => {
    render(<SalesPrimaryTabs state={{ ...baseState, tab: "live" }} hasLiveSales />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Live now");
    expect(links[1]).toHaveTextContent("Upcoming");
  });

  it("clears stale page params when changing tabs", () => {
    render(<SalesPrimaryTabs state={{ ...baseState, page: 3 }} />);

    expect(screen.getByRole("link", { name: "New lots" })).toHaveAttribute(
      "href",
      "/sales?tab=newLots",
    );
  });
});
