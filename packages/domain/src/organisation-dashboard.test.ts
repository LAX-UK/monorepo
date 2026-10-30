import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import { emptyConsignmentProgress } from "./consignment-progress.js";
import {
  type DashboardFigures,
  bidAuthorityFigure,
  bidLimitSummary,
  buildOrganisationDashboard,
  dashboardFigureGroupsFor,
  dashboardFigureScope,
  dashboardSectionsFor,
  dashboardTileKindsFor,
  splitPayoutDates,
  upcomingSaleFigures,
} from "./organisation-dashboard.js";
import { buildOrganisationHome } from "./organisation-home.js";

const ROLES: LegalEntityMemberRole[] = [
  "owner",
  "admin",
  "finance",
  "consignor",
  "buyer_agent",
  "viewer",
];

/** An organisation with something in every figure group. */
const BUSY: Required<DashboardFigures> = {
  consignmentProgress: {
    ...emptyConsignmentProgress(),
    under_review: 2,
    needs_changes: 1,
    in_sale: 3,
    sold: 4,
  },
  upcomingSales: [
    {
      id: "s1",
      title: "Modern British",
      startsAt: new Date("2026-11-20T10:00:00Z"),
      works: 2,
      estimates: [{ currency: "GBP", low: "8000.00", high: "12000.00" }],
    },
    {
      id: "s2",
      title: "Contemporary",
      startsAt: new Date("2026-12-02T10:00:00Z"),
      works: 1,
      estimates: [{ currency: "GBP", low: "2000.00", high: "3000.00" }],
    },
  ],
  soldThisYear: { year: 2026, works: 4, totals: [{ currency: "GBP", amount: "48200.00" }] },
  payoutsDue: {
    payouts: 1,
    totals: [{ currency: "GBP", amount: "9100.00" }],
    nextDate: new Date("2026-11-03T00:00:00Z"),
    overdueSince: null,
  },
  openBids: { lots: 3, totalMax: [{ currency: "GBP", amount: "24000.00" }] },
  purchasesToPay: { purchases: 2, totals: [{ currency: "GBP", amount: "6250.00" }] },
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

/** A new organisation: every group loaded, nothing in any of them. */
const EMPTY: Required<DashboardFigures> = {
  consignmentProgress: emptyConsignmentProgress(),
  upcomingSales: [],
  soldThisYear: { year: 2026, works: 0, totals: [] },
  payoutsDue: { payouts: 0, totals: [], nextDate: null, overdueSince: null },
  openBids: { lots: 0, totalMax: [] },
  purchasesToPay: { purchases: 0, totals: [] },
  bidAuthority: { everySale: null, sales: [] },
};

describe("At a glance, per role", () => {
  it.each([
    ["owner", ["in_upcoming_sales", "sold_this_year", "payouts_due", "open_bids"]],
    ["admin", ["in_upcoming_sales", "sold_this_year", "payouts_due", "open_bids"]],
    ["finance", ["sold_this_year", "payouts_due", "purchases_to_pay"]],
    ["consignor", ["works_by_stage", "in_upcoming_sales"]],
    ["buyer_agent", ["open_bids", "bid_limit", "authorised_sales"]],
    ["viewer", ["works_by_stage"]],
  ] as const)("%s sees %j", (role, tiles) => {
    expect(dashboardTileKindsFor({ role })).toEqual(tiles);
    expect(buildOrganisationDashboard({ role }, BUSY).tiles.map((tile) => tile.kind)).toEqual(
      tiles,
    );
  });

  it("never shows more than four figures", () => {
    for (const role of ROLES) expect(dashboardTileKindsFor({ role }).length).toBeLessThanOrEqual(4);
  });

  it("an impersonating admin sees the same figures as the role, read-only", () => {
    expect(dashboardTileKindsFor({ role: "owner", isImpersonation: true })).toEqual(
      dashboardTileKindsFor({ role: "owner" }),
    );
  });
});

describe("sections, per role", () => {
  it.each([
    ["owner", ["upcoming_sales", "consignment_progress"]],
    ["admin", ["upcoming_sales", "consignment_progress"]],
    ["finance", ["upcoming_sales", "consignment_progress"]],
    ["consignor", ["upcoming_sales", "consignment_progress"]],
    ["buyer_agent", []],
    ["viewer", ["upcoming_sales", "consignment_progress"]],
  ] as const)("%s: %j", (role, sections) => {
    expect(dashboardSectionsFor({ role })).toEqual(sections);
  });

  it("loads only the figure groups the role uses", () => {
    expect(dashboardFigureGroupsFor({ role: "buyer_agent" })).toEqual(["openBids", "bidAuthority"]);
    expect(dashboardFigureGroupsFor({ role: "viewer" })).toEqual([
      "consignmentProgress",
      "upcomingSales",
    ]);
    expect(dashboardFigureGroupsFor({ role: "owner" })).toEqual([
      "upcomingSales",
      "soldThisYear",
      "payoutsDue",
      "openBids",
      "consignmentProgress",
    ]);
  });

  it("shows the next four sales at most, and hides empty sections", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      title: `Sale ${i}`,
      startsAt: new Date(Date.UTC(2026, 10, 10 + i)),
      works: 1,
      estimates: [],
    }));
    const model = buildOrganisationDashboard({ role: "owner" }, { ...BUSY, upcomingSales: many });
    expect(model.upcomingSales).toHaveLength(4);

    const quiet = buildOrganisationDashboard(
      { role: "owner" },
      { ...BUSY, upcomingSales: [], consignmentProgress: emptyConsignmentProgress() },
    );
    expect(quiet.firstRun).toBeNull();
    expect(quiet.upcomingSales).toEqual([]);
    expect(quiet.progress).toBeNull();
  });

  it("a buyer agent never sees the organisation's consignments", () => {
    const model = buildOrganisationDashboard({ role: "buyer_agent" }, BUSY);
    expect(model.upcomingSales).toEqual([]);
    expect(model.progress).toBeNull();
  });
});

