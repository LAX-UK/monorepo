import { describe, expect, it } from "vitest";
import {
  type AccountSearchResult,
  type SearchRow,
  accountSearchResultSchema,
  narrowerScopeNote,
  searchRowGroups,
} from "./account-search";
import { navCountsFrom } from "./needs-you-counts";
import { parseNeedsYouResponse } from "./needs-you-read";
import { RECENT_SEARCH_LIMIT, localRecentSearchStore, withRecent } from "./recent-searches";
import { matchingPages, shouldSearchRecords, workspaceSearchView } from "./workspace-search-model";

const RESULT: AccountSearchResult = accountSearchResultSchema.parse({
  searchable: ["consignments", "purchases", "bids", "works", "invoices", "members"],
  groups: [
    {
      group: "purchases",
      items: [
        {
          lotId: "lot-57",
          title: "Harbour at dawn",
          artistName: "Eleanor Vance",
          lotNumber: 57,
          saleTitle: "Modern British",
          lotStatus: "sold",
        },
      ],
      nextOffset: null,
    },
    {
      group: "consignments",
      items: [{ submissionId: "s-1", title: "Night harbour", status: "needs_changes" }],
      nextOffset: null,
    },
    {
      group: "invoices",
      items: [
        {
          paymentId: "p-1",
          invoiceNumber: "INV-2026-0412",
          lotId: "lot-57",
          title: "Harbour at dawn",
          amount: "6450.00",
          currency: "GBP",
          status: "overdue",
        },
      ],
      nextOffset: null,
    },
    { group: "members", items: [], nextOffset: null },
  ],
});

const PAGES = [
  { id: "home", label: "Home", href: "/home" },
  { id: "payouts", label: "Sold & payouts", href: "/selling/payouts" },
];

describe("account search results", () => {
  it("names each group and turns each hit into a row that opens its record", () => {
    const groups = searchRowGroups(RESULT);
    expect(groups.map((g) => g.label)).toEqual(["Purchases", "Consignments", "Invoices"]);
    expect(groups[0]?.rows[0]).toMatchObject({
      label: "Harbour at dawn",
      meta: "Lot 57 · won · Modern British",
      href: "/lot/harbour-at-dawn/lot-57",
    });
    expect(groups[1]?.rows[0]).toMatchObject({
      meta: "Consignment · needs changes",
      href: "/selling/consignments/s-1",
    });
    expect(groups[2]?.rows[0]).toMatchObject({
      label: "INV-2026-0412 · Harbour at dawn",
      meta: "£6,450.00 · overdue",
    });
  });

  it("lists a lot the account bid on and won once, under Purchases", () => {
    const groups = searchRowGroups({
      searchable: ["purchases", "bids"],
      groups: [
        { group: "purchases", items: [{ lotId: "l1", title: "Harbour Light", lotStatus: "sold" }] },
        {
          group: "bids",
          items: [
            { lotId: "l1", title: "Harbour Light", lotStatus: "sold" },
            { lotId: "l2", title: "Low tide", lotNumber: 12, lotStatus: "live" },
          ],
        },
      ],
    });
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.label)])).toEqual([
      ["Purchases", ["Harbour Light"]],
      ["Bids", ["Low tide"]],
    ]);
    expect(groups[0]?.rows[0]?.meta).toBe("won");
    expect(groups[1]?.rows[0]?.meta).toBe("Lot 12 · live");
  });

  it("leaves out a group with no hits", () => {
    expect(searchRowGroups(RESULT).map((g) => g.id)).not.toContain("members");
  });

  it("says what a narrower role does not search, and nothing for a full one", () => {
    expect(narrowerScopeNote(["consignments", "bids"], "Consignor")).toBe(
      "Showing what a consignor can open. Purchases, works, invoices and people aren't searched.",
    );
    expect(narrowerScopeNote(["purchases", "invoices", "works"], "Admin")).toMatch(
      /^Showing what an admin/,
    );
    expect(narrowerScopeNote(RESULT.searchable, "Owner")).toBeNull();
    // Owners find won works under Purchases, so Works is not a gap for them.
    expect(
      narrowerScopeNote(["consignments", "purchases", "bids", "invoices", "members"], "Owner"),
    ).toBeNull();
  });
});

