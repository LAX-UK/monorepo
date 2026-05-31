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
  it("renders all five section tabs", () => {
    render(<SalesPrimaryTabs state={baseState} />);
    expect(screen.getByRole("link", { name: /^Upcoming$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Live Now/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Auction Results/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New Lots/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Private Sales/i })).toBeInTheDocument();
  });

  it("marks the active tab with aria-current=page", () => {
    render(<SalesPrimaryTabs state={{ ...baseState, tab: "live" }} />);
    expect(screen.getByRole("link", { name: /Live Now/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Upcoming$/i })).not.toHaveAttribute("aria-current");
  });

  it("uses horizontal scroll snap on the scroller", () => {
    const { container } = render(<SalesPrimaryTabs state={baseState} />);
    const scroller = container.firstElementChild;
    expect(scroller).toHaveClass("snap-x", "snap-mandatory", "scroll-pl-4", "scroll-pr-4");
  });

  it("applies snap-start to each tab link", () => {
    render(<SalesPrimaryTabs state={baseState} />);
    expect(screen.getByRole("link", { name: /^Upcoming$/i })).toHaveClass("snap-start");
  });

  it("puts Live Now first when hasLiveSales is true", () => {
    render(<SalesPrimaryTabs state={{ ...baseState, tab: "live" }} hasLiveSales />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Live Now");
    expect(links[1]).toHaveTextContent("Upcoming");
  });

  it("clears stale page params when changing tabs", () => {
    render(<SalesPrimaryTabs state={{ ...baseState, page: 3 }} />);

    expect(screen.getByRole("link", { name: /New Lots/i })).toHaveAttribute(
      "href",
      "/sales?tab=newLots",
    );
  });
});
