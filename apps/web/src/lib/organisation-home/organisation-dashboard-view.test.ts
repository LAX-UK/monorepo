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
      { currency: "GBP", amount: "48200.00" },
      { currency: "EUR", amount: "12500.00" },
    ],
  },
  payoutsDue: {
    payouts: 1,
    totals: [{ currency: "GBP", amount: "9100.00" }],
    nextDate: new Date("2026-11-03T00:00:00Z"),
    overdueSince: null,
  },
  openBids: { lots: 3, totalMax: [{ currency: "GBP", amount: "24000.00" }] },
  purchasesToPay: {
    purchases: 2,
    totals: [
      { currency: "GBP", amount: "500.00" },
      { currency: "EUR", amount: "1250.00" },
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
  return organisationDashboardView(buildOrganisationDashboard({ role }, figures), ctx, "ready");
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
        supporting: ["Est. £8,000–£12,000"],
        href: "/selling/consignments?tab=in-sale",
      },
      {
        label: "Sold this year",
        figures: ["£48,200.00", "€12,500.00"],
        supporting: ["5 works since 1 Jan"],
        href: "/selling/consignments?tab=sold",
      },
      {
        label: "Payouts due",
        figures: ["£9,100.00"],
        supporting: ["Next on 3\u00a0Nov\u00a02026"],
        href: "/selling/payouts",
      },
      {
        label: "Open bids",
        figures: ["3 lots"],
        supporting: ["Up to £24,000.00"],
        href: "/bids",
      },
    ]);
  });

  it("finance with two currencies: one figure line per currency, never one mixed total", () => {
    const tile = view("finance").tiles.find((t) => t.id === "purchases_to_pay");
    expect(tile).toMatchObject({
      label: "Purchases to pay",
      figures: ["£500.00", "€1,250.00"],
      supporting: ["2 purchases"],
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
      supporting: ["3 in sale · 2 under review"],
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
      ["Open bids", ["3 lots"], ["Up to £24,000.00"]],
      ["Your bid limit", ["£10,000.00"], ["In the sales you're authorised for"]],
      ["Sales you can bid in", ["1 sale"], ["1 sale to register for"]],
    ]);
  });

  it("a tile with nothing to show says so, with no zero and no supporting line", () => {
    const empty = view("owner", {
      ...FIGURES,
      payoutsDue: { payouts: 0, totals: [], nextDate: null, overdueSince: null },
    }).tiles.find((t) => t.id === "payouts_due");
    expect(empty).toMatchObject({ figures: [], emptyText: "No payouts due", supporting: [] });
  });
});

describe("sections", () => {
  it("lists the next sales with date, title and number of works", () => {
    expect(view("owner").upcomingSales).toEqual([
      {
        id: "s1",
        title: "Modern British",
        date: "20\u00a0Nov\u00a02026",
        dateTime: "2026-11-20T10:00:00.000Z",
        works: "2 of your works",
        href: "/sales/modern-british/s1",
      },
    ]);
  });

  it("shows only stages with works, each linking to the filtered list", () => {
    const stages = view("owner").stages;
    expect(stages?.map(({ label, count, href }) => [label, count, href])).toEqual([
      ["Under review", 2, "/selling/consignments?tab=in-review&stage=under_review"],
      ["In sale", 3, "/selling/consignments?tab=in-sale"],
      ["Sold", 1, "/selling/consignments?tab=sold"],
    ]);
  });

  it("leaves the section out when every stage is empty", () => {
    const model = buildOrganisationDashboard(
      { role: "owner" },
      { ...FIGURES, consignmentProgress: emptyConsignmentProgress() },
    );
    expect(organisationDashboardView(model, ctx, "ready").stages).toBeNull();
  });

  it("leaves out a lone stage: one number is not a breakdown", () => {
    const lone = view("owner", {
      ...FIGURES,
      consignmentProgress: { ...emptyConsignmentProgress(), accepted: 1 },
    });
    expect(lone.stages).toBeNull();
  });
});

describe("thin data", () => {
  it("hides At a glance until there is a first figure, rather than a row of “No …” cells", () => {
    const quiet = view("owner", {
      ...FIGURES,
      upcomingSales: [],
      soldThisYear: { year: 2026, works: 0, totals: [] },
      payoutsDue: { payouts: 0, totals: [], nextDate: null, overdueSince: null },
      openBids: { lots: 0, totalMax: [] },
    });
    expect(quiet.tiles).toEqual([]);
    const one = view("owner", {
      ...FIGURES,
      upcomingSales: [],
      soldThisYear: { year: 2026, works: 0, totals: [] },
      openBids: { lots: 0, totalMax: [] },
    });
    expect(one.tiles.map((tile) => tile.emptyText)).toContain("No open bids");
  });
});

