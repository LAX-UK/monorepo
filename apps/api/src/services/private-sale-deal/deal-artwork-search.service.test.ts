import type { ArtworkRegisterEntry, OfferState } from "@auction/artwork-register-contracts";
import type { OpenLotPlace } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  ARTWORK_SEARCH_CANDIDATES,
  DealArtworkSearchService,
} from "./deal-artwork-search.service.js";

const NOW = new Date("2026-11-11T10:00:00Z");
const STAFF = { userId: "u-staff", readsPrivateSale: true };

let counter = 0;
function entry(over: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  counter += 1;
  const n = String(counter).padStart(4, "0");
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    zohoProductId: `zp-${n}`,
    stockCode: `LAX-ORI-AR-TM-26-${n}`,
    kind: "original",
    sourceOriginalId: null,
    title: `Work ${n}`,
    artist: { zohoArtistId: null, name: "Tom Morris", code: "TM" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: [],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...over,
  };
}

const at = (state: OfferState, kind: "shop_artwork" | "bid_lot" | "private_sale", id = "x") =>
  ({ state, ref: { kind, id } }) as ArtworkRegisterEntry["offer"];

type Options = {
  found?: ArtworkRegisterEntry[];
  places?: OpenLotPlace[];
  enquiry?: object | null;
  work?: object | null;
  lotLink?: { registerId: string } | null;
  byId?: ArtworkRegisterEntry | null;
  events?: { type: string; payload: Record<string, unknown>; createdAt: Date }[];
  images?: Record<string, string>;
};

function setup(options: Options = {}) {
  const searchOriginals = vi.fn().mockResolvedValue(options.found ?? []);
  const listOpenLotPlaces = vi.fn().mockResolvedValue(options.places ?? []);
  const findById = vi.fn().mockResolvedValue(options.byId ?? null);
  const listEvents = vi.fn().mockResolvedValue(options.events ?? []);
  const findByRef = vi.fn().mockResolvedValue(options.enquiry ?? null);
  const findByReference = vi.fn().mockResolvedValue(options.work ?? null);
  const findLink = vi.fn().mockResolvedValue(options.lotLink ?? null);
  const resolveManyUnique = vi
    .fn()
    .mockImplementation(
      async (keys: string[]) =>
        new Map(
          keys.flatMap((k) => (options.images?.[k] ? [[k, options.images[k]] as const] : [])),
        ),
    );
  const service = new DealArtworkSearchService({
    register: { findById, listEvents },
    search: { searchOriginals },
    places: { listOpenLotPlaces },
    lots: { findLink },
    enquiries: { findByRef },
    works: { findByReference },
    media: { resolveManyUnique },
    now: () => NOW,
  });
  return {
    service,
    searchOriginals,
    listOpenLotPlaces,
    findById,
    listEvents,
    findByRef,
    findByReference,
    findLink,
    resolveManyUnique,
  };
}

const query = (over: object = {}) => ({ q: "", limit: 20, ...over });

