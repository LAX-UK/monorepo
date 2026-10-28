import type { OrganisationDashboardView } from "@/lib/organisation-home/organisation-dashboard-view";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeDashboard } from "./home-dashboard";

const DASHBOARD: OrganisationDashboardView = {
  firstRun: null,
  tiles: [
    {
      id: "sold_this_year",
      label: "Sold this year",
      figures: ["€12,500.00", "£48,200.00"],
      emptyText: null,
      supporting: "5 works since 1 January",
      description: "Hammer prices of works sold from 1 January to 31 December 2026, UK time.",
      href: "/selling/consignments?tab=sold",
    },
    {
      id: "payouts_due",
      label: "Payouts due",
      figures: [],
      emptyText: "No payouts due",
      supporting: null,
      description: "Payouts scheduled or on their way to the bank account, after fees.",
      href: "/selling/payouts",
    },
  ],
  upcomingSales: [
    {
      id: "s1",
      title: "Modern British",
      date: "20 Nov 2026",
      dateTime: "2026-11-20T10:00:00.000Z",
      works: "2 works",
      href: "/sales/modern-british/s1",
    },
  ],
  upcomingSalesHref: "/selling/consignments?tab=in-sale",
  stages: [
    { id: "under_review", label: "Under review", count: 2, href: "/selling/consignments?x" },
    { id: "needs_changes", label: "Needs changes", count: 0, href: null },
  ],
};

describe("HomeDashboard", () => {
  it("renders each figure as one link to its page, described by what it counts", () => {
    render(<HomeDashboard dashboard={DASHBOARD} />);
    const sold = screen.getByTestId("home-tile-sold_this_year");
    expect(sold).toHaveAttribute("href", "/selling/consignments?tab=sold");
    expect(within(sold).getByText("€12,500.00")).toBeVisible();
    expect(within(sold).getByText("£48,200.00")).toBeVisible();
    expect(sold).toHaveAccessibleDescription(
      "Hammer prices of works sold from 1 January to 31 December 2026, UK time.",
    );
  });

  it("says a figure with nothing to show plainly", () => {
    render(<HomeDashboard dashboard={DASHBOARD} />);
    const payouts = screen.getByTestId("home-tile-payouts_due");
    expect(within(payouts).getByText("No payouts due")).toBeVisible();
    expect(payouts.textContent).not.toMatch(/£0/);
  });

  it("lists upcoming sales as links, and stages with works as links", () => {
    render(<HomeDashboard dashboard={DASHBOARD} />);
    expect(screen.getByRole("link", { name: /Modern British/ })).toHaveAttribute(
      "href",
      "/sales/modern-british/s1",
    );
    const review = screen.getByTestId("home-stage-under_review");
    expect(within(review).getByRole("link")).toHaveAccessibleName("Under review , 2");
    expect(within(screen.getByTestId("home-stage-needs_changes")).queryByRole("link")).toBeNull();
  });

  it("keeps the keyboard order: figures, then sales, then stages, with a visible focus ring", () => {
    const { container } = render(<HomeDashboard dashboard={DASHBOARD} />);
    const links = [...container.querySelectorAll("a[href]")];
    // Tab order follows the document: nothing reorders it with a tabindex.
    expect(container.querySelector("[tabindex]:not([tabindex='-1'])")).toBeNull();
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/selling/consignments?tab=sold",
      "/selling/payouts",
      "/selling/consignments?tab=in-sale",
      "/sales/modern-british/s1",
      "/selling/consignments?x",
    ]);
    for (const link of links) expect(link.className).toContain("focus-visible:outline");
  });

  it("shows a new organisation's first steps instead of the figures", () => {
    render(
      <HomeDashboard
        dashboard={{
          ...DASHBOARD,
          firstRun: {
            title: "Get Northbank Gallery started",
            description: "Send a first work to our specialists.",
            actions: [
              { id: "sell", label: "Sell a work", href: "/selling/new" },
              { id: "invite", label: "Invite someone", href: "/organisation/members" },
            ],
          },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Get Northbank Gallery started" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sell a work" })).toHaveAttribute(
      "href",
      "/selling/new",
    );
    expect(screen.getByRole("link", { name: "Invite someone" })).toBeVisible();
    expect(screen.queryByTestId("home-tile-sold_this_year")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Upcoming sales" })).toBeNull();
  });
});
