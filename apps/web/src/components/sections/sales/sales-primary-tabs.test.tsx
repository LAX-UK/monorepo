import { SalesPrimaryTabs } from "@/components/sections/sales/sales-primary-tabs";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { resolveCalendarTabs } from "@/lib/marketing/sales-calendar-tabs";
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
  it("is a labelled navigation of the sections it is given", () => {
    render(<SalesPrimaryTabs state={baseState} tabs={resolveCalendarTabs({}, "upcoming")} />);
    expect(screen.getByRole("navigation", { name: "Calendar sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Results" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /live now/i })).not.toBeInTheDocument();
  });

  it("marks the active tab with aria-current=page", () => {
    render(
      <SalesPrimaryTabs
        state={{ ...baseState, tab: "live" }}
        tabs={resolveCalendarTabs({ live: 1, upcoming: 2 }, "live")}
      />,
    );
    expect(screen.getByRole("link", { name: /live now/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /upcoming/i })).not.toHaveAttribute("aria-current");
  });

  it("leads with Live now when something is live", () => {
    render(
      <SalesPrimaryTabs state={baseState} tabs={resolveCalendarTabs({ live: 1 }, "upcoming")} />,
    );
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Live now");
    expect(links[1]).toHaveTextContent("Upcoming");
  });

  it("shows a count above zero only", () => {
    render(
      <SalesPrimaryTabs
        state={baseState}
        tabs={resolveCalendarTabs({ upcoming: 0, results: 8 }, "upcoming")}
      />,
    );
    expect(screen.getByRole("link", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Results/ })).toHaveTextContent("8");
  });

  it("clears stale page params when changing tabs", () => {
    render(
      <SalesPrimaryTabs
        state={{ ...baseState, page: 3 }}
        tabs={resolveCalendarTabs({}, "upcoming")}
      />,
    );
    expect(screen.getByRole("link", { name: "Results" })).toHaveAttribute(
      "href",
      "/sales?tab=results",
    );
  });
});