describe("whose records each figure counts", () => {
  it("narrows consignments to a consignor's own and bids to an agent's own", () => {
    expect(dashboardFigureScope({ role: "consignor" }, "consignmentProgress")).toBe("own");
    expect(dashboardFigureScope({ role: "consignor" }, "upcomingSales")).toBe("own");
    expect(dashboardFigureScope({ role: "owner" }, "consignmentProgress")).toBe("all");
    expect(dashboardFigureScope({ role: "viewer" }, "consignmentProgress")).toBe("attributed");
    expect(dashboardFigureScope({ role: "buyer_agent" }, "openBids")).toBe("own");
    expect(dashboardFigureScope({ role: "admin" }, "openBids")).toBe("all");
  });

  it("never narrows money that settles the whole organisation", () => {
    for (const group of ["soldThisYear", "payoutsDue", "purchasesToPay"] as const) {
      expect(dashboardFigureScope({ role: "finance" }, group)).toBe("all");
    }
  });
});

describe("empty figures", () => {
  it("a tile with nothing to show is marked empty instead of reading zero", () => {
    const model = buildOrganisationDashboard(
      { role: "owner" },
      { ...EMPTY, consignmentProgress: { ...emptyConsignmentProgress(), sold: 1 } },
    );
    expect(model.firstRun).toBeNull();
    expect(model.tiles.map((tile) => [tile.kind, tile.empty])).toEqual([
      ["in_upcoming_sales", true],
      ["sold_this_year", true],
      ["payouts_due", true],
      ["open_bids", true],
    ]);
  });

  it.each(ROLES)("%s: a new organisation gets its first steps, not a grid of zeros", (role) => {
    const model = buildOrganisationDashboard({ role }, EMPTY);
    expect(model.firstRun).not.toBeNull();
    expect(model.tiles).toEqual([]);
    expect(model.upcomingSales).toEqual([]);
    expect(model.progress).toBeNull();
  });

  it("first steps offer only what the role may do", () => {
    const actions = (role: LegalEntityMemberRole, isImpersonation = false) =>
      buildOrganisationDashboard({ role, isImpersonation }, EMPTY).firstRun?.actions;
    expect(actions("owner")).toEqual(["sell", "invite"]);
    expect(actions("consignor")).toEqual(["sell"]);
    expect(actions("viewer")).toEqual([]);
    expect(actions("owner", true)).toEqual([]);
  });

  it("first steps name only the records the role will see", () => {
    const shows = (role: LegalEntityMemberRole) =>
      buildOrganisationDashboard({ role }, EMPTY).firstRun?.shows;
    expect(shows("owner")).toEqual(["sales", "payouts", "bids", "purchases"]);
    expect(shows("admin")).toEqual(["sales", "payouts", "bids", "purchases"]);
    expect(shows("finance")).toEqual(["sales", "payouts", "purchases"]);
    expect(shows("consignor")).toEqual(["sales"]);
    expect(shows("viewer")).toEqual(["sales"]);
    // A buyer agent bids for the organisation and never sees its payouts.
    expect(shows("buyer_agent")).toEqual(["bids"]);
  });

  it("first steps speak to the organisation only for the people who run it", () => {
    const addressee = (role: LegalEntityMemberRole, isImpersonation = false) =>
      buildOrganisationDashboard({ role, isImpersonation }, EMPTY).firstRun?.addressee;
    expect(addressee("owner")).toBe("organisation");
    expect(addressee("admin")).toBe("organisation");
    // Support staff viewing as an owner read the owner's Home.
    expect(addressee("owner", true)).toBe("organisation");
    for (const role of ["finance", "consignor", "viewer", "buyer_agent"] as const) {
      expect(addressee(role)).toBe("member");
    }
  });

  it("is not a first run while a figure is still missing", () => {
    const { payoutsDue: _missing, ...partial } = EMPTY;
    expect(buildOrganisationDashboard({ role: "owner" }, partial).firstRun).toBeNull();
  });

  it("an authorisation alone is enough for a buyer agent's figures", () => {
    const model = buildOrganisationDashboard(
      { role: "buyer_agent" },
      { ...EMPTY, bidAuthority: BUSY.bidAuthority },
    );
    expect(model.firstRun).toBeNull();
    expect(model.tiles.map((tile) => [tile.kind, tile.empty])).toEqual([
      ["open_bids", true],
      ["bid_limit", false],
      ["authorised_sales", false],
    ]);
  });
});

