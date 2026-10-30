import type { AccountRegistrationView } from "@/lib/data/http/account-buying.types";
import { describe, expect, it } from "vitest";
import {
  appliedBidFilters,
  bidViewCounts,
  bidsInView,
  bidsListSearch,
  parseBidsListQuery,
} from "./bids-list";
import { buildBuyerAgentBanner } from "./buyer-agent-banner";
import type { MyBidCardVm } from "./my-bids.vm";
import { buildRegistrationRows } from "./registrations.vm";

function card(overrides: Partial<MyBidCardVm>): MyBidCardVm {
  return {
    id: "b",
    lotId: "l",
    href: "/lot/l",
    image: null,
    title: "Untitled",
    lotLabel: "Lot 1",
    saleId: "s-1",
    saleTitle: "Autumn online",
    placedBy: null,
    placementNote: null,
    status: "winning",
    statusLabel: "Winning",
    figures: [],
    next: null,
    more: [],
    closesAt: 0,
    amount: 0,
    ...overrides,
  };
}

const CARDS = [
  card({
    id: "1",
    title: "Sun over Arles",
    lotLabel: "Lot 88",
    closesAt: 3,
    amount: 6200,
    placedBy: "Tom Whitfield",
  }),
  card({
    id: "2",
    title: "Tidal study III",
    lotLabel: "Lot 91",
    closesAt: 1,
    amount: 2000,
    status: "outbid",
  }),
  card({
    id: "3",
    title: "Downs in winter",
    saleId: "s-2",
    saleTitle: "Modern British",
    closesAt: 2,
    amount: 9000,
  }),
];

describe("the Bids list query", () => {
  it("reads the address, keeps defaults out of it and ignores what it does not know", () => {
    const query = parseBidsListQuery({
      tab: "won",
      sort: "nonsense",
      status: "bogus",
      q: " arles ",
    });
    expect(query).toMatchObject({ view: "won", sort: "recent", status: null, q: "arles" });
    expect(bidsListSearch(parseBidsListQuery({}))).toBe("");
    expect(bidsListSearch({ ...query, sort: "highest" })).toBe("?tab=won&q=arles&sort=highest");
  });

  it("filters by sale, placed by and status, searches every word, then sorts", () => {
    const base = parseBidsListQuery({});
    expect(bidsInView(CARDS, base).map((c) => c.id)).toEqual(["2", "3", "1"]);
    expect(bidsInView(CARDS, { ...base, sort: "highest" }).map((c) => c.id)).toEqual([
      "3",
      "1",
      "2",
    ]);
    expect(bidsInView(CARDS, { ...base, sale: "s-2" }).map((c) => c.id)).toEqual(["3"]);
    expect(bidsInView(CARDS, { ...base, by: "Tom Whitfield" }).map((c) => c.id)).toEqual(["1"]);
    expect(bidsInView(CARDS, { ...base, status: "outbid" }).map((c) => c.id)).toEqual(["2"]);
    expect(bidsInView(CARDS, { ...base, q: "88" }).map((c) => c.id)).toEqual(["1"]);
    expect(bidsInView(CARDS, { ...base, q: "modern downs" }).map((c) => c.id)).toEqual(["3"]);
  });

  it("counts each view under the filters, and names the filters as chips", () => {
    const query = { ...parseBidsListQuery({}), sale: "s-1", by: "Tom Whitfield" };
    expect(bidViewCounts({ active: CARDS, won: [], lost: [] }, query)).toEqual({
      active: 1,
      won: 0,
      lost: 0,
    });
    expect(appliedBidFilters(query, [{ id: "s-1", title: "Autumn online" }])).toEqual([
      { id: "sale", label: "Sale: Autumn online" },
      { id: "by", label: "Placed by: Tom Whitfield" },
    ]);
  });
});

function registration(overrides: Partial<AccountRegistrationView>): AccountRegistrationView {
  return {
    id: "r",
    saleId: "s",
    saleTitle: "Sale",
    saleStartsAt: new Date("2026-11-19T14:00:00Z"),
    saleEndsAt: new Date("2026-11-19T18:00:00Z"),
    status: "approved",
    paddleNumber: 1042,
    bidLimit: "20000",
    requestedAt: new Date("2026-10-28T10:00:00Z"),
    decidedAt: null,
    registeredBy: { userId: "u", name: "Tom Whitfield" },
    ...overrides,
  };
}

describe("the Sales view", () => {
  it("reads each registration's state, limit and next step", () => {
    const rows = buildRegistrationRows(
      [
        registration({ id: "a", saleTitle: "Modern British" }),
        registration({ id: "p", status: "pending", bidLimit: null, saleTitle: "Post-war" }),
        registration({ id: "x", status: "rejected", bidLimit: null, saleTitle: "Design" }),
      ],
      { showRegisteredBy: true },
    );
    expect(
      rows.map((row) => [row.title, row.status.label, row.figure.value, row.figure.label]),
    ).toEqual([
      ["Modern British", "Approved", "£20,000", "a lot"],
      ["Post-war", "Waiting for approval", "–", "set when approved"],
      ["Design", "Not approved", "–", "ask us why"],
    ]);
    expect(rows[0]?.meta).toEqual([
      "19 Nov 2026, 14:00 UK time",
      "paddle 1042",
      "registered by Tom Whitfield",
    ]);
    expect(rows[1]?.meta).toContain("asked 28 Oct");
    expect(rows[0]?.href).toBe("/bids?sale=s");
    expect(rows[2]?.href).toBeNull();
    expect(rows[2]?.contact).toBe(true);
  });
});

describe("the buyer-agent banner", () => {
  it("says where and how much, with the share of the total in use", () => {
    const banner = buildBuyerAgentBanner({
      organisation: "Northbank Gallery",
      authorisations: [
        {
          sale: {
            id: "s-1",
            title: "Modern British",
            startTime: "2026-11-19T14:00:00Z",
            registered: true,
          },
          bidLimit: "20000",
          validUntil: "2026-11-19T23:00:00Z",
        },
      ],
      limits: {
        canManage: false,
        organisation: { limit: null, exposure: "0", available: null, updatedAt: null },
        authorisations: [
          {
            authorisationId: "a",
            userId: "u",
            userName: "Tom",
            saleId: "s-1",
            saleTitle: "Modern British",
            bidLimit: "20000",
            total: { limit: "25000", exposure: "8000", available: "17000" },
          },
        ],
      },
    });
    expect(banner).toEqual({
      kind: "authorised",
      organisation: "Northbank Gallery",
      lines: [
        {
          key: "s-1",
          text: "in Modern British up to £20,000 a lot, until 19 Nov",
          usage: { text: "£8,000 of your £25,000 total is used.", percent: 32 },
        },
      ],
    });
  });

  it("tells an agent with no authorisation who can give one", () => {
    expect(
      buildBuyerAgentBanner({
        organisation: "Northbank Gallery",
        authorisations: [],
        limits: null,
      }),
    ).toEqual({ kind: "not-authorised", organisation: "Northbank Gallery" });
  });
});
