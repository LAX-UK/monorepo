import { SalesCalendarPagination } from "@/components/sections/sales/sales-calendar-pagination";
import type { CalendarSalesUrlState } from "@/lib/marketing/sales-calendar-params";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const state: CalendarSalesUrlState = {
  tab: "newLots",
  deliveryMode: "all",
  location: "all",
  sort: "startAsc",
  view: "grid",
};

describe("SalesCalendarPagination", () => {
  it("renders next-page navigation for paginated new lots", () => {
    render(<SalesCalendarPagination state={state} page={1} hasMore />);

    expect(
      screen.getByRole("navigation", { name: "Sales calendar pagination" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next/i })).toHaveAttribute(
      "href",
      "/sales?tab=newLots&page=2",
    );
  });

  it("hides when the first page has no more results", () => {
    const { container } = render(
      <SalesCalendarPagination state={state} page={1} hasMore={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