describe("tile figures", () => {
  it("adds up upcoming works and keeps each currency's estimate apart", () => {
    const sales = upcomingSaleFigures([
      {
        saleId: "s1",
        title: "Modern British",
        startsAt: new Date("2026-11-20T10:00:00Z"),
        currency: "GBP",
        works: 2,
        estimatedWorks: 2,
        estimateLow: "8000.00",
        estimateHigh: "12000.00",
      },
      {
        saleId: "s1",
        title: "Modern British",
        startsAt: new Date("2026-11-20T10:00:00Z"),
        currency: "EUR",
        works: 1,
        estimatedWorks: 1,
        estimateLow: "3000.00",
        estimateHigh: "4000.00",
      },
      {
        saleId: "s0",
        title: "Prints",
        startsAt: new Date("2026-11-05T10:00:00Z"),
        currency: "GBP",
        works: 1,
        estimatedWorks: 0,
        estimateLow: "0",
        estimateHigh: "0",
      },
    ]);
    expect(sales.map((sale) => [sale.id, sale.works])).toEqual([
      ["s0", 1],
      ["s1", 3],
    ]);
    expect(sales[0]?.estimates).toEqual([]);
    expect(sales[1]?.estimates).toEqual([
      { currency: "GBP", low: "8000.00", high: "12000.00" },
      { currency: "EUR", low: "3000.00", high: "4000.00" },
    ]);

    const [tile] = buildOrganisationDashboard(
      { role: "owner" },
      { ...BUSY, upcomingSales: sales },
    ).tiles;
    expect(tile).toEqual({
      kind: "in_upcoming_sales",
      empty: false,
      own: false,
      works: 4,
      estimates: [
        { currency: "GBP", low: "8000.00", high: "12000.00" },
        { currency: "EUR", low: "3000.00", high: "4000.00" },
      ],
    });
  });

  it("names the two busiest stages for people who follow consignments", () => {
    const [tile] = buildOrganisationDashboard({ role: "viewer" }, BUSY).tiles;
    expect(tile).toEqual({
      kind: "works_by_stage",
      empty: false,
      own: false,
      total: 10,
      busiest: [
        { stage: "sold", count: 4 },
        { stage: "in_sale", count: 3 },
      ],
    });
  });

  it("says when a figure counts only the member's own records", () => {
    const own = (role: LegalEntityMemberRole) =>
      buildOrganisationDashboard({ role }, BUSY).tiles.map((tile) =>
        "own" in tile ? [tile.kind, tile.own] : [tile.kind],
      );
    expect(own("consignor")).toEqual([
      ["works_by_stage", true],
      ["in_upcoming_sales", true],
    ]);
    expect(own("buyer_agent")[0]).toEqual(["open_bids", true]);
    expect(own("owner")).toContainEqual(["open_bids", false]);
  });

  it("counts the sales a buyer agent may bid in and still has to register for", () => {
    const tiles = buildOrganisationDashboard({ role: "buyer_agent" }, BUSY).tiles;
    expect(tiles.find((tile) => tile.kind === "authorised_sales")).toEqual({
      kind: "authorised_sales",
      empty: false,
      everySale: false,
      sales: 1,
      toRegister: 1,
    });
  });
});