describe("the palette's view", () => {
  it("offers recent picks and the role's pages before anything is typed", () => {
    const view = workspaceSearchView({
      query: "",
      pages: PAGES,
      recent: [
        {
          id: "r",
          label: "Thames at low tide",
          href: "/selling/consignments/s-9",
          kind: "consignments",
        },
      ],
      records: null,
      roleLabel: "Owner",
    });
    expect(view.groups.map((g) => g.label)).toEqual(["Recent", "Go to"]);
    expect(view.scopeNote).toBeNull();
  });

  it("puts records first and only the pages whose name matches", () => {
    const view = workspaceSearchView({
      query: "sold",
      pages: PAGES,
      recent: [],
      records: { searchable: ["consignments"], groups: [] },
      roleLabel: "Consignor",
    });
    expect(view.groups.map((g) => g.label)).toEqual(["Pages"]);
    expect(view.groups[0]?.rows.map((r) => r.label)).toEqual(["Sold & payouts"]);
    expect(view.scopeNote).toMatch(/^Showing what a consignor can open/);
  });

  it("asks the API from two characters, or a lot number", () => {
    expect(shouldSearchRecords("h")).toBe(false);
    expect(shouldSearchRecords("ha")).toBe(true);
    expect(shouldSearchRecords("7")).toBe(true);
    expect(shouldSearchRecords("#12")).toBe(true);
  });

  it("matches pages without minding case", () => {
    expect(matchingPages(PAGES, "HOME").map((r) => r.href)).toEqual(["/home"]);
  });
});

describe("recent searches", () => {
  const row = (id: string): SearchRow => ({ id, label: id, href: `/x/${id}`, kind: "bids" });

  it("keeps the newest first, without duplicates, up to the limit", () => {
    let rows = [row("a"), row("b")];
    rows = withRecent(rows, row("b"));
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
    for (const id of ["c", "d", "e", "f", "g"]) rows = withRecent(rows, row(id));
    expect(rows).toHaveLength(RECENT_SEARCH_LIMIT);
    expect(rows[0]?.id).toBe("g");
  });

  it("keeps one list per account, and survives storage that is blocked", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage;
    const store = localRecentSearchStore(() => storage);
    store.remember("org-a", row("a"));
    expect(store.read("org-a").map((r) => r.id)).toEqual(["a"]);
    expect(store.read("org-b")).toEqual([]);
    const blocked = localRecentSearchStore(() => {
      throw new Error("blocked");
    });
    expect(blocked.read("org-a")).toEqual([]);
    expect(() => blocked.remember("org-a", row("a"))).not.toThrow();
  });

  it("ignores stored rows that do not open a page here", () => {
    const storage = {
      getItem: () =>
        JSON.stringify([{ id: "x", label: "Elsewhere", href: "https://evil.example" }]),
      setItem: () => undefined,
    } as unknown as Storage;
    expect(localRecentSearchStore(() => storage).read("org-a")).toEqual([]);
  });
});

describe("Needs-you counts in the menu", () => {
  it("maps each section to its menu entry and never keeps a zero", () => {
    expect(
      navCountsFrom({ bids: 1, purchases: 3, consignments: 0, team: 2, organisation: 0 }),
    ).toEqual({ bids: 1, purchases: 3, team: 2 });
    expect(navCountsFrom(null)).toEqual({});
  });

  it("reads the reader's response and nothing else", () => {
    expect(
      parseNeedsYouResponse({
        data: { kinds: [], counts: { bids: 1, consignments: 2, other: 5 }, tasks: [] },
      })?.counts,
    ).toEqual({ bids: 1, consignments: 2 });
    expect(parseNeedsYouResponse({ error: "forbidden" })).toBeNull();
    expect(parseNeedsYouResponse(null)).toBeNull();
  });

  it("reads each task with its dates and link, and skips a kind this build does not know", () => {
    const read = parseNeedsYouResponse({
      data: {
        kinds: ["outbid", "pay"],
        counts: { bids: 1 },
        truncated: true,
        tasks: [
          {
            kind: "outbid",
            lots: [{ id: "l1", title: "Sun over Arles", endsAt: "2026-10-30T18:12:00.000Z" }],
            link: { page: "lot", id: "l1" },
          },
          { kind: "something_new", link: { page: "bids" } },
        ],
      },
    });
    expect(read?.tasks).toEqual([
      {
        kind: "outbid",
        lots: [{ id: "l1", title: "Sun over Arles", endsAt: new Date("2026-10-30T18:12:00.000Z") }],
        link: { page: "lot", id: "l1" },
      },
    ]);
    expect(read?.truncated).toBe(true);
  });
});
