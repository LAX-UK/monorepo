import type { SaleLotsPage, SaleShell } from "@/lib/data/http/sales.server";
import type { SaleroomSecondaryData } from "@/lib/marketing/saleroom-page-data.service";
import { buildSaleroomPageVM } from "@/lib/marketing/saleroom-page.vm";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";

const baseSale: Sale = {
  id: "sale-1",
  title: "Evening Sale",
  description: "Curated highlights",
  coverImages: ["https://cdn/image.jpg"],
  categoryId: null,
  deliveryMode: "online",
  allowOnlineBidsBeforeGoLive: true,
  streamUrl: null,
  heroPresentation: "cover",
  heroVideoUrl: null,
  locationName: null,
  locationAddress: null,
  locationMapUrl: null,
  locationAddressLine1: null,
  locationAddressLine2: null,
  locationCity: null,
  locationCounty: null,
  locationPostcode: null,
  locationCountry: null,
  status: "active",
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  previewStartTime: null,
  subtitle: null,
  consignmentDeadline: null,
  buyerPremiumRate: "0.25",
  buyerPremiumTiers: null,
  terms: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseLot: Lot = {
  id: "lot-1",
  saleId: "sale-1",
  lotNumber: 7,
  sellerId: "seller-1",
  title: "Untitled Study",
  description: null,
  medium: "Oil on canvas",
  dimensions: null,
  images: ["https://cdn/lot.jpg"],
  categoryId: "cat-1",
  auctionType: "english",
  startingPrice: "100",
  reservePrice: null,
  buyNowPrice: null,
  currentPrice: "450",
  buyerPremiumRate: "0.25",
  minBidIncrement: "10",
  dutchDecrementAmount: null,
  dutchDecrementIntervalMs: 60_000,
  dutchLastDecrementAt: null,
  startTime: new Date("2026-06-01T18:00:00Z"),
  endTime: new Date("2026-06-01T21:00:00Z"),
  status: "active",
  winnerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  marketingDetails: {
    estimate: { low: "500", high: "800", currency: "USD" },
  },
};

const shell: SaleShell = { sale: baseSale, resultsSummary: null };

const lotsPage: SaleLotsPage = {
  items: [baseLot],
  withdrawn: [],
  total: 1,
  limit: 40,
  offset: 0,
  sort: "lot",
};

const secondary: SaleroomSecondaryData = {
  follow: { isFollowing: false },
  relatedSales: [],
  kycSummary: null,
  kycUnavailable: false,
  watchedLotIds: new Set<string>(),
  telephoneBooking: null,
};

describe("buildSaleroomPageVM", () => {
  it("builds without throwing for minimal sale shell", () => {
    const vm = buildSaleroomPageVM({
      shell,
      lotsPage,
      filteredLots: [baseLot],
      secondary,
      query: {
        pageRaw: undefined,
        catalogSearch: "",
        catalogSort: "lot",
        statusFilter: null,
        isCatalogLoadAll: false,
        pageNum: 1,
        layoutViewRaw: "grid",
        urlView: "grid",
      },
      layoutView: "grid",
      session: null,
      actingMemberships: null,
      orgModuleEnabled: false,
      mySaleRegs: [],
      registeredBidderCount: null,
      initialSaleroomStatus: { status: "none", currentLotId: null },
      categoryLabel: null,
      categoryLabels: [],
      now: new Date("2026-01-15T12:00:00Z"),
    });

    expect(vm.sale.id).toBe("sale-1");
    expect(vm.heroVM.title).toBe("Evening Sale");
    expect(vm.lotVMs).toHaveLength(1);
    expect(vm.lotVMs[0]?.title).toBe("Untitled Study");
  });

  it("does not offer a paused organisation for registration, and tells its buyer agent why", () => {
    const vm = buildSaleroomPageVM({
      shell,
      lotsPage,
      filteredLots: [baseLot],
      secondary,
      query: {
        pageRaw: undefined,
        catalogSearch: "",
        catalogSort: "lot",
        statusFilter: null,
        isCatalogLoadAll: false,
        pageNum: 1,
        layoutViewRaw: "grid",
        urlView: "grid",
      },
      layoutView: "grid",
      session: null,
      actingMemberships: [
        {
          id: "le-h",
          displayName: "Harrington Advisors",
          role: "buyer_agent",
          status: "restricted",
        },
        { id: "le-n", displayName: "Northbank Gallery", role: "buyer_agent", status: "approved" },
        { id: "le-c", displayName: "Crowley Fine Art", role: "viewer", status: "under_review" },
      ],
      orgModuleEnabled: true,
      mySaleRegs: [],
      registeredBidderCount: null,
      initialSaleroomStatus: { status: "none", currentLotId: null },
      categoryLabel: null,
      categoryLabels: [],
      now: new Date("2026-01-15T12:00:00Z"),
    });

    expect(vm.buyerEntities.map((entity) => entity.id)).toEqual(["le-n"]);
    expect(vm.registrationPaused).toEqual([
      {
        id: "le-h",
        title: "Bidding for Harrington Advisors is paused",
        line: "We can tell you why and when it resumes.",
      },
    ]);
  });
});

const query = {
  pageRaw: undefined,
  catalogSearch: "",
  catalogSort: "lot",
  statusFilter: null,
  isCatalogLoadAll: false,
  pageNum: 1,
  layoutViewRaw: "grid",
  urlView: "grid",
} as const;

function build(input: {
  sale?: Partial<Sale>;
  lots?: Lot[];
  withdrawn?: SaleLotsPage["withdrawn"];
  total?: number;
  resultsSummary?: SaleShell["resultsSummary"];
  now?: Date;
}) {
  const sale = { ...baseSale, ...input.sale };
  const lots = input.lots ?? [baseLot];
  const withdrawn = input.withdrawn ?? [];
  return buildSaleroomPageVM({
    shell: { sale, resultsSummary: input.resultsSummary ?? null },
    lotsPage: {
      items: lots,
      withdrawn,
      total: input.total ?? lots.length + withdrawn.length,
      limit: 40,
      offset: 0,
      sort: "lot",
    },
    filteredLots: lots,
    secondary,
    query,
    layoutView: "grid",
    session: null,
    actingMemberships: null,
    orgModuleEnabled: false,
    mySaleRegs: [],
    registeredBidderCount: null,
    initialSaleroomStatus: { status: "none", currentLotId: null },
    categoryLabel: null,
    categoryLabels: [],
    now: input.now ?? new Date("2026-01-15T12:00:00Z"),
  });
}

const manyLots = (n: number): Lot[] =>
  Array.from({ length: n }, (_, i) => ({ ...baseLot, id: `lot-${i + 1}`, lotNumber: i + 1 }));

describe("sale page states", () => {
  it("is a catalogue for a live sale with lots", () => {
    const vm = build({});
    expect(vm.pageState).toBe("catalogue");
    expect(vm.preparing).toBeNull();
    expect(vm.resultsBand).toBeNull();
  });

  it("promises lots, with the dates, for a scheduled sale with none published", () => {
    const vm = build({
      sale: {
        status: "scheduled",
        startTime: new Date("2026-02-22T10:00:00Z"),
        endTime: new Date("2026-02-23T10:00:00Z"),
        consignmentDeadline: new Date("2026-01-30T12:00:00Z"),
      },
      lots: [],
      total: 0,
    });
    expect(vm.pageState).toBe("preparing");
    expect(vm.preparing).toEqual({
      title: "The catalogue is being prepared",
      description:
        "Lots go online from Sun 22 Feb. Consignments for this sale are open until Fri 30 Jan.",
    });
    expect(vm.heroVM.lotCount).toBe(0);
  });

  it("is not the preparing state once any lot is published, even a withdrawn one", () => {
    const vm = build({
      sale: { status: "scheduled" },
      lots: [],
      withdrawn: [{ id: "w1", lotNumber: 1, title: "Harbour lights" }],
    });
    expect(vm.pageState).toBe("catalogue");
  });

  it("shows no results for an active sale", () => {
    expect(
      build({ resultsSummary: { state: "final", lotCount: 1 } as never }).resultsBand?.state,
    ).toBe("final");
  });

  it("says results are being finalised, with no figures", () => {
    const vm = build({
      sale: { status: "ended" },
      resultsSummary: { state: "finalising", pendingLotCount: 2 },
    });
    expect(vm.resultsBand).toMatchObject({
      state: "finalising",
      title: "Results are being finalised",
    });
  });

  it("reads final results from the server summary, not from the loaded lots", () => {
    const vm = build({
      sale: { status: "ended" },
      lots: manyLots(3),
      total: 80,
      resultsSummary: {
        state: "final",
        lotCount: 80,
        soldCount: 61,
        currency: "GBP",
        totalWithPremium: "250000.00",
        topLot: { lotId: "lot-2", priceWithPremium: "42000.00" },
        endedAt: "2026-01-10T18:00:00.000Z",
      },
    });
    if (vm.resultsBand?.state !== "final") throw new Error("expected final results");
    expect(vm.resultsBand.stats.map((s) => s.value)).toEqual([
      "61 of 80",
      "£250,000.00",
      "£42,000.00",
    ]);
    expect(JSON.stringify(vm.overviewVM)).not.toContain("loaded");
  });
});

describe("catalogue controls by size", () => {
  it.each([
    [6, false, false],
    [11, false, false],
    [12, true, false],
    [39, true, false],
    [40, true, true],
  ])("a sale of %i lots: toolbar %s, search %s", (count, toolbar, search) => {
    const vm = build({ lots: manyLots(count) });
    expect(vm.controls).toEqual({ toolbar, search });
  });

  it("counts withdrawn lots toward the size of the catalogue", () => {
    const vm = build({
      lots: manyLots(10),
      withdrawn: [
        { id: "w1", lotNumber: 11, title: "A" },
        { id: "w2", lotNumber: 12, title: "B" },
      ],
    });
    expect(vm.controls.toolbar).toBe(true);
  });
});

describe("withdrawn lots in the catalogue", () => {
  it("keeps the numbering: a withdrawn lot sits at its number in lot order", () => {
    const lots = [1, 2, 4].map((n) => ({ ...baseLot, id: `lot-${n}`, lotNumber: n }));
    const vm = build({ lots, withdrawn: [{ id: "w3", lotNumber: 3, title: "Winter orchard" }] });
    expect(vm.catalogueRows.map((r) => `${r.kind}:${r.key}`)).toEqual([
      "lot:lot-1",
      "lot:lot-2",
      "withdrawn:w3",
      "lot:lot-4",
    ]);
    expect(vm.lotVMs).toHaveLength(3);
  });

  it("counts withdrawn rows in the shown total", () => {
    const vm = build({
      lots: manyLots(2),
      withdrawn: [{ id: "w9", lotNumber: 9, title: "Winter orchard" }],
    });
    expect(vm.resultCountLabel).toBe("Show 3 lots");
  });
});

describe("sale hero", () => {
  it("carries the subtitle, trimmed, and none when it is blank", () => {
    expect(build({ sale: { subtitle: "  From York, with love " } }).heroVM.subtitle).toBe(
      "From York, with love",
    );
    expect(build({ sale: { subtitle: "   " } }).heroVM.subtitle).toBeNull();
  });

  it("names the format once and the place only when there is one", () => {
    const online = build({ sale: { deliveryMode: "online" } }).heroVM;
    expect([online.formatLabel, online.placeLabel]).toEqual(["Online", null]);
    const onsite = build({ sale: { deliveryMode: "onsite", locationCity: "Cheltenham" } }).heroVM;
    expect([onsite.formatLabel, onsite.placeLabel]).toEqual(["In-person", "Cheltenham"]);
    expect(onsite.dateLine).not.toContain("Cheltenham");
  });
});
