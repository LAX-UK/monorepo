import { SalesCalendarEmpty } from "@/components/sections/sales/sales-calendar-empty";
import type { SalesBrowsePageVM } from "@/lib/marketing/sales-browse-page.vm";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/sections/home/newsletter-signup-form", () => ({
  NewsletterSignupForm: () => <form aria-label="Newsletter sign-up" />,
}));

function vm(over: Partial<SalesBrowsePageVM> = {}): SalesBrowsePageVM {
  return {
    tab: "upcoming",
    calendarState: {
      tab: "upcoming",
      deliveryMode: "all",
      location: "all",
      sort: "startAsc",
      view: "grid",
    },
    hasActiveCalendarFilters: false,
    whileYouWait: [],
    ...over,
  } as SalesBrowsePageVM;
}

describe("SalesCalendarEmpty", () => {
  it("offers the sign-up and recent results on a quiet calendar, with no filter language", () => {
    render(<SalesCalendarEmpty vm={vm()} />);
    expect(screen.getByRole("heading", { name: "No sales are scheduled yet" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Newsletter sign-up" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See recent results" })).toBeInTheDocument();
    expect(screen.queryByText(/filter/i)).not.toBeInTheDocument();
  });

  it("shows the neighbours under the empty state", () => {
    render(
      <SalesCalendarEmpty
        vm={vm({
          whileYouWait: [
            {
              id: "lastResult",
              title: "September Modern British",
              detail: "Ended 15 Oct 2026",
              href: "/sales/september",
            },
            {
              id: "consignments",
              title: "Consignments are open",
              detail: "Close 15 Jan 2027",
              href: "/sell",
            },
          ],
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "While you wait" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /September Modern British/ })).toHaveAttribute(
      "href",
      "/sales/september",
    );
    expect(screen.getByRole("link", { name: /Consignments are open/ })).toHaveAttribute(
      "href",
      "/sell",
    );
  });

  it("omits the neighbours section when there are none", () => {
    render(<SalesCalendarEmpty vm={vm()} />);
    expect(screen.queryByText("While you wait")).not.toBeInTheDocument();
  });

  it("keeps the filters' way out for a filtered miss, with no sign-up", () => {
    render(
      <SalesCalendarEmpty
        vm={vm({
          hasActiveCalendarFilters: true,
          calendarState: {
            tab: "upcoming",
            deliveryMode: "online",
            location: "all",
            sort: "startAsc",
            view: "grid",
          },
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No sales match these filters" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/sales?tab=upcoming",
    );
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("does not link the results tab to itself", () => {
    render(<SalesCalendarEmpty vm={vm({ tab: "results" })} />);
    expect(screen.getByRole("heading", { name: "No results yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See recent results" })).not.toBeInTheDocument();
  });
});
