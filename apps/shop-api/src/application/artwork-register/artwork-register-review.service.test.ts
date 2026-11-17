import {
  type ArtworkRegisterEntry,
  CATALOGUE_GAPS,
  REOPEN_REFUSAL_MESSAGE,
} from "@auction/artwork-register-contracts";
import {
  type AdminAuctionOfferAssessment,
  AdminRegisterAllItemSchema,
  AdminRegisterAllListSchema,
  REGISTER_GAP_VALUES,
} from "@auction/shop-contracts";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it, vi } from "vitest";
import type {
  ArtworkRegisterOverview,
  ArtworkRegisterQueue,
  RegisterConflictRecord,
  RegisterEventRecord,
} from "../ports/artwork-register-review.ports.js";
import {
  type ArtworkRegisterReviewDeps,
  ArtworkRegisterReviewService,
  presentArtworkSummary,
  presentGallerySale,
} from "./artwork-register-review.service.js";

const ID = "2f0b6d7e-0000-4000-8000-000000000001";
const T0 = new Date("2026-11-03T09:00:00.000Z");

function entry(overrides: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  return {
    id: ID,
    zohoProductId: "5001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: "77", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: null,
    year: 2024,
    imageRefs: [],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: T0,
    createdAt: T0,
    updatedAt: T0,
    version: 1,
    ...overrides,
  };
}

function conflict(overrides: Partial<RegisterConflictRecord> = {}): RegisterConflictRecord {
  return {
    id: "c0000000-0000-4000-8000-000000000001",
    registerId: ID,
    field: "stockCode",
    zohoValue: "LAX-ORI-PH-GAC-26-0099",
    laxValue: "LAX-ORI-PH-GAC-26-0001",
    status: "open",
    resolution: null,
    resolvedBy: null,
    resolvedAt: null,
    zohoModifiedAt: T0,
    detectedAt: T0,
    ...overrides,
  };
}

function assessment(over: Partial<AdminAuctionOfferAssessment> = {}): AdminAuctionOfferAssessment {
  return {
    registerId: ID,
    artworkId: null,
    title: "Harbour at dusk",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    onLaxArt: false,
    laxArtDraft: false,
    draftLot: null,
    holdingLotId: null,
    eligible: true,
    zohoPrice: null,
    consignorAgreement: null,
    blockers: [],
    ...over,
  };
}

function service(overrides: Partial<ArtworkRegisterReviewDeps> = {}) {
  const queue: ArtworkRegisterQueue = {
    listHeld: vi.fn(async () => ({ entries: [entry()], total: 31 })),
    listOpenConflicts: vi.fn(async () => ({
      items: [{ conflict: conflict(), entry: entry() }],
      total: 1,
    })),
    listConflictsFor: vi.fn(async () => [conflict()]),
    countHeld: vi.fn(async () => 31),
    countOpenConflicts: vi.fn(async () => 1),
    listHeldArtists: vi.fn(async () => [{ code: "PH", name: "Aidan Phelan", count: 31 }]),
  };
  const overview: ArtworkRegisterOverview = {
    listAll: vi.fn(async () => ({
      rows: [
        {
          entry: entry(),
          hasLaxArtDraft: true,
          location: { id: "loc-1", name: "Framer", status: "retired" as const },
          consignor: {
            kind: "client" as const,
            partyId: "22222222-2222-4222-8222-222222222222",
            displayName: "Ivo Marren",
          },
        },
        {
          entry: entry({ id: "b", offer: { state: "sold", ref: null } }),
          hasLaxArtDraft: false,
          location: null,
          consignor: null,
        },
      ],
      total: 2,
    })),
    listArtists: vi.fn(async () => [{ code: "PH", name: "Aidan Phelan", count: 2 }]),
    countPlaces: vi.fn(async () => ({
      not_offered: 0,
      draft_lax_art: 1,
      lax_art: 0,
      bid_sale: 0,
      private_sale: 0,
      withdrawn: 0,
      sold: 1,
    })),
    countConsignors: vi.fn(async () => ({
      none: 1,
      lax: 0,
      clients: [
        { partyId: "22222222-2222-4222-8222-222222222222", displayName: "Ivo Marren", count: 1 },
      ],
    })),
  };
  const deps: ArtworkRegisterReviewDeps = {
    queue,
    overview,
    register: { findById: vi.fn(async () => entry()), listEvents: vi.fn(async () => []) },
    resolver: {
      resolveConflict: vi.fn(async () => ({
        ok: true as const,
        conflict: conflict({
          status: "resolved",
          resolution: "kept_lax",
          resolvedBy: "staff:u1",
          resolvedAt: T0,
        }),
      })),
    },
    catalogueChanges: { changesFor: vi.fn(async () => []) },
    runs: { latestNightlyRun: vi.fn(async () => null) },
    listingRuns: { latestRun: async () => null, countFailedDeliveries: async () => 0 },
    staffNames: { namesFor: async () => new Map([["u1", "Cat Alogue"]]) },
    listings: {
      findByZohoProductId: vi.fn(async () => null),
      findZohoProductId: vi.fn(async () => null),
    },
    auction: { assessRegister: vi.fn(async () => assessment()) },
    now: () => T0,
    ...overrides,
  };
  return { service: new ArtworkRegisterReviewService(deps), deps, queue };
}