describe("bidLimitSummary", () => {
  const sale = (limit: string | null) => ({
    id: "s",
    title: "S",
    startsAt: new Date(),
    limit,
    registered: true,
  });

  it("an every-sale authorisation decides the limit", () => {
    expect(bidLimitSummary({ everySale: { limit: "5000.00" }, sales: [sale(null)] })).toEqual({
      kind: "amount",
      amount: "5000.00",
      scope: "every_sale",
      varies: false,
    });
    expect(bidLimitSummary({ everySale: { limit: null }, sales: [] })).toEqual({
      kind: "unlimited",
      scope: "every_sale",
    });
  });

  it("sale by sale: the highest limit, saying when they differ", () => {
    expect(bidLimitSummary({ everySale: null, sales: [sale("2000.00"), sale("8000.00")] })).toEqual(
      { kind: "amount", amount: "8000.00", scope: "sales", varies: true },
    );
    expect(bidLimitSummary({ everySale: null, sales: [sale("2000.00"), sale(null)] })).toEqual({
      kind: "unlimited",
      scope: "sales",
    });
    expect(bidLimitSummary({ everySale: null, sales: [] })).toEqual({ kind: "not_authorised" });
  });
});

describe("Home with the dashboard", () => {
  const facts = (role: LegalEntityMemberRole) => ({
    actor: { role },
    organisation: { status: "approved" as const, payoutsReady: true },
    unsoldLots: [],
    teamInvited: true,
  });
  const READ = { kinds: [], tasks: [] };

  it("first steps replace the shortcuts they would repeat", () => {
    expect(buildOrganisationHome(facts("owner"), [], EMPTY, READ).shortcuts).toEqual([]);
    expect(buildOrganisationHome(facts("owner"), [], BUSY, READ).shortcuts).toEqual([
      "sell",
      "invite",
      "statements",
    ]);
  });

  it("keeps the rest of Home when the figures could not be loaded", () => {
    const home = buildOrganisationHome(facts("owner"), [], null, READ);
    expect(home.dashboard).toBeNull();
    expect(home.shortcuts).toEqual(["sell", "invite", "statements"]);
  });
});

describe("splitPayoutDates", () => {
  const now = new Date("2026-10-29T12:00:00Z");

  it("separates the next date ahead from the earliest date already past", () => {
    expect(
      splitPayoutDates(
        [
          new Date("2026-12-01T00:00:00Z"),
          new Date("2026-05-08T00:00:00Z"),
          new Date("2026-11-03T00:00:00Z"),
          new Date("2026-09-01T00:00:00Z"),
        ],
        now,
      ),
    ).toEqual({
      nextDate: new Date("2026-11-03T00:00:00Z"),
      overdueSince: new Date("2026-05-08T00:00:00Z"),
    });
  });

  it("never offers a past date as the next one", () => {
    expect(splitPayoutDates([new Date("2026-05-08T00:00:00Z")], now)).toEqual({
      nextDate: null,
      overdueSince: new Date("2026-05-08T00:00:00Z"),
    });
  });

  it("is empty without dates, and counts a date at this instant as due, not overdue", () => {
    expect(splitPayoutDates([], now)).toEqual({ nextDate: null, overdueSince: null });
    expect(splitPayoutDates([now], now)).toEqual({ nextDate: now, overdueSince: null });
  });
});