describe("first steps", () => {
  const EMPTY: DashboardFigures = {
    consignmentProgress: emptyConsignmentProgress(),
    upcomingSales: [],
    soldThisYear: { year: 2026, works: 0, totals: [] },
    payoutsDue: { payouts: 0, totals: [], nextDate: null, overdueSince: null },
    openBids: { lots: 0, totalMax: [] },
    purchasesToPay: { purchases: 0, totals: [] },
    bidAuthority: { everySale: null, sales: [] },
  };

  it("points an owner to selling and inviting", () => {
    expect(view("owner", EMPTY).firstRun).toEqual({
      addressee: "organisation",
      title: "Get Northbank Gallery started",
      description:
        "Send a first work to our specialists. Sales, payouts, bids and purchases show here as they happen.",
      actions: [
        { id: "sell", label: "Sell a work", href: "/selling/new" },
        { id: "invite", label: "Invite someone", href: "/team" },
      ],
    });
  });

  it("stays calm for a role that cannot start anything, without blaming the organisation", () => {
    expect(view("viewer", EMPTY).firstRun).toEqual({
      addressee: "member",
      title: "Nothing to show yet",
      description: "Sales show here as they happen.",
      actions: [],
    });
    expect(view("finance", EMPTY).firstRun).toEqual({
      addressee: "member",
      title: "Nothing to show yet",
      description: "Sales, payouts and purchases show here as they happen.",
      actions: [],
    });
  });

  it("asks a consignor for their own first work, not to get the organisation started", () => {
    expect(view("consignor", EMPTY).firstRun).toEqual({
      addressee: "member",
      title: "Send your first work",
      description:
        "Our specialists review each work you send. Your sales show here as they happen.",
      actions: [{ id: "sell", label: "Sell a work", href: "/selling/new" }],
    });
  });

  it("never tells a buyer agent about payouts they cannot see", () => {
    expect(view("buyer_agent", EMPTY).firstRun).toEqual({
      addressee: "member",
      title: "Nothing to show yet",
      description: "Bids show here as they happen.",
      actions: [],
    });
  });

  it("follows the organisation's state: a restricted owner is not asked to sell or invite", () => {
    const model = buildOrganisationDashboard({ role: "owner" }, EMPTY, () => false);
    expect(organisationDashboardView(model, ctx, "restricted").firstRun).toEqual({
      addressee: "organisation",
      title: "Nothing here yet",
      description: "Northbank Gallery's past sales, purchases and invoices show here.",
      actions: [],
    });
  });

  it("an organisation under review may still invite, and is told when sales show", () => {
    const model = buildOrganisationDashboard(
      { role: "owner" },
      EMPTY,
      (action) => action === "invite",
    );
    expect(organisationDashboardView(model, ctx, "documents_under_review").firstRun).toEqual({
      addressee: "organisation",
      title: "Nothing here yet",
      description:
        "Sales, payouts, bids and purchases for Northbank Gallery show here once we've finished checking its documents.",
      actions: [{ id: "invite", label: "Invite someone", href: "/team" }],
    });
  });
});

describe("payouts due", () => {
  const payouts = (due: { nextDate: Date | null; overdueSince: Date | null }) =>
    view("finance", {
      ...FIGURES,
      payoutsDue: { payouts: 2, totals: [{ currency: "GBP", amount: "1140.00" }], ...due },
    }).tiles.find((tile) => tile.id === "payouts_due")?.supporting;

  it("says a past date is overdue, never that it is next", () => {
    expect(payouts({ nextDate: null, overdueSince: new Date("2026-10-12T00:00:00Z") })).toEqual([
      "Overdue since 12\u00a0Oct\u00a02026",
    ]);
  });

  it("shows both dates on one line when one payout is overdue and another is ahead", () => {
    expect(
      payouts({
        nextDate: new Date("2026-11-03T00:00:00Z"),
        overdueSince: new Date("2026-10-12T00:00:00Z"),
      }),
    ).toEqual(["Overdue since 12\u00a0Oct\u00a02026 · next 3\u00a0Nov\u00a02026"]);
  });
});