async function items(service: DealArtworkSearchService, over: object = {}) {
  const outcome = await service.search(STAFF, query(over));
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

describe("DealArtworkSearchService availability", () => {
  it("asks the register's own check and gives its words and link when it would refuse", async () => {
    const free = entry();
    const onLaxArt = entry({ offer: at("lax_art", "shop_artwork") });
    const inPrivateSale = entry({ offer: at("private_sale", "private_sale", "deal-1") });
    const sold = entry({ offer: at("sold", "bid_lot") });
    const soldInGallery = entry({ catalogueStatus: "Sold" });
    const reserved = entry({ catalogueStatus: "Reserved" });
    const { service } = setup({
      found: [onLaxArt, inPrivateSale, sold, soldInGallery, reserved, free],
    });
    const { items: result } = await items(service);

    const byId = new Map(result.map((o) => [o.id, o]));
    expect(byId.get(free.id)).toMatchObject({ available: true });
    expect(byId.get(free.id)).not.toHaveProperty("lock");
    expect(byId.get(onLaxArt.id)?.lock).toEqual({
      reason: "live_on_lax_art",
      message:
        "This artwork is live on lax.art. Take it off lax.art first, or use Offer at auction to move it.",
      link: { label: "Open on lax.art", target: "lax_art_listing" },
    });
    expect(byId.get(inPrivateSale.id)?.lock?.reason).toBe("in_private_sale");
    expect(byId.get(sold.id)?.lock?.reason).toBe("sold_through_lax");
    expect(byId.get(soldInGallery.id)?.lock).toMatchObject({
      reason: "sold_in_gallery",
      link: { target: "zoho_record" },
    });
    expect(byId.get(reserved.id)?.lock?.reason).toBe("reserved_in_zoho");
    expect([...byId.values()].filter((o) => o.available)).toHaveLength(1);
  });

  it("treats a withdrawn artwork as available and one held in a deal as not", async () => {
    const withdrawn = entry({ offer: { state: "withdrawn", ref: null } });
    const { service } = setup({ found: [withdrawn] });
    expect((await items(service)).items[0]).toMatchObject({ available: true });
  });

  it("names the sale and lot when the artwork is in a LAX Bid sale", async () => {
    const inSale = entry({ offer: at("bid_sale", "bid_lot", "lot-1") });
    const { service } = setup({
      found: [inSale],
      places: [
        {
          registerId: inSale.id,
          lotId: "lot-1",
          lotNumber: 12,
          saleTitle: "Winter Prints",
          status: "scheduled",
        },
      ],
    });
    const [option] = (await items(service)).items;
    expect(option?.lock).toMatchObject({
      reason: "in_bid_sale",
      message:
        "This artwork is in a LAX Bid sale (Winter Prints, lot 12). Withdraw the lot there first.",
      link: { target: "bid_lot" },
    });
    expect(option?.whereItIs).toMatchObject({ key: "bid_sale" });
  });

  it("names the lot the register says the artwork is in, not another open lot", async () => {
    const inSale = entry({ offer: at("bid_sale", "bid_lot", "lot-1") });
    const { service } = setup({
      found: [inSale],
      places: [
        {
          registerId: inSale.id,
          lotId: "lot-other",
          lotNumber: 3,
          saleTitle: "Spring Drawings",
          status: "draft",
        },
      ],
    });
    const [option] = (await items(service)).items;
    expect(option?.lock?.reason).toBe("in_bid_sale");
    expect(option?.lock?.message).not.toContain("Spring Drawings");
    expect(option?.lock?.message).not.toContain("lot 3");
  });
});

describe("DealArtworkSearchService ordering and size", () => {
  it("puts the artworks that can be held first and keeps the register's order inside each group", async () => {
    const a = entry({ title: "A", offer: at("lax_art", "shop_artwork") });
    const b = entry({ title: "B" });
    const c = entry({ title: "C", catalogueStatus: "Sold" });
    const d = entry({ title: "D" });
    const { service } = setup({ found: [a, b, c, d] });
    const titles = (await items(service)).items.map((o) => o.title);
    expect(titles).toEqual(["B", "D", "A", "C"]);
  });

  it("returns at most the limit and says when there is more", async () => {
    const found = [entry(), entry(), entry()];
    const { service } = setup({ found });
    const result = await items(service, { limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect((await items(setup({ found }).service, { limit: 3 })).hasMore).toBe(false);
  });

  it("says there is more when the search hit its own cap", async () => {
    const found = Array.from({ length: ARTWORK_SEARCH_CANDIDATES }, () => entry());
    const { service } = setup({ found });
    expect((await items(service, { limit: 50 })).hasMore).toBe(true);
  });

  it("hands the typed text to the register search, which returns originals only", async () => {
    const { service, searchOriginals } = setup();
    await items(service, { q: "tom morris" });
    expect(searchOriginals).toHaveBeenCalledWith({
      text: "tom morris",
      suggest: undefined,
      limit: ARTWORK_SEARCH_CANDIDATES,
    });
  });
});

describe("DealArtworkSearchService suggestions", () => {
  const enquiry = (over: object = {}) => ({
    intent: "private_sale_buy",
    assignedToUserId: null,
    privateSale: { artist: " Tom Morris ", title: "Harbour at dusk" },
    ...over,
  });

  it("leads with what the enquiry describes while the box is empty, and marks the matches", async () => {
    const match = entry({ title: "Harbour at dusk" });
    const other = entry({
      title: "Unrelated",
      artist: { zohoArtistId: null, name: "Jo", code: "JO" },
    });
    const { service, searchOriginals } = setup({ found: [match, other], enquiry: enquiry() });
    const result = await items(service, { enquiry: "E-1042" });
    expect(searchOriginals).toHaveBeenCalledWith(
      expect.objectContaining({ suggest: { artist: "Tom Morris", title: "Harbour at dusk" } }),
    );
    expect(result.items.map((o) => [o.title, o.suggested])).toEqual([
      ["Harbour at dusk", true],
      ["Unrelated", false],
    ]);
  });

  it("lets typed text decide once the person types", async () => {
    const { service, searchOriginals } = setup({ enquiry: enquiry() });
    await items(service, { q: "morris", enquiry: "E-1042" });
    expect(searchOriginals).toHaveBeenCalledWith(expect.objectContaining({ suggest: undefined }));
  });

  it("asks for nothing when the enquiry names no artist or title", async () => {
    const { service, searchOriginals } = setup({
      enquiry: enquiry({ privateSale: { artist: null, title: "  " } }),
    });
    await items(service, { enquiry: "E-1042" });
    expect(searchOriginals).toHaveBeenCalledWith(expect.objectContaining({ suggest: undefined }));
  });

  it("reports an enquiry that does not exist as not found, and searches nothing", async () => {
    const { service, searchOriginals } = setup({ enquiry: null });
    expect(await service.search(STAFF, query({ enquiry: "E-9" }))).toEqual({
      ok: false,
      error: "enquiry_not_found",
    });
    expect(searchOriginals).not.toHaveBeenCalled();
  });

  it("does not show an enquiry to a role that cannot read private sale enquiries", async () => {
    const { service, searchOriginals } = setup({ enquiry: enquiry() });
    const outcome = await service.search(
      { userId: "u", readsPrivateSale: false },
      query({ enquiry: "E-1042" }),
    );
    expect(outcome).toEqual({ ok: false, error: "enquiry_not_found" });
    expect(searchOriginals).not.toHaveBeenCalled();
  });
});

describe("DealArtworkSearchService earlier lot", () => {
  const work = { id: "sub-1", reference: "C-1042", convertedLotId: "lot-9" };

  it("preselects the register artwork the consignment's earlier lot offered", async () => {
    const earlier = entry({ title: "Earlier" });
    const { service, findLink, findByReference } = setup({
      found: [entry()],
      work,
      lotLink: { registerId: earlier.id },
      byId: earlier,
    });
    const result = await items(service, { work: "C-1042" });
    expect(findByReference).toHaveBeenCalledWith("C-1042");
    expect(findLink).toHaveBeenCalledWith("lot-9");
    expect(result.preselected).toMatchObject({ id: earlier.id, title: "Earlier", available: true });
    expect(result.items.map((o) => o.id)).not.toContain(earlier.id);
  });

  it("shows why the earlier lot's artwork cannot be held when it cannot", async () => {
    const earlier = entry({ offer: at("private_sale", "private_sale", "deal-3") });
    const { service } = setup({ work, lotLink: { registerId: earlier.id }, byId: earlier });
    expect((await items(service, { work: "C-1042" })).preselected).toMatchObject({
      available: false,
      lock: { reason: "in_private_sale" },
    });
  });

  it("reuses the entry when the search already found it", async () => {
    const earlier = entry();
    const { service, findById } = setup({
      found: [earlier],
      work,
      lotLink: { registerId: earlier.id },
    });
    const result = await items(service, { work: "C-1042" });
    expect(result.preselected?.id).toBe(earlier.id);
    expect(findById).not.toHaveBeenCalled();
    expect(result.items.map((o) => o.id)).toEqual([earlier.id]);
  });

  it.each([
    ["the work is unknown", { work: null }],
    ["the work never had a lot", { work: { ...work, convertedLotId: null } }],
    ["the lot has no register link", { work, lotLink: null }],
    [
      "the linked entry is a print",
      { work, lotLink: { registerId: "r" }, byId: entry({ kind: "print" }) },
    ],
    ["the linked entry is gone", { work, lotLink: { registerId: "r" }, byId: null }],
  ] as const)("preselects nothing when %s", async (_label, options) => {
    const { service } = setup(options as Options);
    expect((await items(service, { work: "C-1042" })).preselected).toBeNull();
  });

  it("does not look for one when no consignment is given", async () => {
    const { service, findByReference } = setup();
    expect((await items(service)).preselected).toBeNull();
    expect(findByReference).not.toHaveBeenCalled();
  });
});

describe("DealArtworkSearchService what each option shows", () => {
  it("gives the recognisable facts, the where-it-is chip and a thumbnail", async () => {
    const e = entry({
      imageRefs: ["img/a.jpg", "img/b.jpg"],
      title: "Harbour at dusk",
      catalogueStatus: "Available",
    });
    const { service, resolveManyUnique } = setup({
      found: [e],
      images: { "img/a.jpg": "https://cdn.test/a.jpg" },
    });
    const [option] = (await items(service)).items;
    expect(resolveManyUnique).toHaveBeenCalledWith(["img/a.jpg"]);
    expect(option).toEqual({
      id: e.id,
      title: "Harbour at dusk",
      artist: "Tom Morris",
      medium: "Oil on canvas",
      size: "60 x 80 cm",
      stockCode: e.stockCode,
      catalogueStatus: "Available",
      thumbnailUrl: "https://cdn.test/a.jpg",
      whereItIs: {
        key: "not_offered",
        chip: { label: "Not offered", tone: "neutral", marker: "hollow" },
      },
      available: true,
      suggested: false,
    });
  });

  it("has no thumbnail when the artwork has no picture, and does not ask the resolver", async () => {
    const { service, resolveManyUnique } = setup({ found: [entry()] });
    expect((await items(service)).items[0]?.thumbnailUrl).toBeNull();
    expect(resolveManyUnique).not.toHaveBeenCalled();
  });

  it("shows a held artwork with a draft lot as a draft lot, like every other page", async () => {
    const e = entry();
    const { service } = setup({
      found: [e],
      places: [{ registerId: e.id, lotId: "l", lotNumber: null, saleTitle: null, status: "draft" }],
    });
    expect((await items(service)).items[0]?.whereItIs.key).toBe("draft_bid_lot");
  });

  it("reads Withdrawn, then Not offered after 30 days, from the artwork's history like its own page", async () => {
    const e = entry({ offer: { state: "withdrawn", ref: null } });
    const withdrawnOn = (createdAt: Date) => [
      {
        type: "offer_moved",
        payload: { from: { state: "lax_art" }, to: { state: "withdrawn" } },
        createdAt,
      },
    ];
    const recent = withdrawnOn(new Date("2026-11-01T00:00:00Z"));
    const old = withdrawnOn(new Date("2026-09-01T00:00:00Z"));
    const recentOption = (await items(setup({ found: [e], events: recent }).service)).items[0];
    const oldOption = (await items(setup({ found: [e], events: old }).service)).items[0];
    expect(recentOption?.whereItIs.key).toBe("withdrawn");
    expect(oldOption?.whereItIs.key).toBe("not_offered");
    expect(oldOption?.available).toBe(true);
  });

  it("only reads the history of withdrawn artworks", async () => {
    const { service, listEvents } = setup({ found: [entry(), entry({ catalogueStatus: "Sold" })] });
    await items(service);
    expect(listEvents).not.toHaveBeenCalled();
  });
});