describe("presentArtworkSummary: which Zoho module the record is in", () => {
  it("is Print_Products for a print group LAX issued, Products for everything else", () => {
    const group = entry({
      kind: "print",
      stockCode: "LAX-PRT-PH-GAC-26-0001",
      sourceOriginalId: "o",
    });
    const zohoBorn = entry({
      kind: "print",
      stockCode: "LAX-PRI-PH-GAC-26-0001",
      sourceOriginalId: null,
    });
    expect(presentArtworkSummary(group).zohoModule).toBe("Print_Products");
    expect(presentArtworkSummary(zohoBorn).zohoModule).toBe("Products");
    expect(presentArtworkSummary(entry()).zohoModule).toBe("Products");
  });
});

describe("ArtworkRegisterReviewService", () => {
  it("lists new artworks with what each lacks, the artists and both counts", async () => {
    const { service: s } = service();
    const list = await s.listNew({});
    expect(list).toMatchObject({
      total: 31,
      page: 1,
      pageSize: 25,
      counts: { new: 31, decisions: 1 },
      artists: [{ code: "PH", name: "Aidan Phelan", count: 31 }],
    });
    expect(list.items[0]).toMatchObject({
      title: "Harbour at dusk",
      artistCode: "PH",
      missing: ["image", "size"],
      zohoModifiedAt: T0.toISOString(),
    });
  });

  it("lists every record with where it is, the place counts and the queue counts", async () => {
    const { service: s } = service();
    const list = await s.listAll({});
    expect(list.items.map((item) => [item.whereItIs.key, item.whereItIs.chip.label])).toEqual([
      ["draft_lax_art", "Draft on lax.art"],
      ["sold", "Sold"],
    ]);
    expect(list.places.map((place) => [place.value, place.label, place.count])).toEqual([
      ["not_offered", "Not offered", 0],
      ["draft_lax_art", "Draft on lax.art", 1],
      ["lax_art", "On lax.art", 0],
      ["bid_sale", "In a LAX Bid sale", 0],
      ["private_sale", "In a private sale", 0],
      ["withdrawn", "Withdrawn", 0],
      ["sold", "Sold", 1],
    ]);
    expect(list).toMatchObject({ total: 2, counts: { new: 31, decisions: 1 } });
    // Where each one physically is, with a retired location marked.
    expect(list.items.map((item) => item.location)).toEqual([
      { id: "loc-1", name: "Framer", status: "retired", label: "Framer (retired)" },
      null,
    ]);
  });

  it("carries Zoho's price on each list item, and null when Zoho has none", async () => {
    const { service: s, deps } = service();
    vi.mocked(deps.overview.listAll).mockResolvedValue({
      rows: [
        {
          entry: entry({ zohoPrice: "4800.00" }),
          hasLaxArtDraft: false,
          location: null,
          consignor: null,
        },
        { entry: entry({ id: "b" }), hasLaxArtDraft: false, location: null, consignor: null },
      ],
      total: 2,
    });
    const list = await s.listAll({});
    expect(list.items.map((item) => item.zohoPrice)).toEqual(["4800.00", null]);
    expect(
      Value.Check(AdminRegisterAllItemSchema.properties.zohoPrice, list.items[0]?.zohoPrice),
    ).toBe(true);
  });

  it("keeps a withdrawn record reading Withdrawn in the list, whatever its age", async () => {
    const { service: s, deps } = service();
    vi.mocked(deps.overview.listAll).mockResolvedValue({
      rows: [
        {
          entry: entry({ offer: { state: "withdrawn", ref: null } }),
          hasLaxArtDraft: false,
          location: null,
          consignor: null,
        },
      ],
      total: 1,
    });
    const list = await s.listAll({});
    expect(list.items[0]?.whereItIs.key).toBe("withdrawn");
  });

  it("passes the artist, place and page offset to the overview", async () => {
    const { service: s, deps } = service();
    await s.listAll({ artist: "PH", place: "sold", location: "none", page: 2 });
    expect(deps.overview.listAll).toHaveBeenCalledWith(
      { artistCode: "PH", place: "sold", location: "none" },
      { limit: 25, offset: 25 },
      undefined,
      undefined,
    );
    expect(deps.overview.countPlaces).toHaveBeenCalledWith("PH");
  });

  it("says who consigned each work, with the Consignor filter's choices, to people who may read it", async () => {
    const { service: s, deps } = service();
    const list = await s.listAll({ consignor: "lax" }, { consignorScope: { kind: "all" } });
    expect(deps.overview.listAll).toHaveBeenCalledWith(
      { consignor: "lax" },
      { limit: 25, offset: 0 },
      undefined,
      { kind: "all" },
    );
    expect(deps.overview.countConsignors).toHaveBeenCalledWith({ kind: "all" });
    expect(list.items.map((item) => item.consignor)).toEqual([
      {
        kind: "client",
        partyId: "22222222-2222-4222-8222-222222222222",
        displayName: "Ivo Marren",
      },
      null,
    ]);
    expect(list.consignors).toEqual([
      { value: "none", label: "Not set", count: 1 },
      { value: "lax", label: "LAX owns this work", count: 0 },
      { value: "22222222-2222-4222-8222-222222222222", label: "Ivo Marren", count: 1 },
    ]);
    expect(Value.Check(AdminRegisterAllListSchema.properties.consignors, list.consignors)).toBe(
      true,
    );
  });

  it("leaves a row's consignor out for a print or a client outside the reader's scope", async () => {
    const { service: s, deps } = service();
    vi.mocked(deps.overview.listAll).mockResolvedValue({
      rows: [
        { entry: entry(), hasLaxArtDraft: false, location: null, consignor: { kind: "not_shown" } },
        { entry: entry({ id: "b" }), hasLaxArtDraft: false, location: null, consignor: null },
      ],
      total: 2,
    });
    const scope = { kind: "assigned" as const, brokerSubjectId: "broker-1" };
    const list = await s.listAll({}, { consignorScope: scope });
    expect(list.items[0]).not.toHaveProperty("consignor");
    expect(list.items[1]?.consignor).toBeNull();
    expect(deps.overview.listAll).toHaveBeenCalledWith(
      {},
      { limit: 25, offset: 0 },
      undefined,
      scope,
    );
    expect(deps.overview.countConsignors).toHaveBeenCalledWith(scope);
  });

  it("leaves consignors out for people who cannot read consignor agreements", async () => {
    const { service: s, deps } = service();
    const list = await s.listAll({});
    expect(list.items.every((item) => !("consignor" in item))).toBe(true);
    expect(list).not.toHaveProperty("consignors");
    expect(deps.overview.countConsignors).not.toHaveBeenCalled();
  });

  it("passes the order by Zoho's price to the overview, so it holds across pages", async () => {
    const { service: s, deps } = service();
    await s.listAll({ sort: "zohoPrice", page: 3 });
    expect(deps.overview.listAll).toHaveBeenCalledWith(
      {},
      { limit: 25, offset: 50 },
      "zohoPrice",
      undefined,
    );
  });

  it("reports both queue sizes for the Overview", async () => {
    const { service: s } = service();
    expect(await s.queueCounts()).toEqual({ new: 31, decisions: 1 });
  });

  it("passes the filters and the page offset to the queue", async () => {
    const { service: s, queue } = service();
    await s.listNew({ artist: "PH", missing: "image", page: 3 });
    expect(queue.listHeld).toHaveBeenCalledWith(
      { artistCode: "PH", missing: "image" },
      { limit: 25, offset: 50 },
    );
  });

  it("lists open conflicts with their artwork and plain values", async () => {
    const { service: s } = service();
    const list = await s.listConflicts({});
    expect(list.items[0]?.conflict).toMatchObject({
      field: "stockCode",
      zohoValue: "LAX-ORI-PH-GAC-26-0099",
      laxValue: "LAX-ORI-PH-GAC-26-0001",
      status: "open",
    });
    expect(list.items[0]?.artwork.title).toBe("Harbour at dusk");
    expect(list.counts).toEqual({ new: 31, decisions: 1 });
  });

  it("says there has been no check until one has run", async () => {
    expect(await service().service.lastCheck()).toEqual({
      counts: { new: 31, decisions: 1 },
      run: null,
      listing: { run: null, failedDeliveries: 0 },
    });
  });

  it("presents the latest check with its mode and counts", async () => {
    const { service: s } = service({
      runs: {
        latestNightlyRun: async () => ({
          runId: "nightly:dry_run:2026-11-03",
          mode: "dry_run",
          finishedAt: T0,
          total: 859,
          byOutcome: { create: 376, update: 0, conflict: 0, unchanged: 0, stale: 0, skipped: 483 },
          skippedReasons: [{ reason: "missing_artist", count: 230 }],
          gaps: [{ gap: "missing_price", count: 432 }],
        }),
      },
    });
    expect(await s.lastCheck()).toEqual({
      counts: { new: 31, decisions: 1 },
      run: {
        mode: "dry_run",
        finishedAt: T0.toISOString(),
        total: 859,
        outcomes: { create: 376, update: 0, conflict: 0, unchanged: 0, stale: 0, skipped: 483 },
        skippedReasons: [{ reason: "missing_artist", count: 230 }],
        gaps: [{ gap: "missing_price", count: 432 }],
      },
      listing: { run: null, failedDeliveries: 0 },
    });
  });

  it("presents the latest listing pass and the writes that gave up", async () => {
    const failures = [
      { registerId: ID, stockCode: "LAX-ORI-PH-GAC-26-0001", code: "INVALID_DATA" },
    ];
    const { service: s } = service({
      listingRuns: {
        latestRun: async () => ({
          mode: "live",
          finishedAt: T0,
          checked: 668,
          changed: 12,
          unchanged: 655,
          failed: 1,
          failures,
        }),
        countFailedDeliveries: async () => 2,
      },
    });
    expect((await s.lastCheck()).listing).toEqual({
      failedDeliveries: 2,
      run: {
        mode: "live",
        finishedAt: T0.toISOString(),
        checked: 668,
        changed: 12,
        unchanged: 655,
        failed: 1,
        failures,
      },
    });
  });

  it("shows where a Product deleted in Zoho now sits in LAX, and only for those", async () => {
    const failures = [
      { registerId: ID, stockCode: "LAX-ORI-PH-GAC-26-0001", code: "product_not_found" },
      { registerId: ID, stockCode: "LAX-ORI-PH-GAC-26-0002", code: "INVALID_DATA" },
    ];
    const { service: s } = service({
      listingRuns: {
        latestRun: async () => ({
          mode: "live",
          finishedAt: T0,
          checked: 2,
          changed: 0,
          unchanged: 0,
          failed: 2,
          failures,
        }),
        countFailedDeliveries: async () => 0,
      },
    });
    const shown = (await s.lastCheck()).listing.run?.failures ?? [];
    expect(shown[0]?.place).toEqual(expect.any(String));
    expect(shown[0]?.place).not.toBe("");
    expect(shown[1]).not.toHaveProperty("place");
  });

  it("opens one artwork with its conflicts and history, newest first, naming staff", async () => {
    const events: RegisterEventRecord[] = [
      { id: "e1", registerId: ID, type: "created", actor: "zoho", payload: {}, createdAt: T0 },
      {
        id: "e2",
        registerId: ID,
        type: "conflict_resolved",
        actor: "staff:u1",
        payload: { resolution: "kept_lax" },
        createdAt: new Date(T0.getTime() + 1000),
      },
    ];
    const { service: s } = service({
      register: { findById: async () => entry(), listEvents: async () => events },
    });
    const detail = await s.get(ID);
    expect(detail?.events.map((e) => [e.id, e.actor])).toEqual([
      ["e2", "staff"],
      ["e1", "zoho"],
    ]);
    expect(detail?.events.map((e) => e.actorName)).toEqual(["Cat Alogue", null]);
    expect(detail).toMatchObject({ imageCount: 0, missing: ["image", "size"], offerState: "held" });
    expect(detail?.conflicts).toHaveLength(1);
  });

  it("says where the artwork is, from the draft made from it", async () => {
    const { service: s } = service({
      listings: {
        findByZohoProductId: async () => ({
          artworkId: "a0000000-0000-4000-8000-000000000001",
          slug: "aidan-phelan-harbour-at-dusk",
          published: false,
          createdAt: T0.toISOString(),
        }),
        findZohoProductId: async () => null,
      },
    });
    const detail = await s.get(ID);
    expect(detail?.whereItIs).toMatchObject({ key: "draft_lax_art" });
    expect(detail?.laxArt).toMatchObject({
      slug: "aidan-phelan-harbour-at-dusk",
      published: false,
    });
  });

  it("says a draft lot in LAX Bid is where the artwork is, and links the lot", async () => {
    const lot = { lotId: "b0000000-0000-4000-8000-000000000002", saleTitle: "Winter sale" };
    const { service: s } = service({
      auction: { assessRegister: async () => assessment({ draftLot: lot }) },
    });
    const detail = await s.get(ID);
    expect(detail?.whereItIs).toMatchObject({ key: "draft_bid_lot", bidLot: lot });
    expect(detail?.auctionBlockers).toEqual([]);
  });

  it("carries why the artwork cannot be offered at auction", async () => {
    const blocker = { message: "Zoho shows this artwork as reserved.", link: null };
    const { service: s } = service({
      auction: {
        assessRegister: async () => assessment({ eligible: false, blockers: [blocker] }),
      },
    });
    expect((await s.get(ID))?.auctionBlockers).toEqual([blocker]);
  });

  it("finds nothing for an unknown artwork", async () => {
    const { service: s } = service({
      register: { findById: async () => null, listEvents: async () => [] },
    });
    expect(await s.get(ID)).toBeNull();
  });

  it("records a decision under the staff member", async () => {
    const { service: s, deps } = service();
    const outcome = await s.resolve({
      conflictId: "c0000000-0000-4000-8000-000000000001",
      body: { resolution: "kept_lax" },
      actorSubjectId: "u1",
    });
    expect(deps.resolver.resolveConflict).toHaveBeenCalledWith({
      conflictId: "c0000000-0000-4000-8000-000000000001",
      resolution: "kept_lax",
      resolvedBy: "staff:u1",
      now: T0,
    });
    expect(outcome).toMatchObject({
      kind: "resolved",
      result: { registerId: ID, conflict: { status: "resolved", resolution: "kept_lax" } },
    });
  });

  it("says which conflicts can take Zoho's value", async () => {
    const { service: s } = service({
      queue: {
        ...service().queue,
        listOpenConflicts: async () => ({
          items: [
            { conflict: conflict(), entry: entry() },
            { conflict: conflict({ field: "offerState" }), entry: entry() },
          ],
          total: 2,
        }),
      },
    });
    const list = await s.listConflicts({});
    expect(list.items.map((i) => i.conflict.canAcceptZoho)).toEqual([true, false]);
  });

  it.each([
    "not_found",
    "already_resolved",
    "cannot_accept_field",
    "invalid_stock_code",
    "stock_code_taken",
  ] as const)("passes on %s", async (reason) => {
    const { service: s } = service({
      resolver: { resolveConflict: async () => ({ ok: false, reason }) },
    });
    expect(
      await s.resolve({
        conflictId: "x",
        body: { resolution: "accepted_zoho" },
        actorSubjectId: "u",
      }),
    ).toEqual({ kind: reason });
  });

  it("keeps the contract's gap list in step with the register's", () => {
    expect([...REGISTER_GAP_VALUES]).toEqual([...CATALOGUE_GAPS]);
  });
});

describe("presentGallerySale: why Reopen waits, in the API's own words", () => {
  const sold = { state: "sold", ref: { kind: "gallery_sale", id: "5001" } } as const;

  it("gives the contract's refusal while Zoho still says Sold", () => {
    expect(presentGallerySale(entry({ catalogueStatus: "Sold", offer: sold }))).toEqual({
      reopen: "zoho_still_sold",
      reopenWaitReason: REOPEN_REFUSAL_MESSAGE.zoho_still_sold,
    });
  });

  it("gives no reason once Zoho no longer says Sold", () => {
    expect(presentGallerySale(entry({ catalogueStatus: "Available", offer: sold }))).toEqual({
      reopen: "allowed",
      reopenWaitReason: null,
    });
  });
});
