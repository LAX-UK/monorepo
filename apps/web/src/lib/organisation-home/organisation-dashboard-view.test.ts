import {
  type DashboardFigures,
  bidAuthorityFigure,
  buildOrganisationDashboard,
  emptyConsignmentProgress,
} from "@auction/domain";
import { describe, expect, it } from "vitest";
import { organisationDashboardView } from "./organisation-dashboard-view";

const ctx = { organisationName: "Northbank Gallery" };

const FIGURES: DashboardFigures = {
  consignmentProgress: { ...emptyConsignmentProgress(), under_review: 2, in_sale: 3, sold: 1 },
  upcomingSales: [
    {
      id: "s1",
      title: "Modern British",
      startsAt: new Date("2026-11-20T10:00:00Z"),
      works: 2,
      estimates: [{ currency: "GBP", low: "8000.00", high: "12000.00" }],
    },
  ],
  soldThisYear: {
    year: 2026,
    works: 5,
    totals: [
      { currency: "EUR", amount: "12500.00" },
      { currency: "GBP", amount: "48200.00" },
    ],
  },
  payoutsDue: {
    payouts: 1,
    totals: [{ currency: "GBP", amount: "9100.00" }],
    nextDate: new Date("2026-11-03T00:00:00Z"),
  },
  openBids: { lots: 3, totalMax: [{ currency: "GBP", amount: "24000.00" }] },
  purchasesToPay: {
    purchases: 2,
    totals: [
      { currency: "EUR", amount: "1250.00" },
      { currency: "GBP", amount: "500.00" },
    ],
  },
  bidAuthority: bidAuthorityFigure([
    {
      sale: {
        id: "s1",
        title: "Modern British",
        startTime: "2026-11-20T10:00:00Z",
        registered: false,
      },
      bidLimit: "10000.00",
    },
  ]),
};

function view(role: Parameters<typeof buildOrganisationDashboard>[0]["role"], figures = FIGURES) {
  return organisationDashboardView(buildOrganisationDashboard({ role }, figures), ctx);
}

describe("At a glance words and links", () => {
  it("owner: each tile reads plainly and links to the page behind it", () => {
    expect(
      view("owner").tiles.map(({ label, figures, supporting, href }) => ({
        label,
        figures,
        supporting,
        href,
      })),
    ).toEqual([
      {
        label: "In upcoming sales",
        figures: ["2 works"],
        supporting: "Estimate £8,000.00 – £12,000.00",
        href: "/selling/consignments?tab=in-sale",
      },
      {
        label: "Sold this year",
        figures: ["€12,500.00", "£48,200.00"],
        supporting: "5 works since 1 January",
        href: "/selling/consignments?tab=sold",
      },
      {
        label: "Payouts due",
        figures: ["£9,100.00"],
        supporting: "Next on 3 Nov 2026",
        href: "/selling/payouts",
      },
      {
        label: "Open bids",
        figures: ["3 lots"],
        supporting: "Up to £24,000.00 in all",
        href: "/bids",
      },
    ]);
  });

  it("finance with two currencies: one figure line per currency, never one mixed total", () => {
    const tile = view("finance").tiles.find((t) => t.id === "purchases_to_pay");
    expect(tile).toMatchObject({
      label: "Purchases to pay",
      figures: ["€1,250.00", "£500.00"],
      supporting: "2 purchases",
      href: "/purchases",
    });
  });

  it("says the year is the calendar year on UK time", () => {
    const sold = view("owner").tiles.find((t) => t.id === "sold_this_year");
    expect(sold?.description).toBe(
      "Hammer prices of works sold from 1 January to 31 December 2026, UK time.",
    );
  });

  it("a consignor's figures say they are their own", () => {
    const [works] = view("consignor").tiles;
    expect(works).toMatchObject({
      label: "Your works in progress",
      figures: ["6 works"],
      supporting: "3 in sale · 2 under review",
    });
    expect(works?.description).toMatch(/^Works you sent/);
  });

  it("buyer agent: their bids, their limit and the sales to register for", () => {
    expect(
      view("buyer_agent").tiles.map(({ label, figures, supporting }) => [
        label,
        figures,
        supporting,
      ]),
    ).toEqual([
      ["Open bids", ["3 lots"], "Up to £24,000.00 in all"],
      ["Your bid limit", ["£10,000.00"], "In the sales you're authorised for"],
      ["Sales you can bid in", ["1 sale"], "1 sale to register for"],
    ]);
  });

  it("a tile with nothing to show says so, with no zero and no supporting line", () => {
    const empty = view("owner", {
      ...FIGURES,
      payoutsDue: { payouts: 0, totals: [], nextDate: null },
    }).tiles.find((t) => t.id === "payouts_due");
    expect(empty).toMatchObject({ figures: [], emptyText: "No payouts due", supporting: null });
  });
});

describe("sections", () => {
  it("lists the next sales with date, title and number of works", () => {
    expect(view("owner").upcomingSales).toEqual([
      {
        id: "s1",
        title: "Modern British",
        date: "20 Nov 2026",
        dateTime: "2026-11-20T10:00:00.000Z",
        works: "2 works",
        href: "/sales/modern-british/s1",
      },
    ]);
  });

  it("links each stage with works to the filtered list, and leaves empty stages plain", () => {
    const stages = view("owner").stages;
    expect(stages?.map(({ label, count, href }) => [label, count, href])).toEqual([
      ["Under review", 2, "/selling/consignments?tab=in-review&stage=under_review"],
      ["Needs changes", 0, null],
      ["Accepted", 0, null],
      ["In sale", 3, "/selling/consignments?tab=in-sale"],
      ["Sold", 1, "/selling/consignments?tab=sold"],
      ["Unsold", 0, null],
    ]);
  });
});

describe("first steps", () => {
  const EMPTY: DashboardFigures = {
    consignmentProgress: emptyConsignmentProgress(),
    upcomingSales: [],
    soldThisYear: { year: 2026, works: 0, totals: [] },
    payoutsDue: { payouts: 0, totals: [], nextDate: null },
    openBids: { lots: 0, totalMax: [] },
    purchasesToPay: { purchases: 0, totals: [] },
    bidAuthority: { everySale: null, sales: [] },
  };

  it("points an owner to selling and inviting", () => {
    expect(view("owner", EMPTY).firstRun).toEqual({
      title: "Get Northbank Gallery started",
      description:
        "Send a first work to our specialists. Sales, payouts and bids show here as they happen.",
      actions: [
        { id: "sell", label: "Sell a work", href: "/selling/new" },
        { id: "invite", label: "Invite someone", href: "/organisation/members" },
      ],
    });
  });

  it("stays calm for a role that cannot start anything", () => {
    expect(view("viewer", EMPTY).firstRun).toEqual({
      title: "Nothing here yet",
      description:
        "Sales, payouts and bids show here once Northbank Gallery starts selling or buying.",
      actions: [],
    });
  });
});
